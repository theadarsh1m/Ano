"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useFeedStore } from "@/store/useFeedStore";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { FeedTabs } from "@/components/feed/FeedTabs";
import { TagFilter } from "@/components/feed/TagFilter";
import { PostCard } from "@/components/feed/PostCard";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
import { motion } from "framer-motion";
import { Plus, Loader2, Rss } from "lucide-react";

export default function FeedPage() {
  const router = useRouter();
  const userId = useUserStore((s) => s.id);
  const nsfwMode = useUserStore((s) => s.nsfwMode);
  const [isClient, setIsClient] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const {
    posts,
    loading,
    error,
    hasMore,
    activeTab,
    activeTag,
    tags,
    setActiveTab,
    setActiveTag,
    fetchPosts,
    loadMore,
    fetchTags,
    voteOnPost,
    savePost,
    unsavePost,
    deletePost,
  } = useFeedStore();

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !userId) {
      router.push("/");
    }
  }, [isClient, userId, router]);

  useEffect(() => {
    if (userId) {
      fetchTags();
    }
  }, [userId, fetchTags]);

  useEffect(() => {
    if (userId) {
      fetchPosts(userId, true);
    }
  }, [userId, activeTab, activeTag, fetchPosts]);

  // Infinite scroll
  const handleLoadMore = useCallback(() => {
    if (userId && hasMore && !loading) {
      loadMore(userId);
    }
  }, [userId, hasMore, loading, loadMore]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.5 }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [handleLoadMore]);

  if (!isClient || !userId) return null;

  return (
    <div className="flex h-screen max-h-screen">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-3 pt-14 pb-8 md:px-4 md:pt-8 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center">
                <Rss className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Feed</h1>
            </div>
            <FeedTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </motion.div>

          {/* Tags */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <TagFilter
              tags={tags}
              activeTag={activeTag}
              onTagChange={setActiveTag}
            />
          </motion.div>

          {/* Post list */}
          <div className="space-y-3">
            {error && (
              <div className="text-center py-12 bg-red-500/5 rounded-xl border border-red-500/10">
                <p className="text-red-400 text-sm">Failed to load feed. Is the server running?</p>
                <button
                  onClick={() => fetchPosts(userId, true)}
                  className="text-blue-400 text-sm mt-2 hover:underline"
                >
                  Try again
                </button>
              </div>
            )}

            {!error && !loading && posts.length === 0 && (
              <div className="text-center py-16 bg-white/5 rounded-xl border border-white/10">
                <Rss className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No posts yet.</p>
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="text-blue-400 text-sm mt-2 hover:underline"
                >
                  Be the first to post!
                </button>
              </div>
            )}

            {posts
              .map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onVote={(pid, val) => voteOnPost(userId, pid, val)}
                  onSave={(pid) => savePost(userId, pid)}
                  onUnsave={(pid) => unsavePost(userId, pid)}
                  onDelete={(pid) => deletePost(pid, userId)}
                  isOwner={post.authorId === userId || post.isOwner}
                />
              ))}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-4" />

            {loading && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Floating create button */}
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          onClick={() => setCreateModalOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center hover:shadow-blue-500/50 hover:scale-105 transition-all z-30"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      </main>

      <CreatePostModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
