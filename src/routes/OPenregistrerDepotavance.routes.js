const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 1. AJOUTER une opération (INSERT)
router.post('/', async (req, res) => {
  try {
    const {
      codeop,
      codetypeop,
      codejrnl,
      codemodelop,
      date,
      idclient,
      codeclient,
      iduser,
      montant,
      libele,
      comptedebit,
      comptecredit,
      idagence
    } = req.body;

    if (!codeop || !codetypeop || !date || !montant || !comptedebit || !comptecredit || !idagence) {
      return res.status(400).json({ error: 'Champs obligatoires manquants (codeop, date, montant, etc.)' });
    }

    const insertQuery = `
      INSERT INTO toperation (
        codeop, codetypeop, codejrnl, codemodelop, date, 
        idclient, codeclient, iduser, montant, libele, 
        comptedebit, comptecredit, idagence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;

    const values = [
      codeop,
      codetypeop,
      codejrnl,
      codemodelop || null,
      date,
      idclient || null,
      codeclient || null,
      iduser,
      montant,
      libele || 'Dépôt avance',
      comptedebit,
      comptecredit,
      idagence
    ];

    const { rows } = await pool.query(insertQuery, values);

    res.status(201).json({
      message: 'Opération enregistrée avec succès (Écritures générées)',
      operation: rows[0]
    });

  } catch (err) {
    console.error('Erreur insertion toperation:', err.message);
    res.status(500).json({ 
      error: 'Erreur serveur lors de l\'enregistrement',
      details: err.message 
    });
  }
});

// 2. MODIFIER une opération (UPDATE)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      codeop,
      codetypeop,
      codejrnl,
      codemodelop,
      date,
      idclient,
      codeclient,
      iduser,
      montant,
      libele,
      comptedebit,
      comptecredit,
      idagence
    } = req.body;

    if (!codeop || !codetypeop || !date || !montant || !comptedebit || !comptecredit || !idagence) {
      return res.status(400).json({ error: 'Champs obligatoires manquants pour la modification' });
    }

    const updateQuery = `
      UPDATE toperation
      SET codeop = $1, codetypeop = $2, codejrnl = $3, codemodelop = $4, date = $5,
          idclient = $6, codeclient = $7, iduser = $8, montant = $9, libele = $10,
          comptedebit = $11, comptecredit = $12, idagence = $13
      WHERE id = $14
      RETURNING *;
    `;

    const values = [
      codeop,
      codetypeop,
      codejrnl,
      codemodelop || null,
      date,
      idclient || null,
      codeclient || null,
      iduser,
      montant,
      libele,
      comptedebit,
      comptecredit,
      idagence,
      id
    ];

    const { rows } = await pool.query(updateQuery, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Opération non trouvée' });
    }

    res.status(200).json({
      message: 'Opération mise à jour avec succès (Écritures recalculées)',
      operation: rows[0]
    });

  } catch (err) {
    console.error('Erreur modification toperation:', err.message);
    res.status(500).json({ 
      error: 'Erreur lors de la modification',
      details: err.message 
    });
  }
});

// 3. SUPPRIMER une opération (DELETE)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleteQuery = `
      DELETE FROM toperation
      WHERE id = $1
      RETURNING *;
    `;

    const { rows } = await pool.query(deleteQuery, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Opération non trouvée' });
    }

    res.status(200).json({
      message: 'Opération et écritures associées supprimées avec succès',
      operation: rows[0]
    });

  } catch (err) {
    console.error('Erreur suppression toperation:', err.message);
    res.status(500).json({ 
      error: 'Erreur lors de la suppression',
      details: err.message 
    });
  }
});

module.exports = router;


/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/', async (req, res) => {
  try {
    const {
      codeop, // Extrait du body
      codetypeop,
      codejrnl,
      codemodelop,
      date,
      idclient,
      codeclient,
      iduser,
      montant,
      libele,
      comptedebit,
      comptecredit,
      idagence
    } = req.body;

    // 1. Vérification des champs
    if (!codeop || !codetypeop || !date || !montant || !comptedebit || !comptecredit || !idagence) {
      return res.status(400).json({ error: 'Champs obligatoires manquants (codeop, date, montant, etc.)' });
    }

    // 2. Requête SQL (L'ordre ici est crucial)
    const insertQuery = `
      INSERT INTO toperation (
        codeop,       -- $1
        codetypeop,   -- $2
        codejrnl,     -- $3
        codemodelop,  -- $4
        date,         -- $5
        idclient,     -- $6
        codeclient,   -- $7
        iduser,       -- $8
        montant,      -- $9
        libele,       -- $10
        comptedebit,  -- $11
        comptecredit,  -- $12
        idagence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,$13)
      RETURNING *;
    `;

    // 3. Tableau des valeurs (Doit correspondre EXACTEMENT à l'ordre ci-dessus)
    const values = [
      codeop,               // $1
      codetypeop,           // $2
      codejrnl,             // $3
      codemodelop || null,  // $4
      date,                 // $5
      idclient || null,     // $6
      codeclient || null,   // $7
      iduser,               // $8
      montant,              // $9
      libele || 'Dépôt avance', // $10
      comptedebit,          // $11
      comptecredit,          // $12
      idagence
    ];

    // Log pour debug en cas de doute
    console.log("Données prêtes pour insertion :", values);

    const { rows } = await pool.query(insertQuery, values);

    res.status(201).json({
      message: 'Dépôt avance enregistré avec succès',
      operation: rows[0]
    });

  } catch (err) {
    console.error('Erreur insertion toperation:', err.message);
    res.status(500).json({ 
      error: 'Erreur serveur lors de l\'enregistrement',
      details: err.message 
    });
  }
});

module.exports = router;


*/