// Procedural WebAudio: engine hum, sirens, gunshots, UI blips, and two
// radio stations (SOL 101.9 and PALMA FM) played by a 16-step sequencer.
// No audio files. Everything is guarded: with no audio device the game
// still plays silently.
import { RADIO } from './config.js';

export function createAudio(G) {
  let ctx = null;
  let station = 0; // 0 = SOL 101.9, 1 = PALMA FM, 2 = off
  let engineOsc = null;
  let engineGain = null;
  let nextStepTime = 0;
  let step = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function blip(freq = 660, dur = 0.07, vol = 0.08) {
    const c = ensure();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + dur);
    } catch { /* silent */ }
  }

  function noiseBurst(dur = 0.15, vol = 0.2) {
    const c = ensure();
    if (!c) return;
    try {
      const len = Math.floor(c.sampleRate * dur);
      const buffer = c.createBuffer(1, len, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buffer;
      const gain = c.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(c.destination);
      src.start();
    } catch { /* silent */ }
  }

  function note(freq, time, dur, type, vol) {
    const c = ctx;
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(time);
    osc.stop(time + dur);
  }

  // The radio sequencer: 16 steps of bass (triangle) and arpeggio (square)
  // in eighth notes. The two stations differ in tempo, key and pattern.
  const BASS_PATTERNS = [
    [0, -1, 0, -1, 3, -1, 0, -1, 5, -1, 3, -1, 0, 7, 5, -1],
    [0, -1, 2, -1, 4, -1, 2, -1, 5, -1, 4, -1, 2, -1, 0, -1],
  ];
  const ARP_PATTERNS = [
    [0, 3, 7, 10, 7, 3, 0, 3, 7, 10, 12, 10, 7, 3, 0, -1],
    [0, 4, 7, 9, 12, 9, 7, 4, 0, 4, 7, 12, 9, 7, 4, -1],
  ];
  const SCALES = [
    [1, 1.122, 1.189, 1.335, 1.498, 1.682, 1.782], // minor-ish steps
    [1, 1.122, 1.26, 1.335, 1.498, 1.682, 1.888], // major-ish steps
  ];

  function radioTick() {
    const c = ensure();
    if (!c || station === 2) return;
    if (c.state === 'suspended') {
      c.resume().catch(() => {});
      return;
    }
    const st = RADIO.stations[station];
    const stepDur = 60 / st.bpm / 2;
    if (nextStepTime < c.currentTime) nextStepTime = c.currentTime + 0.05;
    while (nextStepTime < c.currentTime + 0.15) {
      const s = step % RADIO.steps;
      const bassNote = BASS_PATTERNS[station][s];
      if (bassNote >= 0) {
        const f = st.base * SCALES[station][bassNote % 7] * (bassNote >= 7 ? 2 : 1);
        note(f / 2, nextStepTime, stepDur * 0.9, 'triangle', RADIO.bassVol);
      }
      const arpNote = ARP_PATTERNS[station][s];
      if (arpNote >= 0) {
        const f = st.base * 2 * SCALES[station][arpNote % 7] * (arpNote >= 7 ? 2 : 1);
        note(f, nextStepTime, stepDur * 0.5, 'square', RADIO.arpVol);
      }
      step += 1;
      nextStepTime += stepDur;
    }
  }

  function engine(speed) {
    const c = ensure();
    if (!c || !engineGain) return;
    try {
      engineGain.gain.value = G.player.car ? 0.03 + Math.abs(speed) * 0.001 : 0;
      engineOsc.frequency.value = 55 + Math.abs(speed) * 2.2;
    } catch { /* silent */ }
  }

  function siren(on) {
    // A two-tone siren is expensive to schedule per frame; the engine hum
    // plus a periodic blip marks police presence instead.
    if (on && Math.floor(G.time * 2) !== Math.floor((G.time - 1 / 60) * 2)) {
      blip(Math.floor(G.time * 2) % 2 === 0 ? 880 : 660, 0.12, 0.03);
    }
  }

  return {
    ensure,
    radioStation() {
      return station === 2 ? null : RADIO.stations[station];
    },
    cycleRadio() {
      station = (station + 1) % 3;
      step = 0;
      nextStepTime = 0;
      blip(520, 0.06, 0.06);
      return station;
    },
    radioTick,
    engine,
    siren,
    gunshot() { noiseBurst(0.15, 0.22); },
    enemyShot() { noiseBurst(0.1, 0.08); },
    hitMarker() { blip(1200, 0.05, 0.08); },
    ui() { blip(660, 0.07, 0.08); },
    mission() { blip(880, 0.12, 0.1); setTimeout(() => blip(1170, 0.15, 0.1), 120); },
  };
}
