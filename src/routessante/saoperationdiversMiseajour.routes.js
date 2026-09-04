const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 1. OBTENIR LE RAPPORT (Mis à jour pour retourner comptes et infos clients)
router.get('/rapportgoperation_detailmjr', async (req, res) => {
  const { idagence, datedebut, datefin } = req.query;

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
      gcl.telephone,
      gcl.codeclients,
      gcl.adresse,
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
      gopd.codeopdetail,
      gopd.comptedebit,
      gopd.comptecredit
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
      meta: { count: rows.length },
      data: rows
    });
  } catch (err) {
    console.error('Erreur GET /rapportgoperation_detail:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// 2. ENREGISTRER UNE NOUVELLE OPÉRATION (POST existant)
router.post('/goperation-detailmjr', async (req, res) => {


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

    
  // ... Conserver votre code POST initial ici sans modification ...
});






// 3. METTRE À JOUR OU ANNULER UNE OPÉRATION (PUT - NOUVEAU)
router.put('/goperation-detailmjrOLDE/:codeopdetail', async (req, res) => {
  const { codeopdetail } = req.params;
  const {
    idagence,
    iduser,
    idclients,
    dateoperation,
    lignes // Tableau de nouvelles lignes d'opération
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Transaction

    // Récupérer l'idop d'origine pour conserver la cohérence
    const origResult = await client.query(
      `SELECT DISTINCT idop FROM public.goperation_detail WHERE codeopdetail = $1`,
      [codeopdetail]
    );

    let idop;
    if (origResult.rows.length > 0) {
      idop = origResult.rows[0].idop;
    } else {
      const maxQuery = `SELECT COALESCE(MAX(idop),0)+1 AS nextidop FROM public.goperation_detail`;
      const maxResult = await client.query(maxQuery);
      idop = maxResult.rows[0].nextidop;
    }

    // Nettoyer les anciennes lignes de l'opération et de la comptabilité
    await client.query(`DELETE FROM public.goperation_detail WHERE codeopdetail = $1`, [codeopdetail]);
    await client.query(`DELETE FROM TMVTTHEORIQUE WHERE idtmvth = $1`, [codeopdetail]);

    // Cas "Annuler l'opération" (si toutes les lignes ont été supprimées)
    if (!lignes || lignes.length === 0) {
      await client.query('COMMIT');
      return res.status(200).json({
        success: true,
        message: 'Opération supprimée et annulée avec succès'
      });
    }

    // Récupérer les configurations comptables
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

    // Helper d'écriture comptable
    async function insertLigneEcriture(libelle, compte, montantDebit, montantCredit, idtiersValue, idjrnal) {
      await client.query(`
        INSERT INTO TMVTTHEORIQUE (
          idtmvth, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
          MONTANTDEBIT, MONTANTCREDIT,
          IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15, $16, $17
        )
      `, [
        codeopdetail, dateoperation, idjrnal, compte, idtiersValue, libelle,
        montantDebit, montantCredit,
        iduser, new Date(dateoperation).getMonth() + 1, new Date(dateoperation).getFullYear(), codeopdetail, idclients,
        idagence, idjrnal, idop, idtiersValue
      ]);
    }

    // Insérer les nouvelles lignes et recréer les écritures
    let numeroligne = 1;
    for (const ligne of lignes) {
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
          $23,NOW(),NOW(),$24
        )
        RETURNING *;
      `;

      const values = [
        idop, numeroligne++, idagence, codeopdetail, ligne.comptedebit, ligne.comptecredit, 'true', dateoperation,
        ligne.idjrnal, new Date(dateoperation).getMonth() + 1, new Date(dateoperation).getFullYear(), iduser, idclients,
        ligne.prixpublic ?? 0, ligne.prixbase ?? 0, ligne.taux ?? 0,
        ligne.montantassure ?? 0, ligne.montantassurance ?? 0,
        ligne.montantassure ?? 0, 0, ligne.montantrecu ?? 0, ligne.montantrelicat ?? 0,
        ligne.idassureur, ligne.idmodel
      ];

      const result = await client.query(insertQuery, values);
      const insertedRow = result.rows[0];

      // Comptabilisation
      const montantTotal = parseFloat(insertedRow.montantassure ?? 0) + parseFloat(insertedRow.montantassurance ?? 0);

      if (montantTotal > 0) {
        await insertLigneEcriture('Positionnement opération', compteauxiliaireEffective, montantTotal, 0, idclients ?? null, ligne.idjrnal);
        await insertLigneEcriture('Positionnement opération', ligne.comptecredit, 0, montantTotal, null, ligne.idjrnal);
      }

      if (insertedRow.montantpayeassure > 0) {
        await insertLigneEcriture('Règlement assuré', compteCaisseEffective, insertedRow.montantpayeassure, 0, null, ligne.idjrnal);
        await insertLigneEcriture('Règlement assuré', compteauxiliaireEffective, 0, insertedRow.montantpayeassure, idclients ?? null, ligne.idjrnal);
      }
    }

    await client.query(`
      UPDATE public.goperation_detail
      SET datevalidation = $1
      WHERE idop = $2
    `, [dateoperation, idop]);

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Opération modifiée et comptabilisée avec succès'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur modification:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});







//// PARTIE MODIFIE TRIGGER


router.put('/goperation-detailmjr/:codeop', async (req, res) => {
  const { codeop } = req.params;
  const { idclients, dateoperation, lignes, idagence, iduser } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Suppression complète
    await client.query('DELETE FROM public.goperation_detail WHERE codeopdetail = $1', [codeop]);

    if (!lignes || lignes.length === 0) {
      await client.query('COMMIT');
      return res.status(200).json({ success: true, message: 'Opération supprimée.' });
    }

    // 2. Requête SQL avec les 27 colonnes
    const insertQuery = `
      INSERT INTO public.goperation_detail (
        idop, idagence, codeopdetail, comptedebit, comptecredit, etat, dateoperation,
        idjrnal, idmois, idannee, iduser, idclients, prixpublic, prixbase, taux,
        montantassure, montantassurance, montantpayeassure, montantpayeassurance, 
        montantrecu, montantrelicat, idassureur, datesaisie, datevalidation, 
        idmodel, numeroligne, ref_piece
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
        $16, $17, $18, $19, $20, $21, $22, NOW(), NOW(), $23, $24, $3
      )
    `;

    // 3. Récupération de l'ID opération
    const idopResult = await client.query('SELECT COALESCE(MAX(idop), 0) + 1 as newid FROM public.goperation_detail');
    const idop = idopResult.rows[0].newid;

    // 4. Insertion des lignes
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      await client.query(insertQuery, [
        idop, 
        idagence, 
        codeop, 
        l.comptedebit, 
        l.comptecredit, 
        true, 
        dateoperation,
        l.idjrnal, 
        parseInt(dateoperation.split('-')[1]), // idmois
        parseInt(dateoperation.split('-')[0]), // idannee
        iduser, 
        idclients, 
        l.prixpublic || 0, 
        l.prixbase || 0, 
        l.taux || 0, 
        l.montantassure || 0, 
        l.montantassurance || 0,
        l.montantpayeassure || 0, // Nouveau
        l.montantpayeassurance || 0, // Nouveau
        l.montantrecu || 0, 
        l.montantrelicat || 0, 
        l.idassureur || 0, 
        l.idmodel, 
        i + 1
      ]);
    }

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Opération mise à jour avec succès.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur mise à jour opération :", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});



module.exports = router;