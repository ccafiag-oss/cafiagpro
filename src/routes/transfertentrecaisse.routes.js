const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/', async (req, res) => {
  const client = await pool.connect(); // On récupère un client pour la transaction
  try {
    const {
      codetransf,
      codetypeop,
      codejrnl,
      codemodelop,
      date,
      iduseremeteur,
      iduserdestinateur,
      comptecaisseemeteur,
      comptecaissedestinateur,
      idagence,
      datevalidation,
      // Champs pour toperation
      idclient,
      codeclient,
      iduser,
      montant,
      libele,
      comptedebit,
      comptecredit,
      codeop
    } = req.body;

    // Vérification des champs obligatoires
    if (!codetransf || !codetypeop || !date || !iduseremeteur || !iduserdestinateur ||
        !comptecaisseemeteur || !comptecaissedestinateur || !idagence ||
        !iduser || !montant || !comptedebit || !comptecredit
    ) {
      return res.status(400).json({ error: 'Champs obligatoires manquants.' });
    }

    await client.query('BEGIN'); // Début de la transaction

    // 1️⃣ Insertion dans transfertcaisse
    const insertTransfertQuery = `
      INSERT INTO transfertcaisse (
        codetransf, codetypeop, codejrnl, codemodelop, date,
        iduseremeteur, iduserdestinateur,
        comptecaisseemeteur, comptecaissedestinateur,
        idagence, datevalidation
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;
    `;

    const transfertValues = [
      codetransf,
      codetypeop,
      codejrnl || null,
      codemodelop || null,
      date,
      iduseremeteur,
      iduserdestinateur,
      comptecaisseemeteur,
      comptecaissedestinateur,
      idagence,
      datevalidation || null
    ];

    const { rows: transfertRows } = await client.query(insertTransfertQuery, transfertValues);

    // 2️⃣ Insertion dans toperation
    const insertTopQuery = `
      INSERT INTO toperation (
        codeop, codetypeop, codejrnl, codemodelop, date,
        idclient, codeclient, iduser, montant, libele,
        comptedebit, comptecredit
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *;
    `;

    const topValues = [
      codeop || codetransf,  // On peut utiliser codetransf comme codeop si non fourni
      codetypeop,
      codejrnl || null,
      codemodelop || null,
      date,
      idclient || null,
      codeclient || null,
      iduser,
      montant,
      libele || 'Transfert caisse',
      comptedebit,
      comptecredit
    ];

    const { rows: topRows } = await client.query(insertTopQuery, topValues);

    await client.query('COMMIT'); // Validation de la transaction

    res.status(201).json({
      message: 'Transfert caisse et opération enregistrés avec succès',
      transfert: transfertRows[0],
      operation: topRows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK'); // Annule si erreur
    console.error('Erreur transaction:', err.message);
    res.status(500).json({
      error: 'Erreur serveur lors de l\'enregistrement',
      details: err.message
    });
  } finally {
    client.release(); // Libération du client PostgreSQL
  }
});

module.exports = router;