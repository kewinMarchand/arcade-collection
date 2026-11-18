let audioContext = null;

function getContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

export function createAudio(getEnabled = () => false) {
  function tone(freq = 440, duration = 0.07, type = 'square', volume = 0.035) {
    if (!getEnabled()) return;
    try {
      const ctx = getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {
      // Audio is optional.
    }
  }

  function seq(notes = []) {
    notes.forEach(([freq, dur, type, vol, delay]) => {
      setTimeout(() => tone(freq, dur, type, vol), (delay || 0) * 1000);
    });
  }

  return { tone, seq };
}
