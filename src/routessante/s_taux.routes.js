const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ==========================================
// 1. AFFICHER TOUS LES TAUX
// GET /api/s_taux
// ==========================================
router.get('/s_taux', async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        id,
        taux,
        description
      FROM s_taux
      ORDER BY id DESC
    `);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});


// ==========================================
// 2. AJOUTER TAUX
// POST /api/s_taux
// ==========================================
router.post('/s_taux', async (req, res) => {

  try {

    const {
      taux,
      description
    } = req.body;

    const result = await pool.query(
      `
      INSERT INTO s_taux (
        taux,
        description
      )
      VALUES ($1,$2)
      RETURNING *
      `,
      [
        taux || 0,
        description || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Taux ajouté',
      data: result.rows[0]
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});


// ==========================================
// 3. MODIFIER TAUX
// PUT /api/s_taux/:id
// ==========================================
router.put('/s_taux/:id', async (req, res) => {

  try {

    const { id } = req.params;

    const {
      taux,
      description
    } = req.body;

    const result = await pool.query(
      `
      UPDATE s_taux
      SET
        taux = $1,
        description = $2
      WHERE id = $3
      RETURNING *
      `,
      [
        taux,
        description,
        id
      ]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        success: false,
        message: 'Taux introuvable'
      });

    }

    res.status(200).json({
      success: true,
      message: 'Taux modifié',
      data: result.rows[0]
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

module.exports = router;