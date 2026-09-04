const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/listejournal', async (req, res) => {
  try {
    // paramètres de pagination (par défaut page=1, pageSize=500)
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 500;

    // requête SQL
    const { rows } = await pool.query(
      'select id,codejrnl,designation from tjournal'

     
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





router.get('/listejournal_agence', async (req, res) => {
  try {
    // récupération paramètres
    const { idagence } = req.query;

    // pagination
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 500;

    // validation idagence obligatoire
    if (!idagence) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre idagence est obligatoire'
      });
    }

    // requête SQL
    const { rows } = await pool.query(
      `
      SELECT id, codejrnl, designation
      FROM tjournal
      WHERE idagence = $1
      ORDER BY designation
      `,
      [idagence]
    );

    // total
    const total = rows.length;

    // pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = rows.slice(startIndex, endIndex);

    // réponse
    res.json({
      success: true,
      meta: {
        total,
        page,
        pageSize
      },
      data: paginatedData
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: 'Erreur récupération journaux'
    });
  }
});




module.exports = router;
