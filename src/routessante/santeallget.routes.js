const express = require('express');
const router = express.Router();
const pool = require('../config/db');




// Route pour afficher les sommes groupées
router.get('/operations-somme/:idagence', async (req, res) => {
  const { idagence } = req.params;

  const query = `
    SELECT 
        tcu.idop,
        tcu.idagence,
        tcu.type_operation,
        tcu.idassureur,
        tcu.idtiers,
         tcu.ref_piece,
        SUM(tcu.montant) AS montant,
        SUM(tcu.remise) AS remise,
        SUM(tcu.escompte) AS escompte,
        SUM(tcu.montant_taxe1) AS montant_taxe1,
        SUM(tcu.montant_taxe2) AS montant_taxe2,
        SUM(tcu.montant_taxe3) AS montant_taxe3,
        SUM(tcu.montant_taxe4) AS montant_taxe4,
        SUM(tcu.totaltaxe) AS totaltaxe,
        SUM(tcu.montant_ttc) AS montant_ttc,
        SUM(tcu.montant_reglement) AS montant_reglement,
        SUM(tcu.montantassure) AS montantassure,
        SUM(tcu.regleassure) AS regleassure,
        SUM(tcu.montantassurance) AS montantassurance,
        SUM(tcu.regleassurance) AS regleassurance,
        SUM(tcu.soldeassure) AS soldeassure,
        SUM(tcu.soldeassurance) AS soldeassurance,
        asu.designation
    FROM t_operation_cumule tcu
    JOIN s_assureur asu ON asu.idassureur = tcu.idassureur
    WHERE tcu.soldeassurance > 0 AND tcu.idagence = $1
    GROUP BY tcu.idop, tcu.idagence, tcu.type_operation, tcu.idassureur, asu.designation,tcu.idtiers, tcu.ref_piece;
  `;

  try {
    const result = await pool.query(query, [idagence]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur SQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
