const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
  try {
    // 🔹 Récupération et conversion des paramètres de requête
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 500;
    const offset = (page - 1) * pageSize;
    const idagence = req.query.idagence;

    // Validation rapide de la présence d'idagence
    if (!idagence) {
      return res.status(400).json({
        error: 'Le paramètre idagence est requis'
      });
    }

    // 🔹 Requête principale avec pagination et filtrage par agence
    // Réorganisation des index des variables ($1: idagence, $2: limit, $3: offset)
    const dataQuery = `
      SELECT 
        id,
        codedemande,
        idclients,
        codeclients,
        nom,
        prenoms,
        idarticle,
        article,
        idmodepaiements,
        paiementsduree,
        capital,
        taux,
        autrescommission,
        fraisoperateur,
        idoptionsalerte,
        alerteduree,
        interet,
        idagence,
        contact,
        adresse,
        compteclients,
        dureetotal,
        coutachat,
        commission,
        avoircaution
      FROM demandecredit
      WHERE datedecaissement IS NULL AND idagence = $1
      ORDER BY id DESC
      LIMIT $2 OFFSET $3
    `;

    const dataValues = [idagence, pageSize, offset];
    const { rows } = await pool.query(dataQuery, dataValues);

    // 🔹 Requête pour obtenir le nombre total d'enregistrements correspondant
    const totalQuery = `
      SELECT COUNT(*) 
      FROM demandecredit 
      WHERE datedecaissement IS NULL AND idagence = $1
    `;

    const totalResult = await pool.query(totalQuery, [idagence]);
    const total = parseInt(totalResult.rows[0].count, 10);

    // 🔹 Réponse structurée
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




/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
  try {
    // 🔹 Paramètres pagination
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 500;
    const offset = (page - 1) * pageSize;

    // 🔹 Requête principale avec pagination SQL
    const dataQuery = `
      SELECT 
        id,
        codedemande,
        idclients,
        codeclients,
        nom,
        prenoms,
        idarticle,
        article,
        idmodepaiements,
        paiementsduree,
        capital,
        taux,
        autrescommission,
        fraisoperateur,
        idoptionsalerte,
        alerteduree,
        interet,
        idagence,
        contact,
        adresse,
        compteclients,
        dureetotal,
         coutachat,
        commission,
        avoircaution
      FROM demandecredit
      WHERE datedecaissement IS NULL and idagence=$3
      ORDER BY id DESC
      LIMIT $1 OFFSET $2
    `;

    const { rows } = await pool.query(dataQuery, [pageSize, offset]);

    // 🔹 Requête pour le total réel
    const totalQuery = `
      SELECT COUNT(*) 
      FROM demandecredit 
      WHERE datedecaissement IS NULL and idagence=$3
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
*/

/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
  try {
    // paramètres de pagination (par défaut page=1, pageSize=500)
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 500;

    // requête SQL
    const { rows } = await pool.query(
      'select id,codedemande,idclients,codeclients,nom,prenoms,idarticle,article,idmodepaiements,paiementsduree,capital,taux,autrescommission,fraisoperateur,idoptionsalerte,alerteduree,interet,idagence,contact,adresse,compteclients,dureetotal from demandecredit WHERE datedecaissement IS NULL ORDER BY id DESC LIMIT $1 OFFSET $2'

     
    );

    // calcul du total
    const total = rows.length;

    // pagination (slice côté serveur)
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = rows.slice(startIndex, endIndex);

    // réponse JSON structurée
    res.json({
      meta: {
        total,
        page,
        pageSize
      },
      data: paginatedData
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération demande' });
  }
});

module.exports = router;
*/
