const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { exportLogger } = require('../logs/logger'); // 🔥 manquait



router.post('/remboursement-auto', async (req, res) => {
    const client = await pool.connect();

    try {
        const { iduser, idagence } = req.body;

        await client.query('BEGIN');

        await client.query(
            'CALL proc_remboursement_auto($1,$2)',
            [iduser, idagence]
        );

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: 'Remboursement automatique effectué'
        });

    } catch (error) {
        await client.query('ROLLBACK');

        res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {
        client.release();
    }
});




router.post('/remboursement-auto-parcodedec', async (req, res) => {
    const client = await pool.connect();

    try {
        // Extraction des 5 paramètres envoyés par Flutter
        const { iduser, idagence, codedec, dateecheance, coderemb } = req.body;

        // Validation rapide
        if (!codedec || !dateecheance || !coderemb) {
            return res.status(400).json({
                success: false,
                message: "Paramètres manquants (codedec, dateecheance ou coderemb)"
            });
        }

        await client.query('BEGIN');

        // Appel de la procédure corrigée avec les 5 arguments
        await client.query(
            'CALL proc_remboursement_auto_par_decaissemnt($1, $2, $3, $4, $5)',
            [
                parseInt(iduser), 
                parseInt(idagence), 
                codedec, 
                dateecheance, // Format YYYY-MM-DD attendu
                coderemb      // Le code généré par Flutter
            ]
        );

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: `Le remboursement ${coderemb} pour le décaissement ${codedec} a été effectué avec succès.`
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur SQL:', error.message);

        res.status(500).json({
            success: false,
            message: "Erreur lors du remboursement : " + error.message
        });

    } finally {
        client.release();
    }
});







router.get('/finaecheanceencours', async (req, res) => {
  try {
    console.log("👉 Requête reçue:", req.query);

    const { idclients, search, dateselectionnee, idagence } = req.query;

    // ❌ condition obligatoire
    if (!idagence || String(idagence).trim() === '') {
      return res.status(400).json({
        success: false,
        message: "idagence est obligatoire"
      });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(req.query.pageSize, 10) || 50, 1);
    const offset = (page - 1) * pageSize;

    const filters = [];
    const params = [];
    let idx = 1;

    // obligatoire agence
    filters.push(`t.idagence = $${idx++}`);
    params.push(parseInt(idagence, 10));

    // état
    filters.push(`t.etatr <> 'solder'`);

    // client
    if (idclients && String(idclients).trim() !== '') {
      filters.push(`t.idclients = $${idx++}`);
      params.push(parseInt(idclients, 10));
    }

    // recherche
    if (search && String(search).trim() !== '') {
      filters.push(`t.codeclients ILIKE $${idx++}`);
      params.push(`%${search.trim()}%`);
    }

    // date
    if (dateselectionnee && String(dateselectionnee).trim() !== '') {
      filters.push(`t.date::date <= $${idx++}::date`);
      params.push(dateselectionnee);
    }

    const whereClause = `WHERE ${filters.join(' AND ')}`;

    const selectQuery = `
      SELECT 
          t.codedec,
          t.date,
          t.idclients,
          t.codeclients,
          t.compteclient,
          CONCAT(fcl.nom, ' ', fcl.prenom) AS nomcomplet,
          fcl.telephone,
          t.period,
          t.capital,
          t.interet,
          t.echeancemes,
          fc.solde,
          GREATEST(0, (CURRENT_DATE - t.date::date)) AS retard
      FROM tableauamortissementgesecheancedetail t
      INNER JOIN finaclients fcl
          ON fcl.idclient = t.idclients
      INNER JOIN finaclient_comptes fc
          ON fc.codecompte = t.compteclient
      ${whereClause}
      ORDER BY t.idclients DESC, t.period ASC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    params.push(pageSize, offset);

    const dataResult = await pool.query(selectQuery, params);

    // COUNT
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM tableauamortissementgesecheancedetail t
      INNER JOIN finaclients fcl
          ON fcl.idclient = t.idclients
      INNER JOIN finaclient_comptes fc
          ON fc.codecompte = t.compteclient
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = countResult.rows[0]?.total || 0;

    res.json({
      success: true,
      meta: { total, page, pageSize },
      data: dataResult.rows
    });

  } catch (err) {
    console.error("💥 Erreur:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});








router.get('/decencoursfina', async (req, res) => {
  try {

    const { idagence } = req.query;

    if (!idagence) {
      return res.status(400).json({
        success: false,
        message: "idagence est obligatoire"
      });
    }

    const query = `
      SELECT 
          d.codedec,
          d.codedemande,
          d.date,
          d.idclients,
          d.codeclients,
          d.nom,
          d.prenoms,
          d.adresse,
          d.contact,
          d.idarticle,
          d.article,

          (COALESCE(d.capital,0)
          + COALESCE(d.interet,0)
          + COALESCE(d.autrescommission,0)
          + COALESCE(d.fraisoperateur,0)) AS montant_credit,

          (COALESCE(d.rembcapital,0)
          + COALESCE(d.rembinteret,0)) AS total_remb,

          (
            (COALESCE(d.rembcapital,0)
            + COALESCE(d.rembinteret,0))
            -
            (COALESCE(d.capital,0)
            + COALESCE(d.interet,0)
            + COALESCE(d.autrescommission,0)
            + COALESCE(d.fraisoperateur,0))
          ) AS soldeencourstotal

      FROM decaissement d
      WHERE d.datevalidation IS NULL
        AND d.idagence = $1
      ORDER BY d.date DESC;
    `;

    const { rows } = await pool.query(query, [idagence]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Aucun décaissement en cours"
      });
    }

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error("Erreur décaissements :", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      details: err.message
    });
  }
});


router.get('/listerembfina/:codedec', async (req, res) => {

  const { codedec } = req.params;
  const { idagence } = req.query;

  if (!codedec) {
    return res.status(400).json({
      success: false,
      message: "codedec requis"
    });
  }

  if (!idagence) {
    return res.status(400).json({
      success: false,
      message: "idagence requis"
    });
  }

  try {

    const query = `
      SELECT 
          coderemb,
          date_remb,
          idclients,
          codeclients,
          codedec,
          period,
          montant,
          capital,
          interet,
          iduser,
          idagence
      FROM remboursement
      WHERE codedec = $1
        AND idagence = $2
      ORDER BY date_remb DESC;
    `;

    const { rows } = await pool.query(query, [codedec, idagence]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Aucun remboursement trouvé"
      });
    }

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error("Erreur remboursement :", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      details: err.message
    });
  }
});


module.exports = router;
