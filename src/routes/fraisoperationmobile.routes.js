const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Ajouter un fraisoperationmobile
router.post('/fraisoperationmobile', async (req, res) => {
  try {
    const {
      codemobile, designation, montant_min, montant_max,
      frais, syntaxe, operateur, detailoperation,
      coderubrique1, rubrique1, coderubrique2, rubrique2, idagence
    } = req.body;

    const result = await pool.query(
      `INSERT INTO public.fraisoperationmobile(
        codemobile, designation, montant_min, montant_max, frais, syntaxe,
        operateur, detailoperation, coderubrique1, rubrique1,
        coderubrique2, rubrique2, idagence
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [codemobile, designation, montant_min, montant_max, frais, syntaxe,
       operateur, detailoperation, coderubrique1, rubrique1,
       coderubrique2, rubrique2, idagence]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lister les frais d'une agence
router.get('/fraisoperationmobile/:idagence', async (req, res) => {
  try {
    const { idagence } = req.params;
    const result = await pool.query(
      'SELECT * FROM public.fraisoperationmobile WHERE idagence = $1',
      [idagence]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Modifier un frais
router.put('/fraisoperationmobile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      codemobile, designation, montant_min, montant_max,
      frais, syntaxe, operateur, detailoperation,
      coderubrique1, rubrique1, coderubrique2, rubrique2
    } = req.body;

    const result = await pool.query(
      `UPDATE public.fraisoperationmobile
       SET codemobile=$1, designation=$2, montant_min=$3, montant_max=$4, frais=$5,
           syntaxe=$6, operateur=$7, detailoperation=$8,
           coderubrique1=$9, rubrique1=$10, coderubrique2=$11, rubrique2=$12
       WHERE id=$13 RETURNING *`,
      [codemobile, designation, montant_min, montant_max, frais, syntaxe,
       operateur, detailoperation, coderubrique1, rubrique1, coderubrique2, rubrique2, id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
