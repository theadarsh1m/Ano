"use client";

import { useState } from "react";
import { GlassModal } from "@/components/layout/GlassModal";
import { Button } from "@/components/ui/button";
import { useRoomStore } from "@/store/useRoomStore";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/navigation";
import { Globe, Lock } from "lucide-react";

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: "public" | "private";
}

export function CreateRoomModal({ isOpen, onClose, defaultType = "public" }: CreateRoomModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"public" | "private">(defaultType);
  const createRoom = useRoomStore((state) => state.createRoom);
  const userId = useUserStore((state) => state.id);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userId) return;

    const roomId = createRoom(name.trim(), type, userId);
    
    // Reset and close
    setName("");
    onClose();
    
    // If it's a private room, we might want to show the code first, but for now just redirect
    router.push(`/room/${roomId}`);
  };

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="Create New Room">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Room Name</label>
          <input
            type="text"
            required
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            placeholder="e.g. Late Night Study"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Room Type</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setType("public")}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                type === "public"
                  ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                  : "bg-black/20 border-white/5 text-gray-400 hover:bg-white/5"
              }`}
            >
              <Globe className="w-4 h-4" />
              Public
            </button>
            <button
              type="button"
              onClick={() => setType("private")}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                type === "private"
                  ? "bg-purple-500/20 border-purple-500/50 text-purple-400"
                  : "bg-black/20 border-white/5 text-gray-400 hover:bg-white/5"
              }`}
            >
              <Lock className="w-4 h-4" />
              Private
            </button>
          </div>
        </div>

        <div className="pt-4 flex gap-3">
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="w-full bg-white text-black hover:bg-gray-200"
            disabled={!name.trim()}
          >
            Create Room
          </Button>
        </div>
      </form>
    </GlassModal>
  );
}
