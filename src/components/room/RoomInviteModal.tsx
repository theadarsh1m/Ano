"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Check, Loader2 } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { usePresenceStore } from "@/store/usePresenceStore";
import { socketService } from "@/lib/socket";
import { GlassModal } from "@/components/layout/GlassModal";

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

interface SearchResult {
  id: string;
  nickname: string;
  avatar: string | null;
}

interface RoomInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
}

export function RoomInviteModal({ isOpen, onClose, roomId, roomName }: RoomInviteModalProps) {
  const { id: myUserId, nickname: myNickname } = useUserStore();
  const isOnline = usePresenceStore((s) => s.isOnline);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setInvitedIds(new Set());
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.filter((u: SearchResult) => u.id !== myUserId && isOnline(u.id)));
        }
      } catch (err) {
        console.error("Search failed:", err);
      }
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, myUserId, isOnline]);

  const handleInvite = (userId: string) => {
    const socket = socketService.getSocket();
    if (!socket || !myUserId || !myNickname) return;

    socket.emit("send_room_invite", {
      senderId: myUserId,
      senderName: myNickname,
      recipientId: userId,
      roomId,
      roomName,
    });

    setInvitedIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(userId);
      return newSet;
    });
  };

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="Invite to Room">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for online users..."
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1">
        {loading && (
          <div className="text-center py-4">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-400" />
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-4">
            No online users found
          </p>
        )}

        {results.map((user) => {
          const isInvited = invitedIds.has(user.id);
          return (
            <div
              key={user.id}
              className="flex items-center justify-between gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.nickname} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {user.nickname.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <p className="text-sm font-medium text-white truncate">{user.nickname}</p>
              </div>

              <button
                onClick={() => !isInvited && handleInvite(user.id)}
                disabled={isInvited}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isInvited 
                    ? "bg-green-500/20 text-green-400 cursor-not-allowed" 
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
              >
                {isInvited ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Invited
                  </>
                ) : (
                  "Invite"
                )}
              </button>
            </div>
          );
        })}
      </div>
    </GlassModal>
  );
}
