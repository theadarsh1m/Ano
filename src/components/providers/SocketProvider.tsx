"use client";

import { useEffect } from "react";
import { useUserStore } from "@/store/useUserStore";
import { usePresenceStore } from "@/store/usePresenceStore";
import { useDMStore } from "@/store/useDMStore";
import { socketService } from "@/lib/socket";

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

/**
 * Global socket provider — mounts once and handles:
 * - User registration for presence
 * - Online/offline broadcasts
 * - DM notifications (unread counts when not viewing a conversation)
 *
 * Place this in the root layout so it works on ALL pages.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const userId = useUserStore((s) => s.id);
  const nickname = useUserStore((s) => s.nickname);

  const setUserOnline = usePresenceStore((s) => s.setUserOnline);
  const setUserOffline = usePresenceStore((s) => s.setUserOffline);
  const setOnlineUsers = usePresenceStore((s) => s.setOnlineUsers);

  const addDMMessage = useDMStore((s) => s.addDMMessage);
  const incrementUnread = useDMStore((s) => s.incrementUnread);
  const activeConversationId = useDMStore((s) => s.activeConversationId);
  const setConversations = useDMStore((s) => s.setConversations);

  useEffect(() => {
    if (!userId || !nickname) return;

    const socket = socketService.connect();

    // Register for global presence
    socket.emit("register_user", { userId, nickname });

    const onUserOnline = ({ userId: uid }: { userId: string }) => {
      setUserOnline(uid);
    };

    const onUserOffline = ({ userId: uid }: { userId: string }) => {
      setUserOffline(uid);
    };

    const onOnlineUsers = (userIds: string[]) => {
      setOnlineUsers(userIds);
    };

    // DM notification — fires when a DM arrives and the user is NOT in that DM room
    const onDMNotification = ({ conversationId, message }: any) => {
      addDMMessage(conversationId, message);
      // Only increment unread if user is NOT currently viewing that conversation
      if (activeConversationId !== conversationId) {
        incrementUnread(conversationId);
      }
      // Refresh conversation list so it reorders
      fetch(`${API_URL}/api/conversations/${userId}`)
        .then((res) => res.json())
        .then((data) => setConversations(data))
        .catch(() => {});
    };

    socket.on("user_online", onUserOnline);
    socket.on("user_offline", onUserOffline);
    socket.on("online_users", onOnlineUsers);
    socket.on("dm_notification", onDMNotification);

    return () => {
      socket.off("user_online", onUserOnline);
      socket.off("user_offline", onUserOffline);
      socket.off("online_users", onOnlineUsers);
      socket.off("dm_notification", onDMNotification);
    };
  }, [userId, nickname, activeConversationId, setUserOnline, setUserOffline, setOnlineUsers, addDMMessage, incrementUnread, setConversations]);

  return <>{children}</>;
}
