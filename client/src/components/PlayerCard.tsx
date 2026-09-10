import React from 'react';
import { useAppStore } from '../store';
import { PlayerColor } from '../types';

export function PlayerCard({ color, align }: { color: PlayerColor; align: 'left' | 'right' }) {
  const { players, match } = useAppStore();
  const player = players.find((p) => p.color === color);
  const isTurn = match?.game.turn === color && !match.game.gameOver;
  const score = match?.score[color] ?? 0;
  const justWonMars = match?.lastGameResult?.isMars && match.lastGameResult.winner === color;

  return (
    <div className={`player-card player-card-${align} ${isTurn ? 'player-card-active' : ''}`}>
      <div className="avatar" />
      <div className="player-info">
        <div className="player-name">{player?.name ?? '—'}</div>
        <div className="player-score">🏆 {score}</div>
      </div>
      {justWonMars && <div className="mars-badge">MARS!</div>}
    </div>
  );
}
