"use client";

import { useEffect, useState, useRef } from "react";
import { useVoiceStore, VoiceChannel } from "@/store/useVoiceStore";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Volume2, VolumeX, Mic, MicOff, PhoneOff, Plus, Trash2 } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";

export function VoiceChannelList({ roomId, isOwner }: { roomId: string, isOwner: boolean }) {
  const { connectedChannelId, connect, disconnect, isMuted, toggleMute, voiceError, setVoiceError } = useVoiceStore();
  const { globalVoiceUsers, activeSpeakers, localStream, streams } = useWebRTC();
  const myUserId = useUserStore((s) => s.id);
  const myNickname = useUserStore((s) => s.nickname);

  const handleJoin = () => {
    if (connectedChannelId === roomId) {
      disconnect();
    } else {
      setVoiceError(null);
      connect(roomId);
    }
  };

  const isActive = connectedChannelId === roomId;
  
  // Show global voice users
  const members = globalVoiceUsers;

  return (
    <div className="flex flex-col h-full bg-white/5 border border-white/10 rounded-2xl overflow-hidden w-full flex-shrink-0">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Voice Channel</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-2">
          <div 
            onClick={handleJoin}
            className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors ${isActive ? 'bg-blue-500/20 text-white' : 'hover:bg-white/5 text-gray-400 hover:text-gray-200'}`}
          >
            <div className="flex items-center gap-2">
              {isActive ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4" />}
              <span className="text-sm font-medium">Room Voice</span>
            </div>
          </div>

          {/* Error Message */}
          {voiceError && (
            <div className="mt-2 text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
              {voiceError}
            </div>
          )}

          {/* Connected Users List */}
          {members.length > 0 && (
            <div className="ml-6 mt-1 space-y-1 border-l border-white/10 pl-2">
              {members.map(member => {
                const isSpeaking = activeSpeakers.includes(member.userId!);
                const isMe = member.userId === myUserId;
                return (
                  <div key={member.userId} className="flex items-center gap-2 py-1">
                    <div className={`w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[8px] font-bold text-white transition-all duration-150 ${isSpeaking ? 'ring-2 ring-green-500 scale-110' : ''}`}>
                      {member.nickname?.substring(0, 2).toUpperCase()}
                    </div>
                    <span className={`text-xs ${isSpeaking ? 'text-white font-medium' : 'text-gray-400'}`}>
                      {member.nickname} {isMe && "(You)"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Hidden audio elements for remote streams */}
      <div className="hidden">
        {Object.entries(streams).map(([userId, stream]) => (
          <AudioPlayer key={userId} stream={stream} />
        ))}
      </div>

      {/* Voice Controls Bar */}
      {connectedChannelId === roomId && (
        <div className="p-3 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Voice Connected
            </span>
            <span className="text-[10px] text-gray-500 truncate max-w-[100px]">
              Room Voice
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={toggleMute}
              className={`p-2 rounded-md transition-colors ${isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button 
              onClick={disconnect}
              className="p-2 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              title="Disconnect"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AudioPlayer({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
}
