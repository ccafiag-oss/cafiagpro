const express = require('express'); 
const router = express.Router();
 const pool = require('../config/db');

router.post('/optionsalerte', async (req, res) => {
  try {
    const { id, options, alerteduree } = req.body;

    if (!options || !alerteduree) {
      return res.status(400).json({ error: 'Champs obligatoires manquants (options, alerteduree)' });
    }

    let query, values;

    if (id) {
      query = `
        UPDATE Optionsalerte
        SET options = $1, alerteduree = $2
        WHERE id = $3
        RETURNING *;
      `;
      values = [options, alerteduree, id];
    } else {
      query = `
        INSERT INTO Optionsalerte (options, alerteduree)
        VALUES ($1, $2)
        RETURNING *;
      `;
      values = [options, alerteduree];
    }

    const { rows } = await pool.query(query, values);
    res.status(201).json({
      message: id ? 'Option alerte mise à jour avec succès' : 'Option alerte insérée avec succès',
      data: rows[0]
    });

  } catch (err) {
    console.error('Erreur Optionsalerte:', err.message);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});
module.exports = router;