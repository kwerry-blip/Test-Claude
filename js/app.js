/* Vokabeltrainer – die ganze App läuft im Browser, alle Daten bleiben auf dem Gerät (localStorage). */
'use strict';

const STORE_KEY = 'vokabeltrainer.v1';
const DRAFT_KEY = 'vokabeltrainer.draft';
const DAY = 86400000;
// Leitner-System: Stufe -> Tage bis zur nächsten Wiederholung
const INTERVAL_DAYS = [0, 1, 2, 4, 7, 14, 30];
const MAX_BOX = INTERVAL_DAYS.length - 1;
const SAFE_BOX = 4; // ab dieser Stufe gilt ein Wort als "sicher"
const SESSION_SIZE = 10;
const XP_CORRECT = 10;
const XP_PERFECT_BONUS = 20;
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

const DEFAULT_NAME = 'Felix';
// Auszug aus Lighthouse 1 (Cornelsen), Vocabulary Unit 1, S. 186
const SAMPLE_UNIT = 'Lighthouse 1 · Unit 1 (Auszug)';
const SAMPLE_WORDS = [
  ['maths', 'Mathematik'], ['history', 'Geschichte'], ['French', 'Französisch'], ['break', 'Pause'],
  ['lunch', 'Mittagessen'], ['drama', 'Schauspiel, darstellende Kunst'], ['every day', 'jeden Tag'],
  ['on Monday', 'am Montag'], ['right', 'richtig'], ['wrong', 'falsch'], ['city', '(Groß-)Stadt'],
  ['start', 'anfangen, beginnen'], ['with', 'mit'], ['classroom', 'Klassenzimmer'], ['yes', 'ja'],
  ['but', 'aber'], ['all (the)', 'alle'], ['people', 'Leute, Menschen'], ['place', 'Ort, Platz, Stelle'],
  ['make', 'machen, herstellen'], ['for', 'für'],
];

const PRAISE = ['Fett! 🔥', 'Banger! 💥', 'Voll im Takt! 🎶', 'Sauber! ✨', 'Stark! 💪', 'Nice! 😎', 'Läuft! 🚀'];
const WRONG_MSG = ['Knapp daneben! 🎧', 'Aus dem Takt 😅', 'Nicht ganz – weiter geht’s!'];
const DROP_MSG = ['DROP! 🔊', 'Bass rein! 🔊', 'Crowd geht ab! 🙌'];

// DJ-Ränge nach gesammelten XP
const RANKS = [
  { xp: 0, name: 'Bedroom-DJ', icon: '🎧' },
  { xp: 100, name: 'Party-DJ', icon: '🪩' },
  { xp: 300, name: 'Warm-up-DJ', icon: '🎚️' },
  { xp: 700, name: 'Resident-DJ', icon: '🎛️' },
  { xp: 1500, name: 'Club-Headliner', icon: '💿' },
  { xp: 3000, name: 'Festival-Headliner', icon: '🎪' },
  { xp: 6000, name: 'DJ-Legende', icon: '👑' },
];

// Trophäen: check bekommt den Zustand und (falls vorhanden) das Ergebnis der letzten Lektion
const BADGES = [
  { id: 'first', icon: '🎵', name: 'Erster Track', desc: 'Die erste Lektion geschafft', check: s => s.stats.sessions >= 1 },
  { id: 'perfect', icon: '💎', name: 'Fehlerfreier Mix', desc: 'Eine Lektion ohne Fehler', check: (s, r) => r && r.perfect },
  { id: 'drop', icon: '🔊', name: 'Drop-Master', desc: 'Den Drop erreicht (6 richtig in Folge)', check: (s, r) => r && r.maxCombo >= 6 },
  { id: 'combo15', icon: '⚡', name: 'Endlos-Groove', desc: '15 richtig in Folge', check: (s, r) => r && r.maxCombo >= 15 },
  { id: 'streak3', icon: '🔥', name: '3-Tage-Groove', desc: '3 Tage in Folge gelernt', check: s => s.stats.streak >= 3 },
  { id: 'streak7', icon: '📅', name: 'Wochen-Rave', desc: '7 Tage in Folge gelernt', check: s => s.stats.streak >= 7 },
  { id: 'streak30', icon: '🏆', name: 'Monats-Marathon', desc: '30 Tage in Folge gelernt', check: s => s.stats.streak >= 30 },
  { id: 'scan', icon: '📷', name: 'Scanner', desc: 'Vokabeln per Foto erfasst', check: s => s.stats.scans >= 1 },
  { id: 'words50', icon: '📦', name: 'Crate Digger', desc: '50 Vokabeln gesammelt', check: s => s.words.length >= 50 },
  { id: 'words200', icon: '🗄️', name: 'Plattensammler', desc: '200 Vokabeln gesammelt', check: s => s.words.length >= 200 },
  { id: 'safe25', icon: '🧠', name: 'Gedächtnis-Booster', desc: '25 Wörter sicher gelernt', check: s => s.words.filter(w => w.box >= SAFE_BOX).length >= 25 },
  { id: 'safe100', icon: '🚀', name: 'Vokabel-Rakete', desc: '100 Wörter sicher gelernt', check: s => s.words.filter(w => w.box >= SAFE_BOX).length >= 100 },
];

/* ---------- Hilfsfunktionen ---------- */

const view = document.getElementById('view');
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- Daten ---------- */

function defaultState() {
  return {
    version: 1,
    words: [],
    stats: { xp: 0, streak: 0, lastDay: null, day: null, dayXp: 0, sessions: 0, bestCombo: 0, scans: 0 },
    settings: {
      name: DEFAULT_NAME, dailyGoal: 50, accent: 'en-GB', sounds: true, beat: true, beatVolume: 0.6, zemi: true,
      autoSpeak: true, hideInstallTip: false,
    },
    badges: {},
  };
}

function newWord(en, de, unit) {
  return {
    id: uid(), en: en.trim(), de: de.trim(), unit: (unit || '').trim() || 'Ohne Lektion',
    box: 0, due: 0, right: 0, wrong: 0, added: Date.now(),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const d = defaultState();
      return {
        ...d, ...s,
        stats: { ...d.stats, ...s.stats },
        settings: { ...d.settings, ...s.settings },
        badges: { ...s.badges },
        words: Array.isArray(s.words) ? s.words : [],
      };
    }
  } catch (e) {
    console.error(e);
  }
  const s = defaultState();
  s.words = SAMPLE_WORDS.map(([en, de]) => newWord(en, de, SAMPLE_UNIT));
  return s;
}

let state = load();

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('⚠️ Speichern fehlgeschlagen – ist der Speicher voll?');
  }
}

const wordById = id => state.words.find(w => w.id === id);
const isDue = w => w.box > 0 && w.due <= Date.now();

function unitList() {
  const units = [];
  for (const w of state.words) if (!units.includes(w.unit)) units.push(w.unit);
  return units;
}
function unitDatalist(id = 'unit-list') {
  return `<datalist id="${id}">${unitList().map(u => `<option value="${esc(u)}">`).join('')}</datalist>`;
}
function lastUnit() {
  const w = [...state.words].sort((a, b) => b.added - a.added)[0];
  return w ? w.unit : '';
}
function dayXp() {
  return state.stats.day === todayKey() ? state.stats.dayXp : 0;
}
function rankFor(xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  return { ...RANKS[i], index: i, next: RANKS[i + 1] || null };
}

// Prüft alle Trophäen und gibt die neu freigeschalteten zurück.
function unlockBadges(result) {
  const fresh = BADGES.filter(b => !state.badges[b.id] && b.check(state, result));
  fresh.forEach(b => { state.badges[b.id] = todayKey(); });
  if (fresh.length) save();
  return fresh;
}

function currentStreak() {
  const s = state.stats;
  return s.lastDay === todayKey() || s.lastDay === yesterdayKey() ? s.streak : 0;
}

/* ---------- Ton & Sprache ---------- */

let voices = [];
function loadVoices() {
  voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
}
if ('speechSynthesis' in window) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}
const canSpeak = () => 'speechSynthesis' in window;

