"use client";

import { useState } from "react";
import { useUserStore } from "@/store/useUserStore";
import { API_URL } from "@/lib/config";
import { GlassModal } from "../layout/GlassModal";
import { Star, Loader2, Check } from "lucide-react";

interface GameRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameTitle: string;
}

export function GameRatingModal({ isOpen, onClose, gameId, gameTitle }: GameRatingModalProps) {
  const userId = useUserStore((s) => s.id);
  const [stars, setStars] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/feedback/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          stars,
          content: content.trim() || `Rated ${stars} stars for ${gameTitle}`,
          category: `GAME_${gameId.toUpperCase().replace(/-/g, "_")}`
        })
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setContent("");
          setStars(5);
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to submit game rating:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title={`Rate ${gameTitle}`}>
      {success ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center">
          <div className="w-12 h-12 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center text-green-400">
            <Check className="w-6 h-6 animate-scaleIn" />
          </div>
          <div>
            <h4 className="text-white font-bold">Feedback Submitted!</h4>
            <p className="text-xs text-white/50">Thank you for rating {gameTitle}.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="flex flex-col items-center justify-center space-y-2 py-2">
            <label className="text-white/60 font-semibold uppercase text-[10px] tracking-wider">Your Rating</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setStars(num)}
                  className="p-1 hover:scale-110 transition-transform focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      num <= stars ? "fill-yellow-400 text-yellow-400" : "text-zinc-600 hover:text-zinc-500"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-white/60 font-semibold uppercase text-[9px] tracking-wider">Review / Comments (Optional)</label>
            <textarea
              placeholder={`What do you think of ${gameTitle}? Share your experience...`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white/90 focus:outline-none focus:border-white/20 placeholder:text-zinc-600 font-medium"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl font-bold uppercase tracking-wider text-[10px] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Submit Rating"
              )}
            </button>
          </div>
        </form>
      )}
    </GlassModal>
  );
}
