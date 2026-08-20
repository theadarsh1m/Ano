"use client";

import { motion } from "framer-motion";
import { PLATFORM_PILLARS } from "@/data/aboutData";
import { Zap, Server, Users, Sparkles, Layers } from "lucide-react";

const ICON_MAP = {
  Zap,
  Server,
  Users,
  Sparkles,
  Layers,
};

export function AboutMission() {
  return (
    <section className="space-y-8">
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-semibold uppercase tracking-widest text-purple-300">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Core Mission</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
          Why Ano?
        </h2>
        <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
          Designed from first principles to bring people together through friction-free multiplayer gaming and authentic social connection.
        </p>
      </div>

      {/* Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLATFORM_PILLARS.map((pillar, index) => {
          const Icon = ICON_MAP[pillar.iconName as keyof typeof ICON_MAP] || Sparkles;

          return (
            <motion.div
              key={pillar.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-6 md:p-8 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:shadow-xl hover:shadow-purple-500/5 flex flex-col justify-between"
            >
              {/* Subtle accent hover glow */}
              <div 
                className="pointer-events-none absolute -right-12 -top-12 w-36 h-36 bg-white/[0.03] group-hover:bg-white/[0.08] rounded-full blur-2xl transition-all duration-500" 
                aria-hidden="true" 
              />

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${pillar.gradient}`}>
                    {pillar.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg md:text-xl font-bold text-white mb-1 group-hover:text-blue-300 transition-colors">
                    {pillar.title}
                  </h3>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                    {pillar.subtitle}
                  </p>
                  <p className="text-sm text-gray-300/80 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
