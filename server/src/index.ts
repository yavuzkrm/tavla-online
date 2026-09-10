import crypto from 'crypto';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import {
  applyMove,
  endTurn,
  getLegalMovesNow,
  getPipCount,
  hasNoPlayableMoves,
  isMoveCurrentlyLegal,
  rollTurn,
  startNewGame,
} from './gameEngine';
import {
  createRoom,
  deleteRoom,
  getAllRooms,
  getPlayerSlot,
  getOpponentSlot,
  getRoom,
  joinRoom,
  startMatch,
} from './roomManager';
import { MatchLength, Move, PlayerColor } from './types';

const PORT = Number(process.env.PORT) || 4000;
const RECONNECT_GRACE_MS = 30_000;

const httpServer = createServer((req, res) => {
  // Socket.IO kendi /socket.io/... yollarını kendi işler; burada sadece
  // düz bir HTTP GET (örn. biri sunucu adresini tarayıcıda açarsa) sonsuza
  // kadar "yükleniyor" görünmesin diye basit bir yanıt döndürüyoruz.
  if (req.url && req.url.startsWith('/socket.io')) return;
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Tavla sunucusu çalışıyor. Bu adres bir API/WebSocket sunucusudur — oyunu buradan değil, istemci (client) adresinden aç.');
});
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

// Sunucu tarafında kriptografik olarak güvenilir RNG (adil zar garantisi).
function randomIntSecure(minInclusive: number, maxInclusive: number): number {
  return crypto.randomInt(minInclusive, maxInclusive + 1);
}

function broadcastState(roomId: string) {
  const room = getRoom(roomId);
  if (!room || !room.match) return;
  const pip = {
    white: getPipCount(room.match.game, 'white'),
    black: getPipCount(room.match.game, 'black'),
  };
  const legalMoves = room.match.game.gameOver
    ? []
    : getLegalMovesNow(room.match.game, room.match.game.turn);
  io.to(roomId).emit('state_update', {
    match: room.match,
    pip,
    legalMoves,
    players: room.players.map((p) => ({ playerId: p.playerId, name: p.name, color: p.color, connected: p.connected })),
  });
}

