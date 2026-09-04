const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================================================
// 🔵 1. RÉCUPÉRER LA CONFIGURATION ACTUELLE D'UNE CLASSE
// GET: http://localhost:5265/api/matiereparclasse?idagence=1&idclasse=5
// =========================================================================
router.get('/matiereparclasse', async (req, res) => {
  const { idagence, idclasse } = req.query;

  if (!idagence || !idclasse) {
    return res.status(400).json({ success: false, message: 'idagence et idclasse requis' });
  }

  try {
    const result = await pool.query(
      `SELECT 
        mc.*,
        m.libellematiere AS nom_matiere,
        e.nomcomplet AS nom_enseignant,
        te.libelleepreuve AS nom_typeepreuve
       FROM eco_matiereparclasse mc
       INNER JOIN eco_matiere m ON mc.idmatiere = m.idmatiere
       LEFT JOIN eco_enseignant e ON mc.idenseignant = e.idenseignant
       LEFT JOIN eco_typeepreuve te ON mc.idtypeepreuve = te.idtypeepreuve
       WHERE mc.idagence = $1 AND mc.idclasse = $2
       ORDER BY mc.idmatiereclasse ASC`,
      [idagence, idclasse]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🟢 2. SYNCHRONISER/SAUVEGARDER LE COMPORTEMENT (TRANSACTIONNEL ET INCRÉMENTAL)
// POST: http://localhost:5265/api/matiereparclasse/sync
// =========================================================================
router.post('/matiereparclasse/sync', async (req, res) => {
  const { idagence, idclasse, rows } = req.body; // "rows" est la liste des matières configurées

  if (!idagence || !idclasse || !Array.isArray(rows)) {
    return res.status(400).json({ success: false, message: 'Données manquantes ou invalides.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Récupérer l'état actuel de la base de données pour cette classe
    const currentDbRes = await client.query(
      `SELECT idmatiereclasse, idmatiere FROM eco_matiereparclasse 
       WHERE idagence = $1 AND idclasse = $2`,
      [idagence, idclasse]
    );

    // Mapper les matières existantes sous forme de Map: [idmatiere => idmatiereclasse]
    const existingMap = new Map(
      currentDbRes.rows.map(r => [r.idmatiere, r.idmatiereclasse])
    );

    const incomingMatiereIds = rows.map(r => r.idmatiere);

    // 2. Nettoyage sécurisé : Supprimer uniquement les matières retirées de l'interface
    if (currentDbRes.rows.length > 0) {
      const toDelete = currentDbRes.rows
        .filter(r => !incomingMatiereIds.includes(r.idmatiere))
        .map(r => r.idmatiereclasse);

      if (toDelete.length > 0) {
        await client.query(
          `DELETE FROM eco_matiereparclasse WHERE idmatiereclasse = ANY($1::int[])`,
          [toDelete]
        );
      }
    }

    // 3. Effectuer l'UPSERT (INSERT ou UPDATE) pour chaque ligne de la grille
    for (const row of rows) {
      const existingIdMatiereClasse = existingMap.get(row.idmatiere);

      if (existingIdMatiereClasse) {
        // --- CAS A : LA MATIÈRE EXISTE DÉJÀ ---
        // Mise à jour de la configuration de la classe en préservant son ID
        await client.query(
          `UPDATE eco_matiereparclasse
           SET idenseignant = $1,
               coefficient = $2,
               idtypeepreuve = $3,
               nbrenote = $4,
               dureecoursminute = $5,
               montantdu = $6,
               jours = $7,
               heuredebut = $8,
               heurefin = $9
           WHERE idmatiereclasse = $10`,
          [
            row.idenseignant || null,
            row.coefficient || 1,
            row.idtypeepreuve || null,
            row.nbrenote || 1,
            row.dureecoursminute || 0,
            row.montantdu || 0.00,
            row.jours || null,
            row.heuredebut || null,
            row.heurefin || null,
            existingIdMatiereClasse
          ]
        );

        // PROPAGATION automatique de la modification des coefficients, épreuves et nombre de notes sur eco_note
        await client.query(
          `UPDATE eco_note
           SET coefficient = $1,
               idtypeepreuve = $2,
               nbrenote = $3
           WHERE idmatiereclasse = $4`,
          [
            row.coefficient || 1,
            row.idtypeepreuve || null,
            row.nbrenote || 1,
            existingIdMatiereClasse
          ]
        );

      } else {
        // --- CAS B : NOUVELLE MATIÈRE AJOUTÉE ---
        // Insertion de la nouvelle ligne de configuration
        await client.query(
          `INSERT INTO eco_matiereparclasse (
            idagence, idclasse, idmatiere, idenseignant, coefficient,
            idtypeepreuve, nbrenote, dureecoursminute, montantdu, jours, heuredebut, heurefin
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            idagence,
            idclasse,
            row.idmatiere,
            row.idenseignant || null,
            row.coefficient || 1,
            row.idtypeepreuve || null,
            row.nbrenote || 1,
            row.dureecoursminute || 0,
            row.montantdu || 0.00,
            row.jours || null,
            row.heuredebut || null,
            row.heurefin || null
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'La configuration de la classe et les fiches de notes associées ont été mises à jour.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;



/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================================================
// 🔵 1. RÉCUPÉRER LA CONFIGURATION ACTUELLE D'UNE CLASSE
// GET: http://localhost:5265/api/matiereparclasse?idagence=1&idclasse=5
// =========================================================================
router.get('/matiereparclasse', async (req, res) => {
  const { idagence, idclasse } = req.query;

  if (!idagence || !idclasse) {
    return res.status(400).json({ success: false, message: 'idagence et idclasse requis' });
  }

  try {
    const result = await pool.query(
      `SELECT 
        mc.*,
        m.libellematiere AS nom_matiere,
        e.nomcomplet AS nom_enseignant,
        te.libelleepreuve AS nom_typeepreuve
       FROM eco_matiereparclasse mc
       INNER JOIN eco_matiere m ON mc.idmatiere = m.idmatiere
       LEFT JOIN eco_enseignant e ON mc.idenseignant = e.idenseignant
       LEFT JOIN eco_typeepreuve te ON mc.idtypeepreuve = te.idtypeepreuve
       WHERE mc.idagence = $1 AND mc.idclasse = $2
       ORDER BY mc.idmatiereclasse ASC`,
      [idagence, idclasse]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🟢 2. SYNCHRONISER/SAUVEGARDER LE COMPORTEMENT (TRANSACTIONNEL)
// POST: http://localhost:5265/api/matiereparclasse/sync
// =========================================================================
router.post('/matiereparclasse/sync', async (req, res) => {
  const { idagence, idclasse, rows } = req.body; // "rows" est un tableau de liaisons

  if (!idagence || !idclasse || !Array.isArray(rows)) {
    return res.status(400).json({ success: false, message: 'Données manquantes ou invalides.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Suppression de la configuration précédente pour cette classe
    await client.query(
      `DELETE FROM eco_matiereparclasse WHERE idagence = $1 AND idclasse = $2`,
      [idagence, idclasse]
    );

    // 2. Insertion des nouvelles lignes
    for (const row of rows) {
      await client.query(
        `INSERT INTO eco_matiereparclasse (
          idagence, idclasse, idmatiere, idenseignant, coefficient,
          idtypeepreuve, nbrenote, dureecoursminute, montantdu, jours, heuredebut, heurefin
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          idagence,
          idclasse,
          row.idmatiere,
          row.idenseignant || null,
          row.coefficient || 1,
          row.idtypeepreuve || null,
          row.nbrenote || 0,
          row.dureecoursminute || 0,
          row.montantdu || 0.00,
          row.jours || null, // Chaine séparée par virgule (ex: "Lundi,Mardi")
          row.heuredebut || null,
          row.heurefin || null
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Mise à jour de la classe enregistrée avec succès' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
*/