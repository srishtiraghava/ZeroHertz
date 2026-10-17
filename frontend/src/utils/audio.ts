import { DTMFSymbol } from '../types';

export const DTMF_ROW_FREQUENCIES = [697, 770, 852, 941] as const;
export const DTMF_COL_FREQUENCIES = [1209, 1336, 1477, 1633] as const;

export const DTMF_MATRIX: Record<DTMFSymbol, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  'A': [697, 1633],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  'B': [770, 1633],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  'C': [852, 1633],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
  'D': [941, 1633],
};

export const DTMF_GRID_ROWS: DTMFSymbol[][] = [
  ['1', '2', '3', 'A'],
  ['4', '5', '6', 'B'],
  ['7', '8', '9', 'C'],
  ['*', '0', '#', 'D'],
];

let globalAudioCtx: AudioContext | null = null;

/**
 * Returns a shared or new AudioContext, handling browser autoplay policies
 */
export function getAudioContext(): AudioContext {
  if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    globalAudioCtx = new AudioCtx();
  }
  if (globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

/**
 * Play a single DTMF dual-tone using two OscillatorNodes
 */
export async function playDTMFTone(
  symbol: DTMFSymbol,
  durationMs = 200,
  volume = 0.2
): Promise<void> {
  const freqs = DTMF_MATRIX[symbol];
  if (!freqs) return;

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const [rowFreq, colFreq] = freqs;
  const now = ctx.currentTime;
  const durationSec = durationMs / 1000;

  // Master gain for this tone with envelope
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.001, now);
  // Attack 8ms
  masterGain.gain.linearRampToValueAtTime(volume, now + 0.008);
  // Sustain until near end
  masterGain.gain.setValueAtTime(volume, now + Math.max(0.01, durationSec - 0.01));
  // Decay 10ms
  masterGain.gain.linearRampToValueAtTime(0.0001, now + durationSec);
  masterGain.connect(ctx.destination);

  // Low group oscillator (row)
  const oscLow = ctx.createOscillator();
  oscLow.type = 'sine';
  oscLow.frequency.setValueAtTime(rowFreq, now);
  oscLow.connect(masterGain);

  // High group oscillator (col)
  const oscHigh = ctx.createOscillator();
  oscHigh.type = 'sine';
  oscHigh.frequency.setValueAtTime(colFreq, now);
  oscHigh.connect(masterGain);

  oscLow.start(now);
  oscHigh.start(now);

  oscLow.stop(now + durationSec + 0.02);
  oscHigh.stop(now + durationSec + 0.02);

  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

/**
 * Transmit an entire sequence of DTMF symbols with configured tone and silence intervals
 */
export async function playDTMFSequence(
  sequence: string,
  toneDurationMs = 200,
  silenceIntervalMs = 100,
  onProgress?: (index: number, char: DTMFSymbol) => void
): Promise<void> {
  const chars = sequence.toUpperCase().split('') as DTMFSymbol[];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (DTMF_MATRIX[char]) {
      if (onProgress) onProgress(i, char);
      await playDTMFTone(char, toneDurationMs);
      if (i < chars.length - 1 && silenceIntervalMs > 0) {
        await new Promise((res) => setTimeout(res, silenceIntervalMs));
      }
    }
  }
}

/**
 * Three-tone success sound played via Web Audio API on transaction completion
 * C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz)
 */
export async function playSuccessSound(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const toneDuration = 0.12; // 120ms each
  const now = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const startTime = now + idx * 0.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(0.18, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + toneDuration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + toneDuration + 0.05);
  });
}

/**
 * Convert Float32 audio samples to 16-bit signed PCM ArrayBuffer
 */
export function float32ToInt16PCM(float32Array: Float32Array): Int16Array {
  const len = float32Array.length;
  const int16Array = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

/**
 * Convert Int16Array to base64 string for API payload
 */
export function pcmToBase64(int16Array: Int16Array): string {
  const bytes = new Uint8Array(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
