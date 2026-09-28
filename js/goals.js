/* Ziele fürs ganze Schuljahr:
   - Schallplatten pro Unit (Bronze → Silber → Gold → Platin)
   - Erfolgs-Serien mit vielen Stufen (Lernserie, Wörter, fehlerfreie Tracks …)
   - Spezial-Erfolge (Frühaufsteher, Comeback …)
   - Wöchentlich wechselnde Challenge */
'use strict';

const PLATE_MIN_WORDS = 5;
const PLATES = [
  { id: 'bronze', icon: '🥉', name: 'Bronze', desc: 'jedes Wort einmal richtig', minBox: 1 },
  { id: 'silver', icon: '🥈', name: 'Silber', desc: 'alle Wörter mindestens Stufe 2', minBox: 2 },
  { id: 'gold', icon: '🥇', name: 'Gold', desc: 'alle Wörter sicher (Stufe 4)', minBox: 4 },
  { id: 'platin', icon: '💎', name: 'Platin', desc: 'alle Wörter auf höchster Stufe', minBox: 6 },
];

const SERIES = [
  { id: 'streak', icon: '🔥', name: 'Lernserie', unit: 'Tage in Folge', tiers: [3, 7, 14, 30, 60, 100, 150, 200], value: s => s.stats.bestStreak || 0 },
  { id: 'tracks', icon: '🎵', name: 'Tracks gespielt', unit: 'Tracks', tiers: [1, 10, 25, 50, 100, 200, 365], value: s => s.stats.sessions || 0 },
  { id: 'words', icon: '📦', name: 'Plattensammlung', unit: 'Vokabeln', tiers: [25, 50, 100, 200, 300, 500, 750, 1000], value: s => s.words.length },
  { id: 'safe', icon: '🧠', name: 'Sicher gelernt', unit: 'sichere Wörter', tiers: [10, 25, 50, 100, 200, 300, 500, 750], value: s => s.words.filter(w => w.box >= SAFE_BOX).length },
  { id: 'perfect', icon: '💎', name: 'Fehlerfreie Mixe', unit: 'fehlerfreie Tracks', tiers: [1, 5, 10, 25, 50, 100], value: s => s.stats.perfect || 0 },
  { id: 'combo', icon: '⚡', name: 'Combo-König', unit: 'richtig in Folge', tiers: [6, 10, 15, 20, 30], value: s => s.stats.bestCombo || 0 },
  { id: 'goal', icon: '🎯', name: 'Tagesziel-Jäger', unit: 'Tage Tagesziel', tiers: [1, 10, 30, 60, 100, 150], value: s => s.stats.goalDays || 0 },
  { id: 'typed', icon: '⌨️', name: 'Tipp-Profi', unit: 'richtig getippt', tiers: [25, 100, 300, 600, 1000], value: s => s.stats.typed || 0 },
  { id: 'listen', icon: '👂', name: 'Gutes Gehör', unit: 'richtig gehört', tiers: [25, 100, 300, 600], value: s => s.stats.listened || 0 },
  { id: 'matches', icon: '🧩', name: 'Paare-Finder', unit: 'Paare-Runden', tiers: [10, 50, 100, 200], value: s => s.stats.matches || 0 },
  { id: 'fixed', icon: '🛟', name: 'Fehlerjäger', unit: 'Fehler ausgebügelt', tiers: [10, 50, 150, 300], value: s => s.stats.fixed || 0 },
  { id: 'scans', icon: '📷', name: 'Scanner', unit: 'Seiten erfasst', tiers: [1, 5, 15, 30], value: s => s.stats.scans || 0 },
  { id: 'weekly', icon: '🗓️', name: 'Wochen-Champion', unit: 'Wochen-Challenges', tiers: [1, 5, 10, 20, 30, 40], value: s => s.stats.weeklyDone || 0 },
  { id: 'plates', icon: '🥇', name: 'Goldene Schallplatten', unit: 'Units in Gold', tiers: [1, 3, 6, 10], value: () => countPlates('gold') },
];

