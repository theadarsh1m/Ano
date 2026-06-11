"use client";

import { useEffect, useState } from "react";
import { usePresenceStore } from "@/store/usePresenceStore";
import { useUserStore } from "@/store/useUserStore";
import { useRouter } from "next/navigation";
import { Camera, Edit3, Check, X, MessageSquare, Calendar } from "lucide-react";
import { uploadProfilePicture, validateImageFile } from "@/lib/upload";
import { motion } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

interface UserProfile {
  id: string;
  nickname: string;
  avatar: string | null;
  bio: string | null;
  createdAt: number;
  lastSeen: number;
}

interface UserProfileCardProps {
  userId: string;
  onStartDM?: () => void;
}

export function UserProfileCard({ userId, onStartDM }: UserProfileCardProps) {
  const router = useRouter();
  const myUserId = useUserStore((s) => s.id);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const isOnline = usePresenceStore((s) => s.isOnline);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState("");
  const [uploading, setUploading] = useState(false);

  const isOwn = myUserId === userId;
  const online = isOnline(userId);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/users/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setBioValue(data.bio || "");
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
      setLoading(false);
    };
    load();
  }, [userId]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myUserId) return;

    const error = validateImageFile(file);
    if (error) {
      alert(error);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadProfilePicture(file, myUserId);
      await updateProfile({ avatar: result.secureUrl });
      setProfile((p) => p ? { ...p, avatar: result.secureUrl } : p);
    } catch (err) {
      console.error("Failed to upload avatar:", err);
    }
    setUploading(false);
  };

  const handleSaveBio = async () => {
    await updateProfile({ bio: bioValue });
    setProfile((p) => p ? { ...p, bio: bioValue } : p);
    setEditingBio(false);
  };

  const handleStartDM = async () => {
    if (!myUserId || myUserId === userId) return;

    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAId: myUserId, userBId: userId }),
      });
      if (res.ok) {
        const conv = await res.json();
        router.push(`/dm/${conv.id}`);
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-center text-gray-500 text-sm">
        User not found
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 p-6"
    >
      {/* Avatar */}
      <div className="relative group">
        {profile.avatar ? (
          <img
            src={profile.avatar}
            alt={profile.nickname}
            className="w-20 h-20 rounded-full object-cover ring-2 ring-white/10"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl ring-2 ring-white/10">
            {profile.nickname.substring(0, 2).toUpperCase()}
          </div>
        )}

        {/* Online indicator */}
        <span
          className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-zinc-900 ${
            online ? "bg-green-500" : "bg-gray-600"
          }`}
        />

        {/* Upload overlay */}
        {isOwn && (
          <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            {uploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
            <input
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp,.gif"
              onChange={handleAvatarUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {/* Nickname */}
      <h3 className="text-lg font-semibold text-white">{profile.nickname}</h3>

      {/* Online status */}
      <span className={`text-xs px-2 py-1 rounded-full ${
        online
          ? "bg-green-500/20 text-green-400 border border-green-500/30"
          : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
      }`}>
        {online ? "🟢 Online" : "⚫ Offline"}
      </span>

      {/* Bio */}
      <div className="w-full">
        {editingBio && isOwn ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={bioValue}
              onChange={(e) => setBioValue(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
              rows={3}
              maxLength={200}
              placeholder="Tell us about yourself..."
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingBio(false)}
                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleSaveBio}
                className="p-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-400">
              {profile.bio || (isOwn ? "No bio yet" : "")}
            </p>
            {isOwn && (
              <button
                onClick={() => setEditingBio(true)}
                className="mt-1 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mx-auto transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                {profile.bio ? "Edit bio" : "Add bio"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Join date */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Calendar className="w-3 h-3" />
        <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
      </div>

      {/* Send Message button */}
      {!isOwn && (
        <button
          onClick={onStartDM || handleStartDM}
          className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors text-sm font-medium"
        >
          <MessageSquare className="w-4 h-4" />
          Send Message
        </button>
      )}
    </motion.div>
  );
}
