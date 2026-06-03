import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface UserPreferences {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  theme: 'dark' | 'light';
}

export interface UserState {
  id: string | null;
  nickname: string | null;
  joinedAt: number | null;
  preferences: UserPreferences;
  login: (nickname: string) => void;
  logout: () => void;
  updatePreferences: (newPreferences: Partial<UserPreferences>) => void;
}

const defaultPreferences: UserPreferences = {
  soundEnabled: true,
  notificationsEnabled: true,
  theme: 'dark',
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      id: null,
      nickname: null,
      joinedAt: null,
      preferences: defaultPreferences,
      login: (nickname: string) => set({
        id: `guest_${uuidv4().substring(0, 6)}`,
        nickname,
        joinedAt: Date.now(),
      }),
      logout: () => set({
        id: null,
        nickname: null,
        joinedAt: null,
        preferences: defaultPreferences,
      }),
      updatePreferences: (newPreferences) => set((state) => ({
        preferences: {
          ...state.preferences,
          ...newPreferences,
        }
      })),
    }),
    {
      name: 'ano-session', // name of the item in the storage (must be unique)
    }
  )
);
