/** Player information */
export interface Player {
  id: string;           // Socket ID
  name: string;
  isHost: boolean;
  isEliminated: boolean;
  isSpectator: boolean;
  avatar: string;       // Character sprite used as avatar
  score: number;
  turnOrder: number;
}

/** Room state machine */
export type RoomState = 'waiting' | 'countdown' | 'playing' | 'finished';

/** Room information */
export interface Room {
  code: string;
  hostId: string;
  state: RoomState;
  players: Player[];
  maxPlayers: number;
  minPlayers: number;
  settings: GameSettings;
}

/** Configurable game settings */
export interface GameSettings {
  turnTimeSeconds: number;
  stabilityDelayMs: number;
  maxPlayers: number;
  minPlayers: number;
  platformWidth: number;
  platformY: number;
}

/** Full game state broadcast to clients */
export interface GameState {
  roomCode: string;
  turnNumber: number;
  currentPlayerId: string | null;
  nextPlayerId: string | null;
  turnOrder: string[];  // Player IDs in turn order
  activePlayers: string[];
  eliminatedPlayers: string[];
  currentCharacterId: string | null;
  droppedCharacters: DroppedCharacter[];
  phase: GamePhase;
  turnTimeRemaining: number;
  winnerId: string | null;
}

/** Phases within a single turn */
export type GamePhase = 
  | 'waiting'       // Waiting for game to start
  | 'placing'       // Current player is positioning character
  | 'dropping'      // Character has been released
  | 'stabilizing'   // Waiting for physics to settle
  | 'evaluating'    // Checking for eliminations
  | 'transitioning' // Moving to next turn
  | 'gameover';     // Game finished

/** Record of a dropped character for state sync */
export interface DroppedCharacter {
  characterId: string;
  playerId: string;
  dropX: number;
  dropAngle: number;
  turnNumber: number;
  x?: number;
  y?: number;
  angle?: number;
}

/** Drop result from server validation */
export interface DropResult {
  success: boolean;
  eliminated: boolean;
  reason?: string;
}
