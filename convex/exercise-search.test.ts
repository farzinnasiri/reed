/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function owner() {
  const t = convexTest(schema, modules);
  const profileId = await t.run(ctx => ctx.db.insert('profiles', {
    authUserId: 'test|owner',
    email: 'owner@example.test',
    updatedAt: 1,
  }));
  return { t, profileId, viewer: t.withIdentity({ tokenIdentifier: 'test|owner', email: 'owner@example.test' }) };
}

function catalog(name: string, equipment: string[]) {
  return {
    aliases: [] as string[],
    canonicalFamily: 'bench_press',
    contextTags: [] as string[],
    equipment,
    exerciseClass: 'strength',
    exerciseId: name.toLowerCase().replace(/\s+/g, '-'),
    isCardio: false,
    isHold: false,
    isSupportedInLiveSession: true,
    jointsEmphasized: [] as string[],
    mainMuscleGroups: ['chest'],
    movementPatterns: [] as string[],
    name,
    rawMetricRecipe: '',
    recipeKey: 'standard_load' as const,
    searchText: name.toLowerCase(),
    secondaryMuscleGroups: [] as string[],
    skillTags: [] as string[],
    supportsLiveTracking: false,
    updatedAt: 1,
    usesBodyweight: false,
  };
}

test.each([
  'bicep incline', 'incline dumb', 'dumb incline', 'incline biceps',
  'dumbbell incline', 'dumb incl', 'incl dumb cur', 'cur incl dumb',
  'db incline', 'incline db bicep', 'dumbbells incline curls',
  'BÍCEP   INCLINE', 'incline-dumb', 'dumbbell inclnie curl',
])('%s finds the incline dumbbell curl across name and muscle terms', async query => {
  const { t, viewer } = await owner();
  await t.run(async ctx => {
    await ctx.db.insert('exerciseCatalog', {
      ...catalog('Dumbbell Incline Curl', ['dumbbell']),
      canonicalFamily: 'biceps_curl',
      mainMuscleGroups: ['Biceps'],
      searchText: 'dumbbell incline curl biceps dumbbell',
    });
    await ctx.db.insert('exerciseCatalog', catalog('Dumbbell Incline Bench Press', ['dumbbell']));
    await ctx.db.insert('exerciseCatalog', {
      ...catalog('Cable Curl', ['cable']),
      canonicalFamily: 'biceps_curl',
      mainMuscleGroups: ['Biceps'],
      searchText: 'cable curl biceps',
    });
  });
  const result = await viewer.query(api.exerciseCatalog.searchForPicker, {
    query,
    paginationOpts: { cursor: null, numItems: 40 },
  });
  expect(result.page.map(item => item.name)).toContain('Dumbbell Incline Curl');
  expect(result.page.map(item => item.name)).not.toContain('Cable Curl');
  if (query.includes('bicep')) {
    expect(result.page.map(item => item.name)).not.toContain('Dumbbell Incline Bench Press');
  }
});

test('search combines anatomy synonyms with equipment and respects explicit filters', async () => {
  const { t, viewer } = await owner();
  await t.run(async ctx => {
    await ctx.db.insert('exerciseCatalog', {
      ...catalog('Cable Fly', ['cable']),
      searchText: 'cable fly chest',
    });
    await ctx.db.insert('exerciseCatalog', catalog('Barbell Bench Press', ['barbell']));
    await ctx.db.insert('exerciseCatalog', {
      ...catalog('Cable Curl', ['cable']),
      mainMuscleGroups: ['biceps'],
      canonicalFamily: 'curl',
      searchText: 'cable curl biceps',
    });
  });
  for (const query of ['pecs cable', 'cable chest', 'chest cab']) {
    const result = await viewer.query(api.exerciseCatalog.searchForPicker, {
      query,
      paginationOpts: { cursor: null, numItems: 40 },
    });
    expect(result.page.map(item => item.name)).toEqual(['Cable Fly']);
  }
  const filtered = await viewer.query(api.exerciseCatalog.searchForPicker, {
    query: 'pecs cable', equipment: ['barbell'],
    paginationOpts: { cursor: null, numItems: 40 },
  });
  expect(filtered.page).toEqual([]);
});

test('body-area searches include derived primary areas absent from imported search text', async () => {
  const { t, viewer } = await owner();
  await t.run(async ctx => {
    await ctx.db.insert('exerciseCatalog', {
      ...catalog('Dumbbell Incline Curl', ['dumbbell']),
      mainMuscleGroups: ['biceps'], canonicalFamily: 'curl',
      searchText: 'dumbbell incline curl biceps',
    });
    await ctx.db.insert('exerciseCatalog', {
      ...catalog('Bench Press', ['barbell']),
      primaryFocusAreas: ['chest'], primaryTargetAreas: ['chest'],
    });
  });
  const result = await viewer.query(api.exerciseCatalog.searchForPicker, {
    query: 'arms', paginationOpts: { cursor: null, numItems: 40 },
  });
  expect(result.page.map(item => item.name)).toEqual(['Dumbbell Incline Curl']);
});

test('a primary muscle match ranks ahead of incidental secondary work', async () => {
  const { t, viewer } = await owner();
  await t.run(async ctx => {
    await ctx.db.insert('exerciseCatalog', {
      ...catalog('Dumbbell Chest-Supported Row', ['dumbbell']),
      aliases: ['incline db row'], canonicalFamily: 'row',
      mainMuscleGroups: ['lats'], secondaryMuscleGroups: ['biceps'],
      searchText: 'dumbbell chest supported row incline db row lats biceps',
    });
    await ctx.db.insert('exerciseCatalog', {
      ...catalog('Dumbbell Incline Curl', ['dumbbell']),
      canonicalFamily: 'curl', mainMuscleGroups: ['biceps'],
      searchText: 'dumbbell incline curl biceps',
    });
  });
  const result = await viewer.query(api.exerciseCatalog.searchForPicker, {
    query: 'bicep incline', paginationOpts: { cursor: null, numItems: 40 },
  });
  expect(result.page.map(item => item.name)).toEqual([
    'Dumbbell Incline Curl', 'Dumbbell Chest-Supported Row',
  ]);
  const partialName = await viewer.query(api.exerciseCatalog.searchForPicker, {
    query: 'dumb incl', paginationOpts: { cursor: null, numItems: 40 },
  });
  expect(partialName.page.map(item => item.name)).toEqual([
    'Dumbbell Incline Curl', 'Dumbbell Chest-Supported Row',
  ]);
});
