const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Connexion PostgreSQL configurée

// 1. Récupérer tous les types de compte par agence
router.get('/typescompte', async (req, res) => {
  const { idagence } = req.query;

  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM types_compte WHERE idagence = $1 ORDER BY idtypescompte',
      [idagence]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /typescompte:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 2. Ajouter un nouveau type de compte
router.post('/typescompte', async (req, res) => {
  const { idagence, designation, compte, description, actif } = req.body;

  if (!idagence || !designation || !compte) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO types_compte 
        (idagence, designation, compte, description, actif) 
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE)) 
       RETURNING *`,
      [idagence, designation, compte, description, actif]
    );
    res.status(201).json({ message: 'Type de compte ajouté', data: rows[0] });
  } catch (err) {
    console.error('Erreur POST /typescompte:', err);
    if (err.code === '23505') { // violation de contrainte unique
      return res.status(409).json({ error: 'Ce compte existe déjà pour cette agence.' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 3. Modifier un type de compte existant
router.put('/typescompte/:id', async (req, res) => {
  const { id } = req.params;
  const { designation, compte, description, actif } = req.body;

  if (!designation && !compte && !description && actif === undefined) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour.' });
  }

  const fields = [];
  const values = [];
  let index = 1;

  if (designation !== undefined) {
    fields.push(`designation = $${index++}`);
    values.push(designation);
  }
  if (compte !== undefined) {
    fields.push(`compte = $${index++}`);
    values.push(compte);
  }
  if (description !== undefined) {
    fields.push(`description = $${index++}`);
    values.push(description);
  }
  if (actif !== undefined) {
    fields.push(`actif = $${index++}`);
    values.push(actif);
  }

  values.push(id);

  const query = `UPDATE types_compte SET ${fields.join(', ')} WHERE idtypescompte = $${index} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, values);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Type de compte non trouvé.' });
    }
    res.json({ message: 'Type de compte modifié', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /typescompte/:id:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ce compte existe déjà pour cette agence.' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// ==========================================
// 4️⃣ DUPLIQUER DES TYPES DE COMPTE VERS UNE AUTRE AGENCE
// POST: http://localhost:5265/api/typescompte/dupliquer
// ==========================================
router.post('/typescompte/dupliquer', async (req, res) => {
  const { idagence_source, idagence_destination, ids_typescompte } = req.body;

  // Validation des paramètres obligatoires
  if (!idagence_source || !idagence_destination || !ids_typescompte || !Array.isArray(ids_typescompte) || ids_typescompte.length === 0) {
    return res.status(400).json({ error: 'Paramètres manquants ou invalides (idagence_source, idagence_destination, ids_typescompte)' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Récupérer les types de compte source à dupliquer
    const selectQuery = `
      SELECT designation, compte, description, actif 
      FROM types_compte 
      WHERE idagence = $1 AND idtypescompte = ANY($2::int[])
    `;
    const { rows: typesToDuplicate } = await client.query(selectQuery, [idagence_source, ids_typescompte]);

    if (typesToDuplicate.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aucun type de compte trouvé pour les identifiants fournis dans cette agence.' });
    }

    // 2. Insérer les types de compte dans l'agence de destination avec vérification d'unicité sur le compte
    let duplicatedCount = 0;
    for (const tc of typesToDuplicate) {

      // Vérifier si un type de compte avec le même numéro de compte existe déjà dans l'agence de destination
      const checkExistQuery = `
        SELECT idtypescompte FROM types_compte 
        WHERE idagence = $1 AND LOWER(TRIM(compte)) = LOWER(TRIM($2))
      `;
      const existingRows = await client.query(checkExistQuery, [idagence_destination, tc.compte]);

      if (existingRows.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          error: `Le compte "${tc.compte}" existe déjà dans l'agence de destination.` 
        });
      }

      // Insertion si aucune duplication trouvée
      const insertQuery = `
        INSERT INTO types_compte (
          idagence, designation, compte, description, actif
        ) VALUES ($1, $2, $3, $4, $5)
      `;

      const values = [
        idagence_destination,
        tc.designation,
        tc.compte,
        tc.description,
        tc.actif
      ];

      await client.query(insertQuery, values);
      duplicatedCount++;
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `${duplicatedCount} type(s) de compte dupliqué(s) avec succès vers l'agence de destination ✨`
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur POST /typescompte/dupliquer:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la duplication des types de compte.' });
  } finally {
    client.release();
  }
});

module.exports = router;
