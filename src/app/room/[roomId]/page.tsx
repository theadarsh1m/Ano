"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoomStore, Room } from "@/store/useRoomStore";
import { useUserStore } from "@/store/useUserStore";
import { useChatStore } from "@/store/useChatStore";
import { socketService } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { LogOut, Lock, Unlock, Copy, Check, Wifi, WifiOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/layout/GlassCard";
import { ChatArea } from "@/components/room/ChatArea";
import { MessageInput } from "@/components/room/MessageInput";
import { OnlineUsersSidebar } from "@/components/room/OnlineUsersSidebar";
import { DropZone } from "@/components/room/DropZone";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  
  const [isClient, setIsClient] = useState(false);
  const [copied, setCopied] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  
  const { fetchRoom, removeJoinedRoom } = useRoomStore();
  const { id: userId, nickname, isAnonymous } = useUserStore();
  
  const isConnected = useChatStore(state => state.isConnected);
  const setConnectionStatus = useChatStore(state => state.setConnectionStatus);
  const addMessage = useChatStore(state => state.addMessage);
  const setMessages = useChatStore(state => state.setMessages);
  const addTypingUser = useChatStore(state => state.addTypingUser);
  const removeTypingUser = useChatStore(state => state.removeTypingUser);
  const setActiveUsers = useChatStore(state => state.setActiveUsers);
  const clearChat = useChatStore(state => state.clearChat);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch room data from server
  useEffect(() => {
    if (!isClient) return;
    
    const loadRoom = async () => {
      setRoomLoading(true);
      const fetchedRoom = await fetchRoom(roomId);
      setRoom(fetchedRoom);
      setRoomLoading(false);
    };

    loadRoom();
  }, [isClient, roomId, fetchRoom]);

  // Socket.IO connection lifecycle
  useEffect(() => {
    if (!isClient || !userId || !nickname || !room) return;

    const socket = socketService.connect();

    const onConnect = () => setConnectionStatus(true);
    const onDisconnect = () => setConnectionStatus(false);
    
    const onReceiveMessage = (message: any) => {
      addMessage(message);
    };

    const onChatHistory = (history: any[]) => {
      setMessages(roomId, history);
    };

    const onUserTyping = ({ nickname: typingNickname, isTyping }: { nickname: string, isTyping: boolean }) => {
      if (isTyping) {
        addTypingUser(roomId, typingNickname);
      } else {
        removeTypingUser(roomId, typingNickname);
      }
    };

    const onRoomUsers = (users: any[]) => {
      setActiveUsers(roomId, users);
    };

    setConnectionStatus(socket.connected);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("receive_message", onReceiveMessage);
    socket.on("chat_history", onChatHistory);
    socket.on("user_typing", onUserTyping);
    socket.on("room_users", onRoomUsers);

    socket.emit("join_room", { roomId, userId, nickname, isAnonymous });

    return () => {
      socket.emit("leave_room");
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("receive_message", onReceiveMessage);
      socket.off("chat_history", onChatHistory);
      socket.off("user_typing", onUserTyping);
      socket.off("room_users", onRoomUsers);
      clearChat(roomId);
    };
  }, [isClient, room, userId, nickname, roomId, setConnectionStatus, addMessage, setMessages, addTypingUser, removeTypingUser, setActiveUsers, clearChat]);

  useEffect(() => {
    if (isClient && !userId) {
      router.push("/");
    }
  }, [isClient, userId, router]);

  if (!isClient || roomLoading) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </main>
    );
  }

  const handleLeave = () => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit("leave_room");
    }
    if (room?.type === 'private') {
      removeJoinedRoom(roomId);
    }
    router.push("/dashboard");
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room?.inviteCode || room?.id || roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen p-6">
        <h1 className="text-2xl font-bold text-white mb-4">Room Not Found</h1>
        <p className="text-muted-foreground mb-8">The room you are trying to access does not exist.</p>
        <Button onClick={() => router.push("/dashboard")}>Return to Dashboard</Button>
      </main>
    );
  }

  const isPrivate = room.type === 'private';

  return (
    <main className="flex-1 p-4 md:p-8 min-h-[calc(100vh-80px)] flex flex-col h-screen max-h-screen">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex-shrink-0"
      >
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{room.name}</h1>
            <div className="bg-white/10 p-1.5 rounded-md">
              {isPrivate ? <Lock className="w-4 h-4 text-purple-400" /> : <Unlock className="w-4 h-4 text-blue-400" />}
            </div>
            {isConnected ? (
              <div className="flex items-center gap-1.5 ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30">
                <Wifi className="w-3 h-3" />
                <span>Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 ml-2 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full border border-red-500/30">
                <WifiOff className="w-3 h-3" />
                <span>Disconnected</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            {isPrivate && (
              <button 
                onClick={copyRoomCode}
                className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer bg-white/5 px-2 py-0.5 rounded border border-white/10"
              >
                Code: <span className="font-mono tracking-wider">{room.inviteCode || room.id}</span>
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        <Button 
          variant="destructive" 
          onClick={handleLeave}
          className="bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 border border-red-500/30"
        >
          <LogOut className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">Leave Room</span>
        </Button>
      </motion.div>

      {/* Main Content Area */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="flex-1 mt-6 flex flex-col md:flex-row gap-6 min-h-0"
      >
        {/* Chat Section */}
        <DropZone
          onFileDrop={(file) => {
            if ((window as any).__anoFileDropHandler) {
              (window as any).__anoFileDropHandler(file);
            }
          }}
          className="flex-1 flex flex-col overflow-hidden relative"
        >
          <GlassCard className="flex-1 flex flex-col p-0 overflow-hidden relative">
            <ChatArea roomId={roomId} />
            <MessageInput roomId={roomId} />
          </GlassCard>
        </DropZone>
        
        {/* Participants Sidebar */}
        <OnlineUsersSidebar roomId={roomId} />
      </motion.div>
    </main>
  );
}
