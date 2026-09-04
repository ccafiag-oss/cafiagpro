const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assure-toi que ta connection DB est bien configurée

// 1. Récupérer tous les dépôts (optionnellement filtrés par 'idagence')
router.get('/gdepot', async (req, res) => {
  const { idagence } = req.query;

  try {
    let queryText = 'SELECT * FROM gdepot';
    const values = [];
    if (idagence) {
      queryText += ' WHERE idagence = $1';
      values.push(idagence);
    }
    const { rows } = await pool.query(queryText, values);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /gdepot:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});






router.get('/gdepotutilisateur', async (req, res) => {
  // On récupère les deux paramètres nécessaires
  const { idagence, iduser } = req.query;

  if (!idagence || !iduser) {
    return res.status(400).json({ error: "Les paramètres 'idagence' et 'iduser' sont requis." });
  }

  try {
    // Utilisation de backticks (`) pour une chaîne multi-lignes propre
    // Le $1 correspond à idagence, le $2 à iduser
    const queryText = `
      SELECT gd.* FROM gdepot gd
      JOIN agro_utilisateur_depot gud ON gud.iddepot = gd.iddepot
      WHERE gud.idagence = $1 
        AND gud.iduser = $2 
        AND gud.etat = true
    `;
    
    const { rows } = await pool.query(queryText, [idagence, iduser]);
    
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /gdepotutilisateur:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});






// 2. Ajouter un nouveau dépôt
router.post('/gdepot', async (req, res) => {
  const { idagence, codedepot, designation, actif } = req.body;

  // Vérification des champs obligatoires
  if (!idagence || !codedepot || !designation) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO gdepot (idagence, codedepot, designation, actif)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [idagence, codedepot, designation, actif !== undefined ? actif : true]
    );
    res.status(201).json({ message: 'Dépôt ajouté', data: rows[0] });
  } catch (err) {
    console.error('Erreur POST /gdepot:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 3. Modifier un dépôt existant
router.put('/gdepot/:id', async (req, res) => {
  const { id } = req.params;
  const { idagence, codedepot, designation, actif } = req.body;

  // Vérification si au moins un champ à mettre à jour
  if (
    !idagence && !codedepot && !designation && actif === undefined
  ) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  const fields = [];
  const values = [];
  let index = 1;

  if (idagence !== undefined) {
    fields.push(`idagence = $${index++}`);
    values.push(idagence);
  }
  if (codedepot !== undefined) {
    fields.push(`codedepot = $${index++}`);
    values.push(codedepot);
  }
  if (designation !== undefined) {
    fields.push(`designation = $${index++}`);
    values.push(designation);
  }
  if (actif !== undefined) {
    fields.push(`actif = $${index++}`);
    values.push(actif);
  }

  values.push(id); // pour la clause WHERE

  const query = `UPDATE gdepot SET ${fields.join(', ')} WHERE iddepot = $${index} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, [...values]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Dépôt non trouvé' });
    }
    res.json({ message: 'Dépôt modifié', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /gdepot/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;