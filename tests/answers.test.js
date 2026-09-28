// Ausführen mit: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const { checkAnswer, parseVocabText, splitLine } = require('../js/answers.js');

test('exakte und alternative Antworten', () => {
  assert.equal(checkAnswer('school', 'school'), 'correct');
  assert.equal(checkAnswer('  School ', 'school'), 'correct');
  assert.equal(checkAnswer('Lehrerin', 'der Lehrer, die Lehrerin'), 'correct');
  assert.equal(checkAnswer('der Lehrer', 'der Lehrer, die Lehrerin'), 'correct');
  assert.equal(checkAnswer('Ferien', 'die Ferien'), 'correct');
  assert.equal(checkAnswer('Wie spät ist es', 'Wie spät ist es?'), 'correct');
});

test('"(to)" und "to" bei Verben', () => {
  assert.equal(checkAnswer('learn', '(to) learn'), 'correct');
  assert.equal(checkAnswer('to learn', '(to) learn'), 'correct');
  assert.equal(checkAnswer('to play', 'play'), 'correct');
  assert.equal(checkAnswer('be hungry', '(to) be hungry'), 'correct');
});

test('Tippfehler werden erkannt, falsche Wörter nicht', () => {
  assert.equal(checkAnswer('beautifull', 'beautiful'), 'typo');
  assert.equal(checkAnswer('breakfest', 'breakfast'), 'typo');
  assert.equal(checkAnswer('cat', 'car'), 'wrong');
  assert.equal(checkAnswer('dog', 'school'), 'wrong');
  assert.equal(checkAnswer('', 'school'), 'wrong');
});

test('Zeilen mit Trennern', () => {
  assert.deepEqual(splitLine('school - die Schule'), { en: 'school', de: 'die Schule' });
  assert.deepEqual(splitLine('school = die Schule'), { en: 'school', de: 'die Schule' });
  assert.deepEqual(splitLine('school\tdie Schule'), { en: 'school', de: 'die Schule' });
  assert.deepEqual(splitLine('(to) go    gehen'), { en: '(to) go', de: 'gehen' });
  assert.deepEqual(splitLine('T-shirt - das T-Shirt'), { en: 'T-shirt', de: 'das T-Shirt' });
});

test('Schulbuch-Layout mit Lautschrift und Beispielsatz', () => {
  assert.deepEqual(splitLine('holiday [ˈhɒlədeɪ] Urlaub, Ferien'), { en: 'holiday', de: 'Urlaub, Ferien' });
  assert.deepEqual(splitLine('always    I always walk to school.    immer'), { en: 'always', de: 'immer' });
});

test('ganzer OCR-Text', () => {
  const text = 'Unit 3\n\nfriend   Freund\n• teacher - Lehrer\n|\n123\nbrother';
  assert.deepEqual(parseVocabText(text), [
    { en: 'Unit 3', de: '' },
    { en: 'friend', de: 'Freund' },
    { en: 'teacher', de: 'Lehrer' },
    { en: 'brother', de: '' },
  ]);
});
