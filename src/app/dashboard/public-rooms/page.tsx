"use client";

import { useEffect, useState } from "react";
import { useRoomStore } from "@/store/useRoomStore";
import { RoomCard } from "@/components/room/RoomCard";
import { CreateRoomModal } from "@/components/room/CreateRoomModal";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function PublicRoomsPage() {
  const [isClient, setIsClient] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { getPublicRooms, joinRoom } = useRoomStore();
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const publicRooms = isClient ? getPublicRooms() : [];

  const handleJoinRoom = (roomId: string) => {
    joinRoom(roomId);
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
            <h1 className="text-3xl font-bold text-white">Public Rooms</h1>
            <p className="text-muted-foreground mt-2">Join an open conversation with anyone.</p>
          </div>
          
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Public Room
          </Button>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {publicRooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicRooms.map((room) => (
                <RoomCard 
                  key={room.id} 
                  room={room} 
                  onClick={() => handleJoinRoom(room.id)} 
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-muted-foreground">No public rooms available right now.</p>
              <Button 
                variant="link" 
                onClick={() => setIsCreateModalOpen(true)}
                className="text-blue-400 mt-2"
              >
                Be the first to create one!
              </Button>
            </div>
          )}
        </motion.div>
      </div>

      <CreateRoomModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        defaultType="public"
      />
    </main>
  );
}
