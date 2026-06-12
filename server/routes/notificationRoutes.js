const express = require('express');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Get notifications for a user
router.get('/:userId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const notifications = await notificationService.getUserNotifications(req.params.userId, limit);
    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark a notification as read
router.put('/:notificationId/read', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const updated = await notificationService.markAsRead(req.params.notificationId, userId);
    res.json(updated);
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read for a user
router.put('/read-all', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    await notificationService.markAllAsRead(userId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Create friendship (used for Friend requests)
router.post('/friendships', async (req, res) => {
  try {
    const { userId, friendId } = req.body;
    if (!userId || !friendId) {
      return res.status(400).json({ error: 'userId and friendId are required' });
    }
    const friendship = await notificationService.createFriendship(userId, friendId);
    res.json(friendship);
  } catch (err) {
    console.error('Error creating friendship:', err);
    res.status(500).json({ error: 'Failed to create friendship' });
  }
});

// Get friends for a user
router.get('/friendships/:userId', async (req, res) => {
  try {
    const friends = await notificationService.getFriends(req.params.userId);
    res.json(friends);
  } catch (err) {
    console.error('Error fetching friends:', err);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

module.exports = router;
