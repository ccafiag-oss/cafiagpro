const express = require('express');
const router = express.Router();
const pool = require('../config/db');



/* =========================================================
   🔥 AJOUT / MISE À JOUR INVENTAIRE (UPSERT)
========================================================= */
router.post('/ajouterinventaire', async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            idficheinventaire,
            idstock,
            idarticle,
            iddepot,
            idagence,
            iduser,
            idcategorie,
            idsouscategorie,
            idsouscategoriedetail,
            idunite,
            quantite,
            stockphysique,
            prixvente,
            prixachat,
            codeficheinventaire
        } = req.body;

        // =========================
        // VALIDATION
        // =========================
        if (!idficheinventaire || !idstock || !idagence || !iduser) {
            return res.status(400).json({
                success: false,
                message: 'idficheinventaire, idstock, idagence, iduser sont obligatoires'
            });
        }

        const query = `
            INSERT INTO g_saisieinventaire (
                idficheinventaire,
                idstock,
                idarticle,
                iddepot,
                idagence,
                iduser,
                idcategorie,
                idsouscategorie,
                idsouscategoriedetail,
                idunite,
                quantite,
                stockphysique,
                prixvente,
                prixachat,
                codeficheinventaire
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)

            ON CONFLICT (idficheinventaire, idstock, idagence)
            DO UPDATE SET
                stockphysique = EXCLUDED.stockphysique,
                quantite = EXCLUDED.quantite,
                prixvente = EXCLUDED.prixvente,
                prixachat = EXCLUDED.prixachat,
                iduser = EXCLUDED.iduser,
                idcategorie = EXCLUDED.idcategorie,
                idsouscategorie = EXCLUDED.idsouscategorie,
                idsouscategoriedetail = EXCLUDED.idsouscategoriedetail,
                idunite = EXCLUDED.idunite,
                iddepot = EXCLUDED.iddepot
        `;

        const values = [
            idficheinventaire,
            idstock,
            idarticle,
            iddepot,
            idagence,
            iduser,
            idcategorie,
            idsouscategorie,
            idsouscategoriedetail,
            idunite,
            quantite,
            stockphysique,
            prixvente,
            prixachat,
            codeficheinventaire
        ];

        await client.query(query, values);





       

// 🔥 UPDATE PRIX après insertion
                  // =====================================================
// 🔥 UPDATE PRIX UNIQUEMENT POUR CET ARTICLE
// =====================================================

// prix vente
await client.query(`
    UPDATE g_saisieinventaire gs
    SET prixvente = pv.prix_vente_ttc
    FROM ttarifprixvente pv
    WHERE pv.idarticle = gs.idarticle
      AND pv.datefin IS NULL
      AND gs.idarticle = $1
      AND gs.idagence = $2
`, [idarticle, idagence]);

// prix achat
await client.query(`
    UPDATE g_saisieinventaire gs
    SET prixachat = pa.prix_achat_ttc
    FROM ttarifprixachat pa
    WHERE pa.idarticle = gs.idarticle
      AND pa.datefin IS NULL
      AND gs.idarticle = $1
      AND gs.idagence = $2
`, [idarticle, idagence]);




        return res.status(200).json({
            success: true,
            message: 'Inventaire enregistré avec succès'
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });

    } finally {
        client.release();
    }
});



/* =========================================================
   📊 LISTE INVENTAIRE PAR AGENCE + FICHE
========================================================= */




/*
router.get('/listeinventaire', async (req, res) => {

    const client = await pool.connect();

    try {

        // =========================
        // PARAMÈTRES
        // =========================
        const { idagence, iddepot, idficheinventaire } = req.query;

        // =========================
        // VALIDATION
        // =========================
        if (!idagence || !iddepot || !idficheinventaire) {
            return res.status(400).json({
                success: false,
                message: 'idagence, iddepot et idficheinventaire sont obligatoires'
            });
        }

        const query = `
            SELECT 
                gsinv.idsaisieinventaire,
                gsinv.idficheinventaire,
                gsinv.idstock,
                gsinv.idarticle,
                gsinv.iddepot,
                gsinv.idagence,
                gsinv.iduser,
                gsinv.idcategorie,
                gsinv.idsouscategorie,
                gsinv.idsouscategoriedetail,
                gsinv.idunite,
                gsinv.quantite,
                gsinv.stockphysique,

                ga.designation  AS article_designation,
                gu.designation  AS unite_designation,
                gsc.designation AS souscategorie_designation

            FROM g_saisieinventaire gsinv

            INNER JOIN garticle ga 
                ON ga.idarticle = gsinv.idarticle

            LEFT JOIN gunite gu 
                ON gu.idunite = gsinv.idunite

            LEFT JOIN gsouscategorie gsc 
                ON gsc.idsouscategorie = gsinv.idsouscategorie

            WHERE gsinv.idagence = $1
              AND gsinv.iddepot = $2
              AND gsinv.idficheinventaire = $3
        `;

        const values = [
            parseInt(idagence, 10),
            parseInt(iddepot, 10),
            parseInt(idficheinventaire, 10)
        ];

        const result = await client.query(query, values);

        // =========================
        // RESPONSE
        // =========================
        if (result.rows.length > 0) {

            return res.status(200).json({
                success: true,
                count: result.rowCount,
                data: result.rows
            });

        } else {

            return res.status(200).json({
                success: false,
                message: 'Aucune donnée trouvée',
                data: []
            });
        }

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });

    } finally {
        client.release();
    }
});
*/


