"use client";

import { API_URL } from "@/lib/config";
import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, Check, Users, MessageSquare, AtSign, Settings, Megaphone } from "lucide-react";
import { useNotificationStore, AppNotification } from "@/store/useNotificationStore";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { getNotificationDetails } from "@/lib/notificationRoutes";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const userId = useUserStore((s) => s.id);

  // Request browser notification permission once
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Handle Mark All as Read
  const handleMarkAllAsRead = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    markAllAsRead();
    if (!userId) return;
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  }, [markAllAsRead, userId]);

  // Toggle panel & clear unread indicator immediately upon opening
  const togglePanel = () => {
    const nextOpenState = !isOpen;
    setIsOpen(nextOpenState);
    if (nextOpenState && unreadCount > 0) {
      handleMarkAllAsRead();
    }
  };

  // Close dropdown on click/tap outside & Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      markAsRead(id);
      if (userId) {
        await fetch(`${API_URL}/api/notifications/${id}/read`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }

    const details = getNotificationDetails(notification);
    if (details.destination) {
      router.push(details.destination);
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

  const displayNotifs = notifications.slice(0, 5);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={togglePanel}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className="relative p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#1a1b1e] animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed top-14 left-4 right-4 sm:left-auto sm:right-4 max-w-sm mx-auto md:absolute md:top-full md:left-0 md:right-auto md:mt-2 md:mx-0 w-full md:w-80 bg-[#121315]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100]"
          >
            <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-black/40">
              <h3 className="font-semibold text-white text-sm">Notifications</h3>
              {notifications.some((n) => !n.isRead) && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors font-medium"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[60vh] md:max-h-80 overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
              {displayNotifs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">No notifications yet</p>
                </div>
              ) : (
                displayNotifs.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 cursor-pointer transition-colors flex gap-3 ${
                      !notif.isRead ? "bg-blue-500/10 hover:bg-blue-500/20" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0 p-2 bg-white/5 rounded-xl h-fit">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white mb-0.5 leading-snug">
                        {notif.title}
                      </p>
                      <p className="text-xs text-gray-300 leading-normal line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1 font-medium">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <div className="flex-shrink-0 self-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-2 border-t border-white/10 bg-black/40">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/dashboard/notifications");
                }}
                className="w-full py-2 text-xs font-semibold text-center text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/5"
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
