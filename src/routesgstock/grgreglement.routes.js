const express = require('express');
const router = express.Router();
const pool = require('../config/db');



router.get('/modepaiement', async (req, res) => {
  try {

    const { idagence } = req.query;

    let query = `
      SELECT idmodep, designation, compte
      FROM cabmodepaiement
      WHERE 1=1
    `;

    const params = [];

    if (idagence !== undefined && idagence !== null && idagence !== '') {
      params.push(idagence);
      query += ` AND idagence = $${params.length}`;
    }

    query += ` ORDER BY designation`;

    const { rows } = await pool.query(query, params);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: 'Erreur récupération mode paiement'
    });
  }
});





router.get('/gventeencours', async (req, res) => {
  const { idagence, idtiers, recherche } = req.query;

  if (!idagence) {
    return res.status(400).json({
      error: 'Le paramètre idagence est obligatoire'
    });
  }

  let queryText = `
    SELECT idop, date, idtiers, nomtiers, iduser,
           idmois, idannee, idjrnal, idagence,
           montant_ttc, montant_reglement, solde
    FROM t_operation_cumule
    WHERE idagence = $1
      AND type_operation = 'VENTE'
      AND solde > 0
  `;

  const queryValues = [idagence];

  // ✅ filtre idtiers optionnel
  if (idtiers) {
    queryValues.push(idtiers);
    queryText += ` AND idtiers = $${queryValues.length}`;
  }

  // recherche
  if (recherche && recherche.length >= 3) {
    queryValues.push(`%${recherche}%`);
    queryText += `
      AND (
        nomtiers ILIKE $${queryValues.length}
        OR idop::text ILIKE $${queryValues.length}
      )
    `;
  }

  queryText += ` ORDER BY nomtiers ASC`;

  try {
    const { rows } = await pool.query(queryText, queryValues);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error('Erreur GET /gventeencours:', err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});







router.get('/gachatencours', async (req, res) => {
  const { idagence, idtiers, recherche } = req.query;

  if (!idagence) {
    return res.status(400).json({
      error: 'Le paramètre idagence est obligatoire'
    });
  }

  let queryText = `
    SELECT idop, date, idtiers, nomtiers, iduser,
           idmois, idannee, idjrnal, idagence,
           montant_ttc, montant_reglement, solde,ref_piece
    FROM t_operation_cumule
    WHERE idagence = $1
      AND type_operation = 'ACHAT'
      AND solde > 0
  `;

  const queryValues = [idagence];

  if (idtiers) {
    queryValues.push(idtiers);
    queryText += ` AND idtiers = $${queryValues.length}`;
  }

  if (recherche && recherche.length >= 3) {
    queryValues.push(`%${recherche}%`);
    queryText += `
      AND (
        nomtiers ILIKE $${queryValues.length}
        OR idop::text ILIKE $${queryValues.length}
      )
    `;
  }

  queryText += ` ORDER BY nomtiers ASC`;

  try {
    const { rows } = await pool.query(queryText, queryValues);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error('Erreur GET /gachatencours:', err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});




router.post('/greglementclient', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      idclients,
      idvente,
      codeoperation,
      idagence,
      idjrnal,
      montant,
      idmois,
      idannee,
      iduser,
      datevalidation,
      dateregle,
      idmodep,
      compte,
      compteauxiliaire,
      montantrecu,
      relicat,
      idassureur
    } = req.body;



 // récupérer compte caisse utilisateur
            const caisseResult = await client.query(
                `
                SELECT comptecaisse
                FROM caisse_utilisateur
                WHERE iduser = $1
                `,
                [iduser]
            );

            if (
                caisseResult.rows.length === 0 
            ) {
                throw new Error(
                    'Configuration comptable manquante (Caisse utilisateur)'
                );
            }

            const compteCaisseEffective =
                caisseResult.rows[0]?.comptecaisse || null;








    const dateOp = dateregle || datevalidation;

    // 1. INSERT REGLEMENT CLIENT
    const result = await client.query(
      `INSERT INTO greglementclient (
        idclients, idvente, idagence, idjrnal, montant,
        idmois, idannee, iduser, datevalidation, dateregle,
        idmodep, montantrecu, relicat,idassureur,codeoperation
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
      [idclients, idvente, idagence, idjrnal, montant || 0, idmois, idannee, iduser, datevalidation, dateregle, idmodep, montantrecu || 0, relicat || 0,idassureur || 0,codeoperation || 0]
    );

    // 2. ÉCRITURE COMPTABLE - DEBIT CAISSE/BANQUE
    await client.query(
      `INSERT INTO TMVTTHEORIQUE (
        idtmvth, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT,
        IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence,idjrnal,idmouvement,idclient
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [codeoperation, dateOp, idjrnal, compteCaisseEffective, idclients, 'REGLEMENT CLIENT - ENCAISSEMENT', montant || 0,0, iduser, idmois, idannee, idvente, idclients, idagence,idjrnal,"1",idclients]
    );

    // 3. ÉCRITURE COMPTABLE - CREDIT CLIENT
    await client.query(
      `INSERT INTO TMVTTHEORIQUE (
        idtmvth, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT,
        IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence,idjrnal,idmouvement,idclient
      )
      VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [codeoperation, dateOp, idjrnal, compteauxiliaire, idclients, 'REGLEMENT CLIENT - SOLDAGE FACTURE',0, montant || 0, iduser, idmois, idannee, idvente, idclients, idagence,idjrnal,"1",idclients]
    );

    // 🔹 4. MISE À JOUR DU SOLDE (CRUCIAL POUR FLUTTER)
    // On met à jour la table qui gère les encours de vente
   

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: "Règlement, comptabilité et solde mis à jour avec succès",
      data: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Erreur règlement client",
      error: err.message
    });
  } finally {
    client.release();
  }
});





router.post('/annulerreglementclient', async (req, res) => {
  const client = await pool.connect();
  const { idregleclient, iduser } = req.body; // idreglement est la clé primaire de greglementclient

  if (!idregleclient) {
    return res.status(400).json({ success: false, message: "ID règlement manquant" });
  }

  try {
    await client.query('BEGIN');

    // 1. Récupérer les informations du règlement avant suppression 
    // pour identifier les écritures comptables liées (via idvente ou un id unique)
    const reglement = await client.query(
      `SELECT idvente, idjrnal FROM greglementclient WHERE idregleclient = $1`,
      [idregleclient]
    );

    if (reglement.rows.length === 0) {
      throw new Error("Règlement introuvable");
    }

    const { idvente, idjrnal } = reglement.rows[0];

    // 2. Supprimer les écritures comptables liées dans TMVTTHEORIQUE
    // Note : On utilise idtmvth = idvente (selon votre insert initial) 
    // et idjrnal pour être précis.
    await client.query(
      `DELETE FROM TMVTTHEORIQUE WHERE idtmvth = $1 AND idjrnal = $2`,
      [idvente, idjrnal]
    );

    // 3. Supprimer le règlement
    await client.query(
      `DELETE FROM greglementclient WHERE idregleclient = $1`,
      [idreglement]
    );

    // 4. Si vous aviez une mise à jour de solde (étape 4 dans votre code initial),
    // il faut ici ré-incrémenter le reste à payer de la vente correspondante.

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: "Règlement annulé et écritures comptables supprimées avec succès"
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'annulation du règlement",
      error: err.message
    });
  } finally {
    client.release();
  }
});



/*

// Assure-toi d'avoir : const express = require('express'); const router = express.Router(); const pool = require('./dbPool'); (ou ton import pool)
router.post('/greglementclientassure', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('--- /greglementclient payload ---');
    console.log(JSON.stringify(req.body, null, 2));

    await client.query('BEGIN');

    // Récupération et normalisation des valeurs du body
    const {
      idclients,
      idvente,
      codeoperation,
      idagence,
      idjrnal,
      montant,
      idmois,
      idannee,
      iduser,
      datevalidation,
      dateregle,
      idmodep,
      compte,
      compteauxiliaire,
      montantrecu,
      relicat,
      idassureur,
      montantrecu_total
    } = req.body;

    // Normalisation / conversion explicite
    const _idclients = idclients != null ? parseInt(idclients, 10) : null;
    const _idvente = idvente != null ? parseInt(idvente, 10) : null;
    const _idagence = idagence != null ? parseInt(idagence, 10) : null;
    const _idjrnal = idjrnal != null ? parseInt(idjrnal, 10) : null;
    const _montant = montant != null ? parseFloat(montant) : 0.0;
    const _montantrecu = montantrecu != null ? parseFloat(montantrecu) : 0.0;
    const _relicat = relicat != null ? parseFloat(relicat) : 0.0;
    const _idmois = idmois != null ? parseInt(idmois, 10) : null;
    const _idannee = idannee != null ? parseInt(idannee, 10) : null;
    const _iduser = iduser != null ? parseInt(iduser, 10) : null;
    const _idmodep = idmodep != null ? parseInt(idmodep, 10) : null;
    const _idassureur = idassureur != null ? (isNaN(parseInt(idassureur, 10)) ? null : parseInt(idassureur, 10)) : null;
    const _montantrecu_total = montantrecu_total != null ? parseFloat(montantrecu_total) : null;

    console.log('Normalized values:', {
      _idclients, _idvente, _idagence, _idjrnal, _montant, _montantrecu, _relicat, _idassureur, _montantrecu_total
    });

    // Vérifications minimales
    if (!_idclients || !_idvente || !_idagence || !_iduser) {
      throw new Error('Paramètres manquants: idclients, idvente, idagence et iduser sont requis.');
    }

    // Récupérer compte caisse utilisateur (existant dans ton code)
    const caisseResult = await client.query(
      `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`,
      [_iduser]
    );

    if (caisseResult.rows.length === 0) {
      throw new Error('Configuration comptable manquante (Caisse utilisateur)');
    }

    const compteCaisseEffective = caisseResult.rows[0]?.comptecaisse || null;

    // Date opération
    const dateOp = dateregle || datevalidation || new Date().toISOString();

    // 1) INSERT dans greglementclient (colonnes explicites)
    const insertQuery = `
      INSERT INTO greglementclient (
        idclients, idvente, idagence, idjrnal, montant,
        idmois, idannee, iduser, datevalidation, dateregle,
        idmodep, montantrecu, relicat, idassureur,codeoperation
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
      ) RETURNING *;
    `;

    const insertValues = [
      _idclients,
      _idvente,
      _idagence,
      _idjrnal,
      _montant,
      _idmois,
      _idannee,
      _iduser,
      datevalidation || null,
      dateregle || null,
      _idmodep,
      _montantrecu,
      _relicat,
      _idassureur,
      codeoperation
    
    ];

    console.log('Executing INSERT greglementclient with values:', insertValues);

    const insertResult = await client.query(insertQuery, insertValues);

    console.log('INSERT result.rows[0]:', insertResult.rows[0]);

    // 2) ÉCRITURE COMPTABLE - DEBIT CAISSE/BANQUE (TMVTTHEORIQUE)
    // Note: adapte les colonnes si ta table a un schéma différent
    const debitQuery = `
      INSERT INTO TMVTTHEORIQUE (
        idtmvth, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT,
        IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12,$13,$14,$15,$16
      )
      RETURNING *;
    `;

    const debitValues = [
      codeoperation,
      dateOp,
      _idjrnal,
      compteCaisseEffective,
      _idclients,
      'REGLEMENT CLIENT - ENCAISSEMENT',
      _montant,
      _iduser,
      _idmois,
      _idannee,
      _idvente,
      _idclients,
      _idagence,
      _idjrnal,
      "1",
      _idclients
    ];

    const debitRes = await client.query(debitQuery, debitValues);
    console.log('Debit TMVTTHEORIQUE inserted:', debitRes.rows[0]);

    // 3) ÉCRITURE COMPTABLE - CREDIT CLIENT (TMVTTHEORIQUE)
    const creditQuery = `
      INSERT INTO TMVTTHEORIQUE (
        idtmvth, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT,
        IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      ) VALUES (
        $1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
      )
      RETURNING *;
    `;

    const creditValues = [
      codeoperation,
      dateOp,
      _idjrnal,
      compteauxiliaire || null,
      _idclients,
      'REGLEMENT CLIENT - SOLDAGE FACTURE',
      _montant,
      _iduser,
      _idmois,
      _idannee,
      _idvente,
      _idclients,
      _idagence,
      _idjrnal,
      "1",
      _idclients
    ];

    const creditRes = await client.query(creditQuery, creditValues);
    console.log('Credit TMVTTHEORIQUE inserted:', creditRes.rows[0]);

    // 4) MISE A JOUR DU SOLDE DANS t_operation_cumule
    // On met à jour regleassure = regleassure + montant et soldeassure = soldeassure - montant
    // On protège contre solde négatif en utilisant GREATEST
    const updateOpQuery = `
      UPDATE t_operation_cumule
      SET
        regleassure = COALESCE(regleassure, 0) + $1
        
      WHERE idop = $2
      RETURNING idop, regleassure;
    `;

    const updateOpValues = [_montant, _idvente];
    const updateOpRes = await client.query(updateOpQuery, updateOpValues);

    if (updateOpRes.rows.length === 0) {
      // Si aucune ligne mise à jour, on peut choisir de rollback ou continuer selon ton besoin
      console.warn(`Aucune opération trouvée pour idop=${_idvente} (mise à jour solde skipped).`);
    } else {
      console.log('t_operation_cumule updated:', updateOpRes.rows[0]);
    }

    await client.query('COMMIT');

    // Réponse : reglement créé + info opération mise à jour
    return res.status(201).json({
      success: true,
      message: "Règlement, comptabilité et solde mis à jour avec succès",
      data: {
        reglement: insertResult.rows[0],
        operation: updateOpRes.rows[0] || null
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur POST /greglementclient:', err);
    return res.status(500).json({
      success: false,
      message: "Erreur règlement client",
      error: err.message
    });
  } finally {
    client.release();
  }
});

*/



// Assure-toi d'avoir : const express = require('express'); const router = express.Router(); const pool = require('./dbPool'); (ou ton import pool)
router.post('/greglementclientassure', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('--- Enregistrement du règlement client ---');
    await client.query('BEGIN');

    const {
      idclients,
      idvente,
      codeoperation,
      idagence,
      idjrnal,
      montant,
      idmois,
      idannee,
      iduser,
      datevalidation,
      dateregle,
      idmodep,
      compteauxiliaire, // Doit être fourni pour le crédit comptable
      montantrecu,
      relicat,
      idassureur,
      ref_piece_regle
    } = req.body;

    // Normalisation des valeurs reçues
    const _idclients = idclients != null ? parseInt(idclients, 10) : null;
    const _idvente = idvente != null ? parseInt(idvente, 10) : null;
    const _idagence = idagence != null ? parseInt(idagence, 10) : null;
    const _idjrnal = idjrnal != null ? parseInt(idjrnal, 10) : null;
    const _montant = montant != null ? parseFloat(montant) : 0.0;
    const _montantrecu = montantrecu != null ? parseFloat(montantrecu) : 0.0;
    const _relicat = relicat != null ? parseFloat(relicat) : 0.0;
    const _idmois = idmois != null ? parseInt(idmois, 10) : null;
    const _idannee = idannee != null ? parseInt(idannee, 10) : null;
    const _iduser = iduser != null ? parseInt(iduser, 10) : null;
    const _idmodep = idmodep != null ? parseInt(idmodep, 10) : null;
    const _idassureur = idassureur != null && !isNaN(parseInt(idassureur, 10)) ? parseInt(idassureur, 10) : null;

    if (!_idclients || !_idvente || !_idagence || !_iduser) {
      throw new Error('Paramètres obligatoires manquants : idclients, idvente, idagence et iduser.');
    }

    // Requête d'insertion simple dans greglementclient
    const insertQuery = `
      INSERT INTO greglementclient (
        idclients, idvente, idagence, idjrnal, montant,
        idmois, idannee, iduser, datevalidation, dateregle,
        idmodep, montantrecu, relicat, idassureur, codeoperation, 
        ref_piece, ref_piece_regle, compteauxiliaire
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING *;
    `;

    const insertValues = [
      _idclients,
      _idvente,
      _idagence,
      _idjrnal,
      _montant,
      _idmois,
      _idannee,
      _iduser,
      datevalidation || null,
      dateregle || null,
      _idmodep,
      _montantrecu,
      _relicat,
      _idassureur,
      codeoperation,
      codeoperation,
      ref_piece_regle,
      compteauxiliaire || null
    ];

    const insertResult = await client.query(insertQuery, insertValues);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: "Règlement inséré avec succès. La comptabilité et le cumul ont été mis à jour par le trigger.",
      data: insertResult.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur au niveau de la route Node.js :', err);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors du traitement du règlement.",
      error: err.message
    });
  } finally {
    client.release();
  }
});








router.delete('/greglementclientassure/:codeoperation', async (req, res) => {
  const { codeoperation } = req.params;
  const client = await pool.connect();

  try {
    console.log(`--- Tentative de suppression du règlement : ${codeoperation} ---`);
    await client.query('BEGIN');

    // Requête de suppression
    const deleteQuery = `DELETE FROM greglementclient WHERE codeoperation = $1`;
    const deleteResult = await client.query(deleteQuery, [codeoperation]);

    // Vérifier si une ligne a bien été supprimée
    if (deleteResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Aucun règlement trouvé avec le code opération : ${codeoperation}`
      });
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: "Règlement supprimé avec succès. La comptabilité et le cumul ont été mis à jour par le trigger."
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur lors de la suppression :', err);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de la suppression du règlement.",
      error: err.message
    });
  } finally {
    client.release();
  }
});











