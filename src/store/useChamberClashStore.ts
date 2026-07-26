import { create } from 'zustand';
import { socketService } from '@/lib/socket';
import { useUserStore } from '@/store/useUserStore';

export interface ChamberClashPlayer {
  userId: string;
  nickname: string;
  isAlive: boolean;
  hp: number;
  inventory: string[];
  statusEffects: any[];
}

export interface ChamberClashState {
  gameId: string;
  gameType: string;
  status: string;
  players: ChamberClashPlayer[];
  currentTurnPlayerId: string;
  roundNumber: number;
  liveShells: number;
  blankShells: number;
  settings: any;
  winnerId: string | null;
  pendingItemAction?: {
    sourceItem: string;
    stolenItem: string;
    playerId: string;
    stage: string;
  };
  turnToken: string | null;
  turnStartedAt: number | null;
  turnDeadline: number | null;
  stateVersion: number;
}

export interface ActionLogEntry {
  id: string;
  text: string;
  icon: string;
  color: string;
}

interface ChamberClashStore {
  lobby: any | null;
  gameState: ChamberClashState | null;
  pendingGameState: ChamberClashState | null;
  eventQueue: any[];
  isAnimating: boolean;
  availableLobbies: any[];
  error: string | null;
  actionLog: ActionLogEntry[];
  revealedShell: string | null;
  burnerPhoneReveal: { displayShellNumber: number; shellType: string } | null;
  selectedTargetId: string | null;
  setSelectedTargetId: (targetId: string | null) => void;
  
  // Lobby Actions
  fetchLobbies: () => void;
  createLobby: (userId: string, nickname: string) => void;
  joinLobby: (gameId: string, userId: string, nickname: string) => void;
  leaveLobby: (gameId: string, userId: string) => void;
  toggleReady: (gameId: string, userId: string, isReady: boolean) => void;
  startGame: (gameId: string, hostId: string) => void;
  startPracticeGame: (userId: string, nickname: string) => void;
  start3PlayerPracticeGame: (userId: string, nickname: string) => void;
  start4PlayerPracticeGame: (userId: string, nickname: string) => void;
  
  // Game Actions
  shootTarget: (gameId: string, userId: string, targetId: string) => void;
  useItem: (gameId: string, userId: string, itemId: string, targetId?: string, stolenItemId?: string) => void;
  resolvePendingItem: (gameId: string, userId: string, targetId: string, stolenItemId?: string) => void;

  // Internal/Setup
  setupListeners: (gameId: string, userId: string) => () => void;
  clearState: () => void;
  
  // Animation Queue Management
  dequeueEvent: () => void;
  setAnimating: (animating: boolean) => void;
  addLogEntry: (text: string, icon: string, color: string) => void;
  setRevealedShell: (shell: string | null) => void;
  setBurnerPhoneReveal: (reveal: { displayShellNumber: number; shellType: string } | null) => void;
}

