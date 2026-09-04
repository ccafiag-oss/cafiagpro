const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
  try {
    // 🔹 Paramètres de pagination
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 500;
    const offset = (page - 1) * pageSize;

    // 🔹 Requête principale avec pagination SQL (LIMIT & OFFSET)
    const dataQuery = `
      
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
    r.frais,
    r.iduser,
    r.idagence,
    r.telephone,
    r.datevalidation,
    r.etat,
    r.etatvalidation,
    c.nom || ' ' || c.prenom AS nom_complet,
    c.compteauxiliaire
FROM remboursementmobilmoney r
INNER JOIN clients c 
    ON c.idclients = r.idclients
WHERE r.etatvalidation = 'encours'
ORDER BY r.date_remb DESC
      LIMIT $1 OFFSET $2
    `;

    // 🔹 Exécution de la requête principale
    const { rows } = await pool.query(dataQuery, [pageSize, offset]);

    // 🔹 Requête pour récupérer le total (sans pagination)
    const totalQuery = `
      SELECT COUNT(*) AS count
      FROM remboursementmobilmoney
      WHERE etatvalidation='encours'
    `;
    const totalResult = await pool.query(totalQuery);
    const total = parseInt(totalResult.rows[0].count);

    // 🔹 Réponse JSON
    res.json({
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      },
      data: rows
    });

  } catch (err) {
    console.error("Erreur récupération demande:", err);
    res.status(500).json({
      error: 'Erreur récupération demande',
      details: err.message
    });
  }
});

module.exports = router;