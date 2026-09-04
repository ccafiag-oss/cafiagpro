const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Route GET /api/echeance
router.get('/echeanceencours', async (req, res) => {
  try {
    console.log("👉 Requête reçue sur /api/echeance avec query:", req.query);

    const { idclients, search, iduser } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(req.query.pageSize, 10) || 50, 1);
    const offset = (page - 1) * pageSize;

    console.log(`📄 Pagination: page=${page}, pageSize=${pageSize}, offset=${offset}`);

    const filters = [];
    const params = [];
    let idx = 1;

    // 🔎 Condition obligatoire : etatr <> 'solder'
    filters.push(`t.etatr <> 'solder'`);

    if (idclients && String(idclients).trim() !== '') {
      filters.push(`t.idclients = $${idx++}`);
      params.push(idclients);
    }

    if (search && String(search).trim() !== '') {
      const s = `%${search.trim()}%`;
      filters.push(`t.codeclients ILIKE $${idx++}`);
      params.push(s);
    }

    if (iduser && String(iduser).trim() !== '') {
      filters.push(`u.iduser = $${idx++}`);
      params.push(iduser);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const selectQuery = `
      SELECT t.period, t.codedec, t.codeclients, t.idclients, t.echeancemes
      FROM public.tableauamortissementgesecheancedetail t
      INNER JOIN utilisateur u 
        ON t.codeclients = u.codeclient
      ${whereClause}
        AND t.period = (
          SELECT MIN(period)
          FROM public.tableauamortissementgesecheancedetail
          WHERE etatr <> 'solder'
            AND codeclients = t.codeclients
        )
      ORDER BY t.idclients DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(pageSize, offset);

    console.log("🔎 SQL SELECT:", selectQuery);
    console.log("🔎 Params:", params);

    const dataResult = await pool.query(selectQuery, params);

    const countParams = params.slice(0, params.length - 2);
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM public.tableauamortissementgesecheancedetail t
      INNER JOIN utilisateur u 
        ON t.codeclients = u.codeclient
      ${whereClause};
    `;
    console.log("🔎 SQL COUNT:", countQuery);
    console.log("🔎 Count Params:", countParams);

    const countResult = await pool.query(countQuery, countParams);
    const total = countResult.rows[0] ? countResult.rows[0].total : 0;

    console.log("✅ Résultats trouvés:", dataResult.rows.length);

    res.json({
      meta: { total, page, pageSize },
      data: dataResult.rows,
    });
  } catch (err) {
    console.error('💥 Erreur récupération échéances:', err);
    res.status(500).json({
      error: 'Erreur récupération échéances',
      details: err.message,
    });
  }
});

module.exports = router;
