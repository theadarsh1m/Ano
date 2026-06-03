import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface Room {
  id: string;
  name: string;
  type: 'public' | 'private';
  capacity: number;
  participants: number;
  createdAt: number;
  createdBy: string; // user id
}

export interface RoomState {
  rooms: Room[];
  joinedRooms: string[]; // array of room IDs the user has joined
  createRoom: (name: string, type: 'public' | 'private', createdBy: string) => string;
  joinRoom: (roomId: string) => boolean; // returns true if successful
  leaveRoom: (roomId: string) => void;
  getPublicRooms: () => Room[];
  getPrivateRooms: () => Room[];
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set, get) => ({
      rooms: [
        // Add some dummy public rooms so it's not empty initially
        {
          id: 'lobby',
          name: 'Main Lobby',
          type: 'public',
          capacity: 100,
          participants: 42,
          createdAt: Date.now() - 86400000,
          createdBy: 'system',
        },
        {
          id: 'chill',
          name: 'Chill Zone',
          type: 'public',
          capacity: 50,
          participants: 12,
          createdAt: Date.now() - 3600000,
          createdBy: 'system',
        }
      ],
      joinedRooms: [],
      createRoom: (name, type, createdBy) => {
        // For private rooms, generate a shorter, more readable code
        const id = type === 'private' 
          ? uuidv4().substring(0, 6).toUpperCase()
          : uuidv4().substring(0, 8);
          
        const newRoom: Room = {
          id,
          name,
          type,
          capacity: 50, // default
          participants: 1, // creator joins automatically
          createdAt: Date.now(),
          createdBy,
        };
        
        set((state) => ({
          rooms: [...state.rooms, newRoom],
          joinedRooms: [...state.joinedRooms, id]
        }));
        
        return id;
      },
      joinRoom: (roomId) => {
        const state = get();
        const room = state.rooms.find(r => r.id === roomId || r.id === roomId.toUpperCase());
        
        if (!room) return false;
        
        // Check if already joined
        if (state.joinedRooms.includes(room.id)) return true;
        
        set((state) => ({
          rooms: state.rooms.map(r => 
            r.id === room.id ? { ...r, participants: r.participants + 1 } : r
          ),
          joinedRooms: [...state.joinedRooms, room.id]
        }));
        
        return true;
      },
      leaveRoom: (roomId) => {
        set((state) => ({
          rooms: state.rooms.map(r => 
            r.id === roomId ? { ...r, participants: Math.max(0, r.participants - 1) } : r
          ),
          joinedRooms: state.joinedRooms.filter(id => id !== roomId)
        }));
      },
      getPublicRooms: () => {
        return get().rooms.filter(r => r.type === 'public');
      },
      getPrivateRooms: () => {
        const state = get();
        // Return private rooms that the user has joined or created
        return state.rooms.filter(r => r.type === 'private' && state.joinedRooms.includes(r.id));
      }
    }),
    {
      name: 'ano-rooms',
    }
  )
);
