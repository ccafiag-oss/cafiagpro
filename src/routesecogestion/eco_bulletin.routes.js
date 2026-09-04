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

    const records = await pool.query(queryInscriptions, [idperiodetrimestre, idclass]);
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

    if (field.startsWith('note') && parsedValue !== null && parsedValue > 20) {
      return res.status(400).json({ success: false, message: 'La note ne peut pas dépasser 20.' });
    }

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

// =========================================================================
// 🔵 7. RÉCUPÉRER LES RÉSULTATS ANNUELS D'UNE CLASSE OU D'UN ÉLÈVE
// =========================================================================
router.get('/bulletin/resultats', async (req, res) => {
  const { idagence, idclasse, idinscription } = req.query;

  if (!idagence || !idclasse) {
    return res.status(400).json({ success: false, message: 'idagence et idclasse requis' });
  }

  try {
    let query = `
      SELECT 
        idresultat, idagence, idanneescolaire, idinscription, idclasse,
        matricule, libelleannee, nomcomplet, datenaissance, lieuxnaissance,
        sexe, nationalite, parcours, serie, classe, status,
        moyenne_annuelle, rang_annuelle, appreciation_annuelle, decision_annuelle,
        moyensemstre1, rangsemestre1, moyensemstre2, rangsemestre2, moyensemstre3, rangsemestre3,
        nbrtrimestre, infosministere, infosdirection, infosetablissement, adresse,
        logo, titulairedeclasse, signaturedirecteur, signaturetitulaire, signatureeleve, photoeleve
      FROM eco_resultat_annuelle_infos
      WHERE idagence = $1 AND idclasse = $2
    `;
    const params = [parseInt(idagence), parseInt(idclasse)];

    if (idinscription) {
      query += ` AND idinscription = $3`;
      params.push(parseInt(idinscription));
    }

    query += ` ORDER BY moyenne_annuelle DESC`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🔵 8. DÉTAIL DES NOTES PAR ÉLÈVE + SIGNATURE ENSEIGNANT (AJOUTÉ)
// =========================================================================
// =========================================================================
// 🔵 8. RÉCUPÉRER LE DÉTAIL DES NOTES PAR ÉLÈVE ET SES MOYENNES (CORRIGÉ)
// =========================================================================
router.get('/bulletin/notes', async (req, res) => {
  // AJOUT : "idagence" a été rajouté dans la déstructuration ci-dessous
  const { idinscription, idagence, id_agence } = req.query;
  const agencyId = idagence || id_agence; 

  if (!idinscription || !agencyId) {
    return res.status(400).json({ success: false, message: 'idinscription et idagence requis' });
  }

  try {
    const query = `
      SELECT 
        m.libellematiere,
        CASE 
          WHEN m.libellematiere ILIKE '%cablage%' 
            OR m.libellematiere ILIKE '%schéma%' 
            OR m.libellematiere ILIKE '%electrotechnique%' 
            OR m.libellematiere ILIKE '%mesure%' 
            OR m.libellematiere ILIKE '%technologie%' 
            OR m.libellematiere ILIKE '%dessin%' 
            OR m.libellematiere ILIKE '%stage%' 
            OR m.libellematiere ILIKE '%atelier%' 
            OR m.libellematiere ILIKE '%pratique%' 
          THEN 'PROFESSIONNELLE'
          ELSE 'GENERALE'
        END AS categorie_matiere,
        n.nbrenote,
        n.moyennenote,
        n.note1, n.note2, n.note3, n.note4, n.note5, n.note6, n.note7, n.note8,
        n.notecompo,
        n.moyenne,
        n.coefficient,
        n.produit,
        n.appreciation,
        ens.nomcomplet AS nom_enseignant,
        ens.signature AS signature_enseignant, -- Signature de l'enseignant
        ROUND((
          SELECT AVG(n2.moyenne) 
          FROM eco_note n2 
          WHERE n2.idmatiereclasse = n.idmatiereclasse 
            AND n2.idperiodetrimestre = n.idperiodetrimestre
        )::numeric, 2)::double precision AS moyclass
      FROM eco_note n
      INNER JOIN eco_matiereparclasse mc ON n.idmatiereclasse = mc.idmatiereclasse
      INNER JOIN eco_matiere m ON mc.idmatiere = m.idmatiere
      LEFT JOIN eco_enseignant ens ON mc.idenseignant = ens.idenseignant
      WHERE n.idinscription = $1 AND n.idagence = $2
    `;

    const result = await pool.query(query, [parseInt(idinscription), parseInt(agencyId)]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Erreur bulletin notes API:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🔵 9. RÉCUPÉRER LA LISTE DES ÉLÈVES D'UNE CLASSE
// =========================================================================
router.get('/classe/eleves', async (req, res) => {
  const { idclasse, idagence } = req.query;

  if (!idclasse || !idagence) {
    return res.status(400).json({ success: false, message: 'idclasse et idagence requis' });
  }

  try {
    const query = `
      SELECT 
        ins.idinscription,
        (e.nom || ' ' || e.prenom) AS nomcomplet
      FROM eco_inscriptioneleve ins
      INNER JOIN eco_eleve e ON ins.ideleve = e.ideleve
      WHERE ins.idclasse = $1 AND ins.idagence = $2 AND ins.etat = true
      ORDER BY e.nom ASC, e.prenom ASC
    `;
    const result = await pool.query(query, [parseInt(idclasse), parseInt(idagence)]);
    res.json({ success: true, data: result.rows });
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

// =========================================================================
// 🔵 7. RÉCUPÉRER LES RÉSULTATS ANNUELS D'UNE CLASSE OU D'UN ÉLÈVE
// =========================================================================
router.get('/bulletin/resultats', async (req, res) => {
  const { idagence, idclasse, idinscription } = req.query;

  if (!idagence || !idclasse) {
    return res.status(400).json({ success: false, message: 'idagence et idclasse requis' });
  }

  try {
    let query = `
      SELECT 
        idresultat, idagence, idanneescolaire, idinscription, idclasse,
        matricule, libelleannee, nomcomplet, datenaissance, lieuxnaissance,
        sexe, nationalite, parcours, serie, classe, status,
        moyenne_annuelle, rang_annuelle, appreciation_annuelle, decision_annuelle,
        moyensemstre1, rangsemestre1, moyensemstre2, rangsemestre2, moyensemstre3, rangsemestre3,
        nbrtrimestre, infosministere, infosdirection, infosetablissement, adresse,
        logo, titulairedeclasse, signaturedirecteur, signaturetitulaire, signatureeleve, photoeleve
      FROM eco_resultat_annuelle_infos
      WHERE idagence = $1 AND idclasse = $2
    `;
    const params = [parseInt(idagence), parseInt(idclasse)];

    if (idinscription) {
      query += ` AND idinscription = $3`;
      params.push(parseInt(idinscription));
    }

    query += ` ORDER BY moyenne_annuelle DESC`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🔵 8. RÉCUPÉRER LE DÉTAIL DES NOTES PAR ÉLÈVE ET SES MOYENNES DE CLASSE
// =========================================================================



// =========================================================================
// 🔵 RÉCUPÉRER LE DÉTAIL DES NOTES PAR ÉLÈVE ET SES MOYENNES (ÉVOLUTIF)
// =========================================================================
// =========================================================================
// 🔵 8. RÉCUPÉRER LE DÉTAIL DES NOTES PAR ÉLÈVE ET SES MOYENNES (CORRIGÉ)
// =========================================================================
router.get('/bulletin/notes', async (req, res) => {
  const { idinscription, idagence } = req.query;

  if (!idinscription || !idagence) {
    return res.status(400).json({ success: false, message: 'idinscription et idagence requis' });
  }

  try {
    const query = `
      SELECT 
        m.libellematiere,
        -- Catégorisation dynamique basée sur le libellé pour éviter l'erreur de colonne inexistante
        CASE 
          WHEN m.libellematiere ILIKE '%cablage%' 
            OR m.libellematiere ILIKE '%schéma%' 
            OR m.libellematiere ILIKE '%electrotechnique%' 
            OR m.libellematiere ILIKE '%mesure%' 
            OR m.libellematiere ILIKE '%technologie%' 
            OR m.libellematiere ILIKE '%dessin%' 
            OR m.libellematiere ILIKE '%stage%' 
            OR m.libellematiere ILIKE '%atelier%' 
            OR m.libellematiere ILIKE '%pratique%' 
          THEN 'PROFESSIONNELLE'
          ELSE 'GENERALE'
        END AS categorie_matiere,
        n.nbrenote,
        n.moyennenote,
        n.note1, n.note2, n.note3, n.note4, n.note5, n.note6, n.note7, n.note8,
        n.notecompo,
        n.moyenne,
        n.coefficient,
        n.produit,
        n.appreciation,
        ens.nomcomplet AS nom_enseignant,
        -- Calcul de la moyenne de classe sur ce devoir spécifique
        ROUND((
          SELECT AVG(n2.moyenne) 
          FROM eco_note n2 
          WHERE n2.idmatiereclasse = n.idmatiereclasse 
            AND n2.idperiodetrimestre = n.idperiodetrimestre
        )::numeric, 2)::double precision AS moyclass
      FROM eco_note n
      INNER JOIN eco_matiereparclasse mc ON n.idmatiereclasse = mc.idmatiereclasse
      INNER JOIN eco_matiere m ON mc.idmatiere = m.idmatiere
      LEFT JOIN eco_enseignant ens ON mc.idenseignant = ens.idenseignant
      WHERE n.idinscription = $1 AND n.idagence = $2
    `;

    const result = await pool.query(query, [parseInt(idinscription), parseInt(idagence)]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
// =========================================================================
// 🔵 9. RÉCUPÉRER LA LISTE DES ÉLÈVES D'UNE CLASSE
// =========================================================================
router.get('/classe/eleves', async (req, res) => {
  const { idclasse, idagence } = req.query;

  if (!idclasse || !idagence) {
    return res.status(400).json({ success: false, message: 'idclasse et idagence requis' });
  }

  try {
    const query = `
      SELECT 
        ins.idinscription,
        (e.nom || ' ' || e.prenom) AS nomcomplet
      FROM eco_inscriptioneleve ins
      INNER JOIN eco_eleve e ON ins.ideleve = e.ideleve
      WHERE ins.idclasse = $1 AND ins.idagence = $2 AND ins.etat = true
      ORDER BY e.nom ASC, e.prenom ASC
    `;
    const result = await pool.query(query, [parseInt(idclasse), parseInt(idagence)]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
*/