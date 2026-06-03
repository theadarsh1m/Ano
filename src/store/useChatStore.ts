import { create } from 'zustand';

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  type?: 'user' | 'system';
}

export interface ChatState {
  isConnected: boolean;
  // mapped by roomId
  messages: Record<string, Message[]>;
  // mapped by roomId
  unreadCounts: Record<string, number>;
  // mapped by roomId -> array of nicknames currently typing
  typingUsers: Record<string, string[]>;
  // mapped by roomId -> array of user objects
  activeUsers: Record<string, any[]>;
  
  // Actions
  setConnectionStatus: (status: boolean) => void;
  addMessage: (message: Message) => void;
  setMessages: (roomId: string, messages: Message[]) => void;
  markRoomAsRead: (roomId: string) => void;
  clearChat: (roomId: string) => void;
  setTypingUsers: (roomId: string, users: string[]) => void;
  addTypingUser: (roomId: string, nickname: string) => void;
  removeTypingUser: (roomId: string, nickname: string) => void;
  setActiveUsers: (roomId: string, users: any[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  isConnected: false,
  messages: {},
  unreadCounts: {},
  typingUsers: {},
  activeUsers: {},
  
  setConnectionStatus: (status) => set({ isConnected: status }),

  addMessage: (message) => set((state) => {
    const roomMessages = state.messages[message.roomId] || [];
    const currentUnread = state.unreadCounts[message.roomId] || 0;
    
    // Prevent duplicate messages (especially system messages)
    if (roomMessages.some(m => m.id === message.id)) {
      return state;
    }
    
    return {
      messages: {
        ...state.messages,
        [message.roomId]: [...roomMessages, message],
      },
      unreadCounts: {
        ...state.unreadCounts,
        [message.roomId]: currentUnread + 1,
      }
    };
  }),
  
  setMessages: (roomId, messages) => set((state) => ({
    messages: {
      ...state.messages,
      [roomId]: messages,
    }
  })),
  
  markRoomAsRead: (roomId) => set((state) => ({
    unreadCounts: {
      ...state.unreadCounts,
      [roomId]: 0,
    }
  })),
  
  clearChat: (roomId) => set((state) => {
    const newMessages = { ...state.messages };
    delete newMessages[roomId];
    
    const newUnreadCounts = { ...state.unreadCounts };
    delete newUnreadCounts[roomId];
    
    const newTypingUsers = { ...state.typingUsers };
    delete newTypingUsers[roomId];

    const newActiveUsers = { ...state.activeUsers };
    delete newActiveUsers[roomId];

    return {
      messages: newMessages,
      unreadCounts: newUnreadCounts,
      typingUsers: newTypingUsers,
      activeUsers: newActiveUsers,
    };
  }),

  setTypingUsers: (roomId, users) => set((state) => ({
    typingUsers: {
      ...state.typingUsers,
      [roomId]: users
    }
  })),

  addTypingUser: (roomId, nickname) => set((state) => {
    const currentTyping = state.typingUsers[roomId] || [];
    if (!currentTyping.includes(nickname)) {
      return {
        typingUsers: {
          ...state.typingUsers,
          [roomId]: [...currentTyping, nickname]
        }
      };
    }
    return state;
  }),

  removeTypingUser: (roomId, nickname) => set((state) => {
    const currentTyping = state.typingUsers[roomId] || [];
    return {
      typingUsers: {
        ...state.typingUsers,
        [roomId]: currentTyping.filter(name => name !== nickname)
      }
    };
  }),

  setActiveUsers: (roomId, users) => set((state) => ({
    activeUsers: {
      ...state.activeUsers,
      [roomId]: users
    }
  })),
}));
