import React, { useEffect } from 'react';
import { getOrCreatePlayerId, socket } from './socket';
import { useAppStore } from './store';
import { HomeScreen } from './components/HomeScreen';
import { WaitingScreen } from './components/WaitingScreen';
import { MatchLengthPicker } from './components/MatchLengthPicker';
import { Board } from './components/Board';
import { PlayerCard } from './components/PlayerCard';
import { ControlBar } from './components/ControlBar';
import { GameOverBanner } from './components/GameOverBanner';
import { StateUpdatePayload } from './types';

export function App() {
  const store = useAppStore();

  useEffect(() => {
    const playerId = getOrCreatePlayerId();
    store.setPlayerId(playerId);

    socket.on('room_created', ({ roomId, color }: { roomId: string; color: 'white' | 'black' }) => {
      store.setRoomJoined(roomId, color);
      store.setScreen('waiting');
    });

    socket.on('room_joined', ({ roomId, color }: { roomId: string; color: 'white' | 'black' }) => {
      store.setRoomJoined(roomId, color);
    });

    socket.on('join_error', ({ message }: { message: string }) => {
      store.setError(message);
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

    socket.on('opponent_disconnected', () => {
      store.setOpponentDisconnected(true);
    });

    socket.on('opponent_reconnected', () => {
      store.setOpponentDisconnected(false);
    });

    socket.on('room_closed', ({ reason }: { reason: string }) => {
      store.setError(reason);
      store.reset();
    });

    socket.on('rematch_offer', () => {
      store.setNotice('Rakip tekrar oynamak istiyor. Kabul etmek için "Tekrar Oyna" ekranındaki butona basın.');
    });

    socket.on('rematch_accepted', ({ hostPlayerId }: { hostPlayerId: string }) => {
      store.setScreen('select_length');
    });

    // Sayfa yeniden açıldıysa ve önceden bir odaya katılmışsa, otomatik yeniden bağlanmayı
    // tetiklemek istemcinin sorumluluğundadır (roomId + playerId localStorage'da tutulabilir).
    // Bu iskelet sürümde basitlik için otomatik rejoin tetiklenmez; kullanıcı ana ekrandan devam eder.

    return () => {
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('join_error');
      socket.off('room_ready');
      socket.off('match_started');
      socket.off('state_update');
      socket.off('illegal_move');
      socket.off('chat_message');
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
        <PlayerCard color="white" align="left" />
        <PlayerCard color="black" align="right" />
      </div>

      {store.opponentDisconnected && <div className="reconnect-banner">Rakip bağlantısı koptu, yeniden bağlanması bekleniyor…</div>}
      {store.notice && <div className="notice-banner">{store.notice}</div>}
      {store.match?.game.noMovesNotice && <div className="notice-banner">Hamle yok, sıra rakibe geçti.</div>}

      <Board />
      <ControlBar />
      <GameOverBanner />
    </div>
  );
}
