const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { exportLogger } = require('../logs/logger');

router.post('/remboursementcredit', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      coderemb,
      date_remb,
      idclients,
      codeclients,
      codedec,
      period,
      montant,
      capital,
      interet,
      iduser,
      idagence,
      comptedebit,
      comptecredit,
       idrembmomo
    } = req.body;

    // Validation minimale des données reçues
    if (!coderemb || !codedec || !idclients || !period || !montant || !comptedebit || !comptecredit) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    const dateEffective = date_remb || new Date();

    await client.query('BEGIN');

    // 1️⃣ Un seul insert dans la table remboursement
    // Les colonnes comptedebit et comptecredit sont stockées pour alimenter le trigger
    const queryText = `
      INSERT INTO remboursement(
        coderemb, date_remb, idclients, codeclients,
        codedec, period, montant, capital, interet,
        iduser, idagence, comptedebit, comptecredit,ref_piece
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,$14)
      RETURNING *;
    `;

    const queryValues = [
      coderemb,
      dateEffective,
      idclients,
      codeclients,
      codedec,
      period,
      montant,
      capital || 0,
      interet || 0,
      iduser,
      idagence,
      comptedebit,
      comptecredit,
      coderemb
    ];

    const rembResult = await client.query(queryText, queryValues);

    await client.query('COMMIT');

    return res.status(201).json({
      message: "Remboursement et écritures comptables enregistrés avec succès",
      remboursement: rembResult.rows[0]
    });

  } catch (err) {
    try { 
      await client.query('ROLLBACK'); 
    } catch (rollbackErr) {
      if (exportLogger) exportLogger.error(`Erreur lors du rollback : ${rollbackErr.message}`);
    }

    if (exportLogger) {
      exportLogger.error(`Échec de la transaction remboursement : ${err.message}`);
    }

    return res.status(500).json({
      error: "Transaction annulée",
      message: err.message
    });

  } finally {
    client.release();
  }
});








// 1. Obtenir les remboursements entre deux dates pour une agence donnée
router.post('/remboursements/listeannul', async (req, res) => {
  const { idagence, date_debut, date_fin } = req.body;

  if (!idagence || !date_debut || !date_fin) {
    return res.status(400).json({ error: "Paramètres manquants : idagence, date_debut, date_fin" });
  }

  const query = `
    SELECT 
        r.id, 
        r.coderemb, 
        r.date_remb, 
        r.idclients, 
        r.codeclients, 
        r.codedec, 
        r.period, 
        r.montant, 
        r.capital, 
        r.interet, 
        r.iduser,
        r.idagence, 
        r.comptedebit, 
        r.comptecredit, 
        r.ref_piece,
        d.codedec AS codedec_dec,
        d.nom || ' ' || d.prenoms AS nom_complet,
        d.capital AS capital_dec
    FROM remboursement r
    INNER JOIN public.decaissement d ON d.codedec = r.codedec
    WHERE r.idagence = $1 AND r.date_remb BETWEEN $2 AND $3
    ORDER BY r.date_remb DESC;
  `;

  try {
    const result = await pool.query(query, [idagence, date_debut, date_fin]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Erreur lors de la récupération des remboursements:", error);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des données" });
  }
});






