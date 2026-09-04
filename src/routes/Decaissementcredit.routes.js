const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      codedec,
      codedemande,
      date,
      idclients,
      codeclients,
      nom,
      prenoms,
      idarticle,
      article,
      idmodepaiements,
      paiementsduree,
      capital,
      taux,
      idoptionsalerte,
      alerteduree,
      fraisoperateur,
      autrescommission,
      interet,
      comptedebit,
      comptecredit,
      dureetotal,
      idagence,
      iduser,
      coutachat,
      commission,
      avoircaution
    } = req.body;

    if (!codedec || !date || !capital || !comptedebit || !comptecredit) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    await client.query('BEGIN'); // Début de la transaction

    // ==========================================
    // 1️⃣ INSERTION DANS LA TABLE DECAISSEMENT
    // ==========================================
    const insertDecaissement = `
      INSERT INTO decaissement(
        codedec, codedemande, date, idclients, codeclients, nom, prenoms,
        idarticle, article, idmodepaiements, paiementsduree, capital, taux,
        idoptionsalerte, alerteduree, fraisoperateur, autrescommission, interet,
        idagence, iduser, comptedebit, comptecredit, dureetotal, coutachat,
        commission, avoircaution,ref_piece
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
      RETURNING *;
    `;

    const decValues = [
      codedec, codedemande, date, idclients, codeclients, nom, prenoms,
      idarticle, article, idmodepaiements, paiementsduree, capital, taux,
      idoptionsalerte, alerteduree, fraisoperateur, autrescommission, interet,
      idagence, iduser, comptedebit, comptecredit, dureetotal, coutachat,
      commission, avoircaution,codedec
    ];

    const decResult = await client.query(insertDecaissement, decValues);

    // ==========================================
    // 2️⃣ MISE À JOUR DE LA DEMANDE DE CRÉDIT
    // ==========================================
    const updateDemande = `
      UPDATE demandecredit
      SET datedecaissement = $1
      WHERE codedemande = $2
      RETURNING *;
    `;
    await client.query(updateDemande, [date, codedemande]);

    await client.query('COMMIT'); // Validation globale (déclenche également le trigger)

    res.status(201).json({
      message: "Décaissement enregistré avec succès (écritures comptables générées par le système)",
      decaissement: decResult.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK'); // Annulation en cas d'erreur
    console.error("Erreur transaction:", err.message);
    res.status(500).json({
      error: "Erreur serveur lors de l'enregistrement",
      details: err.message
    });
  } finally {
    client.release();
  }
});












// ==========================================
// 1️⃣ AFFICHER LES DÉCAISSEMENTS (Recherche par période)
// ==========================================




module.exports = router;






/*

const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      codedec,
      codedemande,
      date,
      idclients,
      codeclients,
      nom,
      prenoms,
      idarticle,
      article,
      idmodepaiements,
      paiementsduree,
      capital,
      taux,
      idoptionsalerte,
      alerteduree,
      fraisoperateur,
      autrescommission,
      interet,
      comptedebit,
      comptecredit,
      dureetotal,
      idagence,

      // Données opération
      codeop,
      codetypeop,
      codejrnl,
      codemodelop,
      iduser,
      montant,
      libele,
       coutachat,
        commission,
        avoircaution
    } = req.body;

    if (!codedec || !date || !capital || !comptedebit || !comptecredit) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    await client.query('BEGIN'); // 🔥 Début transaction

    // =============================
    // 1️⃣ INSERT DECaissement
    // =============================

    const insertDecaissement = `
      INSERT INTO decaissement(
        codedec,
        codedemande,
        date,
        idclients,
        codeclients,
        nom,
        prenoms,
        idarticle,
        article,
        idmodepaiements,
        paiementsduree,
        capital,
        taux,
        idoptionsalerte,
        alerteduree,
        fraisoperateur,
        autrescommission,
        interet,
        idagence,
        iduser,
        comptedebit,
        comptecredit,
        dureetotal,
        coutachat,
        commission,
        avoircaution
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
      RETURNING *;
    `;

    const decValues = [
      codedec,
      codedemande,
      date,
      idclients,
      codeclients,
      nom,
      prenoms,
      idarticle,
      article,
      idmodepaiements,
      paiementsduree,
      capital,
      taux,
      idoptionsalerte,
      alerteduree,
      fraisoperateur,
      autrescommission,
      interet,
      idagence,
      iduser,
      comptedebit,
      comptecredit,
      dureetotal,
       coutachat,
        commission,
        avoircaution
    ];

    const decResult = await client.query(insertDecaissement, decValues);

    // ⚠️ Ici le trigger génère automatiquement l’échéancier


 const d = new Date(date || new Date());

// =============================
// 1️⃣ BIS - UPDATE DEMANDE
// =============================

const updateDemande = `
  UPDATE demandecredit
  SET datedecaissement = $1
WHERE codedemande = $2

  RETURNING *;
`;
await client.query(updateDemande, [date, codedemande]);

////await client.query(updateDemande, [codedemande]);







 await passerEcriture(client, [
            codedec,
            d,
            codejrnl,
            comptedebit,
            codeclients,
            `MISE A DISPOSITION CREDIT - ${codedec}`,
            capital,
            0,
            iduser,
            d.getMonth() + 1,
            d.getFullYear(),
            codedec,
            codedec,
            idagence
        ]);

        await passerEcriture(client, [
            codedec,
            d,
            codejrnl,
            comptecredit,
            0,
            `MISE A DISPOSITION CREDIT ${codedec}`,
            0,
            capital,
            iduser,
            d.getMonth() + 1,
            d.getFullYear(),
            codedec,
            codedec,
            idagence
        ]);






    // =============================
    // 2️⃣ INSERT OPERATION
    // =============================


    /*
    const insertOperation = `
      INSERT INTO toperation(
        codeop,
        codetypeop,
        codejrnl,
        codemodelop,
        date,
        idclient,
        codeclient,
        iduser,
        montant,
        libele,
        comptedebit,
        comptecredit
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *;
    `;

    const opValues = [
      codeop,
      codetypeop,
      codejrnl,
      codemodelop || null,
      date,
      idclients,
      codeclients,
      iduser,
      montant,
      libele || 'Vente à crédit',
      comptedebit,
      comptecredit
    ];
    

    const opResult = await client.query(insertOperation, opValues);

*/


/*
    await client.query('COMMIT'); // ✅ Valide tout

    res.status(201).json({
      message: "Décaissement + Opération enregistrés avec succès",
      decaissement: decResult.rows[0],
      ///operation: opResult.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK'); // ❌ Annule tout si erreur
    console.error("Erreur transaction:", err.message);

    res.status(500).json({
      error: "Erreur serveur",
      details: err.message
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