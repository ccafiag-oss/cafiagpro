const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ===================================================
// 🔵 1. LISTE DES TRIMESTRES
// ===================================================
// GET: http://localhost:5265/api/trimestre?idagence=1&search=premier
// ==========================================
router.get('/trimestre', async (req, res) => {
  const { idagence, search } = req.query;

  // Contrainte stricte : l'idagence est obligatoire
  if (!idagence) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le paramètre "idagence" est obligatoire pour charger les trimestres.' 
    });
  }

  try {
    let queryText = `
      SELECT idtrimestre, idagence, libelletrimestre, etat
      FROM eco_trimestre
      WHERE idagence = $1
    `;
    const params = [idagence];

    // Intégration optionnelle d'un filtre de recherche
    if (search && search.trim() !== '') {
      queryText += ` AND libelletrimestre ILIKE $2`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY idtrimestre DESC;`;
    
    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /trimestre:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du chargement des trimestres.' 
    });
  }
});

// ===================================================
// 🟢 2. AJOUTER UN TRIMESTRE
// ===================================================
router.post('/trimestre', async (req, res) => {
  try {
    const { idagence, libelletrimestre, etat } = req.body;

    // Validation minimale
    if (!idagence || !libelletrimestre) {
      return res.status(400).json({
        success: false,
        error: 'Les champs "idagence" et "libelletrimestre" sont obligatoires.'
      });
    }

    // "etat" prend par défaut true si non fourni
    const etatValue = etat !== undefined ? etat : true;

    const result = await pool.query(
      `INSERT INTO eco_trimestre (idagence, libelletrimestre, etat)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [idagence, libelletrimestre, etatValue]
    );

    res.status(201).json({
      success: true,
      message: 'Trimestre ajouté avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur POST /trimestre:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ce trimestre existe déjà.'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'ajout du trimestre.' 
    });
  }
});

// ===================================================
// 🟡 3. MODIFIER UN TRIMESTRE
// ===================================================
router.put('/trimestre/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { libelletrimestre, etat } = req.body;

    if (!libelletrimestre) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "libelletrimestre" est obligatoire.'
      });
    }

    const result = await pool.query(
      `UPDATE eco_trimestre
       SET libelletrimestre = $1,
           etat = $2
       WHERE idtrimestre = $3
       RETURNING *`,
      [libelletrimestre, etat, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Trimestre introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Trimestre modifié avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur PUT /trimestre:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ce trimestre existe déjà.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification du trimestre.'
    });
  }
});

module.exports = router;