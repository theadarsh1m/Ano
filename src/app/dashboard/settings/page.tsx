"use client";

import { useUserStore } from "@/store/useUserStore";
import { GoogleLogin } from "@react-oauth/google";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { nickname, isAnonymous, email, updateProfile, loginWithGoogle } = useUserStore();
  const [newNickname, setNewNickname] = useState(nickname || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setNewNickname(nickname || "");
  }, [nickname]);

  if (!isClient) return null;

  const handleSave = async () => {
    setIsSaving(true);
    await updateProfile({ nickname: newNickname });
    setIsSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 lg:p-8 w-full">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-white">Account Settings</h1>
      </div>

      <div className="flex flex-col gap-6">
        <GlassCard>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center text-2xl">
              {nickname?.charAt(0).toUpperCase()}
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
                  className="glass-button text-white"
                >
                  Save
                </Button>
              </div>
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
      </div>
    </div>
  );
}
