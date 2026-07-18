"use client";

import React, { useState, useEffect, useRef } from "react";
import { useInkDeceptionStore } from "@/store/useInkDeceptionStore";
import { useUserStore } from "@/store/useUserStore";
import { socketService } from "@/lib/socket";
import { MessageSquare, Send, VolumeX, Volume2 } from "lucide-react";
import { soundService } from "./SoundService";

interface ChatMessage {
  id: string;
  userId: string;
  nickname: string;
  content: string;
  isSystem: boolean;
  timestamp: number;
}

export const GuessChat: React.FC = () => {
  const { gameState, lobby } = useInkDeceptionStore();
  const { id: userId, nickname } = useUserStore();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastLogIndexRef = useRef(0);

  const activeGameId = gameState?.gameId || lobby?.id;
  const isDrawing = gameState?.turnState === "DRAWING";

  useEffect(() => {
    Promise.resolve().then(() => {
      setIsMuted(soundService.getMutedState());
    });
  }, []);

  // Listen for generic chat messages
  useEffect(() => {
    if (!activeGameId) return;
    const socket = socketService.getSocket();

    const onReceiveMessage = (msg: { roomId: string; id?: string; senderId?: string; senderName?: string; content: string; type?: string; timestamp?: number }) => {
      // Map platform messages to our chat if they belong to this room/game session
      if (msg.roomId === activeGameId) {
        setMessages((prev) => [
          ...prev,
          {
            id: msg.id || Math.random().toString(),
            userId: msg.senderId || "system",
            nickname: msg.senderName || "System",
            content: msg.content,
            isSystem: msg.senderId === "system" || msg.type === "system",
            timestamp: msg.timestamp || Date.now()
          }
        ]);
        
        // Auto scroll to bottom
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 80);
      }
    };

    socket.on("receive_message", onReceiveMessage);
    
    // Clear chat on game load
    Promise.resolve().then(() => {
      setMessages([]);
      lastLogIndexRef.current = 0;
    });

    return () => {
      socket.off("receive_message", onReceiveMessage);
    };
  }, [activeGameId]);

  // Sync game state history logs to chat
  useEffect(() => {
    const logs = gameState?.historyLogs || [];
    if (logs.length > lastLogIndexRef.current) {
      const newLogs = logs.slice(lastLogIndexRef.current).map((log, index) => ({
        id: `sys_${Date.now()}_${lastLogIndexRef.current + index}_${Math.random()}`,
        userId: "system",
        nickname: "System",
        content: log,
        isSystem: true,
        timestamp: Date.now()
      }));

      setMessages((prev) => [...prev, ...newLogs]);
      lastLogIndexRef.current = logs.length;

      // Auto scroll
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    } else if (logs.length === 0) {
      lastLogIndexRef.current = 0;
    }
  }, [gameState?.historyLogs]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || !activeGameId || isDrawing) return;

    const socket = socketService.getSocket();
    const msgPayload = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomId: activeGameId,
      senderId: userId,
      senderName: nickname || "Player",
      content: inputVal.trim(),
      timestamp: Date.now(),
      type: "text"
    };

    socket.emit("send_message", msgPayload);
    setInputVal("");
    soundService.playClick();
  };

  const handleMuteToggle = () => {
    const muted = soundService.toggleMute();
    setIsMuted(muted);
  };

  const getMessageStyles = (m: ChatMessage) => {
    if (m.isSystem) {
      const content = m.content.toLowerCase();
      if (content.includes("correct") || (content.includes("win") && content.includes("artist")) || content.includes("guess word correct")) {
        return "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold font-mono tracking-wide py-1.5 shadow-[0_0_10px_rgba(16,185,129,0.15)]"; // Correct Guess -> Green
      }
      if (content.includes("close") || content.includes("very close") || content.includes("🟡")) {
        return "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-black font-mono tracking-wide py-1.5 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.2)]"; // Close Guess -> Yellow
      }
      if (content.includes("joined") || content.includes("connected") || content.includes("started")) {
        return "bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono tracking-wide py-1.5"; // Joined -> Blue
      }
      if (content.includes("left") || content.includes("disconnected")) {
        return "bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono tracking-wide py-1.5"; // Left -> Red
      }
      if (content.includes("seconds left") || content.includes("timer") || content.includes("time") || content.includes("warning")) {
        return "bg-amber-500/10 border border-amber-500/30 text-amber-500 font-mono tracking-wide py-1.5 animate-pulse"; // Timer Warning -> Orange
      }
      return "bg-purple-500/10 border border-purple-500/30 text-purple-400 font-mono tracking-wide py-1.5"; // Other System -> Purple
    }
    
    // Regular chat messages
    if (gameState?.activeDrawerId === m.userId && gameState?.turnState === "DRAWING") {
      return "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-medium rounded-tl-none"; // Drawer messages -> Cyan
    }
    
    if (m.userId === userId) {
      return "bg-[#FF5DA8]/10 border border-[#FF5DA8]/30 text-white rounded-tr-none";
    }
    
    return "bg-white/5 border border-white/10 text-[#B7C0D8] rounded-tl-none";
  };

  return (
    <div className="flex flex-col h-[280px] lg:h-full bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md flex-1 relative">
      {/* Scroll decor top */}
      <div className="absolute top-0 left-0 w-full h-1 bg-[#FF5DA8]" />

      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#FF5DA8]" />
          <span className="text-xs font-mono font-bold tracking-widest text-white">
            COMMUNICATIONS
          </span>
        </div>
        
        {/* Floating Sound Controller */}
        <button
          onClick={handleMuteToggle}
          className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[#B7C0D8] hover:text-white transition-colors cursor-pointer"
          title={isMuted ? "Unmute soundscape" : "Mute soundscape"}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Chat scroll viewport */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col max-w-[85%] ${
              m.isSystem
                ? "mx-auto text-center w-full"
                : m.userId === userId
                ? "ml-auto items-end"
                : "mr-auto items-start"
            }`}
          >
            {!m.isSystem && (
              <span className="text-[10px] font-mono text-slate-500 mb-1">
                {m.nickname}
              </span>
            )}
            
            <div
              className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${getMessageStyles(m)}`}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input cabinet */}
      <div className="p-3 border-t border-white/10 bg-black/20">
        {isDrawing ? (
          <div className="py-2.5 text-center text-xs font-mono font-bold tracking-wider text-rose-500/90 bg-rose-950/15 border border-rose-900/20 rounded-xl animate-pulse">
            🔒 CHAT DISABLED DURING PAINTING
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="SEND MESSAGE..."
              className="flex-1 bg-white/10 border border-white/10 focus:border-[#FF5DA8] rounded-xl px-4 py-2.5 text-xs text-white outline-none placeholder:text-slate-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputVal.trim()}
              className="p-3 bg-gradient-to-r from-[#FF5DA8] to-pink-600 hover:from-pink-500 hover:to-pink-600 text-white rounded-xl disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
export default GuessChat;
