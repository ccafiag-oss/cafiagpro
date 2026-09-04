const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ===================================================
// 🔵 1. LISTE DES QUARTIERS
// ===================================================
// GET: http://localhost:5265/api/quartier?idagence=1&search=centre
// ==========================================
router.get('/quartier', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le paramètre "idagence" est obligatoire.' 
    });
  }

  try {
    let queryText = `
      SELECT idquartier, idagence, libellequartier
      FROM eco_quartier
      WHERE idagence = $1
    `;
    const params = [idagence];

    if (search && search.trim() !== '') {
      queryText += ` AND libellequartier ILIKE $2`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY idquartier DESC;`;
    
    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /quartier:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du chargement des quartiers.' 
    });
  }
});

// ===================================================
// 🟢 2. AJOUTER UN QUARTIER
// ===================================================
router.post('/quartier', async (req, res) => {
  try {
    const { idagence, libellequartier } = req.body;

    if (!idagence || !libellequartier) {
      return res.status(400).json({
        success: false,
        error: 'Les champs "idagence" et "libellequartier" sont obligatoires.'
      });
    }

    const result = await pool.query(
      `INSERT INTO eco_quartier (idagence, libellequartier)
       VALUES ($1, $2)
       RETURNING *`,
      [idagence, libellequartier]
    );

    res.status(201).json({
      success: true,
      message: 'Quartier ajouté avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur POST /quartier:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ce quartier existe déjà.'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'ajout du quartier.' 
    });
  }
});

// ===================================================
// 🟡 3. MODIFIER UN QUARTIER
// ===================================================
router.put('/quartier/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { libellequartier } = req.body;

    if (!libellequartier) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "libellequartier" est obligatoire.'
      });
    }

    const result = await pool.query(
      `UPDATE eco_quartier
       SET libellequartier = $1
       WHERE idquartier = $2
       RETURNING *`,
      [libellequartier, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quartier introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Quartier modifié avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur PUT /quartier:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ce quartier existe déjà.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification du quartier.'
    });
  }
});

module.exports = router;