function speak(text, slow = false) {
  if (!canSpeak() || !text) return;
  const clean = String(text)
    .replace(/[()[\]]/g, '')
    .replace(/\bsb\b/g, 'somebody')
    .replace(/\bsth\b/g, 'something');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  const lang = state.settings.accent;
  u.lang = lang;
  const norm = l => l.replace('_', '-');
  const voice = voices.find(v => norm(v.lang) === lang && v.localService) ||
    voices.find(v => norm(v.lang) === lang) ||
    voices.find(v => v.lang.startsWith('en'));
  if (voice) u.voice = voice;
  u.rate = slow ? 0.55 : 0.9;
  Beat.duck(true);
  u.onend = u.onerror = () => Beat.duck(false);
  speechSynthesis.speak(u);
}

function beep(ok) {
  if (!state.settings.sounds) return;
  try {
    if (ok) Beat.sfxCorrect();
    else Beat.sfxWrong();
  } catch (e) { /* kein Ton möglich */ }
}

/* ---------- Navigation ---------- */

let currentTab = 'home';
const VIEWS = { home: renderHome, words: renderWords, scan: renderScan, settings: renderSettings };

function show(tab) {
  if (lesson) return;
  currentTab = tab;
  document.body.classList.remove('in-lesson');
  stopBeat();
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  VIEWS[tab]();
  window.scrollTo(0, 0);
}

document.getElementById('tabbar').addEventListener('click', e => {
  const btn = e.target.closest('button[data-tab]');
  if (btn) show(btn.dataset.tab);
});

// Alle Klicks in der Ansicht laufen über data-action
const ACTIONS = {};
view.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || !view.contains(el)) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) {
    e.preventDefault();
    fn(el, e);
  }
});
ACTIONS.speak = el => speak(el.dataset.text);
ACTIONS['speak-slow'] = el => speak(el.dataset.text, true);
ACTIONS.goto = el => show(el.dataset.tab);

/* ---------- Startseite ---------- */

function unitStats(unit) {
  const ws = state.words.filter(w => w.unit === unit);
  const safe = ws.filter(w => w.box >= SAFE_BOX).length;
  const progress = ws.length ? ws.reduce((s, w) => s + w.box, 0) / (ws.length * MAX_BOX) : 0;
  return { count: ws.length, safe, due: ws.filter(isDue).length, fresh: ws.filter(w => w.box === 0).length, progress };
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h >= 18) return 'Na';
  return 'Yo';
}

function renderHome() {
  const s = state.stats;
  const goal = state.settings.dailyGoal;
  const today = dayXp();
  const due = state.words.filter(isDue).length;
  const fresh = state.words.filter(w => w.box === 0).length;
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const name = state.settings.name ? ` ${esc(state.settings.name)}` : '';
  const units = unitList();
  const rank = rankFor(s.xp);
  const rankPct = rank.next ? (s.xp - rank.xp) / (rank.next.xp - rank.xp) * 100 : 100;
  const badgeCount = Object.keys(state.badges).length;

  view.innerHTML = `
    <h1 class="hello">${greeting()}${name}! <span class="wave">🎧</span></h1>
    <div class="card rank-card">
      <div class="vinyl"><span>${rank.icon}</span></div>
      <div class="rank-info">
        <small>Dein DJ-Rang</small>
        <div class="rank-name">${rank.name}</div>
        <div class="progress small"><div class="progress-fill alt" style="width:${Math.min(100, rankPct)}%"></div></div>
        <small>${rank.next ? `Noch ${rank.next.xp - s.xp} XP bis <b>${rank.next.name}</b>` : 'Höchster Rang erreicht! 👑'}</small>
      </div>
    </div>
    <div class="stat-row">
      <div class="stat"><span class="stat-icon">🔥</span><b>${currentStreak()}</b><small>Tage</small></div>
      <div class="stat"><span class="stat-icon">⚡</span><b>${s.xp}</b><small>XP</small></div>
      <button class="stat" data-action="goto" data-tab="settings"><span class="stat-icon">🏆</span><b>${badgeCount}/${BADGES.length}</b><small>Trophäen</small></button>
    </div>
    <div class="card goal">
      <div class="goal-head"><span>🎯 Tagesziel</span><span>${Math.min(today, goal)} / ${goal} XP</span></div>
      <div class="progress"><div class="progress-fill ${today >= goal ? 'gold' : ''}" style="width:${Math.min(100, today / goal * 100)}%"></div></div>
      ${today >= goal ? '<p class="goal-done">Tagesziel geschafft! 🏆</p>' : ''}
    </div>
    ${state.words.length >= 4 ? `
      <button class="btn big start-btn" data-action="start" data-unit="">
        <span>▶ Track starten</span>
        <small>${due ? `${due} zum Wiederholen` : 'Nichts fällig'} · ${fresh} neu</small>
      </button>` : `
      <div class="card empty">
        <p>Du brauchst mindestens 4 Vokabeln zum Lernen.</p>
        <button class="btn" data-action="goto" data-tab="scan">📷 Vokabeln erfassen</button>
      </div>`}
    ${!standalone && !state.settings.hideInstallTip ? `
      <div class="card tip">
        <button class="icon-btn close" data-action="hide-tip" aria-label="Tipp ausblenden">✕</button>
        <b>📲 Als App installieren</b>
        <p>In Safari unten auf <b>Teilen</b> <span class="share-icon">⬆︎</span> tippen und <b>„Zum Home-Bildschirm“</b> wählen. Dann startet der Trainer wie eine richtige App – auch ohne Internet.</p>
      </div>` : ''}
    ${units.length ? `<h2 class="section-title">Deine Units</h2>` : ''}
    <div class="units">
      ${units.map(u => {
        const st = unitStats(u);
        return `
        <button class="card unit" data-action="start" data-unit="${esc(u)}">
          <div class="unit-disc">💿</div>
          <div class="unit-body">
            <div class="unit-name">${esc(u)}</div>
            <div class="unit-meta">${st.count} Wörter · ${st.safe} sicher${st.due ? ` · <span class="due">${st.due} fällig</span>` : ''}</div>
            <div class="progress small"><div class="progress-fill" style="width:${Math.round(st.progress * 100)}%"></div></div>
          </div>
        </button>`;
      }).join('')}
    </div>`;
}

ACTIONS['hide-tip'] = () => {
  state.settings.hideInstallTip = true;
  save();
  renderHome();
};
ACTIONS.start = el => startLesson(el.dataset.unit || null);

/* ---------- Lektion ---------- */

let lesson = null;

function pickWords(unit) {
  const now = Date.now();
  const pool = state.words.filter(w => !unit || w.unit === unit);
  const due = pool.filter(w => w.box > 0 && w.due <= now).sort((a, b) => a.box - b.box || a.due - b.due);
  const fresh = pool.filter(w => w.box === 0).sort((a, b) => (b.wrong > 0) - (a.wrong > 0) || a.added - b.added);
  const rest = pool.filter(w => w.box > 0 && w.due > now).sort((a, b) => a.box - b.box || a.due - b.due);
  const picked = [];
  const add = list => {
    for (const w of list) {
      if (picked.length >= SESSION_SIZE) return;
      if (!picked.includes(w)) picked.push(w);
    }
  };
  // Zuerst Fälliges, dann ein paar neue Wörter, danach auffüllen.
  add(due.slice(0, 6));
  add(fresh.slice(0, 5));
  add(due);
  add(fresh);
  add(rest);
  return shuffle(picked);
}

function chooseType(w) {
  const speech = canSpeak();
  if (w.box === 0) return 'mc_en_de';
  if (w.box === 1) return pick(speech ? ['mc_de_en', 'listen_mc'] : ['mc_de_en']);
  if (w.box === 2) return pick(speech ? ['type_de_en', 'mc_de_en', 'listen_mc'] : ['type_de_en', 'mc_de_en']);
  return pick(speech ? ['type_de_en', 'type_de_en', 'type_en_de', 'listen_type'] : ['type_de_en', 'type_en_de']);
}

