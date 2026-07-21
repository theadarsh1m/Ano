"use client";
import { API_URL } from "@/lib/config";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useFeedStore, FeedPost } from "@/store/useFeedStore";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PostCard } from "@/components/feed/PostCard";
import { motion } from "framer-motion";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";



export default function SavedPostsPage() {
  const router = useRouter();
  const userId = useUserStore((s) => s.id);
  const nsfwMode = useUserStore((s) => s.nsfwMode);
  const { voteOnPost, unsavePost } = useFeedStore();
  const [isClient, setIsClient] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !userId) router.push("/");
  }, [isClient, userId, router]);

  const fetchSaved = useCallback(async (p: number, reset = false) => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/feed/saved/${userId}?page=${p}&limit=20`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPosts((prev) => (reset ? data.posts : [...prev, ...data.posts]));
      setHasMore(data.hasMore);
      setPage(p);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchSaved(1, true);
  }, [userId, fetchSaved]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchSaved(page + 1);
        }
      },
      { threshold: 0.5 }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page, fetchSaved]);

  const handleUnsave = async (postId: string) => {
    if (!userId) return;
    await unsavePost(userId, postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  if (!isClient || !userId) return null;

  return (
    <div className="flex h-screen max-h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button
              onClick={() => router.push("/feed")}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Feed
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                <Bookmark className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Saved Posts</h1>
            </div>
          </motion.div>

          <div className="space-y-3">
            {!loading && posts.length === 0 && (
              <div className="text-center py-16 bg-white/5 rounded-xl border border-white/10">
                <Bookmark className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No saved posts yet.</p>
              </div>
            )}

            {posts
              .map((post) => (
                <PostCard
                  key={post.id}
                  post={{ ...post, isSaved: true }}
                  onVote={(pid, val) => voteOnPost(userId, pid, val)}
                  onSave={() => {}}
                  onUnsave={handleUnsave}
                />
              ))}

            <div ref={sentinelRef} className="h-4" />

            {loading && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