// r = Ergebnis der letzten Lektion bzw. Erfassung (optional)
const SPECIALS = [
  { id: 'early', icon: '🌅', name: 'Frühaufsteher', desc: 'Vor 7:30 Uhr gelernt', check: (s, r) => r && r.minutes < 450 },
  { id: 'night', icon: '🦉', name: 'Nachteule', desc: 'Nach 20 Uhr gelernt', check: (s, r) => r && r.minutes >= 1200 },
  { id: 'weekend', icon: '🎪', name: 'Wochenend-Rave', desc: 'Samstag und Sonntag gelernt', check: (s, r) => r && r.weekend },
  { id: 'comeback', icon: '💪', name: 'Comeback', desc: 'Nach 3 Tagen Pause wieder eingestiegen', check: (s, r) => r && r.gapDays >= 3 },
  { id: 'allround', icon: '🎛️', name: 'Allrounder', desc: 'Alle Übungsarten in einem Track', check: (s, r) => r && r.families >= 4 },
  { id: 'double', icon: '✌️', name: 'Doppelschicht', desc: 'Tagesziel doppelt geschafft', check: s => dayXp() >= state.settings.dailyGoal * 2 },
  { id: 'marathon', icon: '🏃', name: 'Marathon', desc: '5 Tracks an einem Tag', check: s => s.stats.day === todayKey() && s.stats.dayTracks >= 5 },
  { id: 'bigscan', icon: '📚', name: 'Ganze Seite', desc: '20 Vokabeln auf einmal erfasst', check: (s, r) => r && r.scanned >= 20 },
];

const WEEKLY = [
  { id: 'days5', text: 'Lerne an 5 verschiedenen Tagen', goal: 5, value: w => w.days.length },
  { id: 'xp600', text: 'Sammle 600 XP', goal: 600, value: w => w.xp },
  { id: 'tracks8', text: 'Spiele 8 Tracks', goal: 8, value: w => w.tracks },
  { id: 'perfect3', text: 'Schaffe 3 fehlerfreie Tracks', goal: 3, value: w => w.perfect },
  { id: 'combo10', text: 'Schaffe eine 10er-Combo', goal: 10, value: w => w.bestCombo },
  { id: 'typed40', text: 'Tippe 40 Wörter richtig', goal: 40, value: w => w.typed },
  { id: 'goal4', text: 'Erreiche an 4 Tagen dein Tagesziel', goal: 4, value: w => w.goalDays },
  { id: 'new20', text: 'Lerne 20 neue Wörter', goal: 20, value: w => w.newWords },
];

// Frühere Trophäen-IDs auf die neuen Stufen übertragen
const OLD_BADGES = {
  first: 'tracks:1', perfect: 'perfect:1', drop: 'combo:6', combo15: 'combo:15', streak3: 'streak:3',
  streak7: 'streak:7', streak30: 'streak:30', scan: 'scans:1', words50: 'words:50', words200: 'words:200',
  safe25: 'safe:25', safe100: 'safe:100',
};

function migrateGoals() {
  for (const [oldId, newId] of Object.entries(OLD_BADGES)) {
    if (state.badges[oldId]) {
      state.badges[newId] = state.badges[newId] || state.badges[oldId];
      delete state.badges[oldId];
    }
  }
  state.stats.bestStreak = Math.max(state.stats.bestStreak || 0, state.stats.streak || 0);
}

/* ---------- Alle Erfolge als flache Liste ---------- */

const ACHIEVEMENTS = [
  ...SERIES.flatMap(se => se.tiers.map((tier, i) => ({
    id: `${se.id}:${tier}`, icon: se.icon, name: `${se.name} ${romanTier(i)}`,
    desc: `${tier} ${se.unit}`, check: s => se.value(s) >= tier,
  }))),
  ...SPECIALS,
];

