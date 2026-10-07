import assert from 'node:assert/strict';
import test from 'node:test';
import { splitCoachNote } from '../components/reed/today/today-content';

test('a coach note leads with a short first sentence', () => {
  assert.deepEqual(splitCoachNote('Bench is moving again. 62.5 for all eight, and the last rep was clean.'), {
    body: '62.5 for all eight, and the last rep was clean.',
    headline: 'Bench is moving again.',
  });
  assert.deepEqual(splitCoachNote('Rest day.'), { body: '', headline: 'Rest day.' });
});

test('a coach note without a short first sentence is all body', () => {
  const long = `${'Word '.repeat(30)}ends here. Then more.`;
  assert.deepEqual(splitCoachNote(long), { body: long, headline: null });
  assert.deepEqual(splitCoachNote('no punctuation at all'), { body: 'no punctuation at all', headline: null });
  const atLimit = `${'x'.repeat(39)}.`;
  assert.deepEqual(splitCoachNote(`${atLimit} Next sentence.`), { body: 'Next sentence.', headline: atLimit });
  const overLimit = `${'x'.repeat(40)}. Next sentence.`;
  assert.deepEqual(splitCoachNote(overLimit), { body: overLimit, headline: null });
});


