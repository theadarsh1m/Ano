"use client";

import { motion } from "framer-motion";
import { Flame, Clock } from "lucide-react";

interface FeedTabsProps {
  activeTab: "latest" | "trending";
  onTabChange: (tab: "latest" | "trending") => void;
}

export function FeedTabs({ activeTab, onTabChange }: FeedTabsProps) {
  const tabs = [
    { id: "trending" as const, label: "Trending", icon: Flame },
    { id: "latest" as const, label: "Latest", icon: Clock },
  ];

  return (
    <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === tab.id
              ? "text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-white/10 rounded-lg border border-white/10"
              transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
}
