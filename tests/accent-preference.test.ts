import assert from 'node:assert/strict';
import test from 'node:test';
import { accentForGender, parseAccentPreference, resolveAccent } from '../design/accent-preference';
import { reedAccentPalettes, reedTheme, themeForAccent } from '../design/system';

function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
test('automatic maps recorded gender choices and manual accent wins', () => {
  assert.equal(accentForGender('male'), 'blue'); assert.equal(accentForGender('female'), 'rose');
  for (const value of ['other', 'private', 'nonbinary', 'prefer_not_to_say']) assert.equal(accentForGender(value), 'sage');
  assert.equal(accentForGender(null), 'blue');
  assert.equal(resolveAccent({ choice: 'silver', automatic: 'rose' }), 'silver');
  assert.equal(resolveAccent({ choice: 'automatic', automatic: 'sage' }), 'sage');
});
test('local preferences survive serialization and reject corrupt or unknown values', () => {
  const saved = { choice: 'amber' as const, automatic: 'rose' as const };
  assert.deepEqual(parseAccentPreference(JSON.stringify(saved)), saved);
  for (const raw of [null, 'broken', 'null', '{}', '{"choice":"missing","automatic":"blue"}', '{"choice":"blue","automatic":"missing"}']) assert.equal(parseAccentPreference(raw), null);
});
test('each palette keeps readable button text and accent ink, without changing status colors', () => {
  for (const [id, palette] of Object.entries(reedAccentPalettes)) {
    assert.ok(contrast(palette.accent, palette.accentText) >= 4.5, `${id} button text`);
    const theme = themeForAccent(id as keyof typeof reedAccentPalettes);
    for (const background of [theme.colors.canvas, theme.colors.surface, theme.colors.surfaceRaised]) assert.ok(contrast(palette.accentInk, background) >= 4.5, `${id} accent ink`);
    assert.equal(theme.colors.painHigh, reedTheme.colors.painHigh); assert.equal(theme.colors.dangerInk, reedTheme.colors.dangerInk); assert.equal(theme.colors.dataWarm, reedTheme.colors.dataWarm);
  }
});
