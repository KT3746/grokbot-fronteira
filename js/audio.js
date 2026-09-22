/* FRONTEIRA — Web Audio: vento, passos, chime, mudo */
const FronteiraAudio = (() => {
  let ctx = null;
  let muted = false;
  let windGain = null;
  let windOsc = null;
  let windFilter = null;
  let windLfo = null;
  let started = false;
  let stepCooldown = 0;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function startAmbience() {
    const c = ensure();
    if (!c || started) return;
    started = true;

    windFilter = c.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 280;
    windFilter.Q.value = 0.6;

    windGain = c.createGain();
    windGain.gain.value = muted ? 0 : 0.028;

    windOsc = c.createOscillator();
    windOsc.type = 'sawtooth';
    windOsc.frequency.value = 55;

    const noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const noise = c.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;

    windLfo = c.createOscillator();
    windLfo.frequency.value = 0.08;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.012;
    windLfo.connect(lfoGain);
    lfoGain.connect(windGain.gain);

    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(c.destination);
    noise.start();
    windLfo.start();
  }

  function setMuted(m) {
    muted = !!m;
    if (windGain) {
      windGain.gain.value = muted ? 0 : 0.028;
    }
    try {
      localStorage.setItem('fronteira_mute', muted ? '1' : '0');
    } catch (_) {}
  }

  function isMuted() { return muted; }

  function loadMute() {
    try {
      muted = localStorage.getItem('fronteira_mute') === '1';
    } catch (_) {}
    return muted;
  }

  function blip(freq, dur, type, vol) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.value = vol || 0.06;
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  function footstep() {
    if (muted) return;
    const now = performance.now();
    if (now < stepCooldown) return;
    stepCooldown = now + 210;
    blip(90 + Math.random() * 30, 0.05, 'triangle', 0.04);
  }

  function interactChime() {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    blip(520, 0.08, 'sine', 0.07);
    setTimeout(() => blip(780, 0.12, 'sine', 0.05), 60);
  }

  function questDone() {
    if (muted) return;
    blip(392, 0.1, 'sine', 0.07);
    setTimeout(() => blip(523, 0.12, 'sine', 0.07), 90);
    setTimeout(() => blip(659, 0.18, 'sine', 0.06), 180);
  }

  function unlock() {
    ensure();
    startAmbience();
  }

  return {
    unlock, setMuted, isMuted, loadMute, footstep, interactChime, questDone, startAmbience,
  };
})();
