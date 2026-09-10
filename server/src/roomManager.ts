import crypto from 'crypto';
import { GameState, MatchLength, MatchState, PlayerColor } from './types';
import { startNewGame } from './gameEngine';

// Karışabilecek karakterler (0/O, 1/I) hariç tutulmuş oda kodu alfabesi.
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface PlayerSlot {
  socketId: string | null;
  playerId: string; // reconnect için kalıcı kimlik (localStorage'da saklanır)
  name: string;
  color: PlayerColor;
  connected: boolean;
  disconnectTimer: NodeJS.Timeout | null;
}

export interface Room {
  roomId: string;
  hostPlayerId: string;
  players: PlayerSlot[]; // en fazla 2
  match: MatchState | null; // null: maç henüz başlamadı (host maç uzunluğu seçmedi)
  rematchOffer: { fromPlayerId: string } | null;
  /** Bu turda oynanan her hamleden ÖNCEKİ state'in birikimli listesi.
   * Sıra değişince (endTurn) veya oyun/maç bitince temizlenir — böylece
   * "son hamle yapılana kadar" (2. veya çiftte 4. hamle) geri alma mümkün olur. */
  undoStack: GameState[];
}

const rooms = new Map<string, Room>();

export function generateRoomCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 6 }, () => ROOM_CODE_ALPHABET[crypto.randomInt(0, ROOM_CODE_ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

export function createRoom(hostPlayerId: string, hostName: string, hostSocketId: string): Room {
  const roomId = generateRoomCode();
  const room: Room = {
    roomId,
    hostPlayerId,
    players: [
      {
        socketId: hostSocketId,
        playerId: hostPlayerId,
        name: hostName,
        color: 'white',
        connected: true,
        disconnectTimer: null,
      },
    ],
    match: null,
    rematchOffer: null,
    undoStack: [],
  };
  rooms.set(roomId, room);
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId.toUpperCase());
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId.toUpperCase());
}

export function joinRoom(roomId: string, playerId: string, name: string, socketId: string): Room | { error: string } {
  const room = getRoom(roomId);
  if (!room) return { error: 'Oda bulunamadı.' };

  // Zaten bu odada olan bir oyuncunun yeniden bağlanması (aynı playerId)
  const existing = room.players.find((p) => p.playerId === playerId);
  if (existing) {
    existing.socketId = socketId;
    existing.connected = true;
    if (existing.disconnectTimer) {
      clearTimeout(existing.disconnectTimer);
      existing.disconnectTimer = null;
    }
    return room;
  }

  if (room.players.length >= 2) return { error: 'Oda dolu.' };
  if (room.match && room.match.matchOver === false && room.match.game.movesThisTurn.length >= 0 && room.players.length === 2) {
    return { error: 'Maç zaten başlamış.' };
  }

  room.players.push({
    socketId,
    playerId,
    name,
    color: 'black',
    connected: true,
    disconnectTimer: null,
  });
  return room;
}

export function startMatch(room: Room, matchLength: MatchLength, randInt: (min: number, max: number) => number): void {
  room.match = {
    matchLength,
    score: { white: 0, black: 0 },
    matchOver: false,
    matchWinner: null,
    game: startNewGame(randInt),
    lastGameResult: null,
  };
  room.rematchOffer = null;
  room.undoStack = [];
}

export function getOpponentSlot(room: Room, playerId: string): PlayerSlot | undefined {
  return room.players.find((p) => p.playerId !== playerId);
}

export function getPlayerSlot(room: Room, playerId: string): PlayerSlot | undefined {
  return room.players.find((p) => p.playerId === playerId);
}

export function getAllRooms(): Map<string, Room> {
  return rooms;
}
