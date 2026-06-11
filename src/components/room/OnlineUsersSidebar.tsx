"use client";

import { useChatStore } from "@/store/useChatStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

interface OnlineUsersSidebarProps {
  roomId: string;
}

export function OnlineUsersSidebar({ roomId }: OnlineUsersSidebarProps) {
  const router = useRouter();
  const activeUsers = useChatStore((state) => state.activeUsers[roomId]) || [];
  const myUserId = useUserStore((state) => state.id);

  const handleStartDM = async (targetUserId: string) => {
    if (!myUserId || myUserId === targetUserId) return;

    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAId: myUserId, userBId: targetUserId }),
      });
      if (res.ok) {
        const conv = await res.json();
        router.push(`/dm/${conv.id}`);
      }
    } catch (err) {
      console.error("Failed to start DM:", err);
    }
  };

  return (
    <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-4">
      <GlassCard className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Online Users
          </h3>
          <span className="bg-white/10 text-white text-xs px-2 py-0.5 rounded-full">
            {activeUsers.length}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1 pr-2">
          {activeUsers.map((user) => {
            const isMe = user.userId === myUserId;
            
            return (
              <div
                key={user.socketId}
                className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${
                  isMe ? "" : "hover:bg-white/5 cursor-pointer group"
                }`}
                onClick={() => !isMe && handleStartDM(user.userId)}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {user.nickname.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {user.nickname} {isMe && <span className="text-gray-400 text-xs">(You)</span>}
                  </p>
                  <p className="text-xs text-green-400">Online</p>
                </div>
                {!isMe && (
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                    title={`Message ${user.nickname}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartDM(user.userId);
                    }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {activeUsers.length === 0 && (
            <p className="text-sm text-gray-500 italic">Waiting for others to join...</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
