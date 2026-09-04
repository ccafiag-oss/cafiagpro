const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/* =========================================
   AFFICHER LES DONNÉES
========================================= */
router.get('/agro_gestion_campagne', async (req, res) => {
    try {
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est requis'
            });
        }

        const query = `
            SELECT gc.*, c.designation AS designation_campagne
            FROM agro_gestion_campagne gc
            LEFT JOIN agro_campagne c ON gc.idcampagne = c.idcampagne
            WHERE gc.idagence = $1
            ORDER BY gc.idgestioncampagne DESC;
        `;

        const result = await pool.query(query, [idagence]);

        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/* =========================================
   ENREGISTRER UNE CAMPAGNE
========================================= */
router.post('/agro_gestion_campagne', async (req, res) => {
    try {
        const {
            codegestioncampagne,
            idcampagne,
            idcooperative,
            idfourn,
            iduser,
            idagence,
            description,
            activite,
            activitedetail,
            superficie_hectare,
            qtesemence_kg,
            budgetsemence,
            budgetglobal,
            idmois,
            idannee,
            datecloture,
            etat,
            recetteestime_kg,       // Ajout
            recetteestime_valeur    // Ajout
        } = req.body;

        if (!codegestioncampagne || !idcampagne || !idcooperative) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants'
            });
        }

        // Récupération de l'idarticle depuis agro_campagne selon l'idcampagne
        const campagneRes = await pool.query(
            'SELECT idarticle FROM agro_campagne WHERE idcampagne = $1',
            [idcampagne]
        );
        const idarticle = campagneRes.rows.length > 0 ? campagneRes.rows[0].idarticle : null;

        const query = `
            INSERT INTO agro_gestion_campagne (
                codegestioncampagne, idcampagne, idcooperative, idfourn, iduser, idagence,
                description, idarticle, activite, activitedetail,
                superficie_hectare, qtesemence_kg, budgetsemence, budgetglobal,
                idmois, idannee, datecloture, etat,
                recetteestime_kg, recetteestime_valeur
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,
                $7,$8,$9,$10,
                $11,$12,$13,$14,
                $15,$16,$17,$18,
                $19,$20
            )
            RETURNING *;
        `;

        const values = [
            codegestioncampagne, idcampagne, idcooperative, idfourn, iduser, idagence,
            description, idarticle, activite, activitedetail,
            superficie_hectare, qtesemence_kg, budgetsemence ?? 0, budgetglobal ?? 0,
            idmois, idannee, datecloture, etat ?? true,
            recetteestime_kg ?? 0, recetteestime_valeur ?? 0
        ];

        const result = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: 'Campagne ajoutée avec succès',
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: 'Ce code gestion campagne existe déjà'
            });
        }

        res.status(500).json({ success: false, message: error.message });
    }
});

/* =========================================
   RÉCUPÉRER UNE CAMPAGNE PAR ID
========================================= */
router.get('/agro_gestion_campagne/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est requis'
            });
        }

        const query = `
            SELECT gc.*, c.designation AS designation_campagne
            FROM agro_gestion_campagne gc
            LEFT JOIN agro_campagne c ON gc.idcampagne = c.idcampagne
            WHERE gc.idgestioncampagne = $1
              AND gc.idagence = $2;
        `;

        const result = await pool.query(query, [id, idagence]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campagne non trouvée pour cette agence'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/* =========================================
   MODIFIER UNE CAMPAGNE
========================================= */
router.put('/agro_gestion_campagne/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const {
            description,
            activite,
            activitedetail,
            superficie_hectare,
            qtesemence_kg,
            budgetsemence,
            budgetglobal,
            datecloture,
            etat,
            recetteestime_kg,       // Ajout
            recetteestime_valeur    // Ajout
        } = req.body;

        const query = `
            UPDATE agro_gestion_campagne
            SET description = $1,
                activite = $2,
                activitedetail = $3,
                idarticle = COALESCE(idarticle, (SELECT idarticle FROM agro_campagne WHERE idcampagne = agro_gestion_campagne.idcampagne)),
                superficie_hectare = $4,
                qtesemence_kg = $5,
                budgetsemence = $6,
                budgetglobal = $7,
                datecloture = $8,
                etat = $9,
                recetteestime_kg = $10,
                recetteestime_valeur = $11,
                datemodification = CURRENT_TIMESTAMP
            WHERE idgestioncampagne = $12
            RETURNING *;
        `;

        const values = [
            description, activite, activitedetail,
            superficie_hectare, qtesemence_kg,
            budgetsemence, budgetglobal,
            datecloture, etat,
            recetteestime_kg ?? 0, recetteestime_valeur ?? 0,
            id
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campagne non trouvée'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Campagne mise à jour avec succès',
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});




