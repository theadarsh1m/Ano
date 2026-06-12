"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useDMStore } from "@/store/useDMStore";
import { usePresenceStore } from "@/store/usePresenceStore";
import { GlassModal } from "@/components/layout/GlassModal";

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

interface SearchResult {
  id: string;
  nickname: string;
  avatar: string | null;
  lastSeen: number;
}

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserSearchModal({ isOpen, onClose }: UserSearchModalProps) {
  const router = useRouter();
  const myUserId = useUserStore((s) => s.id);
  const isOnline = usePresenceStore((s) => s.isOnline);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
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
          // Filter out self
          setResults(data.filter((u: SearchResult) => u.id !== myUserId));
        }
      } catch (err) {
        console.error("Search failed:", err);
      }
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, myUserId]);

  const handleSelect = async (user: SearchResult) => {
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
        onClose();
        router.push(`/dm/${conv.id}`);
      }
    } catch (err) {
      console.error("Failed to start DM:", err);
    }
  };

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="Find Users">
      {/* Search input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by nickname..."
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

      {/* Results */}
      <div className="max-h-64 overflow-y-auto space-y-1">
        {loading && (
          <div className="text-center py-4">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-4">
            No users found
          </p>
        )}

        {results.map((user) => {
          const online = isOnline(user.id);
          return (
            <button
              key={user.id}
              onClick={() => handleSelect(user)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
            >
              <div className="relative flex-shrink-0">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.nickname}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {user.nickname.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-900 ${
                    online ? "bg-green-500" : "bg-gray-600"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.nickname}</p>
                <p className="text-xs text-gray-500">
                  {online ? "Online" : "Offline"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </GlassModal>
  );
}
