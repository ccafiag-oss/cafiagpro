const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { exportLogger } = require('../logs/logger');

/* =======================================================
   🔹 ROUTE MISE A JOUR ECHEANCE APRES ANNULATION
======================================================= */
router.post('/misejourannulation', async (req, res) => {

  const client = await pool.connect();

  try {

    const {  idrembmomo } = req.body;

    /* ================================
       🔹 Validation paramètres
    ================================= */
    if (!idrembmomo ) {
      return res.status(400).json({
        error: "idrembmomo  sont obligatoires"
      });
    }

    await client.query('BEGIN');

    /* ==========================================
       1️⃣ Mise à jour remboursement mobile money
    ========================================== */
    if (idrembmomo !== undefined && idrembmomo !== null) {

      const result = await client.query(
        `UPDATE remboursementmobilmoney
         SET etatvalidation = 'nonvalider',
             datevalidation = NOW()
         WHERE id = $1
         RETURNING id`,
        [idrembmomo]
      );

      if (result.rowCount === 0) {
        throw new Error("Remboursement Mobile Money introuvable");
      }
    }

    await client.query('COMMIT');

    exportLogger?.info("Mise à jour échéancier réussie", {
      idrembmomo
    });

    return res.status(200).json({
      success: true,
      message: "Echéancier mis à jour avec succès"
    });

  } catch (err) {

    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {}

    exportLogger?.error("Erreur mise à jour échéancier", {
      message: err.message,
      code: err.code,
      detail: err.detail
    });

    /* ================================
       🔹 Gestion erreurs PostgreSQL
    ================================= */
    if (err.code === '23505') {
      return res.status(400).json({ error: "Doublon détecté" });
    }

    if (err.code === '23503') {
      return res.status(400).json({ error: "Référence invalide" });
    }

    if (err.code === 'P0001') {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({
      error: "Transaction annulée",
      message: err.message
    });

  } finally {
    client.release();
  }
});

module.exports = router;