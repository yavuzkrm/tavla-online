# Tavla Online

A real-time web app for playing classic Turkish backgammon (*tavla*) with a friend in the browser. There are no accounts: one player creates a room and the other joins with a 6-character code.

> **Note:** This project was vibe coded with Claude (Anthropic) in Claude Code: I described what I wanted and the code was generated, not written line by line by hand. I verified the rules engine with tests and went through the architecture described below. The game's interface is in Turkish.

## Features

- Room codes for matchmaking (characters that are easy to confuse, like `0/O` and `1/I`, are left out)
- Matches to 3, 5, 7, 9 or 11 points, with gammons (*mars*) counted
- All the classic rules: hitting to the bar, entering from the bar, bearing off and doubles
- **Forced maximum play:** moves that don't use as many dice as possible are not allowed
- The turn passes automatically when there is no legal move
- Undo, chat, emoji reactions and rematch offers
- Rejoin the same game within 30 seconds if the connection drops, even after a page refresh
- Sound effects for dice, moves and hits, with a mute button in the top bar

## Architecture

```
server/   Node.js + TypeScript + Socket.IO   ->  all game logic runs here
client/   React + TypeScript + Vite + Zustand ->  rendering and user input only
```

The server enforces the rules. The client can only send a move from the `legalMoves` list the server sends, and the server checks every incoming move again, so a player can't cheat from the browser. Dice are rolled on the server with `crypto.randomInt`.

| File | Contents |
|---|---|
| `server/src/gameEngine.ts` | Rules engine made of pure functions: move generation, bar and bear-off rules, gammons, pip count |
| `server/src/gameEngine.test.ts` | Tests for the rules engine (22 tests, vitest) |
| `server/src/roomManager.ts` | Room code generation and in-memory room state |
| `server/src/index.ts` | Socket.IO events: rolling, moving, undo, chat, rematch, reconnecting |
| `client/src/components/Board.tsx` | Board and click-to-move interface |
| `client/src/sound.ts` | Sound effects (dice sound from a file, the rest generated with the Web Audio API) |

The forced maximum play rule was the trickiest part. `getMaxPlayableDiceSequence` searches all possible move sequences with DFS to find the longest one. `getLegalMovesNow` then allows only the first steps of those sequences.

## Running locally

Requires Node.js 18+.

```bash
# Server (http://localhost:4000)
cd server
npm install
npm run dev
npm test        # rules engine tests

# Client (http://localhost:5173), in a second terminal
cd client
npm install
npm run dev
```

By default the client connects to `http://localhost:4000`. To use a different server, create `client/.env`:

```
VITE_SERVER_URL=http://your-server:4000
```

To try it, open `localhost:5173` in two tabs, create a room in one and join with the code in the other.

## Limitations

- Pieces are moved by clicking, not by drag and drop.
- Rooms live in server memory, so restarting the server ends running games and resets scores.

## Deployment

Both folders include a `railway.toml` for Railway. The server runs with `npm run build && npm start`. The client's `npm run build` output (`dist/`) can go on any static host, with `VITE_SERVER_URL` set to the server's address.

## License

This project is licensed under the [MIT License](LICENSE).
