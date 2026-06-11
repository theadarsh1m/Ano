"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useDMStore } from "@/store/useDMStore";
import { socketService } from "@/lib/socket";
import { ConversationList } from "@/components/dm/ConversationList";
import { UserSearchModal } from "@/components/profile/UserSearchModal";
import {
  MessageSquare,
  Lock,
  Settings,
  LogOut,
  Home,
  UserPlus,
} from "lucide-react";

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { id: userId, nickname, avatar, logout } = useUserStore();
  const totalUnread = useDMStore((s) => s.getTotalUnreadDMs());
  const [searchOpen, setSearchOpen] = useState(false);

  const handleLogout = () => {
    socketService.disconnect();
    logout();
    router.push("/");
  };

  const navItems = [
    { label: "Dashboard", icon: Home, href: "/dashboard", active: pathname === "/dashboard" },
    { label: "Public Rooms", icon: MessageSquare, href: "/dashboard/public-rooms", active: pathname === "/dashboard/public-rooms" },
    { label: "Private Rooms", icon: Lock, href: "/dashboard/private-rooms", active: pathname === "/dashboard/private-rooms" },
    { label: "Settings", icon: Settings, href: "/dashboard/settings", active: pathname === "/dashboard/settings" },
  ];

  return (
    <>
      <aside className="w-72 h-full flex flex-col bg-black/40 backdrop-blur-md border-r border-white/5 flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-white/5">
          <h1
            className="text-xl font-bold text-white cursor-pointer hover:text-blue-400 transition-colors"
            onClick={() => router.push("/dashboard")}
          >
            Ano
          </h1>
        </div>

        {/* Navigation */}
        <div className="px-2 py-3 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all ${
                item.active
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>

        {/* DM Section */}
        <div className="flex-1 overflow-hidden flex flex-col border-t border-white/5">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              Direct Messages
              {totalUnread > 0 && (
                <span className="bg-blue-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </span>
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Find users"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <ConversationList />
          </div>
        </div>

        {/* User footer */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => userId && router.push(`/profile/${userId}`)}
              className="flex-shrink-0"
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt={nickname || ""}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-white/10 hover:ring-blue-500/50 transition-all"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white/10 hover:ring-blue-500/50 transition-all">
                  {nickname?.substring(0, 2).toUpperCase() || "?"}
                </div>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{nickname}</p>
              <p className="text-[10px] text-green-400">Online</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <UserSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
