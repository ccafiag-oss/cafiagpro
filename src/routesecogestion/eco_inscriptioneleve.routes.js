const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================================================
// 🔵 1. RÉCUPÉRER LES ÉLÈVES INSCRITS DANS UNE CLASSE POUR UNE ANNÉE
// GET: http://localhost:5265/api/inscriptioneleve?idagence=1&idanneescolaire=2&idclasse=3
// =========================================================================
router.get('/inscriptioneleve', async (req, res) => {
  const { idagence, idanneescolaire, idclasse } = req.query;

  if (!idagence || !idanneescolaire || !idclasse) {
    return res.status(400).json({ success: false, message: 'Paramètres manquants.' });
  }

  try {
    const result = await pool.query(
      `SELECT 
        ie.*,
        e.nom AS nom_eleve,
        e.prenom AS prenom_eleve,
        e.codeeleve,
        p.libelleparcours AS nom_parcours,
        s.libelleserie AS nom_serie,
        st.libellestatus AS nom_status
       FROM eco_inscriptioneleve ie
       INNER JOIN eco_eleve e ON ie.ideleve = e.ideleve
       LEFT JOIN eco_parcours p ON ie.idparcours = p.idparcours
       LEFT JOIN eco_serie s ON ie.idserie = s.idserie
       LEFT JOIN eco_status st ON ie.idstatus = st.idstatus
       WHERE ie.idagence = $1 AND ie.idanneescolaire = $2 AND ie.idclasse = $3
       ORDER BY ie.idinscription ASC`,
      [idagence, idanneescolaire, idclasse]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 🟢 2. SYNCHRONISATION / INSCRIPTION DES ÉLÈVES (TRANSACTIONNEL)
// POST: http://localhost:5265/api/inscriptioneleve/sync
// =========================================================================
router.post('/inscriptioneleve/sync', async (req, res) => {
  const { idagence, idanneescolaire, idclasse, rows } = req.body;

  if (!idagence || !idanneescolaire || !idclasse || !Array.isArray(rows)) {
    return res.status(400).json({ success: false, message: 'Données invalides.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Suppression des anciennes configurations de la grille pour cette classe et cette année
    // (Conserve l'historique propre et évite les doublons)
    await client.query(
      `DELETE FROM eco_inscriptioneleve 
       WHERE idagence = $1 AND idanneescolaire = $2 AND idclasse = $3`,
      [idagence, idanneescolaire, idclasse]
    );

    // 2. Réinsertion des lignes courantes du tableau
    for (const row of rows) {
      await client.query(
        `INSERT INTO eco_inscriptioneleve (
          idagence, ideleve, idparcours, idanneescolaire, idclasse, idserie, idstatus,
          totalfrais, resteapayer, etat, motif, idclassesuivant, etatdecisionconseil
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          idagence,
          row.ideleve,
          row.idparcours || null,
          idanneescolaire,
          idclasse,
          row.idserie || null,
          row.idstatus || null,
          row.totalfrais || 0.00,
          row.resteapayer || 0.00,
          row.etat !== undefined ? row.etat : true,
          row.motif || 'inscrit',
          row.idclassesuivant || null,
          row.etatdecisionconseil || null
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Mise à jour des inscriptions réussie.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;