"use client";

import { API_URL } from "@/lib/config";
import { useUserStore } from "@/store/useUserStore";
import { GoogleLogin } from "@react-oauth/google";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { ShieldCheck, ArrowLeft, MessageSquare, Star, Camera, Loader2 } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { uploadProfilePicture, validateImageFile } from "@/lib/upload";

export default function SettingsPage() {
  const { id: userId, nickname, avatar, isAnonymous, email, nsfwMode, updateProfile, loginWithGoogle } = useUserStore();
  const [newNickname, setNewNickname] = useState(nickname || "");
  const [prevNickname, setPrevNickname] = useState(nickname);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Adjust state during render when store nickname updates (React 19 pattern)
  if (nickname !== prevNickname) {
    setPrevNickname(nickname);
    setNewNickname(nickname || "");
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    const error = validateImageFile(file);
    if (error) {
      alert(error);
      return;
    }

    setUploadingAvatar(true);
    try {
      const result = await uploadProfilePicture(file, userId);
      await updateProfile({ avatar: result.secureUrl });
    } catch (err: unknown) {
      console.error("Failed to upload avatar:", err);
      alert((err as Error).message || "Avatar upload failed");
    }
    setUploadingAvatar(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateProfile({ nickname: newNickname });
    setIsSaving(false);
  };

  const handleNsfwModeChange = async (mode: "HIDE" | "BLUR" | "SHOW") => {
    try {
      await updateProfile({ nsfwMode: mode });
    } catch (err) {
      console.error("Failed to update sensitive content mode:", err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 lg:p-8 w-full">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full h-8 w-8 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        
        <Link href="/dashboard">
          <div className="flex items-center gap-3 cursor-pointer group hover:opacity-85 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-wide">Ano</span>
          </div>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Account Settings</h1>
      </div>

      <div className="flex flex-col gap-6">
        <GlassCard>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative group">
              <UserAvatar
                src={avatar}
                nickname={nickname}
                size="w-16 h-16"
                textClassName="text-2xl font-bold"
                className="ring-2 ring-white/10"
              />
              <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {uploadingAvatar ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
                <input
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.webp,.gif"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                />
              </label>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                {nickname}
                {isAnonymous ? (
                  <span className="text-xs px-2 py-1 bg-white/10 rounded-full text-white/70 font-medium">Guest</span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Verified
                  </span>
                )}
              </h2>
              {!isAnonymous && <p className="text-sm text-white/50">{email}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Nickname</label>
              <div className="flex gap-2">
                <Input 
                  value={newNickname} 
                  onChange={(e) => setNewNickname(e.target.value)}
                  className="bg-black/20 border-white/10 text-white"
                />
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving || newNickname === nickname}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 border-none"
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-lg font-semibold text-white mb-4">Content Preferences</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Sensitive Content</label>
              <div className="flex flex-col sm:flex-row gap-4 mt-2">
                <label className="flex items-center gap-2.5 cursor-pointer text-white/80 hover:text-white bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                  <input
                    type="radio"
                    name="nsfwMode"
                    value="HIDE"
                    checked={nsfwMode === "HIDE"}
                    onChange={() => handleNsfwModeChange("HIDE")}
                    className="accent-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm font-medium">Hide Completely (Default)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-white/80 hover:text-white bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                  <input
                    type="radio"
                    name="nsfwMode"
                    value="BLUR"
                    checked={nsfwMode === "BLUR"}
                    onChange={() => handleNsfwModeChange("BLUR")}
                    className="accent-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm font-medium">Blur (Tap to Reveal)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-white/80 hover:text-white bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                  <input
                    type="radio"
                    name="nsfwMode"
                    value="SHOW"
                    checked={nsfwMode === "SHOW"}
                    onChange={() => handleNsfwModeChange("SHOW")}
                    className="accent-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm font-medium">Show Uncensored</span>
                </label>
              </div>
              <p className="text-xs text-white/50 mt-3">
                Configure how uploaded posts and chat attachments flagged as sensitive content are displayed.
              </p>
            </div>
          </div>
        </GlassCard>

        {isAnonymous && (
          <GlassCard className="border-green-500/30 bg-green-500/5">
            <h3 className="text-lg font-semibold text-white mb-2">Upgrade Your Account</h3>
            <p className="text-sm text-white/70 mb-4">
              You are currently using a temporary guest account. Connect a Google account to permanently save your profile, friends, and chat history.
            </p>
            <div className="bg-black/40 p-2 rounded-full inline-block">
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  if (credentialResponse.credential) {
                    loginWithGoogle(credentialResponse.credential).catch((e) => alert(e.message));
                  }
                }}
                onError={() => alert('Google login failed')}
                theme="filled_black"
                shape="pill"
              />
            </div>
          </GlassCard>
        )}

        {/* ── RATINGS & REVIEWS SUBMISSION ── */}
        <FeedbackAndBugsSection userId={useUserStore.getState().id || ""} />

      </div>
    </div>
  );
}

function FeedbackAndBugsSection({ userId }: { userId: string }) {
  // Review state
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [reviewContent, setReviewContent] = useState("");
  const [category, setCategory] = useState("UI");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const activeRating = hoverStars || stars;

  // Bug state
  const [bugDesc, setBugDesc] = useState("");
  const [bugGame, setBugGame] = useState("Global");
  const [submittingBug, setSubmittingBug] = useState(false);
  const [bugSuccess, setBugSuccess] = useState(false);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewContent.trim() || !userId || stars === 0) return;
    setSubmittingReview(true);

    try {
      const res = await fetch(`${API_URL}/api/feedback/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          stars,
          content: reviewContent,
          category
        })
      });

      if (res.ok) {
        setReviewContent("");
        setStars(0);
        setHoverStars(0);
        setReviewSuccess(true);
        setTimeout(() => setReviewSuccess(false), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleBugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugDesc.trim() || !userId) return;
    setSubmittingBug(true);

    // Auto-detect browser and device from User Agent
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
          description: bugDesc,
          browser,
          device,
          game: bugGame
        })
      });

      if (res.ok) {
        setBugDesc("");
        setBugSuccess(true);
        setTimeout(() => setBugSuccess(false), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingBug(false);
    }
  };

  return (
    <div className="space-y-6">
      <GlassCard>
        <h3 className="text-lg font-semibold text-white mb-2">Submit Feedback & Review</h3>
        <p className="text-xs text-white/50 mb-4">Let us know what you think of Ano! Select a category and rate your experience.</p>
        
        {reviewSuccess ? (
          <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-xl uppercase tracking-wider text-center">
            Review submitted successfully! Thank you.
          </div>
        ) : (
          <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-white/60 mb-1 font-semibold uppercase text-[9px]">Category</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-white/80 focus:outline-none"
                >
                  <option value="UI">User Interface</option>
                  <option value="GAMEPLAY">Gameplay</option>
                  <option value="MULTIPLAYER">Multiplayer</option>
                  <option value="PERFORMANCE">Performance</option>
                  <option value="BUG">Bug / Glitch</option>
                  <option value="SUGGESTION">Suggestion</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-white/60 mb-1 font-semibold uppercase text-[9px]">
                  {stars === 0 ? "Rating (Required)" : `${stars} Out of 5 Stars`}
                </label>
                <div 
                  className="flex gap-1 items-center bg-black/40 border border-white/10 rounded-xl p-2 font-medium"
                  onMouseLeave={() => setHoverStars(0)}
                >
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setStars(num)}
                      onMouseEnter={() => setHoverStars(num)}
                      className="p-1 hover:scale-110 transition-transform focus:outline-none"
                    >
                      <Star
                        className={`w-4 h-4 transition-colors ${
                          num <= activeRating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-zinc-600 hover:text-zinc-500"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-white/60 mb-1 font-semibold uppercase text-[9px]">Your Review</label>
              <textarea
                placeholder="What do you love? What can we improve?..."
                value={reviewContent}
                onChange={e => setReviewContent(e.target.value)}
                rows={3}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-white/90 focus:outline-none placeholder:text-zinc-600 font-medium"
                required
              />
            </div>

            <Button 
              type="submit" 
              disabled={submittingReview || stars === 0} 
              className="w-full glass-button text-white font-bold h-10 border-none disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submittingReview ? "Submitting..." : stars === 0 ? "Select Rating to Submit" : "Submit Review"}
            </Button>
          </form>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold text-white mb-2">Report a Bug</h3>
        <p className="text-xs text-white/50 mb-4">Encountered an issue? Help us squash it by detailing the problem.</p>

        {bugSuccess ? (
          <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-xl uppercase tracking-wider text-center">
            Bug report submitted! Our team will investigate.
          </div>
        ) : (
          <form onSubmit={handleBugSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-white/60 mb-1 font-semibold uppercase text-[9px]">Affected Area / Game</label>
              <select
                value={bugGame}
                onChange={e => setBugGame(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-white/80 focus:outline-none"
              >
                <option value="Global">Global Platform / Chat</option>
                <option value="CHAMBER_CLASH">Chamber Clash</option>
                <option value="BLUFF">Bluff</option>
                <option value="SCRIBBLE">Scribble</option>
                <option value="INK_DECEPTION">Ink Deception</option>
                <option value="UNO">UNO</option>
              </select>
            </div>

            <div>
              <label className="block text-white/60 mb-1 font-semibold uppercase text-[9px]">Description of the Bug</label>
              <textarea
                placeholder="What happened? How can we reproduce it?..."
                value={bugDesc}
                onChange={e => setBugDesc(e.target.value)}
                rows={3}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-white/90 focus:outline-none placeholder:text-zinc-600 font-medium"
                required
              />
            </div>

            <Button type="submit" disabled={submittingBug} className="w-full glass-button text-white font-bold h-10 border-none">
              {submittingBug ? "Submitting Report..." : "Submit Bug Report"}
            </Button>
          </form>
        )}
      </GlassCard>
    </div>
  );
}
