const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ===================================================
// 🔵 1. LISTE DES TYPES DE NOTE
// ===================================================
// GET: http://localhost:5265/api/typenote?idagence=1&search=compositions
// ==========================================
router.get('/typenote', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le paramètre "idagence" est obligatoire.' 
    });
  }

  try {
    let queryText = `
      SELECT idtypenote, idagence, libelletypenote
      FROM eco_typenote
      WHERE idagence = $1
    `;
    const params = [idagence];

    if (search && search.trim() !== '') {
      queryText += ` AND libelletypenote ILIKE $2`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY idtypenote DESC;`;
    
    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /typenote:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du chargement des types de note.' 
    });
  }
});

// ===================================================
// 🟢 2. AJOUTER UN TYPE DE NOTE
// ===================================================
router.post('/typenote', async (req, res) => {
  try {
    const { idagence, libelletypenote } = req.body;

    if (!idagence || !libelletypenote) {
      return res.status(400).json({
        success: false,
        error: 'Les champs "idagence" et "libelletypenote" sont obligatoires.'
      });
    }

    const result = await pool.query(
      `INSERT INTO eco_typenote (idagence, libelletypenote)
       VALUES ($1, $2)
       RETURNING *`,
      [idagence, libelletypenote]
    );

    res.status(201).json({
      success: true,
      message: 'Type de note ajouté avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur POST /typenote:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ce type de note existe déjà.'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'ajout du type de note.' 
    });
  }
});

// ===================================================
// 🟡 3. MODIFIER UN TYPE DE NOTE
// ===================================================
router.put('/typenote/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { libelletypenote } = req.body;

    if (!libelletypenote) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "libelletypenote" est obligatoire.'
      });
    }

    const result = await pool.query(
      `UPDATE eco_typenote
       SET libelletypenote = $1
       WHERE idtypenote = $2
       RETURNING *`,
      [libelletypenote, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Type de note introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Type de note modifié avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur PUT /typenote:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ce type de note existe déjà.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification du type de note.'
    });
  }
});

module.exports = router;