const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ===================================================
// 🔵 1. LISTE DES ANNÉES SCOLAIRES
// ===================================================
// GET: http://localhost:5265/api/annee-scolaire?idagence=1&search=2026
// ==========================================
router.get('/annee-scolaire', async (req, res) => {
  const { idagence, search } = req.query;

  // Contrainte stricte : l'idagence est obligatoire
  if (!idagence) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le paramètre "idagence" est obligatoire pour charger les années scolaires.' 
    });
  }

  try {
    let queryText = `
      SELECT idanneescolaire, idagence, libelleannee, etat
      FROM eco_anneescolaire
      WHERE idagence = $1
    `;
    const params = [idagence];

    // Intégration optionnelle d'un filtre de recherche
    if (search && search.trim() !== '') {
      queryText += ` AND libelleannee ILIKE $2`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY idanneescolaire DESC;`;
    
    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /annee-scolaire:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du chargement des années scolaires.' 
    });
  }
});

// ===================================================
// 🟢 2. AJOUTER UNE ANNÉE SCOLAIRE
// ===================================================
router.post('/annee-scolaire', async (req, res) => {
  try {
    const { idagence, libelleannee, etat } = req.body;

    // Validation minimale
    if (!idagence || !libelleannee) {
      return res.status(400).json({
        success: false,
        error: 'Les champs "idagence" et "libelleannee" sont obligatoires.'
      });
    }

    // "etat" prend par défaut true si non fourni
    const etatValue = etat !== undefined ? etat : true;

    const result = await pool.query(
      `INSERT INTO eco_anneescolaire (idagence, libelleannee, etat)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [idagence, libelleannee, etatValue]
    );

    res.status(201).json({
      success: true,
      message: 'Année scolaire ajoutée avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur POST /annee-scolaire:', err);

    // Gestion de la contrainte d'unicité (par exemple si vous ajoutez un index unique plus tard)
    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Cette année scolaire existe déjà.'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'ajout de l\'année scolaire.' 
    });
  }
});

// ===================================================
// 🟡 3. MODIFIER UNE ANNÉE SCOLAIRE
// ===================================================
router.put('/annee-scolaire/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { libelleannee, etat } = req.body;

    if (!libelleannee) {
      return res.status(400).json({
        success: false,
        error: 'Le champ "libelleannee" est obligatoire.'
      });
    }

    const result = await pool.query(
      `UPDATE eco_anneescolaire
       SET libelleannee = $1,
           etat = $2
       WHERE idanneescolaire = $3
       RETURNING *`,
      [libelleannee, etat, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Année scolaire introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Année scolaire modifiée avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur PUT /annee-scolaire:', err);

    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Cette année scolaire existe déjà.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification de l\'année scolaire.'
    });
  }
});

module.exports = router;