function romanTier(i) {
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][i] || String(i + 1);
}

function achievementCount() {
  const units = unitList().filter(u => unitWords(u).length >= PLATE_MIN_WORDS).length;
  const plates = Object.values(state.unitPlates).reduce((n, p) => n + Object.keys(p).length, 0);
  return {
    done: Object.keys(state.badges).filter(id => ACHIEVEMENTS.some(a => a.id === id)).length + plates,
    total: ACHIEVEMENTS.length + units * PLATES.length,
  };
}

// Prüft alle Erfolge und gibt die neu freigeschalteten zurück.
function unlockBadges(result) {
  const fresh = ACHIEVEMENTS.filter(a => !state.badges[a.id] && a.check(state, result));
  fresh.forEach(a => { state.badges[a.id] = todayKey(); });
  if (fresh.length) save();
  return fresh;
}

/* ---------- Schallplatten pro Unit ---------- */

const unitWords = unit => state.words.filter(w => w.unit === unit);

function plateStatus(words, plate) {
  const ok = words.filter(w => w.box >= plate.minBox).length;
  return { ok, total: words.length, reached: words.length >= PLATE_MIN_WORDS && ok === words.length };
}

function countPlates(plateId) {
  return Object.values(state.unitPlates || {}).filter(p => p[plateId]).length;
}

// Neue Schallplatten vergeben; Rückgabe: [{unit, plate}]
function checkUnitPlates() {
  const fresh = [];
  for (const unit of unitList()) {
    const words = unitWords(unit);
    const have = state.unitPlates[unit] = state.unitPlates[unit] || {};
    for (const plate of PLATES) {
      if (!have[plate.id] && plateStatus(words, plate).reached) {
        have[plate.id] = todayKey();
        fresh.push({ unit, plate });
      }
    }
  }
  if (fresh.length) save();
  return fresh;
}

function nextPlate(unit) {
  const have = state.unitPlates[unit] || {};
  return PLATES.find(p => !have[p.id]) || null;
}

function platesHtml(unit, withLabels = false) {
  const have = state.unitPlates[unit] || {};
  return `<span class="plates">${PLATES.map(p => `
    <span class="plate ${have[p.id] ? 'got' : ''}" title="${p.name}: ${p.desc}">${p.icon}${withLabels ? `<small>${p.name}</small>` : ''}</span>`).join('')}</span>`;
}

/* ---------- Wochen-Challenge ---------- */

function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const num = Math.ceil(((t - yearStart) / DAY + 1) / 7);
  return { key: `${t.getUTCFullYear()}-W${num}`, num };
}

function currentWeek() {
  const { key, num } = isoWeek();
  if (!state.week || state.week.key !== key) {
    state.week = {
      key, challenge: WEEKLY[num % WEEKLY.length].id, done: false, days: [],
      xp: 0, tracks: 0, perfect: 0, bestCombo: 0, typed: 0, goalDays: 0, newWords: 0,
    };
  }
  return state.week;
}

function weeklyStatus() {
  const w = currentWeek();
  const c = WEEKLY.find(x => x.id === w.challenge) || WEEKLY[0];
  const daysLeft = 7 - ((new Date().getDay() + 6) % 7);
  return { c, w, value: Math.min(c.goal, c.value(w)), done: w.done, daysLeft };
}

// true, wenn die Challenge gerade eben geschafft wurde
function checkWeekly() {
  const st = weeklyStatus();
  if (st.done || st.value < st.c.goal) return false;
  st.w.done = true;
  state.stats.weeklyDone = (state.stats.weeklyDone || 0) + 1;
  save();
  return true;
}

