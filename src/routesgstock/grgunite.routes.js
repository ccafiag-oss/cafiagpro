const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assure-toi que ta connection DB est bien configurée

// 1. Récupérer toutes les unités
router.get('/gunite', async (req, res) => {
  const { idagence } = req.query;

  // Vérification si 'idagence' est fourni
  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM gunite WHERE idagence = $1 ORDER BY idunite',
      [idagence]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /gunite:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 2. Ajouter une nouvelle unité
router.post('/gunite', async (req, res) => {
  const {
    idagence,
    idtype,
    designation,
    codeunite,
    typeunite,
    facteurbase,
    ordre_affichage
  } = req.body;

  // Vérification des champs obligatoires
  if (!idagence || !idtype || !designation) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO gunite 
        (idagence, idtype, designation, codeunite, typeunite, facteurbase, ordre_affichage) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [idagence, idtype, designation, codeunite, typeunite, facteurbase, ordre_affichage]
    );
    res.status(201).json({ message: 'Unité ajoutée', data: rows[0] });
  } catch (err) {
    console.error('Erreur POST /gunite:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 3. Modifier une unité existante
router.put('/gunite/:id', async (req, res) => {
  const { id } = req.params;
  const {
    idagence,
    idtype,
    designation,
    codeunite,
    typeunite,
    facteurbase,
    ordre_affichage
  } = req.body;

  // Vérifier si au moins un champ est fourni
  if (
    !idagence && !idtype && !designation &&
    !codeunite && !typeunite && !facteurbase && !ordre_affichage
  ) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  const fields = [];
  const values = [];
  let index = 1;

  if (idagence !== undefined) {
    fields.push(`idagence = $${index++}`);
    values.push(idagence);
  }
  if (idtype !== undefined) {
    fields.push(`idtype = $${index++}`);
    values.push(idtype);
  }
  if (designation !== undefined) {
    fields.push(`designation = $${index++}`);
    values.push(designation);
  }
  if (codeunite !== undefined) {
    fields.push(`codeunite = $${index++}`);
    values.push(codeunite);
  }
  if (typeunite !== undefined) {
    fields.push(`typeunite = $${index++}`);
    values.push(typeunite);
  }
  if (facteurbase !== undefined) {
    fields.push(`facteurbase = $${index++}`);
    values.push(facteurbase);
  }
  if (ordre_affichage !== undefined) {
    fields.push(`ordre_affichage = $${index++}`);
    values.push(ordre_affichage);
  }

  values.push(id); // pour la clause WHERE

  const query = `UPDATE gunite SET ${fields.join(', ')} WHERE idunite = $${index} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, [...values]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Unité non trouvée' });
    }
    res.json({ message: 'Unité modifiée', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /gunite/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});





module.exports = router;