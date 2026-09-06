const express = require('express');
const router = express.Router();

// Système de sauvegarde désactivé / abandonné

router.get('/', (req, res) => {
  res.json({ message: "Le module de sauvegarde a été désactivé." });
});

module.exports = router;