import { create } from 'zustand';

interface RoomConnectionState {
  currentRoomId: string | null;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
}

export const useRoomConnectionStore = create<RoomConnectionState>((set) => ({
  currentRoomId: null,
  joinRoom: (roomId) => set({ currentRoomId: roomId }),
  leaveRoom: () => set({ currentRoomId: null }),
}));
