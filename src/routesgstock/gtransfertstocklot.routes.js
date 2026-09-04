const express = require('express');
const router = express.Router();

const pool = require('../config/db');

// ======================================================
// INSERT TRANSFERT STOCK + MOUVEMENT STOCK
// ======================================================

router.post('/transfertstocklot', async (req, res) => {

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
            codetransfertstock,
            idlot

        } = req.body;





        // ==========================================
    // 0. VÉRIFICATION DE L'INVENTAIRE EN COURS PAR AGENCE
    // ==========================================
    const checkInventaire = await client.query(
      `SELECT * FROM g_fiche_inventaire WHERE etat = 'true' AND idagence = $1 LIMIT 1`,
      [idagence_emetteur]
    );

    if (checkInventaire.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        code: 'INVENTAIRE_EN_COURS',
        message: 'Veuillez patienter, inventaire en cours.'
      });
    }
    // ==========================================

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
            idlot == null ||

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
    INSERT INTO g_transfert_stocklot (
        idagence_emetteur,
        iddepot_emetteur,
        idarticle_emetteur,
        idlot,
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
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        NOW(), 1,
        $12,$13,$14,$15
    )
    RETURNING *
`;

const values = [
    Number(idagence_emetteur),
    Number(iddepot_emetteur),
    Number(idarticle_emetteur),
    Number(idlot),
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
            idlot,
            quantite_envoye
        ]);

        await client.query(

            `SELECT public.sortie_stock($1,$2,$3,$4,$5,$6)`,

            [
                Number(idagence_emetteur),
                Number(iddepot_emetteur),
                Number(idarticle_emetteur),
                Number(quantite_envoye),
                codetransfertstock,
                Number(idlot)

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
            idlot,
            quantite_recue,
            prixachat
        ]);

        await client.query(

            `SELECT public.entree_stock($1,$2,$3,$4,$5,$6,$7)`,

            [
                Number(idagence_destinataire),
                Number(iddepot_destinataire),
                Number(idarticle_destinataire),
                Number(quantite_recue),
                Number(prixachat),
                codetransfertstock,
                 Number(idlot)
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



///   RAPPORT





router.get('/rapport-transfertslot/:idagence', async (req, res) => {
    const { idagence } = req.params;
    const flux = req.query.flux || 'emetteur'; // 'emetteur' ou 'destinataire'
    
    // S'adapte au paramètre envoyé par Flutter (document_filter ou type_doc)
    const typeDoc = req.query.document_filter || req.query.type_doc || 'TRAGENCE'; 
    
    // Récupération des dates (avec valeurs par défaut si vides)
    const dateDebut = req.query.datedebut || '2000-01-01';
    const dateFin = req.query.datefin || new Date().toISOString().split('T')[0]; // Date du jour (YYYY-MM-DD)

    if (!idagence) {
        return res.status(400).json({
            success: false,
            message: "L'identifiant de l'agence (idagence) est requis."
        });
    }

    let sqlQuery = '';

    // Sélection de la requête selon le besoin du rapport
    if (flux === 'destinataire') {
        // 1. Flux ENTRANT : Tout ce qui concerne l'agence destinataire
        sqlQuery = `
            SELECT 
                trs.idtransfertstock, 
                trs.idagence_emetteur, 
                trs.iddepot_emetteur, 
                trs.idarticle_emetteur, 
                trs.idagence_destinataire, 
                trs.iddepot_destinataire, 
                trs.idarticle_destinataire, 
                trs.iduser, 
                trs.quantite, 
                trs.type_mouvement, 
                trs.datesaisie, 
                trs.datevalidation, 
                trs.etat,
                trs.observation, 
                trs.quantite_envoye, 
                trs.quantite_recue, 
                trs.documents,
                ga.designation AS designation_article,
                gd.designation AS designation_depot,
                ag.nomagence AS nom_agence
            FROM g_transfert_stocklot trs
            JOIN agence ag ON trs.idagence_destinataire = ag.idagence
            JOIN gdepot gd ON trs.iddepot_destinataire = gd.iddepot
            JOIN garticle ga ON trs.idarticle_destinataire = ga.idarticle
           
           
           WHERE trs.idagence_destinataire = $1 
  AND trs.documents = $2 
  AND trs.datesaisie >= $3
  AND trs.datesaisie < ($4::date + INTERVAL '1 day')
