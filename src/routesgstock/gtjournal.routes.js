const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Utilisation de votre configuration de base de données

// ==========================================
// 1️⃣ RÉCUPÉRER LES JOURNAUX PAR IDAGENCE (OBLIGATOIRE)
// GET: http://localhost:5265/api/tjournal?idagence=1&search=achats
// ==========================================
router.get('/tjournal', async (req, res) => {
  const { idagence, search } = req.query;

  // 🔴 Contrainte stricte : l'idagence est obligatoire
  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire pour afficher les journaux.' });
  }

  let queryText = 'SELECT id, codejrnl, designation, codop, codoptva, compte, ordre, codejrnlsage, etat, idagence FROM tjournal WHERE idagence = $1';
  const values = [idagence];

  // Optionnel : Recherche textuelle sur la désignation ou le code journal
  if (search && search.trim().length >= 3) {
    queryText += ' AND (designation ILIKE $2 OR codejrnl ILIKE $2)';
    values.push(`%${search.trim()}%`);
  }

  // Tri par ordre d'affichage, puis par id décroissant
  queryText += ' ORDER BY ordre ASC, id DESC';

  try {
    const { rows } = await pool.query(queryText, values);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erreur GET /tjournal:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération' });
  }
});

// ==========================================
// 2️⃣ AJOUTER UN NOUVEAU JOURNAL (id géré automatiquement par SERIAL)
// POST: http://localhost:5265/api/tjournal
// ==========================================
router.post('/tjournal', async (req, res) => {
  const {
    codejrnl,
    designation,
    codop,
    codoptva,
    compte,
    ordre,
    codejrnlsage,
    etat,
    idagence
  } = req.body;

  // Validation des contraintes de base
  if (!codejrnl || !idagence) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (codejrnl, idagence)' });
  }

  try {
    // 💡 L'id est omis ici car PostgreSQL l'auto-incrémente grâce au type SERIAL
    const queryText = `
      INSERT INTO tjournal (
        codejrnl, designation, codop, codoptva, 
        compte, ordre, codejrnlsage, etat, idagence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      codejrnl.trim().toUpperCase(), // Normalisation automatique du code en majuscules
      designation || null,
      codop || null,
      codoptva || null,
      compte || null,
      ordre ? parseInt(ordre, 10) : 0,
      codejrnlsage || null,
      etat !== undefined ? etat : true, // Actif par défaut
      idagence
    ];

    const { rows } = await pool.query(queryText, values);
    res.status(201).json({ 
      success: true, 
      message: 'Journal créé avec succès ✨', 
      data: rows[0] 
    });

  } catch (err) {
    console.error('Erreur POST /tjournal:', err);
    
    // 💡 Détection propre de la contrainte UNIQUE sur codejrnl (Code PostgreSQL 23505)
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ce code journal existe déjà dans le système.' });
    }
    
    res.status(500).json({ error: 'Erreur serveur lors de la création' });
  }
});

// ==========================================
// 3️⃣ MODIFIER UN JOURNAL EXISTANT (Dynamique)
// PUT: http://localhost:5265/api/tjournal/14
// ==========================================
router.put('/tjournal/:id', async (req, res) => {
  const { id } = req.params;
  const {
    codejrnl,
    designation,
    codop,
    codoptva,
    compte,
    ordre,
    codejrnlsage,
    etat,
    idagence
  } = req.body;

  const fields = [];
  const values = [];
  let index = 1;

  // Construction de la requête SQL dynamique
  if (codejrnl !== undefined) {
    fields.push(`codejrnl = $${index++}`);
    values.push(codejrnl.trim().toUpperCase());
  }
  if (designation !== undefined) {
    fields.push(`designation = $${index++}`);
    values.push(designation);
  }
  if (codop !== undefined) {
    fields.push(`codop = $${index++}`);
    values.push(codop);
  }
  if (codoptva !== undefined) {
    fields.push(`codoptva = $${index++}`);
    values.push(codoptva);
  }
  if (compte !== undefined) {
    fields.push(`compte = $${index++}`);
    values.push(compte);
  }
  if (ordre !== undefined) {
    fields.push(`ordre = $${index++}`);
    values.push(parseInt(ordre, 10) || 0);
  }
  if (codejrnlsage !== undefined) {
    fields.push(`codejrnlsage = $${index++}`);
    values.push(codejrnlsage);
  }
  if (etat !== undefined) {
    fields.push(`etat = $${index++}`);
    values.push(etat);
  }
  if (idagence !== undefined) {
    fields.push(`idagence = $${index++}`);
    values.push(idagence);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  // Ajout de l'identifiant pour la clause WHERE à la toute fin du tableau values
  values.push(id); 

  const queryText = `UPDATE tjournal SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(queryText, values);
    
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Journal non trouvé' });
    }

    res.json({ 
      success: true, 
      message: 'Journal modifié avec succès 📝', 
      data: rows[0] 
    });
  } catch (err) {
    console.error('Erreur PUT /tjournal/:id:', err);
    
    // Interception des erreurs d'unicité lors d'une modification forcée du code
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Impossible d\'appliquer ce code journal car il est déjà utilisé.' });
    }
    
    res.status(500).json({ error: 'Erreur serveur lors de la modification' });
  }
});




