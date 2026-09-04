const express = require('express');
const router = express.Router();
const pool = require('../config/db');


// ========================================
// LISTE + SEARCH (OBLIGATOIRE idagence)
// GET /api/afficherfina_credit_objet?idagence=1&search=
// ========================================
router.get('/afficherfina_credit_objet', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({
      success: false,
      message: 'idagence obligatoire'
    });
  }

  try {
    let sql = `
      SELECT *
      FROM fina_credit_objet
      WHERE idagence = $1
    `;

    const params = [idagence];

    if (search && search.trim() !== '') {
      sql += `
        AND (
          designation ILIKE $2
          OR codeobjet ILIKE $2
        )
      `;
      params.push(`%${search.trim()}%`);
    }

    sql += ` ORDER BY idobjet DESC`;

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      total: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// ========================================
// AJOUTER
// POST /api/ajouterobjetcredit
// ========================================
router.post('/ajouterobjetcredit', async (req, res) => {
  try {
    const { idagence, codeobjet, designation, description } = req.body;

    if (!idagence || !codeobjet || !designation) {
      return res.status(400).json({
        success: false,
        message: "idagence, codeobjet et designation obligatoires"
      });
    }

    const result = await pool.query(`
      INSERT INTO fina_credit_objet
      (idagence, codeobjet, designation, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      idagence,
      codeobjet,
      designation,
      description || null
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// ========================================
// MODIFIER
// PUT /api/modifierobjetcredit/:id
// ========================================
router.put('/modifierobjetcredit/:id', async (req, res) => {
  try {
    const { codeobjet, designation, description, actif } = req.body;

    const result = await pool.query(`
      UPDATE fina_credit_objet
      SET
        codeobjet = $1,
        designation = $2,
        description = $3,
        actif = $4
      WHERE idobjet = $5
      RETURNING *
    `, [
      codeobjet,
      designation,
      description,
      actif,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Objet introuvable"
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// ========================================
// SUPPRIMER
// DELETE /api/suprimerobjetcredit/:id
// ========================================
router.delete('/suprimerobjetcredit/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      DELETE FROM fina_credit_objet
      WHERE idobjet = $1
      RETURNING idobjet
    `, [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Objet introuvable"
      });
    }

    res.json({
      success: true,
      message: "Suppression réussie"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;