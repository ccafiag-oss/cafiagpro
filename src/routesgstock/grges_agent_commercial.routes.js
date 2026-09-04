const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assure-toi que ta connection DB est bien configurée

// 1. Récupérer tous les agents commerciaux (filtrage par 'idagence' et recherche)
router.get('/ges_agent_commercial', async (req, res) => {
  const { idagence, search } = req.query;

  // Vérification si 'idagence' est fourni
  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  // Construction de la requête SQL
  let queryText = 'SELECT * FROM ges_agent_commercial WHERE idagence = $1';
  const values = [idagence];

  // Ajout de la recherche si 'search' est fourni et contient au moins 3 caractères
  if (search && search.length >= 3) {
    // Recherche sur nom, prenom, codeagent et tel
    queryText += ' AND (nom ILIKE $2 OR prenom ILIKE $2 OR codeagent ILIKE $2 OR tel ILIKE $2)';
    values.push(`%${search}%`);
  }

  try {
    const { rows } = await pool.query(queryText, values);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /ges_agent_commercial:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});






router.get('/ges_agent_commercialliste', async (req, res) => {
  const { idagence, search } = req.query;

  // Vérification si 'idagence' est fourni
  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  // Construction de la requête SQL
  let queryText = 'SELECT * FROM ges_agent_commercial WHERE idagence = $1';
  const values = [idagence];

  try {
    const { rows } = await pool.query(queryText, values);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /ges_agent_commercial:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});





// 2. Ajouter un nouvel agent commercial
router.post('/ges_agent_commercial', async (req, res) => {
  const {
    idagence,
    iduser,
    codeagent,
    nom,
    prenom,
    tel,
    adresse,
    objectif,
    etat
  } = req.body;

  // Vérification des champs obligatoires
  if (!idagence || !iduser || !codeagent) {
    return res.status(400).json({ error: 'Champs obligatoires manquants: idagence, iduser, codeagent' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO ges_agent_commercial (
         idagence, iduser, codeagent, nom, prenom, tel, adresse, objectif, etat
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9
       ) RETURNING *`,
      [
        idagence,
        iduser,
        codeagent,
        nom || null,
        prenom || null,
        tel || null,
        adresse || null,
        objectif !== undefined ? objectif : 0,
        etat !== undefined ? etat : true
      ]
    );
    res.status(201).json({ message: 'Agent commercial ajouté', data: rows[0] });
  } catch (err) {
    console.error('Erreur POST /ges_agent_commercial:', err);
    // Gestion d'une violation de contrainte d'unicité (codeagent)
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Un agent avec ce codeagent existe déjà.' });
    }
    // Gestion d'erreur de clé étrangère (agence ou utilisateur introuvable)
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Contrainte de clé étrangère violée (idagence ou iduser invalide).' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 3. Modifier un agent commercial existant
router.put('/ges_agent_commercial/:id', async (req, res) => {
  const { id } = req.params;
  const {
    idagence,
    iduser,
    codeagent,
    nom,
    prenom,
    tel,
    adresse,
    objectif,
    etat
  } = req.body;

  const fields = [];
  const values = [];
  let index = 1;

  if (idagence !== undefined) {
    fields.push(`idagence = $${index++}`);
    values.push(idagence);
  }
  if (iduser !== undefined) {
    fields.push(`iduser = $${index++}`);
    values.push(iduser);
  }
  if (codeagent !== undefined) {
    fields.push(`codeagent = $${index++}`);
    values.push(codeagent);
  }
  if (nom !== undefined) {
    fields.push(`nom = $${index++}`);
    values.push(nom);
  }
  if (prenom !== undefined) {
    fields.push(`prenom = $${index++}`);
    values.push(prenom);
  }
  if (tel !== undefined) {
    fields.push(`tel = $${index++}`);
    values.push(tel);
  }
  if (adresse !== undefined) {
    fields.push(`adresse = $${index++}`);
    values.push(adresse);
  }
  if (objectif !== undefined) {
    fields.push(`objectif = $${index++}`);
    values.push(objectif);
  }
  if (etat !== undefined) {
    fields.push(`etat = $${index++}`);
    values.push(etat);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  values.push(id); // pour la clause WHERE
  const query = `UPDATE ges_agent_commercial SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, values);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Agent commercial non trouvé' });
    }
    res.json({ message: 'Agent commercial modifié', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /ges_agent_commercial/:id:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Un agent avec ce codeagent existe déjà.' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Contrainte de clé étrangère violée (idagence ou iduser invalide).' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