router.post('/annulerreglementclientassureOLDE', async (req, res) => {
  const client = await pool.connect();
  
  // On récupère le codeoperation pour identifier le règlement à annuler
  const { codeoperation, iduser } = req.body;

  if (!codeoperation) {
    return res.status(400).json({ success: false, message: "codeoperation est requis pour l'annulation." });
  }

  try {
    await client.query('BEGIN');

    // 1. Récupérer les infos du règlement avant suppression pour pouvoir corriger le solde
    const reglementResult = await client.query(
      `SELECT idvente, montant FROM greglementclient WHERE codeoperation = $1`,
      [codeoperation]
    );

    if (reglementResult.rows.length === 0) {
      throw new Error("Règlement introuvable avec ce code opération.");
    }

    const { idvente, montant } = reglementResult.rows[0];

    // 2. Supprimer les écritures comptables associées
    await client.query(
      `DELETE FROM TMVTTHEORIQUE WHERE idtmvth = $1`,
      [codeoperation]
    );

    // 3. Supprimer le règlement
    await client.query(
      `DELETE FROM greglementclient WHERE codeoperation = $1`,
      [codeoperation]
    );

    // 4. Inverser la mise à jour du solde dans t_operation_cumule
    // On soustrait le montant ajouté précédemment
    await client.query(
      `UPDATE t_operation_cumule 
       SET regleassure = COALESCE(regleassure, 0) - $1 
       WHERE idop = $2`,
      [montant, idvente]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: "Annulation du règlement effectuée avec succès."
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur lors de l\'annulation:', err);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de l'annulation",
      error: err.message
    });
  } finally {
    client.release();
  }
});








