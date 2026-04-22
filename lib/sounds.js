/**
 * Subtle UI sounds via Web Audio API.
 * Checks localStorage('waybetter-sounds') === 'off' before playing.
 * All sounds are synthesized — no audio files needed.
 */

export function playSound(type) {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('waybetter-sounds') === 'off') return;

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    if (type === 'start') {
      // Two ascending tones — recording begins
      tone(ctx, 550, now,        0.11, 0.06);
      tone(ctx, 880, now + 0.11, 0.14, 0.10);
    } else if (type === 'stop') {
      // Two descending tones — recording ends
      tone(ctx, 880, now,        0.11, 0.06);
      tone(ctx, 550, now + 0.11, 0.14, 0.10);
    } else if (type === 'ready') {
      // Three-note rising arpeggio — transcript arrived
      tone(ctx, 550,  now,        0.08, 0.05);
      tone(ctx, 660,  now + 0.08, 0.08, 0.05);
      tone(ctx, 880,  now + 0.16, 0.14, 0.10);
    }

    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch {
    // AudioContext unavailable or blocked — fail silently
  }
}

/**
 * @param {AudioContext} ctx
 * @param {number} freq      - Frequency in Hz
 * @param {number} startTime - ctx.currentTime offset in seconds
 * @param {number} duration  - Total duration of the tone in seconds
 * @param {number} fadeOut   - Fade-out ramp duration at end (seconds)
 */
function tone(ctx, freq, startTime, duration, fadeOut) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.12, startTime + 0.008); // fast attack
  gain.gain.setValueAtTime(0.12, startTime + duration - fadeOut);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
}
