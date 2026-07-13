# Ano — Turn-Based Multiplayer Games Hub

Ano is a unified web application and turn-based multiplayer game framework. It provides reusable components for voice chat channels, real-time lobbies, notification systems, friend invites, room chat, and persistent match statistics.

---

## 🚀 Getting Started

### 1. Requirements
*   **Node.js**: v18 or later
*   **Database**: PostgreSQL (Prisma datasource)

### 2. Setup Dependencies
Install dependencies in the root directory:
```bash
npm install
```

### 3. Database Migration
Ensure your database environment variables are set in `.env`, then run:
```bash
npx prisma generate
npx prisma db push
```

### 4. Running the Application
The workspace is split into two active processes:

#### Client (Next.js Dashboard)
Starts the Next.js dev server on port `3000`:
```bash
npm run dev
```

#### Server (Socket.IO Gateway)
Starts the backend Socket.IO authoritative engine server on port `3001`:
```bash
npm run server
```

---

## 🎮 Game Library & Rules

Ano features a registry of classic strategy and puzzle games.

### 💥 Color Wars (Chain Reaction)
A strategy game where players compete to capture the board by strategically placing energy and triggering cascading explosions.
*   **First Turn**: Players can place one initial orb on any empty cell. The orb count immediately starts at **3** and claims the cell.
*   **Subsequent Turns**: Players can only select cells they already own, incrementing the orb count by 1.
*   **Explosion Capacities**:
    *   **Corners**: Maximum = 2. Explodes immediately at 2.
    *   **Edges**: Maximum = 3. Explodes immediately at 3.
    *   **Center**: Maximum = 4. Explodes immediately at 4.
*   **Cascading capturing**: When a cell explodes, it clears to empty (`0`) and distributes `1` orb to each orthogonal neighbor (up, down, left, right), converting their ownership. If any neighbor reaches capacity, it explodes in a chain reaction.
*   **Elimination**: Players are eliminated (becoming spectators) if they have completed their first turn and own 0 cells.

### 🎲 Yatzy
A classic 5-dice rolling game where players roll to score combinations across 15 categories.
*   **Rolls**: Up to 3 rolls per turn. Players can lock/hold specific dice between rolls.
*   **Scoring**: Categories must be filled sequentially (Ones through Sixes, Bonus, Pairs, Three/Four of a Kind, Straights, Full House, Chance, and Yatzy).
*   **Victory**: The player with the highest total score after 15 rounds wins.

### ✏️ Dots and Boxes
A strategic grid connection game where players take turns drawing lines between dots.
*   **Turns**: Drawing a line that completes a 1x1 box claims that box (+1 score) and grants the player an immediate extra turn.
*   **Victory**: The player who claims the majority of boxes on the grid wins.

### 🃏 Bluff (Liar's Dice)
A turn-based social deduction dice game where players bid on the total frequency of face values among all players.
*   **Bidding**: Each player makes a bid claiming there are at least *N* dice of face *V* in play. Bids must increase in either quantity or face value.
*   **Challenges**: A player can challenge the previous bid by calling "Bluff". All dice are revealed. If the bid is correct, the challenger loses a die; otherwise, the bidder loses a die.

### 🧠 Memory Match
A classic turn-based memory card matching game.
*   **Matching**: Players flip 2 cards. If they match, the player scores a point and takes another turn.
*   **Victory**: The player with the most matches when all cards are cleared wins.

---

## 🛠️ File Structure

```
├── prisma/                 # Prisma database schema configuration
├── server/
│   ├── games/              # Authoritative game engines and sockets
│   │   ├── color-wars/     # authorative Color Wars cascade engine
│   │   ├── yatzy/          # authorative Yatzy logic
│   │   ├── dots-and-boxes/
│   │   ├── memory-match/
│   │   ├── bluff/
│   │   ├── socket/         # Socket.IO event registrations
│   │   ├── lobby/          # Room lobby structures
│   │   └── services/       # Game state database persistence
│   ├── index.js            # Express & Socket.IO server startup
├── src/
│   ├── app/                # Next.js App router (pages, layouts)
│   ├── components/         # Chat, Voice, Layout elements
│   ├── store/              # Zustand state stores (websockets connection hooks)
│   └── lib/                # Config, API configurations
```
