import { create } from 'zustand';

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export interface PostAuthor {
  id: string | null;
  nickname: string;
  avatar: string | null;
}

export interface FeedPost {
  id: string;
  content: string | null;
  imageUrl: string | null;
  isAnonymous: boolean;
  score: number;
  tags: string[];
  commentCount: number;
  isLocked: boolean;
  createdAt: string;
  updatedAt?: string;
  author: PostAuthor;
  authorId: string | null;
  userVote: number; // +1, -1, or 0
  isSaved: boolean;
  isOwner?: boolean;
}

export interface FeedComment {
  id: string;
  content: string;
  isAnonymous: boolean;
  author: PostAuthor;
  authorId: string | null;
  postId: string;
  parentId: string | null;
  createdAt: string;
  replies: FeedComment[];
}

interface FeedState {
  posts: FeedPost[];
  loading: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  activeTab: 'latest' | 'trending';
  activeTag: string | null;
  tags: string[];

  // Detail view
  currentPost: FeedPost | null;
  comments: FeedComment[];
  commentsLoading: boolean;

  // Actions
  setActiveTab: (tab: 'latest' | 'trending') => void;
  setActiveTag: (tag: string | null) => void;
  fetchPosts: (userId: string, reset?: boolean) => Promise<void>;
  loadMore: (userId: string) => Promise<void>;
  fetchTags: () => Promise<void>;
  createPost: (data: {
    authorId: string;
    content?: string;
    imageUrl?: string;
    isAnonymous?: boolean;
    tags?: string[];
  }) => Promise<FeedPost | null>;
  voteOnPost: (userId: string, postId: string, value: 1 | -1) => Promise<void>;
  savePost: (userId: string, postId: string) => Promise<void>;
  unsavePost: (userId: string, postId: string) => Promise<void>;
  deletePost: (postId: string, authorId: string) => Promise<boolean>;

  // Detail
  fetchPost: (postId: string, userId: string) => Promise<void>;
  fetchComments: (postId: string) => Promise<void>;
  addComment: (data: {
    authorId: string;
    postId: string;
    content: string;
    parentId?: string;
    isAnonymous?: boolean;
  }) => Promise<FeedComment | null>;
  deleteComment: (commentId: string, authorId: string) => Promise<boolean>;

  clearFeed: () => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  loading: false,
  error: null,
  page: 1,
  hasMore: true,
  activeTab: 'latest',
  activeTag: null,
  tags: [],
  currentPost: null,
  comments: [],
  commentsLoading: false,

  setActiveTab: (tab) => {
    set({ activeTab: tab, posts: [], page: 1, hasMore: true });
  },

  setActiveTag: (tag) => {
    set({ activeTag: tag, posts: [], page: 1, hasMore: true });
  },

  fetchTags: async () => {
    try {
      const res = await fetch(`${API_URL}/api/feed/tags`);
      if (res.ok) {
        const tags = await res.json();
        set({ tags });
      }
    } catch {
      // Silent fail
    }
  },