function uniqueBy(words, key) {
  const seen = new Set();
  return words.filter(w => {
    const k = normalize(w[key]);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function startLesson(unit) {
  if (state.words.length < 4) {
    toast('Du brauchst mindestens 4 Vokabeln.');
    return;
  }
  const words = pickWords(unit);
  if (!words.length) return;
  const items = words.map(w => ({ type: chooseType(w), id: w.id }));
  const matchable = uniqueBy(uniqueBy(words, 'en'), 'de').slice(0, 5);
  if (matchable.length >= 4) {
    items.splice(Math.ceil(items.length / 2), 0, { type: 'match', ids: matchable.map(w => w.id) });
  }
  lesson = {
    unit, queue: items, total: items.length, done: 0, xp: 0, combo: 0,
    graded: new Set(), correctFirst: 0, missed: new Set(), current: null, locked: false, lastOk: true, maxCombo: 0,
  };
  document.body.classList.add('in-lesson');
  if (state.settings.beat) {
    try {
      Beat.setVolume(state.settings.beatVolume);
      Beat.setLevel(comboLevel());
      Beat.start();
      document.body.classList.add('beat-on');
    } catch (e) { /* ohne Beat weiter */ }
  }
  renderStep();
}

function lessonShell(inner, footer = '') {
  const pct = Math.round(lesson.done / lesson.total * 100);
  return `
    <div class="lesson">
      <header class="lesson-top">
        <button class="icon-btn" data-action="quit-lesson" aria-label="Lektion beenden">✕</button>
        <div class="progress"><div class="progress-fill" id="lesson-progress" style="width:${pct}%"></div></div>
        <div class="mixer" id="mixer" aria-label="Beat-Level">${mixerHtml()}</div>
      </header>
      <section class="exercise">${inner}</section>
      <footer class="lesson-foot" id="lesson-foot">${footer}</footer>
    </div>`;
}

// Der Beat wird mit jeder zweiten richtigen Antwort in Folge voller: Kick → Hats → Bass → Clap → Drop
function comboLevel() {
  return Math.min(Beat.MAX_LEVEL, 1 + Math.floor(lesson.combo / 2));
}

function mixerHtml() {
  const lvl = comboLevel();
  const bars = Array.from({ length: Beat.MAX_LEVEL + 1 }, (_, i) => `<i class="${i <= lvl ? 'on' : ''}"></i>`).join('');
  const label = lvl === Beat.MAX_LEVEL ? 'DROP' : lesson.combo >= 2 ? `🔥${lesson.combo}` : '';
  return `<span class="eq">${bars}</span><span class="combo ${lvl === Beat.MAX_LEVEL ? 'drop' : ''}">${label}</span>`;
}

function flash(text) {
  const el = document.createElement('div');
  el.className = 'flash';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

function comboUp() {
  const before = comboLevel();
  lesson.combo++;
  lesson.maxCombo = Math.max(lesson.maxCombo, lesson.combo);
  if (before < Beat.MAX_LEVEL && comboLevel() === Beat.MAX_LEVEL) {
    flash(pick(DROP_MSG));
    setTimeout(() => showZemi('DROP! 🔊', `${lesson ? lesson.combo : ''} richtig in Folge`), 700);
  } else if (lesson.combo >= 10 && lesson.combo % 5 === 0) {
    showZemi(`${lesson.combo}er COMBO`, pick(['Die Crowd tobt! 🙌', 'Unaufhaltsam! ⚡', 'Voll im Flow! 🌊']));
  }
}

function stopBeat() {
  Beat.stop();
  document.body.classList.remove('beat-on');
}

function renderStep() {
  if (!lesson.queue.length) return finishLesson();
  const item = lesson.queue[0];
  lesson.locked = false;
  if (item.type === 'match') return renderMatch(item);
  if (!wordById(item.id)) { // Wort wurde inzwischen gelöscht
    lesson.queue.shift();
    lesson.total--;
    return renderStep();
  }
  if (item.type.startsWith('mc') || item.type === 'listen_mc') renderChoice(item);
  else renderTyping(item);
  window.scrollTo(0, 0);
}

function distractorsFor(word, key, n) {
  const target = normalize(word[key]);
  const valid = w => w.id !== word.id && normalize(w[key]) !== target && w[key];
  const sameUnit = shuffle(state.words.filter(w => w.unit === word.unit && valid(w)));
  const others = shuffle(state.words.filter(w => w.unit !== word.unit && valid(w)));
  return uniqueBy([...sameUnit, ...others], key).slice(0, n);
}

function englishPrompt(w) {
  return `
    <div class="prompt-row">
      <button class="speaker" data-action="speak" data-text="${esc(w.en)}" aria-label="Anhören">🔊</button>
      <div class="prompt-word">${esc(w.en)}</div>
    </div>`;
}
function listenPrompt(w) {
  return `
    <div class="listen-row">
      <button class="speaker big" data-action="speak" data-text="${esc(w.en)}" aria-label="Anhören">🔊</button>
      <button class="speaker slow" data-action="speak-slow" data-text="${esc(w.en)}" aria-label="Langsam anhören">🐢</button>
    </div>`;
}

function renderChoice(item) {
  const w = wordById(item.id);
  const key = item.type === 'mc_en_de' ? 'de' : 'en';
  const options = shuffle([w, ...distractorsFor(w, key, 3)]);
  let title, prompt;
  if (item.type === 'mc_en_de') {
    title = w.box === 0 && !w.right && !w.wrong ? '<span class="badge">NEUES WORT</span> Was bedeutet das?' : 'Was bedeutet das?';
    prompt = englishPrompt(w);
  } else if (item.type === 'mc_de_en') {
    title = 'Wie heißt das auf Englisch?';
    prompt = `<div class="prompt-word">${esc(w.de)}</div>`;
  } else {
    title = 'Welches Wort hörst du?';
    prompt = listenPrompt(w);
  }
  lesson.current = { item, w, solution: w[key] };
  view.innerHTML = lessonShell(`
    <h2 class="ex-title">${title}</h2>
    ${prompt}
    <div class="options">
      ${options.map((o, i) => `<button class="option" data-action="mc-pick" data-id="${o.id}"><span class="opt-num">${i + 1}</span><span>${esc(o[key])}</span></button>`).join('')}
    </div>`, `<button class="btn big ghost" data-action="dont-know">Weiß ich nicht</button>`);
  if (item.type !== 'mc_de_en' && state.settings.autoSpeak) speak(w.en);
}

ACTIONS['mc-pick'] = el => {
  if (lesson.locked) return;
  const { w } = lesson.current;
  const ok = el.dataset.id === w.id;
  view.querySelectorAll('.option').forEach(b => { b.disabled = true; });
  el.classList.add(ok ? 'right' : 'wrong');
  if (!ok) view.querySelector(`.option[data-id="${w.id}"]`)?.classList.add('right');
  answer(ok ? 'correct' : 'wrong');
};

function renderTyping(item) {
  const w = wordById(item.id);
  let title, prompt, target, placeholder;
  if (item.type === 'type_en_de') {
    title = 'Übersetze ins Deutsche';
    prompt = englishPrompt(w);
    target = w.de;
    placeholder = 'Auf Deutsch …';
  } else if (item.type === 'listen_type') {
    title = 'Schreib auf, was du hörst';
    prompt = `${listenPrompt(w)}
      <button class="link" data-action="hint">Tipp: Was heißt es auf Deutsch?</button>
      <div class="hint-box" id="hint" hidden>${esc(w.de)}</div>`;
    target = w.en;
    placeholder = 'Auf Englisch …';
  } else {
    title = 'Übersetze ins Englische';
    prompt = `<div class="prompt-word">${esc(w.de)}</div>`;
    target = w.en;
    placeholder = 'Auf Englisch …';
  }
  lesson.current = { item, w, solution: target };
  view.innerHTML = lessonShell(`
    <h2 class="ex-title">${title}</h2>
    ${prompt}
    <form id="type-form" class="type-form">
      <input id="answer" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
             enterkeyhint="done" placeholder="${placeholder}" aria-label="Deine Antwort">
    </form>`, `
    <div class="foot-row">
      <button class="btn ghost" data-action="dont-know">Weiß ich nicht</button>
      <button class="btn big" data-action="check-type" id="check-btn" disabled>Prüfen</button>
    </div>`);
  const input = $('#answer');
  input.addEventListener('input', () => { $('#check-btn').disabled = !input.value.trim(); });
  $('#type-form').addEventListener('submit', e => {
    e.preventDefault();
    if (input.value.trim()) ACTIONS['check-type']();
  });
  input.focus();
  if (item.type === 'listen_type' && state.settings.autoSpeak) speak(w.en);
}

ACTIONS.hint = () => { const h = $('#hint'); if (h) h.hidden = false; };

ACTIONS['check-type'] = () => {
  if (lesson.locked) return;
  const input = $('#answer');
  const result = checkAnswer(input.value, lesson.current.solution);
  input.disabled = true;
  input.classList.add(result === 'wrong' ? 'wrong' : 'right');
  answer(result);
};

ACTIONS['dont-know'] = () => {
  if (lesson.locked) return;
  view.querySelectorAll('.option').forEach(b => {
    b.disabled = true;
    if (b.dataset.id === lesson.current.w.id) b.classList.add('right');
  });
  const input = $('#answer');
  if (input) input.disabled = true;
  answer('wrong');
};

function grade(w, ok) {
  if (lesson.graded.has(w.id)) return; // nur der erste Versuch zählt für die Stufe
  lesson.graded.add(w.id);
  if (ok) {
    lesson.correctFirst++;
    w.right++;
    w.box = Math.min(MAX_BOX, w.box + 1);
    w.due = startOfToday() + INTERVAL_DAYS[w.box] * DAY;
  } else {
    w.wrong++;
    w.box = Math.max(0, w.box - 2);
    w.due = 0;
  }
  save();
}

function answer(result) {
  lesson.locked = true;
  const { w, item, solution } = lesson.current;
  const ok = result !== 'wrong';
  grade(w, ok);
  lesson.lastOk = ok;
  beep(ok);
  if (ok) {
    comboUp();
    lesson.done++;
    lesson.xp += XP_CORRECT;
  } else {
    lesson.combo = 0;
    lesson.missed.add(w.id);
  }
  updateLessonTop();
  let body = '';
  if (result === 'typo') body = `<p>Achte auf die Schreibweise: <b>${esc(solution)}</b></p>`;
  else if (!ok) body = `<p>Richtige Antwort:</p><p class="solution">${esc(solution)}</p>`;
  else body = `<p class="pair">${esc(w.en)} = ${esc(w.de)}</p>`;
  $('#lesson-foot').innerHTML = `
    <div class="feedback ${ok ? 'good' : 'bad'}">
      <div class="fb-head">${ok ? (result === 'typo' ? 'Fast richtig! 👍' : pick(PRAISE)) : pick(WRONG_MSG)}</div>
      ${body}
      <button class="btn big ${ok ? '' : 'red'}" data-action="next">Weiter</button>
    </div>`;
  if (state.settings.autoSpeak && !['mc_en_de', 'listen_mc', 'listen_type'].includes(item.type)) speak(w.en);
}

function updateLessonTop() {
  const bar = $('#lesson-progress');
  if (bar) bar.style.width = `${Math.round(lesson.done / lesson.total * 100)}%`;
  const mixer = $('#mixer');
  if (mixer) mixer.innerHTML = mixerHtml();
  Beat.setLevel(comboLevel());
}

ACTIONS.next = () => {
  const item = lesson.queue.shift();
  if (!lesson.lastOk) lesson.queue.push(item); // falsche Wörter kommen am Ende nochmal
  renderStep();
};

ACTIONS['quit-lesson'] = () => {
  if (!confirm('Lektion wirklich beenden? Was du schon gelernt hast, bleibt gespeichert.')) return;
  lesson = null;
  stopBeat();
  if (canSpeak()) speechSynthesis.cancel();
  show('home');
};

/* Paare finden */

function renderMatch(item) {
  const ws = item.ids.map(wordById).filter(Boolean);
  if (ws.length < 3) {
    lesson.queue.shift();
    lesson.total--;
    return renderStep();
  }
  lesson.current = { item, match: { en: null, de: null, left: ws.length } };
  const tile = (w, side) => `<button class="tile" data-action="match-pick" data-side="${side}" data-id="${w.id}">${esc(w[side])}</button>`;
  view.innerHTML = lessonShell(`
    <h2 class="ex-title">Finde die Paare</h2>
    <div class="match-grid">
      <div class="match-col">${shuffle(ws).map(w => tile(w, 'en')).join('')}</div>
      <div class="match-col">${shuffle(ws).map(w => tile(w, 'de')).join('')}</div>
    </div>`);
}

ACTIONS['match-pick'] = el => {
  if (lesson.locked || el.classList.contains('done')) return;
  const m = lesson.current.match;
  const side = el.dataset.side;
  if (m[side] === el) {
    el.classList.remove('sel');
    m[side] = null;
    return;
  }
  m[side]?.classList.remove('sel');
  m[side] = el;
  el.classList.add('sel');
  if (side === 'en') speak(el.textContent);
  if (!m.en || !m.de) return;
  const a = wordById(m.en.dataset.id), b = wordById(m.de.dataset.id);
  const ok = a.id === b.id || normalize(a.de) === normalize(b.de);
  const pair = [m.en, m.de];
  m.en = m.de = null;
  pair.forEach(t => t.classList.remove('sel'));
  if (ok) {
    pair.forEach(t => { t.classList.add('done'); t.disabled = true; });
    m.left--;
    if (m.left === 0) {
      beep(true);
      lesson.locked = true;
      lesson.lastOk = true;
      comboUp();
      lesson.done++;
      lesson.xp += XP_CORRECT;
      updateLessonTop();
      $('#lesson-foot').innerHTML = `
        <div class="feedback good">
          <div class="fb-head">Alle Paare gefunden! 🧩</div>
          <button class="btn big" data-action="next">Weiter</button>
        </div>`;
    }
  } else {
    beep(false);
    pair.forEach(t => t.classList.add('shake'));
    setTimeout(() => pair.forEach(t => t.classList.remove('shake')), 450);
  }
};

function finishLesson() {
  stopBeat();
  const graded = lesson.graded.size;
  const accuracy = graded ? Math.round(lesson.correctFirst / graded * 100) : 100;
  const perfect = lesson.missed.size === 0;
  const xp = lesson.xp + (perfect ? XP_PERFECT_BONUS : 0);
  const s = state.stats;
  const today = todayKey();
  if (s.day !== today) { s.day = today; s.dayXp = 0; }
  const goal = state.settings.dailyGoal;
  const goalReachedNow = s.dayXp < goal && s.dayXp + xp >= goal;
  const rankBefore = rankFor(s.xp);
  s.dayXp += xp;
  s.xp += xp;
  s.sessions++;
  s.bestCombo = Math.max(s.bestCombo || 0, lesson.maxCombo);
  if (s.lastDay !== today) {
    s.streak = s.lastDay === yesterdayKey() ? s.streak + 1 : 1;
    s.lastDay = today;
  }
  save();
  const rankAfter = rankFor(s.xp);
  const newBadges = unlockBadges({ perfect, maxCombo: lesson.maxCombo });
  const missed = [...lesson.missed].map(wordById).filter(Boolean);
  const maxCombo = lesson.maxCombo;
  lesson = null;

  view.innerHTML = `
    <div class="result">
      <div class="result-emoji">${perfect ? '🏆' : accuracy >= 70 ? '🎧' : '💪'}</div>
      <h1>${perfect ? 'Fehlerfreier Mix!' : 'Track fertig!'}</h1>
      ${rankAfter.index > rankBefore.index ? `
        <div class="card levelup">
          <div class="levelup-icon">${rankAfter.icon}</div>
          <b>Level up!</b> Du bist jetzt <b>${rankAfter.name}</b>
        </div>` : ''}
      ${goalReachedNow ? '<p class="goal-done">🎯 Tagesziel erreicht!</p>' : ''}
      <div class="stat-row">
        <div class="stat xp"><small>XP</small><b>+${xp}</b></div>
        <div class="stat acc"><small>Treffer</small><b>${accuracy}%</b></div>
        <div class="stat combo-stat"><small>Combo</small><b>⚡ ${maxCombo}</b></div>
        <div class="stat streak"><small>Serie</small><b>🔥 ${s.streak}</b></div>
      </div>
      ${newBadges.map(b => `
        <div class="card badge-new">
          <span class="badge-icon">${b.icon}</span>
          <span><small>Neue Trophäe!</small><b>${b.name}</b><br><span class="muted">${b.desc}</span></span>
        </div>`).join('')}
      ${missed.length ? `
        <div class="card">
          <h2>Diese Wörter üben wir nochmal:</h2>
          <ul class="missed">${missed.map(w => `<li><b>${esc(w.en)}</b> – ${esc(w.de)}</li>`).join('')}</ul>
        </div>` : ''}
      <button class="btn big" data-action="finish">Weiter</button>
    </div>`;
  if (perfect || goalReachedNow || newBadges.length || rankAfter.index > rankBefore.index) confetti();
  setTimeout(() => {
    if (rankAfter.index > rankBefore.index) showZemi('LEVEL UP!', `${rankAfter.icon} ${rankAfter.name}`);
    else if (perfect) showZemi(`+${xp} XP`, '💎 Fehlerfrei!');
    else showZemi(`+${xp} XP`, `${accuracy} % Treffer`);
  }, 500);
}

ACTIONS.finish = () => show('home');

function confetti() {
  const colors = ['#ff2bd6', '#00e5ff', '#b6ff3b', '#ffd400', '#8b5cff'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = pick(colors);
    p.style.animationDelay = `${Math.random() * 0.6}s`;
    p.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3600);
}

/* ---------- Wörterliste ---------- */

let wordFilter = '';

function boxDots(w) {
  return `<span class="boxes" title="Stufe ${w.box} von ${MAX_BOX}">${Array.from({ length: MAX_BOX }, (_, i) => `<i class="${i < w.box ? 'on' : ''}"></i>`).join('')}</span>`;
}

function renderWords() {
  view.innerHTML = `
    <h1>Meine Wörter</h1>
    <details class="card add-card" ${state.words.length ? '' : 'open'}>
      <summary>➕ Vokabel von Hand eingeben</summary>
      <form id="add-form" class="stack">
        <label>Englisch<input name="en" required autocapitalize="off" autocorrect="off" spellcheck="false"></label>
        <label>Deutsch<input name="de" required></label>
        <label>Lektion<input name="unit" list="unit-list" value="${esc(lastUnit())}" placeholder="z. B. Unit 3"></label>
        <button class="btn">Hinzufügen</button>
      </form>
    </details>
    <input type="search" id="word-search" class="search" placeholder="🔎 Suchen …" value="${esc(wordFilter)}">
    <div id="word-list"></div>
    ${unitDatalist()}`;
  $('#add-form').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const w = newWord(f.en.value, f.de.value, f.unit.value);
    if (!w.en || !w.de) return;
    state.words.push(w);
    save();
    toast(`„${w.en}“ gespeichert`);
    f.en.value = '';
    f.de.value = '';
    f.en.focus();
    renderWordList();
  });
  $('#word-search').addEventListener('input', e => {
    wordFilter = e.target.value;
    renderWordList();
  });
  renderWordList();
}

function renderWordList() {
  const q = normalize(wordFilter);
  const match = w => !q || normalize(w.en).includes(q) || normalize(w.de).includes(q);
  const groups = unitList()
    .map(u => ({ unit: u, words: state.words.filter(w => w.unit === u && match(w)) }))
    .filter(g => g.words.length);
  $('#word-list').innerHTML = groups.length ? groups.map(g => `
    <section class="unit-group">
      <div class="unit-head">
        <h2>${esc(g.unit)} <small>${g.words.length}</small></h2>
        <button class="icon-btn" data-action="unit-rename" data-unit="${esc(g.unit)}" aria-label="Lektion umbenennen">✏️</button>
        <button class="icon-btn" data-action="unit-delete" data-unit="${esc(g.unit)}" aria-label="Lektion löschen">🗑️</button>
      </div>
      <ul class="word-list">
        ${g.words.map(w => `
          <li><button class="word-row" data-action="edit-word" data-id="${w.id}">
            <span class="w-text"><b>${esc(w.en)}</b><span>${esc(w.de)}</span></span>
            ${boxDots(w)}
          </button></li>`).join('')}
      </ul>
    </section>`).join('') : `<p class="muted center">${q ? 'Nichts gefunden.' : 'Noch keine Vokabeln.'}</p>`;
}

ACTIONS['unit-rename'] = el => {
  const old = el.dataset.unit;
  const name = prompt('Neuer Name für die Lektion:', old);
  if (!name || !name.trim() || name.trim() === old) return;
  state.words.forEach(w => { if (w.unit === old) w.unit = name.trim(); });
  save();
  renderWordList();
};

ACTIONS['unit-delete'] = el => {
  const unit = el.dataset.unit;
  const n = state.words.filter(w => w.unit === unit).length;
  if (!confirm(`Lektion „${unit}“ mit ${n} Wörtern löschen?`)) return;
  state.words = state.words.filter(w => w.unit !== unit);
  save();
  renderWordList();
};

ACTIONS['edit-word'] = el => openEditor(wordById(el.dataset.id));

function openEditor(w) {
  if (!w) return;
  let dlg = $('#dlg');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'dlg';
    document.body.appendChild(dlg);
  }
  dlg.innerHTML = `
    <form class="stack" id="edit-form">
      <h2>Vokabel bearbeiten</h2>
      <label>Englisch<input name="en" value="${esc(w.en)}" required autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <label>Deutsch<input name="de" value="${esc(w.de)}" required></label>
      <label>Lektion<input name="unit" value="${esc(w.unit)}" list="unit-list-dlg"></label>
      ${unitDatalist('unit-list-dlg')}
      <p class="muted">Stufe ${w.box} von ${MAX_BOX} · ✔︎ ${w.right}× richtig · ✘ ${w.wrong}× falsch</p>
      <div class="row">
        <button type="button" class="btn ghost" data-dlg="speak">🔊 Anhören</button>
        <button type="button" class="btn ghost" data-dlg="reset">Stufe auf 0</button>
      </div>
      <div class="row">
        <button type="button" class="btn red" data-dlg="delete">Löschen</button>
        <button type="button" class="btn ghost" data-dlg="cancel">Abbrechen</button>
        <button type="submit" class="btn">Speichern</button>
      </div>
    </form>`;
  const form = $('#edit-form', dlg);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const en = form.en.value.trim(), de = form.de.value.trim();
    if (!en || !de) return;
    Object.assign(w, { en, de, unit: form.unit.value.trim() || 'Ohne Lektion' });
    save();
    dlg.close();
    renderWordList();
  });
  form.addEventListener('click', e => {
    const b = e.target.closest('[data-dlg]');
    if (!b) return;
    const act = b.dataset.dlg;
    if (act === 'speak') speak(form.en.value);
    if (act === 'cancel') dlg.close();
    if (act === 'reset') {
      Object.assign(w, { box: 0, due: 0 });
      save();
      dlg.close();
      renderWordList();
    }
    if (act === 'delete' && confirm(`„${w.en}“ löschen?`)) {
      state.words = state.words.filter(x => x.id !== w.id);
      save();
      dlg.close();
      renderWordList();
    }
  });
  dlg.showModal();
}

