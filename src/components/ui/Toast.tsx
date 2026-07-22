"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Bell } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ToastData } from "@/components/providers/ToastProvider";

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const duration = toast.duration ?? 5500;

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 250); // Match exit animation duration
  }, [onDismiss, toast.id]);

  useEffect(() => {
    if (isPaused || duration <= 0) return;
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [isPaused, duration, handleDismiss]);

  const handleClick = (e: React.MouseEvent) => {
    // Prevent dismiss button click from triggering toast navigation
    if ((e.target as HTMLElement).closest(".toast-dismiss-btn")) {
      return;
    }
    handleDismiss();
    if (toast.onClick) {
      toast.onClick();
    }
  };

  const IconComponent = toast.icon || Bell;

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={handleClick}
      className={`
        group relative flex items-start gap-3 w-full sm:w-96 p-3.5 
        bg-zinc-950/90 border border-zinc-800/80 backdrop-blur-xl shadow-2xl rounded-2xl
        cursor-pointer select-none transition-all duration-300 transform
        hover:border-zinc-700 hover:scale-[1.01] active:scale-[0.99]
        ${isExiting ? "opacity-0 translate-y-[-10px] scale-95" : "animate-in slide-in-from-top-4 duration-300 opacity-100 translate-y-0 scale-100"}
      `}
    >
      {/* Blue Unread Dot */}
      {toast.unread && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
      )}

      {/* Avatar or Icon Badge */}
      <div className="relative flex-shrink-0">
        {toast.sender ? (
          <div className="relative">
            <UserAvatar
              src={toast.sender.avatar}
              nickname={toast.sender.nickname}
              size="w-10 h-10"
              textClassName="text-xs font-bold"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-400">
              <IconComponent className="w-3 h-3" />
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
            <IconComponent className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center justify-between gap-2">
          <h5 className="font-bold text-xs text-white truncate group-hover:text-blue-400 transition-colors">
            {toast.title}
          </h5>
          <span className="text-[10px] text-zinc-500 font-medium flex-shrink-0">
            {toast.timestamp || "Just now"}
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5 leading-snug">
          {toast.description}
        </p>
      </div>

      {/* Manual Dismiss Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
        className="toast-dismiss-btn absolute top-3 right-3 p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[9999] top-4 left-4 right-4 sm:left-auto sm:right-4 flex flex-col gap-2.5 max-w-full sm:max-w-md pointer-events-none"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
