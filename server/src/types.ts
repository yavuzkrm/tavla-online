// Ortak tip tanımları. Değişken/fonksiyon isimleri İngilizce, yorumlar Türkçe.

export type PlayerColor = 'white' | 'black';

/** Tahtadaki tek bir nokta (point). Mutlak indeks 0-23, sabit/paylaşılan. */
export interface BoardPoint {
  color: PlayerColor | null;
  count: number;
}

export interface BarState {
  white: number;
  black: number;
}

export interface BorneOffState {
  white: number;
  black: number;
}

/** Tek bir hamle. from=-1 ise bar'dan giriş, to=-2 ise bearing-off (çıkış). */
export interface Move {
  color: PlayerColor;
  from: number; // -1 = bar, 0-23 = mutlak nokta
  to: number; // -2 = borne off, 0-23 = mutlak nokta
  die: number;
}

export type MatchLength = 3 | 5 | 7 | 9 | 11;

export interface GameState {
  points: BoardPoint[]; // length 24, absolute index
  bar: BarState;
  borneOff: BorneOffState;
  turn: PlayerColor;
  /** Bu turda kalan, henüz oynanmamış zar değerleri (multiset). Zar atılmadıysa null. */
  dice: number[] | null;
  /** Bu turda oynanan hamleler (geçmiş/animasyon amaçlı). */
  movesThisTurn: Move[];
  /** Oyun (game) bitti mi (biri 15 pulu çıkardı) */
  gameOver: boolean;
  winner: PlayerColor | null;
  isMarsWin: boolean;
  /** Zar atıldıktan sonra hiç oynanabilir hamle yoksa true; UI "hamle yok" bildirimi göstersin. */
  noMovesNotice: boolean;
  /** En son otomatik pas geçilen zar değerleri (UI bildirimi için). */
  lastSkippedDice: number[];
}

export interface MatchState {
  matchLength: MatchLength;
  score: { white: number; black: number };
  matchOver: boolean;
  matchWinner: PlayerColor | null;
  game: GameState;
  /** Son bitmiş oyunun sonucu (yeni oyun otomatik başlasa da UI kısa bir bildirim gösterebilsin). */
  lastGameResult: { winner: PlayerColor; isMars: boolean; gameIndex: number } | null;
}
