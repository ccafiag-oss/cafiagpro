const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assurez-vous que votre pool est bien configuré

// Récupérer toutes les catégories

router.get('/gcategorie', async (req, res) => {
  try {
    const { idagence } = req.query;

    if (!idagence) {
      return res.status(400).json({ 
        message: 'Aucune agence connectée. Veuillez créer une agence.' 
      });
    }

    const { rows } = await pool.query(
      'SELECT * FROM gcategorie WHERE idagence = $1 ORDER BY idcategorie',
      [idagence]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error('GET /gcategorie error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


// Ajouter une nouvelle catégorie
router.post('/gcategorie', async (req, res) => {
  const { idagence, designation } = req.body;
  if (!idagence || !designation) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO gcategorie (idagence, designation) VALUES ($1, $2) RETURNING *',
      [idagence, designation]
    );
    res.status(201).json({ message: 'Catégorie ajoutée', data: rows[0] });
  } catch (err) {
    console.error('POST /gcategorie error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Modifier une catégorie
router.put('/gcategorie/:id', async (req, res) => {
  const { id } = req.params;
  const { idagence, designation } = req.body;

  if (!idagence && !designation) {
    return res.status(400).json({ error: 'Au moins un champ doit être fourni pour la mise à jour' });
  }

  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (idagence) {
    fields.push(`idagence = $${paramIndex++}`);
    values.push(idagence);
  }
  if (designation) {
    fields.push(`designation = $${paramIndex++}`);
    values.push(designation);
  }
  values.push(id); // pour la clause WHERE

  const updateQuery = `UPDATE gcategorie SET ${fields.join(', ')} WHERE idcategorie = $${paramIndex} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(updateQuery, [...values]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }
    res.json({ message: 'Catégorie modifiée', data: rows[0] });
  } catch (err) {
    console.error('PUT /gcategorie/:id error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Supprimer une catégorie
router.delete('/gcategorie/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM gcategorie WHERE idcategorie = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }
    res.json({ message: 'Catégorie supprimée' });
  } catch (err) {
    console.error('DELETE /gcategorie/:id error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Route pour récupérer idagence et nomagence de la table agence
router.get('/agences', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT idagence, nomagence FROM agence');
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /agences error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;