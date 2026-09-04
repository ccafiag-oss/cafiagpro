const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // adapte le chemin si nécessaire

/**
 * GET /api/clients
 * Query params:
 *  - idag (optional)        : filter by agence id
 *  - search (optional)      : text search on nom, prenom, codeclients, telephone
 *  - page (optional)        : page number (default 1)
 *  - pageSize (optional)    : items per page (default 50)
 *
 * Response:
 *  {
 *    meta: { total, page, pageSize },
 *    data: [ ...clients ]
 *  }
 */
router.get('/', async (req, res) => {
  try {
    const { idag, search } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const pageSize = Math.max(parseInt(req.query.pageSize) || 50, 1);
    const offset = (page - 1) * pageSize;

    // Construction dynamique des filtres et des paramètres pour requête paramétrée
    const filters = [];
    const params = [];
    let idx = 1;

    if (typeof idag !== 'undefined' && idag !== null && String(idag).trim() !== '') {
      filters.push(`idagence = $${idx++}`);
      params.push(idag);
    }

    if (typeof search !== 'undefined' && search !== null && String(search).trim() !== '') {
      // recherche sur nom, prenom, codeclients, telephone
      const s = `%${search.trim()}%`;
      filters.push(`(nom ILIKE $${idx} OR prenom ILIKE $${idx} OR codeclients ILIKE $${idx} OR telephone ILIKE $${idx})`);
      params.push(s);
      idx++;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    // Requête pour récupérer les données paginées
    const selectQuery = `
      SELECT
        idclients        AS "IDCLIENTS",
        codeclients      AS "CODECLIENTS",
        date_creation    AS "DATE_CREATION",
        nom              AS "NOM",
        prenom           AS "PRENOM",
        datenaisse       AS "DATENAISSE",
        sexe             AS "SEXE",
        telephone        AS "TELEPHONE",
        adresse          AS "ADRESSE",
        idgest           AS "IDGEST",
        etat             AS "ETAT",
        photo            AS "PHOTO",
        signature        AS "SIGNATURE",
        idagence         AS "IDAGENCE",
        localisationdomicile AS "LOCALISATIONDOMICILE",
        compteauxiliaire AS "COMPTEAUXILIAIRE"

        
      FROM clients
      ${whereClause}
      ORDER BY idclients DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(pageSize, offset);

    const dataResult = await pool.query(selectQuery, params);

    // Requête pour compter le total (mêmes filtres)
    // On réutilise les mêmes filtres mais sans LIMIT/OFFSET
    const countParams = params.slice(0, params.length - 2); // enlever pageSize et offset
    const countQuery = `SELECT COUNT(*)::int AS total FROM clients ${whereClause}`;
    const countResult = await pool.query(countQuery, countParams);

    const total = countResult.rows[0] ? countResult.rows[0].total : 0;

    res.json({
      meta: { total, page, pageSize },
      data: dataResult.rows
    });
  } catch (err) {
    console.error('Erreur récupération clients:', err);
    res.status(500).json({ error: 'Erreur récupération clients' });
  }
});

module.exports = router;
