// Procedural WebAudio sound — every effect is synthesized, no audio files.
// The context is created lazily on the first user gesture (autoplay policy),
// so constructing this module is silent and safe on the title screen.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, sirenLfo = null;
  let ambientOn = false;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.4; master.connect(ctx.destination);
      // Engine: sawtooth through a low-pass, pitch follows speed.
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      // Siren: triangle that wails between two tones.
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 750;
      sirenLfo = ctx.createOscillator(); sirenLfo.type = 'square'; sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 220;
      sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start(); sirenLfo.start();
    } catch { return false; }
    return true;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }

  return {
    unlock() { ensure(); this.startAmbient(); },
    setEngine(speed01, on) {
      if (!ctx) return;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.09 : 0, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
    },
    setSiren(on) { if (ctx) sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2); },
    gunshot() { noise(0.14, 0.5, 1800); blip(160, 0.1, 'square', 0.25, 60); },
    punch() { noise(0.08, 0.35, 500); },
    crash() { noise(0.25, 0.5, 900); blip(90, 0.2, 'sine', 0.4, 40); },
    pickup() { blip(660, 0.09, 'sine', 0.3); setTimeout(() => blip(990, 0.14, 'sine', 0.3), 80); },
    jingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.32), i * 110)); },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'triangle', 0.3), i * 140)); },
    phone() { blip(880, 0.12, 'sine', 0.25); setTimeout(() => blip(1174, 0.12, 'sine', 0.25), 130); },
    startAmbient() {
      if (!ctx || ambientOn) return; ambientOn = true;
      // Low city hum: two detuned sines + slow filtered noise, very quiet.
      const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 58;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 58.7;
      const g = ctx.createGain(); g.gain.value = 0.02;
      o1.connect(g); o2.connect(g); g.connect(master); o1.start(); o2.start();
    },
  };
}
