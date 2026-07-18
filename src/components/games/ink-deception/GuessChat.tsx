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
    });

    return () => {
      socket.off("receive_message", onReceiveMessage);
    };
  }, [activeGameId]);

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

  return (
    <div className="flex flex-col h-full bg-[#111827]/70 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
      {/* Scroll decor top */}
      <div className="absolute top-0 left-0 w-full h-1 bg-[#FF5DA8]" />

      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#FF5DA8]" />
          <span className="text-xs font-mono font-bold tracking-widest text-[#FAF8F5]">
            COMMUNICATIONS
          </span>
        </div>
        
        {/* Floating Sound Controller */}
        <button
          onClick={handleMuteToggle}
          className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[#B7C0D8] hover:text-[#FAF8F5] transition-colors cursor-pointer"
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
                ? "mx-auto text-center"
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
              className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed font-medium ${
                m.isSystem
                  ? "bg-slate-900/50 border border-slate-800/40 text-amber-500/80 font-mono tracking-wide py-1.5"
                  : m.userId === userId
                  ? "bg-[#FF5DA8]/10 border border-[#FF5DA8]/30 text-[#FAF8F5] rounded-tr-none"
                  : "bg-slate-800/70 border border-slate-800 text-[#B7C0D8] rounded-tl-none"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input cabinet */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
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
              className="flex-1 bg-[#1b2334] border border-slate-800 focus:border-[#FF5DA8] rounded-xl px-4 py-2.5 text-xs text-[#FAF8F5] outline-none placeholder:text-slate-600 transition-colors"
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
