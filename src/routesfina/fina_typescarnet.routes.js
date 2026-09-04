const express = require('express');
const router = express.Router();
const pool = require('../config/db');


// ======================================================
// 🟢 AJOUTER (mettre en premier les routes fixes)
// ======================================================
router.post('/typescarnet', async (req, res) => {

    const {
        codetypescarnet,
        idagence,
        designation,
        duree,
        etat
    } = req.body;

    if (!codetypescarnet || !idagence || !designation || !duree) {
        return res.status(400).json({
            success: false,
            message: 'Champs obligatoires manquants'
        });
    }

    try {
        const verif = await pool.query(
            `
            SELECT idtypescarnet
            FROM fina_typescarnet
            WHERE idagence = $1
            AND codetypescarnet = $2
            `,
            [idagence, codetypescarnet]
        );

        if (verif.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Code déjà existant dans cette agence'
            });
        }

        const sql = `
            INSERT INTO fina_typescarnet (
                codetypescarnet,
                idagence,
                designation,
                duree,
                etat
            )
            VALUES ($1,$2,$3,$4,$5)
            RETURNING *
        `;

        const result = await pool.query(sql, [
            codetypescarnet,
            idagence,
            designation,
            duree,
            etat ?? true
        ]);

        return res.status(201).json({
            success: true,
            message: 'Ajout effectué',
            data: result.rows[0]
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ======================================================
// 🔵 LISTE PAR AGENCE + RECHERCHE
// ======================================================
// ✅ Afficher tous les types carnet
// ✅ Afficher les types carnet par agence
router.get('/affichertypescarnet/:idagence', async (req, res) => {
  const { idagence } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM fina_typescarnet WHERE idagence = $1 ORDER BY idtypescarnet`,
      [idagence]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur SQL:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des types carnet' });
  }
});


// ======================================================
// 🟠 MODIFIER
// ======================================================
router.put('/typescarnet/:id', async (req, res) => {

    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
        return res.status(400).json({
            success: false,
            message: 'ID invalide'
        });
    }

    const {
        idagence,
        codetypescarnet,
        designation,
        duree,
        etat
    } = req.body;

    if (!idagence) {
        return res.status(400).json({
            success: false,
            message: 'idagence obligatoire'
        });
    }

    try {

        const verif = await pool.query(
            `
            SELECT idtypescarnet
            FROM fina_typescarnet
            WHERE idtypescarnet = $1
            AND idagence = $2
            `,
            [id, idagence]
        );

        if (verif.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Introuvable'
            });
        }

        const doublon = await pool.query(
            `
            SELECT idtypescarnet
            FROM fina_typescarnet
            WHERE idagence = $1
            AND codetypescarnet = $2
            AND idtypescarnet <> $3
            `,
            [idagence, codetypescarnet, id]
        );

        if (doublon.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Code déjà utilisé'
            });
        }

        const sql = `
            UPDATE fina_typescarnet
            SET
                codetypescarnet = $1,
                designation = $2,
                duree = $3,
                etat = $4,
                datemodification = CURRENT_TIMESTAMP
            WHERE idtypescarnet = $5
            AND idagence = $6
            RETURNING *
        `;

        const result = await pool.query(sql, [
            codetypescarnet,
            designation,
            duree,
            etat,
            id,
            idagence
        ]);

        return res.json({
            success: true,
            message: 'Modification réussie',
            data: result.rows[0]
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;