import { create } from 'zustand';

export interface Room {
  id: string;
  name: string;
  type: 'public' | 'private';
  description?: string | null;
  inviteCode?: string | null;
  capacity: number;
  createdAt: string | number;
  createdBy: string | null;
}

export interface RoomState {
  rooms: Room[];
  joinedRoomIds: string[]; // locally tracked private room IDs the user has joined
  loading: boolean;
  error: string | null;

  // Server-backed actions
  fetchPublicRooms: () => Promise<void>;
  fetchRoom: (roomId: string) => Promise<Room | null>;
  createRoom: (name: string, type: 'public' | 'private', createdBy: string) => Promise<string | null>;

  // Local tracking for private rooms
  addJoinedRoom: (roomId: string) => void;
  removeJoinedRoom: (roomId: string) => void;

  // Clear
  clearError: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  joinedRoomIds: (() => {
    // Load joined room IDs from localStorage on init
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ano-joined-rooms');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  })(),
  loading: false,
  error: null,

  fetchPublicRooms: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/rooms/public`);
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const rooms = await res.json();
      set({ rooms, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchRoom: async (roomId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  createRoom: async (name, type, createdBy) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, createdBy }),
      });
      if (!res.ok) throw new Error('Failed to create room');
      const room = await res.json();

      // Add to local state
      set((state) => ({ rooms: [room, ...state.rooms], loading: false }));

      // Track private room membership locally
      if (type === 'private') {
        get().addJoinedRoom(room.id);
      }

      return room.id;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  addJoinedRoom: (roomId) => {
    set((state) => {
      if (state.joinedRoomIds.includes(roomId)) return state;
      const updated = [...state.joinedRoomIds, roomId];
      if (typeof window !== 'undefined') {
        localStorage.setItem('ano-joined-rooms', JSON.stringify(updated));
      }
      return { joinedRoomIds: updated };
    });
  },

  removeJoinedRoom: (roomId) => {
    set((state) => {
      const updated = state.joinedRoomIds.filter((id) => id !== roomId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ano-joined-rooms', JSON.stringify(updated));
      }
      return { joinedRoomIds: updated };
    });
  },

  clearError: () => set({ error: null }),
}));
