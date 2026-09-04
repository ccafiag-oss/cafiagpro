const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // pg.Pool configuré

// ➡️ Création d'une agence
router.post('/ouvrireagence', async (req, res) => {
  const {
    radical,
    numeroagence,
    nomagence,
    codesociete,
    codepays,
    idsociete,
    idpays
  } = req.body;

  // Validation minimale
  if (!codesociete || !codepays || !idsociete || !idpays) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertQuery = `
      INSERT INTO agence (
        radical, numeroagence, nomagence,
        codesociete, codepays, idsociete, idpays
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *;
    `;
    const values = [
      radical || 'A',
      numeroagence || null,
      nomagence || null,
      codesociete,
      codepays,
      idsociete,
      idpays
    ];

    const result = await client.query(insertQuery, values);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Agence créée avec succès', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /agence error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  } finally {
    client.release();
  }
});

// ➡️ Modification d'une agence
router.put('/ouvrireagence/:id', async (req, res) => {
  const { id } = req.params;
  const {
    radical,
    numeroagence,
    nomagence,
    codesociete,
    codepays,
    idsociete,
    idpays
  } = req.body;

  if (!codesociete || !codepays || !idsociete || !idpays) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateQuery = `
      UPDATE agence
      SET radical = $1,
          numeroagence = $2,
          nomagence = $3,
          codesociete = $4,
          codepays = $5,
          idsociete = $6,
          idpays = $7
      WHERE idagence = $8
      RETURNING *;
    `;
    const values = [
      radical || 'A',
      numeroagence || null,
      nomagence || null,
      codesociete,
      codepays,
      idsociete,
      idpays,
      id
    ];

    const result = await client.query(updateQuery, values);

    await client.query('COMMIT');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agence introuvable' });
    }
    res.status(200).json({ message: 'Agence modifiée avec succès', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /ouvrireagence/:id error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
