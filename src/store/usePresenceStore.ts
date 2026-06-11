import { create } from 'zustand';

interface PresenceState {
  onlineUserIds: Set<string>;

  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  setOnlineUsers: (userIds: string[]) => void;
  isOnline: (userId: string) => boolean;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUserIds: new Set(),

  setUserOnline: (userId) =>
    set((state) => {
      const updated = new Set(state.onlineUserIds);
      updated.add(userId);
      return { onlineUserIds: updated };
    }),

  setUserOffline: (userId) =>
    set((state) => {
      const updated = new Set(state.onlineUserIds);
      updated.delete(userId);
      return { onlineUserIds: updated };
    }),

  setOnlineUsers: (userIds) =>
    set({ onlineUserIds: new Set(userIds) }),

  isOnline: (userId) => get().onlineUserIds.has(userId),
}));
