const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ===================================================
// 🔵 1. LISTE DES NATIONALITÉS
// ===================================================
// GET: http://localhost:5265/api/nationalite?idagence=1&search=guineenne
// ==========================================
router.get('/nationalite', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le paramètre "idagence" est obligatoire.' 
    });
  }

  try {
    let queryText = `
      SELECT idnationalite, idagence, libellenationalite
      FROM eco_nationalite
      WHERE idagence = $1
    `;
    const params = [idagence];

    if (search && search.trim() !== '') {
      queryText += ` AND libellenationalite ILIKE $2`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY idnationalite DESC;`;
    
    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /nationalite:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du chargement des nationalités.' 
    });
  }
});

// ===================================================
// 🟢 2. AJOUTER UNE NATIONALITÉ
// ===================================================
router.post('/nationalite', async (req, res) => {
  try {
    const { idagence, libellenationalite } = req.body;

    if (!idagence || !libellenationalite) {
      return res.status(400).json({
        success: false,
        error: 'Les champs "idagence" et "libellenationalite" sont obligatoires.'
      });
    }

    const result = await pool.query(
      `INSERT INTO eco_nationalite (idagence, libellenationalite)
       VALUES ($1, $2)
       RETURNING *`,
      [idagence, libellenationalite]
    );

    res.status(201).json({
      success: true,
      message: 'Nationalité ajoutée avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur POST /nationalite:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Cette nationalité existe déjà.'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'ajout de la nationalité.' 
    });
  }
});

// ===================================================
// 🟡 3. MODIFIER UNE NATIONALITÉ
// ===================================================
router.put('/nationalite/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { libellenationalite } = req.body;

    if (!libellenationalite) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "libellenationalite" est obligatoire.'
      });
    }

    const result = await pool.query(
      `UPDATE eco_nationalite
       SET libellenationalite = $1
       WHERE idnationalite = $2
       RETURNING *`,
      [libellenationalite, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nationalité introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Nationalité modifiée avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur PUT /nationalite:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Cette nationalité existe déjà.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification de la nationalité.'
    });
  }
});

module.exports = router;