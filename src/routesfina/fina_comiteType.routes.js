const express = require('express');
const router = express.Router();
const pool = require('../config/db');


// ==========================================
// AJOUTER TYPE COMITE
// ==========================================
router.post('/comite-type', async (req, res) => {
    try {
        const {
            idagence,
            code_type,
            designation,
            niveau_ordre
        } = req.body;

        if (!idagence || !code_type || !designation) {
            return res.status(400).json({
                success: false,
                message: 'idagence, code_type et designation sont obligatoires'
            });
        }

        const query = `
            INSERT INTO fina_comite_type (
                idagence,
                code_type,
                designation,
                niveau_ordre
            )
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;

        const values = [
            idagence,
            code_type.trim().toUpperCase(),
            designation.trim(),
            niveau_ordre || 1
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
                message: 'Ce code de comité existe déjà pour cette agence'
            });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ==========================================
// MODIFIER TYPE COMITE
// ==========================================
router.put('/comite-type/:idtypecomite', async (req, res) => {
    try {
        const { idtypecomite } = req.params;

        const {
            idagence,
            code_type,
            designation,
            niveau_ordre,
            etat
        } = req.body;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence obligatoire'
            });
        }

        const query = `
            UPDATE fina_comite_type
            SET
                code_type = $1,
                designation = $2,
                niveau_ordre = $3,
                etat = $4
            WHERE idtypecomite = $5
              AND idagence = $6
            RETURNING *;
        `;

        const values = [
            code_type.trim().toUpperCase(),
            designation.trim(),
            niveau_ordre,
            etat,
            idtypecomite,
            idagence
        ];

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Type de comité introuvable'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {

        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: 'Code déjà utilisé dans cette agence'
            });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ==========================================
// LISTE TYPE COMITE
// ==========================================
router.get('/comite-type', async (req, res) => {
    try {
        const { idagence, search } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence obligatoire'
            });
        }

        let query = `
            SELECT *
            FROM fina_comite_type
            WHERE idagence = $1
              AND etat = TRUE
        `;

        const values = [idagence];
        let index = 2;

        if (search) {
            query += `
                AND (
                    code_type ILIKE $${index}
                    OR designation ILIKE $${index}
                )
            `;
            values.push(`%${search}%`);
            index++;
        }

        query += `
            ORDER BY niveau_ordre ASC, designation ASC
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
// DETAIL TYPE COMITE
// ==========================================
router.get('/comite-type/:idtypecomite', async (req, res) => {
    try {
        const { idtypecomite } = req.params;
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence obligatoire'
            });
        }

        const query = `
            SELECT *
            FROM fina_comite_type
            WHERE idtypecomite = $1
              AND idagence = $2
        `;

        const result = await pool.query(query, [
            idtypecomite,
            idagence
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Type de comité introuvable'
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
router.delete('/comite-type/:idtypecomite', async (req, res) => {
    try {
        const { idtypecomite } = req.params;
        const { idagence } = req.body;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence obligatoire'
            });
        }

        const query = `
            UPDATE fina_comite_type
            SET etat = FALSE
            WHERE idtypecomite = $1
              AND idagence = $2
            RETURNING *;
        `;

        const result = await pool.query(query, [
            idtypecomite,
            idagence
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Type de comité introuvable'
            });
        }

        res.json({
            success: true,
            message: 'Type de comité supprimé',
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