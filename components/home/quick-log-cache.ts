import { z } from 'zod';
import type { Id } from '@/convex/_generated/dataModel';

const presetSchema = z.object({
  _id: z
    .string()
    .min(1)
    .transform((value) => value as Id<'quickLogPresets'>),
  group: z.enum(['strength', 'cardio', 'recovery']),
  inputKind: z.enum(['reps', 'duration', 'duration_or_distance']),
  key: z.string(),
  label: z.string(),
  sortOrder: z.number().finite(),
});
const cacheSchema = z.object({ cachedAt: z.number().finite(), presets: z.array(presetSchema) });
export type QuickLogPreset = z.infer<typeof presetSchema>;

export function readQuickLogCache(value: string) {
  const parsed: unknown = JSON.parse(value);
  return cacheSchema.parse(parsed);
}