ORDER BY trs.datesaisie DESC;
           
           

        `;
    } else {
        // 2. Flux SORTANT (Défaut) : Tout ce qui concerne l'agence émettrice
        sqlQuery = `
            SELECT 
                trs.idtransfertstock, 
                trs.idagence_emetteur, 
                trs.iddepot_emetteur, 
                trs.idarticle_emetteur, 
                trs.idagence_destinataire, 
                trs.iddepot_destinataire, 
                trs.idarticle_destinataire, 
                trs.iduser, 
                trs.quantite, 
                trs.type_mouvement, 
                trs.datesaisie, 
                trs.datevalidation, 
                trs.etat,
                trs.observation, 
                trs.quantite_envoye, 
                trs.quantite_recue, 
                trs.documents,
                ga.designation AS designation_article,
                gd.designation AS designation_depot,
                ag.nomagence AS nom_agence
            FROM g_transfert_stocklot trs
            JOIN agence ag ON trs.idagence_emetteur = ag.idagence
            JOIN gdepot gd ON trs.iddepot_emetteur = gd.iddepot
            JOIN garticle ga ON trs.idarticle_emetteur = ga.idarticle
           
           
            WHERE trs.idagence_emetteur = $1 
  AND trs.documents = $2 
  AND trs.datesaisie >= $3
  AND trs.datesaisie < ($4::date + INTERVAL '1 day')
