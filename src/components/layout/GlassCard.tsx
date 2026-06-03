import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function GlassCard({ children, className, onClick }: GlassCardProps) {
  return (
    <div 
      className={cn("glass-panel p-6", onClick && "cursor-pointer", className)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
