"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "@/lib/config";
import { AlertCircle, Info, CheckCircle2, AlertTriangle, X, ChevronRight, ChevronLeft } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  description: string;
  color: string;
  icon?: string;
}

export function AnnouncementsBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch(`${API_URL}/api/feed/announcements`);
        if (res.ok) {
          const data = await res.json();
          setAnnouncements(data);
        }
      } catch (err) {
        console.error("Failed to fetch announcements:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  // Auto rotate announcements
  useEffect(() => {
    if (announcements.length <= 1 || isDismissed) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [announcements, isDismissed]);

  if (loading || announcements.length === 0 || isDismissed) return null;

  const current = announcements[currentIndex];

  const getColorStyles = (color: string) => {
    switch (color) {
      case "red":
        return {
          bg: "bg-red-500/10 border-red-500/20 text-red-200",
          iconColor: "text-red-400",
          glow: "shadow-[0_0_15px_rgba(239,68,68,0.1)]",
          Icon: AlertCircle,
        };
      case "yellow":
        return {
          bg: "bg-yellow-500/10 border-yellow-500/20 text-yellow-200",
          iconColor: "text-yellow-400",
          glow: "shadow-[0_0_15px_rgba(234,179,8,0.1)]",
          Icon: AlertTriangle,
        };
      case "green":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
          iconColor: "text-emerald-400",
          glow: "shadow-[0_0_15px_rgba(16,185,129,0.1)]",
          Icon: CheckCircle2,
        };
      case "blue":
      default:
        return {
          bg: "bg-blue-500/10 border-blue-500/20 text-blue-200",
          iconColor: "text-blue-400",
          glow: "shadow-[0_0_15px_rgba(59,130,246,0.1)]",
          Icon: Info,
        };
    }
  };

  const { bg, iconColor, glow, Icon } = getColorStyles(current.color);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % announcements.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full px-4 pt-4 md:px-10"
    >
      <div className={`relative flex items-center justify-between border backdrop-blur-md rounded-2xl p-4 transition-all duration-300 ${bg} ${glow}`}>
        <div className="flex-1 flex items-center gap-3 overflow-hidden pr-8">
          <div className={`p-2 rounded-xl bg-white/5 flex-shrink-0 ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3"
              >
                <span className="font-bold text-sm tracking-wide text-white whitespace-nowrap">
                  {current.title}
                </span>
                <span className="hidden md:inline text-white/30 text-xs">|</span>
                <span className="text-xs text-white/70 line-clamp-1">
                  {current.description}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-4">
          {announcements.length > 1 && (
            <div className="flex gap-1 mr-2 text-white/40">
              <button
                onClick={handlePrev}
                className="p-1 hover:bg-white/5 hover:text-white rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] self-center font-mono">
                {currentIndex + 1}/{announcements.length}
              </span>
              <button
                onClick={handleNext}
                className="p-1 hover:bg-white/5 hover:text-white rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 hover:bg-white/5 text-white/40 hover:text-white rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
