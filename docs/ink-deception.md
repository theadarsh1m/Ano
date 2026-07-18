# Ink & Deception — Authoritative Multiplayer Social Deduction Game

Ink & Deception is a fast-paced, turn-based social deduction drawing game integrated into the ANO framework. It is modeled on modern social deduction dynamics (similar to *A Fake Artist Goes To New York*), isolated completely from existing games like Scribble.

---

## 🎮 Game Overview & Rules

The game is played in groups of **3 to 10 players**. One player is secretly selected by the server as the **Impostor** (Fake Artist), while the rest are **Artists**.

1. **Word Assignment**:
   - **Artists** receive both the **Category** and the **Secret Word** (e.g., Category: `ANIMALS`, Secret Word: `DOG`).
   - **The Impostor** receives only the **Category** and a warning indicating they are the Impostor (`???`).
2. **Drawing Phase**:
   - Players take turns drawing on a shared canvas.
   - **Rule**: Each player gets exactly two turns, and each turn allows drawing exactly **one continuous stroke** (releasing the mouse/finger locks the stroke and ends the turn).
   - The Impostor must try to blend in by drawing something relevant to the category without knowing the exact secret word.
3. **Discussion Phase**:
   - Once all strokes are completed, a 10-second discussion timer starts. Players discuss who they think the Impostor is.
4. **Voting Phase**:
   - Players cast a vote simultaneously by tapping a player card. Voting is single-click and locks immediately.
5. **Accusation Reveal**:
   - Votes are revealed sequentially with animations. The player with the most votes is accused.
   - If a tie occurs and the Impostor is in the tie, the Impostor is accused.
6. **Impostor Guess Phase**:
   - If the painters accused the correct Impostor, the Impostor is caught but has **one final chance to win** by guessing the secret word within 8 seconds.
   - If they guess correctly, the Impostor wins.
   - If they guess incorrectly or run out of time, the Artists win.
   - If the painters accused the wrong player, the Impostor wins immediately.

---

## 🏗️ Architecture & Game Isolation

Ink & Deception is fully decoupled from all other games in the ANO repository to maintain clean modularity:

```
├── server/
│   ├── games/
│   │   ├── ink-deception/
│   │   │   ├── InkDeceptionEngine.js  # Authoritative round state machine
│   │   │   ├── WordService.js         # Dictionary manager & loader
│   │   │   └── words/                 # JSON category word packs
│   │   └── socket/
│   │       └── GameSocket.js          # Socket connection & action routing
└── src/
    ├── app/
    │   └── dashboard/games/
    │       └── ink-deception/
    │           └── page.tsx           # Main game portal page
    ├── components/games/
    │   └── ink-deception/             # Isolated React UI components
    │       ├── InkCanvas.tsx          # Optimistic, flicker-free canvas
    │       ├── RoleRevealModal.tsx    # Card-flipping role reveal modal
    │       ├── VotingDashboard.tsx    # One-click voting grid with arrows
    │       ├── GuessOverlay.tsx       # Impostor word guess modal
    │       ├── ReplayTimeline.tsx     # Clean canvas stroke history viewer
    │       ├── SoundService.ts        # Modular Web Audio sound effects
    │       ├── PlayerGrid.tsx         # Player scores, status, and turn indicator
    │       └── GuessChat.tsx          # Shared room communications
    └── store/
        └── useInkDeceptionStore.ts    # Zustand client store and event listeners
```

---

## 📡 Socket API Events

The game transitions automatically. Sockets bridge player inputs into the authoritative engine:

### Client to Server Events
- `lobby_join` | Payload: `{ gameId, userId, nickname }`
- `lobby_ready` | Payload: `{ gameId, userId, isReady }`
- `game_start` | Payload: `{ gameId, hostId }`
- `game_action` | Wrapper containing:
  - `role_seen`: Sent when player acknowledges their card.
  - `draw_stroke` | Data: `{ points: [{ x, y, p }] }`
  - `vote` | Data: `{ targetUserId }`
  - `guess_word` | Data: `{ guess }`
  - `next_round`
  - `play_again`

### Server to Client Broadcasts
- `lobby_state`: Contains lobby player readiness, host name, and settings.
- `game_state`: Authoritative sync of engine variables:
  - `turnState`: `'LOBBY' | 'ROLE_REVEAL' | 'DRAWING' | 'DISCUSSION' | 'VOTING' | 'REVEAL' | 'FAKE_GUESS' | 'ROUND_END' | 'GAME_END'`
  - `strokes`: Shared list of coordinate segments.
  - `scores`: Map of accumulated player scores.
  - `timeLeft`: Authoritative phase timer.

---

## 🎨 Design Systems & Audio

- **Aesthetics**: Sleek dark space-cadet backgrounds with parchment-paper cream canvas, neon pink and cyber-blue accents.
- **Audio Experience**: Powered by browser-native `AudioContext` synthesizers (wood clicks, analog card flips, stroke textures modulated by mouse velocity, ticking clocks, and victory fanfares).

---

## 📂 Word Packs & Dictionaries

Easy-to-draw word lists are defined in `server/games/ink-deception/WordService.js`. Dictionaries are auto-created under `words/` upon server startup if they do not exist.

### Adding New Categories
To add a new word pack:
1. Open [WordService.js](file:///server/games/ink-deception/WordService.js).
2. Append a new array of simple words inside `createDefaultDictionaries(wordsDir)`'s `categories` object:
   ```javascript
   fruits: [
     "banana", "apple", "grape", "orange", "strawberry", "lemon", "cherry"
   ]
   ```
3. Restart the game server. The new category JSON will be generated automatically and made selectable in the lobby settings dropdown.
