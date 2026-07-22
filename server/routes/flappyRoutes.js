const express = require('express');
const prisma = require('../db');
const router = express.Router();

const ACHIEVEMENTS_LIST = [
  { id: 'FIRST_FLAP', title: 'First Flap', description: 'Play your first game of Flappy Bird.', icon: '🐣' },
  { id: 'SCORE_10', title: 'Double Digits', description: 'Reach a score of 10 in a single game.', icon: '🥉' },
  { id: 'SCORE_25', title: 'Sky Hopper', description: 'Reach a score of 25 in a single game.', icon: '🥈' },
  { id: 'SCORE_50', title: 'Flappy Master', description: 'Reach a score of 50 in a single game.', icon: '🥇' },
  { id: 'GAMES_100', title: 'Dedicated Aviator', description: 'Play 100 total games of Flappy Bird.', icon: '👑' },
];

/**
 * Helper to update user Flappy Bird stats in Prisma GameStat.extraStats
 */
async function getOrCreateFlappyStat(userId) {
  let stat = await prisma.gameStat.findUnique({
    where: { userId_gameType: { userId, gameType: 'FLAPPY_BIRD' } }
  });

  if (!stat) {
    const defaultExtra = {
      singlePlayer: {
        gamesPlayed: 0,
        highScore: 0,
        pipesPassed: 0,
        timeSurvivedSeconds: 0,
        totalScore: 0,
        coins: 0,
        xp: 0,
        unlockedAchievements: []
      },
      multiplayer: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        highScore: 0,
        pipesPassed: 0,
        timeSurvivedSeconds: 0,
        longestSurvivalSeconds: 0
      },
      matchHistory: []
    };

    stat = await prisma.gameStat.create({
      data: {
        userId,
        gameType: 'FLAPPY_BIRD',
        highScore: 0,
        totalPlayTimeSeconds: 0,
        extraStats: defaultExtra
      }
    });
  }

  return stat;
}

// 1. Submit Single Player Score
router.post('/submit-score', async (req, res) => {
  try {
    const { userId, nickname, avatar, score, pipesPassed, playTimeSeconds } = req.body;

    if (!userId || score === undefined || playTimeSeconds === undefined) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Anti-cheat validation: score rate sanity check
    if (playTimeSeconds > 0 && (score / playTimeSeconds) > 3.5) {
      return res.status(400).json({ error: 'Invalid score submission' });
    }

    const stat = await getOrCreateFlappyStat(userId);
    const extra = stat.extraStats || {};
    extra.nickname = nickname || extra.nickname || 'Player';
    extra.avatar = avatar || extra.avatar || null;

    const sp = extra.singlePlayer || {
      gamesPlayed: 0,
      highScore: 0,
      pipesPassed: 0,
      timeSurvivedSeconds: 0,
      totalScore: 0,
      coins: 0,
      xp: 0,
      unlockedAchievements: []
    };
    sp.nickname = nickname || sp.nickname || 'Player';

    sp.gamesPlayed += 1;
    sp.highScore = Math.max(sp.highScore, score);
    sp.pipesPassed += (pipesPassed || score);
    sp.timeSurvivedSeconds += Math.round(playTimeSeconds);
    sp.totalScore = (sp.totalScore || 0) + score;

    // Record Match History
    const history = extra.matchHistory || [];
    history.unshift({
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString(),
      mode: 'SINGLEPLAYER',
      score,
      timeSurvivedSeconds: Math.round(playTimeSeconds)
    });
    extra.matchHistory = history.slice(0, 15); // keep last 15 matches

    // Check Achievements
    const newUnlocked = new Set(sp.unlockedAchievements || []);
    newUnlocked.add('FIRST_FLAP');
    if (score >= 10) newUnlocked.add('SCORE_10');
    if (score >= 25) newUnlocked.add('SCORE_25');
    if (score >= 50) newUnlocked.add('SCORE_50');
    if (sp.gamesPlayed >= 100) newUnlocked.add('GAMES_100');

    sp.unlockedAchievements = Array.from(newUnlocked);
    extra.singlePlayer = sp;

    // Update Prisma GameStat
    const updatedStat = await prisma.gameStat.update({
      where: { id: stat.id },
      data: {
        highScore: Math.max(stat.highScore, score),
        totalPlayTimeSeconds: stat.totalPlayTimeSeconds + Math.round(playTimeSeconds),
        lastPlayed: new Date(),
        extraStats: extra
      }
    });

    res.json({
      success: true,
      highScore: sp.highScore,
      stat: updatedStat
    });
  } catch (err) {
    console.error('Error submitting flappy score:', err);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

// 2. Get Leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const stats = await prisma.gameStat.findMany({
      where: { gameType: 'FLAPPY_BIRD' },
      orderBy: { highScore: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true
          }
        }
      }
    });

    const leaderboard = stats.map((s, idx) => ({
      rank: idx + 1,
      userId: s.userId,
      nickname: s.user?.nickname || s.extraStats?.nickname || s.extraStats?.singlePlayer?.nickname || 'Player',
      avatar: s.user?.avatar || s.extraStats?.avatar || null,
      highScore: s.highScore,
      totalPlayTimeSeconds: s.totalPlayTimeSeconds,
      lastPlayed: s.lastPlayed
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// 3. Get User Stats, Match History & Achievements
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const stat = await getOrCreateFlappyStat(userId);
    const extra = stat.extraStats || {};

    const sp = extra.singlePlayer || {};
    const mp = extra.multiplayer || {};

    // Calculate Average Score
    if (sp.gamesPlayed > 0) {
      sp.averageScore = Math.round((sp.totalScore || sp.highScore) / sp.gamesPlayed);
    } else {
      sp.averageScore = 0;
    }

    const unlockedSet = new Set(sp.unlockedAchievements || []);
    const achievements = ACHIEVEMENTS_LIST.map(a => ({
      ...a,
      unlocked: unlockedSet.has(a.id)
    }));

    res.json({
      singlePlayer: sp,
      multiplayer: mp,
      matchHistory: extra.matchHistory || [],
      achievements
    });
  } catch (err) {
    console.error('Error fetching user stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
