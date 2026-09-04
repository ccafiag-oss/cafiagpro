const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/* =========================================
   AJOUTER UNE CAMPAGNE
========================================= */
router.post('/agro_campagne', async (req, res) => {
    try {
        const {
            codecampagne,
            idagence,
            designation,
            idannee,
            status,
            datedebut,
            datefin,
            etat,
            idarticle // Ajout
        } = req.body;

        const query = `
            INSERT INTO agro_campagne
            (
                codecampagne,
                idagence,
                designation,
                idannee,
                status,
                datedebut,
                datefin,
                etat,
                idarticle
            )
            VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;

        const values = [
            codecampagne,
            idagence,
            designation,
            idannee,
            status || 'OUVERT',
            datedebut,
            datefin,
            etat ?? true,
            idarticle || null // Ajout
        ];

        const result = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: 'Campagne ajoutée avec succès',
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* =========================================
   AFFICHER TOUTES LES CAMPAGNES
========================================= */
router.get('/agro_campagne', async (req, res) => {
    try {
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est requis'
            });
        }

        // Utilisation d'une jointure pour récupérer le libellé de l'article
        const query = `
            SELECT
                c.idcampagne,
                c.codecampagne,
                c.idagence,
                c.designation,
                c.idannee,
                c.status,
                c.datedebut,
                c.datefin,
                c.etat,
                c.datecreation,
                c.idarticle,
                a.designation AS designation_article
            FROM agro_campagne c
            LEFT JOIN garticle a ON c.idarticle = a.idarticle
            WHERE c.idagence = $1 and c.etat='true'
            ORDER BY c.idcampagne DESC;
        `;

        const result = await pool.query(query, [idagence]);

        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* =========================================
   AFFICHER UNE CAMPAGNE PAR ID
========================================= */
router.get('/agro_campagne/:idcampagne', async (req, res) => {
    try {
        const { idcampagne } = req.params;

        const query = `
            SELECT c.*, a.designation AS designation_article
            FROM agro_campagne c
            LEFT JOIN garticle a ON c.idarticle = a.idarticle
            WHERE c.idcampagne = $1;
        `;

        const result = await pool.query(query, [idcampagne]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campagne introuvable'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* =========================================
   MODIFIER UNE CAMPAGNE
========================================= */
router.put('/agro_campagne/:idcampagne', async (req, res) => {
    try {
        const { idcampagne } = req.params;

        const {
            codecampagne,
            idagence,
            designation,
            idannee,
            status,
            datedebut,
            datefin,
            etat,
            idarticle // Ajout
        } = req.body;

        const query = `
            UPDATE agro_campagne
            SET
                codecampagne = $1,
                idagence = $2,
                designation = $3,
                idannee = $4,
                status = $5,
                datedebut = $6,
                datefin = $7,
                etat = $8,
                idarticle = $9, -- Ajout
                datemodification = CURRENT_TIMESTAMP
            WHERE idcampagne = $10
            RETURNING *;
        `;

        const values = [
            codecampagne,
            idagence,
            designation,
            idannee,
            status,
            datedebut,
            datefin,
            etat,
            idarticle || null, // Ajout
            idcampagne
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campagne introuvable'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Modification effectuée avec succès',
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;