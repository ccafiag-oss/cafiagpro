const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ===================================================
// 🔵 1. LISTE DES JOURS DE LA SEMAINE
// ===================================================
// GET: http://localhost:5265/api/joursemaine?search=lundi
// ==========================================
router.get('/joursemaine', async (req, res) => {
  const { search } = req.query;

  try {
    let queryText = `
      SELECT idjour, libellejour
      FROM eco_joursemaine
    `;
    const params = [];

    if (search && search.trim() !== '') {
      queryText += ` WHERE libellejour ILIKE $1`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY idjour ASC;`;
    
    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /joursemaine:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du chargement des jours de la semaine.' 
    });
  }
});

// ===================================================
// 🟢 2. AJOUTER UN JOUR
// ===================================================
router.post('/joursemaine', async (req, res) => {
  try {
    const { idjour, libellejour } = req.body;

    if (idjour === undefined || !libellejour) {
      return res.status(400).json({
        success: false,
        error: 'Les champs "idjour" et "libellejour" sont obligatoires.'
      });
    }

    const result = await pool.query(
      `INSERT INTO eco_joursemaine (idjour, libellejour)
       VALUES ($1, $2)
       RETURNING *`,
      [parseInt(idjour), libellejour]
    );

    res.status(201).json({
      success: true,
      message: 'Jour de la semaine ajouté avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur POST /joursemaine:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ce code jour (idjour) existe déjà.'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'ajout du jour.' 
    });
  }
});

// ===================================================
// 🟡 3. MODIFIER UN JOUR
// ===================================================
router.put('/joursemaine/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { libellejour } = req.body;

    if (!libellejour) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "libellejour" est obligatoire.'
      });
    }

    const result = await pool.query(
      `UPDATE eco_joursemaine
       SET libellejour = $1
       WHERE idjour = $2
       RETURNING *`,
      [libellejour, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Jour de la semaine introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Jour de la semaine modifié avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur PUT /joursemaine:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification.'
    });
  }
});

module.exports = router;