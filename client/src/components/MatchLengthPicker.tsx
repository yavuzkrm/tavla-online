import React from 'react';
import { socket } from '../socket';
import { useAppStore } from '../store';
import { MatchLength } from '../types';

const OPTIONS: MatchLength[] = [3, 5, 7, 9, 11];

export function MatchLengthPicker() {
  const { roomId, playerId, hostPlayerId } = useAppStore();
  const isHost = hostPlayerId === playerId;

  const choose = (length: MatchLength) => {
    if (!roomId) return;
    socket.emit('select_match_length', { roomId, playerId, length });
  };

  return (
    <div className="screen match-length-screen">
      {isHost ? (
        <>
          <h2>Maç Uzunluğunu Seç</h2>
          <div className="length-buttons">
            {OPTIONS.map((len) => (
              <button key={len} className="btn btn-length" onClick={() => choose(len)}>
                {len} Puan
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <h2>Rakip maç uzunluğunu seçiyor…</h2>
          <div className="spinner" />
        </>
      )}
    </div>
  );
}
