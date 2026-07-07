"use client";
import { API_URL } from "@/lib/config";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/layout/GlassCard";
import { Users, User, Circle } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useUserStore } from "@/store/useUserStore";
import { useDMStore } from "@/store/useDMStore";
import { useRouter } from "next/navigation";

interface OnlineUser {
  id: string;
  nickname: string;
  avatar: string | null;
  bio: string | null;
}

export function OnlineUsersList() {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const myUserId = useUserStore((s) => s.id);
  const router = useRouter();

  useEffect(() => {
    const fetchOnlineUsers = async () => {
      try {
        const res = await fetch(`${API_URL}/api/users/online`);
        if (!res.ok) throw new Error("Failed to fetch online users");
        const data = await res.json();
        setUsers(data.filter((u: OnlineUser) => u.id !== myUserId));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOnlineUsers();
    
    // Optional: Refresh periodically
    const interval = setInterval(fetchOnlineUsers, 30000); // every 30s
    return () => clearInterval(interval);
  }, [myUserId]);

  const handleUserClick = async (user: OnlineUser) => {
    if (!myUserId) return;
    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAId: myUserId, userBId: user.id }),
      });
      if (res.ok) {
        const conv = await res.json();
        useDMStore.getState().setConversationsLoaded(false);
        router.push(`/dm/${conv.id}`);
      }
    } catch (err) {
      console.error("Failed to start DM:", err);
    }
  };

  return (
    <GlassCard className="mt-8 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-white">Currently Online</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400 bg-white/5 px-3 py-1 rounded-full">
          <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500 animate-pulse" />
          {users.length} Active
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-400 bg-red-500/10 rounded-xl border border-red-500/20">
          Failed to load online users.
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-gray-400 bg-white/5 rounded-xl border border-white/10">
          No other users are currently online.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {users.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleUserClick(user)}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors border border-white/5 cursor-pointer"
            >
              <div className="relative">
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.nickname}
                    width={40}
                    height={40}
                    className="rounded-full object-cover w-10 h-10"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-indigo-400" />
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#12121A] rounded-full" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-white font-medium truncate">{user.nickname}</span>
                {user.bio && (
                  <span className="text-xs text-gray-400 truncate">{user.bio}</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
