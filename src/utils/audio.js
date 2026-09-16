/**
 * Programmatic audio synthesis using the browser's Web Audio API.
 * This is 100% offline-compatible and doesn't require external audio assets.
 */

// Synthesizes a Netflix-style "Tudum" sound
export function playNetflixSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Beat synthesis helper (low frequencies)
    const playBeat = (time, freq, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.8, time + duration);

      gain.gain.setValueAtTime(0.01, time);
      gain.gain.linearRampToValueAtTime(0.85, time + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + duration);
    };

    // Shimmer/resonance synthesis helper (high-pitched string/pad resonance)
    const playShimmer = (time, freq, duration, volume = 0.1) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0.01, time);
      gain.gain.linearRampToValueAtTime(volume, time + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + duration);
    };

    const now = ctx.currentTime;

    // "Tu" - First low hit
    playBeat(now, 75, 0.18);

    // "Dum" - Second, deeper/longer punchy hit slightly delayed
    playBeat(now + 0.12, 85, 0.55);
    
    // Ambient metallic/string resonance fading out
    playShimmer(now + 0.15, 329.63, 1.2, 0.1);  // E4
    playShimmer(now + 0.15, 440.00, 1.2, 0.1);  // A4
    playShimmer(now + 0.15, 659.25, 1.5, 0.12); // E5
  } catch (e) {
    console.warn('Web Audio API is not supported or blocked by browser policy:', e);
  }
}

// Synthesizes a beautiful double-bell chime for notification alerts
export function playBellSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq, duration, volume, delay = 0) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      
      gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);
    };

    // A sweet double high chime ("ting-ting")
    playTone(987.77, 0.45, 0.25, 0);      // B5 note
    playTone(1318.51, 0.65, 0.18, 0.08);   // E6 note
  } catch (e) {
    console.warn('Web Audio API notification error:', e);
  }
}
