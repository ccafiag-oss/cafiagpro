const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assure-toi que pool est un pg.Pool configuré



// ==========================================
// AFFICHER TOUS LES LOGICIELS
// ==========================================
router.get('/listelogiciel', async (req, res) => {
    try {

        const result = await pool.query(`
            SELECT *
            FROM logiciel
            ORDER BY designation
        `);

        res.status(200).json(result.rows);

    } catch (err) {

        console.error(err.message);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


// ==========================================
// AFFICHER UN LOGICIEL PAR ID
// ==========================================
router.get('/listelogiciel:idlogiciel', async (req, res) => {

    try {

        const { idlogiciel } = req.params;

        const result = await pool.query(`
            SELECT *
            FROM logiciel
            WHERE idlogiciel = $1
        `, [idlogiciel]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Logiciel introuvable'
            });
        }

        res.status(200).json(result.rows[0]);

    } catch (err) {

        console.error(err.message);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


// ==========================================
// AJOUTER LOGICIEL
// ==========================================
router.post('/ajouterlogiciel', async (req, res) => {

    try {

        const { designation } = req.body;

        if (!designation) {
            return res.status(400).json({
                success: false,
                message: 'La designation est obligatoire'
            });
        }

        // Vérifier doublon
        const existe = await pool.query(`
            SELECT idlogiciel
            FROM logiciel
            WHERE LOWER(designation)=LOWER($1)
        `, [designation]);

        if (existe.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Ce logiciel existe déjà'
            });
        }

        const result = await pool.query(`
            INSERT INTO logiciel(designation)
            VALUES($1)
            RETURNING *
        `, [designation]);

        res.status(201).json({
            success: true,
            message: 'Logiciel ajouté avec succès',
            data: result.rows[0]
        });

    } catch (err) {

        console.error(err.message);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


// ==========================================
// MODIFIER LOGICIEL
// ==========================================
router.put('/miseajourlogiciel:idlogiciel', async (req, res) => {

    try {

        const { idlogiciel } = req.params;
        const { designation } = req.body;

        if (!designation) {
            return res.status(400).json({
                success: false,
                message: 'La designation est obligatoire'
            });
        }

        // Vérifier doublon
        const existe = await pool.query(`
            SELECT idlogiciel
            FROM logiciel
            WHERE LOWER(designation)=LOWER($1)
            AND idlogiciel <> $2
        `, [designation, idlogiciel]);

        if (existe.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cette designation existe déjà'
            });
        }

        const result = await pool.query(`
            UPDATE logiciel
            SET designation = $1
            WHERE idlogiciel = $2
            RETURNING *
        `, [designation, idlogiciel]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Logiciel introuvable'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Modification effectuée',
            data: result.rows[0]
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