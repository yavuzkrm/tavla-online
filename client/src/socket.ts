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
