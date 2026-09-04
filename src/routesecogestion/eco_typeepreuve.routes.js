const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ===================================================
// 🔵 1. LISTE DES TYPES D'ÉPREUVE
// ===================================================
// GET: http://localhost:5265/api/typeepreuve?idagence=1&search=ecrite
// ==========================================
router.get('/typeepreuve', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le paramètre "idagence" est obligatoire.' 
    });
  }

  try {
    let queryText = `
      SELECT idtypeepreuve, idagence, libelleepreuve
      FROM eco_typeepreuve
      WHERE idagence = $1
    `;
    const params = [idagence];

    if (search && search.trim() !== '') {
      queryText += ` AND libelleepreuve ILIKE $2`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY idtypeepreuve DESC;`;
    
    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /typeepreuve:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du chargement des types d\'épreuve.' 
    });
  }
});

// ===================================================
// 🟢 2. AJOUTER UN TYPE D'ÉPREUVE
// ===================================================
router.post('/typeepreuve', async (req, res) => {
  try {
    const { idagence, libelleepreuve } = req.body;

    if (!idagence || !libelleepreuve) {
      return res.status(400).json({
        success: false,
        error: 'Les champs "idagence" et "libelleepreuve" sont obligatoires.'
      });
    }

    const result = await pool.query(
      `INSERT INTO eco_typeepreuve (idagence, libelleepreuve)
       VALUES ($1, $2)
       RETURNING *`,
      [idagence, libelleepreuve]
    );

    res.status(201).json({
      success: true,
      message: 'Type d\'épreuve ajouté avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur POST /typeepreuve:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ce type d\'épreuve existe déjà.'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'ajout du type d\'épreuve.' 
    });
  }
});

// ===================================================
// 🟡 3. MODIFIER UN TYPE D'ÉPREUVE
// ===================================================
router.put('/typeepreuve/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { libelleepreuve } = req.body;

    if (!libelleepreuve) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "libelleepreuve" est obligatoire.'
      });
    }

    const result = await pool.query(
      `UPDATE eco_typeepreuve
       SET libelleepreuve = $1
       WHERE idtypeepreuve = $2
       RETURNING *`,
      [libelleepreuve, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Type d\'épreuve introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Type d\'épreuve modifié avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur PUT /typeepreuve:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ce type d\'épreuve existe déjà.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification du type d\'épreuve.'
    });
  }
});

module.exports = router;