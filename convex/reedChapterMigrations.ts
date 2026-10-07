import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { backfillMessageChapter } from "./reedChapters";
import schema from "./schema";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

const migrations = new Migrations<DataModel, typeof schema>(
  components.migrations,
  { schema },
);
export const backfillChapters = migrations.define({
  table: "reedMessages",
  batchSize: 100,
  customRange: (query) => query.withIndex("by_created_at").order("asc"),
  migrateOne: backfillMessageChapter,
});

// Live writes can precede a historical backfill. Repair those missing chronological links.
export const repairChapters = migrations.define({
  table: "reedChapters",
  batchSize: 100,
  migrateOne: async (ctx, chapter) => {
    const previous = await ctx.db
      .query("reedChapters")
      .withIndex("by_thread_id_and_started_at", (q) =>
        q.eq("threadId", chapter.threadId).lt("startedAt", chapter.startedAt),
      )
      .order("desc")
      .first();
    if (!chapter.previousChapterId && previous)
      await ctx.db.patch(chapter._id, { previousChapterId: previous._id });
    if (chapter.closedAt !== undefined) return;
    const next = await ctx.db
      .query("reedChapters")
      .withIndex("by_thread_id_and_started_at", (q) =>
        q.eq("threadId", chapter.threadId).gt("startedAt", chapter.startedAt),
      )
      .first();
    if (next) {
      await ctx.db.patch(chapter._id, { closedAt: next.startedAt });
      return;
    }
    const last = await ctx.db
      .query("reedMessages")
      .withIndex("by_chapter_id_and_created_at", (q) =>
        q.eq("chapterId", chapter._id),
      )
      .order("desc")
      .first();
    const after = Math.max(chapter.startedAt, last?.createdAt ?? 0);
    const start = await ctx.db
      .query("liveSessions")
      .withIndex("by_profile_id_and_started_at", (q) =>
        q.eq("profileId", chapter.profileId).gt("startedAt", after),
      )
      .first();
    const end = await ctx.db
      .query("liveSessions")
      .withIndex("by_profile_id_and_ended_at", (q) =>
        q.eq("profileId", chapter.profileId).gt("endedAt", after),
      )
      .first();
    const event =
      !start || (end && end.endedAt! < start.startedAt) ? end : start;
    if (event)
      await ctx.db.patch(chapter._id, {
        closedAt: event === end ? end!.endedAt! : start!.startedAt,
        closedBySessionId: event._id,
        closedByBoundary: event === end ? "session_ended" : "session_started",
      });
  },
});

/** Return counts only, never historical health/chat content. */
export const auditBatch = internalQuery({
  args: {
    table: v.union(
      v.literal("reedMessages"),
      v.literal("reedChapters"),
      v.literal("reedThreads"),
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query(args.table)
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(args.paginationOpts.numItems, 100),
      });
    let missing = 0,
      invalid = 0,
      missingLink = 0;
    for (const row of page.page) {
      if ("content" in row) {
        if (!row.chapterId) missing++;
        else {
          const chapter = await ctx.db.get(row.chapterId);
          if (
            !chapter ||
            chapter.threadId !== row.threadId ||
            chapter.profileId !== row.profileId
          )
            invalid++;
        }
      } else if ("startedAt" in row) {
        const thread = await ctx.db.get(row.threadId);
        if (!thread || thread.profileId !== row.profileId) invalid++;
        const prior = await ctx.db
          .query("reedChapters")
          .withIndex("by_thread_id_and_started_at", (q) =>
            q.eq("threadId", row.threadId).lt("startedAt", row.startedAt),
          )
          .order("desc")
          .first();
        if (prior && !row.previousChapterId) missingLink++;
      } else if (row.currentChapterId) {
        const chapter = await ctx.db.get(row.currentChapterId);
        if (!chapter || chapter.threadId !== row._id) invalid++;
      }
    }
    return {
      missing,
      invalid,
      missingLink,
      count: page.page.length,
      isDone: page.isDone,
      cursor: page.continueCursor,
    };
  },
});
export const audit = internalAction({
  args: {},
  handler: async (ctx) => {
    const totals = { count: 0, missing: 0, invalid: 0, missingLink: 0 };
    for (const table of [
      "reedMessages",
      "reedChapters",
      "reedThreads",
    ] as const) {
      let cursor: string | null = null;
      for (;;) {
        const page: {
          count: number;
          missing: number;
          invalid: number;
          missingLink: number;
          isDone: boolean;
          cursor: string;
        } = await ctx.runQuery(internal.reedChapterMigrations.auditBatch, {
          table,
          paginationOpts: { cursor, numItems: 100 },
        });
        totals.count += page.count;
        totals.missing += page.missing;
        totals.invalid += page.invalid;
        totals.missingLink += page.missingLink;
        if (page.isDone) break;
        cursor = page.cursor;
      }
    }
    return totals;
  },
});