router.get('/listeinventaire', async (req, res) => {

    const client = await pool.connect();

    try {

        const { idagence, iddepot, idficheinventaire } = req.query;

        if (!idagence || !iddepot || !idficheinventaire) {
            return res.status(400).json({
                success: false,
                message: 'idagence, iddepot, idficheinventaire obligatoires'
            });
        }

        const query = `
            SELECT 
                gsinv.idsaisieinventaire,
                gsinv.idficheinventaire,
                gsinv.idstock,
                gsinv.idarticle,
                gsinv.iddepot,
                gsinv.idagence,
                gsinv.iduser,
                gsinv.idcategorie,
                gsinv.idsouscategorie,
                gsinv.idsouscategoriedetail,
                gsinv.idunite,
                gsinv.quantite,
                gsinv.stockphysique,

                 gsinv.ecart,
                gsinv.prixvente,
                gsinv.prixachat,
                gsinv.valeurecart_prixvente,
                gsinv.valeurecart_prixachat,

                ga.designation AS article_designation,
                gu.designation AS unite_designation,
                gsc.designation AS souscategorie_designation

            FROM g_saisieinventaire gsinv
            INNER JOIN garticle ga ON ga.idarticle = gsinv.idarticle
            LEFT JOIN gunite gu ON gu.idunite = gsinv.idunite
            LEFT JOIN gsouscategorie gsc ON gsc.idsouscategorie = gsinv.idsouscategorie

            WHERE gsinv.idagence = $1
              AND gsinv.iddepot = $2
              AND gsinv.idficheinventaire = $3
        `;

        const result = await client.query(query, [
            parseInt(idagence),
            parseInt(iddepot),
            parseInt(idficheinventaire)
        ]);

        // calcul progression
        const total = result.rows.length;
        const done = result.rows.filter(r => parseFloat(r.stockphysique) > 0).length;

        return res.json({
            success: true,
            count: total,
            progress: total === 0 ? 0 : Math.round((done / total) * 100),
            data: result.rows
        });

    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false });
    } finally {
        client.release();
    }
});




router.post('/majstockphysique', async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            idsaisieinventaire,
            stockphysique,
            iduser
        } = req.body;

        if (!idsaisieinventaire) {
            return res.status(400).json({
                success: false,
                message: "idsaisieinventaire obligatoire"
            });
        }

        await client.query(`
            UPDATE g_saisieinventaire
            SET stockphysique = $1,
                iduser = $2
            WHERE idsaisieinventaire = $3
        `, [
            stockphysique,
            iduser,
            idsaisieinventaire
        ]);

        return res.json({
            success: true,
            message: "OK"
        });

    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false });
    } finally {
        client.release();
    }
});










/* =========================================================
   🔥 CORRECTION INVENTAIRE + ARCHIVAGE + STOCK
========================================================= */

