"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/layout/GlassCard";
import { motion } from "framer-motion";

export default function Home() {
  const router = useRouter();
  const { id, login } = useUserStore();
  const [nickname, setNickname] = useState("");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && id) {
      router.push("/dashboard");
    }
  }, [isClient, id, router]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim()) {
      login(nickname.trim());
      router.push("/dashboard");
    }
  };

  if (!isClient) return null; // Prevent hydration mismatch
  if (id) return null; // Redirecting

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <GlassCard className="flex flex-col gap-6 text-center">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-white">Ano</h1>
            <p className="text-muted-foreground">
              A real-time platform for students to chat, collaborate, and play games.
            </p>
          </div>

          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <Input
              type="text"
              placeholder="Enter your nickname..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="bg-black/20 border-white/10 text-white placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-white/30 h-12"
              required
            />
            <Button
              type="submit"
              className="w-full glass-button h-12 text-md font-semibold text-white"
              disabled={!nickname.trim()}
            >
              Join Now
            </Button>
          </form>
        </GlassCard>
      </motion.div>
    </main>
  );
}
