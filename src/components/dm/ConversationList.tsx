"use client";

import { useEffect } from "react";
import { useDMStore, ConversationPreview } from "@/store/useDMStore";
import { useUserStore } from "@/store/useUserStore";
import { usePresenceStore } from "@/store/usePresenceStore";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function ConversationList() {
  const router = useRouter();
  const userId = useUserStore((s) => s.id);
  const conversations = useDMStore((s) => s.conversations);
  const setConversations = useDMStore((s) => s.setConversations);
  const conversationsLoaded = useDMStore((s) => s.conversationsLoaded);
  const activeConversationId = useDMStore((s) => s.activeConversationId);
  const dmUnreadCounts = useDMStore((s) => s.dmUnreadCounts);
  const isOnline = usePresenceStore((s) => s.isOnline);

  useEffect(() => {
    if (!userId || conversationsLoaded) return;

    const loadConversations = async () => {
      try {
        const res = await fetch(`${API_URL}/api/conversations/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        }
      } catch (err) {
        console.error("Failed to load conversations:", err);
      }
    };

    loadConversations();
  }, [userId, conversationsLoaded, setConversations]);

  const handleClick = (conv: ConversationPreview) => {
    router.push(`/dm/${conv.id}`);
  };

  if (conversations.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
        <p className="text-xs text-gray-500">No conversations yet</p>
        <p className="text-xs text-gray-600 mt-1">Search for users to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {conversations.map((conv) => {
        const unread = dmUnreadCounts[conv.id] || 0;
        const isActive = activeConversationId === conv.id;
        const online = isOnline(conv.otherUser.id);

        return (
          <button
            key={conv.id}
            onClick={() => handleClick(conv)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all w-full ${
              isActive
                ? "bg-white/10 text-white"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {conv.otherUser.avatar ? (
                <img
                  src={conv.otherUser.avatar}
                  alt={conv.otherUser.nickname}
                  className="w-9 h-9 rounded-full object-cover"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                  {conv.otherUser.nickname.substring(0, 2).toUpperCase()}
                </div>
              )}
              {/* Online dot */}
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-900 ${
                  online ? "bg-green-500" : "bg-gray-600"
                }`}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">
                  {conv.otherUser.nickname}
                </span>
                {conv.lastMessage && (
                  <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">
                    {timeAgo(conv.lastMessage.timestamp)}
                  </span>
                )}
              </div>
              {conv.lastMessage && (
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {conv.lastMessage.type === "image"
                    ? "📷 Image"
                    : conv.lastMessage.type === "file"
                    ? "📎 File"
                    : conv.lastMessage.content}
                </p>
              )}
            </div>

            {/* Unread badge */}
            {unread > 0 && (
              <span className="flex-shrink-0 bg-blue-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