router.delete('/greglementclient/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const idregleclient = req.params.id;

    const result = await client.query(
      `DELETE FROM greglementclient
       WHERE idregleclient = $1
       RETURNING *`,
      [idregleclient]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: "Règlement client annulé",
      data: result.rows[0]
    });

  } catch (err) {

    await client.query('ROLLBACK');

    res.status(500).json({
      success: false,
      message: "Erreur annulation règlement client",
      error: err.message
    });

  } finally {
    client.release();
  }
});





/*

router.post('/greglementfournisseur', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      idfournisseur,
      idachat, // C'est l'ID de l'opération d'achat
      idagence,
      idjrnal,
      montant,
      idmois,
      idannee,
      iduser,
      datevalidation,
      dateregle,
      idmodep,
      compte,           // Compte de trésorerie (ex: 5711)
      compteauxiliaire  // Compte fournisseur (ex: 4011)
    } = req.body;



// récupérer compte caisse utilisateur
            const caisseResult = await client.query(
                `
                SELECT comptecaisse
                FROM caisse_utilisateur
                WHERE iduser = $1
                `,
                [iduser]
            );

            if (
                caisseResult.rows.length === 0 
            ) {
                throw new Error(
                    'Configuration comptable manquante (Caisse utilisateur)'
                );
            }

            const compteCaisseEffective =
                caisseResult.rows[0]?.comptecaisse || null;







    const dateOp = dateregle || datevalidation;

    // 1. INSERTION DANS LA TABLE DE LOG DES RÈGLEMENTS FOURNISSEURS
    const result = await client.query(
      `INSERT INTO greglementfournisseur (
        idfournisseur, idachat, idagence, idjrnal, montant,
        idmois, idannee, iduser, datevalidation, dateregle, idmodep
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [idfournisseur, idachat, idagence, idjrnal, montant || 0, idmois, idannee, iduser, datevalidation, dateregle, idmodep]
    );

    // 2. ÉCRITURE COMPTABLE - DÉBIT DU FOURNISSEUR (Diminution de la dette)
    // On utilise "date" en minuscule (PostgreSQL) et les bonnes variables fournisseur
    await client.query(
      `INSERT INTO TMVTTHEORIQUE (
        idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT,
        IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence,idjrnal,idmouvement,idclient
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        idachat, 
        dateOp, 
        idjrnal, 
        compteauxiliaire, // Compte fournisseur (ex: 4011)
        idfournisseur, 
        'REGLEMENT FOURNISSEUR - PAIEMENT FACTURE', 
        montant || 0, 
        iduser, idmois, idannee, idachat, idfournisseur, idagence,idjrnal,"1",idfournisseur
      ]
    );

    // 3. ÉCRITURE COMPTABLE - CRÉDIT DE LA CAISSE/BANQUE (Sortie de trésorerie)
    await client.query(
      `INSERT INTO TMVTTHEORIQUE (
        idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT,
        IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence,idjrnal,idmouvement,idclient
      )
      VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        idachat, 
        dateOp, 
        idjrnal, 
        compteCaisseEffective, // Compte caisse ou banque (ex: 5711)
        idfournisseur, 
        'REGLEMENT FOURNISSEUR - SORTIE TRESORERIE', 
        montant || 0, 
        iduser, idmois, idannee, idachat, idfournisseur, idagence,idjrnal,"1",idfournisseur
      ]
    );


    /*
    // 4. MISE À JOUR DU SOLDE DE L'ACHAT DANS LA GESTION COMMERCIALE
    // Important pour que l'achat n'apparaisse plus dans les factures à payer
    await client.query(
      `UPDATE t_operation_cumule 
       SET montant_reglement = montant_reglement + $1,
           solde = solde - $1
       WHERE idop = $2 AND idagence = $3 AND type_operation = 'ACHAT'`,
      [montant || 0, idachat, idagence]
    );
    */

    /*
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: "Règlement fournisseur, comptabilité et solde mis à jour",
      data: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur règlement fournisseur:", err.message);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'enregistrement du règlement",
      error: err.message
    });
  } finally {
    client.release();
  }
});


*/







