"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/layout/GlassCard";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from '@react-oauth/google';
import { Loader2, Check, X, Link2, Globe } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { id, login, loginWithGoogle, updateProfile } = useUserStore();
  const socials = [
    {
      label: "GitHub",
      href: "https://github.com/theadarsh1m",
      icon: Link2,
    },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/adarshsachan01",
      icon: Link2,
    },
    {
      label: "Portfolio",
      href: "https://theadarsh.me/",
      icon: Globe,
    },
  ];
  const [nickname, setNickname] = useState("");
  const [isClient, setIsClient] = useState(false);

  // Modal states
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [debouncedUsername, setDebouncedUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && useUserStore.getState().id) {
      router.push("/dashboard");
    }
  }, [isClient, router]);

  // Debounce username input for availability check
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedUsername(newUsername), 500);
    return () => clearTimeout(handler);
  }, [newUsername]);

  // Check availability when debounced username changes
  useEffect(() => {
    if (!debouncedUsername) {
      setIsAvailable(null);
      return;
    }
    const checkAvailability = async () => {
      setIsChecking(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'}/api/users/check-nickname?nickname=${encodeURIComponent(debouncedUsername)}`);
        const data = await res.json();
        setIsAvailable(data.available);
      } catch (err) {
        console.error(err);
      } finally {
        setIsChecking(false);
      }
    };
    checkAvailability();
  }, [debouncedUsername]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim()) {
      login(nickname.trim());
      router.push("/dashboard");
    }
  };

  const saveUsername = async () => {
    if (!newUsername.trim() || isAvailable === false) return;
    setIsSaving(true);
    await updateProfile({ nickname: newUsername });
    setIsSaving(false);
    setShowUsernameModal(false);
    router.push("/dashboard");
  };

  if (!isClient) return null; // Prevent hydration mismatch
  if (id && !showUsernameModal) return null; // Redirecting

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen relative">
      <AnimatePresence>
        {showUsernameModal ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md z-10"
          >
            <GlassCard className="flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Choose your Username</h2>
                <p className="text-sm text-white/60">Pick a unique name to represent yourself.</p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.replace(/\s+/g, ''))}
                    className="bg-black/20 border-white/10 text-white placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-white/30 h-12 pr-10"
                    maxLength={30}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                    {isChecking ? (
                      <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
                    ) : isAvailable === true ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : isAvailable === false ? (
                      <X className="w-5 h-5 text-red-400" />
                    ) : null}
                  </div>
                </div>

                {isAvailable === false && !isChecking && (
                  <p className="text-xs text-red-400">This username is already taken.</p>
                )}

                <Button
                  onClick={saveUsername}
                  disabled={isSaving || isAvailable === false || !newUsername.trim()}
                  className="w-full glass-button h-12 text-white"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Complete Profile"}
                </Button>
                
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowUsernameModal(false);
                    router.push("/dashboard");
                  }}
                  className="w-full text-white/50 hover:text-white"
                >
                  Skip for now
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <GlassCard className="flex flex-col gap-6 text-center">
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-white">Ano</h1>
                <p className="text-muted-foreground">
                  A real-time platform for students to chat, collaborate, and play games.
                </p>
              </div>

              <form onSubmit={handleJoin} className="flex flex-col gap-4">
                <Input
                  type="text"
                  placeholder="Enter your nickname..."
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="bg-black/20 border-white/10 text-white placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-white/30 h-12"
                  required
                />
                <Button
                  type="submit"
                  className="w-full glass-button h-12 text-md font-semibold text-white"
                  disabled={!nickname.trim()}
                >
                  Continue as Guest
                </Button>
              </form>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#121212] px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <div className="flex justify-center w-full">
                <GoogleLogin
                  onSuccess={(credentialResponse) => {
                    if (credentialResponse.credential) {
                      loginWithGoogle(credentialResponse.credential)
                        .then((res) => {
                          if (res.isNewUser) {
                            setShowUsernameModal(true);
                            // Pre-fill with the nickname assigned from Google
                            setNewUsername((useUserStore.getState().nickname || "").replace(/\s+/g, ''));
                          } else {
                            router.push("/dashboard");
                          }
                        })
                        .catch(console.error);
                    }
                  }}
                  onError={() => {
                    console.log('Login Failed');
                  }}
                  theme="filled_black"
                  shape="pill"
                />
              </div>

              <div className="pt-2 border-t border-white/10">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Find me online</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {socials.map(({ label, href, icon: Icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
