import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface UserState {
  id: string | null;
  nickname: string | null;
  joinedAt: number | null;
  login: (nickname: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      id: null,
      nickname: null,
      joinedAt: null,
      login: (nickname: string) => set({
        id: `guest_${uuidv4().substring(0, 6)}`,
        nickname,
        joinedAt: Date.now(),
      }),
      logout: () => set({
        id: null,
        nickname: null,
        joinedAt: null,
      }),
    }),
    {
      name: 'ano-session', // name of the item in the storage (must be unique)
    }
  )
);
