const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // pg.Pool configuré

// ======================================================
// 1. Liste des sociétés de l'utilisateur connecté
// ======================================================
router.get('/societes-par-user/:iduser', async (req, res) => {
  try {
    const { iduser } = req.params;
    const result = await pool.query(`
      SELECT
        u.iduser,
        CONCAT(u.nom, ' ', u.prenom) AS nomcomplet,
        cr.raisonsocial,
        ag.idsociete
      FROM utilisateur u
      INNER JOIN agence ag ON ag.idagence = u.idagence
      INNER JOIN creationsociete cr ON cr.idsociete = ag.idsociete
      WHERE u.iduser = $1
    `, [iduser]);

    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================================================
// 2. Détails d'une société (agences, pays, utilisateurs)
// ======================================================
router.get('/detail-societe/:idsociete', async (req, res) => {
  try {
    const { idsociete } = req.params;
    const result = await pool.query(`
      SELECT
        u.iduser,
        u.nom || ' ' || u.prenom AS nomcomplet,
        cr.raisonsocial,
        ag.idagence,
        ag.nomagence,
        ag.idpays,
        tp.pays
      FROM creationsociete cr
      INNER JOIN agence ag ON ag.idsociete = cr.idsociete
      INNER JOIN utilisateur u ON u.idagence = ag.idagence
      INNER JOIN tpays tp ON tp.idpays = ag.idpays
      WHERE cr.idsociete = $1
    `, [idsociete]);

    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================================================
// 3. Liste des pays d'une société
// ======================================================
router.get('/pays-par-societe/:idsociete', async (req, res) => {
  try {
    const { idsociete } = req.params;
    const result = await pool.query(`
      SELECT DISTINCT tp.idpays, tp.pays
      FROM agence ag
      INNER JOIN tpays tp ON tp.idpays = ag.idpays
      WHERE ag.idsociete = $1
    `, [idsociete]);

    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================================================
// 4. Liste des agences d'un pays (dans une société)
// ======================================================
router.get('/agences-par-pays/:idsociete/:idpays', async (req, res) => {
  try {
    const { idsociete, idpays } = req.params;
    const result = await pool.query(`
      SELECT ag.idagence, ag.nomagence
      FROM agence ag
      WHERE ag.idsociete = $1 AND ag.idpays = $2
    `, [idsociete, idpays]);

    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================================================
// 5. Liste des utilisateurs d'une agence
// ======================================================
router.get('/utilisateurs-par-agence/:idagence', async (req, res) => {
  try {
    const { idagence } = req.params;
    const result = await pool.query(`
      SELECT u.iduser, u.nom || ' ' || u.prenom AS nomcomplet
      FROM utilisateur u
      WHERE u.idagence = $1
    `, [idagence]);

    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================================================
// 6. Lier/Délier agences à un utilisateur
// ======================================================
router.get('/liaisons-utilisateur/:iduser', async (req, res) => {
  try {
    const { iduser } = req.params;
    const result = await pool.query(`
      SELECT ua.idutilisateur_agence,
             ua.iduser,
             ua.idagence,
             ua.etat,
             ag.nomagence,
             ag.idsociete,
             tp.pays
      FROM utilisateur_agence ua
      INNER JOIN agence ag ON ag.idagence = ua.idagence
      INNER JOIN tpays tp ON tp.idpays = ag.idpays
      WHERE ua.iduser = $1
    `, [iduser]);

    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/ajouter-utilisateur-agence', async (req, res) => {
  try {
    const { iduser, idagence, etat } = req.body;

    if (!iduser || !idagence) {
      return res.status(400).json({ success: false, message: 'iduser et idagence obligatoires' });
    }

    const existe = await pool.query(`
      SELECT idutilisateur_agence
      FROM utilisateur_agence
      WHERE iduser = $1 AND idagence = $2
    `, [iduser, idagence]);

    if (existe.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Cette liaison existe déjà' });
    }

    const result = await pool.query(`
      INSERT INTO utilisateur_agence(iduser, idagence, etat)
      VALUES($1, $2, $3)
      RETURNING *
    `, [iduser, idagence, etat ?? true]);

    res.status(201).json({ success: true, message: 'Liaison ajoutée', data: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/miseajour-utilisateur-agence/:idutilisateur_agence', async (req, res) => {
  try {
    const { idutilisateur_agence } = req.params;
    const { iduser, idagence, etat } = req.body;

    const result = await pool.query(`
      UPDATE utilisateur_agence
      SET iduser = $1, idagence = $2, etat = $3
      WHERE idutilisateur_agence = $4
      RETURNING *
    `, [iduser, idagence, etat, idutilisateur_agence]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Donnée introuvable' });
    }

    res.status(200).json({ success: true, message: 'Modification effectuée', data: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});


// ======================================================
// 7. LISTE DES AGENCES POUR LIAISON
// ======================================================
router.get(
'/agences-liaison-par-pays/:idsociete/:iduser/:idpays',
async (req, res) => {

  try {

    const {
      idsociete,
      iduser,
      idpays
    } = req.params;

    const result = await pool.query(`

      SELECT

        ag.idagence,
        ag.nomagence,
        tp.pays,

        ua.idutilisateur_agence,

        COALESCE(ua.etat,false) AS etat

      FROM agence ag

      INNER JOIN tpays tp
        ON tp.idpays = ag.idpays

      LEFT JOIN utilisateur_agence ua
        ON ua.idagence = ag.idagence
        AND ua.iduser = $2

      WHERE ag.idsociete = $1
      AND ag.idpays = $3

      ORDER BY ag.nomagence

    `, [
      idsociete,
      iduser,
      idpays
    ]);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (err) {

    console.error(err.message);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


// ======================================================
// 8. SAVE LIAISON UTILISATEUR AGENCE
// ======================================================
router.post('/save-utilisateur-agence', async (req, res) => {

  try {

    const {
      iduser,
      idagence,
      etat
    } = req.body;

    // ==========================================
    // VERIFIER EXISTENCE
    // ==========================================
    const existe = await pool.query(`
      SELECT *
      FROM utilisateur_agence
      WHERE iduser = $1
      AND idagence = $2
    `, [
      iduser,
      idagence
    ]);

    // ==========================================
    // SI EXISTE -> UPDATE
    // ==========================================
    if (existe.rows.length > 0) {

      const update = await pool.query(`

        UPDATE utilisateur_agence

        SET etat = $1

        WHERE iduser = $2
        AND idagence = $3

        RETURNING *

      `, [
        etat,
        iduser,
        idagence
      ]);

      return res.status(200).json({
        success: true,
        message: 'Liaison mise à jour',
        data: update.rows[0]
      });
    }

    // ==========================================
    // INSERT
    // ==========================================
    const insert = await pool.query(`

      INSERT INTO utilisateur_agence(
        iduser,
        idagence,
        etat
      )

      VALUES($1,$2,$3)

      RETURNING *

    `, [
      iduser,
      idagence,
      etat
    ]);

    res.status(201).json({
      success: true,
      message: 'Liaison ajoutée',
      data: insert.rows[0]
    });

  } catch (err) {

    console.error(err.message);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});





// ======================================================
// LISTE DES AGENCES LIEES A UN UTILISATEUR
// ======================================================
router.get('/agences-utilisateur/:iduser', async (req, res) => {

    try {

        const { iduser } = req.params;

        const result = await pool.query(`

            SELECT
                ag.idagence,
                ag.nomagence

            FROM utilisateur_agence ua

            INNER JOIN agence ag
                ON ag.idagence = ua.idagence

            WHERE ua.iduser = $1
            AND ua.etat = TRUE

            ORDER BY ag.nomagence

        `, [iduser]);

        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (err) {

        console.error(err.message);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});





// ======================================================
// LOGICIELS SELON AGENCE
// ======================================================
router.get('/logiciels-par-agence/:idagence', async (req, res) => {

    try {

        const { idagence } = req.params;

        const result = await pool.query(`

            SELECT DISTINCT

                sl.idsociete_logiciel,
                sl.idsociete,

                ag.idagence,

                sl.idlogiciel,

                sl.etat,

                l.designation

            FROM agence ag

            INNER JOIN societe_logiciel sl
                ON sl.idsociete = ag.idsociete

            INNER JOIN logiciel l
                ON l.idlogiciel = sl.idlogiciel

            WHERE ag.idagence = $1
            AND sl.etat = TRUE

            ORDER BY l.designation

        `, [idagence]);

        res.status(200).json({

            success: true,

            total: result.rows.length,

            data: result.rows
        });

    } catch (err) {

        console.error(err.message);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});




module.exports = router;
