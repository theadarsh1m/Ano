"use client";

import { useState } from "react";
import { useUserStore } from "@/store/useUserStore";
import { API_URL } from "@/lib/config";
import { GlassModal } from "../layout/GlassModal";
import { ShieldAlert, Loader2, Check } from "lucide-react";

interface ReportUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedId: string;
  reportedNickname: string;
}

export function ReportUserModal({ isOpen, onClose, reportedId, reportedNickname }: ReportUserModalProps) {
  const reporterId = useUserStore((s) => s.id);
  const [reason, setReason] = useState("TOXIC_CHAT");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporterId || !reportedId || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/feedback/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterId,
          reportedId,
          reason,
          details: details.trim() || undefined
        })
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setDetails("");
          setReason("TOXIC_CHAT");
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to submit user report:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title={`Report Player: ${reportedNickname}`}>
      {success ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center">
          <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center text-rose-450">
            <Check className="w-6 h-6 animate-scaleIn" />
          </div>
          <div>
            <h4 className="text-white font-bold">Report Submitted</h4>
            <p className="text-xs text-white/50">Thank you. Moderation team will review this user.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="block text-white/60 font-semibold uppercase text-[9px] tracking-wider">Reason for Report</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white/80 focus:outline-none focus:border-white/20"
            >
              <option value="TOXIC_CHAT">Toxic Behavior / Chat</option>
              <option value="OFFENSIVE_USERNAME">Offensive Nickname / Profile</option>
              <option value="CHEATING">Cheating / Hacking</option>
              <option value="EXPLOITING">Exploiting Glitches</option>
              <option value="OTHER">Other Reason</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-white/60 font-semibold uppercase text-[9px] tracking-wider">Additional Details (Optional)</label>
            <textarea
              placeholder="Provide chat snippets, context, or match situations that help the admins make an informed decision..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white/90 focus:outline-none focus:border-white/20 placeholder:text-zinc-650 font-medium"
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
              className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-red-650 hover:from-rose-500 hover:to-red-600 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/20"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </GlassModal>
  );
}
