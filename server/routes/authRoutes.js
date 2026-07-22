const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const userService = require('../services/userService');
const ipService = require('../services/ipService');

const router = express.Router();

// The client ID should match the one used on the frontend
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    const { token, guestId } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    if (!CLIENT_ID) {
      console.warn("GOOGLE_CLIENT_ID is not set in environment variables.");
    }

    // Verify the Google ID token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID, 
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    let user;
    let eventType = 'LOGIN';

    if (guestId) {
      // Attempt to upgrade existing guest
      try {
        user = await userService.upgradeGuestToGoogle(guestId, payload);
        eventType = 'REGISTER';
      } catch (err) {
        if (err.message === 'Email is already connected to another account.') {
          // If the email is already in use by a permanent account, log them into that account instead
          user = await userService.findOrCreateGoogleUser(payload);
          eventType = 'LOGIN';
        } else {
          throw err;
        }
      }
    } else {
      // Standard Google Login
      const existingUser = await userService.getUserProfileByEmail ? await userService.getUserProfileByEmail(payload.email) : null;
      user = await userService.findOrCreateGoogleUser(payload);
      eventType = existingUser ? 'LOGIN' : 'REGISTER';
    }

    // Log IP event
    await ipService.logIpEvent({ userId: user.id, req, eventType });

    res.json(user);
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(500).json({ error: `Authentication failed: ${err.message}` });
  }
});

module.exports = router;
