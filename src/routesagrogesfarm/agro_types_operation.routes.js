// =========================================
// ROUTES NODE.JS POUR agro_types_operation
// =========================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================
// AFFICHER TOUS LES TYPES D'OPÉRATIONS (idagence obligatoire)
// =========================================
router.get('/agro_types_operation', async (req, res) => {
    try {
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est obligatoire pour afficher les données'
            });
        }

        const query = `
            SELECT * FROM agro_types_operation
            WHERE idagence = $1
            ORDER BY idtypes_operation DESC;
        `;

        const { rows } = await pool.query(query, [idagence]);

        res.status(200).json({
            success: true,
            total: rows.length,
            data: rows
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// ENREGISTRER UN TYPE D'OPÉRATION
// =========================================
router.post('/agro_types_operation', async (req, res) => {
    try {
        const { idagence, nom, description, paramettre, idmodel } = req.body;

        // Validation minimale
        if (!idagence || !nom || !paramettre || !idmodel) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez renseigner tous les champs obligatoires'
            });
        }

        const query = `
            INSERT INTO agro_types_operation (idagence, nom, description, paramettre, idmodel)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;

        const values = [idagence, nom, description, paramettre, idmodel];

        const { rows } = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: 'Type d\'opération enregistré avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: 'Un type d\'opération avec ce nom ou ce paramètre existe déjà.'
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// MODIFIER UN TYPE D'OPÉRATION
// =========================================
router.put('/agro_types_operation/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nom, description, paramettre, idmodel } = req.body;

        if (!nom || !paramettre || !idmodel) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez renseigner tous les champs obligatoires'
            });
        }

        const query = `
            UPDATE agro_types_operation
            SET nom = $1,
                description = $2,
                paramettre = $3,
                idmodel = $4
            WHERE idtypes_operation = $5
            RETURNING *;
        `;

        const values = [nom, description, paramettre, idmodel, id];

        const { rows, rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Type d\'opération introuvable'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Type d\'opération mis à jour avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: 'Un type d\'opération avec ce nom ou ce paramètre existe déjà.'
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;