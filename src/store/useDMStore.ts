import { create } from 'zustand';

export interface DMMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  content: string;
  timestamp: number;
  type?: 'text' | 'image' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  isRead?: boolean;
  moderationStatus?: string;
  moderationProvider?: string;
  nudityScore?: number | null;
  goreScore?: number | null;
  rawModerationResponse?: any;
  moderatedAt?: string | null;
}

export interface ConversationPreview {
  id: string;
  otherUser: {
    id: string;
    nickname: string;
    avatar: string | null;
    lastSeen?: number;
  };
  lastMessage: {
    id: string;
    content: string;
    type: string;
    timestamp: number;
    senderId: string;
  } | null;
  unreadCount?: number;
  updatedAt: number;
}

export interface DMState {
  conversations: ConversationPreview[];
  activeConversationId: string | null;
  dmMessages: Record<string, DMMessage[]>;
  dmTypingUsers: Record<string, string[]>;
  dmUnreadCounts: Record<string, number>;
  conversationsLoaded: boolean;

  // Actions
  setConversations: (conversations: ConversationPreview[]) => void;
  addOrUpdateConversation: (conversation: ConversationPreview) => void;
  setActiveConversation: (id: string | null) => void;
  addDMMessage: (conversationId: string, message: DMMessage) => void;
  setDMMessages: (conversationId: string, messages: DMMessage[]) => void;
  incrementUnread: (conversationId: string) => void;
  markConversationAsRead: (conversationId: string) => void;
  markMessagesAsSeen: (conversationId: string, readerId: string) => void;
  addDMTypingUser: (conversationId: string, nickname: string) => void;
  removeDMTypingUser: (conversationId: string, nickname: string) => void;
  getTotalUnreadDMs: () => number;
  setConversationsLoaded: (loaded: boolean) => void;
}

export const useDMStore = create<DMState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  dmMessages: {},
  dmTypingUsers: {},
  dmUnreadCounts: {},
  conversationsLoaded: false,

  setConversations: (conversations) => {
    const counts: Record<string, number> = {};
    conversations.forEach((c) => {
      counts[c.id] = c.unreadCount || 0;
    });
    set({ 
      conversations, 
      dmUnreadCounts: { ...get().dmUnreadCounts, ...counts },
      conversationsLoaded: true 
    });
  },

  addOrUpdateConversation: (conversation) =>
    set((state) => {
      const existing = state.conversations.findIndex((c) => c.id === conversation.id);
      if (existing >= 0) {
        const updated = [...state.conversations];
        updated[existing] = conversation;
        // Re-sort by updatedAt descending
        updated.sort((a, b) => b.updatedAt - a.updatedAt);
        return { conversations: updated };
      }
      return {
        conversations: [conversation, ...state.conversations],
      };
    }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addDMMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.dmMessages[conversationId] || [];
      // Prevent duplicates
      if (existing.some((m) => m.id === message.id)) return state;

      return {
        dmMessages: {
          ...state.dmMessages,
          [conversationId]: [...existing, message],
        },
      };
    }),

  setDMMessages: (conversationId, messages) =>
    set((state) => ({
      dmMessages: {
        ...state.dmMessages,
        [conversationId]: messages,
      },
    })),

  incrementUnread: (conversationId) =>
    set((state) => ({
      dmUnreadCounts: {
        ...state.dmUnreadCounts,
        [conversationId]: (state.dmUnreadCounts[conversationId] || 0) + 1,
      },
    })),

  markConversationAsRead: (conversationId) =>
    set((state) => ({
      dmUnreadCounts: {
        ...state.dmUnreadCounts,
        [conversationId]: 0,
      },
    })),

  markMessagesAsSeen: (conversationId, readerId) =>
    set((state) => {
      const existing = state.dmMessages[conversationId] || [];
      const updated = existing.map((msg) =>
        msg.senderId !== readerId ? { ...msg, isRead: true } : msg
      );
      return {
        dmMessages: {
          ...state.dmMessages,
          [conversationId]: updated,
        },
      };
    }),

  addDMTypingUser: (conversationId, nickname) =>
    set((state) => {
      const current = state.dmTypingUsers[conversationId] || [];
      if (current.includes(nickname)) return state;
      return {
        dmTypingUsers: {
          ...state.dmTypingUsers,
          [conversationId]: [...current, nickname],
        },
      };
    }),

  removeDMTypingUser: (conversationId, nickname) =>
    set((state) => {
      const current = state.dmTypingUsers[conversationId] || [];
      return {
        dmTypingUsers: {
          ...state.dmTypingUsers,
          [conversationId]: current.filter((n) => n !== nickname),
        },
      };
    }),

  getTotalUnreadDMs: () => {
    const counts = get().dmUnreadCounts;
    return Object.values(counts).reduce((sum, count) => sum + count, 0);
  },

  setConversationsLoaded: (loaded) => set({ conversationsLoaded: loaded }),
}));
