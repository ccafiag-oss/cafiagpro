const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/remboursementmobile', async (req, res) => {
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
      frais,
      iduser,
      idagence,
      telephone,
      datevalidation,
      etat
    } = req.body;

    // ✅ Vérification des champs obligatoires
    if (!codedec || !idclients || !period || !montant) {
      client.release();
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    await client.query('BEGIN');

    // ✅ Insert remboursement
    const insertRemb = `
      INSERT INTO remboursementmobilmoney(
        coderemb, date_remb, idclients, codeclients,
        codedec, period, montant, capital, interet, frais,
        iduser, idagence, telephone, datevalidation, etat
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *;
    `;

    const rembValues = [
      coderemb, date_remb, idclients, codeclients,
      codedec, period, montant, capital, interet, frais,
      iduser, idagence, telephone, datevalidation, etat
    ];

    const rembResult = await client.query(insertRemb, rembValues);

    await client.query('COMMIT');
    res.status(201).json(rembResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("💥 Erreur lors de l'insertion remboursement:", err);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
