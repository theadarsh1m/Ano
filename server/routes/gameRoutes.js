const express = require('express');
const gameService = require('../services/gameService');

const router = express.Router();

// Get stats for a user
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = await gameService.getUserStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching game stats:', error);
    res.status(500).json({ error: 'Failed to fetch game stats' });
  }
});

// Save game result
router.post('/save', async (req, res) => {
  try {
    const { userId, gameType, score, playTimeSeconds } = req.body;
    
    if (!userId || !gameType || score === undefined || playTimeSeconds === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const stat = await gameService.updateGameStat(userId, gameType, score, playTimeSeconds);
    res.json(stat);
  } catch (error) {
    console.error('Error saving game stat:', error);
    res.status(500).json({ error: 'Failed to save game stat' });
  }
});

module.exports = router;
