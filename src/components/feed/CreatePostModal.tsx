"use client";
import { API_URL } from "@/lib/config";

import { useState, useRef } from "react";
import { GlassModal } from "@/components/layout/GlassModal";
import { useUserStore } from "@/store/useUserStore";
import { useFeedStore } from "@/store/useFeedStore";
import { ImagePlus, X, Eye, EyeOff, Loader2 } from "lucide-react";



interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePostModal({ isOpen, onClose }: CreatePostModalProps) {
  const userId = useUserStore((s) => s.id);
  const createPost = useFeedStore((s) => s.createPost);
  const tags = useFeedStore((s) => s.tags);

  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setImageUrl(data.secureUrl || data.url);
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 3)
    );
  };

  const handleSubmit = async () => {
    if (!userId || (!content.trim() && !imageUrl)) return;

    setSubmitting(true);
    const post = await createPost({
      authorId: userId,
      content: content.trim() || undefined,
      imageUrl: imageUrl || undefined,
      isAnonymous,
      tags: selectedTags,
    });

    if (post) {
      setContent("");
      setImageUrl(null);
      setIsAnonymous(false);
      setSelectedTags([]);
      onClose();
    }
    setSubmitting(false);
  };

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="Create Post">
      <div className="space-y-4">
        {/* Anonymous toggle */}
        <button
          onClick={() => setIsAnonymous(!isAnonymous)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all w-full ${
            isAnonymous
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
              : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
          }`}
        >
          {isAnonymous ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
          Post as {isAnonymous ? "Anonymous" : "Yourself"}
        </button>

        {/* Text input */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 min-h-[120px] text-sm"
          rows={5}
        />

        {/* Image preview */}
        {imageUrl && (
          <div className="relative rounded-xl overflow-hidden">
            <img src={imageUrl} alt="Preview" className="w-full max-h-60 object-cover" />
            <button
              onClick={() => setImageUrl(null)}
              className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        )}

        {/* Upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4" />
          )}
          {uploading ? "Uploading..." : "Add Image"}
        </button>

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Tags (max 3)</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedTags.includes(tag)
                      ? "bg-blue-500/30 text-blue-300 border border-blue-500/40"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || uploading || (!content.trim() && !imageUrl)}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Posting...
            </span>
          ) : uploading ? (
            "Uploading image..."
          ) : (
            "Post"
          )}
        </button>
      </div>
    </GlassModal>
  );
}