/*
router.delete('/greglementfournisseur/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const idreglefournisseur = req.params.id;

    const result = await client.query(
      `DELETE FROM greglementfournisseur
       WHERE idreglefournisseur = $1
       RETURNING *`,
      [idreglefournisseur]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: "Règlement fournisseur annulé",
      data: result.rows[0]
    });

  } catch (err) {

    await client.query('ROLLBACK');

    res.status(500).json({
      success: false,
      message: "Erreur annulation règlement fournisseur",
      error: err.message
    });

  } finally {
    client.release();
  }
});
*/




/*
router.post('/greglementfournisseurv1', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      idfournisseur,
      idachat,
      idagence,
      idjrnal,
      montant,
      idmois,
      idannee,
      iduser,
      datevalidation,
      dateregle,
      idmodep,
      compteauxiliaire,
      ref_piece,
      ref_piece_regle  
    } = req.body;

    // Insertion unique dans la table de règlement
    const result = await client.query(
      `INSERT INTO greglementfournisseur (
        idfournisseur, idachat, idagence, idjrnal, montant,
        idmois, idannee, iduser, datevalidation, dateregle, 
        idmodep, ref_piece, ref_piece_regle, compteauxiliaire
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        idfournisseur, 
        idachat, 
        idagence, 
        idjrnal, 
        montant || 0,
        idmois, 
        idannee, 
        iduser, 
        datevalidation, 
        dateregle, 
        idmodep,
        ref_piece,
        ref_piece_regle,
        compteauxiliaire
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: "Règlement enregistré. Comptabilité et solde mis à jour automatiquement.",
      data: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur règlement fournisseur :", err.message);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'enregistrement du règlement",
      error: err.message
    });
  } finally {
    client.release();
  }
});

*/

