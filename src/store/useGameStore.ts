import { create } from 'zustand';

export interface GamePlayer {
  id: string;
  nickname: string;
  score: number;
  status: 'ready' | 'playing' | 'disconnected';
}

export interface GameStateData {
  status: 'waiting' | 'starting' | 'playing' | 'finished';
  players: Record<string, GamePlayer>;
  // This could be extended for specific game logic (e.g. board state for chess)
  state: any; 
  winnerId: string | null;
}

export interface GameStoreState {
  roomId: string | null;
  gameType: string | null;
  gameState: GameStateData | null;
  
  // Actions
  setGame: (roomId: string, gameType: string, initialState: GameStateData) => void;
  updateGameState: (newState: Partial<GameStateData>) => void;
  updatePlayer: (playerId: string, update: Partial<GamePlayer>) => void;
  endGame: (winnerId?: string) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  roomId: null,
  gameType: null,
  gameState: null,
  
  setGame: (roomId, gameType, initialState) => set({
    roomId,
    gameType,
    gameState: initialState,
  }),
  
  updateGameState: (newState) => set((state) => {
    if (!state.gameState) return state;
    return {
      gameState: {
        ...state.gameState,
        ...newState,
      }
    };
  }),
  
  updatePlayer: (playerId, update) => set((state) => {
    if (!state.gameState) return state;
    
    const players = { ...state.gameState.players };
    if (players[playerId]) {
      players[playerId] = { ...players[playerId], ...update };
    }
    
    return {
      gameState: {
        ...state.gameState,
        players,
      }
    };
  }),
  
  endGame: (winnerId = null) => set((state) => {
    if (!state.gameState) return state;
    return {
      gameState: {
        ...state.gameState,
        status: 'finished',
        winnerId,
      }
    };
  }),
  
  clearGame: () => set({
    roomId: null,
    gameType: null,
    gameState: null,
  }),
}));
