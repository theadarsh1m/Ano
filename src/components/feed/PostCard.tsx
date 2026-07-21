"use client";

import { motion } from "framer-motion";
import { MessageCircle, Bookmark, BookmarkCheck, Share2, Trash2, MoreHorizontal, User, Check, Loader2, AlertCircle } from "lucide-react";
import { VoteButtons } from "./VoteButtons";
import { FeedPost } from "@/store/useFeedStore";
import { SafeMedia } from "../ui/SafeMedia";
import { useRouter } from "next/navigation";
import { useState } from "react";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

interface PostCardProps {
  post: FeedPost;
  onVote: (postId: string, value: 1 | -1) => void;
  onSave: (postId: string) => void;
  onUnsave: (postId: string) => void;
  onDelete?: (postId: string) => void;
  isOwner?: boolean;
}

export function PostCard({ post, onVote, onSave, onUnsave, onDelete, isOwner }: PostCardProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/feed/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/[0.07] hover:border-white/15 transition-all cursor-pointer"
      onClick={() => router.push(`/feed/${post.id}`)}
    >
      <div className="p-4 min-w-0">
        {/* Author row */}
        <div className="flex items-center gap-2 mb-2">
          {post.author.avatar ? (
            <img
              src={post.author.avatar}
              alt=""
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <User className="w-3 h-3 text-white" />
            </div>
          )}
          <span className="text-sm text-gray-300 font-medium">
            {post.author.nickname}
          </span>
          <span className="text-xs text-gray-500">•</span>
          <span className="text-xs text-gray-500">
            {timeAgo(post.createdAt)}
          </span>
          {post.tags.length > 0 && (
            <div className="flex gap-1 ml-1">
              {post.tags.slice(0, 2).map((tag) => (
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

        {/* Text content */}
        {post.content && (
          <p className="text-white text-sm mb-3 whitespace-pre-wrap line-clamp-4 leading-relaxed">
            {post.content}
          </p>
        )}

        {/* Image */}
        {post.imageUrl && (
          <div className="mb-3 rounded-lg overflow-hidden max-h-80">
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
                moderationStatus={post.moderationStatus}
                nudityScore={post.nudityScore}
                goreScore={post.goreScore}
                mediaId={`post_${post.id}`}
                alt="Post image"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <VoteButtons
            score={post.score}
            userVote={post.userVote}
            onVote={(val) => onVote(post.id, val)}
          />

          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/feed/${post.id}`);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-gray-400 bg-white/5 hover:bg-white/10 hover:text-white transition-colors border border-white/5"
          >
            <MessageCircle className="w-4 h-4" />
            {post.commentCount > 0 && <span>{post.commentCount}</span>}
            <span>Comments</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              post.isSaved ? onUnsave(post.id) : onSave(post.id);
            }}
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
            <span>{post.isSaved ? "Saved" : "Save"}</span>
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

          {isOwner && onDelete && (
            <div className="relative ml-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1.5 rounded-full text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 bottom-full mb-1 bg-zinc-800 border border-white/10 rounded-lg shadow-xl z-10 min-w-[120px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(post.id);
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