ORDER BY trs.datesaisie DESC;
           
        
        `;
    }

    try {
        // CORRECTION ICI : Ajout de dateDebut ($3) et dateFin ($4) dans le tableau des paramètres
        const { rows, rowCount } = await pool.query(sqlQuery, [idagence, typeDoc, dateDebut, dateFin]);

        return res.status(200).json({
            success: true,
            flux: flux,
            document_filter: typeDoc,
            count: rowCount,
            data: rows
        });

    } catch (error) {
        console.error(`❌ ERREUR RAPPORT TRANSFERT (${flux.toUpperCase()}) =>`, error);
        return res.status(500).json({
            success: false,
            message: "Une erreur interne est survenue lors de la génération du rapport."
        });
    }
});


















// ======================================================
// EXPORT ROUTER
// ======================================================


///  PREPARATION TRANSFERT STOCK


// ======================================================
// INSERT TRANSFERT STOCK EN PREPARATION
// ======================================================



// 1. Enregistrement ou modification en bloc (Bulk) avec distinction des Qtes
router.post('/transfertstocklot_preparation/bulk', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            codetransfertstock,
            idagence_emetteur,
            iddepot_emetteur,
            idagence_destinataire,
            iddepot_destinataire,
            iduser,
            items // [{ idarticle, idlot, quantite, quantite_envoye, quantite_recue, prixachat, observation }]
        } = req.body;

        if (!codetransfertstock) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Code de transfert manquant." });
        }

        if (!items || items.length === 0) {
            await client.query(
                `DELETE FROM g_transfert_stocklot_preparation WHERE codetransfertstock = $1`,
                [codetransfertstock]
            );
            await client.query('COMMIT');
            return res.status(200).json({ 
                success: true, 
                message: "La préparation de transfert a été nettoyée." 
            });
        }

        if (!idagence_emetteur || !iddepot_emetteur || !iddepot_destinataire || !iduser) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Données de transfert incomplètes." });
        }

        await client.query(
            `DELETE FROM g_transfert_stocklot_preparation WHERE codetransfertstock = $1`,
            [codetransfertstock]
        );

        const insertQuery = `
            INSERT INTO g_transfert_stocklot_preparation (
                idagence_emetteur, iddepot_emetteur, idarticle_emetteur, idlot,
                idagence_destinataire, iddepot_destinataire, idarticle_destinataire,
                iduser, quantite, type_mouvement, observation, datevalidation, etat,
                quantite_envoye, quantite_recue, documents, codetransfertstock
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, 1, $12, $13, $14, $15)
        `;

        for (const item of items) {
            const qte = Number(item.quantite);
            if (isNaN(qte) || qte < 0) continue;

            // Utiliser les valeurs explicites si fournies, sinon la quantité principale
            const qteEnvoye = item.quantite_envoye !== undefined ? Number(item.quantite_envoye) : qte;
            const qteRecue = item.quantite_recue !== undefined ? Number(item.quantite_recue) : qte;

            await client.query(insertQuery, [
                Number(idagence_emetteur),
                Number(iddepot_emetteur),
                Number(item.idarticle),
                Number(item.idlot),
                Number(idagence_destinataire),
                Number(iddepot_destinataire),
                Number(item.idarticle),
                Number(iduser),
                qte,
                'TRANSFERT',
                item.observation || "Préparation transfert",
                qteEnvoye, 
                qteRecue,  
                'TRDEPOT',
                codetransfertstock
            ]);
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Enregistrement automatique effectué." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur Bulk Transfert:", error);
        res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
    } finally {
        client.release();
    }
});

// 2. Route GET de récupération des préparations avec jointures pour les noms et lots réels
// 2. Route GET pour récupérer les préparations non validées (recherche par dates au format DD/MM/YYYY)
router.get('/transfertstocklot_preparation', async (req, res) => {
    try {
        const { startDate, endDate, idagence } = req.query;
        let query = `
            SELECT 
                p.codetransfertstock,
                p.idagence_emetteur,
                p.iddepot_emetteur,
                p.idagence_destinataire,
                p.iddepot_destinataire,
                p.iduser,
                p.datevalidation,
                p.observation,
                json_agg(json_build_object(
                    'idarticle', p.idarticle_emetteur,
                    'idlot', p.idlot,
                    'quantite', p.quantite,
                    'quantite_envoye', p.quantite_envoye,
                    'quantite_recue', p.quantite_recue,
                    'observation', p.observation
                )) as items
            FROM g_transfert_stocklot_preparation p
            WHERE p.datevalidation IS NULL
        `;
        const params = [];
        let paramIndex = 1;

        if (idagence) {
            query += ` AND p.idagence_emetteur = $${paramIndex}`;
            params.push(Number(idagence));
            paramIndex++;
        }

        if (startDate && endDate) {
            // Conversion sécurisée des dates reçues au format DD/MM/YYYY vers le type DATE de PostgreSQL
            query += ` AND p.datesaisie::date BETWEEN to_date($${paramIndex}, 'DD/MM/YYYY') AND to_date($${paramIndex + 1}, 'DD/MM/YYYY')`;
            params.push(startDate, endDate);
            paramIndex += 2;
        } else {
            // Par défaut : données du jour
            query += ` AND p.datesaisie::date = CURRENT_DATE`;
        }

        query += `
            GROUP BY 
                p.codetransfertstock, p.idagence_emetteur, p.iddepot_emetteur, 
                p.idagence_destinataire, p.iddepot_destinataire, p.iduser, 
                p.datevalidation, p.observation
            ORDER BY p.codetransfertstock DESC
        `;

        const result = await pool.query(query, params);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Erreur Fetch Preparations:", error);
        res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
    }
});




// ==========================================
// RAPPORT DES TRANSFERTS DE STOCK ENTRE DEUX DATES
// ==========================================
router.get('/rapporttransfertstock', async (req, res) => {
    try {
        const { idagence, dateDebut, dateFin, iddepot_emetteur } = req.query;

        let query = `
            SELECT 
                t.*,
                art_em.designation AS article_emetteur_nom,
                art_dest.designation AS article_destinataire_nom,
                dep_em.designation AS depot_emetteur_nom,
                dep_dest.designation AS depot_destinataire_nom,
                CASE 
                    WHEN t.datevalidation IS NULL THEN 'ENCOURS'
                    ELSE 'VALIDE'
                END AS statut_transfert
            FROM public.g_transfert_stocklot_preparation t
            LEFT JOIN public.garticle art_em ON art_em.idarticle = t.idarticle_emetteur
            LEFT JOIN public.garticle art_dest ON art_dest.idarticle = t.idarticle_destinataire
            LEFT JOIN public.gdepot dep_em ON dep_em.iddepot = t.iddepot_emetteur
            LEFT JOIN public.gdepot dep_dest ON dep_dest.iddepot = t.iddepot_destinataire
            WHERE (t.idagence_emetteur = $1 OR t.idagence_destinataire = $1)
            AND t.datesaisie::date BETWEEN $2 AND $3
        `;

        const values = [idagence, dateDebut, dateFin];

        if (iddepot_emetteur && iddepot_emetteur !== 'all') {
            values.push(iddepot_emetteur);
            query += ` AND t.iddepot_emetteur = $${values.length}`;
        }

        query += ` ORDER BY 
            CASE WHEN t.datevalidation IS NULL THEN 0 ELSE 1 END ASC, 
            dep_em.designation ASC, 
            t.datesaisie DESC`;

        const result = await pool.query(query, values);

        res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});



router.get('/rapporttransfertstockvalider', async (req, res) => {
    try {
        const { idagence, dateDebut, dateFin, iddepot_emetteur } = req.query;

        let query = `
            SELECT 
                t.*,
                art_em.designation AS article_emetteur_nom,
                art_dest.designation AS article_destinataire_nom,
                dep_em.designation AS depot_emetteur_nom,
                dep_dest.designation AS depot_destinataire_nom,
                CASE 
                    WHEN t.datevalidation IS NULL THEN 'ENCOURS'
                    ELSE 'VALIDE'
                END AS statut_transfert
            FROM public.g_transfert_stocklot t
            LEFT JOIN public.garticle art_em ON art_em.idarticle = t.idarticle_emetteur
            LEFT JOIN public.garticle art_dest ON art_dest.idarticle = t.idarticle_destinataire
            LEFT JOIN public.gdepot dep_em ON dep_em.iddepot = t.iddepot_emetteur
            LEFT JOIN public.gdepot dep_dest ON dep_dest.iddepot = t.iddepot_destinataire
            WHERE (t.idagence_emetteur = $1 OR t.idagence_destinataire = $1)
            AND t.datesaisie::date BETWEEN $2 AND $3
        `;

        const values = [idagence, dateDebut, dateFin];

        if (iddepot_emetteur && iddepot_emetteur !== 'all') {
            values.push(iddepot_emetteur);
            query += ` AND t.iddepot_emetteur = $${values.length}`;
        }

        query += ` ORDER BY 
            CASE WHEN t.datevalidation IS NULL THEN 0 ELSE 1 END ASC, 
            dep_em.designation ASC, 
            t.datesaisie DESC`;

        const result = await pool.query(query, values);

        res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
// 1. ENREGISTRER OU MODIFIER UNE PREPARATION DE TRANSFERT (BULK ET SUPPRESSION AUTOMATIQUE SI VIDE)



// 1. Route d'enregistrement ou de modification en bloc (Bulk)


/*
router.post('/transfertstocklot_preparation/bulk', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            codetransfertstock,
            idagence_emetteur,
            iddepot_emetteur,
            idagence_destinataire,
            iddepot_destinataire,
            iduser,
            items // Tableau: [{ idarticle, idlot, quantite, prixachat, observation }]
        } = req.body;

        if (!codetransfertstock) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Code de transfert manquant." });
        }

        // Si le tableau d'items est vide, on supprime la préparation en cours
        if (!items || items.length === 0) {
            await client.query(
                `DELETE FROM g_transfert_stocklot_preparation WHERE codetransfertstock = $1`,
                [codetransfertstock]
            );
            await client.query('COMMIT');
            return res.status(200).json({ 
                success: true, 
                message: "La préparation de transfert a été nettoyée avec succès." 
            });
        }

        if (!idagence_emetteur || !iddepot_emetteur || !iddepot_destinataire || !iduser) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Données de transfert incomplètes." });
        }

        // Nettoyage des anciennes lignes avant réécriture (Modif)
        await client.query(
            `DELETE FROM g_transfert_stocklot_preparation WHERE codetransfertstock = $1`,
            [codetransfertstock]
        );

        const insertQuery = `
            INSERT INTO g_transfert_stocklot_preparation (
                idagence_emetteur, iddepot_emetteur, idarticle_emetteur, idlot,
                idagence_destinataire, iddepot_destinataire, idarticle_destinataire,
                iduser, quantite, type_mouvement, observation, datevalidation, etat,
                quantite_envoye, quantite_recue, documents, codetransfertstock
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, 1, $12, $13, $14, $15)
        `;

        for (const item of items) {
            const qte = Number(item.quantite);
            if (isNaN(qte) || qte < 0) continue;

            await client.query(insertQuery, [
                Number(idagence_emetteur),
                Number(iddepot_emetteur),
                Number(item.idarticle),
                Number(item.idlot),
                Number(idagence_destinataire),
                Number(iddepot_destinataire),
                Number(item.idarticle),
                Number(iduser),
                qte,
                'TRANSFERT',
                item.observation || "Préparation transfert",
                qte,
                0,
                'TRDEPOT',
                codetransfertstock
            ]);
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Préparation de transfert enregistrée avec succès." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur Bulk Transfert:", error);
        res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
    } finally {
        client.release();
    }
});

// 2. Route GET pour récupérer les préparations non validées (recherche par dates)


// 2. Route GET pour récupérer les préparations non validées (recherche par dates au format DD/MM/YYYY)
router.get('/transfertstocklot_preparation', async (req, res) => {
    try {
        const { startDate, endDate, idagence } = req.query;
        let query = `
            SELECT 
                p.codetransfertstock,
                p.idagence_emetteur,
                p.iddepot_emetteur,
                p.idagence_destinataire,
                p.iddepot_destinataire,
                p.iduser,
                p.datevalidation,
                p.observation,
                json_agg(json_build_object(
                    'idarticle', p.idarticle_emetteur,
                    'idlot', p.idlot,
                    'quantite', p.quantite,
                    'observation', p.observation
                )) as items
            FROM g_transfert_stocklot_preparation p
            WHERE p.datevalidation IS NULL
        `;
        const params = [];
        let paramIndex = 1;

        if (idagence) {
            query += ` AND p.idagence_emetteur = $${paramIndex}`;
            params.push(Number(idagence));
            paramIndex++;
        }

        if (startDate && endDate) {
            // Conversion sécurisée des dates reçues au format DD/MM/YYYY vers le type DATE de PostgreSQL
            query += ` AND p.datesaisie::date BETWEEN to_date($${paramIndex}, 'DD/MM/YYYY') AND to_date($${paramIndex + 1}, 'DD/MM/YYYY')`;
            params.push(startDate, endDate);
            paramIndex += 2;
        } else {
            // Par défaut : données du jour
            query += ` AND p.datesaisie::date = CURRENT_DATE`;
        }

        query += `
            GROUP BY 
                p.codetransfertstock, p.idagence_emetteur, p.iddepot_emetteur, 
                p.idagence_destinataire, p.iddepot_destinataire, p.iduser, 
                p.datevalidation, p.observation
            ORDER BY p.codetransfertstock DESC
        `;

        const result = await pool.query(query, params);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Erreur Fetch Preparations:", error);
        res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
    }
});

*/





module.exports = router;