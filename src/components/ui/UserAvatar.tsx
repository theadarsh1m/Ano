"use client";

import { useState } from "react";

interface UserAvatarProps {
  src?: string | null;
  nickname?: string | null;
  size?: string; // e.g. "w-8 h-8", "w-9 h-9", "w-10 h-10", "w-16 h-16", "w-20 h-20"
  className?: string;
  textClassName?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

export function UserAvatar({
  src,
  nickname = "?",
  size = "w-9 h-9",
  className = "",
  textClassName = "text-xs font-bold",
  referrerPolicy = "no-referrer",
}: UserAvatarProps) {
  const [prevSrc, setPrevSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  // Adjust state during render when prop changes (React 19 pattern)
  if (src !== prevSrc) {
    setPrevSrc(src);
    setHasError(false);
  }

  const initials = (nickname || "?")
    .trim()
    .substring(0, 2)
    .toUpperCase();

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={nickname || "Avatar"}
        referrerPolicy={referrerPolicy}
        onError={() => setHasError(true)}
        className={`${size} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${size} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0 select-none ${className}`}
    >
      <span className={textClassName}>{initials}</span>
    </div>
  );
}
