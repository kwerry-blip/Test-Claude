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

test('Lautschrift wird aus dem englischen Wort entfernt', () => {
  const { cleanEnglish } = require('../js/answers.js');
  assert.equal(cleanEnglish("people ['pi:pl]"), 'people');
  assert.equal(cleanEnglish('people L’pipll'), 'people');
  assert.equal(cleanEnglish('but [bʌt], [bət]'), 'but');
  assert.equal(cleanEnglish('all (the) [ɔːl]'), 'all (the)');
  assert.equal(cleanEnglish('(to) start [stɑːt]'), '(to) start');
  assert.equal(cleanEnglish('p.22 city [ˈsɪti]'), 'city');
});

test('Lighthouse-Zeile mit Lautschrift und Beispielsatz', () => {
  assert.deepEqual(splitLine("people ['pi:pl]   Leute, Menschen   The people in Plymouth are nice."),
    { en: 'people', de: 'Leute, Menschen' });
});

// Hilfsfunktion: eine OCR-Zeile aus [text, x] Paaren bauen
function line(y, parts, { conf = 95, h = 20, tilt = 0 } = {}) {
  const words = [];
  for (const [text, x] of parts) {
    let cx = x;
    for (const t of text.split(' ')) {
      const w = t.length * 10;
      const dy = cx * tilt;
      words.push({ text: t, conf, x0: cx, y0: y + dy, x1: cx + w, y1: y + dy + h });
      cx += w + 6;
    }
  }
  return { words, baseline: { x0: words[0].x0, y0: words[0].y1, x1: words[words.length - 1].x1, y1: words[words.length - 1].y1 } };
}

test('Spaltenlayout: Lautschrift, Beispielsätze, zweizeilige Übersetzung, Überschrift', () => {
  const { parseOcrLines } = require('../js/answers.js');
  const lines = [
    line(0, [['Focus on language', 40]]),
    line(40, [["city ['sɪti]", 50], ['(Groß-)Stadt', 300], ['one city - two cities', 600]]),
    line(80, [['it starts', 50], ['er/sie/es beginnt;', 300]]),
    line(105, [['er/sie/es fängt an', 300]]),
    line(145, [['start [stɑːt]', 50], ['anfangen, beginnen', 300]]),
    line(185, [['with [wɪð]', 50], ['mit', 300]]),
    line(225, [["people ['pi:pl]", 50], ['Leute, Menschen', 300], ['The people in Plymouth are nice.', 600]]),
  ];
  assert.deepEqual(parseOcrLines(lines), [
    { en: 'city', de: '(Groß-)Stadt' },
    { en: 'it starts', de: 'er/sie/es beginnt; er/sie/es fängt an' },
    { en: 'start', de: 'anfangen, beginnen' },
    { en: 'with', de: 'mit' },
    { en: 'people', de: 'Leute, Menschen' },
  ]);
});

test('Spaltenlayout: schräg fotografierte Seite', () => {
  const { parseOcrLines } = require('../js/answers.js');
  const tilt = -0.03; // rechts ~20px höher als links
  const lines = [
    line(40, [['school [skuːl]', 50], ['Schule', 300], ['I like my school.', 600]], { tilt }),
    line(80, [['friend [frend]', 50], ['Freund', 300], ['He is my friend.', 600]], { tilt }),
    line(120, [['teacher', 50], ['Lehrer', 300], ['Our teacher is nice.', 600]], { tilt }),
  ];
  assert.deepEqual(parseOcrLines(lines), [
    { en: 'school', de: 'Schule' },
    { en: 'friend', de: 'Freund' },
    { en: 'teacher', de: 'Lehrer' },
  ]);
});

test('Echte OCR-Daten eines Handyfotos (Lighthouse 1, S. 186)', () => {
  const { parseOcrLines } = require('../js/answers.js');
  const pairs = parseOcrLines(require('./fixtures/lighthouse1-s186-ocr.json'));
  const has = (en, de) => pairs.some(p => p.en === en && p.de === de);
  assert.ok(has('but', 'aber'), JSON.stringify(pairs));
  assert.ok(has('all (the)', 'alle'));
  assert.ok(has('place', 'Ort, Platz, Stelle'));
  assert.ok(has('make', 'machen, herstellen'));
  assert.ok(has('for', 'für'));
  // Beispielsätze dürfen nirgends als Übersetzung landen
  assert.ok(!pairs.some(p => /Plymouth|friends|fourteen/.test(p.de)));
});

test('Echte OCR-Daten, in der App zugeschnitten (Lighthouse 1, S. 186)', () => {
  const { parseOcrLines } = require('../js/answers.js');
  const pairs = parseOcrLines(require('./fixtures/lighthouse1-s186-zugeschnitten-ocr.json'));
  const has = (en, de) => pairs.some(p => p.en === en && p.de === de);
  for (const [en, de] of [
    ['start', 'anfangen beginnen'], ['classroom', 'Klassenzimmer'], ['yes', 'ja'], ['but', 'aber'],
    ['all (the)', 'alle'], ['people', 'Leute, Menschen'], ['place', 'Ort, Platz, Stelle'], ['make', 'machen, herstellen'],
  ]) assert.ok(has(en, de), `${en} = ${de} fehlt in ${JSON.stringify(pairs)}`);
});
