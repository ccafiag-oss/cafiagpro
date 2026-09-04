const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assurez-vous que votre pool est bien configuré

// 📌 Récupérer toutes les vidéos
router.get('/gsupportvideo', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM gsupportvideo ORDER BY date_ajout DESC'
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /gsupportvideo error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// 📌 Ajouter une nouvelle vidéo
router.post('/gsupportvideo', async (req, res) => {
  const { titre, description, url } = req.body;
  if (!titre || !url) {
    return res.status(400).json({ error: 'Titre et URL sont obligatoires' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO gsupportvideo (titre, description, url) VALUES ($1, $2, $3) RETURNING *',
      [titre, description, url]
    );
    res.status(201).json({ message: 'Vidéo ajoutée', data: rows[0] });
  } catch (err) {
    console.error('POST /gsupportvideo error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// 📌 Modifier une vidéo
router.put('/gsupportvideo/:id', async (req, res) => {
  const { id } = req.params;
  const { titre, description, url } = req.body;

  if (!titre && !description && !url) {
    return res.status(400).json({ error: 'Au moins un champ doit être fourni pour la mise à jour' });
  }

  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (titre) {
    fields.push(`titre = $${paramIndex++}`);
    values.push(titre);
  }
  if (description) {
    fields.push(`description = $${paramIndex++}`);
    values.push(description);
  }
  if (url) {
    fields.push(`url = $${paramIndex++}`);
    values.push(url);
  }
  values.push(id);

  const updateQuery = `UPDATE gsupportvideo SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(updateQuery, values);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Vidéo non trouvée' });
    }
    res.json({ message: 'Vidéo modifiée', data: rows[0] });
  } catch (err) {
    console.error('PUT /gsupportvideo/:id error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// 📌 Supprimer une vidéo
router.delete('/gsupportvideo/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM gsupportvideo WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Vidéo non trouvée' });
    }
    res.json({ message: 'Vidéo supprimée' });
  } catch (err) {
    console.error('DELETE /gsupportvideo/:id error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
