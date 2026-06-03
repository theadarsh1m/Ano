"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { socketService } from "@/lib/socket";
import { useUserStore } from "@/store/useUserStore";
import { v4 as uuidv4 } from "uuid";

interface MessageInputProps {
  roomId: string;
}

export function MessageInput({ roomId }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const { id: userId, nickname } = useUserStore();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const socket = socketService.getSocket();

  const handleTyping = () => {
    if (!socket || !userId || !nickname) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    } else {
      // Emit typing start if we weren't typing before
      socket.emit("typing_start", { roomId, nickname });
    }

    // Set timeout to stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing_stop", { roomId, nickname });
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    handleTyping();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !socket || !userId || !nickname) return;

    const newMsg = {
      id: uuidv4(),
      roomId,
      senderId: userId,
      senderName: nickname,
      content: message.trim(),
      timestamp: Date.now(),
    };

    socket.emit("send_message", newMsg);
    
    // Stop typing indicator immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    socket.emit("typing_stop", { roomId, nickname });

    setMessage("");
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-black/20 border-t border-white/5">
      <div className="relative flex items-center">
        <input
          type="text"
          value={message}
          onChange={handleChange}
          placeholder="Type a message..."
          className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-4 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!message.trim()}
          className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
