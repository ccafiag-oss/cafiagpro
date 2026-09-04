const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/* =========================================
   AJOUTER UNE COOPERATIVE
========================================= */

router.post('/fina_cooperative', async (req, res) => {

    try {

        const {

            codecooperative,
            idagence,
            iduser,

            raisonsociale,
            sigle,

            adresse,
            siege,

            telephone,
            email,

            responsable,
            numeroregistre,

            etat

        } = req.body;

        //=====================================
        // VALIDATION
        //=====================================

        if (
            !codecooperative ||
            !idagence ||
            !raisonsociale
        ) {

            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants'
            });
        }

        //=====================================
        // INSERTION
        //=====================================

        const query = `
            INSERT INTO fina_cooperative
            (
                codecooperative,
                idagence,
                iduser,

                raisonsociale,
                sigle,

                adresse,
                siege,

                telephone,
                email,

                responsable,
                numeroregistre,

                etat
            )
            VALUES
            (
                $1,$2,$3,$4,$5,
                $6,$7,$8,$9,$10,$11,$12
            )
            RETURNING *;
        `;

        const values = [

            codecooperative,
            idagence,
            iduser,

            raisonsociale,
            sigle,

            adresse,
            siege,

            telephone,
            email,

            responsable,
            numeroregistre,

            etat ?? true
        ];

        const result = await pool.query(query, values);

        res.status(201).json({

            success: true,

            message: 'Coopérative ajoutée avec succès',

            data: result.rows[0]
        });

    } catch (error) {

        console.log(error);

        //=====================================
        // GESTION DOUBLON
        //=====================================

        if (error.code === '23505') {

            return res.status(400).json({
                success: false,
                message: 'Ce code coopérative existe déjà'
            });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* =========================================
   AFFICHER TOUTES LES COOPERATIVES
========================================= */

router.get('/fina_cooperative', async (req, res) => {

    try {

        const query = `
            SELECT

                idcooperative,
                codecooperative,
                idagence,
                iduser,

                raisonsociale,
                sigle,

                adresse,
                siege,

                telephone,
                email,

                responsable,
                numeroregistre,

                etat,

                datecreation,
                datemodification

            FROM fina_cooperative

            ORDER BY idcooperative DESC;
        `;

        const result = await pool.query(query);

        res.status(200).json({

            success: true,

            total: result.rows.length,

            data: result.rows
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message: error.message
        });
    }
});

/* =========================================
   AFFICHER UNE COOPERATIVE PAR ID
========================================= */

router.get('/fina_cooperative/:idcooperative', async (req, res) => {

    try {

        const { idcooperative } = req.params;

        const query = `
            SELECT *
            FROM fina_cooperative
            WHERE idcooperative = $1;
        `;

        const result = await pool.query(
            query,
            [idcooperative]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: 'Coopérative introuvable'
            });
        }

        res.status(200).json({

            success: true,

            data: result.rows[0]
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message: error.message
        });
    }
});

/* =========================================
   MODIFIER UNE COOPERATIVE
========================================= */

router.put('/fina_cooperative/:idcooperative', async (req, res) => {

    try {

        const { idcooperative } = req.params;

        const {

            codecooperative,
            idagence,
            iduser,

            raisonsociale,
            sigle,

            adresse,
            siege,

            telephone,
            email,

            responsable,
            numeroregistre,

            etat

        } = req.body;

        //=====================================
        // UPDATE
        //=====================================

        const query = `
            UPDATE fina_cooperative
            SET

                codecooperative = $1,
                idagence = $2,
                iduser=$3,
                raisonsociale = $4,
                sigle = $5,

                adresse = $6,
                siege = $7,

                telephone = $8,
                email = $9,

                responsable = $10,
                numeroregistre = $11,

                etat = $12,

                datemodification = CURRENT_TIMESTAMP

            WHERE idcooperative = $13

            RETURNING *;
        `;

        const values = [

            codecooperative,
            idagence,
            iduser,
            raisonsociale,
            sigle,

            adresse,
            siege,

            telephone,
            email,

            responsable,
            numeroregistre,

            etat,

            idcooperative
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: 'Coopérative introuvable'
            });
        }

        res.status(200).json({

            success: true,

            message: 'Modification effectuée avec succès',

            data: result.rows[0]
        });

    } catch (error) {

        console.log(error);

        if (error.code === '23505') {

            return res.status(400).json({

                success: false,

                message: 'Ce code coopérative existe déjà'
            });
        }

        res.status(500).json({

            success: false,

            message: error.message
        });
    }
});









/* =========================================
   AFFICHER LES COOPERATIVES
   PAR AGENCE ET UTILISATEUR
========================================= */

router.get(
    '/fina_cooperative/:idagence/:iduser',
    async (req, res) => {

    try {

        const { idagence, iduser } =
            req.params;

        const query = `
            SELECT

                idcooperative,
                codecooperative,
                idagence,
                iduser,

                raisonsociale,
                sigle,

                adresse,
                siege,

                telephone,
                email,

                responsable,
                numeroregistre,

                etat,

                datecreation,
                datemodification

            FROM fina_cooperative

            WHERE idagence = $1
            AND iduser = $2

            ORDER BY raisonsociale ASC;
        `;

        const result = await pool.query(
            query,
            [idagence, iduser]
        );

        res.status(200).json({

            success: true,

            total: result.rows.length,

            data: result.rows
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message: error.message
        });
    }
});

/* =========================================
   LIER UN CLIENT A UNE COOPERATIVE
========================================= */

router.put(
    '/finaclients/cooperative/:idclient',
    async (req, res) => {

    try {

        const { idclient } = req.params;

        const { idcooperative } = req.body;

        //=====================================
        // UPDATE
        //=====================================

        const query = `
            UPDATE finaclients
            SET

                idcooperative = $1

            WHERE idclient = $2

            RETURNING *;
        `;

        const values = [
            idcooperative || null,
            idclient
        ];

        const result = await pool.query(
            query,
            values
        );

        //=====================================
        // VERIFICATION
        //=====================================

        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    'Client introuvable'
            });
        }

        res.status(200).json({

            success: true,

            message:
                'Coopérative liée avec succès',

            data: result.rows[0]
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message: error.message
        });
    }
});

/* =========================================
   RETIRER UNE COOPERATIVE D'UN CLIENT
========================================= */

router.put(
    '/finaclients/remove/cooperative/:idclient',
    async (req, res) => {

    try {

        const { idclient } = req.params;

        const query = `
            UPDATE finaclients
            SET

                idcooperative = NULL

            WHERE idclient = $1

            RETURNING *;
        `;

        const result = await pool.query(
            query,
            [idclient]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    'Client introuvable'
            });
        }

        res.status(200).json({

            success: true,

            message:
                'Coopérative retirée avec succès',

            data: result.rows[0]
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message: error.message
        });
    }
});
















module.exports = router;