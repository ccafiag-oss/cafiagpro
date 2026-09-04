const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================================================
// 🔵 1. RÉCUPÉRER LES PÉRIODES TRIMESTRES ACTIFS
// =========================================================================
router.get('/note/periodes', async (req, res) => {
  const { idagence } = req.query;
  if (!idagence) {
    return res.status(400).json({ success: false, message: 'idagence requis' });
  }
  try {
    const result = await pool.query(
      `SELECT pt.*, t.libelletrimestre, a.libelleannee
       FROM eco_periodetrimestre pt
       INNER JOIN eco_trimestre t ON pt.idtrimestre = t.idtrimestre
       INNER JOIN eco_anneescolaire a ON pt.idanneescolaire = a.idanneescolaire
       WHERE pt.idagence = $1 AND pt.etat = true
       ORDER BY pt.idperiodetrimestre DESC`,
      [idagence]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🟢 2. INITIALISER LES FICHES DE NOTES (Ouvrir la saisie)
// =========================================================================
router.post('/note/initialize', async (req, res) => {
  const { idagence, idperiodetrimestre } = req.body;

  if (!idagence || !idperiodetrimestre) {
    return res.status(400).json({ success: false, message: 'Données manquantes' });
  }

  try {
    const queryInscriptions = `
      SELECT 
        ie.idinscription, 
        ie.idclasse, 
        mc.idmatiereclasse, 
        mc.coefficient, 
        mc.nbrenote, mc.idtypeepreuve
      FROM eco_inscriptioneleve ie
      INNER JOIN eco_periodetrimestre pt ON ie.idanneescolaire = pt.idanneescolaire
      INNER JOIN eco_matiereparclasse mc ON ie.idclasse = mc.idclasse
      WHERE pt.idperiodetrimestre = $1 
        AND ie.idagence = $2 
        AND ie.etat = true
    `;

    const records = await pool.query(queryInscriptions, [idperiodetrimestre, idagence]);
    let insertsCount = 0;

    for (const rec of records.rows) {
      const checkExist = await pool.query(
        `SELECT 1 FROM eco_note 
         WHERE idinscription = $1 AND idperiodetrimestre = $2 AND idmatiereclasse = $3`,
        [rec.idinscription, idperiodetrimestre, rec.idmatiereclasse]
      );

      if (checkExist.rowCount === 0) {
        await pool.query(
          `INSERT INTO eco_note (
            idagence, idinscription, idperiodetrimestre, idmatiereclasse, coefficient, nbrenote, etat, idtypeepreuve
          ) VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
          [idagence, rec.idinscription, idperiodetrimestre, rec.idmatiereclasse, rec.coefficient || 1, rec.nbrenote || 1, rec.idtypeepreuve]
        );
        insertsCount++;
      }
    }

    res.json({
      success: true,
      message: `Initialisation terminée. ${insertsCount} nouvelles fiches de notes créées.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🔵 3. RÉCUPÉRER LES CLASSES DE L'ENSEIGNANT CONNECTÉ
// =========================================================================

/*
router.get('/note/enseignant-classes', async (req, res) => {
  const { iduser, idagence } = req.query;
  if (!iduser || !idagence) {
    return res.status(400).json({ success: false, message: 'Paramètres manquants' });
  }

  try {
    const result = await pool.query(
      `SELECT DISTINCT c.idclasse, c.libelleclasse, c.abreviationclasse
       FROM eco_classe c
       INNER JOIN eco_matiereparclasse mc ON c.idclasse = mc.idclasse
       INNER JOIN eco_enseignant e ON mc.idenseignant = e.idenseignant
       WHERE e.iduser = $1 AND c.idagence = $2`,
      [iduser, idagence]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

*/

// =========================================================================
// 🔵 3. RÉCUPÉRER LES CLASSES (DE L'ENSEIGNANT OU TOUTES LES CLASSES)
// =========================================================================
router.get('/note/enseignant-classes', async (req, res) => {
  const { iduser, idagence } = req.query;

  if (!idagence) {
    return res.status(400).json({ success: false, message: 'Paramètre idagence manquant' });
  }

  try {
    let result;

    // Si iduser vaut 'all', n'est pas fourni, ou n'est pas un nombre valide,
    // on retourne toutes les classes actives de l'agence (utile pour les bulletins)
    if (!iduser || iduser === 'all' || isNaN(parseInt(iduser))) {
      result = await pool.query(
        `SELECT idclasse, libelleclasse, abreviationclasse
         FROM eco_classe
         WHERE idagence = $1 AND etat = true
         ORDER BY libelleclasse ASC`,
        [idagence]
      );
    } else {
      // Sinon, on filtre pour n'obtenir que les classes attribuées à cet enseignant
      result = await pool.query(
        `SELECT DISTINCT c.idclasse, c.libelleclasse, c.abreviationclasse
         FROM eco_classe c
         INNER JOIN eco_matiereparclasse mc ON c.idclasse = mc.idclasse
         INNER JOIN eco_enseignant e ON mc.idenseignant = e.idenseignant
         WHERE e.iduser = $1 AND c.idagence = $2 AND c.etat = true
         ORDER BY c.libelleclasse ASC`,
        [parseInt(iduser), idagence]
      );
    }

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
// =========================================================================
// 🔵 4. RÉCUPÉRER LES MATIÈRES ENSEIGNÉES DANS CETTE CLASSE
// =========================================================================
router.get('/note/enseignant-matieres', async (req, res) => {
  const { iduser, idclasse } = req.query;
  if (!iduser || !idclasse) {
    return res.status(400).json({ success: false, message: 'Paramètres manquants' });
  }

  try {
    const result = await pool.query(
      `SELECT mc.idmatiereclasse, m.libellematiere, mc.coefficient, mc.nbrenote
       FROM eco_matiereparclasse mc
       INNER JOIN eco_matiere m ON mc.idmatiere = m.idmatiere
       INNER JOIN eco_enseignant e ON mc.idenseignant = e.idenseignant
       WHERE mc.idclasse = $1 AND e.iduser = $2`,
      [idclasse, iduser]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🔵 5. CHARGER LA GRILLE DE SAISIE DES NOTES
// =========================================================================
router.get('/note/grille', async (req, res) => {
  const { idperiodetrimestre, idclasse, idmatiereclasse } = req.query;

  try {
    const result = await pool.query(
      `SELECT 
        n.*,
        e.nom AS nom_eleve,
        e.prenom AS prenom_eleve,
        e.matricule
       FROM eco_note n
       INNER JOIN eco_inscriptioneleve ie ON n.idinscription = ie.idinscription
       INNER JOIN eco_eleve e ON ie.ideleve = e.ideleve
       WHERE n.idperiodetrimestre = $1 
         AND ie.idclasse = $2 
         AND n.idmatiereclasse = $3
       ORDER BY e.nom ASC, e.prenom ASC`,
      [idperiodetrimestre, idclasse, idmatiereclasse]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🟡 6. AUTO-SAUVEGARDE EN TEMPS RÉEL (Cellule Unique)
// =========================================================================
router.put('/note/update-cell', async (req, res) => {
  const { idnote, field, value } = req.body;

  const allowedFields = [
    'note1', 'note2', 'note3', 'note4', 'note5', 'note6', 'note7', 'note8', 
    'notecompo', 'nbrenote', 'coefficient'
  ];

  if (!idnote || !field || !allowedFields.includes(field)) {
    return res.status(400).json({ success: false, message: 'Paramètres incorrects' });
  }

  try {
    const parsedValue = value === '' || value === null ? null : parseFloat(value);

    // Validation de sécurité sur le serveur : interdire les notes supérieures à 20
    if (field.startsWith('note') && parsedValue !== null && parsedValue > 20) {
      return res.status(400).json({ success: false, message: 'La note ne peut pas dépasser 20.' });
    }

    // Mise à jour de la cellule et renvoi du tuple calculé en temps réel
    const result = await pool.query(
      `UPDATE eco_note
       SET ${field} = $1
       WHERE idnote = $2
       RETURNING *`,
      [parsedValue, idnote]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Note non trouvée.' });
    }

    res.json({
      success: true,
      message: 'Note mise à jour',
      data: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;




/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================================================
// 🔵 1. RÉCUPÉRER LES PÉRIODES TRIMESTRES ACTIFS
// GET: http://localhost:5265/api/note/periodes?idagence=1
// =========================================================================
router.get('/note/periodes', async (req, res) => {
  const { idagence } = req.query;
  if (!idagence) {
    return res.status(400).json({ success: false, message: 'idagence requis' });
  }
  try {
    const result = await pool.query(
      `SELECT pt.*, t.libelletrimestre, a.libelleannee
       FROM eco_periodetrimestre pt
       INNER JOIN eco_trimestre t ON pt.idtrimestre = t.idtrimestre
       INNER JOIN eco_anneescolaire a ON pt.idanneescolaire = a.idanneescolaire
       WHERE pt.idagence = $1 AND pt.etat = true
       ORDER BY pt.idperiodetrimestre DESC`,
      [idagence]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🟢 2. INITIALISER LES FICHES DE NOTES (Ouvrir la saisie)
// POST: http://localhost:5265/api/note/initialize
// =========================================================================
router.post('/note/initialize', async (req, res) => {
  const { idagence, idperiodetrimestre } = req.body;

  if (!idagence || !idperiodetrimestre) {
    return res.status(400).json({ success: false, message: 'Données manquantes' });
  }

  try {
    // Récupérer toutes les inscriptions actives et leurs matières par classe correspondantes
    const queryInscriptions = `
      SELECT 
        ie.idinscription, 
        ie.idclasse, 
        mc.idmatiereclasse, 
        mc.coefficient, 
        mc.nbrenote,mc.idtypeepreuve
      FROM eco_inscriptioneleve ie
      INNER JOIN eco_periodetrimestre pt ON ie.idanneescolaire = pt.idanneescolaire
      INNER JOIN eco_matiereparclasse mc ON ie.idclasse = mc.idclasse
      WHERE pt.idperiodetrimestre = $1 
        AND ie.idagence = $2 
        AND ie.etat = true
    `;

    const records = await pool.query(queryInscriptions, [idperiodetrimestre, idagence]);

    let insertsCount = 0;

    // Insertion unitaire sécurisée (ON CONFLICT DO NOTHING ou vérification par SELECT)
    for (const rec of records.rows) {
      const checkExist = await pool.query(
        `SELECT 1 FROM eco_note 
         WHERE idinscription = $1 AND idperiodetrimestre = $2 AND idmatiereclasse = $3`,
        [rec.idinscription, idperiodetrimestre, rec.idmatiereclasse]
      );

      if (checkExist.rowCount === 0) {
        await pool.query(
          `INSERT INTO eco_note (
            idagence, idinscription, idperiodetrimestre, idmatiereclasse, coefficient, nbrenote, etat,idtypeepreuve
          ) VALUES ($1, $2, $3, $4, $5, $6, true,$7)`,
          [idagence, rec.idinscription, idperiodetrimestre, rec.idmatiereclasse, rec.coefficient || 1, rec.nbrenote || 1,rec.idtypeepreuve]
        );
        insertsCount++;
      }
    }

    res.json({
      success: true,
      message: `Initialisation terminée. ${insertsCount} nouvelles fiches de notes créées.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🔵 3. RÉCUPÉRER LES CLASSES DE L'ENSEIGNANT CONNECTÉ
// GET: http://localhost:5265/api/note/enseignant-classes?iduser=15&idagence=1
// =========================================================================
router.get('/note/enseignant-classes', async (req, res) => {
  const { iduser, idagence } = req.query;
  if (!iduser || !idagence) {
    return res.status(400).json({ success: false, message: 'Paramètres manquants' });
  }

  try {
    const result = await pool.query(
      `SELECT DISTINCT c.idclasse, c.libelleclasse, c.abreviationclasse
       FROM eco_classe c
       INNER JOIN eco_matiereparclasse mc ON c.idclasse = mc.idclasse
       INNER JOIN eco_enseignant e ON mc.idenseignant = e.idenseignant
       WHERE e.iduser = $1 AND c.idagence = $2`,
      [iduser, idagence]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🔵 4. RÉCUPÉRER LES MATIÈRES ENSEIGNÉES DANS CETTE CLASSE
// GET: http://localhost:5265/api/note/enseignant-matieres?iduser=15&idclasse=1
// =========================================================================
router.get('/note/enseignant-matieres', async (req, res) => {
  const { iduser, idclasse } = req.query;
  if (!iduser || !idclasse) {
    return res.status(400).json({ success: false, message: 'Paramètres manquants' });
  }

  try {
    const result = await pool.query(
      `SELECT mc.idmatiereclasse, m.libellematiere, mc.coefficient, mc.nbrenote
       FROM eco_matiereparclasse mc
       INNER JOIN eco_matiere m ON mc.idmatiere = m.idmatiere
       INNER JOIN eco_enseignant e ON mc.idenseignant = e.idenseignant
       WHERE mc.idclasse = $1 AND e.iduser = $2`,
      [idclasse, iduser]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🔵 5. CHARGER LA GRILLE DE SAISIE DES NOTES
// GET: http://localhost:5265/api/note/grille?idperiodetrimestre=1&idclasse=1&idmatiereclasse=1
// =========================================================================
router.get('/note/grille', async (req, res) => {
  const { idperiodetrimestre, idclasse, idmatiereclasse } = req.query;

  try {
    const result = await pool.query(
      `SELECT 
        n.*,
        e.nom AS nom_eleve,
        e.prenom AS prenom_eleve,
        e.matricule
       FROM eco_note n
       INNER JOIN eco_inscriptioneleve ie ON n.idinscription = ie.idinscription
       INNER JOIN eco_eleve e ON ie.ideleve = e.ideleve
       WHERE n.idperiodetrimestre = $1 
         AND ie.idclasse = $2 
         AND n.idmatiereclasse = $3
       ORDER BY e.nom ASC, e.prenom ASC`,
      [idperiodetrimestre, idclasse, idmatiereclasse]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🟡 6. AUTO-SAUVEGARDE EN TEMPS RÉEL (Cellule Unique)
// PUT: http://localhost:5265/api/note/update-cell
// =========================================================================
router.put('/note/update-cell', async (req, res) => {
  const { idnote, field, value } = req.body;

  const allowedFields = [
    'note1', 'note2', 'note3', 'note4', 'note5', 'note6', 'note7', 'note8', 
    'notecompo', 'nbrenote', 'coefficient'
  ];

  if (!idnote || !field || !allowedFields.includes(field)) {
    return res.status(400).json({ success: false, message: 'Paramètres incorrects' });
  }

  try {
    const parsedValue = value === '' || value === null ? null : parseFloat(value);

    // Mise à jour de la cellule et renvoi du tuple calculé en temps réel (STORED columns)
    const result = await pool.query(
      `UPDATE eco_note
       SET ${field} = $1
       WHERE idnote = $2
       RETURNING *`,
      [parsedValue, idnote]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Note non trouvée.' });
    }

    res.json({
      success: true,
      message: 'Note mise à jour',
      data: result.rows[0] // Contient moyenne, moyennenote, appreciation, produit actualisés
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

*/