// gameEngine.ts
// Klasik (düz) tavla kural motoru. TAMAMEN SAF FONKSİYONLAR: (state + hamle) -> yeni state.
// UI'dan bağımsız, test edilebilir. Rastgelelik sadece rollDice/rollOpening içinde, dışarıdan
// bir RNG fonksiyonu enjekte edilir (sunucu tarafında kriptografik RNG kullanılacak).

import { BoardPoint, GameState, Move, PlayerColor } from './types';

export const OPPONENT: Record<PlayerColor, PlayerColor> = {
  white: 'black',
  black: 'white',
};

/**
 * Mutlak tahta indeksini (0-23), verilen oyuncunun KENDİ göreceli numaralandırmasına (1-24) çevirir.
 * White: kendi 24 noktası = abs 23, kendi 1 noktası = abs 0  =>  rel = abs + 1
 * Black: kendi 24 noktası = abs 0,  kendi 1 noktası = abs 23 =>  rel = 24 - abs
 */
export function toPlayerRelativePoint(absoluteIndex: number, color: PlayerColor): number {
  return color === 'white' ? absoluteIndex + 1 : 24 - absoluteIndex;
}

/** Göreceli (1-24) noktayı mutlak indekse (0-23) çevirir. */
export function toAbsoluteIndex(relativePoint: number, color: PlayerColor): number {
  return color === 'white' ? relativePoint - 1 : 24 - relativePoint;
}

// ---------------------------------------------------------------------------
// Başlangıç durumu
// ---------------------------------------------------------------------------

export function createInitialGameState(startingPlayer: PlayerColor, openingDice: number[]): GameState {
  const points: BoardPoint[] = Array.from({ length: 24 }, () => ({ color: null, count: 0 }));

  const place = (relPoint: number, color: PlayerColor, count: number) => {
    const abs = toAbsoluteIndex(relPoint, color);
    points[abs] = { color, count };
  };

  // Standart klasik tavla dizilişi (her oyuncu kendi göreceli numaralandırmasına göre):
  // 24 noktasında 2, 13 noktasında 5, 8 noktasında 3, 6 noktasında 5 pul.
  for (const color of ['white', 'black'] as PlayerColor[]) {
    place(24, color, 2);
    place(13, color, 5);
    place(8, color, 3);
    place(6, color, 5);
  }

  return {
    points,
    bar: { white: 0, black: 0 },
    borneOff: { white: 0, black: 0 },
    turn: startingPlayer,
    dice: [...openingDice],
    movesThisTurn: [],
    gameOver: false,
    winner: null,
    isMarsWin: false,
    noMovesNotice: false,
    lastSkippedDice: [],
  };
}

// ---------------------------------------------------------------------------
// Zar atma (RNG dışarıdan enjekte edilir — sunucu tarafında kriptografik RNG kullanılır)
// ---------------------------------------------------------------------------

export type RandomIntFn = (minInclusive: number, maxInclusive: number) => number;

/** Açılış zarı: her oyuncu tek zar atar, büyük atan başlar ve İKİ zarı (kendisi+rakip) ilk hamlede kullanır. */
export function rollOpening(rand: RandomIntFn): { starter: PlayerColor; dice: number[] } {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const whiteRoll = rand(1, 6);
    const blackRoll = rand(1, 6);
    if (whiteRoll !== blackRoll) {
      const starter: PlayerColor = whiteRoll > blackRoll ? 'white' : 'black';
      return { starter, dice: [whiteRoll, blackRoll] };
    }
    // eşitlik -> yeniden at
  }
}

/** Normal tur zarı: çift gelirse (örn 4-4) o değer 4 defa oynanabilir. */
export function rollTurn(rand: RandomIntFn): number[] {
  const a = rand(1, 6);
  const b = rand(1, 6);
  if (a === b) return [a, a, a, a];
  return [a, b];
}

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function cloneState(state: GameState): GameState {
  return {
    points: state.points.map((p) => ({ ...p })),
    bar: { ...state.bar },
    borneOff: { ...state.borneOff },
    turn: state.turn,
    dice: state.dice ? [...state.dice] : null,
    movesThisTurn: [...state.movesThisTurn],
    gameOver: state.gameOver,
    winner: state.winner,
    isMarsWin: state.isMarsWin,
    noMovesNotice: state.noMovesNotice,
    lastSkippedDice: [...state.lastSkippedDice],
  };
}

/** Oyuncunun bar dışında, ev bölgesi (rel 1-6) dışında hiç pulu kalmadıysa true. Bearing-off ön koşulu. */
export function isAllCheckersHome(state: GameState, color: PlayerColor): boolean {
  if (state.bar[color] > 0) return false;
  for (let abs = 0; abs < 24; abs++) {
    const point = state.points[abs];
    if (point.color !== color || point.count === 0) continue;
    const rel = toPlayerRelativePoint(abs, color);
    if (rel > 6) return false;
  }
  return true;
}

