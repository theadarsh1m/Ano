"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AnnouncementsBanner } from "@/components/layout/AnnouncementsBanner";
import { DeveloperCard } from "@/components/about/DeveloperCard";
import { getDevelopers } from "@/data/aboutData";
import { ArrowLeft, Sparkles, Gamepad2, Users, MessageSquare } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function AboutPage() {
  const [isClient, setIsClient] = useState(false);
  const developers = getDevelopers();

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return (
    <div className="flex h-screen max-h-screen">
      {/* Universal Sidebar Navigation */}
      <AppSidebar />

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto pb-16 scrollbar-hide custom-scrollbar">
        <AnnouncementsBanner />

        <div className="max-w-5xl mx-auto space-y-8 p-4 pt-14 md:pt-6 md:p-10">
          {/* Top Bar / Breadcrumb */}
          <div className="flex items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <img src="/ano-logo.png" alt="Ano Logo" className="w-9 h-9 object-contain flex-shrink-0" />
              <div>
                <span className="text-lg sm:text-xl font-bold text-white tracking-wide block leading-tight">
                  About Ano
                </span>
                <span className="text-xs text-gray-400">
                  Platform Info & Development Team
                </span>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl text-gray-400 hover:text-white text-xs sm:text-sm px-3.5 py-2 hover:bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>

          {/* Short What Really Ano Is Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] via-white/[0.03] to-transparent p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div
              className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl"
              aria-hidden="true"
            />

            <div className="relative z-10 space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-blue-400 font-semibold flex items-center gap-1.5">
                <span>—</span>
                <span>WHAT IS ANO</span>
              </p>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Real-time web games & social community.
              </h1>

              <p className="text-sm sm:text-base text-gray-300/90 leading-relaxed max-w-3xl font-normal">
                Ano is an instant multiplayer gaming platform and social hub. It lets you create custom rooms, play real-time web games with friends, and connect in community feeds  -- directly in your browser with zero installs or friction.
              </p>

              {/* Quick links */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard/games"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-purple-600/25 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span>Browse Games</span>
                </Link>

                <Link
                  href="/dashboard/rooms"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs sm:text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Rooms</span>
                </Link>

                <Link
                  href="/feed"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs sm:text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Users className="w-4 h-4" />
                  <span>Community Feed</span>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Development Team Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Development Team
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {developers.map((developer) => (
                <DeveloperCard key={developer.id} developer={developer} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
