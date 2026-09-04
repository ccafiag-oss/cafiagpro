const express = require('express');
const router = express.Router();
const pool = require('../config/db');


// ==========================================
// AJOUTER SESSION COMITE
// ==========================================
router.post('/comite-session', async (req, res) => {
    try {
        const {
            codesession,
            idagence,
            idtypecomite,
            idmembrecomite,
            iddemande,
            iduser_ouverture,
            montant_accorde,
            score,
            observation,
            commentaire,
            statut
        } = req.body;

        if (
            !codesession ||
            !idagence ||
            !idtypecomite ||
            !idmembrecomite ||
            !iddemande ||
            !iduser_ouverture
        ) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants'
            });
        }

        const query = `
            INSERT INTO fina_comite_session (
                codesession,
                idagence,
                idtypecomite,
                idmembrecomite,
                iddemande,
                iduser_ouverture,
                montant_accorde,
                score,
                observation,
                commentaire,
                statut
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
            )
            RETURNING *;
        `;

        const values = [
            codesession.trim().toUpperCase(),
            idagence,
            idtypecomite,
            idmembrecomite,
            iddemande,
            iduser_ouverture,
            montant_accorde || 0,
            score || null,
            observation || null,
            commentaire || null,
            statut || 'OUVERT'
        ];

        const result = await pool.query(query, values);

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {

        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: 'Code session déjà existant'
            });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ==========================================
// MODIFIER SESSION COMITE
// ==========================================
router.put('/comite-session/:idsession', async (req, res) => {
    try {
        const { idsession } = req.params;

        const {
            idagence,
            montant_accorde,
            score,
            observation,
            commentaire,
            statut,
            date_fermeture,
            iduser_fermeture,
            etat
        } = req.body;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence obligatoire'
            });
        }

        const query = `
            UPDATE fina_comite_session
            SET
                montant_accorde = $1,
                score = $2,
                observation = $3,
                commentaire = $4,
                statut = $5,
                date_fermeture = $6,
                iduser_fermeture = $7,
                etat = $8
            WHERE idsession = $9
              AND idagence = $10
            RETURNING *;
        `;

        const values = [
            montant_accorde,
            score,
            observation,
            commentaire,
            statut,
            date_fermeture,
            iduser_fermeture,
            etat,
            idsession,
            idagence
        ];

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Session introuvable'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ==========================================
// LISTE SESSION COMITE
// ==========================================
router.get('/comite-session', async (req, res) => {
    try {
        const {
            idagence,
            idtypecomite,
            iddemande,
            statut,
            search
        } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence obligatoire'
            });
        }

        let query = `
            SELECT
                fcs.*,
                fct.designation AS type_comite
            FROM fina_comite_session fcs
            INNER JOIN fina_comite_type fct
                ON fct.idtypecomite = fcs.idtypecomite
            WHERE fcs.idagence = $1
              AND fcs.etat = TRUE
        `;

        const values = [idagence];
        let index = 2;

        if (idtypecomite) {
            query += ` AND fcs.idtypecomite = $${index}`;
            values.push(idtypecomite);
            index++;
        }

        if (iddemande) {
            query += ` AND fcs.iddemande = $${index}`;
            values.push(iddemande);
            index++;
        }

        if (statut) {
            query += ` AND fcs.statut = $${index}`;
            values.push(statut);
            index++;
        }

        if (search) {
            query += `
                AND (
                    fcs.codesession ILIKE $${index}
                    OR fcs.commentaire ILIKE $${index}
                    OR fcs.observation ILIKE $${index}
                )
            `;
            values.push(`%${search}%`);
            index++;
        }

        query += `
            ORDER BY fcs.idsession DESC
        `;

        const result = await pool.query(query, values);

        res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ==========================================
// DETAIL SESSION
// ==========================================
router.get('/comite-session/:idsession', async (req, res) => {
    try {
        const { idsession } = req.params;
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence obligatoire'
            });
        }

        const query = `
            SELECT *
            FROM fina_comite_session
            WHERE idsession = $1
              AND idagence = $2
        `;

        const result = await pool.query(query, [
            idsession,
            idagence
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Session introuvable'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ==========================================
// SUPPRESSION LOGIQUE
// ==========================================
router.delete('/comite-session/:idsession', async (req, res) => {
    try {
        const { idsession } = req.params;
        const { idagence } = req.body;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence obligatoire'
            });
        }

        const query = `
            UPDATE fina_comite_session
            SET etat = FALSE
            WHERE idsession = $1
              AND idagence = $2
            RETURNING *;
        `;

        const result = await pool.query(query, [
            idsession,
            idagence
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Session introuvable'
            });
        }

        res.json({
            success: true,
            message: 'Session supprimée',
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;