/* ---------- Erfassen per Kamera ---------- */

function loadDraft() {
  try {
    return { en: '', de: '', unit: '', mode: 'both', ...JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') };
  } catch (e) {
    return { en: '', de: '', unit: '', mode: 'both' };
  }
}
let draft = loadDraft();
function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* egal */ }
}

function renderScan() {
  const modeBtn = (mode, label) => `<button type="button" data-action="scan-mode" data-mode="${mode}" class="${draft.mode === mode ? 'on' : ''}">${label}</button>`;
  view.innerHTML = `
    <h1>Vokabeln erfassen</h1>
    <p class="muted">Fotografiere die Vokabelliste aus dem Buch oder Heft. Die App liest den Text – du prüfst ihn und speicherst.</p>
    <div class="card stack">
      <label>Lektion<input id="scan-unit" list="unit-list" placeholder="z. B. Unit 3" value="${esc(draft.unit)}"></label>
      <div>
        <div class="label">Was ist auf dem Foto?</div>
        <div class="segmented">${modeBtn('both', 'Englisch + Deutsch')}${modeBtn('en', 'Nur Englisch')}${modeBtn('de', 'Nur Deutsch')}</div>
      </div>
      <label class="btn big file-btn">📷 Foto machen oder auswählen
        <input type="file" id="scan-file" accept="image/*" class="visually-hidden">
      </label>
      <div id="cropper"></div>
      <div id="ocr-status" class="ocr-status" hidden>
        <div class="progress"><div class="progress-fill" id="ocr-bar"></div></div>
        <span id="ocr-text"></span>
      </div>
      <p class="hint">💡 <b>Lighthouse-Tipp:</b> Buch flach hinlegen, gerade von oben und mit gutem Licht fotografieren. Danach den Rahmen um die Vokabeln ziehen. Lautschrift und Beispielsätze erkennt die App selbst und lässt sie weg.</p>
    </div>
    <div class="card stack">
      <label>Englisch <small class="muted">– eine Vokabel pro Zeile</small>
        <textarea id="scan-en" rows="7" autocapitalize="off" autocorrect="off" spellcheck="false">${esc(draft.en)}</textarea></label>
      <label>Deutsch <small class="muted">– gleiche Reihenfolge</small>
        <textarea id="scan-de" rows="7">${esc(draft.de)}</textarea></label>
      <p class="hint">Du kannst hier auch tippen oder einfügen. Auf dem iPhone geht auch: lange ins Feld tippen → <b>„Text scannen“</b>.</p>
      <div class="row">
        <button type="button" class="btn ghost" data-action="scan-swap">⇅ Spalten tauschen</button>
        <button type="button" class="btn ghost" data-action="scan-clear">Leeren</button>
      </div>
    </div>
    <div id="scan-preview"></div>
    ${unitDatalist()}`;

  $('#scan-unit').addEventListener('input', e => { draft.unit = e.target.value; saveDraft(); });
  for (const side of ['en', 'de']) {
    $(`#scan-${side}`).addEventListener('input', e => {
      draft[side] = e.target.value;
      saveDraft();
      renderScanPreview();
    });
  }
  $('#scan-file').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) openCropper(file);
  });
  renderScanPreview();
}

