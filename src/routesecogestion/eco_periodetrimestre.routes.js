const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================================================
// 🔵 1. RÉCUPÉRER LES ANNÉES SCOLAIRES ACTIVES UNIQUEMENT
// GET: http://localhost:5265/api/periodetrimestre/annees-actives?idagence=1
// =========================================================================
router.get('/periodetrimestre/annees-actives', async (req, res) => {
  const { idagence } = req.query;
  if (!idagence) {
    return res.status(400).json({ success: false, error: 'Le paramètre "idagence" est obligatoire.' });
  }
  try {
    const result = await pool.query(
      `SELECT idanneescolaire, idagence, libelleannee, etat 
       FROM eco_anneescolaire 
       WHERE idagence = $1 AND etat = true 
       ORDER BY idanneescolaire DESC`,
      [idagence]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement.' });
  }
});

// =========================================================================
// 🔵 2. RÉCUPÉRER LES TRIMESTRES ACTIFS (Pour alimenter le menu déroulant/modal)
// GET: http://localhost:5265/api/periodetrimestre/trimestres-actifs?idagence=1
// =========================================================================
router.get('/periodetrimestre/trimestres-actifs', async (req, res) => {
  const { idagence } = req.query;
  if (!idagence) {
    return res.status(400).json({ success: false, error: 'Le paramètre "idagence" est obligatoire.' });
  }
  try {
    const result = await pool.query(
      `SELECT idtrimestre, libelletrimestre FROM eco_trimestre WHERE idagence = $1 AND etat = true`,
      [idagence]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement.' });
  }
});

// =========================================================================
// 🔵 3. LISTE DES PÉRIODES PAR ANNÉE SCOLAIRE
// GET: http://localhost:5265/api/periodetrimestre?idagence=1&idanneescolaire=2
// =========================================================================
router.get('/periodetrimestre', async (req, res) => {
  const { idagence, idanneescolaire } = req.query;

  if (!idagence || !idanneescolaire) {
    return res.status(400).json({ success: false, error: 'Paramètres manquants.' });
  }

  try {
    const result = await pool.query(
      `SELECT pt.*, t.libelletrimestre, a.libelleannee
       FROM eco_periodetrimestre pt
       INNER JOIN eco_trimestre t ON pt.idtrimestre = t.idtrimestre
       INNER JOIN eco_anneescolaire a ON pt.idanneescolaire = a.idanneescolaire
       WHERE pt.idagence = $1 AND pt.idanneescolaire = $2
       ORDER BY pt.idperiodetrimestre ASC`,
      [idagence, idanneescolaire]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur de chargement.' });
  }
});

// =========================================================================
// 🟢 4. ENREGISTRER UNE PÉRIODE TRIMESTRE
// =========================================================================
router.post('/periodetrimestre', async (req, res) => {
  try {
    const { idagence, idtrimestre, idanneescolaire, etat, datedebut, datefin, etatanneeencours } = req.body;

    const result = await pool.query(
      `INSERT INTO eco_periodetrimestre 
       (idagence, idtrimestre, idanneescolaire, etat, datedebut, datefin, etatanneeencours)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [idagence, idtrimestre, idanneescolaire, etat ?? true, datedebut, datefin, etatanneeencours ?? true]
    );

    res.status(201).json({
      success: true,
      message: 'Période trimestre enregistrée avec succès',
      data: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'enregistrement.' });
  }
});

// =========================================================================
// 🟡 5. MODIFIER UNE PÉRIODE TRIMESTRE
// =========================================================================
router.put('/periodetrimestre/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { idtrimestre, etat, datedebut, datefin, etatanneeencours } = req.body;

    const result = await pool.query(
      `UPDATE eco_periodetrimestre
       SET idtrimestre = $1,
           etat = $2,
           datedebut = $3,
           datefin = $4,
           etatanneeencours = $5
       WHERE idperiodetrimestre = $6
       RETURNING *`,
      [idtrimestre, etat, datedebut, datefin, etatanneeencours, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Période introuvable' });
    }

    res.json({
      success: true,
      message: 'Période mise à jour avec succès',
      data: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour.' });
  }
});

module.exports = router;