"use client";

import { useState } from "react";
import { useUserStore } from "@/store/useUserStore";
import { API_URL } from "@/lib/config";
import { GlassModal } from "../layout/GlassModal";
import { Bug, Loader2, Check } from "lucide-react";

interface ReportBugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportBugModal({ isOpen, onClose }: ReportBugModalProps) {
  const userId = useUserStore((s) => s.id);
  const [description, setDescription] = useState("");
  const [game, setGame] = useState("Global");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !userId || submitting) return;

    setSubmitting(true);

    const ua = navigator.userAgent;
    let browser = "Other";
    if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Safari")) browser = "Safari";
    else if (ua.includes("Edge")) browser = "Edge";

    let device = "Desktop";
    if (/Mobi|Android|iPhone/i.test(ua)) device = "Mobile";

    try {
      const res = await fetch(`${API_URL}/api/feedback/bug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          description: description.trim(),
          browser,
          device,
          game
        })
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setDescription("");
          setGame("Global");
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to submit bug report:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="Report a Bug">
      {success ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center">
          <div className="w-12 h-12 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center text-green-400">
            <Check className="w-6 h-6 animate-scaleIn" />
          </div>
          <div>
            <h4 className="text-white font-bold">Bug Report Submitted</h4>
            <p className="text-xs text-white/50">Thank you! Our engineering team will investigate.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="block text-white/60 font-semibold uppercase text-[9px] tracking-wider">Affected Game / Feature</label>
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white/80 focus:outline-none focus:border-white/20"
            >
              <option value="Global">Global / Other</option>
              <option value="bluff">Bluff</option>
              <option value="memory-match">Memory Match</option>
              <option value="dots-and-boxes">Dots and Boxes</option>
              <option value="color-wars">Chain Reaction</option>
              <option value="scribble">Scribble</option>
              <option value="ink-deception">Ink & Deception</option>
              <option value="chamber-clash">Chamber Clash</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-white/60 font-semibold uppercase text-[9px] tracking-wider">Describe the Bug</label>
            <textarea
              placeholder="What happened? How can we reproduce it? Please be as specific as possible..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white/90 focus:outline-none focus:border-white/20 placeholder:text-zinc-650 font-medium"
              required
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
              className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-950/20"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Bug className="w-3.5 h-3.5" />
                  Submit Bug Report
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </GlassModal>
  );
}
