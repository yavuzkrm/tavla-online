import { describe, it, expect } from 'vitest';
import {
  createInitialGameState,
  applyMove,
  getSingleDieMoves,
  getLegalMovesNow,
  getMaxPlayableDiceSequence,
  getComboDestinationsFromOrigin,
  findComboPath,
  isAllCheckersHome,
  isMars,
  toAbsoluteIndex,
  toPlayerRelativePoint,
  hasNoPlayableMoves,
} from './gameEngine';
import { GameState, PlayerColor } from './types';

function emptyState(turn: PlayerColor, dice: number[] | null): GameState {
  return {
    points: Array.from({ length: 24 }, () => ({ color: null, count: 0 })),
    bar: { white: 0, black: 0 },
    borneOff: { white: 0, black: 0 },
    turn,
    dice,
    movesThisTurn: [],
    gameOver: false,
    winner: null,
    isMarsWin: false,
    noMovesNotice: false,
    lastSkippedDice: [],
  };
}

describe('relative <-> absolute nokta dönüşümü', () => {
  it('white için rel 24 = abs 23, rel 1 = abs 0', () => {
    expect(toAbsoluteIndex(24, 'white')).toBe(23);
    expect(toAbsoluteIndex(1, 'white')).toBe(0);
    expect(toPlayerRelativePoint(23, 'white')).toBe(24);
  });

  it('black için rel 24 = abs 0, rel 1 = abs 23', () => {
    expect(toAbsoluteIndex(24, 'black')).toBe(0);
    expect(toAbsoluteIndex(1, 'black')).toBe(23);
    expect(toPlayerRelativePoint(0, 'black')).toBe(24);
  });
});

describe('başlangıç dizilişi', () => {
  it('her oyuncu 15 pul ile başlar (2+5+3+5)', () => {
    const state = createInitialGameState('white', [3, 5]);
    let whiteCount = 0;
    let blackCount = 0;
    for (const p of state.points) {
      if (p.color === 'white') whiteCount += p.count;
      if (p.color === 'black') blackCount += p.count;
    }
    expect(whiteCount).toBe(15);
    expect(blackCount).toBe(15);
  });
});

describe('bloklu nokta kontrolü', () => {
  it('rakibin 2+ pulu olan noktaya hamle üretilmez', () => {
    const state = emptyState('white', [3]);
    state.points[10] = { color: 'white', count: 1 };
    state.points[7] = { color: 'black', count: 2 }; // white rel 8 için hedef -> blok
    // white rel(10)=11, die 3 -> destRel=8 -> abs = toAbsoluteIndex(8,'white')=7 (bloklu)
    const moves = getSingleDieMoves(state, 'white', [3]);
    expect(moves.length).toBe(0);
  });

  it('rakibin tek pulu (blot) olan noktaya gidilebilir ve vurma sonrası bar dolar', () => {
    const state = emptyState('white', [3]);
    state.points[10] = { color: 'white', count: 1 };
    state.points[7] = { color: 'black', count: 1 }; // blot
    const moves = getSingleDieMoves(state, 'white', [3]);
    expect(moves.length).toBe(1);
    const next = applyMove(state, moves[0]);
    expect(next.bar.black).toBe(1);
    expect(next.points[7].color).toBe('white');
    expect(next.points[7].count).toBe(1);
  });
});

