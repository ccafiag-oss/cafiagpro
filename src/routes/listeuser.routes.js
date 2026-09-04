const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const idag = req.query.idag;  // Exemple : /api/utilisateur?idag=AG01

    // 🔹 requête sécurisée avec $1
    const { rows } = await pool.query(
      `SELECT 
        iduser AS "IDUSER",
        logineuser AS "LOGINEUSER",
       
        nom AS "NOM",
        prenom AS "PRENOM",
        telephone AS "TELEPHONE",
        roles AS "ROLES",
        solde AS "SOLDE",
        soldereglvente AS "SOLDEREGLVENTE",
        idrole AS "IDROLE",
        etat AS "ETAT",
        idag AS "IDAG",
        heuredebutactivite AS "HEUREDEBUTACTIVITE",
        heurfinactivite AS "HEURFINACTIVITE",
        premiere_connexion AS "PREMIERE_CONNEXION",
        idservice AS "IDSERVICE",
        designation_service AS "DESIGNATION_SERVICE",
        id_societe AS "ID_SOCIETE",
        photouser AS "PHOTOUSER",codeclient AS "CODECLIENT",idagence,comptecaisse
      FROM utilisateur
      WHERE idag = $1`,
      [idag]
    );

    const total = rows.length;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 500;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = rows.slice(startIndex, endIndex);

    res.json({
      meta: { total, page, pageSize },
      data: paginatedData
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération utilisateur' });
  }
});









module.exports = router;
