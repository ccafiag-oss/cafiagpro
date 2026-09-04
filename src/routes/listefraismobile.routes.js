const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/fraisop', async (req, res) => {
  const { codemobile, idagence, montant } = req.query;

  if (!codemobile || !idagence || !montant) {
    return res.status(400).json({
      error: "codemobile, idagence et montant sont requis"
    });
  }

  try {
    const query = `
      SELECT frais, syntaxe
      FROM fraisoperationmobile
      WHERE codemobile = $1
        AND idagence = $2
        AND $3 BETWEEN montant_min AND montant_max
      LIMIT 1;
    `;

    const values = [
      codemobile,
      parseInt(idagence),
      parseFloat(montant)
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Aucun frais trouvé pour ce montant"
      });
    }

    res.json({
      frais: result.rows[0].frais,
      syntaxe: result.rows[0].syntaxe
    });

  } catch (err) {
    console.error("Erreur récupération frais :", err);

    res.status(500).json({
      error: "Erreur serveur",
      details: err.message
    });
  }
});

module.exports = router;



/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/fraisop', async (req, res) => {
  const { codemobile, montant } = req.query;

  if (!codemobile || !montant) {
    return res.status(400).json({ error: "codemobile et montant sont requis" });
  }

  try {
    const query = `
      SELECT frais,syntaxe
      FROM fraisoperationmobile
      WHERE codemobile = $1 AND idagence=$2
        AND $3 BETWEEN montant_min AND montant_max
      LIMIT 1;
    `;
    const values = [codemobile, montant];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Aucun frais trouvé pour ce montant" });
    }

    res.json({ frais: result.rows[0].frais,syntaxe: result.rows[0].syntaxe });
  } catch (err) {
    console.error("Erreur récupération frais:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


module.exports = router;
*/