  fetchPosts: async (userId, reset = true) => {
    const { activeTab, activeTag } = get();
    if (reset) {
      set({ loading: true, error: null, page: 1 });
    }

    try {
      const params = new URLSearchParams({
        tab: activeTab,
        page: '1',
        limit: '20',
        userId,
      });
      if (activeTag) params.set('tag', activeTag);

      const res = await fetch(`${API_URL}/api/feed?${params}`);
      if (!res.ok) throw new Error('Failed to fetch feed');
      const data = await res.json();
      set({
        posts: data.posts,
        hasMore: data.hasMore,
        page: 1,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  loadMore: async (userId) => {
    const { activeTab, activeTag, page, hasMore, loading } = get();
    if (!hasMore || loading) return;

    set({ loading: true });
    const nextPage = page + 1;

    try {
      const params = new URLSearchParams({
        tab: activeTab,
        page: String(nextPage),
        limit: '20',
        userId,
      });
      if (activeTag) params.set('tag', activeTag);

      const res = await fetch(`${API_URL}/api/feed?${params}`);
      if (!res.ok) throw new Error('Failed to load more');
      const data = await res.json();
      set((state) => ({
        posts: [...state.posts, ...data.posts],
        hasMore: data.hasMore,
        page: nextPage,
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },

  createPost: async (data) => {
    try {
      const res = await fetch(`${API_URL}/api/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create post');
      const post = await res.json();

      // Add to front of posts list
      set((state) => ({
        posts: [{
          ...post,
          userVote: 0,
          isSaved: false,
          author: post.isAnonymous
            ? { id: null, nickname: 'Anonymous', avatar: null }
            : post.author,
        }, ...state.posts],
      }));
      return post;
    } catch (err) {
      console.error('Failed to create post:', err);
      return null;
    }
  },

  voteOnPost: async (userId, postId, value) => {
    try {
      const res = await fetch(`${API_URL}/api/feed/${postId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, value }),
      });
      if (!res.ok) throw new Error('Failed to vote');
      const result = await res.json();

      // Update post in list
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, score: result.score, userVote: result.userVote } : p
        ),
        currentPost: state.currentPost?.id === postId
          ? { ...state.currentPost, score: result.score, userVote: result.userVote }
          : state.currentPost,
      }));
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  },

  savePost: async (userId, postId) => {
    try {
      await fetch(`${API_URL}/api/feed/${postId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, isSaved: true } : p
        ),
        currentPost: state.currentPost?.id === postId
          ? { ...state.currentPost, isSaved: true }
          : state.currentPost,
      }));
    } catch (err) {
      console.error('Failed to save post:', err);
    }
  },

  unsavePost: async (userId, postId) => {
    try {
      await fetch(`${API_URL}/api/feed/${postId}/save`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, isSaved: false } : p
        ),
        currentPost: state.currentPost?.id === postId
          ? { ...state.currentPost, isSaved: false }
          : state.currentPost,
      }));
    } catch (err) {
      console.error('Failed to unsave post:', err);
    }
  },

  deletePost: async (postId, authorId) => {
    try {
      const res = await fetch(`${API_URL}/api/feed/${postId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId }),
      });
      if (!res.ok) return false;
      set((state) => ({
        posts: state.posts.filter((p) => p.id !== postId),
      }));
      return true;
    } catch {
      return false;
    }
  },

  fetchPost: async (postId, userId) => {
    try {
      const res = await fetch(`${API_URL}/api/feed/${postId}?userId=${userId}`);
      if (!res.ok) throw new Error('Post not found');
      const post = await res.json();
      set({ currentPost: post });
    } catch {
      set({ currentPost: null });
    }
  },

  fetchComments: async (postId) => {
    set({ commentsLoading: true });
    try {
      const res = await fetch(`${API_URL}/api/feed/${postId}/comments`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      const comments = await res.json();
      set({ comments, commentsLoading: false });
    } catch {
      set({ commentsLoading: false });
    }
  },

  addComment: async (data) => {
    try {
      const res = await fetch(`${API_URL}/api/feed/${data.postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      const comment = await res.json();

      // Update comments list — add to correct place
      set((state) => {
        if (comment.parentId) {
          // It's a reply — we'll just refetch for simplicity
          return state;
        }
        return {
          comments: [...state.comments, { ...comment, replies: [] }],
          currentPost: state.currentPost
            ? { ...state.currentPost, commentCount: state.currentPost.commentCount + 1 }
            : null,
          posts: state.posts.map((p) =>
            p.id === data.postId ? { ...p, commentCount: p.commentCount + 1 } : p
          ),
        };
      });

      // If it was a reply, refetch all comments
      if (comment.parentId) {
        await get().fetchComments(data.postId);
        // Also update counts
        set((state) => ({
          currentPost: state.currentPost
            ? { ...state.currentPost, commentCount: state.currentPost.commentCount + 1 }
            : null,
          posts: state.posts.map((p) =>
            p.id === data.postId ? { ...p, commentCount: p.commentCount + 1 } : p
          ),
        }));
      }

      return comment;
    } catch (err) {
      console.error('Failed to add comment:', err);
      return null;
    }
  },

  deleteComment: async (commentId, authorId) => {
    try {
      const res = await fetch(`${API_URL}/api/feed/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId }),
      });
      if (!res.ok) return false;
      // Refetch comments
      const { currentPost } = get();
      if (currentPost) {
        await get().fetchComments(currentPost.id);
        set((state) => ({
          currentPost: state.currentPost
            ? { ...state.currentPost, commentCount: Math.max(0, state.currentPost.commentCount - 1) }
            : null,
        }));
      }
      return true;
    } catch {
      return false;
    }
  },

  clearFeed: () => {
    set({
      posts: [],
      loading: false,
      error: null,
      page: 1,
      hasMore: true,
      currentPost: null,
      comments: [],
    });
  },
}));
