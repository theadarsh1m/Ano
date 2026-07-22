"use client";

import { useState } from "react";
import { FeedComment } from "@/store/useFeedStore";
import { useUserStore } from "@/store/useUserStore";
import { CommentInput } from "./CommentInput";
import { UserAvatar } from "../ui/UserAvatar";
import { Reply, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface CommentNodeProps {
  comment: FeedComment;
  depth: number;
  onReply: (parentId: string, content: string, isAnonymous: boolean) => Promise<void>;
  onDelete: (commentId: string) => void;
}

function CommentNode({ comment, depth, onReply, onDelete }: CommentNodeProps) {
  const [showReply, setShowReply] = useState(false);
  const myUserId = useUserStore((s) => s.id);
  const isOwner = comment.authorId === myUserId;
  const maxDepth = 3;

  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      className={`${depth > 0 ? "ml-6 border-l border-white/10 pl-4" : ""}`}
    >
      <div className="py-2">
        {/* Author */}
        <div className="flex items-center gap-2 mb-1">
          <UserAvatar
            src={comment.author.avatar}
            nickname={comment.author.nickname}
            size="w-5 h-5"
            textClassName="text-[9px] font-bold"
          />
          <span className="text-xs font-medium text-gray-300">
            {comment.author.nickname}
          </span>
          <span className="text-xs text-gray-600">
            {timeAgo(comment.createdAt)}
          </span>
        </div>

        {/* Content */}
        <p className="text-sm text-white/90 whitespace-pre-wrap mb-1.5">
          {comment.content}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {depth < maxDepth && (
            <button
              onClick={() => setShowReply(!showReply)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors"
            >
              <Reply className="w-3 h-3" />
              Reply
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => onDelete(comment.id)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          )}
        </div>

        {/* Reply input */}
        {showReply && (
          <div className="mt-2">
            <CommentInput
              placeholder={`Reply to ${comment.author.nickname}...`}
              autoFocus
              onSubmit={async (content, isAnonymous) => {
                await onReply(comment.id, content, isAnonymous);
                setShowReply(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div>
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

interface CommentThreadProps {
  comments: FeedComment[];
  loading: boolean;
  onReply: (parentId: string, content: string, isAnonymous: boolean) => Promise<void>;
  onDelete: (commentId: string) => void;
}

export function CommentThread({ comments, loading, onReply, onDelete }: CommentThreadProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No comments yet. Be the first to share your thoughts!
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {comments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          depth={0}
          onReply={onReply}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
