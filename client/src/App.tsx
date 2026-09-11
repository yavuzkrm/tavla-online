import React, { useEffect, useRef } from 'react';
import { clearSavedRoomId, getOrCreatePlayerId, getSavedRoomId, saveRoomId, socket } from './socket';
import { useAppStore } from './store';
import { HomeScreen } from './components/HomeScreen';
import { WaitingScreen } from './components/WaitingScreen';
import { MatchLengthPicker } from './components/MatchLengthPicker';
import { Board } from './components/Board';
import { PlayerCard } from './components/PlayerCard';
import { ControlBar } from './components/ControlBar';
import { GameOverBanner } from './components/GameOverBanner';
import { MatchState, StateUpdatePayload } from './types';
import { playBearOffSound, playDiceSound, playHitSound, playMoveSound, playWinSound } from './sound';

export function App() {
  const store = useAppStore();
  const prevMatchRef = useRef<MatchState | null>(null);

  // Oyun state'i her değiştiğinde (zar atıldı / hamle yapıldı / vuruldu / pul
  // çıkarıldı / oyun kazanıldı) uygun sesi çal. Her iki oyuncu da aynı
  // state_update'i aldığı için ses her iki tarafta da doğal şekilde duyulur.
  useEffect(() => {
    const prev = prevMatchRef.current;
    const curr = store.match;
    if (curr && curr !== prev) {
      if (curr.game.dice && (!prev || !prev.game.dice)) {
        playDiceSound();
      } else if (prev && curr.game.movesThisTurn.length > prev.game.movesThisTurn.length) {
        const prevBar = prev.game.bar.white + prev.game.bar.black;
        const currBar = curr.game.bar.white + curr.game.bar.black;
        const prevOff = prev.game.borneOff.white + prev.game.borneOff.black;
        const currOff = curr.game.borneOff.white + curr.game.borneOff.black;
        if (currBar > prevBar) playHitSound();
        else if (currOff > prevOff) playBearOffSound();
        else playMoveSound();
      }
      if (curr.lastGameResult && curr.lastGameResult.gameIndex !== prev?.lastGameResult?.gameIndex) {
        playWinSound();
      }
    }
    prevMatchRef.current = curr;
  }, [store.match]);

  useEffect(() => {
    const playerId = getOrCreatePlayerId();
    store.setPlayerId(playerId);

    // Kaydedilmiş bir oda varsa (sayfa yenilendi VEYA bağlantı bir an koptu
    // ve Socket.IO otomatik yeniden bağlandı) otomatik olarak o odaya geri
    // katıl. Sunucu, aynı playerId ile gelen bir bağlantıyı zaten var olan
    // oyuncu koltuğuna oturtuyor (roomManager.joinRoom).
    function tryAutoRejoin() {
      const savedRoomId = getSavedRoomId();
      if (savedRoomId) {
        socket.emit('rejoin_room', { roomId: savedRoomId, playerId, name: store.playerName });
      }
    }
    if (socket.connected) tryAutoRejoin();
    socket.on('connect', tryAutoRejoin);

    socket.on('room_created', ({ roomId, color }: { roomId: string; color: 'white' | 'black' }) => {
      store.setRoomJoined(roomId, color);
      store.setScreen('waiting');
      saveRoomId(roomId);
    });

    socket.on('room_joined', ({ roomId, color }: { roomId: string; color: 'white' | 'black' }) => {
      store.setRoomJoined(roomId, color);
      saveRoomId(roomId);
    });

    socket.on('join_error', ({ message }: { message: string }) => {
      store.setError(message);
      setTimeout(() => store.setError(null), 4000);
      // Kayıtlı oda artık geçersizse (silinmiş/süresi dolmuş) kullanıcıyı
      // sonsuza kadar o odaya bağlanmaya çalışan bir döngüde bırakmayalım.
      clearSavedRoomId();
    });

    socket.on('room_ready', ({ players, hostPlayerId }: any) => {
      store.setRoomReady(players, hostPlayerId);
    });

    socket.on('match_started', () => {
      store.setScreen('game');
    });

    socket.on('state_update', (payload: StateUpdatePayload) => {
      store.applyStateUpdate(payload);
    });

    socket.on('illegal_move', () => {
      store.setNotice('Geçersiz hamle.');
      setTimeout(() => store.setNotice(null), 1500);
    });

    socket.on('chat_message', (m: any) => {
      store.pushChat(m);
    });

    socket.on('emoji_reaction', ({ color, emoji }: { color: 'white' | 'black'; emoji: string }) => {
      store.triggerEmojiReaction(color, emoji);
    });

    socket.on('opponent_disconnected', () => {
      store.setOpponentDisconnected(true);
    });

    socket.on('opponent_reconnected', () => {
      store.setOpponentDisconnected(false);
    });

    socket.on('room_closed', ({ reason }: { reason: string }) => {
      store.setError(reason);
      store.reset();
      clearSavedRoomId();
    });

    socket.on('rematch_offer', () => {
      store.setNotice('Rakip tekrar oynamak istiyor. Kabul etmek için "Tekrar Oyna" ekranındaki butona basın.');
    });

    socket.on('rematch_accepted', ({ hostPlayerId }: { hostPlayerId: string }) => {
      store.setScreen('select_length');
    });

    return () => {
      socket.off('connect', tryAutoRejoin);
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('join_error');
      socket.off('room_ready');
      socket.off('match_started');
      socket.off('state_update');
      socket.off('illegal_move');
      socket.off('chat_message');
      socket.off('emoji_reaction');
      socket.off('opponent_disconnected');
      socket.off('opponent_reconnected');
      socket.off('room_closed');
      socket.off('rematch_offer');
      socket.off('rematch_accepted');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (store.screen === 'home') return <HomeScreen />;
  if (store.screen === 'waiting') return <WaitingScreen />;
  if (store.screen === 'select_length') return <MatchLengthPicker />;

  return (
    <div className="game-screen">
      <div className="top-bar">
        <div className="menu-icon">☰</div>
        <div className="top-title">Tavla</div>
        <div className="match-length-badge">{store.match?.matchLength} Puan Maçı</div>
      </div>

      <div className="player-cards-row">
        <PlayerCard color={store.myColor ?? 'white'} align="left" />
        <PlayerCard color={store.myColor === 'white' ? 'black' : 'white'} align="right" />
      </div>

      <div className="alerts-area">
        {store.opponentDisconnected && <div className="reconnect-banner">Rakip bağlantısı koptu, yeniden bağlanması bekleniyor…</div>}
        {store.notice && <div className="notice-banner">{store.notice}</div>}
        {store.match?.game.noMovesNotice && <div className="notice-banner">Hamle yok, sıra rakibe geçti.</div>}
      </div>

      {store.emojiReaction && (
        <div key={store.emojiReaction.key} className={`emoji-float emoji-float-${store.emojiReaction.color}`}>
          {store.emojiReaction.emoji}
        </div>
      )}

      {store.chatPreview && !store.chatOpen && (
        <div key={store.chatPreview.key} className="chat-preview-toast">
          <b>{store.chatPreview.name}:</b> {store.chatPreview.text}
        </div>
      )}

      <Board />
      <ControlBar />
      <GameOverBanner />
    </div>
  );
}
