export type PlayerColor = 'white' | 'black';

export interface BoardPoint {
  color: PlayerColor | null;
  count: number;
}

export interface Move {
  color: PlayerColor;
  from: number; // -1 = bar
  to: number; // -2 = borne off
  die: number;
}

/** Zarların toplamı kadar tek hamlede (zincirleme) ulaşılabilen bir hedef. */
export interface ComboMove {
  from: number;
  to: number;
  dice: number[];
}

export interface GameState {
  points: BoardPoint[];
  bar: { white: number; black: number };
  borneOff: { white: number; black: number };
  turn: PlayerColor;
  dice: number[] | null;
  movesThisTurn: Move[];
  gameOver: boolean;
  winner: PlayerColor | null;
  isMarsWin: boolean;
  noMovesNotice: boolean;
  lastSkippedDice: number[];
}

export type MatchLength = 3 | 5 | 7 | 9 | 11;

export interface MatchState {
  matchLength: MatchLength;
  score: { white: number; black: number };
  matchOver: boolean;
  matchWinner: PlayerColor | null;
  game: GameState;
  lastGameResult: { winner: PlayerColor; isMars: boolean; gameIndex: number } | null;
}

export interface RoomPlayer {
  playerId: string;
  name: string;
  color: PlayerColor;
  connected?: boolean;
}

export interface StateUpdatePayload {
  match: MatchState;
  pip: { white: number; black: number };
  legalMoves: Move[];
  comboMoves: ComboMove[];
  players: RoomPlayer[];
}