const draftLines = text => {
  const lines = text.split('\n').map(l => l.trim());
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines;
};

function scanPairs() {
  const en = draftLines(draft.en), de = draftLines(draft.de);
  const pairs = [];
  for (let i = 0; i < Math.max(en.length, de.length); i++) {
    if (en[i] || de[i]) pairs.push({ en: en[i] || '', de: de[i] || '', line: i });
  }
  return pairs;
}

function renderScanPreview() {
  const pairs = scanPairs();
  const complete = pairs.filter(p => p.en && p.de);
  const broken = pairs.length - complete.length;
  $('#scan-preview').innerHTML = pairs.length ? `
    <div class="card">
      <h2>Vorschau</h2>
      ${broken ? `<p class="warn">⚠️ ${broken} Zeile(n) ohne Übersetzung – bitte ergänzen oder löschen. Sie werden nicht gespeichert.</p>` : ''}
      <ol class="pairs">
        ${pairs.map(p => `
          <li class="${p.en && p.de ? '' : 'broken'}">
            <span class="pair-text"><b>${esc(p.en) || '—'}</b><span>${esc(p.de) || '—'}</span></span>
            <button type="button" class="icon-btn" data-action="scan-remove" data-line="${p.line}" aria-label="Zeile löschen">✕</button>
          </li>`).join('')}
      </ol>
      <button class="btn big" data-action="scan-save" ${complete.length ? '' : 'disabled'}>✅ ${complete.length} Vokabel${complete.length === 1 ? '' : 'n'} speichern</button>
    </div>` : '';
}

