import React, { useState } from 'react';
import { socket } from '../socket';
import { useAppStore } from '../store';
import { MatchLength } from '../types';
import { playClickSound } from '../sound';

const MIN_LENGTH = 3;
const MAX_LENGTH = 25;

export function MatchLengthPicker() {
  const { roomId, playerId, hostPlayerId } = useAppStore();
  const isHost = hostPlayerId === playerId;
  const [length, setLength] = useState(3);

  const step = (delta: number) => {
    setLength((prev) => {
      const next = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, prev + delta));
      if (next !== prev) playClickSound();
      return next;
    });
  };

  const start = () => {
    if (!roomId) return;
    socket.emit('select_match_length', { roomId, playerId, length: length as MatchLength });
  };

  return (
    <div className="screen match-length-screen">
      {isHost ? (
        <>
          <h2>Maç Uzunluğunu Seç</h2>
          <div className="length-stepper">
            <button
              className="stepper-btn"
              onClick={() => step(-2)}
              disabled={length <= MIN_LENGTH}
              aria-label="Azalt"
            >
              −
            </button>
            <div className="length-value">
              <span className="length-number">{length}</span>
              <span className="length-label">Puan</span>
            </div>
            <button
              className="stepper-btn"
              onClick={() => step(2)}
              disabled={length >= MAX_LENGTH}
              aria-label="Artır"
            >
              +
            </button>
          </div>
          <div className="length-hint">
            {MIN_LENGTH} ile {MAX_LENGTH} arasında, tek sayılarla ayarlanır.
          </div>
          <button className="btn btn-primary" onClick={start}>
            Maçı Başlat
          </button>
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
