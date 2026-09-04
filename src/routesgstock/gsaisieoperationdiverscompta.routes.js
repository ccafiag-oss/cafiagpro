const express = require('express');
const router = express.Router();
const pool = require('../config/db');








// =========================================================================
// 1. LIRE / AFFICHER LES OPÉRATIONS COMPTABLES
// =========================================================================
router.get('/operationscompta', async (req, res) => {
  const { idagence } = req.query;

  if (!idagence) {
    return res.status(400).json({ success: false, message: "idagence requis." });
  }

  try {
    // Cette requête regroupe les écritures par code d'opération (codeop)
    // et extrait les comptes débit et crédit associés pour l'affichage.
    const query = `
      SELECT 
        codeop, 
        MAX(datesaisie) AS datesaisie, 
        MAX(libelle) AS libelle, 
        MAX(montant) AS montant, 
        MAX(idagence) AS idagence, 
        MAX(iduser) AS iduser,
        MAX(CASE WHEN sence = 'D' THEN compte END) AS compte_debit,
        MAX(CASE WHEN sence = 'C' THEN compte END) AS compte_credit,
        MAX(idtiers) AS idtiers, 
        MAX(codetiers) AS codetiers
      FROM compta_ecriscomptadetail
      WHERE idagence = $1
      GROUP BY codeop
      ORDER BY datesaisie DESC;
    `;
    
    const result = await pool.query(query, [idagence]);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur de récupération:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});




router.get('/operationscomptaentredate', async (req, res) => {
  // Récupération des paramètres : idagence, dateDebut et dateFin
  const { idagence, dateDebut, dateFin } = req.query;

  if (!idagence || !dateDebut || !dateFin) {
    return res.status(400).json({ 
      success: false, 
      message: "Paramètres manquants : idagence, dateDebut et dateFin sont requis." 
    });
  }

  try {
    // Ajout de la condition de date dans la clause WHERE
    // On suppose que datesaisie est au format 'YYYY-MM-DD' ou un format compatible
    const query = `
      SELECT 
        codeop, 
        MAX(datesaisie) AS datesaisie, 
        MAX(libelle) AS libelle, 
        MAX(montant) AS montant, 
        MAX(idagence) AS idagence, 
        MAX(iduser) AS iduser,
        MAX(CASE WHEN sence = 'D' THEN compte END) AS compte_debit,
        MAX(CASE WHEN sence = 'C' THEN compte END) AS compte_credit,
        MAX(idtiers) AS idtiers, 
        MAX(codetiers) AS codetiers
      FROM compta_ecriscomptadetail
      WHERE idagence = $1 
        AND datesaisie::date >= $2::date 
        AND datesaisie::date <= $3::date
      GROUP BY codeop
      ORDER BY datesaisie DESC;
    `;
    
    // Passage des paramètres dans le tableau de la requête
    const result = await pool.query(query, [idagence, dateDebut, dateFin]);
    
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur de récupération:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});





router.get('/rapportoperationscomptaentredate', async (req, res) => {
  // Récupération des paramètres depuis la query string
  const { idagence, dateDebut, dateFin } = req.query;

  if (!idagence || !dateDebut || !dateFin) {
    return res.status(400).json({ 
      success: false, 
      message: "Paramètres manquants : idagence, dateDebut et dateFin sont requis." 
    });
  }

  try {
    // Requête SQL optimisée avec agrégation
    const query = `
      SELECT 
        fm.designation, 
        god.idagence, 
        god.idmodel, 
        SUM(god.montant) AS total_montant
      FROM public.compta_ecriscomptadetail god
      JOIN public.fina_model fm ON fm.idmodel = god.idmodel
      WHERE god.idagence = $1 and god.sence='D'
        AND god.datesaisie >= $2::date 
        AND god.datesaisie <= $3::date
      GROUP BY god.idmodel, fm.designation, god.idagence;
    `;
    
    // Exécution sécurisée avec les paramètres
    const result = await pool.query(query, [idagence, dateDebut, dateFin]);
    
    return res.status(200).json({ 
      success: true, 
      count: result.rowCount,
      data: result.rows 
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des données comptables:', err);
    return res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors de la récupération des données.",
      error: err.message 
    });
  }
});






router.get('/rapportoperationscomptaevolutionmodel', async (req, res) => {
  const { idagence, idmodel, dateDebut, dateFin } = req.query;

  if (!idagence || !idmodel || !dateDebut || !dateFin) {
    return res.status(400).json({ 
      success: false, 
      message: "Paramètres manquants : idagence, idmodel, dateDebut et dateFin sont requis." 
    });
  }

  try {
    // 1. Évolution par Jour de la Semaine (Semaine)
    const querySemaine = `
      SELECT 
        TO_CHAR(god.datesaisie, 'FMDay') AS jour_semaine,
        EXTRACT(ISODOW FROM god.datesaisie) AS jour_index,
        SUM(god.montant) AS total_montant
      FROM public.compta_ecriscomptadetail god
      WHERE god.idagence = $1 AND god.idmodel = $2 AND god.sence = 'D'
        AND god.datesaisie >= $3::date AND god.datesaisie <= $4::date
      GROUP BY jour_semaine, jour_index
      ORDER BY jour_index;
    `;

    // 2. Évolution par Mois
    const queryMois = `
      SELECT 
        TO_CHAR(god.datesaisie, 'YYYY-MM') AS mois,
        SUM(god.montant) AS total_montant
      FROM public.compta_ecriscomptadetail god
      WHERE god.idagence = $1 AND god.idmodel = $2 AND god.sence = 'D'
        AND god.datesaisie >= $3::date AND god.datesaisie <= $4::date
      GROUP BY mois
      ORDER BY mois;
    `;

    // 3. Évolution par Année
    const queryAnnee = `
      SELECT 
        TO_CHAR(god.datesaisie, 'YYYY') AS annee,
        SUM(god.montant) AS total_montant
      FROM public.compta_ecriscomptadetail god
      WHERE god.idagence = $1 AND god.idmodel = $2 AND god.sence = 'D'
        AND god.datesaisie >= $3::date AND god.datesaisie <= $4::date
      GROUP BY annee
      ORDER BY annee;
    `;

    const [resSemaine, resMois, resAnnee] = await Promise.all([
      pool.query(querySemaine, [idagence, idmodel, dateDebut, dateFin]),
      pool.query(queryMois, [idagence, idmodel, dateDebut, dateFin]),
      pool.query(queryAnnee, [idagence, idmodel, dateDebut, dateFin])
    ]);

    return res.status(200).json({ 
      success: true, 
      data: {
        evolutionSemaine: resSemaine.rows,
        evolutionMois: resMois.rows,
        evolutionAnnee: resAnnee.rows
      }
    });
  } catch (err) {
    console.error('Erreur lors du calcul de l\'évolution comptable:', err);
    return res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors de la récupération des évolutions chronologiques.",
      error: err.message 
    });
  }
});


