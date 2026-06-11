"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, X, Loader2, AlertCircle, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { socketService } from "@/lib/socket";
import { useUserStore } from "@/store/useUserStore";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import {
  uploadChatFile,
  validateFile,
  isImageType,
  formatFileSize,
  ALLOWED_IMAGE_TYPES,
} from "@/lib/upload";

interface MessageInputProps {
  roomId: string;
  onFileDrop?: (handler: (file: File) => void) => void;
}

export function MessageInput({ roomId }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const { id: userId, nickname } = useUserStore();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const socket = socketService.getSocket();

  // Clear error after 5 seconds
  useEffect(() => {
    if (uploadError) {
      const timeout = setTimeout(() => setUploadError(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [uploadError]);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      setUploadError(error);
      return;
    }

    setSelectedFile(file);
    setUploadError(null);

    // Create preview for images
    if (isImageType(file.type)) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }, []);

  // Expose handleFileSelect for DropZone via a global callback on the window
  useEffect(() => {
    (window as any).__anoFileDropHandler = handleFileSelect;
    return () => {
      delete (window as any).__anoFileDropHandler;
    };
  }, [handleFileSelect]);

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadChatFile(file, (percent) => {
        setUploadProgress(percent);
      });
      return result;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleTyping = () => {
    if (!socket || !userId || !nickname) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    } else {
      socket.emit("typing_start", { roomId, nickname });
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing_stop", { roomId, nickname });
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    handleTyping();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((!message.trim() && !selectedFile) || !socket || !userId || !nickname) return;

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    socket.emit("typing_stop", { roomId, nickname });

    // If there's a file, upload first
    if (selectedFile) {
      try {
        const uploadResult = await handleUpload(selectedFile);

        const newMsg = {
          id: uuidv4(),
          roomId,
          senderId: userId,
          senderName: nickname,
          content: message.trim() || "",
          timestamp: Date.now(),
          type: isImageType(selectedFile.type) ? "image" : "file",
          fileUrl: uploadResult.secureUrl,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          fileType: uploadResult.fileType,
        };

        socket.emit("send_message", newMsg);
        clearSelectedFile();
      } catch (err: any) {
        setUploadError(err.message || "Upload failed");
        return;
      }
    } else {
      // Regular text message
      const newMsg = {
        id: uuidv4(),
        roomId,
        senderId: userId,
        senderName: nickname,
        content: message.trim(),
        timestamp: Date.now(),
      };
      socket.emit("send_message", newMsg);
    }

    setMessage("");
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-black/20 border-t border-white/5">
      {/* Upload Error Toast */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mx-4 mt-2 flex items-center gap-2 bg-red-500/20 text-red-300 text-sm px-3 py-2 rounded-lg border border-red-500/30"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Preview */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mt-2"
          >
            <div className="flex items-center gap-3 bg-white/5 px-3 py-2 rounded-lg border border-white/10">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-12 h-12 rounded object-cover" />
              ) : (
                <div className="w-12 h-12 rounded bg-white/5 flex items-center justify-center">
                  <FileIcon className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-400">{formatFileSize(selectedFile.size)}</p>
              </div>
              <button
                onClick={clearSelectedFile}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="mx-4 mt-2">
          <div className="flex items-center gap-2 text-sm text-blue-300 mb-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Uploading... {uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
        </div>
      )}

      {/* Input Row */}
      <form onSubmit={handleSubmit} className="p-4">
        <div className="relative flex items-center gap-2">
          {/* Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/5 disabled:opacity-50"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.pptx,.txt,.zip"
            onChange={handleFileInputChange}
          />

          {/* Text Input */}
          <input
            type="text"
            value={message}
            onChange={handleChange}
            placeholder={selectedFile ? "Add a comment..." : "Type a message..."}
            className="flex-1 bg-white/5 border border-white/10 rounded-full py-3 pl-4 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            maxLength={500}
            disabled={isUploading}
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!message.trim() && !selectedFile) || isUploading}
            className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