ACTIONS['scan-mode'] = el => {
  draft.mode = el.dataset.mode;
  saveDraft();
  view.querySelectorAll('[data-action="scan-mode"]').forEach(b => b.classList.toggle('on', b === el));
};

ACTIONS['scan-remove'] = el => {
  const i = Number(el.dataset.line);
  for (const side of ['en', 'de']) {
    const lines = draft[side].split('\n');
    if (i < lines.length) lines.splice(i, 1);
    draft[side] = lines.join('\n');
    $(`#scan-${side}`).value = draft[side];
  }
  saveDraft();
  renderScanPreview();
};

ACTIONS['scan-swap'] = () => {
  [draft.en, draft.de] = [draft.de, draft.en];
  saveDraft();
  $('#scan-en').value = draft.en;
  $('#scan-de').value = draft.de;
  renderScanPreview();
};

ACTIONS['scan-clear'] = () => {
  if ((draft.en || draft.de) && !confirm('Beide Felder leeren?')) return;
  draft.en = draft.de = '';
  saveDraft();
  $('#scan-en').value = '';
  $('#scan-de').value = '';
  renderScanPreview();
};

ACTIONS['scan-save'] = () => {
  const unit = draft.unit.trim() || `Lektion vom ${new Date().toLocaleDateString('de-DE')}`;
  const existing = new Set(state.words.filter(w => w.unit === unit).map(w => normalize(w.en) + '|' + normalize(w.de)));
  let added = 0, dupes = 0;
  for (const p of scanPairs()) {
    if (!p.en || !p.de) continue;
    const key = normalize(p.en) + '|' + normalize(p.de);
    if (existing.has(key)) { dupes++; continue; }
    existing.add(key);
    state.words.push(newWord(p.en, p.de, unit));
    added++;
  }
  if (added) state.stats.scans = (state.stats.scans || 0) + 1;
  save();
  const newBadges = unlockBadges();
  if (newBadges.length) setTimeout(() => toast(`🏆 Neue Trophäe: ${newBadges.map(b => b.name).join(', ')}`), 2800);
  const rest = scanPairs().filter(p => !p.en || !p.de);
  draft.en = rest.map(p => p.en).join('\n');
  draft.de = rest.map(p => p.de).join('\n');
  draft.unit = unit;
  saveDraft();
  toast(`✅ ${added} Vokabeln in „${unit}“ gespeichert${dupes ? ` (${dupes} doppelt übersprungen)` : ''}`);
  renderScan();
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Skript konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
}

let ocrWorkerPromise = null;
let ocrLogger = null;
function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      if (!window.Tesseract) await loadScript(TESSERACT_URL);
      const worker = await Tesseract.createWorker(['eng', 'deu'], 1, { logger: m => ocrLogger && ocrLogger(m) });
      await worker.setParameters({ preserve_interword_spaces: '1' });
      return worker;
    })().catch(e => {
      ocrWorkerPromise = null;
      throw e;
    });
  }
  return ocrWorkerPromise;
}

const OCR_STATUS = {
  'loading tesseract core': 'Texterkennung wird geladen …',
  'initializing tesseract': 'Texterkennung startet …',
  'loading language traineddata': 'Sprachdaten werden geladen …',
  'initializing api': 'Fast bereit …',
  'recognizing text': 'Text wird gelesen …',
};

function setOcrStatus(text, progress) {
  const box = $('#ocr-status');
  if (!box) return;
  box.hidden = false;
  $('#ocr-text').textContent = text;
  if (progress != null) $('#ocr-bar').style.width = `${Math.round(progress * 100)}%`;
}

/* Zuschneiden: Nach dem Foto zieht man einen Rahmen um die Vokabeln. */

let crop = null; // { img, rot, rect: {x, y, w, h} als Anteile 0..1 }

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img); // URL bleibt gültig, solange zugeschnitten wird
    img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
    img.src = url;
  });
}

// Bild gedreht und zugeschnitten in ein Canvas zeichnen; maxSide begrenzt die Größe (auch Vergrößern ist erlaubt).
function renderCrop(img, rot, rect, maxSide, maxUpscale) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const turned = rot % 180 !== 0;
  const fullW = turned ? ih : iw, fullH = turned ? iw : ih;
  const cw = fullW * rect.w, ch = fullH * rect.h;
  const scale = Math.min(maxUpscale, maxSide / Math.max(cw, ch));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cw * scale));
  canvas.height = Math.max(1, Math.round(ch * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);
  ctx.translate(-fullW * rect.x, -fullH * rect.y);
  ctx.translate(fullW / 2, fullH / 2);
  ctx.rotate(rot * Math.PI / 180);
  ctx.drawImage(img, -iw / 2, -ih / 2);
  return canvas;
}