function weeklyCardHtml() {
  const { c, value, done, daysLeft } = weeklyStatus();
  return `
    <div class="card weekly ${done ? 'done' : ''}">
      <div class="goal-head"><span>🗓️ Wochen-Challenge</span><span>${done ? '✅ geschafft' : `noch ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'}`}</span></div>
      <p class="weekly-text">${esc(c.text)}</p>
      <div class="progress"><div class="progress-fill ${done ? 'gold' : 'alt'}" style="width:${Math.round(value / c.goal * 100)}%"></div></div>
      <small class="muted">${value} / ${c.goal}</small>
    </div>`;
}

/* ---------- Ansicht „Erfolge“ ---------- */

function schoolYear() {
  const d = new Date();
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}/${String(y + 1).slice(2)}`;
}

function renderGoals() {
  const { done, total } = achievementCount();
  const units = unitList();
  view.innerHTML = `
    <h1>🏆 Erfolge</h1>
    <div class="card season">
      <div class="goal-head"><span>Schuljahr ${schoolYear()}</span><span>${done} / ${total} Ziele</span></div>
      <div class="progress"><div class="progress-fill gold" style="width:${Math.round(done / Math.max(1, total) * 100)}%"></div></div>
      <small class="muted">Jede Unit, jede Serie und jede Wochen-Challenge bringt dich weiter.</small>
    </div>
    ${weeklyCardHtml()}

    <h2 class="section-title">💿 Schallplatten pro Unit</h2>
    <p class="muted small">Bronze: jedes Wort einmal richtig · Silber: alle ab Stufe 2 · Gold: alle sicher · Platin: alle auf höchster Stufe</p>
    ${units.map(u => {
      const words = unitWords(u);
      const next = nextPlate(u);
      const st = next ? plateStatus(words, next) : null;
      return `
        <div class="card unit-goal">
          <div class="unit-goal-head"><b>${esc(u)}</b>${platesHtml(u)}</div>
          ${words.length < PLATE_MIN_WORDS ? `<small class="muted">Ab ${PLATE_MIN_WORDS} Wörtern gibt es Schallplatten.</small>`
            : next ? `
              <small class="muted">Nächste Platte ${next.icon} ${next.name}: ${st.ok} von ${st.total} Wörtern</small>
              <div class="progress small"><div class="progress-fill" style="width:${Math.round(st.ok / st.total * 100)}%"></div></div>`
            : '<small class="goal-done">💎 Platin! Diese Unit sitzt perfekt.</small>'}
        </div>`;
    }).join('') || '<p class="muted">Noch keine Units.</p>'}

    <h2 class="section-title">📈 Serien</h2>
    ${SERIES.map(se => {
      const v = se.value(state);
      const reached = se.tiers.filter(t => v >= t).length;
      const next = se.tiers[reached];
      const prev = se.tiers[reached - 1] || 0;
      return `
        <div class="card series">
          <div class="series-head">
            <span class="badge-icon">${se.icon}</span>
            <span class="series-info"><b>${se.name}</b><small>Stufe ${reached} von ${se.tiers.length}</small></span>
            <span class="series-val">${v}</span>
          </div>
          ${next ? `
            <div class="progress small"><div class="progress-fill" style="width:${Math.round((v - prev) / (next - prev) * 100)}%"></div></div>
            <small class="muted">Nächste Stufe: ${next} ${se.unit}</small>`
          : '<small class="goal-done">Alle Stufen geschafft! 👑</small>'}
          <div class="tiers">${se.tiers.map(t => `<span class="tier ${v >= t ? 'got' : ''}">${t}</span>`).join('')}</div>
        </div>`;
    }).join('')}

    <h2 class="section-title">⭐ Spezial</h2>
    <div class="badge-grid">
      ${SPECIALS.map(b => `
        <div class="badge-tile ${state.badges[b.id] ? 'got' : ''}">
          <span class="badge-icon">${state.badges[b.id] ? b.icon : '🔒'}</span>
          <b>${b.name}</b>
          <small>${b.desc}</small>
        </div>`).join('')}
    </div>`;
}
