"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useFeedStore } from "@/store/useFeedStore";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { VoteButtons } from "@/components/feed/VoteButtons";
import { CommentThread } from "@/components/feed/CommentThread";
import { CommentInput } from "@/components/feed/CommentInput";
import { SafeMedia } from "@/components/ui/SafeMedia";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Share2,
  Trash2,
  Lock,
  User,
  Loader2,
  MessageCircle,
  Check,
  AlertCircle,
} from "lucide-react";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.postId as string;
  const userId = useUserStore((s) => s.id);
  const [isClient, setIsClient] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    currentPost: post,
    comments,
    commentsLoading,
    fetchPost,
    fetchComments,
    voteOnPost,
    savePost,
    unsavePost,
    deletePost,
    addComment,
    deleteComment,
  } = useFeedStore();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !userId) {
      router.push("/");
    }
  }, [isClient, userId, router]);

  useEffect(() => {
    if (userId && postId) {
      fetchPost(postId, userId);
      fetchComments(postId);
    }
  }, [userId, postId, fetchPost, fetchComments]);

  const handleShare = async () => {
    const url = `${window.location.origin}/feed/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDelete = async () => {
    if (!userId || !post) return;
    const success = await deletePost(post.id, userId);
    if (success) router.push("/feed");
  };

  const handleAddComment = async (content: string, isAnonymous: boolean) => {
    if (!userId) return;
    await addComment({
      authorId: userId,
      postId,
      content,
      isAnonymous,
    });
  };

  const handleReply = async (
    parentId: string,
    content: string,
    isAnonymous: boolean
  ) => {
    if (!userId) return;
    await addComment({
      authorId: userId,
      postId,
      content,
      parentId,
      isAnonymous,
    });
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!userId) return;
    await deleteComment(commentId, userId);
  };

  if (!isClient || !userId) return null;

  if (!post) {
    return (
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </main>
      </div>
    );
  }

  const isOwner = post.isOwner || post.authorId === userId;

  return (
    <div className="flex h-screen max-h-screen">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Back button */}
          <button
            onClick={() => router.push("/feed")}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Feed
          </button>

          {/* Post */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl"
          >
            <div className="p-4 min-w-0">
              {/* Author */}
              <div className="flex items-center gap-2 mb-3">
                {post.author.avatar ? (
                  <img
                    src={post.author.avatar}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                <div>
                  <span className="text-sm font-medium text-white">
                    {post.author.nickname}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {timeAgo(post.createdAt)}
                  </span>
                </div>
                {post.tags.length > 0 && (
                  <div className="flex gap-1 ml-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Text */}
              {post.content && (
                <p className="text-white text-sm whitespace-pre-wrap mb-3 leading-relaxed">
                  {post.content}
                </p>
              )}

              {/* Image */}
              {post.imageUrl && (
                <div className="mb-3 rounded-xl overflow-hidden">
                  <div className="relative w-full h-full">
                    {/* Image Scanning Overlay Badge */}
                    {['PENDING', 'SCANNING'].includes(post.moderationStatus || '') && (
                      <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-black text-blue-400 border border-blue-500/20 flex items-center gap-1.5 z-10 shadow-lg select-none">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        <span>Scanning...</span>
                      </div>
                    )}
                    {post.moderationStatus === 'SCANNING_FAILED' && (
                      <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-black text-amber-500 border border-amber-500/20 flex items-center gap-1.5 z-10 shadow-lg select-none">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        <span>Scanning failed (retrying)</span>
                      </div>
                    )}
                    <SafeMedia
                      src={post.imageUrl}
                      alt="Post image"
                      className="w-full max-h-[500px] object-contain bg-black/20"
                      moderationStatus={post.moderationStatus}
                      nudityScore={post.nudityScore}
                      goreScore={post.goreScore}
                      mediaId={`post_${post.id}`}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/5">
                <VoteButtons
                  score={post.score}
                  userVote={post.userVote}
                  onVote={(val) => voteOnPost(userId, post.id, val)}
                />

                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-gray-400 bg-white/5 border border-white/5">
                  <MessageCircle className="w-4 h-4" />
                  {post.commentCount} Comments
                </span>

                <button
                  onClick={() =>
                    post.isSaved
                      ? unsavePost(userId, post.id)
                      : savePost(userId, post.id)
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors border border-white/5 bg-white/5 hover:bg-white/10 ${
                    post.isSaved
                      ? "text-yellow-400 border-yellow-500/20"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {post.isSaved ? (
                    <BookmarkCheck className="w-4 h-4" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                  {post.isSaved ? "Saved" : "Save"}
                </button>

                <button
                  onClick={handleShare}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/5 hover:bg-white/10 transition-colors border border-white/5 ${
                    copied ? "text-green-400 border-green-500/20" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </>
                  )}
                </button>

                {isOwner && (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-red-400 hover:bg-red-500/10 transition-colors border border-white/5 bg-white/5 hover:border-red-500/20 ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Comment section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <h3 className="text-sm font-semibold text-gray-300">
              Comments
            </h3>

            {post.isLocked ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-4 px-3 bg-white/5 rounded-xl border border-white/10">
                <Lock className="w-4 h-4" />
                Comments are locked on this post.
              </div>
            ) : (
              <CommentInput onSubmit={handleAddComment} />
            )}

            <CommentThread
              comments={comments}
              loading={commentsLoading}
              onReply={handleReply}
              onDelete={handleDeleteComment}
            />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