///   DUPLICATION

// ==========================================
// 4️⃣ DUPLIQUER DES JOURNAUX VERS UNE AUTRE AGENCE
// POST: http://localhost:5265/api/tjournal/dupliquer
// ==========================================
router.post('/tjournal/dupliquer', async (req, res) => {
  const { idagence_source, idagence_destination, ids_journaux } = req.body;

  // Validation des paramètres obligatoires
  if (!idagence_source || !idagence_destination || !ids_journaux || !Array.isArray(ids_journaux) || ids_journaux.length === 0) {
    return res.status(400).json({ error: 'Paramètres manquants ou invalides (idagence_source, idagence_destination, ids_journaux)' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Récupérer les journaux source à dupliquer
    const selectQuery = `
      SELECT codejrnl, designation, codop, codoptva, compte, ordre, codejrnlsage, etat 
      FROM tjournal 
      WHERE idagence = $1 AND id = ANY($2::int[])
    `;
    const { rows: journauxToDuplicate } = await client.query(selectQuery, [idagence_source, ids_journaux]);

    if (journauxToDuplicate.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aucun journal trouvé pour les identifiants fournis dans cette agence.' });
    }

    // 2. Insérer les journaux dans l'agence de destination avec vérification d'unicité sur le code journal
    let duplicatedCount = 0;
    for (const j of journauxToDuplicate) {

      // Vérifier si un journal avec le même code existe déjà dans l'agence de destination
      const checkExistQuery = `
        SELECT id FROM tjournal 
        WHERE idagence = $1 AND LOWER(TRIM(codejrnl)) = LOWER(TRIM($2))
      `;
      const existingRows = await client.query(checkExistQuery, [idagence_destination, j.codejrnl]);

      if (existingRows.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          error: `Le journal avec le code "${j.codejrnl}" existe déjà dans l'agence de destination.` 
        });
      }

      // Insertion si aucune duplication trouvée
      const insertQuery = `
        INSERT INTO tjournal (
          codejrnl, designation, codop, codoptva, compte, ordre, codejrnlsage, etat, idagence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      const values = [
        j.codejrnl,
        j.designation,
        j.codop,
        j.codoptva,
        j.compte,
        j.ordre,
        j.codejrnlsage,
        j.etat,
        idagence_destination
      ];

      await client.query(insertQuery, values);
      duplicatedCount++;
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `${duplicatedCount} journal(aux) dupliqué(s) avec succès vers l'agence de destination ✨`
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur POST /tjournal/dupliquer:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la duplication des journaux.' });
  } finally {
    client.release();
  }
});

module.exports = router;