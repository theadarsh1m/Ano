"use client";

import { useState, useEffect } from "react";
import { useUserStore } from "@/store/useUserStore";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";

interface SafeMediaProps {
  src: string;
  type?: "image" | "gif" | "video";
  alt?: string;
  className?: string;
  moderationStatus?: string;
  nudityScore?: number | null;
  goreScore?: number | null;
  mediaId: string;
  onClick?: () => void;
}

export function SafeMedia({
  src,
  type = "image",
  alt = "Media",
  className = "",
  moderationStatus,
  nudityScore,
  goreScore,
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
    return <div className={`bg-neutral-800/50 animate-pulse rounded-xl ${className}`} />;
  }

  const isQuestionable = moderationStatus === "SENSITIVE" || moderationStatus === "PENDING_MODERATION";
  const shouldHide = isQuestionable && nsfwMode === "HIDE";
  
  // If the user hasn't revealed, and mode is BLUR, we blur it.
  const isBlurredState = isQuestionable && nsfwMode === "BLUR" && !revealed;

  if (shouldHide) {
    return (
      <div className={`relative overflow-hidden group/safe-media bg-neutral-900 border border-white/5 flex flex-col items-center justify-center p-6 text-center ${className} rounded-xl`}>
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

  // Determine tags based on scores
  const showNudityTag = typeof nudityScore === 'number' && nudityScore > 0.4;
  const showGoreTag = typeof goreScore === 'number' && goreScore > 0.4;
  const hasSpecificTags = showNudityTag || showGoreTag;

  // We always render the image, but apply classes based on whether it is blurred.
  return (
    <div className={`relative overflow-hidden group/safe-media rounded-xl ${className}`}>
      {/* The Media */}
      {type === "video" ? (
        <video
          src={src}
          className={`w-full h-full object-cover transition-all duration-700 ${
            isBlurredState ? "blur-3xl saturate-150 scale-110 pointer-events-none" : ""
          }`}
          controls={!isBlurredState}
          onClick={!isBlurredState ? onClick : undefined}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-all duration-700 ${
            isBlurredState ? "blur-3xl saturate-150 scale-110 pointer-events-none" : ""
          }`}
          onClick={!isBlurredState ? onClick : undefined}
        />
      )}

      {/* The Overlay */}
      <div 
        className={`absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md p-4 text-center transition-opacity duration-500 ${
          isBlurredState ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-4 shadow-lg shadow-black/50">
          <ShieldAlert className="w-7 h-7 text-white/90" />
        </div>
        
        <h4 className="text-white font-bold text-lg mb-3 tracking-wide drop-shadow-md">
          Sensitive Content
        </h4>

        {/* Reason Tags */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {showNudityTag && (
            <span className="px-3 py-1 bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-semibold rounded-full shadow-sm">
              🔞 Nudity
            </span>
          )}
          {showGoreTag && (
            <span className="px-3 py-1 bg-red-600/20 border border-red-600/30 text-red-200 text-xs font-semibold rounded-full shadow-sm">
              🩸 Gore
            </span>
          )}
          {!hasSpecificTags && (
            <span className="px-3 py-1 bg-white/10 border border-white/20 text-white/70 text-xs font-semibold rounded-full shadow-sm">
              Contains Sensitive Content
            </span>
          )}
        </div>

        <button
          onClick={handleReveal}
          className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-bold text-sm rounded-xl shadow-xl hover:bg-neutral-200 hover:scale-105 active:scale-95 transition-all duration-300"
          aria-label="Reveal sensitive image"
        >
          <Eye className="w-4 h-4" />
          Reveal Image
        </button>
      </div>
    </div>
  );
}
