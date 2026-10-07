// How a coach note is laid out on the today screen. The daily greeting lives in greeting.ts.

const MAX_HEADLINE_LENGTH = 40;
const FIRST_SENTENCE = /^(.{1,40}?[.!?])(?:\s+|$)/s;

/**
 * A coach note on the today screen leads with its first sentence as the headline when that is
 * short enough to read as one; the rest is the body. A note with no short first sentence is all body.
 */
export function splitCoachNote(text: string): { body: string; headline: string | null } {
  const trimmed = text.trim();
  const match = FIRST_SENTENCE.exec(trimmed);

  if (!match || match[1].length > MAX_HEADLINE_LENGTH) {
    return { body: trimmed, headline: null };
  }

  return { body: trimmed.slice(match[0].length).trim(), headline: match[1] };
}