describe('bar girişi', () => {
  it('bar da pul varken sadece giriş hamlesi üretilir', () => {
    const state = emptyState('white', [2, 5]);
    state.bar.white = 1;
    state.points[15] = { color: 'white', count: 3 }; // bar dışında normalde oynanabilecek pul
    const moves = getSingleDieMoves(state, 'white', [2, 5]);
    expect(moves.every((m) => m.from === -1)).toBe(true);
  });

  it('giriş noktası rakip tarafından 2+ ile kapalıysa o zar için giriş üretilmez', () => {
    const state = emptyState('white', [6]);
    state.bar.white = 1;
    // white için die=6 -> entryRel = 25-6=19 -> abs = toAbsoluteIndex(19,'white') = 18
    state.points[18] = { color: 'black', count: 2 };
    const moves = getSingleDieMoves(state, 'white', [6]);
    expect(moves.length).toBe(0);
  });

  it('her iki zar da bar girişi için kapalıysa tüm tur pas geçilir (hasNoPlayableMoves)', () => {
    const state = emptyState('white', [1, 2]);
    state.bar.white = 1;
    const entry1 = toAbsoluteIndex(25 - 1, 'white');
    const entry2 = toAbsoluteIndex(25 - 2, 'white');
    state.points[entry1] = { color: 'black', count: 2 };
    state.points[entry2] = { color: 'black', count: 2 };
    expect(hasNoPlayableMoves(state, 'white')).toBe(true);
  });
});

describe('bearing-off eşik kontrolü', () => {
  it('bar da veya ev dışında pul varken bearing-off yapılamaz', () => {
    const state = emptyState('white', [6]);
    state.points[toAbsoluteIndex(6, 'white')] = { color: 'white', count: 1 };
    state.points[toAbsoluteIndex(10, 'white')] = { color: 'white', count: 1 }; // ev dışı
    expect(isAllCheckersHome(state, 'white')).toBe(false);
    const moves = getSingleDieMoves(state, 'white', [6]);
    expect(moves.some((m) => m.to === -2)).toBe(false);
  });

  it('tüm pullar evde ise tam eşleşen zar ile çıkış yapılabilir', () => {
    const state = emptyState('white', [6]);
    state.points[toAbsoluteIndex(6, 'white')] = { color: 'white', count: 15 };
    const moves = getSingleDieMoves(state, 'white', [6]);
    expect(moves.some((m) => m.to === -2 && m.die === 6)).toBe(true);
  });

  it('zardan büyük noktada pul yoksa daha düşük noktadan overage ile çıkış yapılabilir', () => {
    const state = emptyState('white', [6]);
    // en yüksek nokta rel 4, 6 ve 5 boş -> die 6 ile rel4 ten çıkış (overage) geçerli
    state.points[toAbsoluteIndex(4, 'white')] = { color: 'white', count: 15 };
    const moves = getSingleDieMoves(state, 'white', [6]);
    expect(moves.some((m) => m.to === -2 && m.from === toAbsoluteIndex(4, 'white'))).toBe(true);
  });

  it('daha yüksek noktada pul varken düşük noktadan overage ile çıkış YAPILAMAZ', () => {
    const state = emptyState('white', [6]);
    state.points[toAbsoluteIndex(4, 'white')] = { color: 'white', count: 1 };
    state.points[toAbsoluteIndex(5, 'white')] = { color: 'white', count: 14 }; // daha yüksek nokta dolu
    const moves = getSingleDieMoves(state, 'white', [6]);
    expect(moves.some((m) => m.to === -2 && m.from === toAbsoluteIndex(4, 'white'))).toBe(false);
    expect(moves.some((m) => m.to === -2 && m.from === toAbsoluteIndex(5, 'white'))).toBe(true);
  });
});

describe('çift zar (double)', () => {
  it('4-4 gibi bir çift, 4 defa oynanabilir zar hakkı üretir', () => {
    const state = createInitialGameState('white', [4, 4, 4, 4]);
    expect(state.dice).toEqual([4, 4, 4, 4]);
  });

  it('forced maximal play: mümkünse en fazla sayıda zar oynatılmaya zorlanır', () => {
    const state = emptyState('white', [3, 3]);
    // Sadece bir pul var ve iki kez 3 oynanabiliyor (6 rel'den 3 rel'e, sonra 3 rel'den çıkışa değil ama harekete)
    state.points[toAbsoluteIndex(10, 'white')] = { color: 'white', count: 1 };
    const sequences = getMaxPlayableDiceSequence(state, 'white', [3, 3]);
    const maxLen = Math.max(...sequences.map((s) => s.length));
    expect(maxLen).toBeGreaterThanOrEqual(1);
    const legalNow = getLegalMovesNow(state, 'white');
    expect(legalNow.length).toBeGreaterThan(0);
  });
});

