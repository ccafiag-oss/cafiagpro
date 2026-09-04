const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
  try {
    // paramètres de pagination (par défaut page=1, pageSize=500)
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 1500000;

    // requête SQL
    const { rows } = await pool.query(
      'select code,designation,classe,designationclasse,niveaux1,designationniveaux1,niveaux2,designationniveaux2,niveaux3,designationniveaux3,sence_solde from tcompte'

     /// 'SELECT idag AS "IDAG", designation AS "DESIGNATION" FROM cabagence'
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
    res.status(500).json({ error: 'Erreur récupération de compte' });
  }
});

module.exports = router;