export const useChamberClashStore = create<ChamberClashStore>((set, get) => ({
  lobby: null,
  gameState: null,
  pendingGameState: null,
  eventQueue: [],
  isAnimating: false,
  availableLobbies: [],
  error: null,
  actionLog: [],
  revealedShell: null,
  burnerPhoneReveal: null,
  selectedTargetId: null,
  setSelectedTargetId: (targetId) => set({ selectedTargetId: targetId }),

  fetchLobbies: () => {
    const socket = socketService.getSocket();
    if (socket) socket.emit('lobbies_list');
  },
  
  createLobby: (userId, nickname) => {
    const socket = socketService.getSocket();
    if (socket) socket.emit('lobby_create', { gameType: 'CHAMBER_CLASH', userId, nickname });
  },
  
  joinLobby: (gameId, userId, nickname) => {
    const socket = socketService.getSocket();
    if (socket) socket.emit('lobby_join', { gameId, userId, nickname });
  },
  
  leaveLobby: (gameId, userId) => {
    const socket = socketService.getSocket();
    if (socket) socket.emit('lobby_leave', { gameId, userId });
    get().clearState();
  },
  
  toggleReady: (gameId, userId, isReady) => {
    const socket = socketService.getSocket();
    if (socket) socket.emit('lobby_ready', { gameId, userId, isReady });
  },
  
  startGame: (gameId, hostId) => {
    const socket = socketService.getSocket();
    if (socket) socket.emit('game_start', { gameId, hostId });
  },

  startPracticeGame: (userId, nickname) => {
    const resolvedId = userId || 'local-p1';
    const mockState: ChamberClashState = {
      gameId: 'practice-game',
      gameType: 'CHAMBER_CLASH',
      status: 'IN_ROUND',
      roundNumber: 1,
      currentTurnPlayerId: resolvedId,
      winnerId: null,
      players: [
        { userId: resolvedId, nickname: nickname || 'You', hp: 5, inventory: ["magnifier", "beer"], statusEffects: [], isAlive: true },
        { userId: 'opponent-dealer', nickname: 'Dealer', hp: 5, inventory: ["medkit", "inverter"], statusEffects: [], isAlive: true }
      ],
      liveShells: 3,
      blankShells: 3,
      pendingItemAction: undefined,
      settings: { startingHp: 5, turnTimer: 30, chamberSize: 6, maxInventory: 5, maxPlayers: 6, isPrivate: false },
      turnToken: 'practice-token',
      turnStartedAt: Date.now(),
      turnDeadline: Date.now() + 30000,
      stateVersion: 1
    };
    set({ gameState: mockState, pendingGameState: mockState, lobby: null });
  },

  start3PlayerPracticeGame: (userId, nickname) => {
    const resolvedId = userId || 'local-p1';
    const mockState: ChamberClashState = {
      gameId: 'practice-game-3p',
      gameType: 'CHAMBER_CLASH',
      status: 'IN_ROUND',
      roundNumber: 1,
      currentTurnPlayerId: resolvedId,
      winnerId: null,
      players: [
        { userId: resolvedId, nickname: nickname || 'You', hp: 5, inventory: ["magnifier", "beer"], statusEffects: [], isAlive: true },
        { userId: 'opponent-dealer-1', nickname: 'Dealer Left', hp: 5, inventory: ["handsaw", "handcuffs"], statusEffects: [], isAlive: true },
        { userId: 'opponent-dealer-2', nickname: 'Dealer Right', hp: 5, inventory: ["medkit", "inverter"], statusEffects: [], isAlive: true }
      ],
      liveShells: 3,
      blankShells: 3,
      pendingItemAction: undefined,
      settings: { startingHp: 5, turnTimer: 30, chamberSize: 6, maxInventory: 5, maxPlayers: 6, isPrivate: false },
      turnToken: 'practice-token-3p',
      turnStartedAt: Date.now(),
      turnDeadline: Date.now() + 30000,
      stateVersion: 1
    };
    set({ gameState: mockState, pendingGameState: mockState, lobby: null });
  },

  start4PlayerPracticeGame: (userId, nickname) => {
    const resolvedId = userId || 'local-p1';
    const mockState: ChamberClashState = {
      gameId: 'practice-game-4p',
      gameType: 'CHAMBER_CLASH',
      status: 'IN_ROUND',
      roundNumber: 1,
      currentTurnPlayerId: resolvedId,
      winnerId: null,
      players: [
        { userId: resolvedId, nickname: nickname || 'You', hp: 5, inventory: ["magnifier", "beer"], statusEffects: [], isAlive: true },
        { userId: 'opponent-dealer-1', nickname: 'Dealer Left', hp: 5, inventory: ["handsaw", "handcuffs"], statusEffects: [], isAlive: true },
        { userId: 'opponent-dealer-2', nickname: 'Dealer Far', hp: 5, inventory: ["medkit", "inverter"], statusEffects: [], isAlive: true },
        { userId: 'opponent-dealer-3', nickname: 'Dealer Right', hp: 5, inventory: ["burner_phone", "adrenaline"], statusEffects: [], isAlive: true }
      ],
      liveShells: 4,
      blankShells: 4,
      pendingItemAction: undefined,
      settings: { startingHp: 5, turnTimer: 30, chamberSize: 8, maxInventory: 5, maxPlayers: 6, isPrivate: false },
      turnToken: 'practice-token-4p',
      turnStartedAt: Date.now(),
      turnDeadline: Date.now() + 30000,
      stateVersion: 1
    };
    set({ gameState: mockState, pendingGameState: mockState, lobby: null });
  },

  shootTarget: (gameId, userId, targetId) => {
    const socket = socketService.getSocket();
    if (socket && socket.connected && !gameId.startsWith('practice-game')) {
      const turnToken = get().gameState?.turnToken;
      socket.emit('game_action', { gameId, userId, action: 'shoot_target', data: { targetId, turnToken } });
    }
  },

  useItem: (gameId, userId, itemId, targetId, stolenItemId) => {
    const socket = socketService.getSocket();
    if (socket && socket.connected && !gameId.startsWith('practice-game')) {
      const turnToken = get().gameState?.turnToken;
      socket.emit('game_action', { gameId, userId, action: 'use_item', data: { itemId, targetId, stolenItemId, turnToken } });
      return;
    }

    // Local Practice Mode item handling
    set((state) => {
      if (!state.gameState) return state;
      const currentPlayers = state.gameState.players.map(p => {
        if (p.userId !== userId) return p;
        const newInv = [...p.inventory];
        const idx = newInv.indexOf(itemId);
        if (idx > -1) newInv.splice(idx, 1);
        return { ...p, inventory: newInv };
      });

      let liveShells = state.gameState.liveShells;
      let blankShells = state.gameState.blankShells;
      const newEvents = [...state.eventQueue];

      if (itemId === 'inverter') {
        // Invert live / blank shells in practice mode
        const oldLive = liveShells;
        liveShells = blankShells;
        blankShells = oldLive;

        newEvents.push({
          type: 'item_used',
          data: { playerId: userId, itemId: 'inverter', targetId },
          id: Date.now() + Math.random()
        });
        newEvents.push({
          type: 'shell_inverted',
          data: { playerId: userId, newShell: 'INVERTED', remainingLive: liveShells, remainingBlank: blankShells },
          id: Date.now() + Math.random()
        });
      } else {
        newEvents.push({
          type: 'item_used',
          data: { playerId: userId, itemId, targetId, stolenItem: stolenItemId },
          id: Date.now() + Math.random()
        });
      }

      return {
        gameState: {
          ...state.gameState,
          players: currentPlayers,
          liveShells,
          blankShells
        },
        eventQueue: newEvents
      };
    });
  },

  resolvePendingItem: (gameId, userId, targetId, stolenItemId) => {
    const socket = socketService.getSocket();
    if (socket && socket.connected && !gameId.startsWith('practice-game')) {
      const turnToken = get().gameState?.turnToken;
      socket.emit('game_action', { gameId, userId, action: 'resolve_pending_item', data: { targetId, stolenItemId, turnToken } });
    } else {
      // Local / Practice Mode state resolution
      set((state) => {
        if (!state.gameState) return state;
        return {
          gameState: {
            ...state.gameState,
            pendingItemAction: undefined
          }
        };
      });
    }
  },

  setupListeners: (gameId, userId) => {
    const socket = socketService.getSocket();
    if (!socket) return () => {};

    const onLobbyState = (state: any) => set({ lobby: state, error: null });
    const onLobbiesList = (lobbies: any[]) => {
      // Filter lobbies for CHAMBER_CLASH since server broadcasts all public lobbies
      const filtered = lobbies.filter(l => l.gameType === 'CHAMBER_CLASH');
      set({ availableLobbies: filtered });
    };
    
    const onGameState = (state: ChamberClashState) => {
      if (state.gameType && state.gameType !== 'CHAMBER_CLASH') return;
      set((prev) => {
        if (prev.gameState && (prev.isAnimating || prev.eventQueue.length > 0)) {
          return { pendingGameState: state, lobby: null, error: null };
        }
        return { gameState: state, pendingGameState: null, lobby: null, error: null };
      });
    };

    const onGameEvent = (event: any) => {
      set((state) => ({
        eventQueue: [...state.eventQueue, { type: event.event, data: event, id: Date.now() + Math.random() }]
      }));
    };
    
    const onError = (err: any) => {
      set({ error: err.message || err });
      setTimeout(() => set({ error: null }), 3000);
    };

    const handleConnect = () => {
      const currentLobby = get().lobby;
      const currentGameState = get().gameState;
      const currentNickname = useUserStore.getState().nickname || 'Player';
      if (currentLobby) {
        socket.emit('lobby_join', {
          gameId: currentLobby.id,
          userId,
          nickname: currentNickname
        });
      } else if (currentGameState) {
        socket.emit('game_reconnect', {
          gameId: currentGameState.gameId,
          userId
        });
      }
    };

    const EVENTS = [
      'round_started',
      'turn_started',
      'shot_fired',
      'player_damaged',
      'player_healed',
      'player_eliminated',
      'item_used',
      'status_added',
      'status_removed',
      'items_distributed',
      'extra_turn_granted',
      'shell_ejected',
      'shell_inverted',
      'item_stolen'
    ];

    const onMagnifier = (data: any) => {
      set({ revealedShell: data.shell });
      setTimeout(() => set({ revealedShell: null }), 3500);
    };

    const onBurnerPhone = (data: any) => {
      console.log(`[BurnerPhone SERVER EVENT] displayShellNumber=${data.position}, shellType=${data.shell}`);
      set({ burnerPhoneReveal: { displayShellNumber: Number(data.position), shellType: data.shell === 'LIVE' ? 'LIVE' : 'BLANK' } });
      setTimeout(() => set({ burnerPhoneReveal: null }), 6000);
    };

    socket.on('connect', handleConnect);
    socket.on('lobby_state', onLobbyState);
    socket.on('lobbies_list_response', onLobbiesList);
    socket.on('lobbies_updated', onLobbiesList);
    socket.on('game_state', onGameState);
    socket.on('game_error', onError);
    socket.on('item_effect_magnifier', onMagnifier);
    socket.on('item_effect_burner_phone', onBurnerPhone);

    EVENTS.forEach(evtName => {
      socket.on(evtName, (data) => {
        set((state) => ({
          eventQueue: [...state.eventQueue, { type: evtName, data, id: Date.now() + Math.random() }]
        }));
      });
    });

    // Initial fetch for open lobbies only if not joining/in a game
    if (!gameId) {
      get().fetchLobbies();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('lobby_state', onLobbyState);
      socket.off('lobbies_list_response', onLobbiesList);
      socket.off('lobbies_updated', onLobbiesList);
      socket.off('game_state', onGameState);
      socket.off('game_error', onError);
      socket.off('item_effect_magnifier', onMagnifier);
      socket.off('item_effect_burner_phone', onBurnerPhone);
      EVENTS.forEach(evtName => {
        socket.off(evtName);
      });
    };
  },

  setAnimating: (animating) => set({ isAnimating: animating }),

  dequeueEvent: () => {
    set((state) => {
      const newQueue = [...state.eventQueue];
      newQueue.shift();
      if (newQueue.length === 0 && state.pendingGameState) {
        return { eventQueue: newQueue, gameState: state.pendingGameState, pendingGameState: null };
      }
      return { eventQueue: newQueue };
    });
  },

  addLogEntry: (text, icon, color) => {
    set((state) => {
      const newLog = [...state.actionLog, { id: Date.now().toString() + Math.random(), text, icon, color }];
      if (newLog.length > 30) newLog.shift();
      return { actionLog: newLog };
    });
  },

  setRevealedShell: (shell) => set({ revealedShell: shell }),

  setBurnerPhoneReveal: (reveal) => set({ burnerPhoneReveal: reveal }),

  clearState: () => set({ lobby: null, gameState: null, pendingGameState: null, error: null, eventQueue: [], isAnimating: false, actionLog: [], revealedShell: null, burnerPhoneReveal: null }),
}));