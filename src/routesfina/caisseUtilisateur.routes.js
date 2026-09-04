const express = require('express');
const router = express.Router();
const pool = require('../config/db');


// ===================================================
// 🔵 1. LISTE DES CAISSES
// ===================================================
// ==========================================
// RÉCUPÉRER LES CAISSES UTILISATEUR PAR IDAGENCE (OBLIGATOIRE)
// GET: http://localhost:5265/api/caisse-utilisateur?idagence=1
// ==========================================
router.get('/caisse-utilisateur', async (req, res) => {
  const { idagence } = req.query;

  // 🔴 Contrainte stricte : l'idagence est obligatoire
  if (!idagence) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le paramètre "idagence" est obligatoire pour charger les caisses utilisateurs.' 
    });
  }

  try {
    // Filtrage par agence et tri cohérent par ID décroissant
    const queryText = `
     SELECT 
    cu.idcaisse, 
    cu.idagence, 
    cu.designation, 
    cu.iduser, 
    cu.comptecaisse, 
    cu.etat, 
    cu.created_at,
    CONCAT(u.nom, ' ', u.prenom) AS nomutilisateur 
FROM caisse_utilisateur cu
INNER JOIN utilisateur u ON cu.iduser = u.iduser
WHERE cu.idagence = $1 
ORDER BY cu.idcaisse DESC;
    `;
    
    const result = await pool.query(queryText, [idagence]);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /caisse-utilisateur:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du chargement des caisses utilisateurs.' 
    });
  }
});

// ===================================================
// 🟢 2. AJOUTER UNE CAISSE
// ===================================================
router.post('/caisse-utilisateur', async (req, res) => {
  try {
    const { idagence, designation, iduser, comptecaisse } = req.body;

    const result = await pool.query(
      `INSERT INTO caisse_utilisateur
       (idagence, designation, iduser, comptecaisse)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [idagence, designation, iduser, comptecaisse]
    );

    res.json({
      message: 'Caisse ajoutée avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error(err);

    // gestion duplication
    if (err.code === '23505') {
      return res.status(400).json({
        error: 'Cette caisse existe déjà pour cet utilisateur'
      });
    }

    res.status(500).json({ error: 'Erreur ajout caisse' });
  }
});


// ===================================================
// 🟡 3. MODIFIER UNE CAISSE
// ===================================================

router.put('/caisse-utilisateur/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const { designation, comptecaisse, iduser, etat } = req.body;

    const result = await pool.query(
      `UPDATE caisse_utilisateur
       SET designation = $1,
           comptecaisse = $2,
           iduser = $3,
           etat = $4
       WHERE idcaisse = $5
       RETURNING *`,
      [designation, comptecaisse, iduser, etat, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Caisse introuvable'
      });
    }

    res.json({
      success: true,
      message: 'Caisse modifiée avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur modification caisse :', err);

    res.status(500).json({
      success: false,
      error: 'Erreur modification caisse'
    });
  }
});
/*
router.put('/caisse-utilisateur/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { designation, comptecaisse, etat } = req.body;

    const result = await pool.query(
      `UPDATE caisse_utilisateur
       SET designation = $1,
           comptecaisse = $2,
           etat = $3
       WHERE idcaisse = $4
       RETURNING *`,
      [designation, comptecaisse, etat, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Caisse introuvable' });
    }

    res.json({
      message: 'Caisse modifiée avec succès',
      data: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur modification caisse' });
  }
});

*/

// ===================================================
// 🔴 4. ACTIVER / DÉSACTIVER
// ===================================================
router.patch('/caisse-utilisateur/:id/etat', async (req, res) => {
  try {
    const id = req.params.id;
    const { etat } = req.body;

    const result = await pool.query(
      `UPDATE caisse_utilisateur
       SET etat = $1
       WHERE idcaisse = $2
       RETURNING *`,
      [etat, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Caisse introuvable' });
    }

    res.json({
      message: 'État mis à jour',
      data: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur mise à jour état' });
  }
});








router.get('/caisse_utilisateur_user', async (req, res) => {
  const { idagence, iduser } = req.query;

  // 🔴 idagence obligatoire
  if (!idagence) {
    return res.status(400).json({
      success: false,
      error: 'Le paramètre "idagence" est obligatoire pour charger les caisses utilisateurs.'
    });
  }

  try {
    let queryText = `
      SELECT 
          cu.idcaisse,
          cu.idagence,
          cu.designation,
          cu.iduser,
          cu.comptecaisse,
          cu.etat,
          cu.created_at,
          CONCAT(u.nom, ' ', u.prenom) AS nomutilisateur
      FROM caisse_utilisateur cu
      INNER JOIN utilisateur u ON cu.iduser = u.iduser
      WHERE cu.idagence = $1 and cu.etat = 'true'
    `;

    const params = [idagence];

    // Ajouter le filtre sur iduser si fourni
    if (iduser) {
      queryText += ` AND cu.iduser = $2`;
      params.push(iduser);
    }

    queryText += ` ORDER BY cu.idcaisse DESC`;

    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur GET /caisse-utilisateur:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du chargement des caisses utilisateurs.'
    });
  }
});
// ===================================================
// EXPORT
// ===================================================
module.exports = router;