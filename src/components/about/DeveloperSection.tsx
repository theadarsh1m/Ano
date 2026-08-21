"use client";

import { motion } from "framer-motion";
import { getDevelopers } from "@/data/aboutData";
import { DeveloperCard } from "./DeveloperCard";
import { Users2 } from "lucide-react";

export function DeveloperSection() {
  const developers = getDevelopers();

  return (
    <section className="space-y-8">
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold uppercase tracking-widest text-blue-300">
          <Users2 className="w-3.5 h-3.5" />
          <span>Core Team</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
          Meet the Developers
        </h2>
        <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
          The engineers, designers, and creators crafting multiplayer experiences, authoritative networking systems, and community tools for Ano.
        </p>
      </div>

      {/* Developers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {developers.map((developer, index) => (
          <motion.div
            key={developer.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <DeveloperCard developer={developer} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
