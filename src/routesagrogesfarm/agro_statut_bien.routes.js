// =========================================
// ROUTES NODE.JS POUR agro_statut_bien
// =========================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================
// AFFICHER TOUS LES STATUTS DE BIENS (idagence obligatoire)
// =========================================
router.get('/agro_statut_bien', async (req, res) => {
    try {
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est obligatoire pour afficher les données'
            });
        }

        const query = `
            SELECT * FROM agro_statut_bien
            WHERE idagence = $1
            ORDER BY id DESC;
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
// ENREGISTRER UN STATUT DE BIEN
// =========================================
router.post('/agro_statut_bien', async (req, res) => {
    try {
        const { idagence, nom, description } = req.body;

        // Validation minimale
        if (!idagence || !nom) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez renseigner les champs obligatoires (idagence et nom)'
            });
        }

        const query = `
            INSERT INTO agro_statut_bien (idagence, nom, description)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;

        const values = [idagence, nom, description];

        const { rows } = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: 'Statut de bien enregistré avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        if (error.code === '23505') { // Erreur d'unicité PostgreSQL sur le champ nom
            return res.status(400).json({
                success: false,
                message: 'Un statut avec ce nom existe déjà.'
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// MODIFIER UN STATUT DE BIEN
// =========================================
router.put('/agro_statut_bien/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nom, description } = req.body;

        if (!nom) {
            return res.status(400).json({
                success: false,
                message: 'Le nom du statut est obligatoire'
            });
        }

        const query = `
            UPDATE agro_statut_bien
            SET nom = $1,
                description = $2
            WHERE id = $3
            RETURNING *;
        `;

        const values = [nom, description, id];

        const { rows, rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Statut de bien introuvable'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Statut de bien mis à jour avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: 'Un statut avec ce nom existe déjà.'
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;