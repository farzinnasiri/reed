import manifest from '@/assets/body-3d/v3.4/manifest.json';
import delivery from '@/assets/body-3d/v3.4/compressed/original-gzip.json';

export { manifest, delivery };
export type BodyVariant = 'male' | 'female';
export type BodyAppearance = { adiposity: number; muscularity: number };
export type BodyHighlights = { pain: Record<string, number>; primary: string[]; secondary: string[] };
export type BodyPick = { regionId: string; area: string; view: 'front' | 'back'; x: number; y: number };
export type BodyPalette = { canvas: string; primary: string; secondary: string; pending: string; pain: string[] };
export type BodyStatus = { state: 'loading' | 'ready' | 'error'; loadMs?: number; decodeMs?: number; parseMs?: number; firstFrameMs?: number; drawCalls?: number; triangles?: number };
export const EMPTY_HIGHLIGHTS: BodyHighlights = { pain: {}, primary: [], secondary: [] };
export const BASE_APPEARANCE: BodyAppearance = { adiposity: 0, muscularity: 0 };
export const BODY_REGIONS = manifest.discomfortRegions;
export const regionById = new Map(BODY_REGIONS.map(region => [region.id, region]));
export const regionByLabel = new Map(BODY_REGIONS.map(region => [region.storedAreaLabel, region]));
const muscleIds = new Set(manifest.muscles.map(muscle => muscle.id));
const aliases = new Map(Object.entries(manifest.catalogAliases).map(([label, value]) => [label.trim().toLowerCase(), value.muscleIds]));

export function clampMorph(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** Unknown or explicitly unsupported catalog labels never light up the entire body. */
export function resolveMuscles(labels: string[]): Set<string> {
  return new Set(labels.flatMap(label => {
    const key = label.trim().toLowerCase();
    return muscleIds.has(key) ? [key] : aliases.get(key) ?? [];
  }));
}

/** Runs refer to the final, unmodified GLB index buffer. Null is intentionally unselectable. */
export function regionForTriangle(variant: BodyVariant, triangle: number): string | null {
  return lookupRun(manifest.variants[variant].selectionTriangleRuns, triangle);
}

function lookupRun(runs: (string | number | null)[][], triangle: number): string | null {
  let low = 0;
  let high = runs.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const [start, count, region] = runs[middle];
    if (triangle < Number(start)) high = middle - 1;
    else if (triangle >= Number(start) + Number(count)) low = middle + 1;
    else return typeof region === 'string' ? region : null;
  }
  return null;
}
