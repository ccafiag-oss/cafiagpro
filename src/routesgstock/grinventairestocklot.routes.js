const express = require('express');
const router = express.Router();
const pool = require('../config/db');



/* =========================================================
   🔥 AJOUT / MISE À JOUR INVENTAIRE (UPSERT)
========================================================= */
router.post('/ajouterinventairelot', async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            idficheinventaire,
            idlot_stock,
            idlot,
            codelot,
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
        if (!idficheinventaire || !idlot_stock || !idagence || !iduser) {
            return res.status(400).json({
                success: false,
                message: 'idficheinventaire, idlot_stock, idagence, iduser sont obligatoires'
            });
        }

        const query = `
            INSERT INTO g_saisieinventairelot (
                idficheinventaire,
                idlot_stock,
                idlot,
                codelot,
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
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)

            ON CONFLICT (idficheinventaire, idlot_stock, idagence)
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
                iddepot = EXCLUDED.iddepot,
                idlot = EXCLUDED.idlot
        `;

        const values = [
            idficheinventaire,
            idlot_stock,
            idlot,
            codelot,
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
    UPDATE g_saisieinventairelot gs
    SET prixvente = pv.prix_vente_ttc
    FROM ttarifprixvente pv
    WHERE pv.idarticle = gs.idarticle
      AND pv.datefin IS NULL
      AND gs.idarticle = $1
      AND gs.idagence = $2
`, [idarticle, idagence]);

// prix achat
await client.query(`
    UPDATE g_saisieinventairelot gs
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



router.get('/listeinventairelot', async (req, res) => {

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
                gsinv.idlot_stock,
                gsinv.idlot,
                gsinv.codelot,
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

            FROM g_saisieinventairelot gsinv
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




router.post('/majstockphysiquelot', async (req, res) => {

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
            UPDATE g_saisieinventairelot
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

/*
router.post('/corrigerinventairelot', async (req, res) => {

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
            FROM g_saisieinventairelot
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
            FROM g_saisieinventairelot
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
            INSERT INTO g_archive_saisieinventairelot (
                idsaisieinventaire,
                idficheinventaire,
                idlot_stock,
                idlot,
                codelot,
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
                idlot_stock,
                idlot,
                codelot,
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
            FROM g_saisieinventairelot
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
            FROM g_archive_saisieinventairelot
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
                    `SELECT public.entree_stock($1,$2,$3,$4,$5,$6,$7)`,
                    [
                        idagence,
                        iddepot,
                        item.idarticle,
                        qty,
                        item.prixachat,
                        item.codeficheinventaire,
                        idlot
                    ]
                );
            }

            // =========================
            // SORTIE STOCK (negatif)
            // =========================
            if (ecart < 0) {

                await client.query(
                    `SELECT public.sortie_stock($1,$2,$3,$4,$5,$6)`,
                    [
                        idagence,
                        iddepot,
                        item.idarticle,
                        qty,
                        item.codeficheinventaire,
                        idlot
                    ]
                );
            }



            await client.query(
    `
    DELETE FROM g_saisieinventairelot
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
*/


router.post('/corrigerinventairelot', async (req, res) => {
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
            FROM g_saisieinventairelot
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
            FROM g_saisieinventairelot
            WHERE idficheinventaire = $1
              AND idagence = $2
              AND iddepot = $3
            `,
            [idficheinventaire, idagence, iddepot]
        );

        const totalEcart = parseFloat(totalQuery.rows[0].total);

        // =====================================================
        // 3. ARCHIVAGE (éviter doublons avec idsaisieinventaire)
        // =====================================================
        await client.query(
            `
            INSERT INTO g_archive_saisieinventairelot (
                idsaisieinventaire,
                idficheinventaire,
                idlot_stock,
                idlot,
                codelot,
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
                s.idsaisieinventaire,
                s.idficheinventaire,
                s.idlot_stock,
                s.idlot,
                s.codelot,
                s.idarticle,
                s.iddepot,
                s.idagence,
                s.iduser,
                s.idcategorie,
                s.idsouscategorie,
                s.idsouscategoriedetail,
                s.idunite,
                s.quantite,
                s.stockphysique,
                s.ecart,
                s.prixvente,
                s.prixachat,
                s.valeurecart_prixvente,
                s.valeurecart_prixachat,
                NOW(),
                s.codeficheinventaire
            FROM g_saisieinventairelot s
            WHERE s.idficheinventaire = $1
              AND s.idagence = $2
              AND s.iddepot = $3
              AND NOT EXISTS (
                  SELECT 1
                  FROM g_archive_saisieinventairelot a
                  WHERE a.idsaisieinventaire = s.idsaisieinventaire
              )
            `,
            [idficheinventaire, idagence, iddepot]
        );

        // =====================================================
        // 4. VERIFICATION ARCHIVE
        // =====================================================
        const archiveTotalQuery = await client.query(
            `
            SELECT COALESCE(SUM(ecart),0) AS total
            FROM g_archive_saisieinventairelot
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
        // 5. TRAITEMENT STOCK PAR LOT
        // =====================================================
        for (const item of inventaire.rows) {
            const ecart = parseFloat(item.ecart || 0);
            const qty = Math.abs(ecart);

            if (ecart > 0) {
                await client.query(
                    `SELECT public.entree_stock($1,$2,$3,$4,$5,$6,$7)`,
                    [
                        idagence,
                        iddepot,
                        item.idarticle,
                        qty,
                        item.prixachat,
                        item.codeficheinventaire,
                        item.idlot   // chaque lot est utilisé
                    ]
                );
            }

            if (ecart < 0) {
                await client.query(
                    `SELECT public.sortie_stock($1,$2,$3,$4,$5,$6)`,
                    [
                        idagence,
                        iddepot,
                        item.idarticle,
                        qty,
                        item.codeficheinventaire,
                        item.idlot   // idem
                    ]
                );
            }
        }

        // =====================================================
        // 6. SUPPRESSION DES LIGNES
        // =====================================================
        await client.query(
            `
            DELETE FROM g_saisieinventairelot
            WHERE idficheinventaire = $1
              AND idagence = $2
              AND iddepot = $3
            `,
            [idficheinventaire, idagence, iddepot]
        );

        await client.query(
            `
           UPDATE g_fiche_inventaire SET etat='false' 
            WHERE idficheinventaire = $1
              AND idagence = $2
              
            `,
            [idficheinventaire, idagence]
        );


        // =====================================================
        // 7. COMMIT
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











router.get('/listeinventairehistoriquelot', async (req, res) => {

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
                gsinv.idlot_stock,
                gsinv.idlot,
                gsinv.codelot,
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

            FROM g_archive_saisieinventairelot gsinv
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

















/* =========================================================
   🔥 AJOUT / MISE À JOUR INVENTAIRE  STOCK INITIAL (UPSERT)
========================================================= */
router.post('/ajouterstockinitiallotlot', async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            idficheinventaire,
            idlot_stock,
            idlot,
            codelot,
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
        if (!idficheinventaire || !idlot_stock || !idagence || !iduser) {
            return res.status(400).json({
                success: false,
                message: 'idficheinventaire, idlot_stock, idagence, iduser sont obligatoires'
            });
        }

        const query = `
            INSERT INTO g_saisiestockinitiallot (
                idficheinventaire,
                idlot_stock,
                idlot,
                codelot,
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
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)

            ON CONFLICT (iddepot, idlot_stock, idagence)
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
                iddepot = EXCLUDED.iddepot,
                idlot = EXCLUDED.idlot
        `;

        const values = [
            idficheinventaire,
            idlot_stock,
            idlot,
            codelot,
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
    UPDATE g_saisiestockinitiallot gs
    SET prixvente = pv.prix_vente_ttc
    FROM ttarifprixvente pv
    WHERE pv.idarticle = gs.idarticle
      AND pv.datefin IS NULL
      AND gs.idarticle = $1
      AND gs.idagence = $2
`, [idarticle, idagence]);

// prix achat
await client.query(`
    UPDATE g_saisiestockinitiallot gs
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
   📊 LISTE INVENTAIRE STOCK INITIAL   PAR AGENCE + FICHE
========================================================= */



router.get('/listeinventairestockinitiallot', async (req, res) => {

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
                gsinv.idsaisiestockinitiallot,
                gsinv.idficheinventaire,
                gsinv.idlot_stock,
                gsinv.idlot,
                gsinv.codelot,
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
                gsinv.valeurestockphysique_prixvente,
                gsinv.valeurestockphysique_prixachat,

                ga.designation AS article_designation,
                gu.designation AS unite_designation,
                gsc.designation AS souscategorie_designation

            FROM g_saisiestockinitiallot gsinv
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




router.post('/majstockphysiqueinitiallot', async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            idsaisiestockinitiallot,
            stockphysique,
            iduser
        } = req.body;

        if (!idsaisiestockinitiallot) {
            return res.status(400).json({
                success: false,
                message: "idsaisiestockinitiallot obligatoire"
            });
        }

        await client.query(`
            UPDATE g_saisiestockinitiallot
            SET stockphysique = $1,
                iduser = $2
            WHERE idsaisiestockinitiallot = $3
        `, [
            stockphysique,
            iduser,
            idsaisiestockinitiallot
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








////     CORRIGER   STOCK


router.post('/corrigerinventairestockinitiallot', async (req, res) => {
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
            FROM g_saisiestockinitiallot
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
            SELECT COALESCE(SUM(quantite),0) AS total
            FROM g_saisiestockinitiallot
            WHERE idficheinventaire = $1
              AND idagence = $2
              AND iddepot = $3
            `,
            [idficheinventaire, idagence, iddepot]
        );

        const totalEcart = parseFloat(totalQuery.rows[0].total);

        

        // =====================================================
        // 4. VERIFICATION ARCHIVE
        // =====================================================
        const archiveTotalQuery = await client.query(
            `
            SELECT COALESCE(SUM(quantite),0) AS total
            FROM g_saisiestockinitiallot
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
        // 5. TRAITEMENT STOCK PAR LOT
        // =====================================================
        for (const item of inventaire.rows) {
            const ecart = parseFloat(item.ecart || 0);
            const qty = Math.abs(ecart);

            if (ecart > 0) {
                await client.query(
                    `SELECT public.entree_stock($1,$2,$3,$4,$5,$6,$7)`,
                    [
                        idagence,
                        iddepot,
                        item.idarticle,
                        qty,
                        item.prixachat,
                        item.codeficheinventaire,
                        item.idlot   // chaque lot est utilisé
                    ]
                );
            }

            if (ecart < 0) {
                await client.query(
                    `SELECT public.sortie_stock($1,$2,$3,$4,$5,$6)`,
                    [
                        idagence,
                        iddepot,
                        item.idarticle,
                        qty,
                        item.codeficheinventaire,
                        item.idlot   // idem
                    ]
                );
            }
        }

        // =====================================================
        // 6. SUPPRESSION DES LIGNES
        // =====================================================
       

        await client.query(
            `
           UPDATE g_fiche_inventaire SET etat='false' 
            WHERE idficheinventaire = $1
              AND idagence = $2
              
            `,
            [idficheinventaire, idagence]
        );


        // =====================================================
        // 7. COMMIT
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

















router.get('/previsionstock', async (req, res) => {
  try {
    const { idagence, iddepot, datedebut, datefin, nbjours } = req.query;

    if (!datedebut || !datefin) {
      return res.status(400).json({
        success: false,
        error: 'datedebut et datefin sont obligatoires'
      });
    }

    const nbJoursPrevision = nbjours ? parseInt(nbjours, 10) : 7;

    let query = `
      SELECT
          gvd.idagence,
          gvd.iddepot,
          gvd.idarticle,
          ga.designation,
          ga.stockmin,
          gsd.stock_disponible,

          SUM(gvd.quantite) AS qte_vendue,

          ROUND(
              SUM(gvd.quantite)::numeric /
              NULLIF(($2::date - $1::date + 1),0),
              2
          ) AS moyenne_jour,

          ROUND(
              (
                  SUM(gvd.quantite)::numeric /
                  NULLIF(($2::date - $1::date + 1),0)
              ) * $3,
              2
          ) AS besoin_prevu,

          ROUND(
              (
                  (
                      SUM(gvd.quantite)::numeric /
                      NULLIF(($2::date - $1::date + 1),0)
                  ) * $3
              ) + ga.stockmin,
              2
          ) AS besoin_total,

          GREATEST(
              ROUND(
                  (
                      (
                          SUM(gvd.quantite)::numeric /
                          NULLIF(($2::date - $1::date + 1),0)
                      ) * $3
                  ) + ga.stockmin - gsd.stock_disponible,
                  2
              ),
              0
          ) AS qte_a_commander,

          ROUND(
              gsd.stock_disponible /
              NULLIF(
                  (
                      SUM(gvd.quantite)::numeric /
                      NULLIF(($2::date - $1::date + 1),0)
                  ),
                  0
              ),
              1
          ) AS jours_de_couverture

      FROM public.gvente_detail gvd

      JOIN public.garticle ga
          ON ga.idarticle = gvd.idarticle

      JOIN public.gstock_depot gsd
          ON gsd.idagence = gvd.idagence
         AND gsd.iddepot = gvd.iddepot
         AND gsd.idarticle = gvd.idarticle

      WHERE gvd.datevente BETWEEN $1 AND $2
    `;

    const params = [datedebut, datefin, nbJoursPrevision];

    if (idagence !== undefined && idagence !== null && idagence !== '') {
      params.push(idagence);
      query += ` AND gvd.idagence = $${params.length}`;
    }

    if (iddepot !== undefined && iddepot !== null && iddepot !== '') {
      params.push(iddepot);
      query += ` AND gvd.iddepot = $${params.length}`;
    }

    query += `
      GROUP BY
          gvd.idagence,
          gvd.iddepot,
          gvd.idarticle,
          ga.designation,
          ga.stockmin,
          gsd.stock_disponible
      ORDER BY ga.designation
    `;

    const { rows } = await pool.query(query, params);

    // Ajout de l'état (couleur) calculé côté serveur
    const dataAvecEtat = rows.map(row => {
      const jours = row.jours_de_couverture === null ? null : parseFloat(row.jours_de_couverture);
      let etat = 'inconnu';
      let couleur = '⚪';

      if (jours === null) {
        etat = 'inconnu';
        couleur = '⚪';
      } else if (jours <= 7) {
        etat = 'critique';
        couleur = '🔴';
      } else if (jours <= 15) {
        etat = 'faible';
        couleur = '🟠';
      } else if (jours <= 30) {
        etat = 'moyen';
        couleur = '🟡';
      } else {
        etat = 'bon';
        couleur = '🟢';
      }

      return { ...row, etat, couleur };
    });

    res.json({
      success: true,
      data: dataAvecEtat
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération prévision de stock'
    });
  }
});






///  RAPPORT



// Obtenir l'inventaire valorisé au CUMP à une date donnée
router.get('/inventaire-valorise', async (req, res) => {
  const { idagence, iddepot, date_inventaire } = req.query;

  if (!idagence || !date_inventaire) {
    return res.status(400).json({ 
      success: false, 
      message: "Paramètres manquants (idagence, date_inventaire au format YYYY-MM-DD)" 
    });
  }

  const client = await pool.connect();
  try {
    // On cible la fin de la journée demandée pour inclure tous les mouvements de ce jour
    const dateLimit = `${date_inventaire} 23:59:59`;
    const parsedIdAgence = parseInt(idagence, 10);
    const parsedIdDepot = iddepot && iddepot !== 'null' && iddepot !== '' ? parseInt(iddepot, 10) : null;

    const query = `
      SELECT 
        ga.idarticle,
        ga.codearticle,
        ga.designation AS article_designation,
        COALESCE(gcat.designation, 'Sans Catégorie') AS categorie,
        COALESCE(gu.designation, 'Unité') AS unite,
        COALESCE(ga.cump, 0)::double precision AS cump,
        -- Calcul du stock cumulé à la date limite
        COALESCE(SUM(
          CASE 
            WHEN UPPER(m.type_mouvement) IN ('ENTREE', 'E', 'IN', 'APPROV', 'INITIAL') THEN m.quantite
            WHEN UPPER(m.type_mouvement) IN ('SORTIE', 'S', 'OUT', 'VENTE') THEN -m.quantite
            ELSE m.quantite -- Fallback
          END
        ), 0)::double precision AS quantite_stock
      FROM public.garticle ga
      LEFT JOIN public.gcategorie gcat ON gcat.idcategorie = ga.idcategorie
      LEFT JOIN public.gunite gu ON gu.idunite = ga.idunite
      LEFT JOIN public.gmouvement_stock m ON m.idarticle = ga.idarticle 
        AND m.idagence = ga.idagence
        AND m.dateoperation <= $1::timestamp
        AND ($2::bigint IS NULL OR m.iddepot = $2::bigint)
      WHERE ga.idagence = $3
        AND ga.actif = true
      GROUP BY ga.idarticle, ga.codearticle, ga.designation, gcat.designation, gu.designation, ga.cump
      HAVING COALESCE(SUM(
        CASE 
          WHEN UPPER(m.type_mouvement) IN ('ENTREE', 'E', 'IN', 'APPROV', 'INITIAL') THEN m.quantite
          WHEN UPPER(m.type_mouvement) IN ('SORTIE', 'S', 'OUT', 'VENTE') THEN -m.quantite
          ELSE m.quantite
        END
      ), 0) <> 0 -- Optionnel : Masquer les articles avec un stock à zéro
      ORDER BY categorie, ga.designation;
    `;

    const result = await pool.query(query, [dateLimit, parsedIdDepot, parsedIdAgence]);
    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Erreur lors du calcul de l'inventaire :", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});





///  MOUVEMENT STOCK




router.get('/mouvement-stock-periode', async (req, res) => {
  const { idarticle, iddepot, date_debut, date_fin } = req.query;

  if (!idarticle || !iddepot || !date_debut || !date_fin) {
    return res.status(400).json({
      success: false,
      message: 'Les paramètres idarticle, iddepot, date_debut et date_fin sont requis.'
    });
  }

  try {
    const query = `
      WITH stock_precedent AS (
          -- Calcul du stock cumulé avant la date de début
          SELECT COALESCE(SUM(
              CASE
                  WHEN LOWER(type_mouvement) = 'sortie' THEN -quantite
                  ELSE quantite
              END
          ), 0) AS stock_initial
          FROM gmouvement_stock
          WHERE idarticle = $1 
            AND iddepot = $2 
            AND dateoperation < $3::timestamp
      )
      SELECT 
          gmst.idmouvement,
          gmst.idagence,
          ag.nomagence,
          gmst.idarticle,
          ga.designation AS designation_article,
          gmst.iddepot,
          gd.designation AS designation_depot,
          gmst.idlot,
          gmst.type_mouvement,

          -- Quantité signée
          CASE
              WHEN LOWER(gmst.type_mouvement) = 'sortie' THEN -gmst.quantite
              ELSE gmst.quantite
          END AS quantite_mouvement,

          gmst.prix_unitaire,
          gmst.montant,
          gmst.dateoperation,
          gmst.reference_piece,
          gmst.observation,

          -- Identification de la SOUCHE (VENTE, ACHAT, ou AUTRE)
          CASE
              WHEN vd.iddetail IS NOT NULL THEN 'VENTE'
              WHEN ad.iddetail IS NOT NULL THEN 'ACHAT'
              ELSE 'STOCK'
          END AS souche,

          -- Récupération du Ref Opération
          COALESCE(vd.refoperation, ad.refoperation, gmst.reference_piece, '') AS refoperation,

          -- Stock Initial Reporté
          sp.stock_initial,

          -- Stock cumulé progressif (Stock Initial + cumul de la ligne)
          sp.stock_initial + SUM(
              CASE
                  WHEN LOWER(gmst.type_mouvement) = 'sortie' THEN -gmst.quantite
                  ELSE gmst.quantite
              END
          ) OVER (
              ORDER BY gmst.dateoperation, gmst.idmouvement
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS stock_cumule

      FROM gmouvement_stock gmst
      CROSS JOIN stock_precedent sp
      INNER JOIN garticle ga ON ga.idarticle = gmst.idarticle
      INNER JOIN gdepot gd ON gd.iddepot = gmst.iddepot
      INNER JOIN agence ag ON ag.idagence = gmst.idagence

      -- Jointure avec Ventes
      LEFT JOIN (
          SELECT DISTINCT ON (ref_piece, idarticle, iddepot) 
                 ref_piece, idarticle, iddepot, refoperation, iddetail
          FROM gvente_detail
      ) vd ON (vd.ref_piece = gmst.reference_piece AND vd.idarticle = gmst.idarticle AND vd.iddepot = gmst.iddepot)

      -- Jointure avec Achats
      LEFT JOIN (
          SELECT DISTINCT ON (ref_piece, idarticle, iddepot) 
                 ref_piece, idarticle, iddepot, refoperation, iddetail
          FROM gachat_detail
      ) ad ON (ad.ref_piece = gmst.reference_piece AND ad.idarticle = gmst.idarticle AND ad.iddepot = gmst.iddepot)

      WHERE gmst.idarticle = $1
        AND gmst.iddepot = $2
        AND gmst.dateoperation >= $3::timestamp
        AND gmst.dateoperation <= $4::timestamp

      ORDER BY gmst.dateoperation, gmst.idmouvement;
    `;

    // Format dates bornées
    const debut = `${date_debut} 00:00:00`;
    const fin = `${date_fin} 23:59:59`;

    // 1. Récupération du stock initial séparément (utile si aucun mouvement dans la période)
    const stockInitRes = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN LOWER(type_mouvement) = 'sortie' THEN -quantite ELSE quantite END), 0) AS stock_initial 
       FROM gmouvement_stock WHERE idarticle = $1 AND iddepot = $2 AND dateoperation < $3::timestamp`,
      [idarticle, iddepot, debut]
    );

    const stockInitial = parseFloat(stockInitRes.rows[0]?.stock_initial || 0);
    const { rows } = await pool.query(query, [idarticle, iddepot, debut, fin]);

    res.json({
      success: true,
      stock_initial: stockInitial,
      data: rows
    });

  } catch (err) {
    console.error('Erreur GET /mouvement-stock-periode:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur lors de la récupération des mouvements.' });
  }
});



module.exports = router;