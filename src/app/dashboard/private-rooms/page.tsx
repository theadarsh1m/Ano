"use client";

import { useEffect, useState } from "react";
import { useRoomStore } from "@/store/useRoomStore";
import { RoomCard } from "@/components/room/RoomCard";
import { CreateRoomModal } from "@/components/room/CreateRoomModal";
import { JoinRoomModal } from "@/components/room/JoinRoomModal";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function PrivateRoomsPage() {
  const [isClient, setIsClient] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const { getPrivateRooms } = useRoomStore();
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const privateRooms = isClient ? getPrivateRooms() : [];

  const handleEnterRoom = (roomId: string) => {
    router.push(`/room/${roomId}`);
  };

  if (!isClient) return null;

  return (
    <main className="flex-1 p-6 md:p-12 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <Button 
              variant="ghost" 
              onClick={() => router.push("/dashboard")}
              className="mb-4 text-muted-foreground hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-white">Private Rooms</h1>
            <p className="text-muted-foreground mt-2">Your exclusive spaces.</p>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <Button 
              onClick={() => setIsJoinModalOpen(true)}
              variant="outline"
              className="flex-1 md:flex-none border-white/10 hover:bg-white/5"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Join with Code
            </Button>
            <Button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex-1 md:flex-none bg-purple-500 hover:bg-purple-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Private Room
            </Button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {privateRooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {privateRooms.map((room) => (
                <RoomCard 
                  key={room.id} 
                  room={room} 
                  onClick={() => handleEnterRoom(room.id)} 
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-muted-foreground">You haven't joined any private rooms yet.</p>
              <p className="text-sm text-gray-500 mt-2">Create one or join using a code.</p>
            </div>
          )}
        </motion.div>
      </div>

      <CreateRoomModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        defaultType="private"
      />
      
      <JoinRoomModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </main>
  );
}