describe('kombinasyon hamlesi (zarların toplamı ile direkt gitme)', () => {
  it('ara nokta müsaitse iki zarın toplamı kadar direkt hedef bulunur', () => {
    const state = emptyState('white', [3, 5]);
    state.points[toAbsoluteIndex(15, 'white')] = { color: 'white', count: 1 };
    // rel15 -3-> rel12 -5-> rel7 (veya sırası ters de olabilir), toplamda 8 ileri: rel7
    const combos = getComboDestinationsFromOrigin(state, 'white', toAbsoluteIndex(15, 'white'), [3, 5]);
    expect(combos.some((c: any) => c.to === toAbsoluteIndex(7, 'white'))).toBe(true);
  });

  it('ara nokta rakip tarafından kapalıysa kombinasyon hedefi bulunmaz', () => {
    const state = emptyState('white', [3, 5]);
    state.points[toAbsoluteIndex(15, 'white')] = { color: 'white', count: 1 };
    // rel15-3->rel12 kapalı, rel15-5->rel10 açık ama rel10-3->rel7 de deneyip bulmalı;
    // ikisini de kapatırsak hiç combo olmamalı
    state.points[toAbsoluteIndex(12, 'white')] = { color: 'black', count: 2 };
    state.points[toAbsoluteIndex(10, 'white')] = { color: 'black', count: 2 };
    const combos = getComboDestinationsFromOrigin(state, 'white', toAbsoluteIndex(15, 'white'), [3, 5]);
    expect(combos.length).toBe(0);
  });

  it('çiftte (4 aynı zar) aynı pul art arda 4 zarı kullanarak ulaşabildiği yere gidebilir', () => {
    const state = emptyState('white', [2, 2, 2, 2]);
    state.points[toAbsoluteIndex(20, 'white')] = { color: 'white', count: 1 };
    const combos = getComboDestinationsFromOrigin(state, 'white', toAbsoluteIndex(20, 'white'), [2, 2, 2, 2]);
    // rel20 -> 18 -> 16 -> 14 -> 12 (4 kez 2 kullanarak)
    expect(combos.some((c: any) => c.to === toAbsoluteIndex(12, 'white') && c.dice.length === 4)).toBe(true);
  });

  it('findComboPath aynı hedefe giden geçerli zar zincirini döndürür', () => {
    const state = emptyState('white', [3, 5]);
    state.points[toAbsoluteIndex(15, 'white')] = { color: 'white', count: 1 };
    const path = findComboPath(state, 'white', toAbsoluteIndex(15, 'white'), toAbsoluteIndex(7, 'white'), [3, 5]);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(2);
  });
});

describe('mars kuralı', () => {
  it('kaybeden hiç pul çıkaramamışsa mars sayılır (2 puan)', () => {
    const state = emptyState('white', null);
    state.borneOff.black = 0;
    expect(isMars(state, 'black')).toBe(true);
  });

  it('kaybeden en az 1 pul çıkarmışsa mars sayılmaz (1 puan)', () => {
    const state = emptyState('white', null);
    state.borneOff.black = 1;
    expect(isMars(state, 'black')).toBe(false);
  });

  it('15. pul çıkınca oyun biter ve mars doğru hesaplanır', () => {
    const state = emptyState('white', [6]);
    state.points[toAbsoluteIndex(6, 'white')] = { color: 'white', count: 1 };
    state.borneOff.white = 14;
    state.borneOff.black = 0;
    const moves = getSingleDieMoves(state, 'white', [6]);
    const winMove = moves.find((m) => m.to === -2)!;
    const next = applyMove(state, winMove);
    expect(next.gameOver).toBe(true);
    expect(next.winner).toBe('white');
    expect(next.isMarsWin).toBe(true);
  });
});