router.post('/greglementfournisseurv1', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      idfournisseur,
      idachat,
      idagence,
      idjrnal,
      montant,
      idmois,
      idannee,
      iduser,
      datevalidation,
      dateregle,
      idmodep,
      compteauxiliaire,
      ref_piece,
      ref_piece_regle  
    } = req.body;

    // Conversion sécurisée en entier pour PostgreSQL si ces colonnes sont des Integer
    const parsedIdUser = iduser ? parseInt(iduser, 10) : null;
    const parsedIdModep = idmodep ? parseInt(idmodep, 10) : null;

    // Insertion avec le champ 'compte' supplémentaire ($15)
    const result = await client.query(
      `INSERT INTO greglementfournisseur (
        idfournisseur, idachat, idagence, idjrnal, montant,
        idmois, idannee, iduser, datevalidation, dateregle, 
        idmodep, ref_piece, ref_piece_regle, compteauxiliaire
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        idfournisseur, 
        idachat, 
        idagence, 
        idjrnal, 
        montant || 0,
        idmois, 
        idannee, 
        parsedIdUser, // Utilisation de la valeur convertie
        datevalidation, 
        dateregle, 
        parsedIdModep, // Utilisation de la valeur convertie
        ref_piece,
        ref_piece_regle,
        compteauxiliaire
       
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: "Règlement enregistré. Comptabilité et solde mis à jour automatiquement.",
      data: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur règlement fournisseur :", err.message);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'enregistrement du règlement",
      error: err.message
    });
  } finally {
    client.release();
  }
});






// POST /greglementfournisseur/annuler
router.post('/greglementfournisseur/annuler', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { ref_piece } = req.body;

    if (!ref_piece) {
      return res.status(400).json({
        success: false,
        message: "La référence de la pièce (ref_piece) est requise pour effectuer l'annulation."
      });
    }

    // --- OPTION A : SUPPRESSION PHYSIQUE ---
    // (Conseillée si des triggers de base de données se chargent de restaurer les soldes lors d'un DELETE)
    const result = await client.query(
      `DELETE FROM greglementfournisseur 
       WHERE ref_piece = $1 
       RETURNING *`,
      [ref_piece]
    );

    /* 
    // --- OPTION B : ANNULATION LOGIQUE (Mise à jour d'un statut) ---
    // (Décommentez cette partie et commentez l'Option A si vous préférez marquer la ligne comme annulée)
    const result = await client.query(
      `UPDATE greglementfournisseur 
       SET montant = 0, datevalidation = NOW() -- ou modifier une colonne d'état dédiée
       WHERE ref_piece = $1 
       RETURNING *`,
      [ref_piece]
    );
    */

    // Si aucune ligne n'a été affectée
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: "Aucun règlement trouvé avec cette référence de pièce."
      });
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: "Règlement annulé avec succès.",
      data: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur lors de l'annulation du règlement :", err.message);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'annulation du règlement",
      error: err.message
    });
  } finally {
    client.release();
  }
});




// GET /greglementfournisseur/dates?startDate=2026-06-01&endDate=2026-06-30&idagence=1
router.get('/greglementfournisseur/dates', async (req, res) => {
  const client = await pool.connect();

  try {
    const { startDate, endDate, idagence } = req.query;

    // Vérification des paramètres requis
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Les dates de début (startDate) et de fin (endDate) sont requises au format YYYY-MM-DD."
      });
    }

    // Requête de base (filtrage inclusif entre les deux dates de validation)
    let query = `
      SELECT 
    grf.idreglefournisseur, 
    grf.idfournisseur, 
    grf.idachat, 
    grf.idagence, 
    grf.idjrnal, 
    grf.montant, 
    grf.idmois, 
    grf.idannee, 
    grf.iduser, 
    grf.datevalidation, 
    grf.dateregle, 
    grf.idmodep, 
    grf.compteauxiliaire, 
    grf.ref_piece, 
    grf.ref_piece_regle, 
    gf.nomcomplet 
FROM greglementfournisseur grf 
JOIN public.gfournisseur gf ON gf.idfourn = grf.idfournisseur 
      WHERE grf.dateregle::date BETWEEN $1::date AND $2::date
    `;
    const params = [startDate, endDate];

    // Filtrage optionnel par agence
    if (idagence) {
      query += ` AND grf.idagence = $3`;
      params.push(idagence);
    }

    // Tri du plus récent au plus ancien
    query += ` ORDER BY grf.dateregle DESC`;

    const result = await client.query(query, params);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (err) {
    console.error("Erreur lors de la récupération des règlements :", err.message);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des règlements",
      error: err.message
    });
  } finally {
    client.release();
  }
});




























// Mise à jour d'un règlement existant
router.put('/greglementfournisseur/:ref_piece', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { ref_piece } = req.params;
    const {
      idfournisseur, idachat, idagence, idjrnal, montant,
      idmois, idannee, iduser, datevalidation, dateregle, 
      idmodep, ref_piece_regle, compteauxiliaire
    } = req.body;

    const result = await client.query(
      `UPDATE greglementfournisseur
       SET idfournisseur = $1, idachat = $2, idagence = $3, idjrnal = $4, montant = $5,
           idmois = $6, idannee = $7, iduser = $8, datevalidation = $9, dateregle = $10,
           idmodep = $11, ref_piece_regle = $12, compteauxiliaire = $13
       WHERE ref_piece = $14
       RETURNING *`,
      [
        idfournisseur, idachat, idagence, idjrnal, montant || 0,
        idmois, idannee, iduser, datevalidation, dateregle, 
        idmodep, ref_piece_regle, compteauxiliaire, ref_piece
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('Règlement non trouvé.');
    }

    await client.query('COMMIT');
    res.json({ success: true, message: "Règlement modifié, comptabilité recalculée.", data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Suppression d'un règlement
router.delete('/greglementfournisseur/:ref_piece', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { ref_piece } = req.params;

    const result = await client.query(
      `DELETE FROM greglementfournisseur WHERE ref_piece = $1 RETURNING *`,
      [ref_piece]
    );

    if (result.rows.length === 0) {
      throw new Error('Règlement non trouvé.');
    }

    await client.query('COMMIT');
    res.json({ success: true, message: "Règlement supprimé, comptabilité et solde ajustés." });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});





router.delete('/greglementfournisseur/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const idreglefournisseur = req.params.id;

    const result = await client.query(
      `DELETE FROM greglementfournisseur
       WHERE idreglefournisseur = $1
       RETURNING *`,
      [idreglefournisseur]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: "Règlement fournisseur annulé",
      data: result.rows[0]
    });

  } catch (err) {

    await client.query('ROLLBACK');

    res.status(500).json({
      success: false,
      message: "Erreur annulation règlement fournisseur",
      error: err.message
    });

  } finally {
    client.release();
  }
});








///   REGLEMENT  ASSURE





// ==========================================
// VENTE ASSUREE ENCOURS
// ==========================================
router.get('/gventeassureencourstous', async (req, res) => {
  const { idagence, idtiers, recherche } = req.query;

  // ==============================
  // Validation
  // ==============================
  if (!idagence) {
    return res.status(400).json({
      success: false,
      error: 'Le paramètre idagence est obligatoire'
    });
  }

  // ==============================
  // Construction dynamique de la requête
  // ==============================
  let queryText = `
    SELECT 
      t.idop,
      t.date,
      t.idtiers,
      t.nomtiers,
      t.iduser,
      t.idmois,
      t.idannee,
      t.idjrnal,
      t.idagence,
      t.montantassure,
      t.regleassure,
      t.soldeassure,
      t.idassureur,
      g.compteauxiliaire
    FROM t_operation_cumule t
    JOIN gclients g ON g.idclients = t.idtiers
    WHERE t.idagence = $1
      AND t.type_operation = 'VENTE'
      AND t.soldeassure > 0
  `;

  const queryValues = [idagence];

  // ==============================
  // Filtre IDTIERS
  // ==============================
  if (idtiers) {
    queryValues.push(idtiers);
    queryText += ` AND t.idtiers = $${queryValues.length}`;
  }

  // ==============================
  // Recherche
  // ==============================
  if (recherche && recherche.trim().length >= 2) {
    queryValues.push(`%${recherche.trim()}%`);
    queryText += `
      AND (
        t.nomtiers ILIKE $${queryValues.length}
        OR t.idop::text ILIKE $${queryValues.length}
      )
    `;
  }

  // ==============================
  // ORDER BY
  // ==============================
  queryText += ` ORDER BY t.date DESC`;

  try {
    const { rows } = await pool.query(queryText, queryValues);

    return res.json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('Erreur GET /gventeassureencours:', err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});





router.get('/gventeassureencours', async (req, res) => {
  const { idagence, idtiers, recherche } = req.query;

  if (!idagence) {
    return res.status(400).json({ success: false, error: 'Le paramètre idagence est obligatoire' });
  }

  // Base de la requête
  let queryText = `
    SELECT 
      t.idop,
      t.date,
      t.idtiers,
      t.nomtiers,
      t.iduser,
      t.idmois,
      t.idannee,
      t.idjrnal,
      t.idagence,
      t.montantassure,
      t.regleassure,
      t.soldeassure,
      t.idassureur,
      g.compteauxiliaire,
      t.ref_piece
    FROM t_operation_cumule t
    JOIN gclients g ON g.idclients = t.idtiers
    WHERE t.idagence = $1
      AND t.type_operation = 'VENTE'
      AND t.soldeassure > 0
  `;

  const queryValues = [idagence];

  // Si idtiers fourni : on filtre sur ce client
  if (idtiers) {
    queryValues.push(idtiers);
    // $2 = idtiers
    queryText += ` AND t.idtiers = $${queryValues.length}`;

    // On ne veut que le dernier idop pour ce client : on ajoute une condition sur idop = max(idop)
    // Attention : on réutilise $1 (idagence) et $${queryValues.length} (idtiers)
    queryText += `
      AND t.idop = (
        SELECT MAX(idop)
        FROM t_operation_cumule t2
        WHERE t2.idtiers = $${queryValues.length}
          AND t2.type_operation = 'VENTE'
          AND t2.soldeassure > 0
          AND t2.idagence = $1
      )
    `;
  }

  // Recherche texte optionnelle
  if (recherche && recherche.trim().length >= 2) {
    queryValues.push(`%${recherche.trim()}%`);
    queryText += `
      AND (
        t.nomtiers ILIKE $${queryValues.length}
        OR t.idop::text ILIKE $${queryValues.length}
      )
    `;
  }

  // Tri (inutile si on retourne une seule ligne, mais conservé)
  queryText += ` ORDER BY t.date DESC`;

  try {
    const { rows } = await pool.query(queryText, queryValues);
    return res.json({ success: true, total: rows.length, data: rows });
  } catch (err) {
    console.error('Erreur GET /gventeassureencours:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});




///   POUR SANTE ASSURANCE
router.get('/gventeassureencourspardate', async (req, res) => {
  const { idagence, idtiers, recherche, dateDebut, dateFin } = req.query;

  if (!idagence) {
    return res.status(400).json({ success: false, error: 'Le paramètre idagence est obligatoire' });
  }

  // Base de la requête
  let queryText = `
    SELECT 
      t.idop,
      t.date,
      t.idtiers,
      t.nomtiers,
      t.iduser,
      t.idmois,
      t.idannee,
      t.idjrnal,
      t.idagence,
      t.montantassure,
      t.regleassure,
      t.soldeassure,
      t.idassureur,
      g.compteauxiliaire,
      t.ref_piece
    FROM t_operation_cumule t
    JOIN gclients g ON g.idclients = t.idtiers
    WHERE t.idagence = $1
      AND t.type_operation = 'VENTE'
      AND t.soldeassure > 0
  `;

  const queryValues = [idagence];

  // 1. Filtrage par date (BETWEEN)
  // On ajoute ceci avant les autres filtres pour maintenir la logique $1, $2...
  if (dateDebut && dateFin) {
    queryValues.push(dateDebut, dateFin);
    // Le premier paramètre est $1 (idagence), donc les dates seront $2 et $3
    // Mais pour garder la souplesse de votre code, on utilise $${queryValues.length - 1}
    queryText += ` AND t.date BETWEEN $${queryValues.length - 1} AND $${queryValues.length}`;
  }

  // 2. Si idtiers fourni
  if (idtiers) {
    queryValues.push(idtiers);
    queryText += ` AND t.idtiers = $${queryValues.length}`;

    // Sous-requête : on ajoute la même condition de date dans le sous-select pour la cohérence
    queryText += `
      AND t.idop = (
        SELECT MAX(idop)
        FROM t_operation_cumule t2
        WHERE t2.idtiers = $${queryValues.length}
          AND t2.type_operation = 'VENTE'
          AND t2.soldeassure > 0
          AND t2.idagence = $1
          ${dateDebut && dateFin ? `AND t2.date BETWEEN $${queryValues.length - 2} AND $${queryValues.length - 1}` : ''}
      )
    `;
  }

  // 3. Recherche texte optionnelle
  if (recherche && recherche.trim().length >= 2) {
    queryValues.push(`%${recherche.trim()}%`);
    queryText += `
      AND (
        t.nomtiers ILIKE $${queryValues.length}
        OR t.idop::text ILIKE $${queryValues.length}
      )
    `;
  }

  // Tri
  queryText += ` ORDER BY t.date DESC`;

  try {
    const { rows } = await pool.query(queryText, queryValues);
    return res.json({ success: true, total: rows.length, data: rows });
  } catch (err) {
    console.error('Erreur GET /gventeassureencours:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});








router.get('/venteencourspardate', async (req, res) => {
  const { idagence, idtiers, recherche, dateDebut, dateFin } = req.query;

  if (!idagence) {
    return res.status(400).json({ success: false, error: 'Le paramètre idagence est obligatoire' });
  }

  // Base de la requête
  let queryText = `
    SELECT 
      t.idop,
      t.date,
      t.idtiers,
      t.nomtiers,
      t.iduser,
      t.idmois,
      t.idannee,
      t.idjrnal,
      t.idagence,
      t.montantassure,
      t.regleassure,
      t.soldeassure,
      t.solde, -- Assurez-vous d'inclure le solde global si nécessaire
      t.idassureur,
      g.compteauxiliaire,
      t.ref_piece,
      t.refoperation
    FROM t_operation_cumule t
    JOIN gclients g ON g.idclients = t.idtiers
    WHERE t.idagence = $1
      AND t.type_operation = 'VENTE'
      AND t.solde > 0
  `;

  const queryValues = [idagence];

  // 1. Filtrage par date (BETWEEN)
  if (dateDebut && dateFin) {
    queryValues.push(dateDebut, dateFin);
    queryText += ` AND t.date BETWEEN $${queryValues.length - 1} AND $${queryValues.length}`;
  }

  // 2. Si idtiers fourni (On filtre directement par le client sans bloquer sur le MAX(idop))
  if (idtiers) {
    queryValues.push(idtiers);
    queryText += ` AND t.idtiers = $${queryValues.length}`;
  }

  // 3. Recherche texte optionnelle
  if (recherche && recherche.trim().length >= 2) {
    queryValues.push(`%${recherche.trim()}%`);
    queryText += `
      AND (
        t.nomtiers ILIKE $${queryValues.length}
        OR t.idop::text ILIKE $${queryValues.length}
        OR t.ref_piece ILIKE $${queryValues.length}
      )
    `;
  }

  // Tri
  queryText += ` ORDER BY t.date DESC`;

  try {
    const { rows } = await pool.query(queryText, queryValues);
    return res.json({ success: true, total: rows.length, data: rows });
  } catch (err) {
    console.error('Erreur GET /venteencourspardate:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
// Route de maintenance pour mettre à jour gvente_detail



router.post('/maintenance/update-prix', async (req, res) => {
  try {
    const { idagence } = req.body;

    if (!idagence) {
      return res.status(400).json({
        success: false,
        error: 'Le paramètre idagence est obligatoire'
      });
    }

    const query = `
      UPDATE gvente_detail 
      SET prixassure = prixbase, 
          prixassurance = prixbase 
      WHERE idagence = $1
    `;

    const result = await pool.query(query, [idagence]);

    res.json({
      success: true,
      message: `Maintenance effectuée avec succès. ${result.rowCount} lignes mises à jour.`,
      rowCount: result.rowCount
    });

  } catch (err) {
    console.error('Erreur maintenance gvente_detail:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});




router.get('/gventedetailassurance', async (req, res) => {
  const { idvente } = req.query;

  // ==============================
  // Validation
  // ==============================
  if (!idvente) {
    return res.status(400).json({
      success: false,
      error: 'Le paramètre idvente est obligatoire'
    });
  }

  // ==============================
  // Requête SQL
  // ==============================
  const queryText = `
    SELECT 
      gvd.iddetail,
      gvd.idvente,
      gvd.idagence,
      gvd.idarticle,
      gvd.idlot,
      gvd.idunite,
      gvd.quantite,
      gvd.poid_unitaire,
      gvd.prixvente_brut,
      gvd.remise,
      gvd.transport_reparti,
      gvd.taxe_repartie,
      gvd.autres_frais,
      gvd.prix_vente_unitaire,
      gvd.montant_total,
      gvd.numerolot,
      gvd.dateperemption,
      gvd.datevalidation,
      gvd.etat,
      gvd.datevente,
      gvd.idjrnal,
      gvd.idmois,
      gvd.idannee,
      gvd.idtypecl,
      gvd.iduser,
      gvd.idclients,
      gvd.prixachatactuel,
      gvd.couttotalachat,
      gvd.margebrut,
      gvd.iddetail_source,
      gvd.iddepot,
      gvd.prixbase,
      gvd.taux,
      gvd.prixassure,
      gvd.prixassurance,
      gvd.idassureur,
      ga.designation AS article_designation,
      gu.designation AS unite_designation
    FROM gvente_detail gvd
    JOIN garticle ga ON ga.idarticle = gvd.idarticle
    JOIN gunite gu ON gu.idunite = gvd.idunite
    WHERE gvd.idvente = $1
    ORDER BY gvd.iddetail ASC;
  `;

  const queryValues = [idvente];

  try {
    const { rows } = await pool.query(queryText, queryValues);

    return res.json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('Erreur GET /gventedetail:', err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});







router.get('/greglementclientperiode', async (req, res) => {
  const { idagence, datedebut, datefin } = req.query;

  // ==============================
  // Validation
  // ==============================
  if (!idagence || !datedebut || !datefin) {
    return res.status(400).json({
      success: false,
      error: 'Les paramètres idagence, datedebut et datefin sont obligatoires'
    });
  }

  // ==============================
  // Requête SQL
  // ==============================
  const queryText = `
    SELECT 
      gr.idregleclient,
      gr.idclients,
      gr.idvente,
      gr.codeoperation,
      gr.idagence,
      gr.idjrnal,
      gr.montant,
      gr.idmois,
      gr.idannee,
      gr.iduser,
      gr.datevalidation,
      gr.dateregle,
      gr.idmodep,
      gr.montantrecu,
      gr.relicat,
      gr.idassureur,
      (gc.nom || ' ' || gc.prenom) AS nomcomplet,
      ut.prenom AS user_prenom
    FROM greglementclient gr
    JOIN gclients gc ON gc.idclients = gr.idclients
    JOIN utilisateur ut ON ut.iduser = gr.iduser
   WHERE gr.idagence = $1
AND gr.dateregle BETWEEN
    TO_DATE($2,'DD/MM/YYYY')
AND TO_DATE($3,'DD/MM/YYYY')
    ORDER BY gr.dateregle DESC;
  `;

  const queryValues = [idagence, datedebut, datefin];

  try {
    const { rows } = await pool.query(queryText, queryValues);

    return res.json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('Erreur GET /greglementclientperiode:', err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});





// =========================================
// RÉCUPÉRER LE SOLDE DU COMPTE AVOIR D'UN TIERS
// =========================================
router.get('/solde_compte_avoir', async (req, res) => {
    try {
        const { idtiers, idagence } = req.query;

        if (!idtiers || !idagence) {
            return res.status(400).json({
                success: false,
                message: 'Les paramètres idtiers et idagence sont obligatoires'
            });
        }

        // 1. Récupérer le compte interne (idcptintern) pour le tiers et le compte général 41910
        const queryCompte = `
            SELECT idcptintern AS compte 
            FROM public.tcomptegeninter 
            WHERE idtiers = $1 AND idcptgen = '41910' AND idagence = $2
            LIMIT 1;
        `;
        const resCompte = await pool.query(queryCompte, [idtiers, idagence]);

        if (resCompte.rows.length === 0) {
            return res.status(200).json({
                success: true,
                soldecompte: 0.0
            });
        }

        const compteInterne = resCompte.rows[0].compte;

        // 2. Calculer le solde à partir des mouvements théoriques
        const querySolde = `
            SELECT 
                COALESCE(SUM(montantcredit), 0) - COALESCE(SUM(montantdebit), 0) AS soldecompte
            FROM tmvttheorique
            WHERE idcptgn = $1 AND idagence = $2;
        `;
        const resSolde = await pool.query(querySolde, [compteInterne, idagence]);

        const soldeCompte = parseFloat(resSolde.rows[0].soldecompte) || 0.0;

        res.status(200).json({
            success: true,
            compte: compteInterne,
            soldecompte: soldeCompte
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});




router.get('/solde_compte_avoirfournisseur', async (req, res) => {
    try {
        const { idtiers, idagence } = req.query;

        if (!idtiers || !idagence) {
            return res.status(400).json({
                success: false,
                message: 'Les paramètres idtiers et idagence sont obligatoires'
            });
        }

        // 1. Récupérer le compte interne (idcptintern) pour le tiers et le compte général 41910
        const queryCompte = `
            SELECT idcptintern AS compte 
            FROM public.tcomptegeninter 
            WHERE idtiers = $1 AND idcptgen = '40910' AND idagence = $2
            LIMIT 1;
        `;
        const resCompte = await pool.query(queryCompte, [idtiers, idagence]);

        if (resCompte.rows.length === 0) {
            return res.status(200).json({
                success: true,
                soldecompte: 0.0
            });
        }

        const compteInterne = resCompte.rows[0].compte;

        // 2. Calculer le solde à partir des mouvements théoriques
        const querySolde = `
            SELECT 
                COALESCE(SUM(montantdebit), 0) - COALESCE(SUM(montantcredit), 0) AS soldecompte
            FROM tmvttheorique
            WHERE idcptgn = $1 AND idagence = $2;
        `;
        const resSolde = await pool.query(querySolde, [compteInterne, idagence]);

        const soldeCompte = parseFloat(resSolde.rows[0].soldecompte) || 0.0;

        res.status(200).json({
            success: true,
            compte: compteInterne,
            soldecompte: soldeCompte
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});




///   REGLEMENT FOURNISSEUR   AGRO CAMPAGNE

// ==========================================
// RÉCUPÉRER LES COOPÉRATIVES ET FOURNISSEURS VIA T_OPERATION_CUMULE (ACHATS EN COURS)
// ==========================================
router.get('/fournisseurs_encours_par_cooperative', async (req, res) => {
    try {
        const { idagence } = req.query;
        if (!idagence) {
            return res.status(400).json({ success: false, message: "idagence est requis" });
        }

        const query = `
            SELECT 
                c.idcooperative,
                c.codecooperative,
                c.raisonsociale AS cooperativenom,
                f.idfourn,
                f.codefournisseurs,
                f.nomcomplet AS fournisseurnom,
                f.telephone,
                f.compteauxiliaire,
                f.idtypefr,
                COALESCE(SUM(op.solde), 0) AS solde
            FROM fina_cooperative c
            INNER JOIN gfournisseur f ON c.idcooperative = f.idcooperative AND f.idagence = c.idagence
            INNER JOIN t_operation_cumule op ON f.idfourn = op.idtiers AND op.idagence = c.idagence AND op.type_operation = 'ACHAT'
            WHERE c.idagence = $1 AND c.etat = true AND op.solde > 0
            GROUP BY c.idcooperative, c.codecooperative, c.raisonsociale, f.idfourn, f.codefournisseurs, f.nomcomplet, f.telephone, f.compteauxiliaire, f.idtypefr
            HAVING SUM(op.solde) > 0
            ORDER BY c.raisonsociale, f.nomcomplet;
        `;

        const result = await pool.query(query, [idagence]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Erreur GET fournisseurs encours par cooperative:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// RÈGLEMENT GLOBAL POUR TOUS LES FOURNISSEURS D'UNE COOPÉRATIVE (BASÉ SUR T_OPERATION_CUMULE)
// ==========================================
router.post('/greglement_global_cooperative', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { idcooperative, idagence, iduser, idmodep } = req.body;

        // 1. Récupérer toutes les factures d'achat en cours pour les fournisseurs de cette coopérative
        const facturesRes = await client.query(
            `SELECT op.idop, op.idtiers, op.solde, op.idjrnal, op.idmois, op.idannee, op.ref_piece, f.compteauxiliaire
             FROM t_operation_cumule op
             INNER JOIN gfournisseur f ON op.idtiers = f.idfourn
             WHERE f.idcooperative = $1 AND op.idagence = $2 AND op.type_operation = 'ACHAT' AND op.solde > 0`,
            [idcooperative, idagence]
        );

        const factures = facturesRes.rows;
        if (factures.length === 0) {
            throw new Error("Aucune facture en cours pour cette coopérative.");
        }

        // 2. Boucler et régler chaque facture une par une via la logique de règlement
        for (const fac of factures) {
            const montantReglement = Number(fac.solde);

            // Générer ou attribuer une référence de pièce de règlement unique
            const refPieceRegle = 'REG-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

            // Insertion du règlement
            await client.query(
                `INSERT INTO greglementfournisseur (
                    idfournisseur, idachat, idagence, idjrnal, montant,
                    idmois, idannee, iduser, datevalidation, dateregle, 
                    idmodep, ref_piece, ref_piece_regle, compteauxiliaire
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $9, $10, $11, $12)`,
                [
                    fac.idtiers,
                    fac.idop,
                    idagence,
                    fac.idjrnal,
                    montantReglement,
                    fac.idmois,
                    fac.idannee,
                    iduser ? parseInt(iduser, 10) : null,
                    idmodep ? parseInt(idmodep, 10) : null,
                    fac.ref_piece,
                    refPieceRegle,
                    fac.compteauxiliaire
                ]
            );
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: "Règlement global de la coopérative effectué avec succès." });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur règlement global coopérative:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});


module.exports = router;