// Graustufen mit mehr Kontrast – das hilft der Texterkennung.
function enhanceForOcr(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = g;
    hist[g]++;
  }
  // 1 % dunkelste/hellste Pixel abschneiden, den Rest auf 0..255 strecken
  const total = px.length / 4;
  let lo = 0, hi = 255, acc = 0;
  while (lo < 255 && (acc += hist[lo]) < total * 0.01) lo++;
  acc = 0;
  while (hi > 0 && (acc += hist[hi]) < total * 0.01) hi--;
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.max(0, Math.min(255, (px[i] - lo) * 255 / range));
    px[i] = px[i + 1] = px[i + 2] = g;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

async function openCropper(file) {
  try {
    const img = await loadImage(file);
    if (crop) URL.revokeObjectURL(crop.img.src);
    crop = { img, rot: 0, rect: { x: 0.04, y: 0.04, w: 0.92, h: 0.92 } };
    renderCropper();
  } catch (e) {
    setOcrStatus('❌ Das Bild konnte nicht geöffnet werden.', 0);
  }
}

function closeCropper() {
  if (crop) URL.revokeObjectURL(crop.img.src);
  crop = null;
  const box = $('#cropper');
  if (box) box.innerHTML = '';
  $('.file-btn')?.classList.remove('hidden');
}

function renderCropper() {
  const box = $('#cropper');
  if (!box || !crop) return;
  $('.file-btn')?.classList.add('hidden');
  box.innerHTML = `
    <div class="crop-stage" id="crop-stage">
      <canvas id="crop-canvas"></canvas>
      <div class="crop-box" id="crop-box" data-drag="move">
        ${['nw', 'ne', 'sw', 'se'].map(c => `<i class="crop-handle ${c}" data-drag="${c}"></i>`).join('')}
      </div>
    </div>
    <p class="hint">✂️ Zieh den Rahmen nur um die Vokabelspalten – ohne Bilder, ohne Beispielsätze, ohne die Nachbarseite.</p>
    <div class="row">
      <button type="button" class="btn ghost" data-action="crop-rotate">↻ Drehen</button>
      <button type="button" class="btn ghost" data-action="crop-cancel">Abbrechen</button>
    </div>
    <button type="button" class="btn big" data-action="crop-ocr">🔍 Text erkennen</button>`;
  // Vorschau in Bildschirmgröße zeichnen
  const preview = renderCrop(crop.img, crop.rot, { x: 0, y: 0, w: 1, h: 1 }, 1200, 1);
  const canvas = $('#crop-canvas');
  canvas.width = preview.width;
  canvas.height = preview.height;
  canvas.getContext('2d').drawImage(preview, 0, 0);
  placeCropBox();
  bindCropDrag();
}

function placeCropBox() {
  const r = crop.rect, el = $('#crop-box');
  Object.assign(el.style, { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });
}

function bindCropDrag() {
  const stage = $('#crop-stage');
  const MIN = 0.08;
  let drag = null;
  stage.addEventListener('pointerdown', e => {
    const mode = e.target.dataset.drag;
    if (!mode) return;
    e.preventDefault();
    stage.setPointerCapture(e.pointerId);
    drag = { mode, x: e.clientX, y: e.clientY, start: { ...crop.rect }, bounds: stage.getBoundingClientRect() };
  });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / drag.bounds.width, dy = (e.clientY - drag.y) / drag.bounds.height;
    const s = drag.start;
    let { x, y, w, h } = s;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (drag.mode === 'move') {
      x = clamp(s.x + dx, 0, 1 - s.w);
      y = clamp(s.y + dy, 0, 1 - s.h);
    } else {
      if (drag.mode.includes('w')) { x = clamp(s.x + dx, 0, s.x + s.w - MIN); w = s.x + s.w - x; }
      if (drag.mode.includes('e')) { w = clamp(s.w + dx, MIN, 1 - s.x); }
      if (drag.mode.includes('n')) { y = clamp(s.y + dy, 0, s.y + s.h - MIN); h = s.y + s.h - y; }
      if (drag.mode.includes('s')) { h = clamp(s.h + dy, MIN, 1 - s.y); }
    }
    crop.rect = { x, y, w, h };
    placeCropBox();
  });
  const end = () => { drag = null; };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
}

ACTIONS['crop-rotate'] = () => {
  crop.rot = (crop.rot + 90) % 360;
  crop.rect = { x: 0.04, y: 0.04, w: 0.92, h: 0.92 };
  renderCropper();
};
ACTIONS['crop-cancel'] = () => closeCropper();
ACTIONS['crop-ocr'] = () => {
  // Ausschnitt groß rechnen: kleine Schrift wird besser erkannt, wenn sie hochskaliert wird
  const canvas = enhanceForOcr(renderCrop(crop.img, crop.rot, crop.rect, 3000, 3));
  closeCropper();
  runOcr(canvas);
};

// Zeilen mit Wortpositionen aus dem Tesseract-Ergebnis holen
function ocrLines(data) {
  const lines = [];
  for (const block of data.blocks || []) {
    for (const par of block.paragraphs || []) {
      for (const line of par.lines || []) {
        lines.push({
          baseline: line.baseline,
          words: (line.words || []).map(w => ({ text: w.text, conf: w.confidence, ...w.bbox })),
        });
      }
    }
  }
  return lines;
}

async function runOcr(canvas) {
  setOcrStatus('Texterkennung startet …', 0);
  $('.file-btn')?.classList.add('busy');
  try {
    ocrLogger = m => {
      if (m.status) setOcrStatus(OCR_STATUS[m.status] || m.status, m.progress);
    };
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    applyOcrResult(data);
  } catch (e) {
    console.error(e);
    setOcrStatus('❌ Das hat nicht geklappt. Beim ersten Mal braucht die Texterkennung Internet, um die Sprachdaten zu laden.', 0);
  } finally {
    ocrLogger = null;
    $('.file-btn')?.classList.remove('busy');
  }
}

function applyOcrResult(data) {
  const mode = draft.mode;
  const text = data.text || '';
  let en = draftLines(draft.en), de = draftLines(draft.de);
  let count;
  if (mode === 'both') {
    // Erst das Spaltenlayout auswerten (Schulbuch), sonst Zeile für Zeile mit Trennzeichen
    let pairs = parseOcrLines(ocrLines(data));
    if (pairs.length < 2) pairs = parseVocabText(text).map(p => ({ en: cleanEnglish(p.en) || p.en, de: p.de }));
    // Beide Spalten auf gleiche Länge bringen, damit die neuen Zeilen zueinander passen.
    const len = Math.max(en.length, de.length);
    while (en.length < len) en.push('');
    while (de.length < len) de.push('');
    en = en.concat(pairs.map(p => p.en));
    de = de.concat(pairs.map(p => p.de));
    count = pairs.length;
  } else {
    let lines = parseVocabText(text).map(p => [p.en, p.de].filter(Boolean).join(' '));
    if (mode === 'en') lines = lines.map(cleanEnglish).filter(Boolean);
    if (mode === 'en') en = en.filter(Boolean).concat(lines);
    else de = de.filter(Boolean).concat(lines);
    count = lines.length;
  }
  draft.en = en.join('\n');
  draft.de = de.join('\n');
  saveDraft();
  if (!$('#scan-en')) return;
  $('#scan-en').value = draft.en;
  $('#scan-de').value = draft.de;
  renderScanPreview();
  setOcrStatus(count ? `✅ ${count} Vokabeln erkannt – bitte kurz prüfen und korrigieren.` : '🤔 Kein Text erkannt. Versuch es mit einem schärferen Foto.', 1);
}

/* ---------- Einstellungen ---------- */

