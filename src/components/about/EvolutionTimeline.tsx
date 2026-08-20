"use client";

import { motion } from "framer-motion";
import { EVOLUTION_MILESTONES } from "@/data/aboutData";
import { 
  History, 
  CheckCircle, 
  Clock, 
  Sparkles, 
  Server, 
  Gamepad2, 
  MessageSquare, 
  Box 
} from "lucide-react";

const ICON_MAP = {
  Sparkles,
  Server,
  Gamepad2,
  MessageSquare,
  Box,
};

export function EvolutionTimeline() {
  return (
    <section className="space-y-8">
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold uppercase tracking-widest text-indigo-300">
          <History className="w-3.5 h-3.5" />
          <span>Platform Journey</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
          Ano Evolution
        </h2>
        <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
          From a lightweight real-time multiplayer concept to a full-stack social arcade and interactive 3D web platform.
        </p>
      </div>

      {/* Timeline Container */}
      <div className="relative max-w-4xl mx-auto">
        {/* Central Vertical Connector Line */}
        <div 
          className="hidden md:block absolute left-1/2 top-4 bottom-4 -translate-x-1/2 w-0.5 bg-gradient-to-b from-blue-500/50 via-purple-500/50 to-indigo-500/10" 
          aria-hidden="true" 
        />

        <div className="space-y-8 md:space-y-12">
          {EVOLUTION_MILESTONES.map((milestone, index) => {
            const Icon = ICON_MAP[milestone.iconName as keyof typeof ICON_MAP] || Sparkles;
            const isEven = index % 2 === 0;
            const isCompleted = milestone.status === "completed";
            const isCurrent = milestone.status === "current";

            return (
              <motion.div
                key={milestone.phase}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className={`relative flex flex-col md:flex-row items-center gap-6 ${
                  isEven ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                {/* Milestone Node on Center Line */}
                <div 
                  className={`hidden md:flex absolute left-1/2 -translate-x-1/2 w-10 h-10 rounded-full border-2 items-center justify-center z-20 backdrop-blur-md ${
                    isCurrent
                      ? "border-purple-400 bg-purple-950/90 shadow-lg shadow-purple-500/50 scale-110"
                      : isCompleted
                      ? "border-blue-400 bg-blue-950/90 shadow-md shadow-blue-500/20"
                      : "border-gray-600 bg-black/80"
                  }`}
                  aria-hidden="true"
                >
                  <Icon className={`w-4 h-4 ${isCurrent ? "text-purple-300 animate-pulse" : isCompleted ? "text-blue-300" : "text-gray-400"}`} />
                </div>

                {/* Content Card */}
                <div className={`w-full md:w-[calc(50%-2rem)] ${isEven ? "md:text-right" : "md:text-left"}`}>
                  <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-6 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:shadow-xl space-y-4">
                    {/* Header: Phase badge & Status */}
                    <div className={`flex items-center gap-2 ${isEven ? "md:justify-end" : "md:justify-start"}`}>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-white/10 text-white border border-white/10 font-mono">
                        {milestone.phase}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse">
                          <Clock className="w-3 h-3" />
                          Current Focus
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" />
                          Completed
                        </span>
                      )}
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                        {milestone.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">
                        {milestone.description}
                      </p>
                    </div>

                    {/* Highlights list */}
                    <ul className={`space-y-1.5 text-xs text-gray-300/90 pt-2 border-t border-white/5 ${
                      isEven ? "md:text-right" : "md:text-left"
                    }`}>
                      {milestone.highlights.map((highlight, hIdx) => (
                        <li key={hIdx} className={`flex items-center gap-2 ${isEven ? "md:justify-end" : "md:justify-start"}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Empty opposite side for spacing on desktop */}
                <div className="hidden md:block w-[calc(50%-2rem)]" aria-hidden="true" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
