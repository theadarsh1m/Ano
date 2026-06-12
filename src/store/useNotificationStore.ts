import { create } from 'zustand';

export interface AppNotification {
  id: string;
  recipientId: string;
  senderId?: string;
  sender?: {
    id: string;
    nickname: string;
    avatar: string | null;
  };
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: any;
  createdAt: string;
}

export interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  loaded: boolean;

  setNotifications: (notifications: AppNotification[]) => void;
  addNotification: (notification: AppNotification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  loaded: false,

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
      loaded: true,
    }),

  addNotification: (notification) =>
    set((state) => {
      // Avoid duplicates
      if (state.notifications.some((n) => n.id === notification.id)) return state;
      const newNotifications = [notification, ...state.notifications];
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter((n) => !n.isRead).length,
      };
    }),

  markAsRead: (id) =>
    set((state) => {
      const newNotifications = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter((n) => !n.isRead).length,
      };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
}));