/** Verilen göreceli noktadan (rel > checkRel) oyuncunun pulu var mı? Bearing-off "overage" kuralı için. */
function hasCheckerOnHigherPoint(state: GameState, color: PlayerColor, relPoint: number): boolean {
  for (let abs = 0; abs < 24; abs++) {
    const point = state.points[abs];
    if (point.color !== color || point.count === 0) continue;
    const rel = toPlayerRelativePoint(abs, color);
    if (rel > relPoint) return true;
  }
  return false;
}

function isPointBlockedForOpponent(state: GameState, abs: number, movingColor: PlayerColor): boolean {
  const point = state.points[abs];
  return point.color !== null && point.color !== movingColor && point.count >= 2;
}

function removeUsedDie(dice: number[], die: number): number[] {
  const idx = dice.indexOf(die);
  const copy = [...dice];
  copy.splice(idx, 1);
  return copy;
}

// ---------------------------------------------------------------------------
// Tek zar için üretilebilecek TÜM geçerli hamleler (mevcut state + kalan zarlar)
// ---------------------------------------------------------------------------

export function getSingleDieMoves(state: GameState, color: PlayerColor, dice: number[]): Move[] {
  if (state.gameOver) return [];
  const distinctDice = Array.from(new Set(dice));
  const moves: Move[] = [];

  const onBar = state.bar[color] > 0;

  if (onBar) {
    // Bar'da pul varken önce girmek ZORUNLU; başka hiçbir hamle üretilemez.
    for (const die of distinctDice) {
      const entryRel = 25 - die; // bar = "25. nokta" kabul edilir
      const entryAbs = toAbsoluteIndex(entryRel, color);
      if (!isPointBlockedForOpponent(state, entryAbs, color)) {
        moves.push({ color, from: -1, to: entryAbs, die });
      }
    }
    return moves;
  }

  const allHome = isAllCheckersHome(state, color);

  for (let abs = 0; abs < 24; abs++) {
    const point = state.points[abs];
    if (point.color !== color || point.count === 0) continue;
    const rel = toPlayerRelativePoint(abs, color);

    for (const die of distinctDice) {
      const destRel = rel - die;
      if (destRel >= 1) {
        const destAbs = toAbsoluteIndex(destRel, color);
        if (!isPointBlockedForOpponent(state, destAbs, color)) {
          moves.push({ color, from: abs, to: destAbs, die });
        }
      } else if (allHome) {
        // Bearing off adayı: destRel <= 0
        if (destRel === 0) {
          moves.push({ color, from: abs, to: -2, die });
        } else if (rel <= 6 && !hasCheckerOnHigherPoint(state, color, rel)) {
          // Zar noktadan büyük, ama daha yüksek numarada pul yoksa: en yakın (en yüksek) noktadan çıkış.
          // Bunun "en yüksek nokta" olduğunu garanti etmek için: rel'den yüksek hiç pul olmamalı
          // VE bu die için tam noktada pul yoksa bu geçerli overage'dır.
          if (die > rel) {
            moves.push({ color, from: abs, to: -2, die });
          }
        }
      }
    }
  }

  return moves;
}

// ---------------------------------------------------------------------------
// Bir hamleyi uygulama (saf fonksiyon)
// ---------------------------------------------------------------------------

export function applyMove(state: GameState, move: Move): GameState {
  const next = cloneState(state);
  const { color, from, to, die } = move;
  const opp = OPPONENT[color];

  // Kaynaktan kaldır
  if (from === -1) {
    next.bar[color] -= 1;
  } else {
    next.points[from].count -= 1;
    if (next.points[from].count === 0) next.points[from].color = null;
  }

  // Hedefe yerleştir
  if (to === -2) {
    next.borneOff[color] += 1;
  } else {
    const destPoint = next.points[to];
    if (destPoint.color === opp && destPoint.count === 1) {
      // VURMA (hit): rakibin tek pulu bar'a gönderilir.
      next.bar[opp] += 1;
      next.points[to] = { color, count: 1 };
    } else if (destPoint.color === color) {
      next.points[to] = { color, count: destPoint.count + 1 };
    } else {
      // boş nokta
      next.points[to] = { color, count: 1 };
    }
  }

  // Kullanılan zarı düş
  if (next.dice) {
    next.dice = removeUsedDie(next.dice, die);
  }
  next.movesThisTurn.push(move);
  next.lastSkippedDice = [];
  next.noMovesNotice = false;

  // Oyun bitiş kontrolü
  if (next.borneOff[color] === 15) {
    next.gameOver = true;
    next.winner = color;
    next.isMarsWin = isMars(next, opp);
  }

  return next;
}

