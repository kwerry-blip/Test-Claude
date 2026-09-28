/* Beat in drei Stilen (Tech-House, Hard-Tekk, Schranz), live im Browser erzeugt (Web Audio, keine Audiodateien).
   Jede richtige Antwort in Folge schaltet eine weitere Spur frei – bis zum Drop. */
'use strict';

const Beat = (() => {
  const MAX_LEVEL = 4;
  // Rollende Bassline in A-Moll, 16 Schritte (0 = Pause)
  const BASS = [0, 0, 55, 0, 0, 0, 55, 65.4, 0, 0, 55, 0, 0, 0, 49, 55];
  const STAB = [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
  const CHORD = [220, 261.6, 329.6, 392]; // Am7

  // Hard-Tekk: Offbeat-Bass und Lead-Melodie in A-Moll
  const TEKK_BASS = [0, 0, 55, 0, 0, 0, 55, 0, 0, 0, 55, 0, 0, 0, 65.4, 0];
  const TEKK_LEAD = [880, 0, 0, 1046.5, 0, 0, 987.8, 0, 880, 0, 0, 784, 0, 659.3, 0, 784];
  // Schranz: Rumble zwischen den Kicks, metallischer Percussion-Loop, Stab
  const SCHRANZ_METAL = [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1];
  const SCHRANZ_STAB = [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0];

  const STYLES = {
    techhouse: { id: 'techhouse', name: 'Tech-House', bpm: 124 },
    hardtekk: { id: 'hardtekk', name: 'Hard-Tekk', bpm: 165 },
    schranz: { id: 'schranz', name: 'Schranz', bpm: 152 },
  };
  let style = STYLES.techhouse;

  let ctx, bus, filter, master, noise, timer, drive;
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
    // Verzerrer für Hard-Tekk und Schranz
    drive = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = i / (curve.length - 1) * 2 - 1;
      curve[i] = Math.tanh(x * 6);
    }
    drive.curve = curve;
    drive.oversample = '2x';
    const driveOut = ctx.createGain();
    driveOut.gain.value = 0.45;
    drive.connect(driveOut).connect(bus);
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

  // Verzerrter Kick: höher gestimmt, länger, durch den Verzerrer
  function hardKick(t, start, end, decay, gain) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(start, t);
    o.frequency.exponentialRampToValueAtTime(end, t + 0.09);
    env(g, t, gain, decay);
    o.connect(g).connect(drive);
    o.start(t);
    o.stop(t + decay + 0.05);
    // Klick für Durchsetzungskraft
    noiseHit(t, 'highpass', 3000, 0.25, 0.015);
  }

  function synth(t, type, freq, cutoff, peak, decay, dest = bus, q = 4) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    f.type = 'lowpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff / 6), t + decay);
    env(g, t, peak, decay);
    o.connect(f).connect(g).connect(dest);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  function playHardtekk(s, t) {
    if (s % 4 === 0) hardKick(t, 220, 48, 0.3, 1);
    if (level >= 1 && s % 4 === 2) noiseHit(t, 'highpass', 8000, 0.3, 0.06);
    if (level >= 2 && TEKK_BASS[s]) synth(t, 'sawtooth', TEKK_BASS[s], 1400, 0.4, 0.14, drive, 6);
    if (level >= 3) {
      if (s === 4 || s === 12) clap(t);
      noiseHit(t, 'highpass', 10000, s % 2 ? 0.06 : 0.1, 0.025);
    }
    if (level >= 4 && TEKK_LEAD[s]) {
      synth(t, 'square', TEKK_LEAD[s], 3500, 0.07, 0.16);
      synth(t, 'sawtooth', TEKK_LEAD[s] * 1.005, 3000, 0.05, 0.16);
    }
  }

  function playSchranz(s, t) {
    if (s % 4 === 0) hardKick(t, 180, 42, 0.22, 1.2);
    // Rumble: tiefer, verzerrter Nachhall zwischen den Kicks
    if (level >= 2 && s % 4 !== 0) synth(t, 'sawtooth', 43.6, 380, s % 4 === 1 ? 0.28 : 0.2, 0.1, drive, 2);
    if (level >= 1 && s % 4 === 2) noiseHit(t, 'highpass', 6500, 0.35, 0.12);
    if (level >= 3) {
      if (SCHRANZ_METAL[s]) {
        noiseHit(t, 'bandpass', 2600, 0.45, 0.05);
        synth(t, 'square', 1234, 5000, 0.03, 0.04);
      }
      if (s === 4 || s === 12) clap(t);
    }
    if (level >= 4) {
      if (SCHRANZ_STAB[s]) {
        synth(t, 'sawtooth', 110, 2400, 0.3, 0.12, drive, 8);
        synth(t, 'sawtooth', 164.8, 2400, 0.22, 0.12, drive, 8);
      }
      noiseHit(t, 'highpass', 11000, 0.08, 0.02);
    }
  }

  function playStep(s, t) {
    if (style.id === 'hardtekk') return playHardtekk(s, t);
    if (style.id === 'schranz') return playSchranz(s, t);
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
    const stepDur = 60 / style.bpm / 4;
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

  function setStyle(id) {
    style = STYLES[id] || STYLES.techhouse;
  }

  return {
    start, stop, setLevel, setStyle, STYLES,
    get style() { return style; }, setVolume, duck, sfxCorrect, sfxWrong,
    get level() { return level; },
    get running() { return running; },
    MAX_LEVEL,
  };
})();
