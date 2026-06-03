"use client";

import { GlassCard } from "@/components/layout/GlassCard";
import { Users, Lock, Unlock } from "lucide-react";
import { motion } from "framer-motion";
import { Room } from "@/store/useRoomStore";

interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

export function RoomCard({ room, onClick }: RoomCardProps) {
  const isPrivate = room.type === 'private';

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <GlassCard 
        onClick={onClick}
        className="cursor-pointer hover:bg-white/10 transition-colors h-full flex flex-col justify-between group"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 rounded-lg bg-white/5">
            {isPrivate ? (
              <Lock className="w-6 h-6 text-purple-400" />
            ) : (
              <Unlock className="w-6 h-6 text-blue-400" />
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-black/20 px-3 py-1 rounded-full">
            <Users className="w-4 h-4" />
            <span>Cap: {room.capacity}</span>
          </div>
        </div>
        
        <div>
          <h3 className="text-xl font-semibold text-white mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-400 transition-all">
            {room.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            Created by {room.createdBy === 'system' ? 'System' : `User ${room.createdBy?.substring(0, 8) || 'Unknown'}`}
          </p>
        </div>
      </GlassCard>
    </motion.div>
  );
}
