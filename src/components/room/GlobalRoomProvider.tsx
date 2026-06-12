"use client";

import { useEffect } from "react";
import { useRoomConnectionStore } from "@/store/useRoomConnectionStore";
import { useChatStore } from "@/store/useChatStore";
import { useUserStore } from "@/store/useUserStore";
import { socketService } from "@/lib/socket";
import { RoomOverlayPopup } from "@/components/room/RoomOverlayPopup";

export function GlobalRoomProvider({ children }: { children: React.ReactNode }) {
  const currentRoomId = useRoomConnectionStore(state => state.currentRoomId);
  const { id: userId, nickname, isAnonymous } = useUserStore();
  
  const setConnectionStatus = useChatStore(state => state.setConnectionStatus);
  const addMessage = useChatStore(state => state.addMessage);
  const setMessages = useChatStore(state => state.setMessages);
  const addTypingUser = useChatStore(state => state.addTypingUser);
  const removeTypingUser = useChatStore(state => state.removeTypingUser);
  const setActiveUsers = useChatStore(state => state.setActiveUsers);
  const clearChat = useChatStore(state => state.clearChat);

  useEffect(() => {
    if (!currentRoomId || !userId || !nickname) return;

    const socket = socketService.connect();

    const onConnect = () => setConnectionStatus(true);
    const onDisconnect = () => setConnectionStatus(false);
    
    const onReceiveMessage = (message: any) => {
      addMessage(message);
    };

    const onChatHistory = (history: any[]) => {
      setMessages(currentRoomId, history);
    };

    const onUserTyping = ({ nickname: typingNickname, isTyping }: { nickname: string, isTyping: boolean }) => {
      if (isTyping) {
        addTypingUser(currentRoomId, typingNickname);
      } else {
        removeTypingUser(currentRoomId, typingNickname);
      }
    };

    const onRoomUsers = (users: any[]) => {
      setActiveUsers(currentRoomId, users);
    };

    setConnectionStatus(socket.connected);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("receive_message", onReceiveMessage);
    socket.on("chat_history", onChatHistory);
    socket.on("user_typing", onUserTyping);
    socket.on("room_users", onRoomUsers);

    socket.emit("join_room", { roomId: currentRoomId, userId, nickname, isAnonymous });

    return () => {
      socket.emit("leave_room");
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("receive_message", onReceiveMessage);
      socket.off("chat_history", onChatHistory);
      socket.off("user_typing", onUserTyping);
      socket.off("room_users", onRoomUsers);
      clearChat(currentRoomId);
    };
  }, [currentRoomId, userId, nickname, isAnonymous, setConnectionStatus, addMessage, setMessages, addTypingUser, removeTypingUser, setActiveUsers, clearChat]);

  return (
    <>
      {children}
      <RoomOverlayPopup />
    </>
  );
}
