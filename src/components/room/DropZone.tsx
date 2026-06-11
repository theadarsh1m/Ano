"use client";

import { useState, useCallback, ReactNode } from "react";
import { Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DropZoneProps {
  children: ReactNode;
  onFileDrop: (file: File) => void;
  className?: string;
}

export function DropZone({ children, onFileDrop, className }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragCounter((prev) => prev + 1);
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragCounter((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setIsDragging(false);
          return 0;
        }
        return next;
      });
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setDragCounter(0);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFileDrop(e.dataTransfer.files[0]);
        e.dataTransfer.clearData();
      }
    },
    [onFileDrop]
  );

  return (
    <div
      className={`relative ${className || ""}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-blue-600/20 backdrop-blur-sm border-2 border-dashed border-blue-400 rounded-2xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="flex flex-col items-center gap-3 text-white"
            >
              <div className="p-4 bg-blue-500/30 rounded-full border border-blue-400/50">
                <Upload className="w-8 h-8 text-blue-300" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">Drop file here</p>
                <p className="text-sm text-blue-300/80">Images up to 10MB • Files up to 25MB</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
