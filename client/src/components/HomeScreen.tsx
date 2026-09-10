import React, { useState } from 'react';
import { socket } from '../socket';
import { useAppStore } from '../store';

export function HomeScreen() {
  const { playerName, setPlayerName, playerId, errorMessage, setError } = useAppStore();
  const [mode, setMode] = useState<'menu' | 'join'>('menu');
  const [joinCode, setJoinCode] = useState('');

  const createRoom = () => {
    setError(null);
    socket.emit('create_room', { playerId, name: playerName || 'Oyuncu 1' });
  };

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    setError(null);
    socket.emit('join_room', { roomId: code, playerId, name: playerName || 'Oyuncu 2' });
  };

  return (
    <div className="screen home-screen">
      <h1 className="title">Tavla</h1>
      {errorMessage && <div className="error-banner">{errorMessage}</div>}
      <input
        className="text-input"
        placeholder="İsminiz"
        value={playerName}
        maxLength={20}
        onChange={(e) => setPlayerName(e.target.value)}
      />

      {mode === 'menu' && (
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={createRoom}>
            Oda Kur
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setError(null);
              setMode('join');
            }}
          >
            Odaya Katıl
          </button>
        </div>
      )}

      {mode === 'join' && (
        <div className="join-form">
          <input
            className="text-input code-input"
            placeholder="ODA KODU"
            value={joinCode}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            onChange={(e) => {
              setError(null);
              setJoinCode(e.target.value);
            }}
          />
          <div className="menu-buttons">
            <button className="btn btn-primary" onClick={joinRoom}>
              Katıl
            </button>
            <button className="btn btn-secondary" onClick={() => setMode('menu')}>
              Geri
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
