const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { exportLogger } = require('../logs/logger');

/* =======================================================
   🔹 ROUTE UPDATE DECAISSEMENT
======================================================= */
router.post('/updatedecaissement', async (req, res) => {

  const client = await pool.connect();

  try {
    const { idclients } = req.body;

    if (!idclients) {
      return res.status(400).json({ error: "idclients est requis" });
    }

    await client.query('BEGIN');

    /* =====================================================
       🔹 Mise à jour des remboursements par client
       Prise en compte du cas où aucun remboursement n'existe
    ===================================================== */
    const updateDecaissementQuery = `
      UPDATE decaissement d
      SET rembcapital = COALESCE(
            (SELECT SUM(r.capital) 
             FROM remboursement r 
             WHERE r.codedec = d.codedec 
               AND r.idclients = $1), 
            0
          ),
          rembinteret = COALESCE(
            (SELECT SUM(r.interet) 
             FROM remboursement r 
             WHERE r.codedec = d.codedec 
               AND r.idclients = $1), 
            0
          )
      WHERE d.idclients = $1
        AND d.datevalidation IS NULL;
    `;

    await client.query(updateDecaissementQuery, [idclients]);

    await client.query('COMMIT');

    /* =====================================================
       🔹 Requête de debug / détails pour vérification
    ===================================================== */
    const debugResult = await client.query(`
      SELECT codedec,
             COALESCE(soldeencourstotal, 0) AS soldeencourstotal,
             (capital + interet + autrescommission + fraisoperateur) AS total_attendu,
             (COALESCE(soldeencourstotal, 0) -
              (capital + interet + autrescommission + fraisoperateur)) AS ecart,
             datevalidation
      FROM decaissement
      WHERE idclients = $1;
    `, [idclients]);

    exportLogger?.info("Décaissement mis à jour", { idclients });

    return res.status(200).json({
      message: "Décaissement mis à jour avec succès",
      details: debugResult.rows
    });

  } catch (err) {
    try { 
      await client.query('ROLLBACK'); 
    } catch (rollbackErr) {
      exportLogger?.error("Erreur lors du ROLLBACK", { message: rollbackErr.message });
    }

    exportLogger?.error("Erreur update decaissement", {
      message: err.message,
      stack: err.stack
    });

    return res.status(500).json({
      error: "Erreur serveur",
      message: err.message
    });

  } finally {
    client.release();
  }
});

module.exports = router;



/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { exportLogger } = require('../logs/logger');

/* =======================================================
   🔹 ROUTE UPDATE DECAISSEMENT
======================================================= */

/*
router.post('/updatedecaissement', async (req, res) => {

  const client = await pool.connect();

  try {
    const { idclients } = req.body;

    if (!idclients) {
      return res.status(400).json({ error: "idclients est requis" });
    }

    await client.query('BEGIN');

    /* =====================================================
       🔹 Mise à jour des remboursements par client
    ===================================================== */

    /*
    const updateDecaissementQuery = `
      UPDATE decaissement d
      SET rembcapital = COALESCE(r.sum_capital, 0),
          rembinteret = COALESCE(r.sum_interet, 0)
      FROM (
          SELECT codedec,
                 SUM(capital) AS sum_capital,
                 SUM(interet) AS sum_interet
          FROM remboursement
          WHERE idclients = $1
          GROUP BY codedec
      ) r
      WHERE d.codedec = r.codedec
        AND d.idclients = $1
        AND d.datevalidation IS NULL;
    `;

    await client.query(updateDecaissementQuery, [idclients]);

    await client.query('COMMIT');

    /* =====================================================
       🔹 Requête de debug / détails pour vérification
    ===================================================== */

    /*
    const debugResult = await client.query(`
      SELECT codedec,
             COALESCE(soldeencourstotal,0) AS soldeencourstotal,
             (capital + interet + autrescommission + fraisoperateur) AS total_attendu,
             (COALESCE(soldeencourstotal,0) -
              (capital + interet + autrescommission + fraisoperateur)) AS ecart,
             datevalidation
      FROM decaissement
      WHERE idclients = $1;
    `, [idclients]);

    exportLogger?.info("Décaissement mis à jour", { idclients });

    return res.status(200).json({
      message: "Décaissement mis à jour avec succès",
      details: debugResult.rows
    });

  } catch (err) {

    try { await client.query('ROLLBACK'); } catch {}

    exportLogger?.error("Erreur update decaissement", {
      message: err.message,
      stack: err.stack
    });

    return res.status(500).json({
      error: "Erreur serveur",
      message: err.message
    });

  } finally {
    client.release();
  }
});

module.exports = router;
*/