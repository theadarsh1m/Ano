"use client";

import { useEffect, useRef, useState } from "react";
import { DMMessage, useDMStore } from "@/store/useDMStore";
import { useUserStore } from "@/store/useUserStore";
import { FileCard } from "@/components/room/FileCard";
import { ImageLightbox } from "@/components/room/ImageLightbox";
import { SafeMedia } from "@/components/ui/SafeMedia";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Loader2, AlertCircle } from "lucide-react";

interface DMChatAreaProps {
  conversationId: string;
}

export function DMChatArea({ conversationId }: DMChatAreaProps) {
  const rawMessages = useDMStore((s) => s.dmMessages[conversationId]);
  const rawTyping = useDMStore((s) => s.dmTypingUsers[conversationId]);
  const messages = rawMessages || [];
  const typingUsers = rawTyping || [];
  const userId = useUserStore((s) => s.id);

  const messagesCount = messages.length;
  const typingCount = typingUsers.length;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesCount, typingCount]);

  const renderContent = (msg: DMMessage) => {
    if (msg.type === "image" && msg.fileUrl) {
      return (
        <div className="mt-1">
          {msg.content && <p className="break-words mb-2">{msg.content}</p>}
          <div className="relative max-w-[300px]">
            {/* Image Scanning Overlay Badge */}
            {['PENDING', 'SCANNING'].includes(msg.moderationStatus || '') && (
              <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold text-blue-400 border border-blue-500/20 flex items-center gap-1 z-10 shadow-md select-none">
                <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                <span>Scanning...</span>
              </div>
            )}
            {msg.moderationStatus === 'SCANNING_FAILED' && (
              <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold text-amber-500 border border-amber-500/20 flex items-center gap-1 z-10 shadow-md select-none">
                <AlertCircle className="w-3 h-3 text-amber-500" />
                <span>Scanning failed (retrying)</span>
              </div>
            )}
            <SafeMedia
              src={msg.fileUrl}
              moderationStatus={msg.moderationStatus}
              nudityScore={msg.nudityScore}
              goreScore={msg.goreScore}
              mediaId={`dm_${msg.id}`}
              alt={msg.fileName || "Image"}
              className="block rounded-lg overflow-hidden max-w-[300px] cursor-pointer hover:opacity-90 transition-opacity w-full h-auto"
              onClick={() => setLightboxSrc(msg.fileUrl!)}
            />
          </div>
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
                      <UserAvatar
                        src={msg.senderAvatar}
                        nickname={msg.senderName}
                        size="w-8 h-8"
                      />
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
                    <span className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {isMe && (
                        <span className={msg.isRead ? "text-blue-400 font-medium" : "text-gray-500"}>
                          • {msg.isRead ? "Seen" : "Sent"}
                        </span>
                      )}
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
