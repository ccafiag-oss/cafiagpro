const express = require('express');
const router = express.Router();
const pool = require('../config/db');


// =====================================================
// 1. AFFICHER TOUS LES ASSUREURS
// GET /api/s_assureur
// =====================================================
router.get('/s_assureur', async (req, res) => {

    try {

        // RECUPERATION PARAMETRE
        const { idagence } = req.query;

        // VALIDATION
        if (!idagence) {

            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est obligatoire'
            });

        }

        const result = await pool.query(`
            SELECT
                idassureur,
                idagence,
                designation,
                description,
                date_creation,
                actif,
                taux
            FROM s_assureur
            WHERE idagence = $1
            ORDER BY idassureur DESC
        `,
        [
            idagence
        ]);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    }

});


// =====================================================
// 2. AFFICHER UN ASSUREUR PAR ID
// GET /api/s_assureur/:id
// =====================================================
router.get('/s_assureur/:id', async (req, res) => {

    try {

        const { id } = req.params;

        const result = await pool.query(`
            SELECT
                idassureur,
                idagence,
                designation,
                description,
                date_creation,
                actif,
                taux
            FROM s_assureur
            WHERE idassureur = $1
        `, [id]);

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Assureur introuvable'
            });

        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    }

});


// =====================================================
// 3. AJOUTER ASSUREUR
// POST /api/s_assureur
// =====================================================
router.post('/s_assureur', async (req, res) => {

    try {

        let {
            idagence,
            designation,
            description,
            taux
        } = req.body;

        // VALIDATION
        if (!idagence) {

            return res.status(400).json({
                success: false,
                message: 'L’agence est obligatoire'
            });

        }

        if (!designation || designation.trim() === '') {

            return res.status(400).json({
                success: false,
                message: 'La designation est obligatoire'
            });

        }

        const result = await pool.query(`
            INSERT INTO s_assureur
            (
                idagence,
                designation,
                description,
                taux
            )
            VALUES ($1,$2,$3,$4)
            RETURNING *
        `,
        [
            idagence,
            designation,
            description || null,taux
        ]);

        return res.status(201).json({
            success: true,
            message: 'Assureur ajouté avec succès',
            data: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    }

});


// =====================================================
// 4. MODIFIER ASSUREUR
// PUT /api/s_assureur/:id
// =====================================================
router.put('/s_assureur/:id', async (req, res) => {

    try {

        const { id } = req.params;

        let {
            idagence,
            designation,
            description,
            actif,
            taux
        } = req.body;

        // VALIDATION
        if (!idagence) {

            return res.status(400).json({
                success: false,
                message: 'L’agence est obligatoire'
            });

        }

        if (!designation || designation.trim() === '') {

            return res.status(400).json({
                success: false,
                message: 'La designation est obligatoire'
            });

        }

        const result = await pool.query(`
            UPDATE s_assureur
            SET
                idagence = $1,
                designation = $2,
                description = $3,
                actif = $4,
                taux=$5
            WHERE idassureur = $6
            RETURNING *
        `,
        [
            idagence,
            designation,
            description || null,
            actif,
            taux,
            id
        ]);

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Assureur introuvable'
            });

        }

        return res.status(200).json({
            success: true,
            message: 'Assureur modifié avec succès',
            data: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    }

});


// =====================================================
// 5. SUPPRIMER ASSUREUR
// DELETE /api/s_assureur/:id
// =====================================================
router.delete('/s_assureur/:id', async (req, res) => {

    try {

        const { id } = req.params;

        const result = await pool.query(`
            DELETE FROM s_assureur
            WHERE idassureur = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Assureur introuvable'
            });

        }

        return res.status(200).json({
            success: true,
            message: 'Assureur supprimé avec succès'
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    }

});

module.exports = router;