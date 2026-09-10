import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import { useAppStore } from '../store';

export function GameOverBanner() {
  const { match, players, roomId, playerId } = useAppStore();
  const [showTransient, setShowTransient] = useState(false);

  useEffect(() => {
    if (match?.lastGameResult) {
      setShowTransient(true);
      const t = setTimeout(() => setShowTransient(false), 3000);
      return () => clearTimeout(t);
    }
  }, [match?.lastGameResult?.gameIndex]);

  if (!match) return null;

  const matchWinnerName = players.find((p) => p.color === match.matchWinner)?.name ?? '—';

  const requestRematch = () => {
    socket.emit('request_rematch', { roomId, playerId });
  };

  if (match.matchOver) {
    return (
      <div className="overlay">
        <div className="overlay-card">
          <h2>Maç Bitti</h2>
          <p>
            {matchWinnerName} kazandı! ({match.score.white} - {match.score.black})
          </p>
          <button className="btn btn-primary" onClick={requestRematch}>
            Tekrar Oyna
          </button>
        </div>
      </div>
    );
  }

  if (showTransient && match.lastGameResult) {
    const winnerName = players.find((p) => p.color === match.lastGameResult!.winner)?.name ?? '—';
    return (
      <div className="overlay overlay-transient">
        <div className="overlay-card">
          <h2>
            {winnerName} {match.lastGameResult.isMars ? 'MARS yaptı! 2 puan kazandı' : '1 puan kazandı'}
          </h2>
        </div>
      </div>
    );
  }

  return null;
}
