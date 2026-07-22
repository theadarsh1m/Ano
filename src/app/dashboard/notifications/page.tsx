"use client";

import { API_URL } from "@/lib/config";
import { useState } from "react";
import { GlassCard } from "@/components/layout/GlassCard";
import { useNotificationStore, AppNotification } from "@/store/useNotificationStore";
import { useUserStore } from "@/store/useUserStore";
import { Bell, Check, Users, MessageSquare, AtSign, Settings, Megaphone, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const userId = useUserStore((s) => s.id);
  const router = useRouter();
  const [filter, setFilter] = useState("all");

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "mentions") return n.type === "mention";
    if (filter === "invites") return n.type === "room_invite";
    return true;
  });

  const handleMarkAsRead = async (id: string) => {
    try {
      markAsRead(id);
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      markAllAsRead();
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAction = (notification: AppNotification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }

    if (notification.type === "room_invite") {
      if (notification.metadata?.gameId) {
        const gameTypeMap: Record<string, string> = { 'BLUFF': 'bluff', 'MEMORY_MATCH': 'memory-match', 'DOTS_AND_BOXES': 'dots-and-boxes' };
        const gameTypeKey = typeof notification.metadata?.gameType === 'string' ? notification.metadata.gameType : '';
        const gamePath = gameTypeMap[gameTypeKey] || 'bluff';
        router.push(`/dashboard/games/${gamePath}?gameId=${notification.metadata.gameId}`);
      } else if (notification.metadata?.roomId) {
        router.push(`/room/${notification.metadata.roomId}`);
      }
    } else if (notification.type === "mention") {
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
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "friend_request":
      case "friend_accepted": return <Users className="w-5 h-5 text-blue-400" />;
      case "dm": return <MessageSquare className="w-5 h-5 text-purple-400" />;
      case "mention": return <AtSign className="w-5 h-5 text-yellow-400" />;
      case "room_invite": return <Megaphone className="w-5 h-5 text-green-400" />;
      default: return <Settings className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col h-full overflow-hidden p-4 md:p-8 space-y-6">
      {/* Main Navbar Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <div className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-white tracking-wide block leading-tight">
                  Ano
                </span>
                <span className="text-xs text-gray-400">Notification Center</span>
              </div>
            </div>
          </Link>
        </div>

        <Link href="/dashboard">
          <Button
            variant="ghost"
            className="text-gray-400 hover:text-white text-xs sm:text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </Link>
      </div>

      {/* Subheader Title & Mark All Read */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-3">
            <Bell className="w-7 h-7 text-blue-400" />
            Notifications
          </h1>
          <p className="text-gray-400 text-sm">
            You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs sm:text-sm text-white transition-colors font-medium"
          >
            <Check className="w-4 h-4 text-blue-400" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {["all", "unread", "mentions", "invites"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? "bg-blue-500 text-white"
                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <GlassCard className="flex-1 overflow-y-auto p-0">
        {filteredNotifications.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-gray-500">
            <Bell className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg">No notifications found.</p>
            <p className="text-sm">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredNotifications.map((notif, i) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleAction(notif)}
                className={`p-4 md:p-6 flex gap-4 cursor-pointer transition-colors group ${
                  !notif.isRead ? "bg-blue-500/5 hover:bg-blue-500/10" : "hover:bg-white/5"
                }`}
              >
                <div className="flex-shrink-0 mt-1 p-3 bg-black/20 rounded-full h-fit">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className={`font-medium ${!notif.isRead ? "text-white" : "text-gray-300"}`}>
                      {notif.title}
                    </h3>
                    <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className={`text-sm ${!notif.isRead ? "text-gray-300" : "text-gray-500"}`}>
                    {notif.message}
                  </p>
                </div>
                {!notif.isRead && (
                  <div className="flex-shrink-0 self-center">
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
