const express = require('express');
const router = express.Router();
const pool = require('../config/db');



/*
=====================================================
1. GENERER LES 12 LOTS D'UNE ANNEE
POST /glot/generer
BODY:
{
   "idannee": 2026
}
=====================================================
*/

router.post('/glotgenerer', async (req, res) => {

    const { idannee } = req.body;

    // Validation
    if (!idannee) {
        return res.status(400).json({
            success: false,
            message: "L'année est obligatoire"
        });
    }

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        let lotsAjoutes = [];
        let lotsExistants = [];

        // Boucle de 1 à 12
        for (let mois = 1; mois <= 12; mois++) {

            // Vérifier si le lot existe déjà
            const checkLot = await client.query(
                `
                SELECT idlot
                FROM glot
                WHERE idmois = $1
                AND idannee = $2
                `,
                [mois, idannee]
            );

            // Si existe déjà
            if (checkLot.rows.length > 0) {

                lotsExistants.push(mois);

            } else {

                // Insertion
                const insertLot = await client.query(
                    `
                    INSERT INTO glot
                    (
                        idmois,
                        idannee
                    )
                    VALUES
                    (
                        $1,
                        $2
                    )
                    RETURNING *
                    `,
                    [mois, idannee]
                );

                lotsAjoutes.push(insertLot.rows[0]);
            }
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: "Génération des lots terminée",
            annee: idannee,
            nombre_ajoutes: lotsAjoutes.length,
            mois_existants: lotsExistants,
            data: lotsAjoutes
        });

    } catch (error) {

        await client.query('ROLLBACK');

        console.error('Erreur génération lots:', error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur",
            error: error.message
        });

    } finally {

        client.release();

    }

});



/*
=====================================================
2. RECUPERER LES LOTS
GET /glot
GET /glot?idannee=2026
=====================================================
*/

router.get('/glot', async (req, res) => {

    const { idannee } = req.query;

    try {

        let query = `
            SELECT *
            FROM glot
        `;

        const values = [];

        if (idannee) {

            query += ` WHERE idannee = $1 `;
            values.push(idannee);

        }

        query += `
            ORDER BY
            idannee DESC,
            idmois ASC
        `;

        const { rows } = await pool.query(query, values);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (error) {

        console.error('Erreur GET /glot:', error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur"
        });

    }

});



module.exports = router;