const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assure-toi que ta connection DB est bien configurée

// 1. Récupérer tous les types de mesure
router.get('/gtype_mesure', async (req, res) => {
  const { idagence } = req.query;

  // Vérification si 'idagence' est fourni
  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM gtype_mesure WHERE idagence = $1 ORDER BY idtype',
      [idagence]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /gtype_mesure:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 2. Ajouter un nouveau type de mesure
router.post('/gtype_mesure', async (req, res) => {
  const { idagence, libelle, unite_base } = req.body;
  if (!idagence || !libelle || !unite_base) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO gtype_mesure (idagence, libelle, unite_base) VALUES ($1, $2, $3) RETURNING *',
      [idagence, libelle, unite_base]
    );
    res.status(201).json({ message: 'Type de mesure ajouté', data: rows[0] });
  } catch (err) {
    console.error('Erreur POST /gtype_mesure:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 3. Modifier un type de mesure existant
router.put('/gtype_mesure/:id', async (req, res) => {
  const { id } = req.params;
  const { libelle, unite_base } = req.body;

  // Vérifier si au moins un champ est fourni
  if (!libelle && !unite_base) {
    return res.status(400).json({ error: 'Au moins un champ doit être fourni pour la mise à jour' });
  }

  const fields = [];
  const values = [];
  let index = 1;

  if (libelle) {
    fields.push(`libelle = $${index++}`);
    values.push(libelle);
  }
  if (unite_base) {
    fields.push(`unite_base = $${index++}`);
    values.push(unite_base);
  }
  values.push(id); // pour la clause WHERE

  const query = `UPDATE gtype_mesure SET ${fields.join(', ')} WHERE idtype = $${index} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, [...values]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Type de mesure non trouvé' });
    }
    res.json({ message: 'Type de mesure modifié', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /gtype_mesure/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;