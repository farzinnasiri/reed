import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTranscriptionResponse } from '../lib/speech/transcription-response';
import { readQuickLogCache } from '../components/home/quick-log-cache';

test('transcription payloads reject malformed values before string operations', () => {
  assert.equal(parseTranscriptionResponse({ text: 123 }), null);
  assert.equal(parseTranscriptionResponse(null), null);
  assert.equal(parseTranscriptionResponse([]), null);
  assert.deepEqual(parseTranscriptionResponse({ text: 'A transcript' }), { text: 'A transcript' });
});

test('quick-log cache rejects valid JSON with invalid preset fields', () => {
  assert.throws(() => readQuickLogCache('{"cachedAt":1,"presets":[{"label":"Bad preset"}]}'));
  assert.throws(() => readQuickLogCache('{"cachedAt":1,"presets":{}}'));
  const preset = {
    _id: 'preset',
    group: 'strength',
    inputKind: 'reps',
    key: 'push_ups',
    label: 'Push-ups',
    sortOrder: 1,
  };
  assert.deepEqual(readQuickLogCache(JSON.stringify({ cachedAt: 100, presets: [preset] })).presets, [preset]);
});

test('bottom sheets are all the shared ReedSheet, never a hand-built Modal', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (path.endsWith('.tsx')) files.push(path);
    }
  };
  walk('components');
  // The image editor is a full-screen editor, not a sheet.
  const offenders = files.filter(file => !file.endsWith('reed-image-editor.tsx') && /<Modal[\s>]/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, [], 'Use ReedSheet (components/ui/reed-sheet.tsx) instead of a react-native Modal');
  // gorhom's input throws on web when it loses focus; ReedSheetTextInput picks the right one per platform.
  const rawInputs = files.filter(file => !file.endsWith('reed-sheet-input.tsx') && readFileSync(file, 'utf8').includes('BottomSheetTextInput'));
  assert.deepEqual(rawInputs, [], 'Use ReedSheetTextInput (components/ui/reed-sheet-input.tsx) inside sheets');
});
