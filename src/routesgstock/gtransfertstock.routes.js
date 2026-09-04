const express = require('express');
const router = express.Router();

const pool = require('../config/db');

// ======================================================
// INSERT TRANSFERT STOCK + MOUVEMENT STOCK
// ======================================================

router.post('/transfertstock', async (req, res) => {

    // ==================================================
    // TRANSACTION
    // ==================================================

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        console.log("================================================");
        console.log("🚀 API TRANSFERT STOCK");
        console.log("================================================");

        // ==================================================
        // RECUPERATION DONNEES
        // ==================================================

        const {

            idagence_emetteur,
            iddepot_emetteur,
            idarticle_emetteur,

            idagence_destinataire,
            iddepot_destinataire,
            idarticle_destinataire,

            iduser,

            quantite,

            prixachat,

            type_mouvement,

            observation,
            quantite_envoye,
            quantite_recue,
            documents,
            codetransfertstock

        } = req.body;



        const qte = Number(quantite);

        const qte_envoye = Number(quantite_envoye ?? qte);
        const qte_recue = Number(quantite_recue ?? qte);


        // ==================================================
        // LOG BODY
        // ==================================================

        console.log("📦 BODY => ", req.body);

        // ==================================================
        // VALIDATION
        // ==================================================

        if (

            idagence_emetteur == null ||
            iddepot_emetteur == null ||
            idarticle_emetteur == null ||

            idagence_destinataire == null ||
            iddepot_destinataire == null ||
            idarticle_destinataire == null ||

            iduser == null ||
            quantite == null ||
            prixachat == null ||

            !type_mouvement

        ) {

            await client.query('ROLLBACK');

            return res.status(400).json({

                success: false,

                message:
                    "Tous les champs obligatoires sont requis"

            });
        }

        // ==================================================
        // VALIDATION QUANTITE
        // ==================================================

        if (Number(quantite) <= 0) {

            await client.query('ROLLBACK');

            return res.status(400).json({

                success: false,

                message:
                    "Quantité invalide"

            });
        }

        // ==================================================
        // INSERT TABLE TRANSFERT
        // ==================================================

        const insertQuery = `

            INSERT INTO g_transfert_stock (

                idagence_emetteur,
                iddepot_emetteur,
                idarticle_emetteur,

                idagence_destinataire,
                iddepot_destinataire,
                idarticle_destinataire,

                iduser,

                quantite,

                type_mouvement,

                observation,

                datevalidation,

                etat,
                quantite_envoye,
                quantite_recue,
                documents,
                codetransfertstock

            )

            VALUES (

                $1,
                $2,
                $3,

                $4,
                $5,
                $6,

                $7,

                $8,

                $9,

                $10,

                NOW(),

                1,
                $11,
                $12,
                $13,
                $14

            )

            RETURNING *

        `;

        const values = [

            Number(idagence_emetteur),
            Number(iddepot_emetteur),
            Number(idarticle_emetteur),

            Number(idagence_destinataire),
            Number(iddepot_destinataire),
            Number(idarticle_destinataire),

            Number(iduser),

            Number(quantite),

            type_mouvement,

            observation || null,
            Number(quantite_envoye),
            Number(quantite_recue),
            documents,
            codetransfertstock

        ];

        console.log("📝 INSERT TRANSFERT");

        const result = await client.query(
            insertQuery,
            values
        );

        // ==================================================
        // SORTIE STOCK EMETTEUR
        // ==================================================

        console.log("================================");
        console.log("📤 SORTIE STOCK EMETTEUR");
        console.log("================================");

        console.log([
            idagence_emetteur,
            iddepot_emetteur,
            idarticle_emetteur,
            quantite_envoye
        ]);

        await client.query(

            `SELECT public.sortie_stock($1,$2,$3,$4,$5)`,

            [
                Number(idagence_emetteur),
                Number(iddepot_emetteur),
                Number(idarticle_emetteur),
                Number(quantite_envoye),
                codetransfertstock
            ]

        );

        console.log("✅ SORTIE STOCK OK");

        // ==================================================
        // ENTREE STOCK DESTINATAIRE
        // ==================================================

        console.log("================================");
        console.log("📥 ENTREE STOCK DESTINATAIRE");
        console.log("================================");

        console.log([
            idagence_destinataire,
            iddepot_destinataire,
            idarticle_destinataire,
            quantite_recue,
            prixachat
        ]);

        await client.query(

            `SELECT public.entree_stock($1,$2,$3,$4,$5,$6)`,

            [
                Number(idagence_destinataire),
                Number(iddepot_destinataire),
                Number(idarticle_destinataire),
                Number(quantite_recue),
                Number(prixachat),
                codetransfertstock
            ]

        );

        console.log("✅ ENTREE STOCK OK");

        // ==================================================
        // VALIDATION TRANSACTION
        // ==================================================

        await client.query('COMMIT');

        console.log("✅ TRANSFERT TERMINE");

        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(201).json({

            success: true,

            message:
                "Transfert stock effectué avec succès",

            data: result.rows[0]

        });

    } catch (error) {

        // ==================================================
        // ANNULATION
        // ==================================================

        await client.query('ROLLBACK');

        console.log("========================================");
        console.log("❌ ERREUR TRANSFERT STOCK");
        console.log("========================================");

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                "Erreur serveur",

            error: error.message

        });

    } finally {

        // ==================================================
        // LIBERATION CONNEXION
        // ==================================================

        client.release();
    }
});

// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = router;