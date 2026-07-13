"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { motion } from "framer-motion";
import { MessageSquare, Lock, Gamepad2, Settings, Newspaper } from "lucide-react";
import { OnlineUsersList } from "@/components/dashboard/OnlineUsersList";

export default function Dashboard() {
  const router = useRouter();
  const { id, nickname, joinedAt } = useUserStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !id) {
      router.push("/");
    }
  }, [isClient, id, router]);

  if (!isClient || !id) return null;

  const joinDate = joinedAt ? new Date(joinedAt).toLocaleDateString() : "Unknown";

  const cards = [
    { title: "Community Feed", desc: "Share thoughts, memes, and discussions", icon: Newspaper, href: "/feed", color: "from-orange-500 to-pink-600" },
    { title: "Rooms", desc: "Join public rooms or access private spaces", icon: MessageSquare, href: "/dashboard/rooms", color: "from-blue-500 to-indigo-600" },
    { title: "Games", desc: "Play games with friends", icon: Gamepad2, href: "/dashboard/games", color: "from-green-500 to-green-600" },
    { title: "Settings", desc: "Customize your experience", icon: Settings, href: "/dashboard/settings", color: "from-gray-500 to-gray-600" },
  ];

  return (
    <div className="flex h-screen max-h-screen">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto p-4 pt-14 md:pt-6 md:p-10">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
              Welcome back, {nickname}!
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="bg-white/10 px-2 py-0.5 rounded-md font-mono text-xs">
                {id}
              </span>
              <span>Joined: {joinDate}</span>
            </div>
          </motion.div>

          {/* Cards grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {cards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index + 0.2 }}
              >
                <GlassCard
                  className="group hover:bg-white/10 transition-all cursor-pointer h-full flex flex-col justify-between"
                  onClick={() => router.push(card.href)}
                >
                  <div className="flex items-center gap-4 mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <card.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                  </div>
                  <p className="text-sm text-gray-400">{card.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>

          {/* Online Users List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <OnlineUsersList />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
