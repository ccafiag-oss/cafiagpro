const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assurez-vous que votre pool est bien configuré

// Récupérer tous les sous-catégories détails
router.get('/gsouscategoriedetail', async (req, res) => {
  try {
     const { idagence } = req.query; // correction ici
    if (!idagence) {
      return res.status(400).json({ message: 'Agence non spécifiée' });
    }
    const { rows } = await pool.query('SELECT * FROM gsouscategoriedetail where idagence=$1 ORDER BY idsouscategoriedetail',
       [idagence]
    )
    ;
    
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /gsouscategoriedetail error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});





// Ajouter un nouveau détail de sous-catégorie
router.post('/gsouscategoriedetail', async (req, res) => {
  const { idagence, idsouscategorie, designation } = req.body;
  if (!idagence || !idsouscategorie || !designation) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO gsouscategoriedetail (idagence, idsouscategorie, designation) VALUES ($1, $2, $3) RETURNING *',
      [idagence, idsouscategorie, designation]
    );
    res.status(201).json({ message: 'Détail ajouté', data: rows[0] });
  } catch (err) {
    console.error('POST /gsouscategoriedetail error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Modifier un détail
router.put('/gsouscategoriedetail/:id', async (req, res) => {
  const { id } = req.params;
  const { idagence, idsouscategorie, designation } = req.body;

  if (!idagence && !idsouscategorie && !designation) {
    return res.status(400).json({ error: 'Au moins un champ doit être fourni pour la mise à jour' });
  }

  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (idagence) {
    fields.push(`idagence = $${paramIndex++}`);
    values.push(idagence);
  }
  if (idsouscategorie) {
    fields.push(`idsouscategorie = $${paramIndex++}`);
    values.push(idsouscategorie);
  }
  if (designation) {
    fields.push(`designation = $${paramIndex++}`);
    values.push(designation);
  }
  values.push(id); // pour la clause WHERE

  const updateQuery = `UPDATE gsouscategoriedetail SET ${fields.join(', ')} WHERE idsouscategoriedetail = $${paramIndex} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(updateQuery, [...values]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Détail non trouvé' });
    }
    res.json({ message: 'Détail modifié', data: rows[0] });
  } catch (err) {
    console.error('PUT /gsouscategoriedetail/:id error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Supprimer un détail
router.delete('/gsouscategoriedetail/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM gsouscategoriedetail WHERE idsouscategoriedetail = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Détail non trouvé' });
    }
    res.json({ message: 'Détail supprimé' });
  } catch (err) {
    console.error('DELETE /gsouscategoriedetail/:id error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;