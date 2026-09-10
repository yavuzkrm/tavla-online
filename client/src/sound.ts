// sound.ts — Harici ses dosyası olmadan, tarayıcının Web Audio API'siyle
// anlık üretilen kısa ses efektleri (zar, hamle, vurma, pul çıkarma).

let ctx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!ctx) ctx = new AudioCtor();
  if (ctx.state === 'suspended') {
    // Tarayıcıların otomatik oynatma kısıtlaması: ilk ses, bir kullanıcı
    // etkileşimi (tıklama) içinde tetiklenmeli — zaten öyle kullanılıyor.
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

function tone(freq: number, duration: number, type: OscillatorType, startTime = 0, peakGain = 0.15) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + startTime;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noiseBurst(duration: number, startTime = 0, peakGain = 0.2) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const bufferSize = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  const t0 = c.currentTime + startTime;
  gain.gain.setValueAtTime(peakGain, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  src.connect(gain);
  gain.connect(c.destination);
  src.start(t0);
}

/** Zar sallanıyormuş gibi birkaç kısa takırtı + kısa bir "tık" sesi. */
export function playDiceSound(): void {
  noiseBurst(0.05, 0);
  noiseBurst(0.045, 0.07);
  noiseBurst(0.06, 0.15);
  tone(190, 0.07, 'square', 0.19, 0.06);
}

/** Pul hareket sesi — kısa, yumuşak bir "tık". */
export function playMoveSound(): void {
  tone(520, 0.06, 'triangle', 0, 0.12);
}

/** Vurma (hit) sesi — daha sert/dramatik. */
export function playHitSound(): void {
  tone(160, 0.16, 'sawtooth', 0, 0.18);
  noiseBurst(0.08, 0.015, 0.15);
}

/** Pul çıkarma (bear off) sesi — kısa, yükselen iki nota. */
export function playBearOffSound(): void {
  tone(660, 0.09, 'sine', 0, 0.12);
  tone(880, 0.1, 'sine', 0.09, 0.12);
}

/** Buton/seçim tıklama sesi (hafif geri bildirim). */
export function playClickSound(): void {
  tone(700, 0.035, 'square', 0, 0.045);
}

/** Oyun/maç kazanma anı için küçük bir fanfar. */
export function playWinSound(): void {
  tone(523, 0.1, 'triangle', 0, 0.12);
  tone(659, 0.1, 'triangle', 0.1, 0.12);
  tone(784, 0.16, 'triangle', 0.2, 0.14);
}
