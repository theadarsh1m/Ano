const prisma = require('../db');

// Predefined tags
const AVAILABLE_TAGS = [
  'DSA', 'College', 'Gaming', 'Memes',
  'Projects', 'Placements', 'General', 'Help',
  'Tech', 'Off-Topic'
];

const feedService = {
  /**
   * Create a new post.
   */
  async createPost(authorId, { content, imageUrl, isAnonymous = false, tags = [] }) {
    // Filter to only valid tags
    const validTags = tags.filter(t => AVAILABLE_TAGS.includes(t));

    return prisma.post.create({
      data: {
        content,
        imageUrl,
        isAnonymous,
        authorId,
        tags: validTags,
      },
      include: {
        author: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });
  },

  /**
   * Get posts with pagination.
   * tab: 'latest' | 'trending'
   * tag: optional filter
   */
  async getPosts({ tab = 'latest', page = 1, limit = 20, tag, userId }) {
    const skip = (page - 1) * limit;

    const where = {};
    if (tag) {
      where.tags = { has: tag };
    }

    let orderBy;
    if (tab === 'trending') {
      // Trending: combination of score + recent activity
      // We'll use raw query for trending, but for basic version use score + recency
      orderBy = [{ score: 'desc' }, { commentCount: 'desc' }, { createdAt: 'desc' }];
    } else {
      orderBy = { createdAt: 'desc' };
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          author: {
            select: { id: true, nickname: true, avatar: true },
          },
          votes: userId ? {
            where: { userId },
            select: { value: true },
          } : false,
          savedBy: userId ? {
            where: { userId },
            select: { id: true },
          } : false,
        },
      }),
      prisma.post.count({ where }),
    ]);

    // Format posts: hide author info for anonymous posts
    const formatted = posts.map(post => {
      const userVote = post.votes?.[0]?.value || 0;
      const isSaved = post.savedBy?.length > 0;

      return {
        id: post.id,
        content: post.content,
        imageUrl: post.imageUrl,
        isAnonymous: post.isAnonymous,
        score: post.score,
        tags: post.tags,
        commentCount: post.commentCount,
        isLocked: post.isLocked,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        moderationStatus: post.moderationStatus,
        isNSFW: post.isNSFW,
        nsfwConfidence: post.nsfwConfidence,
        author: post.isAnonymous
          ? { id: null, nickname: 'Anonymous', avatar: null }
          : post.author,
        authorId: post.isAnonymous ? null : post.authorId,
        userVote,
        isSaved,
      };
    });

    return {
      posts: formatted,
      total,
      page,
      hasMore: skip + limit < total,
    };
  },

  /**
   * Get a single post by ID.
   */
  async getPostById(postId, requesterId) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: { id: true, nickname: true, avatar: true },
        },
        votes: requesterId ? {
          where: { userId: requesterId },
          select: { value: true },
        } : false,
        savedBy: requesterId ? {
          where: { userId: requesterId },
          select: { id: true },
        } : false,
      },
    });

    if (!post) return null;

    const userVote = post.votes?.[0]?.value || 0;
    const isSaved = post.savedBy?.length > 0;

    return {
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl,
      isAnonymous: post.isAnonymous,
      score: post.score,
      tags: post.tags,
      commentCount: post.commentCount,
      isLocked: post.isLocked,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      moderationStatus: post.moderationStatus,
      isNSFW: post.isNSFW,
      nsfwConfidence: post.nsfwConfidence,
      author: post.isAnonymous
        ? { id: null, nickname: 'Anonymous', avatar: null }
        : post.author,
      authorId: post.isAnonymous ? null : post.authorId,
      // Always expose real authorId to the author themselves
      isOwner: post.authorId === requesterId,
      userVote,
      isSaved,
    };
  },

  /**
   * Update a post (only by author).
   */
  async updatePost(postId, authorId, { content, imageUrl, tags }) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== authorId) {
      throw new Error('Unauthorized');
    }

    const updateData = {};
    if (content !== undefined) updateData.content = content;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (tags !== undefined) updateData.tags = tags.filter(t => AVAILABLE_TAGS.includes(t));

    return prisma.post.update({
      where: { id: postId },
      data: updateData,
      include: {
        author: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });
  },

  /**
   * Delete a post (only by author).
   */
  async deletePost(postId, authorId) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== authorId) {
      throw new Error('Unauthorized');
    }

    await prisma.post.delete({ where: { id: postId } });
    return true;
  },

  /**
   * Vote on a post. value: +1 or -1.
   * If user already voted with same value, remove the vote.
   * If different value, update.
   */
  async vote(userId, postId, value) {
    if (value !== 1 && value !== -1) throw new Error('Invalid vote value');

    const existing = await prisma.vote.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    let scoreDelta = 0;

    if (existing) {
      if (existing.value === value) {
        // Same vote — remove it (toggle off)
        await prisma.vote.delete({
          where: { id: existing.id },
        });
        scoreDelta = -value;
      } else {
        // Different vote — update
        await prisma.vote.update({
          where: { id: existing.id },
          data: { value },
        });
        scoreDelta = value * 2; // e.g. from -1 to +1 = +2
      }
    } else {
      // New vote
      await prisma.vote.create({
        data: { userId, postId, value },
      });
      scoreDelta = value;
    }

    // Update cached score
    const updated = await prisma.post.update({
      where: { id: postId },
      data: { score: { increment: scoreDelta } },
      select: { score: true },
    });

    // Determine what the user's current vote is
    const currentVote = await prisma.vote.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    return { score: updated.score, userVote: currentVote?.value || 0 };
  },

  /**
   * Create a comment on a post.
   */
  async createComment(authorId, postId, { content, parentId = null, isAnonymous = false }) {
    // Check post exists and isn't locked
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new Error('Post not found');
    if (post.isLocked) throw new Error('Comments are locked');

    // Validate parentId if provided
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parent || parent.postId !== postId) throw new Error('Invalid parent comment');
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        isAnonymous,
        authorId,
        postId,
        parentId,
      },
      include: {
        author: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });

    // Increment comment count
    await prisma.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });

    // Format for anonymous
    return {
      ...comment,
      author: comment.isAnonymous
        ? { id: null, nickname: 'Anonymous', avatar: null }
        : comment.author,
      authorId: comment.isAnonymous ? null : comment.authorId,
    };
  },

  /**
   * Get threaded comments for a post.
   */
  async getComments(postId, { page = 1, limit = 50 }) {
    const skip = (page - 1) * limit;

    // Get top-level comments
    const comments = await prisma.comment.findMany({
      where: { postId, parentId: null },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
      include: {
        author: {
          select: { id: true, nickname: true, avatar: true },
        },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, nickname: true, avatar: true },
            },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                author: {
                  select: { id: true, nickname: true, avatar: true },
                },
              },
            },
          },
        },
      },
    });

    // Format for anonymous comments recursively
    const formatComment = (c) => ({
      ...c,
      author: c.isAnonymous
        ? { id: null, nickname: 'Anonymous', avatar: null }
        : c.author,
      authorId: c.isAnonymous ? null : c.authorId,
      replies: c.replies ? c.replies.map(formatComment) : [],
    });

    return comments.map(formatComment);
  },

  /**
   * Delete a comment (only by author).
   */
  async deleteComment(commentId, authorId) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.authorId !== authorId) {
      throw new Error('Unauthorized');
    }

    await prisma.comment.delete({ where: { id: commentId } });

    // Decrement comment count
    await prisma.post.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    });

    return true;
  },

  /**
   * Save/bookmark a post.
   */
  async savePost(userId, postId) {
    return prisma.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      update: {},
      create: { userId, postId },
    });
  },

  /**
   * Remove saved post.
   */
  async unsavePost(userId, postId) {
    await prisma.savedPost.deleteMany({
      where: { userId, postId },
    });
    return true;
  },

  /**
   * Get saved posts for a user.
   */
  async getSavedPosts(userId, { page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const [saved, total] = await Promise.all([
      prisma.savedPost.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          post: {
            include: {
              author: {
                select: { id: true, nickname: true, avatar: true },
              },
              votes: {
                where: { userId },
                select: { value: true },
              },
            },
          },
        },
      }),
      prisma.savedPost.count({ where: { userId } }),
    ]);

    const posts = saved.map(s => {
      const post = s.post;
      return {
        id: post.id,
        content: post.content,
        imageUrl: post.imageUrl,
        isAnonymous: post.isAnonymous,
        score: post.score,
        tags: post.tags,
        commentCount: post.commentCount,
        isLocked: post.isLocked,
        createdAt: post.createdAt,
        author: post.isAnonymous
          ? { id: null, nickname: 'Anonymous', avatar: null }
          : post.author,
        userVote: post.votes?.[0]?.value || 0,
        isSaved: true,
        savedAt: s.createdAt,
      };
    });

    return { posts, total, page, hasMore: skip + limit < total };
  },

  /**
   * Get user's feed stats (for profile).
   */
  async getUserFeedStats(userId) {
    const [totalPosts, posts] = await Promise.all([
      prisma.post.count({ where: { authorId: userId } }),
      prisma.post.findMany({
        where: { authorId: userId },
        select: { score: true },
      }),
    ]);

    const totalKarma = posts.reduce((sum, p) => sum + p.score, 0);
    const totalComments = await prisma.comment.count({ where: { authorId: userId } });

    return {
      totalPosts,
      totalKarma,
      totalComments,
    };
  },

  /**
   * Get available tags list.
   */
  getAvailableTags() {
    return AVAILABLE_TAGS;
  },
};

module.exports = feedService;