/*
router.post('/saisieoperationdiverscompta1', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      idagence, iduser, idtmvth, codjrnal, date, libelle, montant,
      idCptDebit, idCptCredit, idtiers, codetiers, idmodel
    } = req.body;

    // Validation basique
    if (!idagence || !idtmvth || !idCptDebit || !idCptCredit || !montant) {
      return res.status(400).json({ success: false, message: "Données manquantes." });
    }

    const d = new Date(date);

    // Préparation des deux lignes (Débit et Crédit)
    const values = [];
    // Ligne Débit
    values.push(idtmvth, 'OPS', idagence, iduser, 0, idmodel, '', d, idtiers, codetiers, montant, libelle, idCptDebit, 'D', 0, d, idtmvth);
    // Ligne Crédit
    values.push(idtmvth, 'OPS', idagence, iduser, 0, idmodel, '', d, idtiers, codetiers, montant, libelle, idCptCredit, 'C', 0, d, idtmvth);

    const insertQuery = `
      INSERT INTO compta_ecriscomptadetail (
        codeop, codetypeop, idagence, iduser, idjrnal, idmodel, codemodel, 
        datesaisie, idtiers, codetiers, montant, libelle, compte, sence, 
        id_immo, datevalidation, ref_piece
      ) VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17),
      ($18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
      RETURNING id;
    `;

    await client.query('BEGIN');
    await client.query(insertQuery, values);
    await client.query('COMMIT');

    return res.status(201).json({ success: true, message: "Opération enregistrée avec succès." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur SQL:', err);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});


// =========================================================================
// 2. MODIFIER UNE OPÉRATION COMPTABLE
// =========================================================================
router.put('/saisieoperationdiverscompta1/:codeop', async (req, res) => {
  const { codeop } = req.params;
  const client = await pool.connect();

  try {
    const {
      date, libelle, montant,
      idCptDebit, idCptCredit, idtiers, codetiers, iduser
    } = req.body;

    if (!codeop || !montant || !idCptDebit || !idCptCredit) {
      return res.status(400).json({ success: false, message: "Données requises manquantes." });
    }

    const d = new Date(date);

    await client.query('BEGIN');

    // Mise à jour de la ligne DÉBIT ('D')
    const updateDebitQuery = `
      UPDATE compta_ecriscomptadetail
      SET datesaisie = $1, datevalidation = $1, libelle = $2, montant = $3, 
          compte = $4, idtiers = $5, codetiers = $6, iduser = $7
      WHERE codeop = $8 AND sence = 'D';
    `;
    await client.query(updateDebitQuery, [d, libelle, montant, idCptDebit, idtiers, codetiers, iduser, codeop]);

    // Mise à jour de la ligne CRÉDIT ('C')
    const updateCreditQuery = `
      UPDATE compta_ecriscomptadetail
      SET datesaisie = $1, datevalidation = $1, libelle = $2, montant = $3, 
          compte = $4, idtiers = $5, codetiers = $6, iduser = $7
      WHERE codeop = $8 AND sence = 'C';
    `;
    await client.query(updateCreditQuery, [d, libelle, montant, idCptCredit, idtiers, codetiers, iduser, codeop]);

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: "Opération modifiée avec succès." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur SQL lors de la modification:', err);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

*/




/*
// =========================================================================
// 1. ENREGISTRER UNE OPÉRATION COMPTABLE
// =========================================================================
router.post('/saisieoperationdiverscompta1', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      idagence, iduser, idtmvth, codjrnal, date, libelle, montant,
      idCptDebit, idCptCredit, idtiers, codetiers, idmodel
    } = req.body;

    // Validation basique
    if (!idagence || !idtmvth || !idCptDebit || !idCptCredit || !montant) {
      return res.status(400).json({ success: false, message: "Données manquantes." });
    }

    const d = new Date(date);

    // Détermination des tiers pour le Débit (Seulement si le compte commence par '4')
    const isDebitTiers = idCptDebit && idCptDebit.toString().startsWith('4');
    const finalIdTiersDebit = isDebitTiers ? idtiers : '0';
    const finalCodeTiersDebit = isDebitTiers ? codetiers : '0';

    // Détermination des tiers pour le Crédit (Seulement si le compte commence par '4')
    const isCreditTiers = idCptCredit && idCptCredit.toString().startsWith('4');
    const finalIdTiersCredit = isCreditTiers ? idtiers : '0';
    const finalCodeTiersCredit = isCreditTiers ? codetiers : '0';

    // Préparation des deux lignes (Débit et Crédit)
    const values = [];
    
    // Ligne Débit (avec ses informations de tiers conditionnelles)
    values.push(
      idtmvth, 'OPS', idagence, iduser, 0, idmodel, '', d, 
      finalIdTiersDebit, finalCodeTiersDebit, montant, libelle, idCptDebit, 'D', 0, d, idtmvth
    );
    
    // Ligne Crédit (avec ses informations de tiers conditionnelles)
    values.push(
      idtmvth, 'OPS', idagence, iduser, 0, idmodel, '', d, 
      finalIdTiersCredit, finalCodeTiersCredit, montant, libelle, idCptCredit, 'C', 0, d, idtmvth
    );

    const insertQuery = `
      INSERT INTO compta_ecriscomptadetail (
        codeop, codetypeop, idagence, iduser, idjrnal, idmodel, codemodel, 
        datesaisie, idtiers, codetiers, montant, libelle, compte, sence, 
        id_immo, datevalidation, ref_piece
      ) VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17),
      ($18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
      RETURNING id;
    `;

    await client.query('BEGIN');
    await client.query(insertQuery, values);
    await client.query('COMMIT');

    return res.status(201).json({ success: true, message: "Opération enregistrée avec succès." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur SQL:', err);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});


// =========================================================================
// 2. MODIFIER UNE OPÉRATION COMPTABLE
// =========================================================================
router.put('/saisieoperationdiverscompta1/:codeop', async (req, res) => {
  const { codeop } = req.params;
  const client = await pool.connect();

  try {
    const {
      date, libelle, montant,
      idCptDebit, idCptCredit, idtiers, codetiers, iduser
    } = req.body;

    if (!codeop || !montant || !idCptDebit || !idCptCredit) {
      return res.status(400).json({ success: false, message: "Données requises manquantes." });
    }

    const d = new Date(date);

    // Détermination des tiers pour la modification de la ligne Débit
    const isDebitTiers = idCptDebit && idCptDebit.toString().startsWith('4');
    const finalIdTiersDebit = isDebitTiers ? idtiers : '0';
    const finalCodeTiersDebit = isDebitTiers ? codetiers : '0';

    // Détermination des tiers pour la modification de la ligne Crédit
    const isCreditTiers = idCptCredit && idCptCredit.toString().startsWith('4');
    const finalIdTiersCredit = isCreditTiers ? idtiers : '0';
    const finalCodeTiersCredit = isCreditTiers ? codetiers : '0';

    await client.query('BEGIN');

    // Mise à jour de la ligne DÉBIT ('D')
    const updateDebitQuery = `
      UPDATE compta_ecriscomptadetail
      SET datesaisie = $1, datevalidation = $1, libelle = $2, montant = $3, 
          compte = $4, idtiers = $5, codetiers = $6, iduser = $7
      WHERE codeop = $8 AND sence = 'D';
    `;
    await client.query(updateDebitQuery, [
      d, libelle, montant, idCptDebit, 
      finalIdTiersDebit, finalCodeTiersDebit, iduser, codeop
    ]);

    // Mise à jour de la ligne CRÉDIT ('C')
    const updateCreditQuery = `
      UPDATE compta_ecriscomptadetail
      SET datesaisie = $1, datevalidation = $1, libelle = $2, montant = $3, 
          compte = $4, idtiers = $5, codetiers = $6, iduser = $7
      WHERE codeop = $8 AND sence = 'C';
    `;
    await client.query(updateCreditQuery, [
      d, libelle, montant, idCptCredit, 
      finalIdTiersCredit, finalCodeTiersCredit, iduser, codeop
    ]);

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: "Opération modifiée avec succès." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur SQL lors de la modification:', err);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

*/


