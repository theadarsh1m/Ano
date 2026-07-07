"use client";

import { useState, useEffect } from "react";
import { useUserStore } from "@/store/useUserStore";
import { Eye, EyeOff } from "lucide-react";

interface SafeMediaProps {
  src: string;
  type?: "image" | "gif" | "video";
  alt?: string;
  className?: string;
  isNSFW: boolean;
  mediaId: string;
  onClick?: () => void;
}

export function SafeMedia({
  src,
  type = "image",
  alt = "Media",
  className = "",
  isNSFW,
  mediaId,
  onClick,
}: SafeMediaProps) {
  const nsfwMode = useUserStore((s) => s.nsfwMode);

  const [revealed, setRevealed] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleReveal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealed(true);
  };

  if (!isClient) {
    // Render placeholder on SSR to avoid hydration mismatches
    return <div className={`bg-white/5 animate-pulse rounded-xl ${className}`} />;
  }

  const shouldHide = isNSFW && nsfwMode === "HIDE";
  const shouldBlur = isNSFW && (nsfwMode === "BLUR" || nsfwMode === "ALWAYS") && !revealed;

  if (shouldHide) {
    return (
      <div className={`relative overflow-hidden group/safe-media bg-neutral-900 border border-white/5 flex flex-col items-center justify-center p-6 text-center ${className}`}>
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
          <EyeOff className="w-6 h-6 text-white/50" />
        </div>
        <h4 className="text-white/80 font-semibold text-base mb-1 tracking-wide">Sensitive Content Hidden</h4>
        <p className="text-white/40 text-xs max-w-[220px] leading-relaxed">
          This content is hidden by your settings. Change your NSFW preferences to view it.
        </p>
      </div>
    );
  }

  if (shouldBlur) {
    return (
      <div className={`relative overflow-hidden group/safe-media ${className}`}>
        {/* Blurred Image */}
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover blur-2xl md:blur-3xl saturate-150 scale-105 select-none pointer-events-none transition-all duration-500"
        />

        {/* Premium Glassmorphic Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md p-4 text-center">
          <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-3 shadow-inner shadow-white/5">
            <EyeOff className="w-6 h-6 text-white/80" />
          </div>
          <h4 className="text-white font-semibold text-base mb-1 tracking-wide">Sensitive Content</h4>
          <p className="text-white/50 text-xs max-w-[200px] mb-4 leading-relaxed">
            This image is flagged as NSFW.
          </p>
          <button
            onClick={handleReveal}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold text-xs rounded-xl shadow-lg hover:bg-white/90 active:scale-95 transition-all duration-200"
          >
            <Eye className="w-4 h-4" />
            Reveal Media
          </button>
        </div>
      </div>
    );
  }

  // Render normal media (currently only image support required)
  if (type === "image" || type === "gif") {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        onClick={onClick}
      />
    );
  }

  // Video placeholder for future compatibility
  return (
    <video
      src={src}
      className={className}
      controls
      onClick={onClick}
    />
  );
}
