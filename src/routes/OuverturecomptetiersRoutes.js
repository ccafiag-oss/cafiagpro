// routes/comptetiersRoutes.js
const express = require('express');
const router = express.Router();
const comptetiersController = require('../controllers/OuverturecomptetiersController');

// POST /api/comptetiers/ouvrir
router.post('/ouvrir', comptetiersController.ouvrirCompteTiers);

module.exports = router;
