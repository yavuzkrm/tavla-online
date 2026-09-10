// sound.ts — Harici ses dosyası olmadan, tarayıcının Web Audio API'siyle
// anlık üretilen ses efektleri. Gerçekçilik için düz sinüs/kare dalga yerine
// FİLTRELENMİŞ GÜRÜLTÜ (bant geçiren filtre + gürültü) ve kısa "darbe" (thump)
// katmanları birleştiriliyor — bu, tahtaya vuran zar/pul seslerine çok daha
// yakın bir doku veriyor.

let ctx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!ctx) ctx = new AudioCtor();
  if (ctx.state === 'suspended') {
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

/** Kısa, alçak frekanslı bir "darbe" (thump) — fiziksel bir cismin sert bir yüzeye
 * vurma hissini verir. Frekans hafifçe düşerek biter (gerçek bir vuruşun doğal sönümü). */
function thump(freq: number, duration: number, startTime = 0, peakGain = 0.3) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  const t0 = c.currentTime + startTime;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.55, 40), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Bant geçiren filtreden geçirilmiş beyaz gürültü — "tık", "takırtı", "çatırtı"
 * gibi dokulu, kısa perküsif sesler için düz gürültüden çok daha gerçekçi. */
function filteredNoise(
  duration: number,
  opts: { frequency?: number; type?: BiquadFilterType; q?: number; startTime?: number; peakGain?: number } = {}
) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const { frequency = 1200, type = 'bandpass', q = 1, startTime = 0, peakGain = 0.25 } = opts;

  const bufferSize = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = c.createGain();

  const t0 = c.currentTime + startTime;
  gain.gain.setValueAtTime(peakGain, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(t0);
}

/** Zar sesi: birkaç düzensiz "takırtı" (zarın tahtaya çarpıp sekmesi) + son bir
 * alçak "toc" (zarın yere/tahtaya oturması). Her takırtının frekansı hafifçe
 * farklı seçiliyor ki mekanik/tekrarlı değil, doğal/rastgele hissettirsin. */
export function playDiceSound(): void {
  const knockTimes = [0, 0.055, 0.11, 0.165, 0.21];
  const freqs = [2400, 1900, 2600, 1700, 2100];
  knockTimes.forEach((t, i) => {
    filteredNoise(0.035 + Math.random() * 0.01, {
      frequency: freqs[i] + (Math.random() * 200 - 100),
      type: 'bandpass',
      q: 0.6 + Math.random() * 0.4,
      startTime: t,
      peakGain: 0.16 + Math.random() * 0.06,
    });
  });
  thump(150, 0.11, 0.23, 0.16);
}

/** Pul (taş) hareket sesi: kısa, tok bir "tak" — filtrelenmiş gürültü + hafif alçak darbe. */
export function playMoveSound(): void {
  filteredNoise(0.045, { frequency: 950, type: 'bandpass', q: 1.3, startTime: 0, peakGain: 0.22 });
  thump(300, 0.05, 0, 0.14);
}

/** Vurma (hit) sesi: daha sert ve dolgun — düşük darbe + geniş bantlı gürültü çatırtısı. */
export function playHitSound(): void {
  filteredNoise(0.09, { frequency: 650, type: 'bandpass', q: 0.7, startTime: 0, peakGain: 0.28 });
  filteredNoise(0.04, { frequency: 3200, type: 'highpass', q: 0.5, startTime: 0.01, peakGain: 0.12 });
  thump(140, 0.14, 0.01, 0.24);
}

/** Pul çıkarma (bear off) sesi: hafif, yükselen iki nota — küçük bir başarı hissi. */
export function playBearOffSound(): void {
  const c = getCtx();
  if (!c || !enabled) return;
  [660, 880].forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    const t0 = c.currentTime + i * 0.09;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.12, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.14);
  });
}

/** Buton/seçim tıklama sesi — çok kısa, yumuşak bir "tık". */
export function playClickSound(): void {
  filteredNoise(0.02, { frequency: 1800, type: 'bandpass', q: 1.5, startTime: 0, peakGain: 0.1 });
}

/** Oyun/maç kazanma anı için küçük bir fanfar. */
export function playWinSound(): void {
  const c = getCtx();
  if (!c || !enabled) return;
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    const t0 = c.currentTime + i * 0.1;
    const dur = i === notes.length - 1 ? 0.22 : 0.11;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.14, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  });
}
