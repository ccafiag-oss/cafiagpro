const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
  try {
    // paramètres de pagination (par défaut page=1, pageSize=500)
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 500;

    // requête SQL
    const { rows } = await pool.query(
      'select id,modes,paiementsduree from modepaiements'

    
    );

    // calcul du total
    const total = rows.length;

    // pagination (slice côté serveur)
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = rows.slice(startIndex, endIndex);

    // réponse JSON structurée
    res.json({
      meta: {
        total,
        page,
        pageSize
      },
      data: paginatedData
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération agence' });
  }
});

module.exports = router;
