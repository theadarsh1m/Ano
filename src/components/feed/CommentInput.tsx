"use client";

import { useState } from "react";
import { Send, EyeOff, Loader2 } from "lucide-react";

interface CommentInputProps {
  onSubmit: (content: string, isAnonymous: boolean) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
}

export function CommentInput({
  onSubmit,
  placeholder = "Write a comment...",
  autoFocus = false,
}: CommentInputProps) {
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit(content.trim(), isAnonymous);
    setContent("");
    setSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1 relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm min-h-[44px] max-h-[120px]"
          rows={1}
        />
      </div>
      <button
        onClick={() => setIsAnonymous(!isAnonymous)}
        className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
          isAnonymous
            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
            : "bg-white/5 text-gray-500 border border-white/10 hover:text-gray-300"
        }`}
        title={isAnonymous ? "Posting anonymously" : "Post as yourself"}
      >
        <EyeOff className="w-4 h-4" />
      </button>
      <button
        onClick={handleSubmit}
        disabled={!content.trim() || submitting}
        className="p-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
