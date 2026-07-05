"use client";

import { useRef } from "react";
import { X } from "lucide-react";

interface TagFilterProps {
  tags: string[];
  activeTag: string | null;
  onTagChange: (tag: string | null) => void;
}

export function TagFilter({ tags, activeTag, onTagChange }: TagFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (tags.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
    >
      {activeTag && (
        <button
          onClick={() => onTagChange(null)}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onTagChange(activeTag === tag ? null : tag)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            activeTag === tag
              ? "bg-blue-500/30 text-blue-300 border border-blue-500/40"
              : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white"
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
