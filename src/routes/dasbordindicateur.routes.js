const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Route GET /api/indicateurf1
router.get('/indicateurf1', async (req, res) => {
  try {

    const { idagence } = req.query;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(req.query.pageSize, 10) || 50, 1);
    const offset = (page - 1) * pageSize;

    const filters = [];
    const params = [];
    let idx = 1;

    // condition obligatoire
    filters.push(`etatr <> 'solder'`);

    // filtre agence
    if (idagence && String(idagence).trim() !== '') {
      filters.push(`idagence = $${idx++}`);
      params.push(idagence);
    }

    const whereClause = `WHERE ${filters.join(' AND ')}`;

    const selectQuery = `
    SELECT 
      idagence,

      COUNT(*) FILTER(
        WHERE NOW()::date > date::date
      ) AS nb_echeance_retard,

      COALESCE(
        SUM(capital+interet) FILTER(
          WHERE NOW()::date > date::date
        ),0) AS montant_retard,

      COALESCE(SUM(capital+interet),0) AS encours_total,

      CASE 
      WHEN COALESCE(SUM(capital+interet),0) > 0 THEN
      ROUND(
      (
        COALESCE(
        SUM(capital+interet) FILTER(
        WHERE NOW()::date > date::date
        ),0)
      /
        SUM(capital+interet)
      )*100,2)
      ELSE 0
      END AS taux_par,

      COALESCE(
        SUM(capital+interet) FILTER(
          WHERE (NOW()::date - date::date) <= 90
          AND NOW()::date > date::date
        ),0) AS retard_moins_90,

      COALESCE(
        SUM(capital+interet) FILTER(
          WHERE (NOW()::date - date::date) > 90
        ),0) AS retard_plus_90

    FROM tableauamortissementgesecheancedetail
    ${whereClause}
    GROUP BY idagence
    ORDER BY idagence

    LIMIT $${idx++} OFFSET $${idx++}
    `;

    params.push(pageSize, offset);

    const dataResult = await pool.query(selectQuery, params);

    // requête total agences
    const countQuery = `
      SELECT COUNT(DISTINCT idagence) AS total
      FROM tableauamortissementgesecheancedetail
      ${whereClause}
    `;

    const countParams = params.slice(0, params.length - 2);

    const countResult = await pool.query(countQuery, countParams);

    const total = countResult.rows[0]?.total || 0;

    res.json({
      meta: { total, page, pageSize },
      data: dataResult.rows,
    });

  } catch (err) {

    console.error('Erreur indicateur:', err);

    res.status(500).json({
      error: 'Erreur récupération indicateur',
      details: err.message,
    });

  }
});

module.exports = router;