io.on('connection', (socket: Socket) => {
  socket.on('create_room', ({ playerId, name }: { playerId: string; name: string }) => {
    const room = createRoom(playerId, name || 'Oyuncu 1', socket.id);
    socket.join(room.roomId);
    socket.emit('room_created', { roomId: room.roomId, color: 'white' });
  });

  socket.on('join_room', ({ roomId, playerId, name }: { roomId: string; playerId: string; name: string }) => {
    const result = joinRoom(roomId, playerId, name || 'Oyuncu 2', socket.id);
    if ('error' in result) {
      socket.emit('join_error', { message: result.error });
      return;
    }
    const room = result;
    socket.join(room.roomId);
    const slot = getPlayerSlot(room, playerId)!;
    socket.emit('room_joined', { roomId: room.roomId, color: slot.color });

    if (room.players.length === 2) {
      io.to(room.roomId).emit('room_ready', {
        players: room.players.map((p) => ({ playerId: p.playerId, name: p.name, color: p.color })),
        hostPlayerId: room.hostPlayerId,
      });
      if (room.match) broadcastState(room.roomId);
    }
  });

  socket.on(
    'select_match_length',
    ({ roomId, playerId, length }: { roomId: string; playerId: string; length: MatchLength }) => {
      const room = getRoom(roomId);
      if (!room) return;
      if (room.hostPlayerId !== playerId) return; // sadece host seçebilir
      if (![3, 5, 7, 9, 11].includes(length)) return;
      if (room.players.length < 2) return;
      startMatch(room, length, randomIntSecure);
      io.to(roomId).emit('match_started', { matchLength: length });
      broadcastState(roomId);
    }
  );

  socket.on('roll_dice', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = getRoom(roomId);
    if (!room || !room.match) return;
    const slot = getPlayerSlot(room, playerId);
    if (!slot) return;
    const game = room.match.game;
    if (game.gameOver) return;
    if (game.turn !== slot.color) return;
    if (game.dice !== null) return; // zaten atılmış

    game.dice = rollTurn(randomIntSecure);
    game.movesThisTurn = [];
    room.undoStack = []; // yeni tur başlıyor, önceki turdan kalan geri alma geçmişi geçersiz

    // Hiçbir zar oynanamıyorsa: tur otomatik ve tamamen pas geçilir, zar tekrar atılmaz.
    if (hasNoPlayableMoves(game, game.turn)) {
      room.match.game = endTurn(game);
    }
    broadcastState(roomId);
  });

  socket.on(
    'request_move',
    ({
      roomId,
      playerId,
      move,
    }: {
      roomId: string;
      playerId: string;
      move: { from: number; to: number; die: number };
    }) => {
      const room = getRoom(roomId);
      if (!room || !room.match) return;
      const slot = getPlayerSlot(room, playerId);
      if (!slot) return;
      const game = room.match.game;
      if (game.gameOver) return;
      if (game.turn !== slot.color) return;

      const candidate: Move = { color: slot.color, from: move.from, to: move.to, die: move.die };
      if (!isMoveCurrentlyLegal(game, candidate)) {
        socket.emit('illegal_move', { move });
        return;
      }

      // Hamleden ÖNCEKİ state'i geri alma yığınına koy (derin kopya — plain veri olduğu için JSON yeterli).
      room.undoStack.push(JSON.parse(JSON.stringify(game)));

      let nextGame = applyMove(game, candidate);

      if (!nextGame.gameOver) {
        // Bu oyuncu için oynanabilecek başka zar kalmadıysa turu bitir.
        if (getLegalMovesNow(nextGame, slot.color).length === 0) {
          nextGame = endTurn(nextGame);
        }
      } else {
        // Oyun bitti: mars kontrolü applyMove içinde yapıldı, puanı ekle.
        const winner = nextGame.winner as PlayerColor;
        const isMarsWin = nextGame.isMarsWin;
        const points = isMarsWin ? 2 : 1;
        room.match.score[winner] += points;
        room.match.lastGameResult = {
          winner,
          isMars: isMarsWin,
          gameIndex: (room.match.lastGameResult?.gameIndex ?? 0) + 1,
        };

        if (room.match.score[winner] >= room.match.matchLength) {
          room.match.matchOver = true;
          room.match.matchWinner = winner;
        } else {
          // Maç bitmedi: otomatik yeni oyun başlat.
          nextGame = startNewGame(randomIntSecure);
        }
      }

      room.match.game = nextGame;
      // Tur bittiyse (sıra rakibe geçtiyse) veya oyun/maç bittiyse geri alma artık geçerli değil.
      if (nextGame.gameOver || nextGame.turn !== slot.color) {
        room.undoStack = [];
      }
      broadcastState(roomId);
    }
  );

  socket.on('undo_move', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = getRoom(roomId);
    if (!room || !room.match) return;
    const slot = getPlayerSlot(room, playerId);
    if (!slot) return;
    const game = room.match.game;
    if (game.gameOver) return;
    if (game.turn !== slot.color) return; // sıra sende değilse geri alamazsın
    if (room.undoStack.length === 0) return; // bu turda henüz hamle yapılmadı, geri alınacak bir şey yok

    room.match.game = room.undoStack.pop()!;
    broadcastState(roomId);
  });

  socket.on('send_chat', ({ roomId, playerId, text }: { roomId: string; playerId: string; text: string }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const slot = getPlayerSlot(room, playerId);
    if (!slot) return;
    io.to(roomId).emit('chat_message', { name: slot.name, color: slot.color, text: String(text).slice(0, 300) });
  });

  socket.on('send_emoji', ({ roomId, playerId, emoji }: { roomId: string; playerId: string; emoji: string }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const slot = getPlayerSlot(room, playerId);
    if (!slot) return;
    io.to(roomId).emit('emoji_reaction', { color: slot.color, emoji });
  });

  socket.on('request_rematch', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = getRoom(roomId);
    if (!room || !room.match?.matchOver) return;
    const opponent = getOpponentSlot(room, playerId);
    room.rematchOffer = { fromPlayerId: playerId };
    if (opponent?.socketId) io.to(opponent.socketId).emit('rematch_offer', {});
  });

  socket.on('accept_rematch', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = getRoom(roomId);
    if (!room || !room.rematchOffer) return;
    room.match = null;
    room.rematchOffer = null;
    // Host'a yeniden maç uzunluğu seçtir.
    io.to(roomId).emit('rematch_accepted', { hostPlayerId: room.hostPlayerId });
  });

  socket.on('rejoin_room', ({ roomId, playerId, name }: { roomId: string; playerId: string; name: string }) => {
    const result = joinRoom(roomId, playerId, name, socket.id);
    if ('error' in result) {
      socket.emit('join_error', { message: result.error });
      return;
    }
    socket.join(roomId);
    const room = result;
    const slot = getPlayerSlot(room, playerId)!;
    socket.emit('room_joined', { roomId: room.roomId, color: slot.color });
    io.to(roomId).emit('opponent_reconnected', { playerId });
    if (room.match) broadcastState(roomId);
  });

  socket.on('disconnect', () => {
    handleDisconnect(socket.id);
  });
});

function handleDisconnect(socketId: string) {
  // Tüm odaları tarayıp bu socket'e ait oyuncuyu bul (in-memory store küçük ölçek için yeterli).
  for (const room of getAllRooms().values()) {
    const slot = room.players.find((p) => p.socketId === socketId);
    if (!slot) continue;
    slot.connected = false;
    slot.socketId = null;
    io.to(room.roomId).emit('opponent_disconnected', { playerId: slot.playerId, graceMs: RECONNECT_GRACE_MS });

    slot.disconnectTimer = setTimeout(() => {
      const stillGone = room.players.find((p) => p.playerId === slot.playerId);
      if (stillGone && !stillGone.connected) {
        io.to(room.roomId).emit('room_closed', { reason: 'Rakip bağlantısı zaman aşımına uğradı.' });
        deleteRoom(room.roomId);
      }
    }, RECONNECT_GRACE_MS);
  }
}

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Tavla sunucusu ${PORT} portunda çalışıyor.`);
});
