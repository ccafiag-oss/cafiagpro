const express = require('express');
const router = express.Router();
const pool = require('../config/db');


router.get('/piece-identite', async (req, res) => {
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
      FROM gpiece_identite
      WHERE idagence = $1
    `;

    const params = [idagence];

    if (search && search.trim() !== '') {
      sql += ` AND designation ILIKE $2 `;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY idpiece_identite DESC`;

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


router.post('/piece-identite', async (req, res) => {
  const { idagence, designation, description } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO gpiece_identite (idagence, designation, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [idagence, designation, description]
    );

    res.status(201).json({
      success: true,
      message: 'Pièce ajoutée',
      data: result.rows[0]
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});



router.put('/piece-identite/:id', async (req, res) => {
  const { id } = req.params;
  const { designation, description } = req.body;

  try {
    const result = await pool.query(
      `UPDATE gpiece_identite
       SET designation = $1,
           description = $2
       WHERE idpiece_identite = $3
       RETURNING *`,
      [designation, description, id]
    );

    res.json({
      success: true,
      message: 'Pièce modifiée',
      data: result.rows[0]
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});




router.get('/quartier', async (req, res) => {
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
      FROM gquartier
      WHERE idagence = $1
    `;

    const params = [idagence];

    if (search && search.trim() !== '') {
      sql += ` AND designation ILIKE $2 `;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY idquartier DESC`;

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});



router.post('/quartier', async (req, res) => {
  const { idagence, designation, description } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO gquartier (idagence, designation, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [idagence, designation, description]
    );

    res.status(201).json({
      success: true,
      message: 'Quartier ajouté',
      data: result.rows[0]
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});



router.put('/quartier/:id', async (req, res) => {
  const { id } = req.params;
  const { designation, description } = req.body;

  try {
    const result = await pool.query(
      `UPDATE gquartier
       SET designation = $1,
           description = $2
       WHERE idquartier = $3
       RETURNING *`,
      [designation, description, id]
    );

    res.json({
      success: true,
      message: 'Quartier modifié',
      data: result.rows[0]
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});



module.exports = router;