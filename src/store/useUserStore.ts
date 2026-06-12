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
  avatar: string | null;
  bio: string | null;
  joinedAt: number | null;
  isAnonymous: boolean;
  email: string | null;
  preferences: UserPreferences;
  login: (nickname: string) => void;
  loginWithGoogle: (token: string) => Promise<{ isNewUser?: boolean }>;
  logout: () => void;
  updatePreferences: (newPreferences: Partial<UserPreferences>) => void;
  updateProfile: (data: { nickname?: string; bio?: string; avatar?: string }) => Promise<void>;
}

const defaultPreferences: UserPreferences = {
  soundEnabled: true,
  notificationsEnabled: true,
  theme: 'dark',
};

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      id: null,
      nickname: null,
      avatar: null,
      bio: null,
      joinedAt: null,
      isAnonymous: true,
      email: null,
      preferences: defaultPreferences,
      login: (nickname: string) => {
        const id = `guest_${uuidv4().substring(0, 6)}`;

        // Persist anonymous user to database (fire-and-forget)
        fetch(`${API_URL}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, nickname }),
        }).catch((err) => console.error('Failed to persist user:', err));

        set({ id, nickname, joinedAt: Date.now(), avatar: null, bio: null, isAnonymous: true, email: null });
      },
      loginWithGoogle: async (token: string) => {
        const currentId = get().id;
        const isAnon = get().isAnonymous;
        
        try {
          const res = await fetch(`${API_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              token, 
              guestId: (isAnon && currentId) ? currentId : undefined 
            }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to authenticate with Google');
          }

          const user = await res.json();
          set({
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar,
            bio: user.bio,
            isAnonymous: user.isAnonymous,
            email: user.email,
            joinedAt: new Date(user.createdAt).getTime() || Date.now(),
          });
          
          return { isNewUser: user.isNewUser };
        } catch (err) {
          console.error('Google login error:', err);
          throw err;
        }
      },
      logout: () => set({
        id: null,
        nickname: null,
        avatar: null,
        bio: null,
        joinedAt: null,
        isAnonymous: true,
        email: null,
        preferences: defaultPreferences,
      }),
      updatePreferences: (newPreferences) => set((state) => ({
        preferences: {
          ...state.preferences,
          ...newPreferences,
        }
      })),
      updateProfile: async (data) => {
        const userId = get().id;
        if (!userId) return;

        try {
          const res = await fetch(`${API_URL}/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });

          if (!res.ok) throw new Error('Failed to update profile');

          const profile = await res.json();
          set({
            nickname: profile.nickname,
            avatar: profile.avatar,
            bio: profile.bio,
          });
        } catch (err) {
          console.error('Failed to update profile:', err);
        }
      },
    }),
    {
      name: 'ano-session',
    }
  )
);