function renderSettings() {
  const st = state.settings;
  const opt = (val, cur, label) => `<option value="${val}" ${String(val) === String(cur) ? 'selected' : ''}>${label}</option>`;
  const safe = state.words.filter(w => w.box >= SAFE_BOX).length;
  view.innerHTML = `
    <h1>Mehr</h1>
    <div class="card stack">
      <h2>Profil</h2>
      <label>Dein Name<input id="set-name" value="${esc(st.name)}" placeholder="optional"></label>
      <label>Tagesziel
        <select id="set-goal">${opt(20, st.dailyGoal, 'Locker – 20 XP')}${opt(50, st.dailyGoal, 'Normal – 50 XP')}${opt(100, st.dailyGoal, 'Ehrgeizig – 100 XP')}${opt(150, st.dailyGoal, 'Profi – 150 XP')}</select>
      </label>
      <label>Aussprache
        <select id="set-accent">${opt('en-GB', st.accent, '🇬🇧 Britisch')}${opt('en-US', st.accent, '🇺🇸 Amerikanisch')}</select>
      </label>
      <label class="switch"><input type="checkbox" id="set-beat" ${st.beat ? 'checked' : ''}> 🎧 Tech-House-Beat beim Lernen</label>
      <label>Beat-Lautstärke<input type="range" id="set-volume" min="0.1" max="1" step="0.1" value="${st.beatVolume}"></label>
      <label class="switch"><input type="checkbox" id="set-sounds" ${st.sounds ? 'checked' : ''}> Soundeffekte bei richtig/falsch</label>
      <label class="switch"><input type="checkbox" id="set-zemi" ${st.zemi ? 'checked' : ''}> 💃 Zemi mit der Punktetafel</label>
      <label class="switch"><input type="checkbox" id="set-speak" ${st.autoSpeak ? 'checked' : ''}> Englische Wörter automatisch vorlesen</label>
      <button class="btn ghost" data-action="test-voice">🔊 Stimme testen</button>
    </div>

    <div class="card">
      <h2>🏆 Trophäen <small class="muted">${Object.keys(state.badges).length} von ${BADGES.length}</small></h2>
      <div class="badge-grid">
        ${BADGES.map(b => `
          <div class="badge-tile ${state.badges[b.id] ? 'got' : ''}">
            <span class="badge-icon">${state.badges[b.id] ? b.icon : '🔒'}</span>
            <b>${b.name}</b>
            <small>${b.desc}</small>
          </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h2>Statistik</h2>
      <ul class="facts">
        <li><span>Vokabeln</span><b>${state.words.length}</b></li>
        <li><span>Davon sicher</span><b>${safe}</b></li>
        <li><span>Lektionen gelernt</span><b>${state.stats.sessions}</b></li>
        <li><span>XP gesamt</span><b>${state.stats.xp}</b></li>
        <li><span>DJ-Rang</span><b>${rankFor(state.stats.xp).icon} ${rankFor(state.stats.xp).name}</b></li>
        <li><span>Beste Combo</span><b>⚡ ${state.stats.bestCombo || 0}</b></li>
        <li><span>Serie</span><b>🔥 ${currentStreak()} Tage</b></li>
      </ul>
    </div>

    <div class="card stack">
      <h2>Sicherung</h2>
      <p class="muted">Alle Daten sind nur auf diesem Gerät gespeichert. Mach ab und zu eine Sicherung – damit kannst du die Vokabeln auch auf ein anderes Gerät übertragen.</p>
      <button class="btn" data-action="export">💾 Sicherung exportieren</button>
      <label class="btn ghost file-btn">📥 Sicherung / Liste importieren
        <input type="file" id="import-file" accept=".json,.txt,.csv,application/json,text/plain,text/csv" class="visually-hidden">
      </label>
      <p class="hint">Importieren geht mit einer Sicherung (.json) oder einer Textliste (.txt/.csv) mit einer Vokabel pro Zeile, z. B. <code>school = die Schule</code>.</p>
    </div>

    <div class="card stack">
      <h2>Zurücksetzen</h2>
      <button class="btn ghost" data-action="add-samples">Beispiel-Vokabeln hinzufügen</button>
      <button class="btn ghost" data-action="reset-progress">Lernfortschritt zurücksetzen</button>
      <button class="btn red" data-action="delete-all">Alles löschen</button>
    </div>
    <p class="muted center small">Vocab Beats 🎧 · alle Daten bleiben auf deinem Gerät</p>`;

  const bind = (id, fn) => $(id).addEventListener('change', e => { fn(e.target); save(); });
  bind('#set-name', el => { st.name = el.value.trim(); });
  bind('#set-goal', el => { st.dailyGoal = Number(el.value); });
  bind('#set-accent', el => { st.accent = el.value; speak('Hello! How are you?'); });
  bind('#set-sounds', el => { st.sounds = el.checked; if (el.checked) beep(true); });
  bind('#set-beat', el => { st.beat = el.checked; });
  bind('#set-zemi', el => { st.zemi = el.checked; if (el.checked) showZemi('Hi Felix!', 'Ich zeig dir deine Punkte'); });
  bind('#set-volume', el => { st.beatVolume = Number(el.value); Beat.setVolume(st.beatVolume); beep(true); });
  bind('#set-speak', el => { st.autoSpeak = el.checked; });
  $('#import-file').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) importFile(file);
  });
}

ACTIONS['test-voice'] = () => speak('Hello! This is your vocabulary trainer.');

ACTIONS.export = async () => {
  const data = JSON.stringify({ app: 'vokabeltrainer', exported: new Date().toISOString(), ...state }, null, 2);
  const name = `vokabeln-${todayKey()}.json`;
  const file = new File([data], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Vokabel-Sicherung' });
      return;
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};

async function importFile(file) {
  const text = await file.text();
  let data = null;
  try { data = JSON.parse(text); } catch (e) { /* keine JSON-Datei */ }

  if (data && Array.isArray(data.words)) {
    const replace = confirm(`Sicherung mit ${data.words.length} Vokabeln gefunden.\n\nOK = alles ersetzen (inkl. Fortschritt)\nAbbrechen = nur fehlende Vokabeln hinzufügen`);
    if (replace) {
      const d = defaultState();
      state = {
        ...d,
        words: data.words,
        stats: { ...d.stats, ...data.stats },
        settings: { ...d.settings, ...data.settings },
      };
      toast(`✅ ${data.words.length} Vokabeln wiederhergestellt`);
    } else {
      const have = new Set(state.words.map(w => `${w.unit}|${normalize(w.en)}|${normalize(w.de)}`));
      let n = 0;
      for (const w of data.words) {
        if (!w || !w.en || !w.de) continue;
        const key = `${w.unit}|${normalize(w.en)}|${normalize(w.de)}`;
        if (have.has(key)) continue;
        have.add(key);
        state.words.push({ ...newWord(w.en, w.de, w.unit), ...w, id: uid() });
        n++;
      }
      toast(`✅ ${n} neue Vokabeln hinzugefügt`);
    }
  } else {
    const unit = file.name.replace(/\.[^.]+$/, '') || 'Import';
    const pairs = parseVocabText(text).filter(p => p.en && p.de);
    if (!pairs.length) {
      toast('Keine Vokabeln in der Datei gefunden.');
      return;
    }
    pairs.forEach(p => state.words.push(newWord(p.en, p.de, unit)));
    toast(`✅ ${pairs.length} Vokabeln in „${unit}“ importiert`);
  }
  save();
  renderSettings();
}

ACTIONS['add-samples'] = () => {
  const have = new Set(state.words.filter(w => w.unit === SAMPLE_UNIT).map(w => w.en));
  const add = SAMPLE_WORDS.filter(([en]) => !have.has(en));
  add.forEach(([en, de]) => state.words.push(newWord(en, de, SAMPLE_UNIT)));
  save();
  toast(add.length ? `${add.length} Beispiel-Vokabeln hinzugefügt` : 'Beispiel-Vokabeln sind schon da');
  renderSettings();
};

ACTIONS['reset-progress'] = () => {
  if (!confirm('Lernfortschritt aller Wörter, XP und Serie zurücksetzen? Die Vokabeln bleiben erhalten.')) return;
  state.words.forEach(w => Object.assign(w, { box: 0, due: 0, right: 0, wrong: 0 }));
  state.stats = defaultState().stats;
  state.badges = {};
  save();
  renderSettings();
};

ACTIONS['delete-all'] = () => {
  if (!confirm('Wirklich ALLE Vokabeln und den Fortschritt löschen?')) return;
  if (!confirm('Sicher? Das kann nicht rückgängig gemacht werden.')) return;
  const settings = state.settings;
  state = defaultState();
  state.settings = settings;
  save();
  renderSettings();
};

/* ---------- Start ---------- */

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service Worker:', e));
}
// Bittet den Browser, die Daten nicht automatisch zu löschen.
navigator.storage?.persist?.().catch(() => {});

save();
show('home');
