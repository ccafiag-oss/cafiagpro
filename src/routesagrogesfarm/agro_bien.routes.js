// =========================================
// ROUTES NODE.JS POUR agro_bien
// =========================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================
// AFFICHER TOUS LES BIENS AVEC LEURS CATEGORIES ET STATUTS (idagence obligatoire)
// =========================================
router.get('/agro_bien', async (req, res) => {
    try {
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est obligatoire pour afficher les données'
            });
        }

        const query = `
            SELECT b.*, 
                   c.nom AS categorie_nom, 
                   s.nom AS statut_nom 
            FROM agro_bien b
            LEFT JOIN agro_categorie_bien c ON b.agro_categorie_id = c.id
            LEFT JOIN agro_statut_bien s ON b.agro_statut_id = s.id
            WHERE b.idagence = $1
            ORDER BY b.id DESC;
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
// ENREGISTRER UN BIEN
// =========================================
router.post('/agro_bien', async (req, res) => {
    try {
        const {
            agro_categorie_id,
            agro_statut_id,
            idagence,
            immatriculation,
            gestionnaire,
            description,
            valeur,
            date_acquisition,
            localisation
        } = req.body;

        // Validation minimale
        if (!agro_categorie_id || !agro_statut_id || !idagence) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez renseigner les champs obligatoires (catégorie, statut, idagence)'
            });
        }

        const query = `
            INSERT INTO agro_bien (
                agro_categorie_id, agro_statut_id, idagence,
                immatriculation, gestionnaire, description,
                valeur, date_acquisition, localisation
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;

        const values = [
            agro_categorie_id,
            agro_statut_id,
            idagence,
            immatriculation,
            gestionnaire,
            description,
            valeur,
            date_acquisition,
            localisation
        ];

        const { rows } = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: 'Bien enregistré avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// MODIFIER UN BIEN
// =========================================
router.put('/agro_bien/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            agro_categorie_id,
            agro_statut_id,
            immatriculation,
            gestionnaire,
            description,
            valeur,
            date_acquisition,
            localisation
        } = req.body;

        if (!agro_categorie_id || !agro_statut_id) {
            return res.status(400).json({
                success: false,
                message: 'La catégorie et le statut sont obligatoires'
            });
        }

        const query = `
            UPDATE agro_bien
            SET agro_categorie_id = $1,
                agro_statut_id = $2,
                immatriculation = $3,
                gestionnaire = $4,
                description = $5,
                valeur = $6,
                date_acquisition = $7,
                localisation = $8
            WHERE id = $9
            RETURNING *;
        `;

        const values = [
            agro_categorie_id,
            agro_statut_id,
            immatriculation,
            gestionnaire,
            description,
            valeur,
            date_acquisition,
            localisation,
            id
        ];

        const { rows, rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Bien introuvable'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Bien mis à jour avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;