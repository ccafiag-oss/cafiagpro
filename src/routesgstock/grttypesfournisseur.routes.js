const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assure-toi que ta connection DB est bien configurée

// 1. Récupérer tous les types de fournisseur pour un 'idagence' spécifique
router.get('/ttypesfournisseur', async (req, res) => {
  const { idagence } = req.query;

  // Vérification si 'idagence' est fourni
  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM ttypesfournisseur WHERE idagence = $1',
      [idagence]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /ttypesfournisseur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 2. Ajouter un nouveau type de fournisseur
router.post('/ttypesfournisseur', async (req, res) => {
  const {
    idagence,
    codtypefr,
    designation,
    formule
  } = req.body;

  // Vérification des champs obligatoires
  if (!idagence) {
    return res.status(400).json({ error: 'Le champ "idagence" est obligatoire.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO ttypesfournisseur (
        idagence, codtypefr, designation, formule
      ) VALUES (
        $1, $2, $3, $4
      ) RETURNING *`,
      [
        idagence,
        codtypefr || null,
        designation || null,
        formule !== undefined ? formule : false
      ]
    );
    res.status(201).json({ message: 'Type de fournisseur ajouté', data: rows[0] });
  } catch (err) {
    console.error('Erreur POST /ttypesfournisseur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 3. Modifier un type de fournisseur existant
router.put('/ttypesfournisseur/:id', async (req, res) => {
  const { id } = req.params;
  const {
    codtypefr,
    designation,
    formule
  } = req.body;

  const fields = [];
  const values = [];
  let index = 1;

  if (codtypefr !== undefined) {
    fields.push(`codtypefr = $${index++}`);
    values.push(codtypefr);
  }
  if (designation !== undefined) {
    fields.push(`designation = $${index++}`);
    values.push(designation);
  }
  if (formule !== undefined) {
    fields.push(`formule = $${index++}`);
    values.push(formule);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  values.push(id); // ID pour la clause WHERE

  const query = `UPDATE ttypesfournisseur SET ${fields.join(', ')} WHERE idtypefr = $${index} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, [...values]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Type de fournisseur non trouvé' });
    }
    res.json({ message: 'Type de fournisseur modifié', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /ttypesfournisseur/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// ==========================================
// 4️⃣ DUPLIQUER DES TYPES DE FOURNISSEUR VERS UNE AUTRE AGENCE
// POST: http://localhost:5265/api/ttypesfournisseur/dupliquer
// ==========================================
router.post('/ttypesfournisseur/dupliquer', async (req, res) => {
  const { idagence_source, idagence_destination, ids_typesfournisseur } = req.body;

  // Validation des paramètres obligatoires
  if (!idagence_source || !idagence_destination || !ids_typesfournisseur || !Array.isArray(ids_typesfournisseur) || ids_typesfournisseur.length === 0) {
    return res.status(400).json({ error: 'Paramètres manquants ou invalides (idagence_source, idagence_destination, ids_typesfournisseur)' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Récupérer les types de fournisseur source à dupliquer
    const selectQuery = `
      SELECT codtypefr, designation, formule 
      FROM ttypesfournisseur 
      WHERE idagence = $1 AND idtypefr = ANY($2::bigint[])
    `;
    const { rows: typesToDuplicate } = await client.query(selectQuery, [idagence_source, ids_typesfournisseur]);

    if (typesToDuplicate.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aucun type de fournisseur trouvé pour les identifiants fournis dans cette agence.' });
    }

    // 2. Insérer les types de fournisseur dans l'agence de destination avec vérification d'unicité
    let duplicatedCount = 0;
    for (const tf of typesToDuplicate) {
      
      // Vérifier si un enregistrement avec la même désignation existe déjà dans l'agence de destination
      const checkExistQuery = `
        SELECT idtypefr FROM ttypesfournisseur 
        WHERE idagence = $1 AND LOWER(TRIM(designation)) = LOWER(TRIM($2))
      `;
      const existingRows = await client.query(checkExistQuery, [idagence_destination, tf.designation]);

      if (existingRows.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          error: `Le type de fournisseur "${tf.designation}" existe déjà dans l'agence de destination.` 
        });
      }

      // Insertion si aucune duplication trouvée
      const insertQuery = `
        INSERT INTO ttypesfournisseur (
          idagence, codtypefr, designation, formule
        ) VALUES ($1, $2, $3, $4)
      `;

      const values = [
        idagence_destination,
        tf.codtypefr,
        tf.designation,
        tf.formule
      ];

      await client.query(insertQuery, values);
      duplicatedCount++;
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `${duplicatedCount} type(s) de fournisseur dupliqué(s) avec succès vers l'agence de destination ✨`
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur POST /ttypesfournisseur/dupliquer:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la duplication des types de fournisseur.' });
  } finally {
    client.release();
  }
});



module.exports = router;