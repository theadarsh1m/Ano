"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check, Users, MessageSquare, AtSign, Settings, Megaphone } from "lucide-react";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const userId = useUserStore((s) => s.id);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      markAsRead(id);
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      markAllAsRead();
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    
    // Route based on type
    if (notification.type === "room_invite" || notification.type === "mention") {
      if (notification.metadata?.roomId) {
        router.push(`/room/${notification.metadata.roomId}`);
      }
    } else if (notification.type === "dm") {
      if (notification.metadata?.conversationId) {
        router.push(`/dm/${notification.metadata.conversationId}`);
      }
    } else if (notification.type === "friend_request" || notification.type === "friend_accepted") {
      router.push("/dashboard/friends");
    }
    
    setIsOpen(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "friend_request":
      case "friend_accepted":
        return <Users className="w-4 h-4 text-blue-400" />;
      case "dm":
        return <MessageSquare className="w-4 h-4 text-purple-400" />;
      case "mention":
        return <AtSign className="w-4 h-4 text-yellow-400" />;
      case "room_invite":
        return <Megaphone className="w-4 h-4 text-green-400" />;
      default:
        return <Settings className="w-4 h-4 text-gray-400" />;
    }
  };

  const displayNotifs = notifications.slice(0, 5); // show max 5

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#1a1b1e]"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 mt-2 w-80 bg-[#121315] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/20">
              <h3 className="font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {displayNotifs.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                displayNotifs.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3 border-b border-white/5 cursor-pointer transition-colors flex gap-3 ${
                      !notif.isRead ? "bg-blue-500/10 hover:bg-blue-500/20" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="mt-1 flex-shrink-0">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white mb-0.5 leading-tight">{notif.title}</p>
                      <p className="text-xs text-gray-400 leading-snug line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <div className="flex-shrink-0 self-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-2 border-t border-white/10 bg-black/20">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/dashboard/notifications");
                }}
                className="w-full py-1.5 text-sm text-center text-gray-400 hover:text-white transition-colors"
              >
                View all notifications
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
