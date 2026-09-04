// routes/goperationDetail.js
// routes/goperationDetail.js
// routes/goperationDetail.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');



router.post('/goperation-detail1234', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // ✅ Transaction

    const {
      codeopdetail,
      idagence,
      comptedebit,
      comptecredit,
      etat,
      dateoperation,
      idjrnal,
      idmois,
      idannee,
      iduser,
      idclients,
      prixpublic,
      prixbase,
      taux,
      montantassure,
      montantassurance,
      montantpayeassure,
      montantpayeassurance,
      montantrecu,
      montantrelicat,
      idassureur,
      datesaisie,
      datevalidation,
      idmodel
    } = req.body;



/*
    // Vérifier si un idop existe déjà pour ce codeopdetail
const checkQuery = `SELECT idop FROM public.goperation_detail WHERE codeopdetail = $1`;
const checkResult = await client.query(checkQuery, [codeopdetail]);

let idop;
if (checkResult.rows.length > 0) {
  // Réutiliser l'idop existant
  idop = checkResult.rows[0].idop;
} else {
  // Générer un nouvel idop
  const maxQuery = `SELECT COALESCE(MAX(idop),0)+1 AS nextidop FROM public.goperation_detail`;
  const maxResult = await client.query(maxQuery);
  idop = maxResult.rows[0].nextidop;
}
  */

    /*
    // Vérifier si codeopdetail existe déjà
    const checkQuery = `SELECT idop FROM public.goperation_detail WHERE codeopdetail = $1 LIMIT 1`;
    const checkResult = await client.query(checkQuery, [codeopdetail]);

    let idop;
    if (checkResult.rows.length > 0) {
      idop = checkResult.rows[0].idop;
    } else {
      const maxQuery = `SELECT COALESCE(MAX(idop),0)+1 AS nextidop FROM public.goperation_detail`;
      const maxResult = await client.query(maxQuery);
      idop = maxResult.rows[0].nextidop;
    }
      */







    // Récupérer compte caisse utilisateur
    const caisseResult = await client.query(
      `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`,
      [iduser]
    );
    if (caisseResult.rows.length === 0) {
      throw new Error('Configuration comptable manquante (Caisse utilisateur)');
    }
    const compteCaisseEffective = caisseResult.rows[0].comptecaisse;

    // Récupérer compte auxiliaire client
    const compteauxiResult = await client.query(
      `SELECT compteauxiliaire FROM gclients WHERE idclients = $1`,
      [idclients]
    );
    if (compteauxiResult.rows.length === 0) {
      throw new Error('Configuration comptable manquante (Compte auxiliaire client)');
    }
    const compteauxiliaireEffective = compteauxiResult.rows[0].compteauxiliaire;









    // Vérifier si un idop existe déjà pour ce codeopdetail
const checkQuery = `SELECT idop FROM public.goperation_detail WHERE codeopdetail = $1`;
const checkResult = await client.query(checkQuery, [codeopdetail]);

let idop;
if (checkResult.rows.length > 0) {
  // Réutiliser l'idop existant
  idop = checkResult.rows[0].idop;
} else {
  // Générer un nouvel idop
  const maxQuery = `SELECT COALESCE(MAX(idop),0)+1 AS nextidop FROM public.goperation_detail`;
  const maxResult = await client.query(maxQuery);
  idop = maxResult.rows[0].nextidop;
}

// Calculer numeroligne pour distinguer les lignes
const ligneQuery = `SELECT COALESCE(MAX(numeroligne),0)+1 AS nextligne FROM public.goperation_detail WHERE idop = $1`;
const ligneResult = await client.query(ligneQuery, [idop]);
const numeroligne = ligneResult.rows[0].nextligne;

// Insérer la ligne
const insertQuery = `
  INSERT INTO public.goperation_detail (
    idop, idagence, codeopdetail, comptedebit, comptecredit, etat, dateoperation,
    idjrnal, idmois, idannee, iduser, idclients,
    prixpublic, prixbase, taux,
    montantassure, montantassurance,
    montantpayeassure, montantpayeassurance, montantrecu, montantrelicat,
    idassureur, datesaisie, datevalidation, idmodel,numeroligne
  )
  VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,
    $9,$10,$11,$12,$13,
    $14,$15,$16,
    $17,$18,
    $19,$20,$21,$22,
    $23,$24,$25,$26
  )
  RETURNING *;
`;

const values = [
  idop, idagence, codeopdetail, comptedebit, comptecredit, etat, dateoperation,
  idjrnal, idmois, idannee, iduser, idclients,
  prixpublic ?? 0, prixbase ?? 0, taux ?? 0,
  montantassure ?? 0, montantassurance ?? 0,
  montantpayeassure ?? 0, montantpayeassurance ?? 0, montantrecu ?? 0, montantrelicat ?? 0,
  idassureur, datesaisie, datevalidation, idmodel,numeroligne
];


/*
    // Insérer la ligne dans goperation_detail
    const insertQuery = `
      INSERT INTO public.goperation_detail (
        idop, idagence, codeopdetail, comptedebit, comptecredit, etat, dateoperation,
        idjrnal, idmois, idannee, iduser, idclients,
        prixpublic, prixbase, taux,
        montantassure, montantassurance,
        montantpayeassure, montantpayeassurance, montantrecu, montantrelicat,
        idassureur, datesaisie, datevalidation,idmodel
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,
        $13,$14,$15,
        $16,$17,
        $18,$19,$20,$21,
        $22,$23,$24,$25
      )
      RETURNING *;
    `;
    const values = [
      idop, idagence, codeopdetail, comptedebit, comptecredit, etat, dateoperation,
      idjrnal, idmois, idannee, iduser, idclients,
      prixpublic ?? 0, prixbase ?? 0, taux ?? 0,
      montantassure ?? 0, montantassurance ?? 0,
      montantpayeassure ?? 0, montantpayeassurance ?? 0, montantrecu ?? 0, montantrelicat ?? 0,
      idassureur, datesaisie, datevalidation,idmodel
    ];

*/






    const result = await client.query(insertQuery, values);
    const insertedRow = result.rows[0];

    // ✅ Comptabilisation automatique
  const montantAssureNum = parseFloat(insertedRow.montantassure ?? 0);
const montantAssuranceNum = parseFloat(insertedRow.montantassurance ?? 0);
const montantPayeAssureNum = parseFloat(insertedRow.montantpayeassure ?? 0);
const montantPayeAssuranceNum = parseFloat(insertedRow.montantpayeassurance ?? 0);

const montantTotal = montantAssureNum + montantAssuranceNum;




    // Fonction utilitaire pour insérer UNE écriture
    async function insertLigneEcriture(libelle, compte, montantDebit, montantCredit, idtiersValue) {
      await client.query(`
        INSERT INTO TMVTTHEORIQUE (
          idtmvth, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
          MONTANTDEBIT, MONTANTCREDIT,
          IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
        ) VALUES (
           $1, $2, $3, $4, $5,
          $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15, $16,$17
        )
      `, [
        codeopdetail,dateoperation, idjrnal, compte, idtiersValue, libelle,
        montantDebit, montantCredit,
        iduser, idmois, idannee, codeopdetail, idclients,
        idagence, idjrnal, idop, idtiersValue
      ]);
    }





    // Positionnement (2 écritures)
if (montantTotal > 0) {
  await insertLigneEcriture('Positionnement opération', compteauxiliaireEffective, montantTotal, 0, idclients ?? null);
  await insertLigneEcriture('Positionnement opération', comptecredit, 0, montantTotal, null);
}

// Règlement assuré (2 écritures)
if (insertedRow.montantpayeassure > 0) {
  await insertLigneEcriture('Règlement assuré', compteCaisseEffective, insertedRow.montantpayeassure, 0, null);
  await insertLigneEcriture('Règlement assuré', compteauxiliaireEffective, 0, insertedRow.montantpayeassure, idclients ?? null);
}

/*
// Règlement assurance (2 écritures)
if (insertedRow.montantpayeassurance > 0) {
  await insertLigneEcriture('Règlement assurance', compteCaisseEffective, insertedRow.montantpayeassurance, 0, null);
  await insertLigneEcriture('Règlement assurance', comptecredit, 0, insertedRow.montantpayeassurance, idassureur ?? null);
}
  */


    /*
    // Positionnement (2 écritures)
  if (insertedRow.montantTotal > 0) {
  await insertLigneEcriture('Positionnement opération', compteauxiliaireEffective, montantTotal, 0, idclients ?? 0);
  await insertLigneEcriture('Positionnement opération', comptecredit, 0, montantTotal, 0);
}



    // Règlement assuré (2 écritures)
    if (montantpayeassure > 0) {
      await insertLigneEcriture('Règlement assuré', compteCaisseEffective, insertedRow.montantpayeassure, 0, 0);
      await insertLigneEcriture('Règlement assuré', compteauxiliaireEffective, 0, insertedRow.montantpayeassure, idclients ?? 0);
    }
      

    // Règlement assurance (2 écritures)
    if (insertedRow.montantpayeassurance > 0) {
      await insertLigneEcriture('Règlement assurance', compteCaisseEffective, insertedRow.montantpayeassurance, 0, 0);
      await insertLigneEcriture('Règlement assurance', comptecredit, 0, insertedRow.montantpayeassurance, idassureur ?? 0);
    }
*/





    // ✅ Mise à jour de la datevalidation
    await client.query(`
      UPDATE public.goperation_detail
      SET datevalidation = $1
      WHERE idop = $2
    `, [dateoperation, idop]);

    await client.query('COMMIT'); // ✅ Valider transaction

    res.status(201).json({
      success: true,
      data: insertedRow,
      message: 'Opération comptabilisée et validée avec succès'
    });
  } catch (err) {
    await client.query('ROLLBACK'); // ❌ Annuler si erreur
    console.error('❌ Erreur insertion/comptabilisation:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});




/*
router.post('/goperation-detail', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Transaction

    const {
      codeopdetail,
      idagence,
      comptedebit,
      comptecredit,
      etat,
      dateoperation,
      idjrnal,
      idmois,
      idannee,
      iduser,
      idclients,
      prixpublic,
      prixbase,
      taux,
      montantassure,
      montantassurance,
      montantpayeassure,
      montantpayeassurance,
      montantrecu,
      montantrelicat,
      idassureur,
      datesaisie,
      datevalidation,
      idmodel
    } = req.body;

    // 🔹 Déterminer idop
    let idop;
    const checkQuery = `SELECT idop FROM public.goperation_detail WHERE codeopdetail = $1`;
    const checkResult = await client.query(checkQuery, [codeopdetail]);

    if (checkResult.rows.length > 0) {
      // Réutiliser l'idop existant
      idop = checkResult.rows[0].idop;
    } else {
      // Générer un nouvel idop
      const maxQuery = `SELECT COALESCE(MAX(idop),0)+1 AS nextidop FROM public.goperation_detail`;
      const maxResult = await client.query(maxQuery);
      idop = maxResult.rows[0].nextidop;
    }

    // 🔹 Calculer numeroligne pour distinguer les lignes
    const ligneQuery = `SELECT COALESCE(MAX(numeroligne),0)+1 AS nextligne FROM public.goperation_detail WHERE idop = $1`;
    const ligneResult = await client.query(ligneQuery, [idop]);
    const numeroligne = ligneResult.rows[0].nextligne;

    // 🔹 Récupérer comptes
    const caisseResult = await client.query(
      `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`,
      [iduser]
    );
    if (caisseResult.rows.length === 0) {
      throw new Error('Configuration comptable manquante (Caisse utilisateur)');
    }
    const compteCaisseEffective = caisseResult.rows[0].comptecaisse;

    const compteauxiResult = await client.query(
      `SELECT compteauxiliaire FROM gclients WHERE idclients = $1`,
      [idclients]
    );
    if (compteauxiResult.rows.length === 0) {
      throw new Error('Configuration comptable manquante (Compte auxiliaire client)');
    }
    const compteauxiliaireEffective = compteauxiResult.rows[0].compteauxiliaire;

    // 🔹 Insérer la ligne
    const insertQuery = `
      INSERT INTO public.goperation_detail (
        idop, numeroligne, idagence, codeopdetail, comptedebit, comptecredit, etat, dateoperation,
        idjrnal, idmois, idannee, iduser, idclients,
        prixpublic, prixbase, taux,
        montantassure, montantassurance,
        montantpayeassure, montantpayeassurance, montantrecu, montantrelicat,
        idassureur, datesaisie, datevalidation, idmodel
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,
        $14,$15,$16,
        $17,$18,
        $19,$20,$21,$22,
        $23,$24,$25,$26
      )
      RETURNING *;
    `;

    const values = [
      idop, numeroligne, idagence, codeopdetail, comptedebit, comptecredit, etat, dateoperation,
      idjrnal, idmois, idannee, iduser, idclients,
      prixpublic ?? 0, prixbase ?? 0, taux ?? 0,
      montantassure ?? 0, montantassurance ?? 0,
      montantpayeassure ?? 0, montantpayeassurance ?? 0, montantrecu ?? 0, montantrelicat ?? 0,
      idassureur, datesaisie, datevalidation, idmodel
    ];

    const result = await client.query(insertQuery, values);
    const insertedRow = result.rows[0];

    // ✅ Comptabilisation automatique
    const montantTotal = parseFloat(insertedRow.montantassure ?? 0) + parseFloat(insertedRow.montantassurance ?? 0);

    async function insertLigneEcriture(libelle, compte, montantDebit, montantCredit, idtiersValue) {
      await client.query(`
        INSERT INTO TMVTTHEORIQUE (
          idtmvth, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
          MONTANTDEBIT, MONTANTCREDIT,
          IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
        ) VALUES (
           $1, $2, $3, $4, $5,
          $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15, $16,$17
        )
      `, [
        codeopdetail, dateoperation, idjrnal, compte, idtiersValue, libelle,
        montantDebit, montantCredit,
        iduser, idmois, idannee, codeopdetail, idclients,
        idagence, idjrnal, idop, idtiersValue
      ]);
    }

    if (montantTotal > 0) {
      await insertLigneEcriture('Positionnement opération', compteauxiliaireEffective, montantTotal, 0, idclients ?? null);
      await insertLigneEcriture('Positionnement opération', comptecredit, 0, montantTotal, null);
    }

    if (insertedRow.montantpayeassure > 0) {
      await insertLigneEcriture('Règlement assuré', compteCaisseEffective, insertedRow.montantpayeassure, 0, null);
      await insertLigneEcriture('Règlement assuré', compteauxiliaireEffective, 0, insertedRow.montantpayeassure, idclients ?? null);
    }

    await client.query(`
      UPDATE public.goperation_detail
      SET datevalidation = $1
      WHERE idop = $2
    `, [dateoperation, idop]);


     


    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: insertedRow,
      message: 'Opération comptabilisée et validée avec succès'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur insertion/comptabilisation:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

*/

router.post('/goperation-detail', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Début de transaction

    const {
      codeopdetail,
      idagence,
      comptedebit,
      comptecredit,
      etat,
      dateoperation,
      idjrnal,
      idmois,
      idannee,
      iduser,
      idclients,
      prixpublic,
      prixbase,
      taux,
      montantassure,
      montantassurance,
      montantpayeassure,
      montantpayeassurance,
      montantrecu,
      montantrelicat,
      idassureur,
      datesaisie,
      idmodel
    } = req.body;

    // 1. Déterminer l'idop
    let idop;
    const checkQuery = `SELECT idop FROM public.goperation_detail WHERE codeopdetail = $1 LIMIT 1`;
    const checkResult = await client.query(checkQuery, [codeopdetail]);

    if (checkResult.rows.length > 0) {
      idop = checkResult.rows[0].idop;
    } else {
      const maxQuery = `SELECT COALESCE(MAX(idop), 0) + 1 AS nextidop FROM public.goperation_detail`;
      const maxResult = await client.query(maxQuery);
      idop = maxResult.rows[0].nextidop;
    }

    // 2. Calculer le numéro de ligne
    const ligneQuery = `SELECT COALESCE(MAX(numeroligne), 0) + 1 AS nextligne FROM public.goperation_detail WHERE idop = $1`;
    const ligneResult = await client.query(ligneQuery, [idop]);
    const numeroligne = ligneResult.rows[0].nextligne;

    // 3. Insertion de la ligne de détail (datevalidation est mis à null pour déclencher la comptabilisation initiale)
    const insertQuery = `
      INSERT INTO public.goperation_detail (
        idop, idagence, codeopdetail, comptedebit, comptecredit, etat, dateoperation,
        idjrnal, idmois, idannee, iduser, idclients,
        prixpublic, prixbase, taux,
        montantassure, montantassurance,
        montantpayeassure, montantpayeassurance, montantrecu, montantrelicat,
        idassureur, datesaisie, datevalidation, idmodel, numeroligne, ref_piece
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
        $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      )
      RETURNING *;
    `;

    const values = [
      idop, idagence, codeopdetail, comptedebit, comptecredit, etat, dateoperation,
      idjrnal, idmois, idannee, iduser, idclients,
      prixpublic ?? 0, prixbase ?? 0, taux ?? 0,
      montantassure ?? 0, montantassurance ?? 0,
      montantpayeassure ?? 0, montantpayeassurance ?? 0, montantrecu ?? 0, montantrelicat ?? 0,
      idassureur, datesaisie, null, idmodel, numeroligne, codeopdetail
    ];

    const result = await client.query(insertQuery, values);
    const insertedRow = result.rows[0];

    // 4. Validation automatique de l'opération
    // Cette étape déclenche une mise à jour qui fige les écritures comptables via le trigger
    
    await client.query(`
      UPDATE public.goperation_detail
      SET datevalidation = $1
      WHERE idop = $2
    `, [dateoperation, idop]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: insertedRow,
      message: 'Opération enregistrée, cumulée et comptabilisée avec succès'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Erreur lors de l'insertion :", err);
    res.status(500).json({
        success: false,
        error: err.message
    });
}
 finally {
    client.release();
  }
});






router.post('/annuler-operation/:idop', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { idop } = req.params;
    const { iduser, idmois, idannee } = req.body; // infos nécessaires

    // Récupérer l'opération
    const opResult = await client.query(
      `SELECT * FROM public.goperation_detail WHERE idop = $1`,
      [idop]
    );
    if (opResult.rows.length === 0) {
      throw new Error('Opération introuvable');
    }
    const op = opResult.rows[0];

    // Marquer comme annulée
    await client.query(
      `UPDATE public.goperation_detail SET etat = 'ANNULE', datevalidation = NOW() WHERE idop = $1`,
      [idop]
    );

    // Fonction utilitaire pour insérer une écriture inverse
    async function insertLigneEcritureInverse(libelle, compte, montantDebit, montantCredit, idtiersValue) {
      await client.query(`
        INSERT INTO TMVTTHEORIQUE (
          idtmvth, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
          MONTANTDEBIT, MONTANTCREDIT,
          IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
        ) VALUES (
           $1, $2, $3, $4, $5,
          $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15, $16,$17
        )
      `, [
        op.codeopdetail + '_ANNUL', // identifiant unique
        new Date(), op.idjrnal, compte, idtiersValue, libelle,
        montantDebit, montantCredit,
        iduser, idmois, idannee, op.codeopdetail, op.idclients,
        op.idagence, op.idjrnal, idop, idtiersValue
      ]);
    }

    // Inverser les écritures précédentes
    const montantTotal = parseFloat(op.montantassure ?? 0) + parseFloat(op.montantassurance ?? 0);

    if (montantTotal > 0) {
      await insertLigneEcritureInverse('Annulation positionnement', op.comptecredit, montantTotal, 0, null);
      await insertLigneEcritureInverse('Annulation positionnement', op.compteauxiliaire, 0, montantTotal, op.idclients ?? null);
    }

    if (op.montantpayeassure > 0) {
      await insertLigneEcritureInverse('Annulation règlement assuré', op.compteauxiliaire, op.montantpayeassure, 0, op.idclients ?? null);
      await insertLigneEcritureInverse('Annulation règlement assuré', op.comptecaisse, 0, op.montantpayeassure, null);
    }

    if (op.montantpayeassurance > 0) {
      await insertLigneEcritureInverse('Annulation règlement assurance', op.comptecredit, op.montantpayeassurance, 0, op.idassureur ?? null);
      await insertLigneEcritureInverse('Annulation règlement assurance', op.comptecaisse, 0, op.montantpayeassurance, null);
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Opération annulée et écritures inverses générées'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur annulation:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});



router.get('/rapportgoperation_detail', async (req, res) => {
  const { idagence, datedebut, datefin } = req.query;

  // Validation stricte
  const idAgenceInt = parseInt(idagence, 10);
  if (!Number.isInteger(idAgenceInt) || !datedebut || !datefin) {
    return res.status(400).json({
      error: 'Paramètres invalides : "idagence", "datedebut" et "datefin" sont obligatoires.'
    });
  }

  const values = [idAgenceInt, datedebut, datefin];

  const queryText = `
    SELECT
      gopd.idopdetail,
      gopd.idop,
      gopd.idagence,
      gopd.idmodel,
      concat_ws(' ', ut.nom, ut.prenom) AS utilisateur,
      gm.designation AS prestation,
      gopd.etat,
      gopd.dateoperation,
      gopd.idjrnal,
      gopd.idmois,
      gopd.idannee,
      gopd.iduser,
      gopd.idclients,
      concat_ws(' ', gcl.nom, gcl.prenom) AS clients,
      gopd.prixbase,
      gopd.prixpublic,
      gopd.taux,
      gopd.montantassure,
      gopd.montantassurance,
      gopd.montantpayeassure,
      gopd.montantpayeassurance,
      gopd.montantrecu,
      gopd.montantrelicat,
      gopd.idassureur,
      ass.designation AS assurance,
      gopd.codeopdetail
    FROM goperation_detail gopd
      INNER JOIN fina_model gm ON gm.idmodel = gopd.idmodel
      INNER JOIN gclients gcl   ON gcl.idclients   = gopd.idclients
      LEFT  JOIN utilisateur ut ON ut.iduser = gopd.iduser
      LEFT  JOIN s_assureur ass ON ass.idassureur = gopd.idassureur
    WHERE gopd.etat = 'true'
      AND gopd.idagence = $1
      AND gopd.dateoperation BETWEEN $2 AND $3
    ORDER BY gopd.idopdetail DESC
  `;

  try {
    console.time('rapportgoperation_detail');
    const { rows } = await pool.query(queryText, values);
    console.timeEnd('rapportgoperation_detail');

    res.json({
      meta: {
        count: rows.length
      },
      data: rows
    });
  } catch (err) {
    console.error('Erreur GET /rapportgoperation_detail:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


















module.exports = router;









/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ✅ Route POST pour insérer une ligne dans goperation_detail
router.post('/goperation-detail', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      codeopdetail,
      idagence,
      comptedebit,
      comptecredit,
      etat,
      dateoperation,
      idjrnal,
      idmois,
      idannee,
      iduser,
      idclients,
      prixpublic,
      prixbase,
      taux,
      montantassure,
      montantassurance,
      montantpayeassure,
      montantpayeassurance,
      montantrecu,
      montantrelicat,
      idassureur,
      datesaisie,
      datevalidation
    } = req.body;

    // 1️⃣ Vérifier si ce codeopdetail existe déjà
    const checkQuery = `SELECT idop FROM public.goperation_detail WHERE codeopdetail = $1 LIMIT 1`;
    const checkResult = await client.query(checkQuery, [codeopdetail]);

    let idop;
    if (checkResult.rows.length > 0) {
      // Déjà existant → réutiliser le même idop
      idop = checkResult.rows[0].idop;
    } else {
      // Nouveau codeopdetail → incrémenter idop
      const maxQuery = `SELECT COALESCE(MAX(idop),0)+1 AS nextidop FROM public.goperation_detail`;
      const maxResult = await client.query(maxQuery);
      idop = maxResult.rows[0].nextidop;
    }

    // 2️⃣ Insérer la ligne avec l’idop calculé
    const insertQuery = `
      INSERT INTO public.goperation_detail (
        idop, idagence, codeopdetail, comptedebit, comptecredit, etat, dateoperation,
        idjrnal, idmois, idannee, iduser, idclients,
        prixpublic, prixbase, taux,
        montantassure, montantassurance,
        montantpayeassure,montantpayeassurance, montantrecu, montantrelicat,
        idassureur, datesaisie, datevalidation
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,
        $13,$14,$15,
        $16,$17,
        $18,$19,$20,
        $21,$22,$23,$24
      )
      RETURNING *;
    `;

    const values = [
      idop, idagence, codeopdetail, comptedebit, comptecredit, etat, dateoperation,
      idjrnal, idmois, idannee, iduser, idclients,
      prixpublic ?? 0, prixbase ?? 0, taux ?? 0,
      montantassure ?? 0, montantassurance ?? 0,
      montantpayeassure ?? 0,montantpayeassurance ?? 0, montantrecu ?? 0, montantrelicat ?? 0,
      idassureur, datesaisie, datevalidation
    ];

    const result = await client.query(insertQuery, values);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('❌ Erreur insertion goperation_detail:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
*/
