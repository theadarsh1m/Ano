"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRoomConnectionStore } from "@/store/useRoomConnectionStore";
import { VoiceChannelList } from "@/components/room/VoiceChannelList";
import { ChatArea } from "@/components/room/ChatArea";
import { MessageInput } from "@/components/room/MessageInput";
import { MessageSquare, Mic, X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/layout/GlassCard";

export function RoomOverlayPopup() {
  const currentRoomId = useRoomConnectionStore(state => state.currentRoomId);
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Do not show the floating button if we are inside a room page
  if (!currentRoomId || pathname.startsWith('/room/')) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-full shadow-[0_0_20px_rgba(147,51,234,0.5)] transition-transform hover:scale-110 flex items-center justify-center ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <MessageSquare className="w-6 h-6" />
        <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 border-2 border-purple-600 rounded-full"></div>
      </button>

      {/* The Popup Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 w-[350px] sm:w-[400px] h-[600px] max-h-[85vh] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-white/5 border-b border-white/10">
              <div className="flex items-center gap-2 text-white">
                <Mic className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold">Room Connection</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/room/${currentRoomId}`)}
                  className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors"
                  title="Go to Room"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Voice & Chat Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Voice controls */}
              <div className="max-h-[30%] min-h-[120px] border-b border-white/10 flex flex-col overflow-hidden">
                <VoiceChannelList roomId={currentRoomId} isOwner={false} />
              </div>
              
              {/* Chat Panel */}
              <div className="flex-1 flex flex-col p-2 overflow-hidden bg-black/40">
                <GlassCard className="flex-1 flex flex-col p-0 overflow-hidden relative">
                  <ChatArea roomId={currentRoomId} />
                  <MessageInput roomId={currentRoomId} />
                </GlassCard>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
