/* Tech-House-Beat, live im Browser erzeugt (Web Audio, keine Audiodateien).
   Jede richtige Antwort in Folge schaltet eine weitere Spur frei – bis zum Drop. */
'use strict';

const Beat = (() => {
  const BPM = 124;
  const MAX_LEVEL = 4;
  // Rollende Bassline in A-Moll, 16 Schritte (0 = Pause)
  const BASS = [0, 0, 55, 0, 0, 0, 55, 65.4, 0, 0, 55, 0, 0, 0, 49, 55];
  const STAB = [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
  const CHORD = [220, 261.6, 329.6, 392]; // Am7

  let ctx, bus, filter, master, noise, timer;
  let step = 0, nextTime = 0, level = 1, running = false, volume = 0.6;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    bus = ctx.createGain();
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 18000;
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = volume;
    bus.connect(filter).connect(comp).connect(master).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function ensure() {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function env(gainNode, t, peak, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }

  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    env(g, t, 1, 0.35);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.4);
  }

  function noiseHit(t, type, freq, peak, decay) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    f.type = type;
    f.frequency.value = freq;
    env(g, t, peak, decay);
    s.connect(f).connect(g).connect(bus);
    s.start(t);
    s.stop(t + decay + 0.05);
  }

  function clap(t) {
    [0, 0.012, 0.024].forEach(dt => noiseHit(t + dt, 'bandpass', 1500, 0.5, 0.12));
  }

  function bass(t, freq) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    f.type = 'lowpass';
    f.Q.value = 8;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.18);
    env(g, t, 0.35, 0.2);
    o.connect(f).connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.25);
  }

  function chord(t, peak = 0.06, decay = 0.25, dest = bus) {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass';
    f.frequency.value = 2200;
    env(g, t, peak, decay);
    f.connect(g).connect(dest);
    for (const freq of CHORD) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = freq;
      o.connect(f);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
  }

  function playStep(s, t) {
    if (s % 4 === 0) kick(t);
    if (level >= 1 && s % 4 === 2) noiseHit(t, 'highpass', 7000, 0.25, 0.09);
    if (level >= 2 && BASS[s]) bass(t, BASS[s]);
    if (level >= 3) {
      if (s === 4 || s === 12) clap(t);
      if (s % 2 === 1) noiseHit(t, 'highpass', 9000, 0.08, 0.03);
    }
    if (level >= 4) {
      if (STAB[s]) chord(t);
      if (s % 4 === 1 || s % 4 === 3) noiseHit(t, 'bandpass', 5000, 0.07, 0.05);
    }
  }

  function scheduler() {
    const stepDur = 60 / BPM / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      playStep(step, nextTime);
      nextTime += stepDur;
      step = (step + 1) % 16;
    }
  }

  function start() {
    ensure();
    if (running) return;
    running = true;
    step = 0;
    nextTime = ctx.currentTime + 0.05;
    timer = setInterval(scheduler, 25);
  }

  function stop() {
    running = false;
    clearInterval(timer);
  }

  function setLevel(n) {
    const next = Math.max(0, Math.min(MAX_LEVEL, n));
    if (running && next === MAX_LEVEL && level < MAX_LEVEL) riser();
    level = next;
  }

  function setVolume(v) {
    volume = v;
    if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
  }

  // Leiser, während die Stimme ein Wort vorliest
  function duck(on) {
    if (!master) return;
    master.gain.setTargetAtTime(on ? volume * 0.2 : volume, ctx.currentTime, 0.08);
  }

  function riser() {
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    s.loop = true;
    f.type = 'bandpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(8000, t + 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
    s.connect(f).connect(g).connect(bus);
    s.start(t);
    s.stop(t + 1.05);
  }

  // Soundeffekte (funktionieren auch ohne laufenden Beat)
  function sfxCorrect() {
    ensure();
    const t = ctx.currentTime;
    chord(t, 0.09, 0.3, master);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.18);
    env(g, t + 0.08, 0.15, 0.25);
    o.connect(g).connect(master);
    o.start(t + 0.08);
    o.stop(t + 0.35);
  }

  function sfxWrong() {
    ensure();
    const t = ctx.currentTime;
    // Filter kurz zuklappen – klingt, als würde der Track "absaufen"
    filter.frequency.cancelScheduledValues(t);
    filter.frequency.setValueAtTime(18000, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.25);
    filter.frequency.exponentialRampToValueAtTime(18000, t + 1.6);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.35);
    env(g, t, 0.12, 0.4);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.45);
  }

  return {
    start, stop, setLevel, setVolume, duck, sfxCorrect, sfxWrong,
    get level() { return level; },
    get running() { return running; },
    MAX_LEVEL,
  };
})();
