"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { motion } from "framer-motion";
import { MessageSquare, Lock, Gamepad2, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const router = useRouter();
  const { id, nickname, joinedAt, logout } = useUserStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !id) {
      router.push("/");
    }
  }, [isClient, id, router]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (!isClient || !id) return null;

  const joinDate = joinedAt ? new Date(joinedAt).toLocaleDateString() : "Unknown";

  const cards = [
    { title: "Public Rooms", icon: MessageSquare, href: "/dashboard/public-rooms", color: "text-blue-400" },
    { title: "Private Rooms", icon: Lock, href: "/dashboard/private-rooms", color: "text-purple-400" },
    { title: "Games", icon: Gamepad2, href: "/dashboard/games", color: "text-green-400" },
    { title: "Settings", icon: Settings, href: "/dashboard/settings", color: "text-gray-400" },
  ];

  return (
    <main className="flex-1 p-6 md:p-12 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center"
        >
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {nickname}!</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="bg-white/10 px-2 py-1 rounded-md font-mono">{id}</span>
              <span>Joined: {joinDate}</span>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
            <LogOut className="w-5 h-5 mr-2" />
            Leave
          </Button>
        </motion.div>

        {/* Grid */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8"
        >
          {cards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 * index }}
              className="h-full"
            >
              <GlassCard 
                className="group hover:bg-white/10 transition-all cursor-pointer h-full flex flex-col justify-between"
                onClick={() => router.push(card.href)}
              >
                <div className="flex items-center justify-between mb-4">
                  <card.icon className={`w-8 h-8 ${card.color} group-hover:scale-110 transition-transform`} />
                </div>
                <h3 className="text-xl font-semibold text-white">{card.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">Click to enter</p>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}
