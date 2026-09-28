/* Reine Hilfsfunktionen: Antworten prüfen und erkannten Text in Vokabelpaare zerlegen.
   Läuft im Browser (globale Funktionen) und in Node (für die Tests). */
'use strict';

const ARTICLES = /^(the|a|an|der|die|das|den|dem|des|ein|eine|einen)\s+/;

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[’‘`´]/g, "'")
    .replace(/[.!?¡¿,;:"„“”«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Alle akzeptierten Schreibweisen einer Lösung, z. B. "(to) go, walk" -> ["to go", "go", "walk", ...]
function acceptedForms(target) {
  const raw = String(target || '');
  const pieces = [raw, ...raw.split(/[,;/|]/)];
  const forms = new Set();
  for (const p of pieces) {
    const withParens = normalize(p.replace(/[()[\]]/g, ''));
    const withoutParens = normalize(p.replace(/\(.*?\)|\[.*?\]/g, ' '));
    for (const f of [withParens, withoutParens]) {
      if (!f) continue;
      forms.add(f);
      forms.add(f.replace(/^to /, ''));
      forms.add(f.replace(ARTICLES, ''));
    }
  }
  forms.delete('');
  return [...forms];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// Ergebnis: 'correct' | 'typo' | 'wrong'
function checkAnswer(input, target) {
  const given = normalize(input);
  if (!given) return 'wrong';
  const candidates = new Set([given, given.replace(/^to /, ''), given.replace(ARTICLES, '')]);
  const forms = acceptedForms(target);
  for (const c of candidates) if (forms.includes(c)) return 'correct';
  for (const c of candidates) {
    for (const f of forms) {
      if (f.length >= 5 && levenshtein(c, f) <= 1) return 'typo';
      if (f.length >= 10 && levenshtein(c, f) <= 2) return 'typo';
    }
  }
  return 'wrong';
}

// Trenner zwischen Englisch und Deutsch, in dieser Reihenfolge ausprobiert.
const SEPARATORS = [/\t+/, /\s+[–—-]+\s+/, /\s*=+\s*/, /\s*;\s*/, /\s+:\s+|:\s+/, /\s{2,}/];

function cleanOcr(s) {
  return s.replace(/^[\s•·*▪►>|_]+/, '').replace(/[\s|_]+$/, '').replace(/\s+/g, ' ').trim();
}

// Zerlegt eine Zeile in {en, de}. Ohne erkennbaren Trenner landet alles in "en".
function splitLine(line) {
  // Lautschrift in eckigen Klammern wird zum Spaltentrenner.
  const text = line.replace(/ /g, ' ').replace(/\s*\[[^\]]*\]\s*/g, '   ').trim();
  for (const sep of SEPARATORS) {
    const parts = text.split(sep).map(cleanOcr).filter(Boolean);
    if (parts.length >= 2) {
      // Bei drei Spalten (Wort | Beispielsatz | Übersetzung) die erste und letzte nehmen.
      return { en: parts[0], de: parts[parts.length - 1] };
    }
  }
  return { en: cleanOcr(text), de: '' };
}

function parseVocabText(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.replace(/[^\p{L}]/gu, '').length >= 2)
    .map(splitLine)
    .filter(p => p.en || p.de);
}

if (typeof module !== 'undefined') {
  module.exports = { normalize, acceptedForms, levenshtein, checkAnswer, splitLine, parseVocabText };
}