// 1. ENREGISTRER UNE OPÉRATION COMPTABLE
// =========================================================================
router.post('/saisieoperationdiverscompta1', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      idagence, iduser, idtmvth, codjrnal, date, libelle, montant,
      idCptDebit, idCptCredit, idtiers, codetiers, idmodel
    } = req.body;

    // Validation basique (on s'assure d'avoir aussi iduser pour la caisse)
    if (!idagence || !idtmvth || !idCptDebit || !idCptCredit || !montant || !iduser) {
      return res.status(400).json({ success: false, message: "Données manquantes." });
    }

    const d = new Date(date);

    // Initialisation des comptes finaux à insérer
    let finalDebitCpt = idCptDebit;
    let finalCreditCpt = idCptCredit;

    const startsWith571Debit = idCptDebit && idCptDebit.toString().startsWith('571');
    const startsWith571Credit = idCptCredit && idCptCredit.toString().startsWith('571');

    // Récupération dynamique du compte caisse si nécessaire
    if (startsWith571Debit || startsWith571Credit) {
      const caisseRes = await client.query(
        "SELECT comptecaisse FROM caisse_utilisateur WHERE etat = 'true' AND iduser = $1",
        [iduser]
      );

      if (caisseRes.rows.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Aucun compte caisse actif trouvé pour cet utilisateur." 
        });
      }

      const compteCaisse = caisseRes.rows[0].comptecaisse;

      if (startsWith571Debit) {
        finalDebitCpt = compteCaisse;
      }
      if (startsWith571Credit) {
        finalCreditCpt = compteCaisse;
      }
    }

    // Détermination des tiers pour le Débit (Seulement si le compte commence par '4')
    const isDebitTiers = idCptDebit && idCptDebit.toString().startsWith('4');
    const finalIdTiersDebit = isDebitTiers ? idtiers : '0';
    const finalCodeTiersDebit = isDebitTiers ? codetiers : '0';

    // Détermination des tiers pour le Crédit (Seulement si le compte commence par '4')
    const isCreditTiers = idCptCredit && idCptCredit.toString().startsWith('4');
    const finalIdTiersCredit = isCreditTiers ? idtiers : '0';
    const finalCodeTiersCredit = isCreditTiers ? codetiers : '0';

    // Préparation des deux lignes (Débit et Crédit)
    const values = [];
    
    // Ligne Débit
    values.push(
      idtmvth, 'OPS', idagence, iduser, 0, idmodel, '', d, 
      finalIdTiersDebit, finalCodeTiersDebit, montant, libelle, finalDebitCpt, 'D', 0, d, idtmvth
    );
    
    // Ligne Crédit
    values.push(
      idtmvth, 'OPS', idagence, iduser, 0, idmodel, '', d, 
      finalIdTiersCredit, finalCodeTiersCredit, montant, libelle, finalCreditCpt, 'C', 0, d, idtmvth
    );

    const insertQuery = `
      INSERT INTO compta_ecriscomptadetail (
        codeop, codetypeop, idagence, iduser, idjrnal, idmodel, codemodel, 
        datesaisie, idtiers, codetiers, montant, libelle, compte, sence, 
        id_immo, datevalidation, ref_piece
      ) VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17),
      ($18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
      RETURNING id;
    `;

    await client.query('BEGIN');
    await client.query(insertQuery, values);
    await client.query('COMMIT');

    return res.status(201).json({ success: true, message: "Opération enregistrée avec succès." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur SQL:', err);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});


// =========================================================================
// 2. MODIFIER UNE OPÉRATION COMPTABLE
// =========================================================================
router.put('/saisieoperationdiverscompta1/:codeop', async (req, res) => {
  const { codeop } = req.params;
  const client = await pool.connect();

  try {
    const {
      date, libelle, montant,
      idCptDebit, idCptCredit, idtiers, codetiers, iduser
    } = req.body;

    if (!codeop || !montant || !idCptDebit || !idCptCredit || !iduser) {
      return res.status(400).json({ success: false, message: "Données requises manquantes." });
    }

    const d = new Date(date);

    // Initialisation des comptes finaux à modifier
    let finalDebitCpt = idCptDebit;
    let finalCreditCpt = idCptCredit;

    const startsWith571Debit = idCptDebit && idCptDebit.toString().startsWith('571');
    const startsWith571Credit = idCptCredit && idCptCredit.toString().startsWith('571');

    // Récupération dynamique du compte caisse si nécessaire
    if (startsWith571Debit || startsWith571Credit) {
      const caisseRes = await client.query(
        "SELECT comptecaisse FROM caisse_utilisateur WHERE etat = 'true' AND iduser = $1",
        [iduser]
      );

      if (caisseRes.rows.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Aucun compte caisse actif trouvé pour cet utilisateur." 
        });
      }

      const compteCaisse = caisseRes.rows[0].comptecaisse;

      if (startsWith571Debit) {
        finalDebitCpt = compteCaisse;
      }
      if (startsWith571Credit) {
        finalCreditCpt = compteCaisse;
      }
    }

    // Détermination des tiers pour la modification de la ligne Débit
    const isDebitTiers = idCptDebit && idCptDebit.toString().startsWith('4');
    const finalIdTiersDebit = isDebitTiers ? idtiers : '0';
    const finalCodeTiersDebit = isDebitTiers ? codetiers : '0';

    // Détermination des tiers pour la modification de la ligne Crédit
    const isCreditTiers = idCptCredit && idCptCredit.toString().startsWith('4');
    const finalIdTiersCredit = isCreditTiers ? idtiers : '0';
    const finalCodeTiersCredit = isCreditTiers ? codetiers : '0';

    await client.query('BEGIN');

    // Mise à jour de la ligne DÉBIT ('D')
    const updateDebitQuery = `
      UPDATE compta_ecriscomptadetail
      SET datesaisie = $1, datevalidation = $1, libelle = $2, montant = $3, 
          compte = $4, idtiers = $5, codetiers = $6, iduser = $7
      WHERE codeop = $8 AND sence = 'D';
    `;
    await client.query(updateDebitQuery, [
      d, libelle, montant, finalDebitCpt, 
      finalIdTiersDebit, finalCodeTiersDebit, iduser, codeop
    ]);

    // Mise à jour de la ligne CRÉDIT ('C')
    const updateCreditQuery = `
      UPDATE compta_ecriscomptadetail
      SET datesaisie = $1, datevalidation = $1, libelle = $2, montant = $3, 
          compte = $4, idtiers = $5, codetiers = $6, iduser = $7
      WHERE codeop = $8 AND sence = 'C';
    `;
    await client.query(updateCreditQuery, [
      d, libelle, montant, finalCreditCpt, 
      finalIdTiersCredit, finalCodeTiersCredit, iduser, codeop
    ]);

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: "Opération modifiée avec succès." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur SQL lors de la modification:', err);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});









// =========================================================================
// 3. SUPPRIMER UNE OPÉRATION COMPTABLE
// =========================================================================
router.delete('/saisieoperationdiverscompta1/:codeop', async (req, res) => {
  const { codeop } = req.params;
  const client = await pool.connect();

  try {
    if (!codeop) {
      return res.status(400).json({ success: false, message: "codeop manquant." });
    }

    await client.query('BEGIN');
    
    // Supprime toutes les écritures associées au codeop (débit et crédit)
    await client.query('DELETE FROM compta_ecriscomptadetail WHERE codeop = $1', [codeop]);
    
    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: "Opération supprimée avec succès." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur SQL lors de la suppression:', err);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});



///  ECRITURE  EN BLOC




// =========================================================================
// ENREGISTRER UNE GRILLE COMPTABLE COMPLEXE
// =========================================================================







// =========================================================================
// 1. LIRE / RECONSTITUER TOUTES LES LIGNES D'UNE PIÈCE COMPTABLE (TABLEAU)
// =========================================================================
router.get('/saisiegrillecomptablecomplexea/:codeop', async (req, res) => {
  const { codeop } = req.params;

  try {
    if (!codeop) {
      return res.status(400).json({ success: false, message: "Le paramètre codeop est obligatoire." });
    }

    const query = `
      SELECT 
        compte,
        libelle,
        sence,
        montant,
        idtiers,
        codetiers
      FROM compta_ecriscomptadetail
      WHERE codeop = $1
      ORDER BY id ASC;
    `;

    const result = await pool.query(query, [codeop]);

    // Formatage des lignes pour les rendre directement compatibles avec la structure Flutter
    const ecritures = result.rows.map(row => {
      const debit = row.sence === 'D' ? parseFloat(row.montant) : 0.0;
      const credit = row.sence === 'C' ? parseFloat(row.montant) : 0.0;
      return {
        compte: row.compte,
        libelle: row.libelle,
        debit: debit,
        credit: credit,
        codetiers: row.codetiers,
        idtiers: row.idtiers
      };
    });

    return res.status(200).json({
      success: true,
      data: ecritures
    });

  } catch (err) {
    console.error('❌ Erreur récupération de la pièce :', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});






// =========================================================================
// 1. ENREGISTRER UNE GRILLE COMPTABLE COMPLEXE
// =========================================================================
router.post('/saisiegrillecomptablecomplexeun', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      idmodel,         // identifiant modèle
      idagence,        // identifiant agence
      date,            // date de l'opération
      iduser,          // utilisateur
      idtmvth,         // code de la transaction / pièce
      ecritures,       // tableau des écritures transmises
      total_operation  // total débit
    } = req.body;

    // Validation des données requises
    if (
      !idagence || !idtmvth || 
      !ecritures || !Array.isArray(ecritures) || ecritures.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Les paramètres idagence, idtmvth et le tableau d'écritures sont obligatoires.",
      });
    }

    const d = date ? new Date(date) : new Date();

    // Filtrer les écritures pour ne retenir que celles avec un montant valide
    const ecrituresValides = ecritures.filter((e) => {
      const deb = parseFloat(e.debit) || 0.0;
      const cred = parseFloat(e.credit) || 0.0;
      return deb > 0 || cred > 0;
    });

    if (ecrituresValides.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Aucune écriture valide (débit ou crédit supérieur à 0) n'a été transmise.",
      });
    }

    // Préparation de la requête d'insertion multiple
    const COLUMNS_COUNT = 17;
    const values = [];

    const placeholders = ecrituresValides.map((_, i) => {
      const o = i * COLUMNS_COUNT;
      return `(
        $${o+1}, $${o+2}, $${o+3}, $${o+4}, $${o+5},
        $${o+6}, $${o+7}, $${o+8}, $${o+9}, $${o+10},
        $${o+11}, $${o+12}, $${o+13}, $${o+14}, $${o+15},
        $${o+16}, $${o+17}
      )`;
    }).join(',');

    const insertQuery = `
      INSERT INTO compta_ecriscomptadetail (
        codeop, codetypeop, idagence, iduser, idjrnal,
        idmodel, codemodel, datesaisie, idtiers, codetiers,
        montant, libelle, compte, sence, id_immo,
        datevalidation, ref_piece
      )
      VALUES ${placeholders}
      RETURNING *;
    `;

    // Remplissage des valeurs et application de la règle sur les tiers
    ecrituresValides.forEach((ecriture) => {
      const compte = ecriture.compte || '';
      const libelle = (ecriture.libelle || 'Saisie manuelle').substring(0, 100);
      
      const debit = parseFloat(ecriture.debit) || 0.0;
      const credit = parseFloat(ecriture.credit) || 0.0;

      // Détermination du montant et du sens (D / C)
      const montant = debit > 0 ? debit : credit;
      const sence = debit > 0 ? 'D' : 'C';

      // Règle de gestion : Si le compte ne commence pas par '4', idtiers est forcé à 0 et codetiers à une chaîne vide
      const commencePar4 = compte && compte.toString().trim().startsWith('4');
      const idTiers = commencePar4 && ecriture.idtiers ? parseInt(ecriture.idtiers) : 0;
      const codeTiers = commencePar4 && ecriture.codetiers ? ecriture.codetiers : '';

      values.push(
        idtmvth,                     // codeop
        'OPS',                       // codetypeop (OPS par défaut pour les opérations de caisse complexes)
        parseInt(idagence),          // idagence
        iduser || 0,                 // iduser
        0,                           // idjrnal (Par défaut 0 ou à lier au journal adéquat)
        idmodel || 0,                // idmodel
        '',                          // codemodel
        d,                           // datesaisie
        idTiers,                     // idtiers
        codeTiers,                   // codetiers
        montant,                     // montant
        libelle,                     // libelle
        compte,                      // compte
        sence,                       // sence
        0,                           // id_immo (Par défaut 0)
        d,                           // datevalidation
        idtmvth                      // ref_piece (Utilise le code de la pièce/transaction)
      );
    });

    await client.query('BEGIN');
    const result = await client.query(insertQuery, values);
    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: "Écritures de la grille enregistrées dans compta_ecriscomptadetail.",
      count: result.rowCount,
      data: result.rows,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERREUR INSERTION GRILLE COMPTABLE :', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// =========================================================================
// 2. MODIFIER TOUTES LES LIGNES OU SUPPRIMER SI LE TABLEAU EST VIDE
// =========================================================================
router.put('/saisiegrillecomptablecomplexea/:codeop', async (req, res) => {
  const { codeop } = req.params;
  const { idagence, date, iduser, ecritures, idmodel } = req.body;
  const client = await pool.connect();

  try {
    if (!codeop || !idagence) {
      return res.status(400).json({ success: false, message: "Les paramètres codeop et idagence sont obligatoires." });
    }

    await client.query('BEGIN');

    // 1. Filtrer les écritures valides (celles ayant au moins un montant débit ou crédit > 0)
    const ecrituresValides = (ecritures || []).filter(e => {
      const deb = parseFloat(e.debit) || 0.0;
      const cred = parseFloat(e.credit) || 0.0;
      return deb > 0 || cred > 0;
    });

    // 2. RÈGLE DE GESTION : Si toutes les lignes sont vides -> Suppression complète de la pièce
    if (ecrituresValides.length === 0) {
      const deleteQuery = `DELETE FROM compta_ecriscomptadetail WHERE codeop = $1;`;
      await client.query(deleteQuery, [codeop]);
      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: "Toutes les écritures étaient vides ou nulles. La pièce comptable a été supprimée.",
        deleted: true
      });
    }

    // 3. Sinon, on procède à la modification complète de la pièce (Nettoyage + Réinsertion)
    // Étape A : On supprime d'abord les anciennes lignes associées à ce codeop
    await client.query('DELETE FROM compta_ecriscomptadetail WHERE codeop = $1;', [codeop]);

    // Étape B : Insertion des nouvelles lignes dans la table
    const d = date ? new Date(date) : new Date();
    const COLUMNS_COUNT = 17;
    const values = [];

    const placeholders = ecrituresValides.map((_, i) => {
      const o = i * COLUMNS_COUNT;
      return `(
        $${o+1}, $${o+2}, $${o+3}, $${o+4}, $${o+5},
        $${o+6}, $${o+7}, $${o+8}, $${o+9}, $${o+10},
        $${o+11}, $${o+12}, $${o+13}, $${o+14}, $${o+15},
        $${o+16}, $${o+17}
      )`;
    }).join(',');

    const insertQuery = `
      INSERT INTO compta_ecriscomptadetail (
        codeop, codetypeop, idagence, iduser, idjrnal,
        idmodel, codemodel, datesaisie, idtiers, codetiers,
        montant, libelle, compte, sence, id_immo,
        datevalidation, ref_piece
      )
      VALUES ${placeholders};
    `;

    ecrituresValides.forEach((ecriture) => {
      const compte = ecriture.compte || '';
      const libelle = (ecriture.libelle || 'Saisie manuelle').substring(0, 100);
      
      const debit = parseFloat(ecriture.debit) || 0.0;
      const credit = parseFloat(ecriture.credit) || 0.0;

      // Détermination du montant positif final et de sa direction
      const montant = debit > 0 ? debit : credit;
      const sence = debit > 0 ? 'D' : 'C';

      // Règle de gestion : Si le compte ne commence pas par '4', idtiers est forcé à 0 et codetiers à une chaîne vide
      const commencePar4 = compte && compte.toString().trim().startsWith('4');
      const idTiers = commencePar4 && ecriture.idtiers ? parseInt(ecriture.idtiers) : 0;
      const codeTiers = commencePar4 && ecriture.codetiers ? ecriture.codetiers : '';

      values.push(
        codeop,                      // codeop
        'OPS',                       // codetypeop
        parseInt(idagence),          // idagence
        iduser || 0,                 // iduser
        0,                           // idjrnal (Par défaut 0)
        idmodel || 0,                // idmodel
        '',                          // codemodel
        d,                           // datesaisie
        idTiers,                     // idtiers
        codeTiers,                   // codetiers
        montant,                     // montant
        libelle,                     // libelle
        compte,                      // compte
        sence,                       // sence
        0,                           // id_immo
        d,                           // datevalidation
        codeop                       // ref_piece
      );
    });

    await client.query(insertQuery, values);
    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: "Pièce comptable mise à jour avec succès.",
      deleted: false,
      count: ecrituresValides.length
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de la mise à jour de la grille :', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});


/*

router.post('/saisiegrillecomptablecomplexeun', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      idmodel,         // identifiant modèle
      idagence,        // identifiant agence
      date,            // date de l'opération
      iduser,          // utilisateur
      idtmvth,         // code de la transaction / pièce
      ecritures,       // tableau des écritures transmises
      total_operation  // total débit
    } = req.body;

    // Validation des données requises
    if (
      !idagence || !idtmvth || 
      !ecritures || !Array.isArray(ecritures) || ecritures.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Les paramètres idagence, idtmvth et le tableau d'écritures sont obligatoires.",
      });
    }

    const d = date ? new Date(date) : new Date();

    // Filtrer les écritures pour ne retenir que celles avec un montant valide
    const ecrituresValides = ecritures.filter((e) => {
      const deb = parseFloat(e.debit) || 0.0;
      const cred = parseFloat(e.credit) || 0.0;
      return deb > 0 || cred > 0;
    });

    if (ecrituresValides.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Aucune écriture valide (débit ou crédit supérieur à 0) n'a été transmise.",
      });
    }

    // Préparation de la requête d'insertion multiple
    const COLUMNS_COUNT = 17;
    const values = [];

    const placeholders = ecrituresValides.map((_, i) => {
      const o = i * COLUMNS_COUNT;
      return `(
        $${o+1}, $${o+2}, $${o+3}, $${o+4}, $${o+5},
        $${o+6}, $${o+7}, $${o+8}, $${o+9}, $${o+10},
        $${o+11}, $${o+12}, $${o+13}, $${o+14}, $${o+15},
        $${o+16}, $${o+17}
      )`;
    }).join(',');

    const insertQuery = `
      INSERT INTO compta_ecriscomptadetail (
        codeop, codetypeop, idagence, iduser, idjrnal,
        idmodel, codemodel, datesaisie, idtiers, codetiers,
        montant, libelle, compte, sence, id_immo,
        datevalidation, ref_piece
      )
      VALUES ${placeholders}
      RETURNING *;
    `;

    // Remplissage des valeurs et application de la règle sur les tiers
    ecrituresValides.forEach((ecriture) => {
      const compte = ecriture.compte || '';
      const libelle = (ecriture.libelle || 'Saisie manuelle').substring(0, 100);
      
      const debit = parseFloat(ecriture.debit) || 0.0;
      const credit = parseFloat(ecriture.credit) || 0.0;

      // Détermination du montant et du sens (D / C)
      const montant = debit > 0 ? debit : credit;
      const sence = debit > 0 ? 'D' : 'C';

      // Règle de gestion : Si le compte ne commence pas par '4', idtiers et codetiers sont forcés à 0
      const commencePar4 = compte && compte.toString().trim().startsWith('4');
      const idTiers = commencePar4 && ecriture.idtiers ? parseInt(ecriture.idtiers) : 0;
      const codeTiers = commencePar4 && ecriture.codetiers ? ecriture.codetiers : '0';

      values.push(
        idtmvth,                     // codeop
        'OPS',                       // codetypeop (OPS par défaut pour les opérations de caisse complexes)
        parseInt(idagence),          // idagence
        iduser || 0,                 // iduser
        0,                           // idjrnal (Par défaut 0 ou à lier au journal adéquat)
        idmodel || 0,                // idmodel
        '',                          // codemodel
        d,                           // datesaisie
        idTiers,                     // idtiers
        codeTiers,                   // codetiers
        montant,                     // montant
        libelle,                     // libelle
        compte,                      // compte
        sence,                       // sence
        0,                           // id_immo (Par défaut 0)
        d,                           // datevalidation
        idtmvth                      // ref_piece (Utilise le code de la pièce/transaction)
      );
    });

    await client.query('BEGIN');
    const result = await client.query(insertQuery, values);
    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: "Écritures de la grille enregistrées dans compta_ecriscomptadetail.",
      count: result.rowCount,
      data: result.rows,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERREUR INSERTION GRILLE COMPTABLE :', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// =========================================================================
// 2. MODIFIER TOUTES LES LIGNES OU SUPPRIMER SI LE TABLEAU EST VIDE
// =========================================================================
router.put('/saisiegrillecomptablecomplexea/:codeop', async (req, res) => {
  const { codeop } = req.params;
  const { idagence, date, iduser, ecritures, idmodel } = req.body;
  const client = await pool.connect();

  try {
    if (!codeop || !idagence) {
      return res.status(400).json({ success: false, message: "Les paramètres codeop et idagence sont obligatoires." });
    }

    await client.query('BEGIN');

    // 1. Filtrer les écritures valides (celles ayant au moins un montant débit ou crédit > 0)
    const ecrituresValides = (ecritures || []).filter(e => {
      const deb = parseFloat(e.debit) || 0.0;
      const cred = parseFloat(e.credit) || 0.0;
      return deb > 0 || cred > 0;
    });

    // 2. RÈGLE DE GESTION : Si toutes les lignes sont vides -> Suppression complète de la pièce
    if (ecrituresValides.length === 0) {
      const deleteQuery = `DELETE FROM compta_ecriscomptadetail WHERE codeop = $1;`;
      await client.query(deleteQuery, [codeop]);
      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: "Toutes les écritures étaient vides ou nulles. La pièce comptable a été supprimée.",
        deleted: true
      });
    }

    // 3. Sinon, on procède à la modification complète de la pièce (Nettoyage + Réinsertion)
    // Étape A : On supprime d'abord les anciennes lignes associées à ce codeop
    await client.query('DELETE FROM compta_ecriscomptadetail WHERE codeop = $1;', [codeop]);

    // Étape B : Insertion des nouvelles lignes dans la table
    const d = date ? new Date(date) : new Date();
    const COLUMNS_COUNT = 17;
    const values = [];

    const placeholders = ecrituresValides.map((_, i) => {
      const o = i * COLUMNS_COUNT;
      return `(
        $${o+1}, $${o+2}, $${o+3}, $${o+4}, $${o+5},
        $${o+6}, $${o+7}, $${o+8}, $${o+9}, $${o+10},
        $${o+11}, $${o+12}, $${o+13}, $${o+14}, $${o+15},
        $${o+16}, $${o+17}
      )`;
    }).join(',');

    const insertQuery = `
      INSERT INTO compta_ecriscomptadetail (
        codeop, codetypeop, idagence, iduser, idjrnal,
        idmodel, codemodel, datesaisie, idtiers, codetiers,
        montant, libelle, compte, sence, id_immo,
        datevalidation, ref_piece
      )
      VALUES ${placeholders};
    `;

    ecrituresValides.forEach((ecriture) => {
      const compte = ecriture.compte || '';
      const libelle = (ecriture.libelle || 'Saisie manuelle').substring(0, 100);
      
      const debit = parseFloat(ecriture.debit) || 0.0;
      const credit = parseFloat(ecriture.credit) || 0.0;

      // Détermination du montant positif final et de sa direction
      const montant = debit > 0 ? debit : credit;
      const sence = debit > 0 ? 'D' : 'C';

      // Règle de gestion : Si le compte ne commence pas par '4', idtiers et codetiers sont forcés à 0
      const commencePar4 = compte && compte.toString().trim().startsWith('4');
      const idTiers = commencePar4 && ecriture.idtiers ? parseInt(ecriture.idtiers) : 0;
      const codeTiers = commencePar4 && ecriture.codetiers ? ecriture.codetiers : '0';

      values.push(
        codeop,                      // codeop
        'OPS',                       // codetypeop
        parseInt(idagence),          // idagence
        iduser || 0,                 // iduser
        0,                           // idjrnal (Par défaut 0)
        idmodel || 0,                // idmodel
        '',                          // codemodel
        d,                           // datesaisie
        idTiers,                     // idtiers
        codeTiers,                   // codetiers
        montant,                     // montant
        libelle,                     // libelle
        compte,                      // compte
        sence,                       // sence
        0,                           // id_immo
        d,                           // datevalidation
        codeop                       // ref_piece
      );
    });

    await client.query(insertQuery, values);
    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: "Pièce comptable mise à jour avec succès.",
      deleted: false,
      count: ecrituresValides.length
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de la mise à jour de la grille :', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

*/





/**
 * POST /api/saisieoperationdiverscompta
 * Gère l'insertion multi-lignes basée sur les comptes choisis dans le widget de saisie
 */

/*
router.post('/saisieoperationdiverscompta', async (req, res) => {
  const client = await pool.connect();

  try {
    const { 
      idmodel, 
      idagence, 
      date, 
      iduser, 
      montant, 
      libelle, 
      idtmvth,
      idmois, 
      idannee,
      idCptDebit,      // Reçu de Flutter
      idCptCredit,     // Reçu de Flutter
      idtiers,         // Reçu de Flutter (id numérique du tiers pour idclient)
      codetiers        // Reçu de Flutter (code texte pour REFTIERS et IDTIERS)
    } = req.body;

    if (!idmodel || !idagence || !idtmvth || !idCptDebit || !idCptCredit) {
      return res.status(400).json({
        success: false,
        message: "Les paramètres idmodel, idagence, idtmvth, idCptDebit et idCptCredit sont obligatoires."
      });
    }

    await client.query('BEGIN');

    // 1. Charger la configuration globale du modèle pour obtenir le codejrnl ET l'idjournal d'origine
    const modelQuery = `
      SELECT codejrnl, idjournal FROM fina_model 
      WHERE idagence = $1 AND idmodel = $2
    `;
    const modelResult = await client.query(modelQuery, [idagence, idmodel]);

    if (modelResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Modèle de configuration introuvable." });
    }

    const codeJournal = modelResult.rows[0].codejrnl || 'DIV';
    const idJournalBase = modelResult.rows[0].idjournal || 0;

    const d = date ? new Date(date) : new Date();
    const finalMois = idmois || (d.getMonth() + 1);
    const finalAnnee = idannee || d.getFullYear();
    const montantFinal = parseFloat(montant) || 0;

    // 2. Définition des deux lignes comptables (Débit et Crédit)
    const configurations = [
      { compte: idCptDebit, debit: montantFinal, credit: 0, num: 1 },
      { compte: idCptCredit, debit: 0, credit: montantFinal, num: 2 }
    ];

    const COLUMNS_COUNT = 17; // Fixé à 17 colonnes dDésormais

    // 3. Construction de l'insertion globale dynamique (i * 17)
    const insertQuery = `
      INSERT INTO tmvttheorique (
        idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      VALUES 
      ${configurations.map((_, i) => `
        (
          $${i * COLUMNS_COUNT + 1}, $${i * COLUMNS_COUNT + 2}, $${i * COLUMNS_COUNT + 3}, $${i * COLUMNS_COUNT + 4}, 
          $${i * COLUMNS_COUNT + 5}, $${i * COLUMNS_COUNT + 6}, $${i * COLUMNS_COUNT + 7}, $${i * COLUMNS_COUNT + 8}, 
          $${i * COLUMNS_COUNT + 9}, $${i * COLUMNS_COUNT + 10}, $${i * COLUMNS_COUNT + 11}, $${i * COLUMNS_COUNT + 12},
          $${i * COLUMNS_COUNT + 13}, $${i * COLUMNS_COUNT + 14}, $${i * COLUMNS_COUNT + 15}, $${i * COLUMNS_COUNT + 16},
          $${i * COLUMNS_COUNT + 17}
        )
      `).join(',')}
      RETURNING *
    `;

    const values = [];
    configurations.forEach((cfg) => {
      values.push(
        idtmvth,                                         // $1  - idtmvth
        d,                                               // $2  - date
        codeJournal,                                     // $3  - CODJRL
        cfg.compte,                                      // $4  - IDCPTGN
        codetiers || '0',                                // $5  - IDTIERS
        (libelle || 'Saisie Caisse').substring(0, 100),  // $6  - LIBELLE
        cfg.debit,                                       // $7  - MONTANTDEBIT
        cfg.credit,                                      // $8  - MONTANTCREDIT
        iduser || 0,                                     // $9  - IDUSER
        finalMois,                                       // $10 - IDMOIS
        finalAnnee,                                      // $11 - IDANNEE
        idtmvth,                                         // $12 - CODFACT
        codetiers || null,                               // $13 - REFTIERS
        idagence,                                        // $14 - idagence
        idJournalBase,                                   // $15 - idjrnal (Récupéré dynamiquement depuis le modèle)
        0,                                               // $16 - idmouvement
        idtiers || null                                  // $17 - idclient
      );
    });

    const result = await client.query(insertQuery, values);
    await client.query('COMMIT');

    res.status(201).json({ 
      success: true, 
      message: "Saisie d'opération enregistrée avec succès",
      data: result.rows 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ ERREUR SERVEUR SQL:", err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});
*/
router.post('/saisieoperationdiverscompta', async (req, res) => {
  const client = await pool.connect();

  try {
    const { 
      idmodel, 
      idagence, 
      date, 
      iduser, 
      montant, 
      libelle, 
      idtmvth,
      idmois, 
      idannee,
      idCptDebit,      // Reçu de Flutter
      idCptCredit,     // Reçu de Flutter
      idtiers,         // ID numérique du tiers (ex: "9" ou "28")
      codetiers        // Code texte du tiers (ex: "TGS001A00400001")
    } = req.body;

    if (!idmodel || !idagence || !idtmvth || !idCptDebit || !idCptCredit) {
      return res.status(400).json({
        success: false,
        message: "Les paramètres idmodel, idagence, idtmvth, idCptDebit et idCptCredit sont obligatoires."
      });
    }

    await client.query('BEGIN');

    // 1. Charger la configuration globale du modèle pour obtenir le codejrnl et l'idjournal d'origine
    const modelQuery = `
      SELECT m.codejrnl, m.idjournal, op.comptegeneral 
      FROM fina_model m
      LEFT JOIN fina_modeloperation op ON m.idmodel = op.idmodel
      WHERE m.idagence = $1 AND m.idmodel = $2
    `;
    const modelResult = await client.query(modelQuery, [idagence, idmodel]);

    if (modelResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Modèle de configuration introuvable." });
    }

    const codeJournal = modelResult.rows[0].codejrnl || 'DIV';
    const idJournalBase = modelResult.rows[0].idjournal || 0;

    const d = date ? new Date(date) : new Date();
    const finalMois = idmois || (d.getMonth() + 1);
    const finalAnnee = idannee || d.getFullYear();
    const montantFinal = parseFloat(montant) || 0;

    // 2. Définition des deux lignes comptables (Débit et Crédit)
    const configurations = [
      { compte: idCptDebit, debit: montantFinal, credit: 0, num: 1 },
      { compte: idCptCredit, debit: 0, credit: montantFinal, num: 2 }
    ];

    const COLUMNS_COUNT = 17; // Fixé à 17 colonnes

    const insertQuery = `
      INSERT INTO tmvttheorique (
        idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      VALUES 
      ${configurations.map((_, i) => `
        (
          $${i * COLUMNS_COUNT + 1}, $${i * COLUMNS_COUNT + 2}, $${i * COLUMNS_COUNT + 3}, $${i * COLUMNS_COUNT + 4}, 
          $${i * COLUMNS_COUNT + 5}, $${i * COLUMNS_COUNT + 6}, $${i * COLUMNS_COUNT + 7}, $${i * COLUMNS_COUNT + 8}, 
          $${i * COLUMNS_COUNT + 9}, $${i * COLUMNS_COUNT + 10}, $${i * COLUMNS_COUNT + 11}, $${i * COLUMNS_COUNT + 12},
          $${i * COLUMNS_COUNT + 13}, $${i * COLUMNS_COUNT + 14}, $${i * COLUMNS_COUNT + 15}, $${i * COLUMNS_COUNT + 16},
          $${i * COLUMNS_COUNT + 17}
        )
      `).join(',')}
      RETURNING *
    `;

    const values = [];
    configurations.forEach((cfg) => {
      
      // 💡 CORRECTION STRATÉGIQUE : Extraction du préfixe à 3 chiffres (ex: "411", "409", "571")
      const prefix = cfg.compte.substring(0, 3);
      
      // Un compte est considéré comme collectif/tiers s'il commence par 411, 401, 409 ou 404
      const isCompteTiers = prefix === '411' || prefix === '401' || prefix === '409'  || prefix === '419' || prefix === '404';

      // Si la ligne traite un compte tiers, on applique les données de Flutter. Sinon, on force le nettoyage (0 / null)
      const finalIDTIERS   = isCompteTiers ? (codetiers || '0') : '0';
      const finalREFTIERS  = isCompteTiers ? (codetiers || null) : null;
      const finalIDCLIENT  = isCompteTiers ? (idtiers || null) : null;

      values.push(
        idtmvth,                                         // $1  - idtmvth
        d,                                               // $2  - date
        codeJournal,                                     // $3  - CODJRL
        cfg.compte,                                      // $4  - IDCPTGN
        finalIDTIERS,                                    // $5  - IDTIERS
        (libelle || 'Saisie Caisse').substring(0, 100),  // $6  - LIBELLE
        cfg.debit,                                       // $7  - MONTANTDEBIT
        cfg.credit,                                      // $8  - MONTANTCREDIT
        iduser || 0,                                     // $9  - IDUSER
        finalMois,                                       // $10 - IDMOIS
        finalAnnee,                                      // $11 - IDANNEE
        idtmvth,                                         // $12 - CODFACT
        finalREFTIERS,                                   // $13 - REFTIERS
        idagence,                                        // $14 - idagence
        idJournalBase,                                   // $15 - idjrnal
        0,                                               // $16 - idmouvement
        finalIDCLIENT                                    // $17 - idclient
      );
    });

    const result = await client.query(insertQuery, values);
    await client.query('COMMIT');

    res.status(201).json({ 
      success: true, 
      message: "Saisie d'opération enregistrée avec succès",
      data: result.rows 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ ERREUR SERVEUR SQL:", err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});










/**
 * POST /api/saisiegrillecomptablecomplexe
 * Gère l'insertion multi-lignes dynamique (de 2 à 100+ lignes) à partir du tableau d'édition Flutter
 */
router.post('/saisiegrillecomptablecomplexe', async (req, res) => {
  const client = await pool.connect();

  try {
    const { 
      idmodel, 
      idagence, 
      date, 
      iduser, 
      idtmvth,
      ecritures, // Tableau de lignes envoyé par la grille Flutter
      total_operation
    } = req.body;

    // Validation des données obligatoires globales
    if (!idmodel || !idagence || !idtmvth || !ecritures || !Array.isArray(ecritures) || ecritures.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Les paramètres idmodel, idagence, idtmvth et le tableau d'écritures sont obligatoires."
      });
    }

    await client.query('BEGIN');

    // 1. Récupération des informations du journal liées au modèle
    const modelQuery = `
      SELECT codejrnl, idjournal FROM fina_model 
      WHERE idagence = $1 AND idmodel = $2
    `;
    const modelResult = await client.query(modelQuery, [idagence, idmodel]);

    if (modelResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Modèle de configuration introuvable." });
    }

    const codeJournal = modelResult.rows[0].codejrnl || 'DIV';
    const idJournalBase = modelResult.rows[0].idjournal || 0;

    const d = date ? new Date(date) : new Date();
    const finalMois = d.getMonth() + 1;
    const finalAnnee = d.getFullYear();

    const COLUMNS_COUNT = 17; // Nombre de paramètres par ligne d'écriture SQL
    const values = [];

    // 2. Génération dynamique de la chaîne d'insertion multi-lignes SQL ($1, $2, ...)
    const placeholders = ecritures.map((_, i) => {
      const offset = i * COLUMNS_COUNT;
      return `(
        $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, 
        $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, 
        $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12},
        $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16},
        $${offset + 17}
      )`;
    }).join(',');

    const insertQuery = `
      INSERT INTO tmvttheorique (
        idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      VALUES ${placeholders}
      RETURNING *
    `;

    // 3. Remplissage séquentiel des valeurs pour chaque ligne de la grille d'édition
    ecritures.forEach((ecriture) => {
      const compte = ecriture.compte || '';
      const libelleEcriture = ecriture.libelle || 'Saisie Ligne Caisse';
      const debit = parseFloat(ecriture.debit) || 0.0;
      const credit = parseFloat(ecriture.credit) || 0.0;
      const codeTiers = ecriture.codetiers || '0';
      const idTiers = ecriture.idtiers ? parseInt(ecriture.idtiers) : null;

      values.push(
        idtmvth,                                         // $1  - Unique pour l'ensemble du lot (N° pièce)
        d,                                               // $2  - Date d'opération
        codeJournal,                                     // $3  - CODJRL
        compte,                                          // $4  - IDCPTGN (Compte édité)
        codeTiers,                                       // $5  - IDTIERS
        libelleEcriture.substring(0, 100),               // $6  - LIBELLE de la ligne
        debit,                                           // $7  - MONTANTDEBIT
        credit,                                          // $8  - MONTANTCREDIT
        iduser || 0,                                     // $9  - IDUSER
        finalMois,                                       // $10 - IDMOIS
        finalAnnee,                                      // $11 - IDANNEE
        idtmvth,                                         // $12 - CODFACT
        ecriture.codetiers ? ecriture.codetiers : null,  // $13 - REFTIERS
        parseInt(idagence),                              // $14 - idagence
        idJournalBase,                                   // $15 - idjrnal
        0,                                               // $16 - idmouvement
        idTiers                                          // $17 - idclient (Identifiant numérique lié)
      );
    });

    // 4. Exécution de la transaction globale en base de données
    const result = await client.query(insertQuery, values);
    await client.query('COMMIT');

    res.status(201).json({ 
      success: true, 
      message: "Grille d'écritures comptables enregistrée avec succès",
      count: result.rowCount,
      data: result.rows 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ ERREUR SERVEUR SUR INSERTION GRILLE COMPTABLE:", err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});









////   PARTIE  MISE  A JOURS






/**
 * GET /api/mouvements-caisse-historique
 * Récupère les écritures groupées par idtmvth entre deux dates distinctes
 */
router.get('/mouvements-caisse-historique', async (req, res) => {
  try {
    const { idagence, datedebut, datefin } = req.query;

    if (!idagence || !datedebut || !datefin) {
      return res.status(400).json({
        success: false,
        message: "Les paramètres idagence, datedebut et datefin sont requis."
      });
    }

    // Requête SQL groupant par idtmvth avec agrégation des informations clés
    const query = `
      SELECT 
        tmvt.idtmvth,
        MAX(tmvt.date) as date_operation,
        MAX(tmvt.codjrl) as codjrl,
        MAX(tmvt.libelle) as libelle_principal,
        SUM(tmvt.montantdebit) as total_debit,
        SUM(tmvt.montantcredit) as total_credit,
        MAX(tcin.nomtiers) as nomtiers
      FROM tmvttheorique AS tmvt
      LEFT JOIN tcomptegeninter AS tcin ON tmvt.idcptgn = tcin.idcptintern
      WHERE tmvt.idagence = $1 AND tmvt.date >= $2 AND tmvt.date <= $3
      GROUP BY tmvt.idtmvth
      ORDER BY date_operation DESC
    `;

    const result = await pool.query(query, [idagence, datedebut, datefin]);

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error("❌ Erreur historique:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/mouvement-detail/:idtmvth
 * Récupère toutes les lignes d'une opération spécifique pour modification
 */
router.get('/mouvement-detail/:idtmvth', async (req, res) => {
  try {
    const { idtmvth } = req.params;
    const { idagence } = req.query;

    const query = `
      SELECT 
        tmvt.idmvts,
        tmvt.idtmvth,
        tmvt.date,
        tmvt.codjrl,
        tmvt.idcptgn,
        tmvt.idtiers,
        tmvt.libelle,
        tmvt.montantdebit,
        tmvt.montantcredit,
        tmvt.iduser,
        tmvt.idmois,
        tmvt.idannee,
        tmvt.codfact,
        tmvt.reftiers,
        tmvt.idagence,
        tmvt.idjrnal,
        tmvt.idmouvement,
        tmvt.idclient,
        tcin.designationcptint,
        tcin.nomtiers
      FROM tmvttheorique AS tmvt
      JOIN tcomptegeninter AS tcin ON tmvt.idcptgn = tcin.idcptintern
      WHERE tmvt.idagence = $1 AND tmvt.idtmvth = $2
      ORDER BY tmvt.idmvts ASC
    `;

    const result = await pool.query(query, [idagence, idtmvth]);

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error("❌ Erreur détails pièce:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});




/**
 * PUT /api/modifiergrillecomptablecomplexe/:idtmvth
 * Applique la mise à jour d'une pièce comptable en supprimant l'ancien lot et réinsérant la nouvelle grille éditée
 */
router.put('/modifiergrillecomptablecomplexe/:idtmvth', async (req, res) => {
  const client = await pool.connect();
  const { idtmvth } = req.params;

  try {
    const { 
      idmodel, 
      idagence, 
      iduser, 
      ecritures,
      date
    } = req.body;

    if (!idagence || !ecritures || !Array.isArray(ecritures) || ecritures.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Les paramètres idagence et le tableau d'écritures modifié sont obligatoires."
      });
    }

    await client.query('BEGIN');

    // 1. Récupération des données du journal d'origine (IDJRNAL et CODJRL)
    // On priorise la recherche depuis le modèle, sinon on prend une valeur par défaut
    let codeJournal = 'DIV';
    let idJournalBase = 0;
    
    if (idmodel && idmodel !== '0') {
      const modelResult = await client.query(
        `SELECT codejrnl, idjournal FROM fina_model WHERE idagence = $1 AND idmodel = $2`, 
        [idagence, idmodel]
      );
      if (modelResult.rows.length > 0) {
        codeJournal = modelResult.rows[0].codejrnl || 'DIV';
        idJournalBase = modelResult.rows[0].idjournal || 0;
      }
    } else {
      // Si idmodel vaut '0' (hors modèle standard), on récupère les infos de l'ancienne pièce avant de purger
      const oldPieceResult = await client.query(
        `SELECT CODJRL, idjrnal FROM tmvttheorique WHERE idagence = $1 AND idtmvth = $2 LIMIT 1`,
        [idagence, idtmvth]
      );
      if (oldPieceResult.rows.length > 0) {
        codeJournal = oldPieceResult.rows[0].codjrl || 'DIV';
        idJournalBase = oldPieceResult.rows[0].idjrnal || 0;
      }
    }

    // 2. Suppression (Purge) des anciennes écritures associées à cette pièce unique
    await client.query(
      `DELETE FROM tmvttheorique WHERE idagence = $1 AND idtmvth = $2`,
      [idagence, idtmvth]
    );

    // 3. Préparation de la réinsertion dynamique du nouveau lot modifié

    console.log("================================");
console.log("date =", date);
console.log("type =", typeof date);

const d = new Date(date);

console.log("date convertie =", d);
console.log("getTime =", d.getTime());

if (isNaN(d.getTime())) {
    throw new Error(`Date invalide reçue : ${date}`);
}





     ///const d = new Date(date);
    const finalMois = d.getMonth() + 1;
    const finalAnnee = d.getFullYear();
    const COLUMNS_COUNT = 17;

    const placeholders = ecritures.map((_, i) => {
      const offset = i * COLUMNS_COUNT;
      return `(
        $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, 
        $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, 
        $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12},
        $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16},
        $${offset + 17}
      )`;
    }).join(',');

    const insertQuery = `
      INSERT INTO tmvttheorique (
        idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      VALUES ${placeholders}
      RETURNING *
    `;

    const values = [];
    ecritures.forEach((ecriture) => {
      const compte = ecriture.compte || '';
      const libelleEcriture = ecriture.libelle || 'Saisie Ligne Caisse (Modifiée)';
      const debit = parseFloat(ecriture.debit) || 0.0;
      const credit = parseFloat(ecriture.credit) || 0.0;
      const codeTiers = ecriture.codetiers || '0';
      const idTiers = ecriture.idtiers ? parseInt(ecriture.idtiers) : null;

      values.push(
        idtmvth,                                         // $1  - Conserve le même N° de pièce d'origine
        d,                                               // $2  - Date de mise à jour
        codeJournal,                                     // $3  - CODJRL
        compte,                                          // $4  - IDCPTGN (Nouveau compte édité)
        codeTiers,                                       // $5  - IDTIERS
        libelleEcriture.substring(0, 100),               // $6  - LIBELLE
        debit,                                           // $7  - MONTANTDEBIT
        credit,                                          // $8  - MONTANTCREDIT
        iduser || 0,                                     // $9  - IDUSER
        finalMois,                                       // $10 - IDMOIS
        finalAnnee,                                      // $11 - IDANNEE
        idtmvth,                                         // $12 - CODFACT
        ecriture.codetiers ? ecriture.codetiers : null,  // $13 - REFTIERS
        parseInt(idagence),                              // $14 - idagence
        idJournalBase,                                   // $15 - idjrnal
        0,                                               // $16 - idmouvement
        idTiers                                          // $17 - idclient
      );
    });

    const result = await client.query(insertQuery, values);
    await client.query('COMMIT');

    res.status(200).json({ 
      success: true, 
      message: "Pièce comptable mise à jour avec succès",
      count: result.rowCount,
      data: result.rows 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ ERREUR LORS DE LA MISE À JOUR DE LA PIÈCE:", err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});



///  SOLDE COMPTE



router.get('/soldecompteoper/:idcptgn/:idagence', async (req, res) => {
    try {
        const { idcptgn, idagence } = req.params;

        // On utilise CASE pour choisir le sens du calcul selon les 3 premiers chiffres
        const query = `
            SELECT 
                CASE 
                    WHEN idcptgn::TEXT LIKE '411%' 
                      OR idcptgn::TEXT LIKE '571%' 
                      OR idcptgn::TEXT LIKE '409%' 
                    THEN COALESCE(SUM(montantdebit), 0) - COALESCE(SUM(montantcredit), 0)
                    
                    WHEN idcptgn::TEXT LIKE '401%' 
                      OR idcptgn::TEXT LIKE '419%' 
                    THEN COALESCE(SUM(montantcredit), 0) - COALESCE(SUM(montantdebit), 0)
                    
                    ELSE COALESCE(SUM(montantcredit), 0) - COALESCE(SUM(montantdebit), 0)
                END AS soldecompte
            FROM tmvttheorique
            WHERE idcptgn = $1
            AND idagence = $2
            GROUP BY idcptgn
        `;

        const result = await pool.query(query, [idcptgn, idagence]);

        // Vérification si une ligne a été retournée (sinon le solde est 0)
        const solde = result.rows.length > 0 ? result.rows[0].soldecompte : 0;

        res.status(200).json({
            success: true,
            idcptgn: idcptgn,
            idagence: idagence,
            soldecompte: solde
        });

    } catch (error) {
        console.error('Erreur récupération solde compte :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});



module.exports = router;