import { create } from 'zustand';

export interface VoiceChannel {
  id: string;
  name: string;
  roomId: string;
  capacity: number;
}

interface VoiceState {
  channels: VoiceChannel[];
  connectedChannelId: string | null;
  isMuted: boolean;
  isLoading: boolean;
  voiceError: string | null;
  
  setChannels: (channels: VoiceChannel[]) => void;
  setVoiceError: (error: string | null) => void;
  fetchChannels: (roomId: string) => Promise<void>;
  createChannel: (roomId: string, name: string) => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;
  
  connect: (channelId: string) => void;
  disconnect: () => void;
  toggleMute: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export const useVoiceStore = create<VoiceState>((set, get) => ({
  channels: [],
  connectedChannelId: null,
  isMuted: false,
  isLoading: false,
  voiceError: null,

  setChannels: (channels) => set({ channels }),
  setVoiceError: (error) => set({ voiceError: error }),

  fetchChannels: async (roomId: string) => {
    try {
      set({ isLoading: true });
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/voice-channels`);
      if (res.ok) {
        const data = await res.json();
        set({ channels: data, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.error('Failed to fetch voice channels', err);
      set({ isLoading: false });
    }
  },

  createChannel: async (roomId: string, name: string) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/voice-channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        const newChannel = await res.json();
        set((state) => ({ channels: [...state.channels, newChannel] }));
      }
    } catch (err) {
      console.error('Failed to create voice channel', err);
    }
  },

  deleteChannel: async (channelId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/voice-channels/${channelId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        set((state) => ({
          channels: state.channels.filter(c => c.id !== channelId),
          connectedChannelId: state.connectedChannelId === channelId ? null : state.connectedChannelId
        }));
      }
    } catch (err) {
      console.error('Failed to delete voice channel', err);
    }
  },

  connect: (channelId: string) => set({ connectedChannelId: channelId }),
  disconnect: () => set({ connectedChannelId: null }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted }))
}));
