"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { UserProfileCard } from "@/components/profile/UserProfileCard";
import { GlassCard } from "@/components/layout/GlassCard";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const profileUserId = params.userId as string;
  const myUserId = useUserStore((s) => s.id);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !myUserId) {
      router.push("/");
    }
  }, [isClient, myUserId, router]);

  if (!isClient) {
    return (
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-h-screen">
      <AppSidebar />

      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <GlassCard>
            <UserProfileCard userId={profileUserId} />
          </GlassCard>
        </motion.div>
      </main>
    </div>
  );
}
