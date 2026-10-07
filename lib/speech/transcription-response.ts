import { z } from 'zod';

const responseSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
  text: z.string().optional(),
});

export function parseTranscriptionResponse(value: unknown) {
  const result = responseSchema.safeParse(value);
  return result.success ? result.data : null;
}
