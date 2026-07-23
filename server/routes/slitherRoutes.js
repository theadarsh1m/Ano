const express = require('express');
const router = express.Router();

router.get('/lan-host', (req, res) => {
  res.json({
    isHost: true,
    hostName: 'ANO Local Host',
    gameId: 'slither_lan'
  });
});

module.exports = router;
