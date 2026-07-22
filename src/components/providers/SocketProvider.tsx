"use client";

import { useEffect } from "react";
import { useUserStore } from "@/store/useUserStore";
import { usePresenceStore } from "@/store/usePresenceStore";
import { useDMStore, DMMessage } from "@/store/useDMStore";
import { useNotificationStore, AppNotification } from "@/store/useNotificationStore";
import { socketService } from "@/lib/socket";

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window !== "undefined") return `http://${window.location.hostname}:3001`;
  return "http://localhost:3001";
};

/**
 * Global socket provider — mounts once and handles:
 * - User registration for presence
 * - Online/offline broadcasts
 * - Real-time DM updates (conversations, previews, unread counts)
 * - App notifications
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const userId = useUserStore((s) => s.id);
  const nickname = useUserStore((s) => s.nickname);

  const setUserOnline = usePresenceStore((s) => s.setUserOnline);
  const setUserOffline = usePresenceStore((s) => s.setUserOffline);
  const setOnlineUsers = usePresenceStore((s) => s.setOnlineUsers);

  useEffect(() => {
    if (!userId || !nickname) return;

    const socket = socketService.connect();

    // Register for global presence (both immediately and on reconnects)
    const registerUser = () => {
      socket.emit("register_user", { userId, nickname });
    };

    if (socket.connected) {
      registerUser();
    }
    socket.on("connect", registerUser);

    const onUserOnline = ({ userId: uid }: { userId: string }) => {
      setUserOnline(uid);
    };

    const onUserOffline = ({ userId: uid }: { userId: string }) => {
      setUserOffline(uid);
    };

    const onOnlineUsers = (userIds: string[]) => {
      setOnlineUsers(userIds);
    };

    const onDMNotification = ({ conversationId, message }: { conversationId: string; message: DMMessage }) => {
      if (!conversationId || !message) return;
      useDMStore.getState().addDMMessage(conversationId, message);
      
      const hasConv = useDMStore.getState().conversations.some((c) => c.id === conversationId);
      if (!hasConv) {
        fetch(`${getApiUrl()}/api/conversations/${userId}`)
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) {
              useDMStore.getState().setConversations(data);
            }
          })
          .catch(() => {});
      }
    };

    const onDMSeen = ({ conversationId, readerId }: { conversationId: string; readerId: string }) => {
      useDMStore.getState().markMessagesAsSeen(conversationId, readerId);
    };

    const onNewNotification = (notification: AppNotification) => {
      useNotificationStore.getState().addNotification(notification);
    };

    socket.on("user_online", onUserOnline);
    socket.on("user_offline", onUserOffline);
    socket.on("online_users", onOnlineUsers);
    socket.on("dm_notification", onDMNotification);
    socket.on("dm_seen", onDMSeen);
    socket.on("new_notification", onNewNotification);

    // Initial fetch of notifications
    fetch(`${getApiUrl()}/api/notifications/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          useNotificationStore.getState().setNotifications(data);
        }
      })
      .catch((err) => console.warn('Failed to fetch initial notifications:', err));

    return () => {
      socket.off("user_online", onUserOnline);
      socket.off("user_offline", onUserOffline);
      socket.off("online_users", onOnlineUsers);
      socket.off("dm_notification", onDMNotification);
      socket.off("dm_seen", onDMSeen);
      socket.off("new_notification", onNewNotification);
      socket.off("connect", registerUser);
    };
  }, [userId, nickname, setUserOnline, setUserOffline, setOnlineUsers]);

  return <>{children}</>;
}
