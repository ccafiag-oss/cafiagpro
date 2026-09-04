const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ===================================================
// 🔵 1. LISTE DES VILLES
// ===================================================
// GET: http://localhost:5265/api/ville?idagence=1&search=paris
// ==========================================
router.get('/ville', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le paramètre "idagence" est obligatoire.' 
    });
  }

  try {
    let queryText = `
      SELECT idville, idagence, libelleville
      FROM eco_ville
      WHERE idagence = $1
    `;
    const params = [idagence];

    if (search && search.trim() !== '') {
      queryText += ` AND libelleville ILIKE $2`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY idville DESC;`;
    
    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /ville:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du chargement des villes.' 
    });
  }
});

// ===================================================
// 🟢 2. AJOUTER UNE VILLE
// ===================================================
router.post('/ville', async (req, res) => {
  try {
    const { idagence, libelleville } = req.body;

    if (!idagence || !libelleville) {
      return res.status(400).json({
        success: false,
        error: 'Les champs "idagence" et "libelleville" sont obligatoires.'
      });
    }

    const result = await pool.query(
      `INSERT INTO eco_ville (idagence, libelleville)
       VALUES ($1, $2)
       RETURNING *`,
      [idagence, libelleville]
    );

    res.status(201).json({
      success: true,
      message: 'Ville ajoutée avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur POST /ville:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Cette ville existe déjà.'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'ajout de la ville.' 
    });
  }
});

// ===================================================
// 🟡 3. MODIFIER UNE VILLE
// ===================================================
router.put('/ville/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { libelleville } = req.body;

    if (!libelleville) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "libelleville" est obligatoire.'
      });
    }

    const result = await pool.query(
      `UPDATE eco_ville
       SET libelleville = $1
       WHERE idville = $2
       RETURNING *`,
      [libelleville, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ville introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Ville modifiée avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur PUT /ville:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Cette ville existe déjà.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification de la ville.'
    });
  }
});

module.exports = router;