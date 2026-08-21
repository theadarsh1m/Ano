"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useDMStore } from "@/store/useDMStore";
import { socketService } from "@/lib/socket";
import { ConversationList } from "@/components/dm/ConversationList";
import { UserSearchModal } from "@/components/profile/UserSearchModal";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  MessageSquare,
  Lock,
  Gamepad2,
  LogOut,
  Home,
  UserPlus,
  Newspaper,
  Bookmark,
  Menu,
  X,
  Bug,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ReportBugModal } from "@/components/feedback/ReportBugModal";

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { id: userId, nickname, avatar, role, logout } = useUserStore();
  const totalUnread = useDMStore((s) => s.getTotalUnreadDMs());
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);

  const handleLogout = () => {
    socketService.disconnect();
    logout();
    router.push("/");
  };

  const navItems = [
    { label: "Dashboard", icon: Home, href: "/dashboard", active: pathname === "/dashboard" },
    { label: "Games", icon: Gamepad2, href: "/dashboard/games", active: pathname?.startsWith("/dashboard/games") ?? false },
    { label: "Feed", icon: Newspaper, href: "/feed", active: pathname?.startsWith("/feed") ?? false },
    { label: "Rooms", icon: MessageSquare, href: "/dashboard/rooms", active: pathname === "/dashboard/rooms" },
    { label: "Saved Posts", icon: Bookmark, href: "/feed/saved", active: pathname === "/feed/saved" },
    { label: "About", icon: Sparkles, href: "/dashboard/about", active: pathname === "/dashboard/about" },
  ];

  if (role === 'SUPER_ADMIN') {
    navItems.push({
      label: "Admin Portal",
      icon: Lock,
      href: "/admin",
      active: pathname?.startsWith("/admin") ?? false
    });
  }

  const navigateTo = (href: string) => {
    router.push(href);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigateTo("/dashboard")}
        >
          <img src="/ano-logo.png" alt="Ano Logo" className="w-7 h-7 object-contain" />
          <h1 className="text-xl font-bold text-white tracking-wide">
            Ano
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          {/* Close button only on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-2 py-3 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.href}
            onClick={() => navigateTo(item.href)}
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

        {/* Report a Bug Button */}
        <button
          onClick={() => setBugOpen(true)}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/5 transition-all mt-4 border border-dashed border-red-500/10 hover:border-red-500/20"
        >
          <Bug className="w-4 h-4 text-red-450" />
          Report a Bug
        </button>
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
      <div className="p-3 border-t border-white/5 pb-safe">
        <div className="flex items-center gap-3">
          <button
            onClick={() => userId && navigateTo(`/profile/${userId}`)}
            className="flex-shrink-0"
          >
            <UserAvatar
              src={avatar}
              nickname={nickname}
              size="w-9 h-9"
              className="ring-2 ring-white/10 hover:ring-blue-500/50 transition-all"
            />
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
    </>
  );

  return (
    <>
      {/* Mobile hamburger button — only shown when drawer is closed */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-colors shadow-lg"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {/* Desktop sidebar — always visible on md+ */}
      <aside className="hidden md:flex w-72 h-full flex-col bg-black/40 backdrop-blur-md border-r border-white/5 flex-shrink-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile slide-out drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col bg-neutral-900/95 backdrop-blur-xl border-r border-white/10 shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <UserSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <ReportBugModal isOpen={bugOpen} onClose={() => setBugOpen(false)} />
    </>
  );
}
