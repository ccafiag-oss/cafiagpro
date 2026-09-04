const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/listeoperateurmobile', async (req, res) => {
  try {
    // paramètres de pagination
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 500;
    const offset = (page - 1) * pageSize;

    // total des enregistrements
    const totalResult = await pool.query(
      'SELECT COUNT(*) AS total FROM operateurtelephone'
    );

    const total = parseInt(totalResult.rows[0].total);

    // récupération paginée
    const result = await pool.query(
      `SELECT id, codemobile, description
       FROM operateurtelephone
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    res.json({
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      },
      data: result.rows
    });

  } catch (err) {
    console.error("Erreur :", err);
    res.status(500).json({
      error: 'Erreur récupération opérateurs'
    });
  }
});

module.exports = router;