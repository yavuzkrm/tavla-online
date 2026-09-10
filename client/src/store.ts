import { create } from 'zustand';
import { MatchState, Move, PlayerColor, RoomPlayer } from './types';

export type Screen = 'home' | 'create' | 'join' | 'waiting' | 'select_length' | 'game';

interface ChatMessage {
  name: string;
  color: PlayerColor;
  text: string;
}

interface AppState {
  screen: Screen;
  playerName: string;
  roomId: string | null;
  myColor: PlayerColor | null;
  hostPlayerId: string | null;
  playerId: string;
  players: RoomPlayer[];
  match: MatchState | null;
  pip: { white: number; black: number };
  legalMoves: Move[];
  selectedPoint: number | null; // seçilen kaynak (abs index, veya -1 bar)
  chat: ChatMessage[];
  notice: string | null;
  opponentDisconnected: boolean;
  errorMessage: string | null;

  setScreen: (s: Screen) => void;
  setPlayerName: (n: string) => void;
  setPlayerId: (id: string) => void;
  setRoomJoined: (roomId: string, color: PlayerColor) => void;
  setRoomReady: (players: RoomPlayer[], hostPlayerId: string) => void;
  applyStateUpdate: (payload: { match: MatchState; pip: { white: number; black: number }; legalMoves: Move[]; players: RoomPlayer[] }) => void;
  selectPoint: (p: number | null) => void;
  pushChat: (m: ChatMessage) => void;
  setNotice: (n: string | null) => void;
  setOpponentDisconnected: (v: boolean) => void;
  setError: (m: string | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  screen: 'home',
  playerName: '',
  roomId: null,
  myColor: null,
  hostPlayerId: null,
  playerId: '',
  players: [],
  match: null,
  pip: { white: 0, black: 0 },
  legalMoves: [],
  selectedPoint: null,
  chat: [],
  notice: null,
  opponentDisconnected: false,
  errorMessage: null,

  setScreen: (screen) => set({ screen }),
  setPlayerName: (playerName) => set({ playerName }),
  setPlayerId: (playerId) => set({ playerId }),
  setRoomJoined: (roomId, myColor) => set({ roomId, myColor }),
  setRoomReady: (players, hostPlayerId) =>
    set((s) => ({ players, hostPlayerId, screen: s.match ? 'game' : 'select_length' })),
  applyStateUpdate: ({ match, pip, legalMoves, players }) =>
    set({ match, pip, legalMoves, players, screen: 'game', selectedPoint: null }),
  selectPoint: (selectedPoint) => set({ selectedPoint }),
  pushChat: (m) => set((s) => ({ chat: [...s.chat.slice(-49), m] })),
  setNotice: (notice) => set({ notice }),
  setOpponentDisconnected: (opponentDisconnected) => set({ opponentDisconnected }),
  setError: (errorMessage) => set({ errorMessage }),
  reset: () =>
    set({
      screen: 'home',
      roomId: null,
      myColor: null,
      hostPlayerId: null,
      players: [],
      match: null,
      legalMoves: [],
      selectedPoint: null,
      chat: [],
      notice: null,
      opponentDisconnected: false,
      errorMessage: null,
    }),
}));