router.post('/remboursements/annuler', async (req, res) => {
  const { ref_piece, idagence } = req.body;

  if (!ref_piece || !idagence) {
    return res.status(400).json({ error: "Paramètres manquants : ref_piece et idagence sont requis." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Récupérer le codedec associé au remboursement avant de supprimer
    const getCodeDec = await client.query(
      `SELECT codedec FROM remboursement WHERE ref_piece = $1 AND idagence = $2 LIMIT 1`,
      [ref_piece, idagence]
    );

    if (getCodeDec.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "Aucun remboursement trouvé pour cette référence." });
    }

    const codedec = getCodeDec.rows[0].codedec;

    // 2. Supprimer le remboursement
    await client.query(
      `DELETE FROM remboursement WHERE ref_piece = $1 AND idagence = $2`, 
      [ref_piece, idagence]
    );

    // 3. Réinitialiser le tableau d'amortissement en utilisant le codedec récupéré
    await client.query(`
      UPDATE tableauamortissementgesecheancedetail
      SET capitalremb = 0, 
          intremb = 0, 
          totalremb = 0, 
          etatr = 'non solder'
      WHERE codedec = $1 AND idagence = $2
    `, [codedec, idagence]);

    // 4. Réinitialiser les totaux dans la table décaissement
    await client.query(`
      UPDATE decaissement
      SET datevalidation = NULL,
          rembcapital = 0,
          rembinteret = 0
      WHERE codedec = $1 AND idagence = $2
    `, [codedec, idagence]);

    await client.query('COMMIT');
    res.status(200).json({ message: "Remboursement annulé et soldes réinitialisés avec succès." });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Erreur lors de l'annulation du remboursement:", error);
    res.status(500).json({ error: "Une erreur interne est survenue lors de l'annulation." });
  } finally {
    client.release();
  }
});
/*
// 2. Supprimer un remboursement par ref_piece et idagence
router.post('/remboursements/annuler', async (req, res) => {
  const { ref_piece, idagence } = req.body;

  if (!ref_piece || !idagence) {
    return res.status(400).json({ error: "Paramètres manquants : ref_piece, idagence" });
  }

  const query = `DELETE FROM remboursement WHERE ref_piece = $1 AND idagence = $2`;

  try {
    const result = await pool.query(query, [ref_piece, idagence]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Aucun remboursement trouvé pour ces critères." });
    }
    res.status(200).json({ message: "Remboursement annulé avec succès." });
  } catch (error) {
    console.error("Erreur lors de l'annulation du remboursement:", error);
    res.status(500).json({ error: "Erreur serveur lors de la suppression" });
  }
});
*/


module.exports = router;







/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { exportLogger } = require('../logs/logger'); // 🔥 manquait

router.post('/remboursementcredit', async (req, res) => {

  const client = await pool.connect();

  try {

    const {
      coderemb,
      date_remb,
      idclients,
      codeclients,
      codedec,
      period,
      montant,
      capital,
      interet,
      iduser,
      idagence,
      codeop,
      codetypeop,
      codejrnl,
      codemodelop,
      libele,
      comptedebit,
      comptecredit,
      idrembmomo
    } = req.body;

    if (!codedec || !idclients || !period || !montant) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

     const d = new Date(date_remb || new Date());

    await client.query('BEGIN');

    // 1️⃣ INSERT remboursement
    const rembResult = await client.query(`
      INSERT INTO remboursement(
        coderemb, date_remb, idclients, codeclients,
        codedec, period, montant, capital, interet,
        iduser, idagence
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;
    `, [
      coderemb, date_remb, idclients, codeclients,
      codedec, period, montant, capital, interet,
      iduser, idagence
    ]);





    
 await passerEcriture(client, [
            coderemb,
            d,
            codejrnl,
            comptedebit,
            0,
            `REMBOURSEMENT CREDIT - ${coderemb}`,
            capital,
            0,
            iduser,
            d.getMonth() + 1,
            d.getFullYear(),
            coderemb,
            coderemb,
            idagence
        ]);

        await passerEcriture(client, [
            coderemb,
            d,
            codejrnl,
            comptecredit,
            codeclients,
            `REMBOURSEMENT CREDIT ${coderemb}`,
            0,
            capital,
            iduser,
            d.getMonth() + 1,
            d.getFullYear(),
            coderemb,
            coderemb,
            idagence
        ]);






    await client.query('COMMIT');

    return res.status(201).json({
      message: "Remboursement effectué avec succès",
      remboursement: rembResult.rows[0],
      ///operation: opResult.rows[0]
    });

  } catch (err) {

    try { await client.query('ROLLBACK'); } catch {}

    return res.status(500).json({
      error: "Transaction annulée",
      message: err.message
    });

  } finally {
    client.release();
  }
});




async function passerEcriture(client, params) {
    const query = `
        INSERT INTO TMVTTHEORIQUE (
            idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
            MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
            CODFACT, REFTIERS, idagence
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )`;
    return await client.query(query, params);
}




module.exports = router;

*/
    