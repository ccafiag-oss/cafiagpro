const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ===================================================
// 🔵 1. LISTE DES MATIÈRES
// ===================================================
// GET: http://localhost:5265/api/matiere?idagence=1&search=mathematiques
// ==========================================
router.get('/matiere', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le paramètre "idagence" est obligatoire.' 
    });
  }

  try {
    let queryText = `
      SELECT idmatiere, idagence, libellematiere, numeroordre, etat
      FROM eco_matiere
      WHERE idagence = $1
    `;
    const params = [idagence];

    if (search && search.trim() !== '') {
      queryText += ` AND libellematiere ILIKE $2`;
      params.push(`%${search}%`);
    }

    // Tri par numéro d'ordre (s'il existe, sinon trié à la fin) puis par ID décroissant
    queryText += ` ORDER BY COALESCE(numeroordre, 9999) ASC, idmatiere DESC;`;
    
    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /matiere:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du chargement des matières.' 
    });
  }
});

// ===================================================
// 🟢 2. AJOUTER UNE MATIÈRE
// ===================================================
router.post('/matiere', async (req, res) => {
  try {
    const { idagence, libellematiere, numeroordre, etat } = req.body;

    if (!idagence || !libellematiere) {
      return res.status(400).json({
        success: false,
        error: 'Les champs "idagence" et "libellematiere" sont obligatoires.'
      });
    }

    const etatValue = etat !== undefined ? etat : true;
    const ordreValue = numeroordre !== undefined && numeroordre !== '' ? parseInt(numeroordre) : null;

    const result = await pool.query(
      `INSERT INTO eco_matiere (idagence, libellematiere, numeroordre, etat)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [idagence, libellematiere, ordreValue, etatValue]
    );

    res.status(201).json({
      success: true,
      message: 'Matière ajoutée avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur POST /matiere:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Cette matière existe déjà.'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'ajout de la matière.' 
    });
  }
});

// ===================================================
// 🟡 3. MODIFIER UNE MATIÈRE
// ===================================================
router.put('/matiere/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { libellematiere, numeroordre, etat } = req.body;

    if (!libellematiere) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "libellematiere" est obligatoire.'
      });
    }

    const ordreValue = numeroordre !== undefined && numeroordre !== '' ? parseInt(numeroordre) : null;

    const result = await pool.query(
      `UPDATE eco_matiere
       SET libellematiere = $1,
           numeroordre = $2,
           etat = $3
       WHERE idmatiere = $4
       RETURNING *`,
      [libellematiere, ordreValue, etat, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Matière introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Matière modifiée avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur PUT /matiere:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Cette matière existe déjà.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification de la matière.'
    });
  }
});

module.exports = router;