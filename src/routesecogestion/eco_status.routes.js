const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ===================================================
// 🔵 1. LISTE DES STATUTS
// ===================================================
// GET: http://localhost:5265/api/status?idagence=1&search=interne
// ==========================================
router.get('/status', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le paramètre "idagence" est obligatoire.' 
    });
  }

  try {
    let queryText = `
      SELECT idstatus, idagence, libellestatus
      FROM eco_status
      WHERE idagence = $1
    `;
    const params = [idagence];

    if (search && search.trim() !== '') {
      queryText += ` AND libellestatus ILIKE $2`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY idstatus DESC;`;
    
    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /status:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du chargement des statuts.' 
    });
  }
});

// ===================================================
// 🟢 2. AJOUTER UN STATUT
// ===================================================
router.post('/status', async (req, res) => {
  try {
    const { idagence, libellestatus } = req.body;

    if (!idagence || !libellestatus) {
      return res.status(400).json({
        success: false,
        error: 'Les champs "idagence" et "libellestatus" sont obligatoires.'
      });
    }

    const result = await pool.query(
      `INSERT INTO eco_status (idagence, libellestatus)
       VALUES ($1, $2)
       RETURNING *`,
      [idagence, libellestatus]
    );

    res.status(201).json({
      success: true,
      message: 'Statut ajouté avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur POST /status:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ce statut existe déjà.'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'ajout du statut.' 
    });
  }
});

// ===================================================
// 🟡 3. MODIFIER UN STATUT
// ===================================================
router.put('/status/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { libellestatus } = req.body;

    if (!libellestatus) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "libellestatus" est obligatoire.'
      });
    }

    const result = await pool.query(
      `UPDATE eco_status
       SET libellestatus = $1
       WHERE idstatus = $2
       RETURNING *`,
      [libellestatus, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Statut introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Statut modifié avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur PUT /status:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ce statut existe déjà.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification du statut.'
    });
  }
});

module.exports = router;