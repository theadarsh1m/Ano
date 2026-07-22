"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { ToastContainer } from "@/components/ui/Toast";

export interface ToastData {
  id: string;
  title: string;
  description: string;
  sender?: {
    id: string;
    nickname: string;
    avatar: string | null;
  };
  icon?: React.ComponentType<{ className?: string }>;
  timestamp?: string;
  onClick?: () => void;
  unread?: boolean;
  duration?: number;
  notificationId?: string;
  type?: string;
}

export type AddToastInput = Omit<ToastData, "id"> & { id?: string };

interface ToastContextType {
  addToast: (toast: AddToastInput) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback((input: AddToastInput) => {
    const id = input.id || `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastData = {
      ...input,
      id,
      unread: input.unread ?? true,
    };

    setToasts((prev) => {
      // Avoid exact duplicate ID or duplicate notificationId
      if (prev.some((t) => t.id === id || (input.notificationId && t.notificationId === input.notificationId))) {
        return prev;
      }
      // Newest toast appears at the top, cap to max 5 visible toasts
      const updated = [newToast, ...prev];
      return updated.slice(0, 5);
    });

    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
