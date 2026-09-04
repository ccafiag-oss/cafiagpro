const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Insert ou update Modepaiements
router.post('/modepaiements', async (req, res) => {
  try {
    const { id, modes, paiementsduree } = req.body;

    if (!modes || !paiementsduree) {
      return res.status(400).json({ error: 'Champs obligatoires manquants (modes, paiementsduree)' });
    }

    let query, values;

    if (id) {
      // UPDATE si id fourni
      query = `
        UPDATE Modepaiements
        SET modes = $1, paiementsduree = $2
        WHERE id = $3
        RETURNING *;
      `;
      values = [modes, paiementsduree, id];
    } else {
      // INSERT sinon
      query = `
        INSERT INTO Modepaiements (modes, paiementsduree)
        VALUES ($1, $2)
        RETURNING *;
      `;
      values = [modes, paiementsduree];
    }

    const { rows } = await pool.query(query, values);
    res.status(201).json({
      message: id ? 'Modepaiement mis à jour avec succès' : 'Modepaiement inséré avec succès',
      data: rows[0]
    });

  } catch (err) {
    console.error('Erreur Modepaiements:', err.message);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
