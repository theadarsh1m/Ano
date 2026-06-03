"use client";

import { useState } from "react";
import { GlassModal } from "@/components/layout/GlassModal";
import { Button } from "@/components/ui/button";
import { useRoomStore } from "@/store/useRoomStore";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JoinRoomModal({ isOpen, onClose }: JoinRoomModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const { addJoinedRoom } = useRoomStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!code.trim() || isJoining) return;

    setIsJoining(true);
    
    try {
      // Validate the room code against the server
      const res = await fetch(`${API_URL}/api/rooms/${code.trim().toUpperCase()}`);
      
      if (!res.ok) {
        setError("Invalid room code. Please check and try again.");
        setIsJoining(false);
        return;
      }

      const room = await res.json();
      
      // Track that we've joined this private room
      addJoinedRoom(room.id);

      setCode("");
      onClose();
      router.push(`/room/${room.id}`);
    } catch {
      setError("Could not connect to the server. Please try again.");
    }
    
    setIsJoining(false);
  };

  return (
    <GlassModal isOpen={isOpen} onClose={() => {
      setError("");
      setCode("");
      onClose();
    }} title="Join Private Room">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Room Code</label>
          <input
            type="text"
            required
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError("");
            }}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 uppercase text-center tracking-widest font-mono text-lg"
            placeholder="ABCDEF"
          />
          {error && (
            <p className="text-red-400 text-sm mt-1">{error}</p>
          )}
        </div>

        <div className="pt-4 flex gap-3">
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="w-full bg-purple-500 hover:bg-purple-600 text-white"
            disabled={!code.trim() || isJoining}
          >
            {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join Room"}
          </Button>
        </div>
      </form>
    </GlassModal>
  );
}
