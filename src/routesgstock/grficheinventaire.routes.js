const express = require('express');
const router = express.Router();
const pool = require('../config/db');


// ==========================================
// AFFICHER TOUTES LES FICHES INVENTAIRE
// AVEC IDAGENCE OBLIGATOIRE
// ==========================================
router.get('/afficherficheinventaire', async (req, res) => {

    try {

        // ================================
        // RECUPERATION PARAMETRE
        // ================================

        const idagence = req.query.idagence;

        // ================================
        // VALIDATION
        // ================================

        if (!idagence) {

            return res.status(400).json({

                success: false,
                message: "idagence est obligatoire"

            });
        }

        // ================================
        // REQUETE SQL
        // ================================

        const sql = `
            SELECT 
                idficheinventaire,
                codeficheinventaire,
                designation,
                idagence,
                iduser,
                dateinventaire,
                datedebut,
                datefin,
                etat,
                datecreation
            FROM g_fiche_inventaire
            WHERE idagence = $1 and etat='TRUE'
            ORDER BY idficheinventaire DESC
        `;

        const result = await pool.query(sql, [idagence]);

        // ================================
        // RETOUR
        // ================================

        res.status(200).json({

            success: true,
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


// ==========================================
// AFFICHER UNE FICHE PAR ID
// ==========================================
router.get('/afficherunficheinventaire/:id', async (req, res) => {

    try {

        const id = req.params.id;

        const sql = `
            SELECT *
            FROM g_fiche_inventaire
            WHERE idficheinventaire = $1
        `;

        const result = await pool.query(sql, [id]);

        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,
                message: 'Fiche introuvable'

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


// ==========================================
// AJOUTER UNE FICHE INVENTAIRE
// ==========================================
router.post('/ajouterficheinventaire', async (req, res) => {

    try {

        const {

            codeficheinventaire,
            idagence,
            iduser,
            dateinventaire,
            datedebut,
            datefin,
            etat,
            designation

        } = req.body;

        // ================================
        // VALIDATION
        // ================================

        if (!idagence) {

            return res.status(400).json({

                success: false,
                message: "idagence est obligatoire"

            });
        }

        const sql = `
            INSERT INTO g_fiche_inventaire
            (
                codeficheinventaire,
                idagence,
                iduser,
                dateinventaire,
                datedebut,
                datefin,
                etat,
                designation
            )
            VALUES
            (
                $1, $2, $3, $4, $5, $6, $7,$8
            )
            RETURNING *
        `;

        const values = [

            codeficheinventaire,
            idagence,
            iduser,
            dateinventaire,
            datedebut,
            datefin,
            etat ?? true,
            designation

        ];

        const result = await pool.query(sql, values);

        res.status(201).json({

            success: true,
            message: 'Fiche inventaire ajoutée avec succès',
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


// ==========================================
// MODIFIER UNE FICHE INVENTAIRE
// ==========================================
router.put('/modifierficheinventaire/:id', async (req, res) => {

    try {

        const id = req.params.id;

        const {

            codeficheinventaire,
            idagence,
            iduser,
            dateinventaire,
            datedebut,
            datefin,
            etat,
            designation

        } = req.body;

        const sql = `
            UPDATE g_fiche_inventaire
            SET
                codeficheinventaire = $1,
                idagence = $2,
                iduser = $3,
                dateinventaire = $4,
                datedebut = $5,
                datefin = $6,
                etat = $7,
                designation=$8
            WHERE idficheinventaire = $9
            RETURNING *
        `;

        const values = [

            codeficheinventaire,
            idagence,
            iduser,
            dateinventaire,
            datedebut,
            datefin,
            etat,
            designation,
            id
          

        ];

        const result = await pool.query(sql, values);

        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,
                message: 'Fiche introuvable'

            });
        }

        res.status(200).json({

            success: true,
            message: 'Fiche modifiée avec succès',
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