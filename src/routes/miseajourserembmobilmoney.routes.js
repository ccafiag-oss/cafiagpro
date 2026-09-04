const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { exportLogger } = require('../logs/logger');

/* =======================================================
   🔹 ROUTE MISE A JOUR ETAT MOBILE MONEY
======================================================= */
router.post('/misejoureetatmobilemoney', async (req, res) => {
  const client = await pool.connect();

  try {
    const { idrembmomo } = req.body;

    // ✅ Vérification obligatoire
    if (idrembmomo == null) {
      return res.status(400).json({
        success: false,
        message: "idrembmomo est obligatoire"
      });
    }

    await client.query('BEGIN');

    // ✅ Mise à jour
    const result = await client.query(`
      UPDATE remboursementmobilmoney
      SET etatvalidation = 'valider',
          datevalidation = NOW()
      WHERE id = $1
      RETURNING id, etatvalidation, datevalidation
    `, [parseInt(idrembmomo)]);

    // ✅ Vérifier si ligne trouvée
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: "Aucun enregistrement trouvé pour cet ID"
      });
    }

    await client.query('COMMIT');

    exportLogger?.info("Mise à jour Mobile Money réussie", {
      idrembmomo,
      rowCount: result.rowCount
    });

    return res.status(200).json({
      success: true,
      message: "Etat Mobile Money mis à jour avec succès",
      data: result.rows[0]
    });

  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}

    exportLogger?.error("Erreur mise à jour Mobile Money", {
      message: err.message,
      code: err.code,
      detail: err.detail
    });

    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message
    });

  } finally {
    client.release();
  }
});

module.exports = router;