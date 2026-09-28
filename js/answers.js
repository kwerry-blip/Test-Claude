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
      const en = cleanEnglish(parts[0]) || parts[0];
      // Bei drei Spalten ist eine davon ein englischer Beispielsatz – der enthält meist das Wort selbst.
      const head = normalize(en).replace(/^\(?to\)? /, '').split(' ')[0];
      const de = parts.slice(1).find(p => !normalize(p).includes(head)) || parts[1];
      return { en, de };
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

/* ---------- Layout-Erkennung für Schulbuch-Vokabelseiten ----------
   Beispiel Lighthouse (Cornelsen): | people ['pi:pl] | Leute, Menschen | The people in Plymouth are nice. |
   Aus den Positionen der erkannten Wörter werden Zeilen und Spalten rekonstruiert. */

const IPA_CHARS = /[ˈˌːʌəɪʊæɒɔθðŋʃʒɜɑ\]]/;

// Gehört ein Wort zur Lautschrift (oder ist es OCR-Müll davon)?
function isPhonetic(token) {
  if (/^\([a-z]+\)[.,]?$/i.test(token)) return false; // "(to)", "(the)" sind echte Wörter
  if (/^[[(|/{‘'’`´"“]/.test(token)) return true;
  if (/^[LlI1|][’'‘]/.test(token)) return true; // "[’" wird oft als "L’" gelesen
  return IPA_CHARS.test(token);
}

function cleanEnglish(text) {
  const tokens = String(text).replace(/^p\.?\s?\d+\s+/i, '').split(/\s+/).filter(Boolean);
  const out = [];
  for (const t of tokens) {
    if (isPhonetic(t)) break; // ab der Lautschrift ist der Rest egal
    out.push(t);
  }
  return cleanOcr(out.join(' ')).replace(/[,;:]+$/, '');
}

const letterCount = s => (String(s).match(/\p{L}/gu) || []).length;
const looksLikeText = s => letterCount(s) >= 2 && letterCount(s) / String(s).replace(/\s/g, '').length >= 0.6;
const median = arr => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
};

// Robuste Gerade x = a + b·y durch Punkte (Theil-Sen): verkraftet Ausreißer und schräge Spalten (Perspektive).
function fitColumn(points) {
  const slopes = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dy = points[j].y - points[i].y;
      if (Math.abs(dy) > 1e-6) slopes.push((points[j].x - points[i].x) / dy);
    }
  }
  const b = median(slopes);
  const a = median(points.map(p => p.x - b * p.y));
  return y => a + b * y;
}

/* lines: Zeilen aus der Texterkennung, [{words: [{text, conf, x0, y0, x1, y1}], baseline: {x0, y0, x1, y1}}]
   Ergebnis: [{en, de}] oder [] wenn kein Spaltenlayout erkennbar ist. */
function parseOcrLines(lines) {
  const keep = w => w.text && w.text.trim() && w.conf >= 20 && !/^p\.?\d*$/i.test(w.text);
  const all = lines.flatMap(l => l.words.filter(keep));
  if (all.length < 4) return [];
  const minX = Math.min(...all.map(w => w.x0));
  const pageW = Math.max(...all.map(w => w.x1)) - minX;

  // Schräglage aus den Grundlinien langer Zeilen schätzen und herausrechnen
  const angle = median(lines
    .map(l => l.baseline)
    .filter(b => b && b.x1 - b.x0 > pageW * 0.3)
    .map(b => Math.atan2(b.y1 - b.y0, b.x1 - b.x0)));
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const rotate = w => {
    const cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2;
    const rx = cx * cos + cy * sin, hw = (w.x1 - w.x0) / 2;
    return { ...w, rx0: rx - hw, rx1: rx + hw, ry: -cx * sin + cy * cos, h: w.y1 - w.y0 };
  };
  const h = median(all.filter(w => letterCount(w.text) >= 2).map(w => w.y1 - w.y0)) || 20;

  // Zeilen der Texterkennung übernehmen; nebeneinanderliegende Teilzeilen (andere Spalte) zusammenführen
  let rows = lines
    .map(l => l.words.filter(keep).map(rotate))
    .filter(ws => ws.length)
    .map(ws => ({ words: ws, y: median(ws.map(w => w.ry)), x0: Math.min(...ws.map(w => w.rx0)), x1: Math.max(...ws.map(w => w.rx1)) }))
    .sort((a, b) => a.y - b.y);
  const merged = [];
  for (const row of rows) {
    const partner = merged.find(m => Math.abs(m.y - row.y) < h * 0.7 && (row.x0 > m.x1 || row.x1 < m.x0));
    if (partner) {
      partner.words.push(...row.words);
      partner.x0 = Math.min(partner.x0, row.x0);
      partner.x1 = Math.max(partner.x1, row.x1);
    } else {
      merged.push(row);
    }
  }
  rows = merged.sort((a, b) => a.y - b.y);

  // Zeilen an großen Lücken in Abschnitte (Spalten) teilen
  for (const row of rows) {
    row.words.sort((a, b) => a.rx0 - b.rx0);
    row.segs = [];
    for (const w of row.words) {
      const seg = row.segs[row.segs.length - 1];
      if (seg && w.rx0 - seg.x1 < h * 1.3) {
        seg.words.push(w);
        seg.x1 = w.rx1;
      } else {
        row.segs.push({ x0: w.rx0, x1: w.rx1, words: [w] });
      }
    }
    for (const seg of row.segs) {
      seg.text = seg.words.map(w => w.text).join(' ');
      seg.conf = seg.words.reduce((s, w) => s + w.conf, 0) / seg.words.length;
      seg.phonetic = seg.words.some(w => isPhonetic(w.text));
    }
  }

  // Spalten finden: In Zeilen mit mindestens zwei Abschnitten ist der erste Englisch, der zweite Deutsch.
  // Daraus je eine (evtl. schräge) Spaltenlinie schätzen.
  const textSegs = r => r.segs.filter(s => looksLikeText(s.text));
  const multi = rows.map(r => ({ y: r.y, segs: textSegs(r) })).filter(r => r.segs.length >= 2);
  if (multi.length < 3) return [];
  const enX = fitColumn(multi.map(r => ({ y: r.y, x: r.segs[0].x0 })));
  // Abstand Englisch -> Deutsch: der häufigste Abstand des zweiten Abschnitts (Beispielsätze liegen weiter rechts)
  const offsets = multi.map(r => r.segs[1].x0 - enX(r.y)).filter(d => d > h * 2).sort((x, y) => x - y);
  if (offsets.length < 3) return [];
  const win = Math.max(h * 2, pageW * 0.04);
  let bestLo = 0, bestN = 0;
  for (let i = 0, j = 0; i < offsets.length; i++) {
    while (offsets[j] < offsets[i] - win) j++;
    if (i - j + 1 > bestN) { bestN = i - j + 1; bestLo = j; }
  }
  const deOffset = median(offsets.slice(bestLo, bestLo + bestN));
  // 0 = Englisch, 1 = Deutsch, 2 = weiter rechts (Beispielsätze, Hinweise)
  const colOf = (seg, y) => {
    const d = seg.x0 - enX(y);
    if (d < deOffset * 0.5) return 0;
    return d < deOffset * 1.5 ? 1 : 2;
  };
  const enCol = 0, deCol = 1;

  const entries = [];
  let last = null;
  let pending = null; // Übersetzung ohne englisches Wort in derselben Zeile
  const flushPending = () => {
    if (pending && last && pending.y - last.y < h * 2.6) last.de = last.de ? `${last.de} ${pending.de}` : pending.de;
    pending = null;
  };
  for (const row of rows) {
    const segs = { en: [], de: [] };
    for (const s of row.segs) {
      const c = colOf(s, row.y);
      if (c === enCol) segs.en.push(s);
      else if (c === deCol) segs.de.push(s);
    }
    const enSeg = segs.en.find(s => looksLikeText(cleanEnglish(s.text)) && s.conf >= 50);
    const deText = cleanOcr(segs.de.filter(s => looksLikeText(s.text) && s.conf >= 45).map(s => s.text).join(' '));
    if (enSeg) {
      const en = cleanEnglish(enSeg.text);
      // Überschriften ohne Lautschrift und ohne Übersetzung weglassen (z. B. "Focus on language")
      if (!deText && !enSeg.phonetic && en.split(' ').length > 2) {
        flushPending();
        last = null;
        continue;
      }
      let de = deText;
      // Wegen schräger/gewölbter Seiten steht die Übersetzung manchmal knapp über dem Wort
      if (!de && pending && row.y - pending.y < h * 1.6) {
        de = pending.de;
        pending = null;
      }
      flushPending();
      last = { en, de, y: row.y };
      entries.push(last);
    } else if (deText) {
      if (last && !last.de && row.y - last.y < h * 1.6) {
        last.de = deText;
      } else {
        flushPending();
        pending = { de: deText, y: row.y };
      }
    }
  }
  flushPending();
  return entries.map(({ en, de }) => ({ en, de: de.replace(/^[^\p{L}(]+/u, '') }));
}

if (typeof module !== 'undefined') {
  module.exports = {
    normalize, acceptedForms, levenshtein, checkAnswer, splitLine, parseVocabText,
    isPhonetic, cleanEnglish, parseOcrLines,
  };
}
