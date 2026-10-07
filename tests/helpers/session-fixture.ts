import assert from 'node:assert/strict';
import type { RegisteredMutation, RegisteredQuery } from 'convex/server';
import type { MutationCtx, QueryCtx } from '../../convex/_generated/server';
export function handler<
  Visibility extends 'public' | 'internal',
  Args extends Record<string, unknown>,
  Result,
>(fn: RegisteredQuery<Visibility, Args, Result> | RegisteredMutation<Visibility, Args, Result>) {
  return (fn as unknown as { _handler: (ctx: QueryCtx | MutationCtx, args: Args) => Result })
    ._handler;
}

type Row = Record<string, unknown>;
export function fixture(extra: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    profiles: [
      {
        _id: 'profile',
        _creationTime: 0,
        authUserId: 'issuer|subject',
        email: 'test@example.com',
        timeZone: 'UTC',
      },
    ],
    ...extra,
  };
  let authenticated = true;
  const bounds: Array<{ table: string; limit: number }> = [];
  const writes: Row[] = [];
  const scheduled: unknown[] = [];
  const ctx = {
    auth: {
      getUserIdentity: async () =>
        authenticated ? { tokenIdentifier: 'issuer|subject', email: 'test@example.com' } : null,
    },
    storage: { getUrl: async () => 'https://example.com/image' },
    scheduler: {
      runAfter: async (...args: unknown[]) => {
        scheduled.push(args);
      },
    },
    db: {
      get: async (id: string) =>
        Object.values(tables)
          .flat()
          .find((row) => row._id === id) ?? null,
      normalizeId: (table: string, id: string) =>
        tables[table]?.some((row) => row._id === id) ? id : null,
      patch: async (id: string, patch: Row) => {
        const row = Object.values(tables)
          .flat()
          .find((item) => item._id === id);
        assert.ok(row);
        writes.push(patch);
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined) delete row[key];
          else row[key] = value;
        }
      },
      insert: async (table: string, value: Row) => {
        const id = `${table}-${tables[table]?.length ?? 0}`;
        (tables[table] ??= []).push({ ...value, _id: id });
        writes.push(value);
        return id;
      },
      delete: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const i = rows.findIndex((row) => row._id === id);
          if (i >= 0) rows.splice(i, 1);
        }
      },
      query(table: string) {
        let rows = [...(tables[table] ?? [])];
        let sortField = '_creationTime';
        const index = {
          eq(key: string, value: unknown) {
            rows = rows.filter((row) => row[key] === value);
            return index;
          },
          gte(key: string, value: number) {
            rows = rows.filter((row) => Number(row[key]) >= value);
            return index;
          },
          gt(key: string, value: number) {
            rows = rows.filter((row) => Number(row[key]) > value);
            return index;
          },
          lt(key: string, value: number) {
            rows = rows.filter((row) => Number(row[key]) < value);
            return index;
          },
          lte(key: string, value: number) {
            rows = rows.filter((row) => Number(row[key]) <= value);
            return index;
          },
        };
        const query = {
          withIndex(name: string, range: (builder: typeof index) => unknown) {
            sortField =
              (
                {
                  logged_at: 'loggedAt',
                  started_at: 'startedAt',
                  ended_at: 'endedAt',
                  observed_at: 'observedAt',
                  created_at: 'createdAt',
                  set_number: 'setNumber',
                  position: 'position',
                } as Record<string, string>
              )[name.split('_and_').at(-1)!] ?? '_creationTime';
            range(index);
            return query;
          },
          order(direction: string) {
            rows.sort(
              (a, b) =>
                (Number(a[sortField]) - Number(b[sortField])) * (direction === 'desc' ? -1 : 1),
            );
            return query;
          },
          unique: async () => rows[0] ?? null,
          first: async () => rows[0] ?? null,
          take: async (limit: number) => {
            bounds.push({ table, limit });
            return rows.slice(0, limit);
          },
          paginate: async (opts: { cursor: string | null; numItems: number }) => {
            bounds.push({ table, limit: opts.numItems });
            return {
              page: rows.slice(0, opts.numItems),
              continueCursor: 'next',
              isDone: rows.length <= opts.numItems,
            };
          },
          collect: async () => rows,
        };
        return query;
      },
    },
  } as unknown as MutationCtx;
  return {
    ctx,
    tables,
    writes,
    bounds,
    scheduled,
    signOut: () => {
      authenticated = false;
    },
  };
}
