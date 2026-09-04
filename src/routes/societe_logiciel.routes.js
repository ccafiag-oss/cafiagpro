const express = require('express');
const router = express.Router();
const pool = require('../config/db');


// ======================================================
// AFFICHER TOUTES LES SOCIETES LOGICIELS
// ======================================================
router.get('/listesocietelogiciel', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                sl.idsociete_logiciel,
                sl.idsociete,
                sl.idlogiciel,
                sl.etat,
                l.designation
            FROM societe_logiciel sl
            INNER JOIN logiciel l
                ON sl.idlogiciel = l.idlogiciel
            ORDER BY l.designation
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


// ======================================================
// AFFICHER PAR ID
// ======================================================
router.get('/societelogiciel/:idsociete_logiciel', async (req, res) => {

    try {

        const { idsociete_logiciel } = req.params;

        const result = await pool.query(`
            SELECT
                sl.idsociete_logiciel,
                sl.idsociete,
                sl.idlogiciel,
                sl.etat,
                l.designation
            FROM societe_logiciel sl
            INNER JOIN logiciel l
                ON sl.idlogiciel = l.idlogiciel
            WHERE sl.idsociete_logiciel = $1
        `, [idsociete_logiciel]);

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Donnée introuvable'
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


// ======================================================
// AJOUTER
// ======================================================
router.post('/ajoutersocietelogiciel', async (req, res) => {

    try {

        const {
            idsociete,
            idlogiciel,
            etat
        } = req.body;

        if (!idsociete || !idlogiciel) {

            return res.status(400).json({
                success: false,
                message: 'idsociete et idlogiciel obligatoires'
            });
        }

        // Vérifier doublon
        const existe = await pool.query(`
            SELECT idsociete_logiciel
            FROM societe_logiciel
            WHERE idsociete = $1
            AND idlogiciel = $2
        `, [idsociete, idlogiciel]);

        if (existe.rows.length > 0) {

            return res.status(400).json({
                success: false,
                message: 'Ce logiciel est déjà affecté à cette société'
            });
        }

        const result = await pool.query(`
            INSERT INTO societe_logiciel(
                idsociete,
                idlogiciel,
                etat
            )
            VALUES($1,$2,$3)
            RETURNING *
        `, [
            idsociete,
            idlogiciel,
            etat ?? true
        ]);

        res.status(201).json({
            success: true,
            message: 'Ajout effectué',
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


// ======================================================
// MODIFIER
// ======================================================
router.put('/miseajoursocietelogiciel/:idsociete_logiciel', async (req, res) => {

    try {

        const { idsociete_logiciel } = req.params;

        const {
            idsociete,
            idlogiciel,
            etat
        } = req.body;

        if (!idsociete || !idlogiciel) {

            return res.status(400).json({
                success: false,
                message: 'idsociete et idlogiciel obligatoires'
            });
        }

        // Vérifier doublon
        const existe = await pool.query(`
            SELECT idsociete_logiciel
            FROM societe_logiciel
            WHERE idsociete = $1
            AND idlogiciel = $2
            AND idsociete_logiciel <> $3
        `, [
            idsociete,
            idlogiciel,
            idsociete_logiciel
        ]);

        if (existe.rows.length > 0) {

            return res.status(400).json({
                success: false,
                message: 'Cette affectation existe déjà'
            });
        }

        const result = await pool.query(`
            UPDATE societe_logiciel
            SET
                idsociete = $1,
                idlogiciel = $2,
                etat = $3
            WHERE idsociete_logiciel = $4
            RETURNING *
        `, [
            idsociete,
            idlogiciel,
            etat,
            idsociete_logiciel
        ]);

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Donnée introuvable'
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