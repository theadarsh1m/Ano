const express = require('express');
const prisma = require('../db');
const router = express.Router();

// Submit a review
router.post('/review', async (req, res) => {
  try {
    const { userId, stars, content, category } = req.body;
    if (!userId || !stars || !content || !category) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const review = await prisma.review.create({
      data: {
        userId,
        stars: parseInt(stars),
        content,
        category
      }
    });

    res.json({ success: true, review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit a bug report
router.post('/bug', async (req, res) => {
  try {
    const { userId, description, screenshot, browser, device, game } = req.body;
    if (!userId || !description) {
      return res.status(400).json({ error: 'User ID and description are required' });
    }

    const bug = await prisma.bugReport.create({
      data: {
        userId,
        description,
        screenshot,
        browser,
        device,
        game
      }
    });

    res.json({ success: true, bug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit a user report
router.post('/report', async (req, res) => {
  try {
    const { reporterId, reportedId, reason, details } = req.body;
    if (!reporterId || !reportedId || !reason) {
      return res.status(400).json({ error: 'Reporter ID, Reported ID, and reason are required' });
    }

    const report = await prisma.userReport.create({
      data: {
        reporterId,
        reportedId,
        reason,
        details
      }
    });

    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
