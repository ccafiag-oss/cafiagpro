const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ===================================================
// 🔵 1. LISTE DES SÉRIES
// ===================================================
// GET: http://localhost:5265/api/serie?idagence=1&search=sciences
// ==========================================
router.get('/serie', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le paramètre "idagence" est obligatoire.' 
    });
  }

  try {
    let queryText = `
      SELECT idserie, idagence, libelleserie, autres
      FROM eco_serie
      WHERE idagence = $1
    `;
    const params = [idagence];

    if (search && search.trim() !== '') {
      queryText += ` AND libelleserie ILIKE $2`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY idserie DESC;`;
    
    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /serie:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du chargement des séries.' 
    });
  }
});

// ===================================================
// 🟢 2. AJOUTER UNE SÉRIE
// ===================================================
router.post('/serie', async (req, res) => {
  try {
    const { idagence, libelleserie, autres } = req.body;

    if (!idagence || !libelleserie) {
      return res.status(400).json({
        success: false,
        error: 'Les champs "idagence" et "libelleserie" sont obligatoires.'
      });
    }

    const result = await pool.query(
      `INSERT INTO eco_serie (idagence, libelleserie, autres)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [idagence, libelleserie, autres || null]
    );

    res.status(201).json({
      success: true,
      message: 'Série ajoutée avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur POST /serie:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Cette série existe déjà.'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'ajout de la série.' 
    });
  }
});

// ===================================================
// 🟡 3. MODIFIER UNE SÉRIE
// ===================================================
router.put('/serie/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { libelleserie, autres } = req.body;

    if (!libelleserie) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "libelleserie" est obligatoire.'
      });
    }

    const result = await pool.query(
      `UPDATE eco_serie
       SET libelleserie = $1,
           autres = $2
       WHERE idserie = $3
       RETURNING *`,
      [libelleserie, autres || null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Série introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Série modifiée avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur PUT /serie:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Cette série existe déjà.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification de la série.'
    });
  }
});

module.exports = router;