/** Mars kontrolü: kaybedenin hiç pulu çıkmamışsa (checkersBornOff === 0) mars'tır. */
export function isMars(state: GameState, loserColor: PlayerColor): boolean {
  return state.borneOff[loserColor] === 0;
}

// ---------------------------------------------------------------------------
// "Forced maximal play" — mümkün olan MAKSİMUM sayıda zarı oynama zorunluluğu
// ---------------------------------------------------------------------------

/**
 * Verilen state ve kalan zarlardan başlayarak ulaşılabilecek TÜM hamle dizilerini
 * (sequence) DFS ile üretir ve bunların en uzun (maksimum zar sayısı kullanan)
 * olanlarını döndürür. Küçük dal sayısı (en fazla 4 zar, en fazla ~15 farklı
 * kaynak nokta) sayesinde tam arama (brute force) pratikte çok hızlıdır.
 */
export function getMaxPlayableDiceSequence(state: GameState, color: PlayerColor, dice: number[]): Move[][] {
  const results: Move[][] = [];

  function dfs(currentState: GameState, remainingDice: number[], path: Move[]) {
    if (remainingDice.length === 0) {
      results.push(path);
      return;
    }
    const nextMoves = getSingleDieMoves(currentState, color, remainingDice);
    if (nextMoves.length === 0) {
      results.push(path);
      return;
    }
    // Aynı (from,to,die) kombinasyonlarını tekrar tekrar denemeyi engellemek için
    // basit bir dedup (performans amaçlı, doğruluğu etkilemez).
    const seen = new Set<string>();
    for (const mv of nextMoves) {
      const key = `${mv.from}-${mv.to}-${mv.die}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const nextState = applyMove(currentState, mv);
      const nextDice = removeUsedDie(remainingDice, mv.die);
      dfs(nextState, nextDice, [...path, mv]);
    }
  }

  dfs(state, dice, []);

  if (results.length === 0) return [];
  const maxLen = Math.max(...results.map((r) => r.length));
  return results.filter((r) => r.length === maxLen);
}

// ---------------------------------------------------------------------------
// Kombinasyon hamlesi — zarların toplamı kadar TEK hamlede gitme
// (örn. 3-5 geldiyse, ara nokta uygunsa aynı pulu doğrudan 8 nokta ileri
// taşıyabilme; çiftte (4 aynı zar) aynı pul üzerinde 2/3/4 zarı art arda
// zincirleme). Bu YENİ bir kural değildir — sadece birden fazla tek-zar
// hamlesini tek bir tıklamada, sırayla uygulamanın kullanıcı arayüzü
// kolaylığıdır; her ara adım normal kural motoruyla doğrulanır.
// ---------------------------------------------------------------------------

/**
 * Belirli bir başlangıç noktasından (from: mutlak indeks veya bar için -1),
 * kalan zarların 2'den fazlasını zincirleyerek ulaşılabilecek TÜM hedefleri
 * (ve o hedefe ulaşmak için kullanılan zar sırasını) döndürür. Tek zarla
 * zaten ulaşılabilen hedefler burada YER ALMAZ (en az 2 zar kullanılmalı).
 */
export function getComboDestinationsFromOrigin(
  state: GameState,
  color: PlayerColor,
  origin: number,
  dice: number[]
): { to: number; dice: number[] }[] {
  const results: { to: number; dice: number[] }[] = [];
  const seenTo = new Set<number>();

  function dfs(currentState: GameState, currentFrom: number, remaining: number[], path: number[]) {
    const distinct = Array.from(new Set(remaining));
    for (const d of distinct) {
      const moves = getSingleDieMoves(currentState, color, [d]).filter((m) => m.from === currentFrom);
      for (const mv of moves) {
        const newPath = [...path, d];
        if (newPath.length >= 2 && !seenTo.has(mv.to)) {
          seenTo.add(mv.to);
          results.push({ to: mv.to, dice: newPath });
        }
        // Pul tahtadan çıktıysa (bear off) zincir orada biter, devam edilemez.
        if (mv.to !== -2 && newPath.length < 4) {
          const nextState = applyMove(currentState, mv);
          const nextRemaining = removeUsedDie(remaining, d);
          dfs(nextState, mv.to, nextRemaining, newPath);
        }
      }
    }
  }

  dfs(state, origin, dice, []);
  return results;
}

/**
 * Belirli bir (from, to) çifti için, mevcut zarlarla bu hedefe ulaşmayı
 * sağlayan geçerli bir hamle zinciri var mı diye arar; varsa o zinciri
 * (Move[]) döndürür, yoksa null. Sunucu, istemciden "şuraya direkt git"
 * isteği geldiğinde bunu kullanarak zinciri kendisi yeniden türetir —
 * istemciden gelen zar bilgisine güvenmez.
 */
export function findComboPath(
  state: GameState,
  color: PlayerColor,
  from: number,
  to: number,
  dice: number[]
): Move[] | null {
  function dfs(currentState: GameState, currentFrom: number, remaining: number[]): Move[] | null {
    const distinct = Array.from(new Set(remaining));
    for (const d of distinct) {
      const moves = getSingleDieMoves(currentState, color, [d]).filter((m) => m.from === currentFrom);
      for (const mv of moves) {
        if (mv.to === to) {
          return [mv];
        }
        if (mv.to !== -2) {
          const nextState = applyMove(currentState, mv);
          const nextRemaining = removeUsedDie(remaining, d);
          const rest = dfs(nextState, mv.to, nextRemaining);
          if (rest) return [mv, ...rest];
        }
      }
    }
    return null;
  }

  const path = dfs(state, from, dice);
  return path && path.length >= 2 ? path : null;
}

/**
 * Şu ANDAKİ durumdan (bu turda zaten bir kısım zar oynanmış olabilir) itibaren,
 * oyuncunun oynamasına İZİN VERİLEN hamlelerin listesini döndürür. Bu liste,
 * "kalan zarlarla ulaşılabilecek maksimum uzunluktaki dizilerin" ilk adımlarıdır.
 * UI, sadece bu listedeki hamlelere izin vermeli.
 */
export function getLegalMovesNow(state: GameState, color: PlayerColor): Move[] {
  if (!state.dice || state.dice.length === 0 || state.gameOver) return [];
  const maximalSequences = getMaxPlayableDiceSequence(state, color, state.dice);
  const firstMoves: Move[] = [];
  const seen = new Set<string>();
  for (const seq of maximalSequences) {
    if (seq.length === 0) continue;
    const mv = seq[0];
    const key = `${mv.from}-${mv.to}-${mv.die}`;
    if (!seen.has(key)) {
      seen.add(key);
      firstMoves.push(mv);
    }
  }
  return firstMoves;
}

/**
 * Zar atıldıktan sonra hiçbir zar oynanamıyorsa (maxLen === 0) true döner.
 * Bu durumda tur otomatik ve tamamen pas geçilir, zar tekrar atılmaz.
 */
export function hasNoPlayableMoves(state: GameState, color: PlayerColor): boolean {
  if (!state.dice || state.dice.length === 0) return true;
  const sequences = getMaxPlayableDiceSequence(state, color, state.dice);
  return sequences.every((s) => s.length === 0);
}

/**
 * Bir hamlenin şu anda oynanmasına izin verilip verilmediğini kontrol eder
 * (forced-maximal-play kuralına göre). Sunucu her "request_move" için bunu çağırır.
 */
export function isMoveCurrentlyLegal(state: GameState, move: Move): boolean {
  const legal = getLegalMovesNow(state, move.color);
  return legal.some((m) => m.from === move.from && m.to === move.to && m.die === move.die);
}

// ---------------------------------------------------------------------------
// Tur bitişi / geçiş mantığı
// ---------------------------------------------------------------------------

/** Bu turda oynanacak zar kalmadıysa veya hiç oynanabilir hamle yoksa true. */
export function isTurnOver(state: GameState, color: PlayerColor): boolean {
  if (!state.dice || state.dice.length === 0) return true;
  return getLegalMovesNow(state, color).length === 0;
}

/** Sırayı diğer oyuncuya geçirir; zar ve tur-hamle geçmişini sıfırlar. */
export function endTurn(state: GameState): GameState {
  const next = cloneState(state);
  const skipped = next.dice ? [...next.dice] : [];
  next.turn = OPPONENT[next.turn];
  next.dice = null;
  next.movesThisTurn = [];
  next.lastSkippedDice = skipped;
  next.noMovesNotice = skipped.length > 0;
  return next;
}

/** Yeni bir oyun (game) başlatır: tahta sıfırlanır, açılış zarı ile devam eder. Maç skoru KORUNUR (server tutar). */
export function startNewGame(rand: RandomIntFn): GameState {
  const { starter, dice } = rollOpening(rand);
  return createInitialGameState(starter, dice);
}

/** Toplam pip mesafesi: bar'daki her pul 25 pip, tahtadaki her pul kendi göreceli numarası kadar pip. */
export function getPipCount(state: GameState, color: PlayerColor): number {
  let pips = state.bar[color] * 25;
  for (let abs = 0; abs < 24; abs++) {
    const point = state.points[abs];
    if (point.color !== color) continue;
    const rel = toPlayerRelativePoint(abs, color);
    pips += rel * point.count;
  }
  return pips;
}
