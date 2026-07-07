"use client";
import { API_URL } from "@/lib/config";

import { useEffect, useState } from "react";
import { useRoomStore, Room } from "@/store/useRoomStore";
import { RoomCard } from "@/components/room/RoomCard";
import { CreateRoomModal } from "@/components/room/CreateRoomModal";
import { JoinRoomModal } from "@/components/room/JoinRoomModal";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, KeyRound, Loader2, Globe, Lock, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";



export default function RoomsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"public" | "private">("public");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  // Store variables
  const { rooms: publicRooms, loading: publicLoading, error: publicError, fetchPublicRooms, joinedRoomIds } = useRoomStore();
  const [privateRooms, setPrivateRooms] = useState<Room[]>([]);
  const [privateLoading, setPrivateLoading] = useState(true);

  // Fetch Public Rooms
  useEffect(() => {
    fetchPublicRooms();
  }, [fetchPublicRooms]);

  // Fetch Private Rooms
  useEffect(() => {
    const fetchPrivateRooms = async () => {
      if (joinedRoomIds.length === 0) {
        setPrivateRooms([]);
        setPrivateLoading(false);
        return;
      }

      setPrivateLoading(true);
      try {
        const roomPromises = joinedRoomIds.map((id) =>
          fetch(`${API_URL}/api/rooms/${id}`).then((res) => (res.ok ? res.json() : null))
        );
        const roomsResult = await Promise.all(roomPromises);
        setPrivateRooms(roomsResult.filter(Boolean));
      } catch (err) {
        console.error('Failed to fetch private rooms:', err);
      } finally {
        setPrivateLoading(false);
      }
    };

    fetchPrivateRooms();
  }, [joinedRoomIds]);

  const handleJoinRoom = (roomId: string) => {
    router.push(`/room/${roomId}`);
  };

  return (
    <main className="flex-1 p-6 md:p-12 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => router.push("/dashboard")}
                className="text-muted-foreground hover:text-white px-2 rounded-full h-8 w-8 flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <div 
                onClick={() => router.push("/dashboard")} 
                className="flex items-center gap-3 cursor-pointer group hover:opacity-85 transition-opacity"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold text-white tracking-wide">Ano</span>
              </div>
            </div>

            <div className="mt-2">
              <h1 className="text-3xl font-bold text-white">Chat Rooms</h1>
              <p className="text-muted-foreground mt-1">Join an open conversation or access your private spaces.</p>
            </div>
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
              className="flex-1 md:flex-none bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Room
            </Button>
          </div>
        </motion.div>

        {/* Tab buttons */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab("public")}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "public" ? "text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {activeTab === "public" && (
              <motion.div
                layoutId="activeRoomTab"
                className="absolute inset-0 bg-white/10 rounded-lg border border-white/10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Public Rooms
            </span>
          </button>
          <button
            onClick={() => setActiveTab("private")}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "private" ? "text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {activeTab === "private" && (
              <motion.div
                layoutId="activeRoomTab"
                className="absolute inset-0 bg-white/10 rounded-lg border border-white/10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Private Rooms
            </span>
          </button>
        </div>

        {/* Room grid */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="min-h-[400px]"
        >
          {activeTab === "public" ? (
            publicLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
            ) : publicError ? (
              <div className="text-center py-20 bg-red-500/5 rounded-2xl border border-red-500/10">
                <p className="text-red-400">Failed to load public rooms.</p>
                <Button 
                  variant="link" 
                  onClick={() => fetchPublicRooms()}
                  className="text-blue-400 mt-2"
                >
                  Try again
                </Button>
              </div>
            ) : publicRooms.length > 0 ? (
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
            )
          ) : (
            privateLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
            ) : privateRooms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {privateRooms.map((room) => (
                  <RoomCard 
                    key={room.id} 
                    room={room} 
                    onClick={() => handleJoinRoom(room.id)} 
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-muted-foreground">You haven't joined any private rooms yet.</p>
                <p className="text-sm text-gray-500 mt-2">Create one or join using a code.</p>
              </div>
            )
          )}
        </motion.div>
      </div>

      <CreateRoomModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        defaultType={activeTab}
      />
      
      <JoinRoomModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </main>
  );
}
