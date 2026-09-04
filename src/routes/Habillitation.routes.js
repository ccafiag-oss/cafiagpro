const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // ton pool pg

// Fonction pour mettre à jour dynamiquement les colonnes
async function updateRoleCheckboxes(idRole, updates) {
  try {
    const keys = Object.keys(updates);
    const setClauses = keys.map((key, idx) => `"${key}" = $${idx + 2}`).join(', ');
    const values = [idRole, ...keys.map(k => updates[k])];

    const query = `UPDATE "habilitationprofile" SET ${setClauses} WHERE "idrole" = $1`;
    await pool.query(query, values);

    return { success: true, message: 'Checkboxes updated successfully' };
  } catch (err) {
    console.error('❌ Error updating checkboxes:', err);
    throw err;
  }
}

// Route PUT pour mise à jour
router.put('/roles/:id', async (req, res) => {
  const idRole = parseInt(req.params.id, 10);
  const updates = req.body; // { A1: 1, A2: 0, ... }

  try {
    const result = await updateRoleCheckboxes(idRole, updates);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route GET pour récupérer les valeurs actuelles
router.get('/listehabilitation/:id', async (req, res) => {
  const idRole = parseInt(req.params.id, 10);

  try {
    const query = `SELECT * FROM "habilitationprofile" WHERE "idrole" = $1`;
    const { rows } = await pool.query(query, [idRole]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // On renvoie directement l’objet JSON des colonnes
    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Error fetching role:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
