import { io, Socket } from 'socket.io-client';

// Sunucu adresi: geliştirme için .env ile SERVER_URL override edilebilir.
const SERVER_URL = (import.meta as any).env?.VITE_SERVER_URL || 'http://localhost:4000';

export const socket: Socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

/** Tarayıcı yeniden açılsa da aynı oyuncu kimliğini korumak için localStorage'da saklanır. */
export function getOrCreatePlayerId(): string {
  const key = 'tavla_player_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

// Aktif oda kodu localStorage'da tutulur — hem sayfa yenilenince hem de
// bağlantı bir an kopup Socket.IO otomatik yeniden bağlanınca (ağ dalgalanması
// vb.) aynı odaya otomatik geri dönebilmek için.
const ROOM_KEY = 'tavla_room_id';

export function saveRoomId(roomId: string): void {
  localStorage.setItem(ROOM_KEY, roomId);
}

export function getSavedRoomId(): string | null {
  return localStorage.getItem(ROOM_KEY);
}

export function clearSavedRoomId(): void {
  localStorage.removeItem(ROOM_KEY);
}
