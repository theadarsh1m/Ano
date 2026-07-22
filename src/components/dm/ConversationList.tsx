"use client";

import { API_URL } from "@/lib/config";
import { useEffect } from "react";
import { useDMStore, ConversationPreview } from "@/store/useDMStore";
import { useUserStore } from "@/store/useUserStore";
import { usePresenceStore } from "@/store/usePresenceStore";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return "";
  const now = Date.now();
  const diffMs = now - timestamp;
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const msgDate = new Date(timestamp);
  const nowDate = new Date();

  const isYesterday =
    nowDate.getDate() - msgDate.getDate() === 1 &&
    nowDate.getMonth() === msgDate.getMonth() &&
    nowDate.getFullYear() === msgDate.getFullYear();

  if (isYesterday) return "Yesterday";

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return msgDate.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ConversationList() {
  const router = useRouter();
  const userId = useUserStore((s) => s.id);
  const conversations = useDMStore((s) => s.conversations);
  const setConversations = useDMStore((s) => s.setConversations);
  const conversationsLoaded = useDMStore((s) => s.conversationsLoaded);
  const activeConversationId = useDMStore((s) => s.activeConversationId);
  const dmUnreadCounts = useDMStore((s) => s.dmUnreadCounts);
  const dmTypingUsers = useDMStore((s) => s.dmTypingUsers);
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
        console.warn("Failed to load conversations:", err);
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
        <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-50" />
        <p className="text-xs text-gray-400 font-medium">No conversations yet</p>
        <p className="text-[10px] text-gray-500 mt-0.5">Search users to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {conversations.map((conv) => {
        const unread = dmUnreadCounts[conv.id] || 0;
        const isActive = activeConversationId === conv.id;
        const online = isOnline(conv.otherUser.id);
        const typingUsers = dmTypingUsers[conv.id] || [];
        const isTyping = typingUsers.length > 0;

        let previewText = "";
        let displayTimestamp = "";

        if (isTyping) {
          previewText = "Typing...";
        } else if (conv.lastMessage) {
          const isMe = conv.lastMessage.senderId === userId;
          const prefix = isMe ? "You: " : "";
          displayTimestamp = formatTimestamp(conv.lastMessage.timestamp);

          if (conv.lastMessage.type === "image") {
            previewText = `${prefix}📷 Image`;
          } else if (conv.lastMessage.type === "file") {
            previewText = `${prefix}📎 File`;
          } else {
            previewText = `${prefix}${conv.lastMessage.content}`;
          }
        }

        return (
          <button
            key={conv.id}
            onClick={() => handleClick(conv)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all w-full ${
              isActive
                ? "bg-white/10 text-white font-semibold shadow-md"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <UserAvatar
                src={conv.otherUser.avatar}
                nickname={conv.otherUser.nickname}
                size="w-9 h-9"
              />
              {/* Online dot */}
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-900 ${
                  online ? "bg-green-500" : "bg-gray-600"
                }`}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-white truncate">
                  {conv.otherUser.nickname}
                </span>
                {displayTimestamp && !isTyping && (
                  <span className="text-[10px] text-gray-500 flex-shrink-0 ml-1">
                    {displayTimestamp}
                  </span>
                )}
              </div>

              {isTyping ? (
                <p className="text-xs text-blue-400 font-medium italic animate-pulse truncate mt-0.5">
                  Typing...
                </p>
              ) : (
                previewText && (
                  <p className={`text-xs truncate mt-0.5 ${unread > 0 ? "text-white font-semibold" : "text-gray-400"}`}>
                    {previewText}
                  </p>
                )
              )}
            </div>

            {/* Unread badge */}
            {unread > 0 && (
              <span className="flex-shrink-0 bg-blue-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
