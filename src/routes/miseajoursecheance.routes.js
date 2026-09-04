
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { exportLogger } = require('../logs/logger');

/* =======================================================
   🔹 ROUTE MISE A JOUR ECHEANCE APRES REMBOURSEMENT
======================================================= */
router.post('/misejourecheance', async (req, res) => {

  const client = await pool.connect();

  try {

    // 🔹 Récupération des données envoyées
    const {
      codedec,
      idclients,
      idrembmomo
    } = req.body;

    if (!codedec || !idclients) {
      return res.status(400).json({ error: "codedec et idclients sont obligatoires" });
    }

  

    /* =====================================================
       1️⃣ Validation Mobile Money si existant
    ===================================================== */
 
     await client.query('BEGIN');

    if (idrembmomo) {
      await client.query(`
        UPDATE remboursementmobilmoney
        SET etatvalidation = 'valider',
            datevalidation = NOW()
        WHERE id = $1
      `, [idrembmomo]);
    }
      
    
     
    /* =====================================================
       2️⃣ Mise à jour tableau amortissement
    ===================================================== */

// Début de la transaction
await client.query('BEGIN');

try {
    // 1. Réinitialisation des valeurs à 0
    const resetQuery = `
      UPDATE tableauamortissementgesecheancedetail
      SET capitalremb = 0, intremb = 0, totalremb = 0
      WHERE codedec = $1 AND idclients = $2;
    `;
    await client.query(resetQuery, [codedec, idclients]);

    // 2. Mise à jour avec les données réelles
    const updateEcheancier = `
      UPDATE tableauamortissementgesecheancedetail t
      SET capitalremb = r.capitalremb,
          intremb     = r.interetremb,
          totalremb   = r.totalremb
      FROM (
          SELECT codedec, idclients, period,
                 SUM(capital) AS capitalremb,
                 SUM(interet) AS interetremb,
                 SUM(montant) AS totalremb
          FROM remboursement
          WHERE codedec = $1
            AND idclients = $2
          GROUP BY codedec, idclients, period
      ) r
      WHERE t.codedec   = r.codedec
        AND t.idclients = r.idclients
        AND t.period    = r.period;
    `;
    await client.query(updateEcheancier, [codedec, idclients]);

    // Validation de la transaction
    await client.query('COMMIT');
    
} catch (error) {
    // En cas d'erreur, on annule tout
    await client.query('ROLLBACK');
    throw error;
}

    /*
    const updateEcheancier = `
      UPDATE tableauamortissementgesecheancedetail t
      SET capitalremb = r.capitalremb,
          intremb     = r.interetremb,
          totalremb   = r.totalremb
      FROM (
          SELECT codedec, idclients, period,
                 SUM(capital) AS capitalremb,
                 SUM(interet) AS interetremb,
                 SUM(montant) AS totalremb
          FROM remboursement
          WHERE codedec = $1
            AND idclients = $2
          GROUP BY codedec, idclients, period
      ) r
      WHERE t.codedec   = r.codedec
        AND t.idclients = r.idclients
        AND t.period    = r.period;
    `;

    await client.query(updateEcheancier, [codedec, idclients]);
*/
    /* =====================================================
       3️⃣ Mise à jour état échéance (corrigé)
       👉 On solde si capitalremb >= capital
    ===================================================== */


    const updateSoldes = `
  UPDATE tableauamortissementgesecheancedetail
  SET etatr = CASE 
    WHEN capitalremb >= capital THEN 'solder'
    ELSE 'non solder'
  END
  WHERE codedec = $1
    AND idclients = $2;
`;

await client.query(updateSoldes, [codedec, idclients]);
    /*
    const updateSoldes = `
      UPDATE tableauamortissementgesecheancedetail
      SET etatr = 'solder'
      WHERE codedec = $1
        AND idclients = $2
        AND capitalremb >= capital;
    `;

    await client.query(updateSoldes, [codedec, idclients]);


      const updateSoldesI = `
      UPDATE tableauamortissementgesecheancedetail
      SET etatr = 'non solder'
      WHERE codedec = $1
        AND idclients = $2
        AND capitalremb < capital;
    `;

    await client.query(updateSoldesI, [codedec, idclients]);

*/





    await client.query('COMMIT');

    exportLogger?.info("Mise à jour échéancier réussie", {
      codedec,
      idclients
    });

    return res.status(200).json({
      success: true,
      message: "Echéancier mis à jour avec succès"
    });

  } catch (err) {

    try { await client.query('ROLLBACK'); } catch {}

    exportLogger?.error("Erreur mise à jour échéancier", {
      message: err.message,
      code: err.code,
      detail: err.detail
    });

    // 🎯 Gestion erreurs PostgreSQL
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
