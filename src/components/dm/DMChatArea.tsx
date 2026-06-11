"use client";

import { useEffect, useRef, useState } from "react";
import { DMMessage, useDMStore } from "@/store/useDMStore";
import { useUserStore } from "@/store/useUserStore";
import { FileCard } from "@/components/room/FileCard";
import { ImageLightbox } from "@/components/room/ImageLightbox";

interface DMChatAreaProps {
  conversationId: string;
}

export function DMChatArea({ conversationId }: DMChatAreaProps) {
  const messages = useDMStore((s) => s.dmMessages[conversationId]) || [];
  const typingUsers = useDMStore((s) => s.dmTypingUsers[conversationId]) || [];
  const userId = useUserStore((s) => s.id);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  const renderContent = (msg: DMMessage) => {
    if (msg.type === "image" && msg.fileUrl) {
      return (
        <div className="mt-1">
          {msg.content && <p className="break-words mb-2">{msg.content}</p>}
          <button
            onClick={() => setLightboxSrc(msg.fileUrl!)}
            className="block rounded-lg overflow-hidden max-w-[300px] cursor-pointer hover:opacity-90 transition-opacity"
          >
            <img
              src={msg.fileUrl}
              alt={msg.fileName || "Image"}
              className="w-full h-auto rounded-lg"
              loading="lazy"
            />
          </button>
          {msg.fileName && (
            <p className="text-[10px] text-gray-500 mt-1">{msg.fileName}</p>
          )}
        </div>
      );
    }

    if (msg.type === "file" && msg.fileUrl) {
      return (
        <div className="mt-1">
          {msg.content && <p className="break-words mb-2">{msg.content}</p>}
          <FileCard
            fileName={msg.fileName || "Unknown file"}
            fileSize={msg.fileSize || 0}
            fileUrl={msg.fileUrl}
            fileType={msg.fileType || "application/octet-stream"}
          />
        </div>
      );
    }

    return <p className="break-words">{msg.content}</p>;
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No messages yet. Say hi! 👋</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === userId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-end gap-2 max-w-[80%]">
                  {!isMe && (
                    <div className="flex-shrink-0">
                      {msg.senderAvatar ? (
                        <img
                          src={msg.senderAvatar}
                          alt={msg.senderName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                          {msg.senderName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && (
                      <span className="text-xs text-gray-400 mb-1 ml-1">
                        {msg.senderName}
                      </span>
                    )}
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isMe
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-white/10 text-gray-200 rounded-bl-sm border border-white/5"
                      }`}
                    >
                      {renderContent(msg)}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-400 italic py-2 pl-10">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span>{typingUsers[0]} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ImageLightbox
        src={lightboxSrc || ""}
        isOpen={!!lightboxSrc}
        onClose={() => setLightboxSrc(null)}
      />
    </>
  );
}
