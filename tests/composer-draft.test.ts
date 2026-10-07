import assert from 'node:assert/strict';
import test from 'node:test';
import { createComposerDraft } from '../lib/composer-draft';

test('two mounted editors observe each other and a reopening editor reads the latest draft', () => {
  const draft = createComposerDraft();
  let home = draft.getSnapshot();
  let sheet = draft.getSnapshot();
  draft.subscribe(() => {
    home = draft.getSnapshot();
  });
  const closeSheet = draft.subscribe(() => {
    sheet = draft.getSnapshot();
  });
  draft.replace('A', 'typed');
  draft.replace('B', 'voice');
  assert.equal(home.text, 'B');
  assert.equal(sheet.source, 'voice');
  closeSheet();
  draft.replace('C', 'typed');
  assert.equal(draft.getSnapshot().text, 'C');
  draft.replace('', 'typed');
  assert.equal(home.text, '');
});
