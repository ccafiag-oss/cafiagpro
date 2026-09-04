const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * POST /saisieoperationdivers
 * Gère l'insertion multi-lignes basée sur un modèle comptable
 */
router.post('/saisieoperationdivers', async (req, res) => {
  const client = await pool.connect();

  try {
    // 1. Récupération des données envoyées par Flutter
    const { 
      idmodel, 
      idagence, 
      date, 
      iduser, 
      montant, 
      libelle, 
      idtmvth,
      idmois, // Reçu de Flutter
      idannee // Reçu de Flutter
    } = req.body;

    // Validation de sécurité
    if (!idmodel || !idagence || !idtmvth) {
      return res.status(400).json({
        success: false,
        message: "idmodel, idagence et idtmvth sont obligatoires."
      });
    }

    await client.query('BEGIN');

    // 2. Charger la configuration du modèle (comptes, sens, etc.)
    const modelQuery = `
      SELECT ml.codejrnl, mlo.compte, mlo.idtiers, mlo.sensoperation
      FROM fina_model ml
      INNER JOIN fina_modeloperation mlo ON mlo.idmodel = ml.idmodel
      WHERE ml.idagence = $1 AND ml.idmodel = $2
      ORDER BY mlo.numeroligne
    `;
    const modelResult = await client.query(modelQuery, [idagence, idmodel]);

    if (modelResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Modèle introuvable." });
    }

    // 3. Préparation des dates et périodes
    const d = date ? new Date(date) : new Date();
    // Priorité aux valeurs de Flutter, sinon calcul automatique
    const finalMois = idmois || (d.getMonth() + 1);
    const finalAnnee = idannee || d.getFullYear();

    const lignesConfig = modelResult.rows;

    // 4. Construction de la requête INSERT (14 colonnes)
    const insertQuery = `
      INSERT INTO tmvttheorique (
        idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence
      )
      VALUES 
      ${lignesConfig.map((_, i) => `
        (
          $${i * 14 + 1}, $${i * 14 + 2}, $${i * 14 + 3}, $${i * 14 + 4}, 
          $${i * 14 + 5}, $${i * 14 + 6}, $${i * 14 + 7}, $${i * 14 + 8}, 
          $${i * 14 + 9}, $${i * 14 + 10}, $${i * 14 + 11}, $${i * 14 + 12},
          $${i * 14 + 13}, $${i * 14 + 14}
        )
      `).join(',')}
      RETURNING *
    `;

    const values = [];
    lignesConfig.forEach((l, index) => {
      const montantFinal = parseFloat(montant) || 0;
      const debit = l.sensoperation === 'D' ? montantFinal : 0;
      const credit = l.sensoperation === 'C' ? montantFinal : 0;
      
      // Génération de l'ID unique par ligne pour la clé primaire
      const idUniqueLigne =idtmvth;

      values.push(
        idUniqueLigne,            // $1
        d,                        // $2
        l.codejrnl || 'DIV',      // $3
        l.compte,                 // $4
        l.idtiers || '0',         // $5
        (libelle || 'Saisie').substring(0, 100), // $6
        debit,                    // $7
        credit,                   // $8
        iduser || 0,              // $9
        finalMois,                // $10
        finalAnnee,               // $11
        null,                     // $12
        null,                     // $13
        idagence                  // $14
      );
    });

    const result = await client.query(insertQuery, values);
    await client.query('COMMIT');

    res.status(201).json({ 
      success: true, 
      message: "Opération enregistrée avec succès",
      data: result.rows 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("ERREUR SQL:", err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});













/// PARTIE  MODIFICATION OPERATION DIVERS


// =========================================================================
// 1. AFFICHER : Récupérer les opérations diverses (Filtrées par agence/période)
// =========================================================================
router.get('/operationsdiversesm', async (req, res) => {
  try {
    const { idagence, idmois, idannee } = req.query;

    if (!idagence) {
      return res.status(400).json({
        success: false,
        message: "L'identifiant 'idagence' est obligatoire dans les paramètres."
      });
    }

    // Requête de base pour récupérer les écritures de la table
    let selectQuery = `
      SELECT idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
             MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE, idagence
      FROM tmvttheorique
      WHERE idagence = $1
    `;
    const params = [idagence];

    // Ajout de filtres optionnels pour optimiser l'affichage côté Flutter
    if (idmois && idannee) {
      selectQuery += ` AND IDMOIS = $2 AND IDANNEE = $3`;
      params.push(idmois, idannee);
    }

    selectQuery += ` ORDER BY date DESC, idtmvth`;

    const result = await pool.query(selectQuery, params);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (err) {
    console.error("ERREUR RÉCUPÉRATION SQL:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 2. INSÉRER : Saisie d'une nouvelle opération (Votre code existant sécurisé)
// =========================================================================
router.post('/saisieoperationdiversm', async (req, res) => {
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
      idannee 
    } = req.body;

    if (!idmodel || !idagence || !idtmvth) {
      return res.status(400).json({
        success: false,
        message: "idmodel, idagence et idtmvth sont obligatoires."
      });
    }

    await client.query('BEGIN');

    const modelQuery = `
      SELECT ml.codejrnl, mlo.compte, mlo.idtiers, mlo.sensoperation
      FROM fina_model ml
      INNER JOIN fina_modeloperation mlo ON mlo.idmodel = ml.idmodel
      WHERE ml.idagence = $1 AND ml.idmodel = $2
      ORDER BY mlo.numeroligne
    `;
    const modelResult = await client.query(modelQuery, [idagence, idmodel]);

    if (modelResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Modèle introuvable." });
    }

    const d = date ? new Date(date) : new Date();
    const finalMois = idmois || (d.getMonth() + 1);
    const finalAnnee = idannee || d.getFullYear();

    const lignesConfig = modelResult.rows;

    const insertQuery = `
      INSERT INTO tmvttheorique (
        idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence
      )
      VALUES 
      ${lignesConfig.map((_, i) => `
        (
          $${i * 14 + 1}, $${i * 14 + 2}, $${i * 14 + 3}, $${i * 14 + 4}, 
          $${i * 14 + 5}, $${i * 14 + 6}, $${i * 14 + 7}, $${i * 14 + 8}, 
          $${i * 14 + 9}, $${i * 14 + 10}, $${i * 14 + 11}, $${i * 14 + 12},
          $${i * 14 + 13}, $${i * 14 + 14}
        )
      `).join(',')}
      RETURNING *
    `;

    const values = [];
    lignesConfig.forEach((l) => {
      const montantFinal = parseFloat(montant) || 0;
      const debit = l.sensoperation === 'D' ? montantFinal : 0;
      const credit = l.sensoperation === 'C' ? montantFinal : 0;
      
      values.push(
        idtmvth,                    // $1
        d,                          // $2
        l.codejrnl || 'DIV',        // $3
        l.compte,                   // $4
        l.idtiers || '0',           // $5
        (libelle || 'Saisie').substring(0, 100), // $6
        debit,                      // $7
        credit,                     // $8
        iduser || 0,                // $9
        finalMois,                  // $10
        finalAnnee,                 // $11
        null,                       // $12
        null,                       // $13
        idagence                    // $14
      );
    });

    const result = await client.query(insertQuery, values);
    await client.query('COMMIT');

    res.status(201).json({ 
      success: true, 
      message: "Opération enregistrée avec succès",
      data: result.rows 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("ERREUR SQL:", err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// =========================================================================
// 3. MODIFIER : Mettre à jour les montants et détails d'une opération groupée
// =========================================================================
router.put('/modifieroperationdiversm', async (req, res) => {
  const client = await pool.connect();

  try {
    const { idtmvth, idagence, montant, libelle, date, idmois, idannee } = req.body;

    // Validation stricte
    if (!idtmvth || !idagence) {
      return res.status(400).json({
        success: false,
        message: "L'identifiant global 'idtmvth' et l'idagence sont obligatoires pour la modification."
      });
    }

    await client.query('BEGIN');

    // 3.1 Vérifier que l'opération existe bel et bien
    const checkQuery = `SELECT * FROM tmvttheorique WHERE idtmvth = $1 AND idagence = $2`;
    const checkResult = await client.query(checkQuery, [idtmvth, idagence]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Opération introuvable sur cette agence." });
    }

    // 3.2 Préparer la nouvelle date et les périodes si envoyées
    const d = date ? new Date(date) : new Date(checkResult.rows[0].date);
    const finalMois = idmois || (d.getMonth() + 1);
    const finalAnnee = idannee || d.getFullYear();
    const montantFinal = parseFloat(montant);

    // 3.3 Mettre à jour ligne par ligne pour respecter la logique Débit/Crédit originale du modèle
    for (let row of checkResult.rows) {
      let nouveauDebit = row.montantdebit;
      let nouveauCredit = row.montantcredit;

      // Si un nouveau montant global est envoyé, on réajuste selon la nature de la ligne
      if (!isNaN(montantFinal)) {
        nouveauDebit = parseFloat(row.montantdebit) > 0 ? montantFinal : 0;
        nouveauCredit = parseFloat(row.montantcredit) > 0 ? montantFinal : 0;
      }

      const updateRowQuery = `
        UPDATE tmvttheorique 
        SET date = $1, 
            LIBELLE = $2, 
            montantdebit = $3, 
            montantcredit = $4,
            IDMOIS = $5,
            IDANNEE = $6
        WHERE idtmvth = $7 AND idagence = $8 AND IDCPTGN = $9
      `;

      await client.query(updateRowQuery, [
        d,
        libelle || row.libelle,
        nouveauDebit,
        nouveauCredit,
        finalMois,
        finalAnnee,
        idtmvth,
        idagence,
        row.idcptgn // Clé de discrimination de la ligne dans l'écriture
      ]);
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: "Opération globale mise à jour avec succès (lignes débitrices/créditrices réalignées)."
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("ERREUR MODIFICATION SQL:", err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});















// INDISPENSABLE : Exportation du router pour le serveur principal
module.exports = router;