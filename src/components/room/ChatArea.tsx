"use client";

import { useEffect, useRef } from "react";
import { Message, useChatStore } from "@/store/useChatStore";
import { useUserStore } from "@/store/useUserStore";

interface ChatAreaProps {
  roomId: string;
}

export function ChatArea({ roomId }: ChatAreaProps) {
  const roomMessages = useChatStore((state) => state.messages[roomId]) || [];
  const currentTyping = useChatStore((state) => state.typingUsers[roomId]) || [];
  const userId = useUserStore((state) => state.id);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [roomMessages, currentTyping]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {roomMessages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>No messages yet. Be the first to say hi!</p>
        </div>
      ) : (
        roomMessages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="text-center py-2">
                <span className="text-xs bg-white/5 text-gray-400 px-3 py-1 rounded-full border border-white/5">
                  {msg.content}
                </span>
              </div>
            );
          }

          const isMe = msg.senderId === userId;

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-end gap-2 max-w-[80%]">
                {!isMe && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {msg.senderName.substring(0, 2).toUpperCase()}
                  </div>
                )}
                
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <span className="text-xs text-gray-400 mb-1 ml-1">{msg.senderName}</span>
                  )}
                  <div 
                    className={`px-4 py-2 rounded-2xl ${
                      isMe 
                        ? 'bg-blue-600 text-white rounded-br-sm' 
                        : 'bg-white/10 text-gray-200 rounded-bl-sm border border-white/5'
                    }`}
                  >
                    <p className="break-words">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Typing Indicators */}
      {currentTyping.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-400 italic py-2 pl-10">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>
            {currentTyping.length === 1 
              ? `${currentTyping[0]} is typing...` 
              : currentTyping.length === 2 
                ? `${currentTyping[0]} and ${currentTyping[1]} are typing...` 
                : 'Several people are typing...'}
          </span>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
}
