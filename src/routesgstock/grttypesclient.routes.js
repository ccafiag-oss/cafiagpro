const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assure-toi que ta connection DB est bien configurée

// 1. Récupérer tous les types de client pour un 'idagence' spécifique
router.get('/ttypesclient', async (req, res) => {
  const { idagence } = req.query;

  // Vérification si 'idagence' est fourni
  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM ttypesclient WHERE idagence = $1',
      [idagence]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /ttypesclient:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 2. Ajouter un nouveau type de client
router.post('/ttypesclient', async (req, res) => {
  const {
    idagence,
    codecl,
    designation,
    formule,
    duree_total_credit,
    frequence_credit,
    commission_credit
  } = req.body;

  // Vérification des champs obligatoires
  if (!idagence) {
    return res.status(400).json({ error: 'Le champ "idagence" est obligatoire.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO ttypesclient (
        idagence, codecl, designation, formule, duree_total_credit,
        frequence_credit, commission_credit
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7
      ) RETURNING *`,
      [
        idagence,
        codecl || null,
        designation || null,
        formule !== undefined ? formule : false,
        duree_total_credit || 0,
        frequence_credit || 0,
        commission_credit || 0
      ]
    );
    res.status(201).json({ message: 'Type de client ajouté', data: rows[0] });
  } catch (err) {
    console.error('Erreur POST /ttypesclient:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 3. Modifier un type de client existant
router.put('/ttypesclient/:id', async (req, res) => {
  const { id } = req.params;
  const {
    codecl,
    designation,
    formule,
    duree_total_credit,
    frequence_credit,
    commission_credit
  } = req.body;

  const fields = [];
  const values = [];
  let index = 1;

  if (codecl !== undefined) {
    fields.push(`codecl = $${index++}`);
    values.push(codecl);
  }
  if (designation !== undefined) {
    fields.push(`designation = $${index++}`);
    values.push(designation);
  }
  if (formule !== undefined) {
    fields.push(`formule = $${index++}`);
    values.push(formule);
  }
  if (duree_total_credit !== undefined) {
    fields.push(`duree_total_credit = $${index++}`);
    values.push(duree_total_credit);
  }
  if (frequence_credit !== undefined) {
    fields.push(`frequence_credit = $${index++}`);
    values.push(frequence_credit);
  }
  if (commission_credit !== undefined) {
    fields.push(`commission_credit = $${index++}`);
    values.push(commission_credit);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  values.push(id); // ID pour la clause WHERE

  const query = `UPDATE ttypesclient SET ${fields.join(', ')} WHERE idtypecl = $${index} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, [...values]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Type de client non trouvé' });
    }
    res.json({ message: 'Type de client modifié', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /ttypesclient/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});



// ==========================================
// 4️⃣ DUPLIQUER DES TYPES DE CLIENT VERS UNE AUTRE AGENCE
// POST: http://localhost:5265/api/ttypesclient/dupliquer
// ==========================================
router.post('/ttypesclient/dupliquer', async (req, res) => {
  const { idagence_source, idagence_destination, ids_typesclient } = req.body;

  // Validation des paramètres obligatoires
  if (!idagence_source || !idagence_destination || !ids_typesclient || !Array.isArray(ids_typesclient) || ids_typesclient.length === 0) {
    return res.status(400).json({ error: 'Paramètres manquants ou invalides (idagence_source, idagence_destination, ids_typesclient)' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Récupérer les types de client source à dupliquer
    const selectQuery = `
      SELECT codecl, designation, formule, duree_total_credit, frequence_credit, commission_credit 
      FROM ttypesclient 
      WHERE idagence = $1 AND idtypecl = ANY($2::bigint[])
    `;
    const { rows: typesToDuplicate } = await client.query(selectQuery, [idagence_source, ids_typesclient]);

    if (typesToDuplicate.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aucun type de client trouvé pour les identifiants fournis dans cette agence.' });
    }

    // 2. Insérer les types de client dans l'agence de destination avec vérification d'unicité sur la désignation
    let duplicatedCount = 0;
    for (const tc of typesToDuplicate) {

      // Vérifier si un type de client avec la même désignation existe déjà dans l'agence de destination
      const checkExistQuery = `
        SELECT idtypecl FROM ttypesclient 
        WHERE idagence = $1 AND LOWER(TRIM(designation)) = LOWER(TRIM($2))
      `;
      const existingRows = await client.query(checkExistQuery, [idagence_destination, tc.designation]);

      if (existingRows.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          error: `Le type de client "${tc.designation}" existe déjà dans l'agence de destination.` 
        });
      }

      // Insertion si aucune duplication trouvée
      const insertQuery = `
        INSERT INTO ttypesclient (
          idagence, codecl, designation, formule, duree_total_credit, frequence_credit, commission_credit
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      const values = [
        idagence_destination,
        tc.codecl,
        tc.designation,
        tc.formule,
        tc.duree_total_credit,
        tc.frequence_credit,
        tc.commission_credit
      ];

      await client.query(insertQuery, values);
      duplicatedCount++;
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `${duplicatedCount} type(s) de client dupliqué(s) avec succès vers l'agence de destination ✨`
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur POST /ttypesclient/dupliquer:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la duplication des types de client.' });
  } finally {
    client.release();
  }
});
module.exports = router;