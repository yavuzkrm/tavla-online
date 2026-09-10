import React from 'react';
import { socket } from '../socket';
import { useAppStore } from '../store';
import { PlayerColor } from '../types';

// Göreceli (1-24) -> mutlak (0-23) dönüşümü (client tarafında sadece görsel amaçlı, kural motoru sunucuda).
function toAbsoluteIndex(rel: number, color: PlayerColor): number {
  return color === 'white' ? rel - 1 : 24 - rel;
}

const TOP_LEFT = [13, 14, 15, 16, 17, 18];
const TOP_RIGHT = [19, 20, 21, 22, 23, 24];
const BOTTOM_LEFT = [12, 11, 10, 9, 8, 7];
const BOTTOM_RIGHT = [6, 5, 4, 3, 2, 1];

function Checker({ color, highlight }: { color: PlayerColor; highlight?: boolean }) {
  return <div className={`checker checker-${color} ${highlight ? 'checker-selected' : ''}`} />;
}

function Triangle({
  rel,
  viewColor,
  index,
  onClick,
  isSelected,
  isDestination,
}: {
  rel: number;
  viewColor: PlayerColor;
  index: number;
  onClick: (abs: number) => void;
  isSelected: boolean;
  isDestination: boolean;
}) {
  const { match } = useAppStore();
  const abs = toAbsoluteIndex(rel, viewColor);
  const point = match!.game.points[abs];
  const shade = index % 2 === 0 ? 'triangle-light' : 'triangle-dark';
  const count = point.count;
  const stackColor = point.color;

  return (
    <div className={`point ${shade} ${isDestination ? 'point-destination' : ''}`} onClick={() => onClick(abs)}>
      <div className="triangle-shape" />
      <div className="checker-stack">
        {stackColor &&
          Array.from({ length: Math.min(count, 5) }).map((_, i) => (
            <Checker key={i} color={stackColor} highlight={isSelected && i === Math.min(count, 5) - 1} />
          ))}
        {count > 5 && <div className="checker-overflow">+{count - 5}</div>}
      </div>
    </div>
  );
}

export function Board() {
  const { match, myColor, legalMoves, selectedPoint, selectPoint, playerId, roomId } = useAppStore();
  if (!match || !myColor) return null;
  const game = match.game;
  const isMyTurn = game.turn === myColor && !game.gameOver;
  const opponentColor: PlayerColor = myColor === 'white' ? 'black' : 'white';

  const mySources = new Set(legalMoves.filter((m) => m.color === myColor).map((m) => m.from));
  const destinationsFromSelected = legalMoves.filter((m) => m.color === myColor && m.from === selectedPoint);

  function relOf(abs: number): number {
    return myColor === 'white' ? abs + 1 : 24 - abs;
  }

  function trySelectOrMove(abs: number) {
    if (!isMyTurn || !game.dice) return;
    const rel = relOf(abs);

    // Zaten bir kaynak seçiliyse ve bu nokta bir hedefse -> hamleyi gönder.
    if (selectedPoint !== null) {
      const move = destinationsFromSelected.find((m) => m.to === abs);
      if (move) {
        socket.emit('request_move', { roomId, playerId, move: { from: move.from, to: move.to, die: move.die } });
        selectPoint(null);
        return;
      }
    }

    // Bar'da pul varken sadece bar seçilebilir.
    if (game.bar[myColor] > 0) {
      if (mySources.has(-1)) selectPoint(-1);
      return;
    }

    if (mySources.has(abs)) {
      selectPoint(selectedPoint === abs ? null : abs);
    } else {
      selectPoint(null);
    }
  }

  function rollDice() {
    socket.emit('roll_dice', { roomId, playerId });
  }

  function bearOff() {
    const move = destinationsFromSelected.find((m) => m.to === -2);
    if (move) {
      socket.emit('request_move', { roomId, playerId, move: { from: move.from, to: move.to, die: move.die } });
      selectPoint(null);
    }
  }

  function undoMove() {
    socket.emit('undo_move', { roomId, playerId });
    selectPoint(null);
  }

  // Bu turda en az bir hamle yapıldıysa ve hâlâ bizim sıramızdaysa geri alınabilir
  // ("son hamle yapılana kadar" — son hamleden sonra sıra otomatik rakibe geçtiği
  // için o an zaten isMyTurn false olur ve buton kendiliğinden kaybolur).
  const canUndo = isMyTurn && game.movesThisTurn.length > 0;

  const destAbsSet = new Set(destinationsFromSelected.map((m) => m.to));
  const canBearOff = destinationsFromSelected.some((m) => m.to === -2);

  const renderRow = (relList: number[], startIndex: number) => (
    <div className="board-row">
      {relList.map((rel, i) => (
        <Triangle
          key={rel}
          rel={rel}
          viewColor={myColor}
          index={startIndex + i}
          onClick={trySelectOrMove}
          isSelected={selectedPoint === toAbsoluteIndex(rel, myColor)}
          isDestination={destAbsSet.has(toAbsoluteIndex(rel, myColor))}
        />
      ))}
    </div>
  );

  return (
    <div className="board-wrapper">
      <div className="board-frame">
        <div className="board-half">
          {renderRow(TOP_LEFT, 0)}
          {renderRow(BOTTOM_LEFT, 0)}
        </div>

        <div className="board-bar">
          <div className="bar-section bar-opponent">
            {Array.from({ length: match.game.bar[opponentColor] }).map((_, i) => (
              <Checker key={i} color={opponentColor} />
            ))}
          </div>
          <DiceInBar />
          <div className="bar-section bar-mine">
            {Array.from({ length: match.game.bar[myColor] }).map((_, i) => (
              <div key={i} onClick={() => selectPoint(-1)}>
                <Checker color={myColor} highlight={selectedPoint === -1} />
              </div>
            ))}
          </div>
        </div>

        <div className="board-half">
          {renderRow(TOP_RIGHT, 6)}
          {renderRow(BOTTOM_RIGHT, 6)}
        </div>
      </div>

      <div className="board-footer">
        <div className="pip-box">{useAppStore.getState().pip[myColor]}</div>

        {isMyTurn && !game.dice && (
          <button className="btn btn-primary roll-btn" onClick={rollDice}>
            Zar At
          </button>
        )}
        {isMyTurn && canBearOff && (
          <button className="btn btn-secondary" onClick={bearOff}>
            Pul Çıkar
          </button>
        )}
        {canUndo && (
          <button className="btn btn-secondary" onClick={undoMove}>
            ↩ Geri Al
          </button>
        )}

        <div className="pip-box">{useAppStore.getState().pip[opponentColor]}</div>
      </div>
    </div>
  );
}

function DiceInBar() {
  const { match, myColor } = useAppStore();
  const dice = match?.game.dice;
  if (!dice || dice.length === 0) return <div className="dice-area" />;
  return (
    <div className="dice-area">
      {dice.map((d, i) => (
        <div key={i} className={`die die-${myColor}`}>
          {d}
        </div>
      ))}
    </div>
  );
}