router.post('/corrigerinventaire', async (req, res) => {

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        const {
            idficheinventaire,
            idagence,
            iddepot,
            iduser
        } = req.body;

        // =========================
        // VALIDATION
        // =========================
        if (!idficheinventaire || !idagence || !iddepot) {
            return res.status(400).json({
                success: false,
                message: "Paramètres manquants"
            });
        }

        // =====================================================
        // 1. RECUPERER INVENTAIRE
        // =====================================================
        const inventaire = await client.query(
            `
            SELECT *
            FROM g_saisieinventaire
            WHERE idficheinventaire = $1
              AND idagence = $2
              AND iddepot = $3
            `,
            [idficheinventaire, idagence, iddepot]
        );

        if (inventaire.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: "Aucun inventaire trouvé"
            });
        }

        // =====================================================
        // 2. VERIFICATION TOTAL ECART
        // =====================================================
        const totalQuery = await client.query(
            `
            SELECT COALESCE(SUM(ecart),0) AS total
            FROM g_saisieinventaire
            WHERE idficheinventaire = $1
              AND idagence = $2
              AND iddepot = $3
            `,
            [idficheinventaire, idagence, iddepot]
        );

        const totalEcart = parseFloat(totalQuery.rows[0].total);

        // =====================================================
        // 3. ARCHIVAGE
        // =====================================================
        await client.query(
            `
            INSERT INTO g_archive_saisieinventaire (
                idsaisieinventaire,
                idficheinventaire,
                idstock,
                idarticle,
                iddepot,
                idagence,
                iduser,
                idcategorie,
                idsouscategorie,
                idsouscategoriedetail,
                idunite,
                quantite,
                stockphysique,
                ecart,
                prixvente,
                prixachat,
                valeurecart_prixvente,
                valeurecart_prixachat,
                datecreation,
                codeficheinventaire
            )
            SELECT
                idsaisieinventaire,
                idficheinventaire,
                idstock,
                idarticle,
                iddepot,
                idagence,
                iduser,
                idcategorie,
                idsouscategorie,
                idsouscategoriedetail,
                idunite,
                quantite,
                stockphysique,
                ecart,
                prixvente,
                prixachat,
                valeurecart_prixvente,
                valeurecart_prixachat,
                NOW(),
                codeficheinventaire
            FROM g_saisieinventaire
            WHERE idficheinventaire = $1
              AND idagence = $2
              AND iddepot = $3
            `,
            [idficheinventaire, idagence, iddepot]
        );

        // =====================================================
        // 4. VERIFICATION ARCHIVE
        // =====================================================
        const archiveTotalQuery = await client.query(
            `
            SELECT COALESCE(SUM(ecart),0) AS total
            FROM g_archive_saisieinventaire
            WHERE idficheinventaire = $1
              AND idagence = $2
              AND iddepot = $3
            `,
            [idficheinventaire, idagence, iddepot]
        );

        const totalArchive = parseFloat(archiveTotalQuery.rows[0].total);

        if (totalArchive !== totalEcart) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                success: false,
                message: "Erreur d'archivage (écarts non conformes)"
            });
        }

        // =====================================================
        // 5. TRAITEMENT STOCK
        // =====================================================
        for (const item of inventaire.rows) {

            const ecart = parseFloat(item.ecart || 0);

            const qty = Math.abs(ecart);

            // =========================
            // ENTREE STOCK (positif)
            // =========================
            if (ecart > 0) {

                await client.query(
                    `SELECT public.entree_stock($1,$2,$3,$4,$5,$6)`,
                    [
                        idagence,
                        iddepot,
                        item.idarticle,
                        qty,
                        item.prixachat,
                        item.codeficheinventaire
                    ]
                );
            }

            // =========================
            // SORTIE STOCK (negatif)
            // =========================
            if (ecart < 0) {

                await client.query(
                    `SELECT public.sortie_stock($1,$2,$3,$4,$5)`,
                    [
                        idagence,
                        iddepot,
                        item.idarticle,
                        qty,
                        item.codeficheinventaire
                    ]
                );
            }



            await client.query(
    `
    DELETE FROM g_saisieinventaire
    WHERE idficheinventaire = $1
      AND idagence = $2
      AND iddepot = $3
    `,
    [idficheinventaire, idagence, iddepot]
);






        }



        

         





        // =====================================================
        // 6. COMMIT
        // =====================================================
        await client.query('COMMIT');

        return res.json({
            success: true,
            message: "Correction inventaire terminée avec succès",
            total_ecart: totalEcart,
            lignes: inventaire.rows.length
        });

    } catch (e) {

        await client.query('ROLLBACK');

        console.error(e);

        return res.status(500).json({
            success: false,
            message: "Erreur serveur",
            error: e.message
        });

    } finally {
        client.release();
    }
});












router.get('/listeinventairehistorique', async (req, res) => {

    const client = await pool.connect();

    try {

        const { idagence, iddepot, idficheinventaire } = req.query;

        if (!idagence || !iddepot || !idficheinventaire) {
            return res.status(400).json({
                success: false,
                message: 'idagence, iddepot, idficheinventaire obligatoires'
            });
        }

        const query = `
            SELECT 
                gsinv.idsaisieinventaire,
                gsinv.idficheinventaire,
                gsinv.idstock,
                gsinv.idarticle,
                gsinv.iddepot,
                gsinv.idagence,
                gsinv.iduser,
                gsinv.idcategorie,
                gsinv.idsouscategorie,
                gsinv.idsouscategoriedetail,
                gsinv.idunite,
                gsinv.quantite,
                gsinv.stockphysique,

                 gsinv.ecart,
                gsinv.prixvente,
                gsinv.prixachat,
                gsinv.valeurecart_prixvente,
                gsinv.valeurecart_prixachat,

                ga.designation AS article_designation,
                gu.designation AS unite_designation,
                gsc.designation AS souscategorie_designation

            FROM g_archive_saisieinventaire gsinv
            INNER JOIN garticle ga ON ga.idarticle = gsinv.idarticle
            LEFT JOIN gunite gu ON gu.idunite = gsinv.idunite
            LEFT JOIN gsouscategorie gsc ON gsc.idsouscategorie = gsinv.idsouscategorie
 

            WHERE gsinv.idagence = $1
              AND gsinv.iddepot = $2
              AND gsinv.idficheinventaire = $3
        `;

        const result = await client.query(query, [
            parseInt(idagence),
            parseInt(iddepot),
            parseInt(idficheinventaire)
        ]);

        // calcul progression
        const total = result.rows.length;
        const done = result.rows.filter(r => parseFloat(r.stockphysique) > 0).length;

        return res.json({
            success: true,
            count: total,
            progress: total === 0 ? 0 : Math.round((done / total) * 100),
            data: result.rows
        });

    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false });
    } finally {
        client.release();
    }
});





module.exports = router;