/* =========================================
   RAPPORT DES CAMPAGNES GROUPÉ PAR COOPÉRATIVE
========================================= */
router.get('/agro_rapport_campagne', async (req, res) => {
    try {
        const { idagence, idcampagne } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est requis'
            });
        }

        let query = `
            SELECT 
                gc.*,
                c.designation AS designation_campagne,
                coop.raisonsociale AS cooperative_nom,
                coop.codecooperative AS cooperative_code,
                f.nomcomplet AS membre_nom,
                f.codefournisseurs AS membre_code,
                f.telephone AS membre_telephone
            FROM agro_gestion_campagne gc
            LEFT JOIN agro_campagne c ON gc.idcampagne = c.idcampagne
            LEFT JOIN fina_cooperative coop ON gc.idcooperative = coop.idcooperative
            LEFT JOIN gfournisseur f ON gc.idfourn = f.idfourn
            WHERE gc.idagence = $1
        `;

        const queryParams = [idagence];

        // Si idcampagne est fourni et différent de "all" ou vide, on filtre
        if (idcampagne && idcampagne !== 'all') {
            queryParams.push(idcampagne);
            query += ` AND gc.idcampagne = $2`;
        }

        query += ` ORDER BY coop.raisonsociale ASC, f.nomcomplet ASC;`;

        const result = await pool.query(query, queryParams);

        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});



module.exports = router;



/*

const express = require('express');
const router = express.Router();
const pool = require('../config/db');


  /// AFFICHER LES DONNÉES

router.get('/agro_gestion_campagne', async (req, res) => {
    try {
        const { idagence } = req.query;

        // ================================
        // VALIDATION : idagence obligatoire
        // ================================
        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est requis'
            });
        }

        const query = `
            SELECT * 
            FROM agro_gestion_campagne
            WHERE idagence = $1
            ORDER BY idgestioncampagne DESC;
        `;

        const result = await pool.query(query, [idagence]);

        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});


  /// ENREGISTRER UNE CAMPAGNE

router.post('/agro_gestion_campagne', async (req, res) => {
    try {
        const {
            codegestioncampagne,
            idcampagne,
            idcooperative,
            idfourn,
            iduser,
            idagence,
            description,
            idarticle,
            activite,
            activitedetail,
            superficie_hectare,
            qtesemence_kg,
            budgetsemence,
            budgetglobal,
            idmois,
            idannee,
            datecloture,
            etat
        } = req.body;

        // Validation minimale
        if (!codegestioncampagne || !idcampagne || !idcooperative) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants'
            });
        }

        const query = `
            INSERT INTO agro_gestion_campagne (
                codegestioncampagne, idcampagne, idcooperative, idfourn, iduser, idagence,
                description, idarticle, activite, activitedetail,
                superficie_hectare, qtesemence_kg, budgetsemence, budgetglobal,
                idmois, idannee, datecloture, etat
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,
                $7,$8,$9,$10,
                $11,$12,$13,$14,
                $15,$16,$17,$18
            )
            RETURNING *;
        `;

        const values = [
            codegestioncampagne, idcampagne, idcooperative, idfourn, iduser, idagence,
            description, idarticle, activite, activitedetail,
            superficie_hectare, qtesemence_kg, budgetsemence ?? 0, budgetglobal ?? 0,
            idmois, idannee, datecloture, etat ?? true
        ];

        const result = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: 'Campagne ajoutée avec succès',
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: 'Ce code gestion campagne existe déjà'
            });
        }

        res.status(500).json({ success: false, message: error.message });
    }
});




   RÉCUPÉRER UNE CAMPAGNE PAR ID

router.get('/agro_gestion_campagne/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { idagence } = req.query;

        // ================================
        // VALIDATION : idagence obligatoire
        // ================================
        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est requis'
            });
        }

        const query = `
            SELECT * 
            FROM agro_gestion_campagne
            WHERE idgestioncampagne = $1
              AND idagence = $2;
        `;

        const result = await pool.query(query, [id, idagence]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campagne non trouvée pour cette agence'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});



   MODIFIER UNE CAMPAGNE

router.put('/agro_gestion_campagne/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const {
    description,
    activite,
    activitedetail,
    idarticle,          // ⬅️ à ajouter
    superficie_hectare,
    qtesemence_kg,
    budgetsemence,
    budgetglobal,
    datecloture,
    etat
} = req.body;

const query = `
    UPDATE agro_gestion_campagne
    SET description = $1,
        activite = $2,
        activitedetail = $3,
        idarticle = $4,                 -- ⬅️ à ajouter
        superficie_hectare = $5,
        qtesemence_kg = $6,
        budgetsemence = $7,
        budgetglobal = $8,
        datecloture = $9,
        etat = $10,
        datemodification = CURRENT_TIMESTAMP
    WHERE idgestioncampagne = $11
    RETURNING *;
`;

const values = [
    description, activite, activitedetail, idarticle,
    superficie_hectare, qtesemence_kg,
    budgetsemence, budgetglobal,
    datecloture, etat, id
];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campagne non trouvée'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Campagne mise à jour avec succès',
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
*/