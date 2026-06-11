"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useDMStore } from "@/store/useDMStore";
import { usePresenceStore } from "@/store/usePresenceStore";
import { socketService } from "@/lib/socket";
import { GlassCard } from "@/components/layout/GlassCard";
import { DMChatArea } from "@/components/dm/DMChatArea";
import { DMMessageInput } from "@/components/dm/DMMessageInput";
import { UserProfileCard } from "@/components/profile/UserProfileCard";
import { DropZone } from "@/components/room/DropZone";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

interface ConversationInfo {
  id: string;
  participantA: { id: string; nickname: string; avatar: string | null };
  participantB: { id: string; nickname: string; avatar: string | null };
}

export default function DMPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;

  const { id: userId, nickname } = useUserStore();
  const [isClient, setIsClient] = useState(false);
  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveConversation = useDMStore((s) => s.setActiveConversation);
  const setDMMessages = useDMStore((s) => s.setDMMessages);
  const addDMMessage = useDMStore((s) => s.addDMMessage);
  const markConversationAsRead = useDMStore((s) => s.markConversationAsRead);
  const addDMTypingUser = useDMStore((s) => s.addDMTypingUser);
  const removeDMTypingUser = useDMStore((s) => s.removeDMTypingUser);
  const isOnline = usePresenceStore((s) => s.isOnline);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch conversation info
  useEffect(() => {
    if (!isClient || !userId) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/dm/${conversationId}`);
        if (res.ok) {
          setConversation(await res.json());
        }
      } catch (err) {
        console.error("Failed to load conversation:", err);
      }
      setLoading(false);
    };

    load();
  }, [isClient, userId, conversationId]);

  // Socket.IO DM lifecycle
  useEffect(() => {
    if (!isClient || !userId || !nickname || !conversation) return;

    const socket = socketService.connect();

    socket.emit("join_dm", { conversationId });
    setActiveConversation(conversationId);
    markConversationAsRead(conversationId);

    // Load DM history
    const loadHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/api/dm/${conversationId}/messages`);
        if (res.ok) {
          const history = await res.json();
          setDMMessages(conversationId, history);
        }
      } catch (err) {
        console.error("Failed to load DM history:", err);
      }
    };
    loadHistory();

    const onDMReceive = (message: any) => {
      addDMMessage(conversationId, message);
    };

    const onDMTyping = ({ conversationId: cId, nickname: typingName, isTyping }: any) => {
      if (cId !== conversationId) return;
      if (isTyping) {
        addDMTypingUser(conversationId, typingName);
      } else {
        removeDMTypingUser(conversationId, typingName);
      }
    };

    socket.on("dm_receive", onDMReceive);
    socket.on("dm_user_typing", onDMTyping);

    return () => {
      socket.emit("leave_dm", { conversationId });
      socket.off("dm_receive", onDMReceive);
      socket.off("dm_user_typing", onDMTyping);
      setActiveConversation(null);
    };
  }, [isClient, conversation, userId, nickname, conversationId, setActiveConversation, setDMMessages, addDMMessage, markConversationAsRead, addDMTypingUser, removeDMTypingUser]);

  useEffect(() => {
    if (isClient && !userId) {
      router.push("/");
    }
  }, [isClient, userId, router]);

  if (!isClient || loading) {
    return (
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </main>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <h1 className="text-2xl font-bold text-white mb-4">Conversation Not Found</h1>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Return to Dashboard
          </button>
        </main>
      </div>
    );
  }

  const otherUser =
    conversation.participantA.id === userId
      ? conversation.participantB
      : conversation.participantA;

  const online = isOnline(otherUser.id);

  return (
    <div className="flex h-screen max-h-screen">
      <AppSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-3 border-b border-white/5 flex-shrink-0"
        >
          <button
            onClick={() => router.push("/dashboard")}
            className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors md:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative">
            {otherUser.avatar ? (
              <img src={otherUser.avatar} alt={otherUser.nickname} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                {otherUser.nickname.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-900 ${
                online ? "bg-green-500" : "bg-gray-600"
              }`}
            />
          </div>

          <div>
            <h2 className="text-white font-semibold">{otherUser.nickname}</h2>
            <p className={`text-xs ${online ? "text-green-400" : "text-gray-500"}`}>
              {online ? "Online" : "Offline"}
            </p>
          </div>
        </motion.div>

        {/* Chat */}
        <div className="flex-1 flex min-h-0">
          <DropZone
            onFileDrop={(file) => {
              if ((window as any).__anoDMFileDropHandler) {
                (window as any).__anoDMFileDropHandler(file);
              }
            }}
            className="flex-1 flex flex-col overflow-hidden relative"
          >
            <GlassCard className="flex-1 flex flex-col p-0 overflow-hidden relative rounded-none border-0">
              <DMChatArea conversationId={conversationId} />
              <DMMessageInput conversationId={conversationId} recipientId={otherUser.id} />
            </GlassCard>
          </DropZone>

          {/* Right sidebar — Profile card (desktop only) */}
          <div className="hidden lg:block w-72 border-l border-white/5 overflow-y-auto bg-black/20">
            <UserProfileCard userId={otherUser.id} />
          </div>
        </div>
      </main>
    </div>
  );
}
