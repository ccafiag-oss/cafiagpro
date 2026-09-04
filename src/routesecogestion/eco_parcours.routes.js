const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ===================================================
// 🔵 1. LISTE DES PARCOURS
// ===================================================
// GET: http://localhost:5265/api/parcours?idagence=1&search=bilingue
// ==========================================
router.get('/parcours', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le paramètre "idagence" est obligatoire.' 
    });
  }

  try {
    let queryText = `
      SELECT idparcours, idagence, libelleparcours
      FROM eco_parcours
      WHERE idagence = $1
    `;
    const params = [idagence];

    if (search && search.trim() !== '') {
      queryText += ` AND libelleparcours ILIKE $2`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY idparcours DESC;`;
    
    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /parcours:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du chargement des parcours.' 
    });
  }
});

// ===================================================
// 🟢 2. AJOUTER UN PARCOURS
// ===================================================
router.post('/parcours', async (req, res) => {
  try {
    const { idagence, libelleparcours } = req.body;

    if (!idagence || !libelleparcours) {
      return res.status(400).json({
        success: false,
        error: 'Les champs "idagence" et "libelleparcours" sont obligatoires.'
      });
    }

    const result = await pool.query(
      `INSERT INTO eco_parcours (idagence, libelleparcours)
       VALUES ($1, $2)
       RETURNING *`,
      [idagence, libelleparcours]
    );

    res.status(201).json({
      success: true,
      message: 'Parcours ajouté avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur POST /parcours:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ce parcours existe déjà.'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'ajout du parcours.' 
    });
  }
});

// ===================================================
// 🟡 3. MODIFIER UN PARCOURS
// ===================================================
router.put('/parcours/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { libelleparcours } = req.body;

    if (!libelleparcours) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "libelleparcours" est obligatoire.'
      });
    }

    const result = await pool.query(
      `UPDATE eco_parcours
       SET libelleparcours = $1
       WHERE idparcours = $2
       RETURNING *`,
      [libelleparcours, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parcours introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Parcours modifié avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur PUT /parcours:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ce parcours existe déjà.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification du parcours.'
    });
  }
});

module.exports = router;