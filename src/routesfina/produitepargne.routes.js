const express = require('express');
const router = express.Router();
const pool = require('../config/db');


// ========================================
// LISTE COMPLETE + RECHERCHE DYNAMIQUE
// ========================================
router.get('/', async (req, res) => {
    try {
        const idagence = req.query.idagence;
        const search = req.query.search?.trim();

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: "Le paramètre idagence est obligatoire"
            });
        }

        let sql = `
            SELECT
                p.*,
                a.codeagence
            FROM fina_produitepargne p
            INNER JOIN agence a
                ON a.idagence = p.idagence
            WHERE p.idagence = $1
        `;

        let params = [idagence];

        if (search && search.length > 0) {
            sql += ` AND p.designation ILIKE $2 `;
            params.push(`%${search}%`);
        }

        sql += ` ORDER BY p.idprod DESC `;

        const result = await pool.query(sql, params);

        res.json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ========================================
// DETAIL PAR ID
// ========================================
router.get('/:id', async (req, res) => {
    try {
        const sql = `
            SELECT *
            FROM fina_produitepargne
            WHERE idprod = $1
        `;

        const result = await pool.query(sql, [req.params.id]);

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ========================================
// ENREGISTRER (AVEC NOUVEAUX CHAMPS)
// ========================================
router.post('/', async (req, res) => {
    try {
        const {
            idagence,
            designation,
            comptegeneral,
            frais_ouverture,
            frais_adhesion,
            frais_tenu_compte,
            nombre_part_social_minimum,
            frais_part_social,
            compte_frais_ouverture,
            compte_frais_adhesion,
            compte_part_social,
            compte_commission,
            compte_frais_tenu_compte,
            compte_interet_crediteur,
            compte_interet_debiteur,
            compte_achat_carnet,
            compte_vente_carnet,
            codetypescomptes,

            // nouveaux champs
            taux_interet_min,
            taux_interet_max,
            duree_min,
            duree_max,
            codemodecalcule,
            compteinteret,
            comptepenalite,
            comptecreditdeclasse

        } = req.body;

        const sql = `
            INSERT INTO fina_produitepargne (
                idagence,
                designation,
                comptegeneral,
                frais_ouverture,
                frais_adhesion,
                frais_tenu_compte,
                nombre_part_social_minimum,
                frais_part_social,
                compte_frais_ouverture,
                compte_frais_adhesion,
                compte_part_social,
                compte_commission,
                compte_frais_tenu_compte,
                compte_interet_crediteur,
                compte_interet_debiteur,
                compte_achat_carnet,
                compte_vente_carnet,
                codetypescomptes,

                taux_interet_min,
                taux_interet_max,
                duree_min,
                duree_max,
                codemodecalcule,
                compteinteret,
                comptepenalite,
                comptecreditdeclasse
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,
                $9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
                $19,$20,$21,$22,$23,$24,$25,$26
            )
            RETURNING *
        `;

        const result = await pool.query(sql, [
            idagence,
            designation,
            comptegeneral,
            frais_ouverture,
            frais_adhesion,
            frais_tenu_compte,
            nombre_part_social_minimum,
            frais_part_social,
            compte_frais_ouverture,
            compte_frais_adhesion,
            compte_part_social,
            compte_commission,
            compte_frais_tenu_compte,
            compte_interet_crediteur,
            compte_interet_debiteur,
            compte_achat_carnet,
            compte_vente_carnet,
            codetypescomptes,

            taux_interet_min || 0,
            taux_interet_max || 0,
            duree_min || 0,
            duree_max || 0,
            codemodecalcule || null,
            compteinteret || null,
            comptepenalite || null,
            comptecreditdeclasse || null
        ]);

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ========================================
// MODIFIER (AVEC NOUVEAUX CHAMPS)
// ========================================
router.put('/:id', async (req, res) => {
    try {
        const {
            designation,
            comptegeneral,
            frais_ouverture,
            frais_adhesion,
            frais_tenu_compte,
            nombre_part_social_minimum,
            frais_part_social,
            compte_frais_ouverture,
            compte_frais_adhesion,
            compte_part_social,
            compte_commission,
            compte_frais_tenu_compte,
            compte_interet_crediteur,
            compte_interet_debiteur,
            compte_achat_carnet,
            compte_vente_carnet,
            codetypescomptes,

            taux_interet_min,
            taux_interet_max,
            duree_min,
            duree_max,
            codemodecalcule,
            compteinteret,
            comptepenalite,
            comptecreditdeclasse

        } = req.body;

        const sql = `
            UPDATE fina_produitepargne
            SET
                designation=$1,
                comptegeneral=$2,
                frais_ouverture=$3,
                frais_adhesion=$4,
                frais_tenu_compte=$5,
                nombre_part_social_minimum=$6,
                frais_part_social=$7,
                compte_frais_ouverture=$8,
                compte_frais_adhesion=$9,
                compte_part_social=$10,
                compte_commission=$11,
                compte_frais_tenu_compte=$12,
                compte_interet_crediteur=$13,
                compte_interet_debiteur=$14,
                compte_achat_carnet=$15,
                compte_vente_carnet=$16,
                codetypescomptes=$17,

                taux_interet_min=$18,
                taux_interet_max=$19,
                duree_min=$20,
                duree_max=$21,
                codemodecalcule=$22,
                compteinteret=$23,
                comptepenalite=$24,
                comptecreditdeclasse=$25
            WHERE idprod=$26
            RETURNING *
        `;

        const result = await pool.query(sql, [
            designation,
            comptegeneral,
            frais_ouverture,
            frais_adhesion,
            frais_tenu_compte,
            nombre_part_social_minimum,
            frais_part_social,
            compte_frais_ouverture,
            compte_frais_adhesion,
            compte_part_social,
            compte_commission,
            compte_frais_tenu_compte,
            compte_interet_crediteur,
            compte_interet_debiteur,
            compte_achat_carnet,
            compte_vente_carnet,
            codetypescomptes,

            taux_interet_min,
            taux_interet_max,
            duree_min,
            duree_max,
            codemodecalcule,
            compteinteret,
            comptepenalite,
            comptecreditdeclasse,
            req.params.id
        ]);

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ========================================
// SUPPRIMER
// ========================================
router.delete('/:id', async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM fina_produitepargne WHERE idprod=$1',
            [req.params.id]
        );

        res.json({
            success: true,
            message: 'Suppression effectuée'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;













/*

const express = require('express');
const router = express.Router();
const pool = require('../config/db');



// ========================================
// LISTE COMPLETE + RECHERCHE DYNAMIQUE
// GET /api/produitepargne?search=
// ========================================
router.get('/', async (req, res) => {
    try {
        const idagence = req.query.idagence;
        const search = req.query.search?.trim();

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: "Le paramètre idagence est obligatoire"
            });
        }

        let sql;
        let params;

        // Si recherche dynamique
        if (search && search.length > 0) {
            sql = `
                SELECT
                    p.*,
                    a.codeagence
                FROM fina_produitepargne p
                INNER JOIN agence a
                    ON a.idagence = p.idagence
                WHERE p.idagence = $1
                  AND p.designation ILIKE $2
                ORDER BY p.idprod DESC
            `;

            params = [idagence, `%${search}%`];
        } else {
            // Sans recherche
            sql = `
                SELECT
                    p.*,
                    a.codeagence
                FROM fina_produitepargne p
                INNER JOIN agence a
                    ON a.idagence = p.idagence
                WHERE p.idagence = $1
                ORDER BY p.idprod DESC
            `;

            params = [idagence];
        }

        const result = await pool.query(sql, params);

        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error("Erreur GET produitepargne:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========================================
// DETAIL PAR ID
// GET /api/produitepargne/:id
// ========================================
router.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;

        const sql = `
            SELECT *
            FROM fina_produitepargne
            WHERE idprod = $1
        `;

        const result = await pool.query(sql, [id]);

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ========================================
// ENREGISTRER
// POST /api/produitepargne
// ========================================
router.post('/', async (req, res) => {
    try {
        const {
            idagence,
            designation,
            comptegeneral,
            frais_ouverture,
            frais_adhesion,
            frais_tenu_compte,
            nombre_part_social_minimum,
            frais_part_social,
            compte_frais_ouverture,
            compte_frais_adhesion,
            compte_part_social,
            compte_commission,
            compte_frais_tenu_compte,
            compte_interet_crediteur,
            compte_interet_debiteur,
            compte_achat_carnet,
            compte_vente_carnet,
            codetypescomptes
        } = req.body;

        const sql = `
            INSERT INTO fina_produitepargne (
                idagence,
                designation,
                comptegeneral,
                frais_ouverture,
                frais_adhesion,
                frais_tenu_compte,
                nombre_part_social_minimum,
                frais_part_social,
                compte_frais_ouverture,
                compte_frais_adhesion,
                compte_part_social,
                compte_commission,
                compte_frais_tenu_compte,
                compte_interet_crediteur,
                compte_interet_debiteur,
                compte_achat_carnet,
                compte_vente_carnet,
                codetypescomptes
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,
                $9,$10,$11,$12,$13,$14,$15,$16,$17,$18
            )
            RETURNING *
        `;

        const result = await pool.query(sql, [
            idagence,
            designation,
            comptegeneral,
            frais_ouverture,
            frais_adhesion,
            frais_tenu_compte,
            nombre_part_social_minimum,
            frais_part_social,
            compte_frais_ouverture,
            compte_frais_adhesion,
            compte_part_social,
            compte_commission,
            compte_frais_tenu_compte,
            compte_interet_crediteur,
            compte_interet_debiteur,
            compte_achat_carnet,
            compte_vente_carnet,
            codetypescomptes
        ]);

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ========================================
// MODIFIER
// PUT /api/produitepargne/:id
// ========================================
router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id;

        const {
            designation,
            comptegeneral,
            frais_ouverture,
            frais_adhesion,
            frais_tenu_compte,
            nombre_part_social_minimum,
            frais_part_social,
            compte_frais_ouverture,
            compte_frais_adhesion,
            compte_part_social,
            compte_commission,
            compte_frais_tenu_compte,
            compte_interet_crediteur,
            compte_interet_debiteur,
            compte_achat_carnet,
            compte_vente_carnet,
            codetypescomptes
        } = req.body;

        const sql = `
            UPDATE fina_produitepargne
            SET
                designation=$1,
                comptegeneral=$2,
                frais_ouverture=$3,
                frais_adhesion=$4,
                frais_tenu_compte=$5,
                nombre_part_social_minimum=$6,
                frais_part_social=$7,
                compte_frais_ouverture=$8,
                compte_frais_adhesion=$9,
                compte_part_social=$10,
                compte_commission=$11,
                compte_frais_tenu_compte=$12,
                compte_interet_crediteur=$13,
                compte_interet_debiteur=$14,
                compte_achat_carnet=$15,
                compte_vente_carnet=$16,
                codetypescomptes=$17
            WHERE idprod=$18
            RETURNING *
        `;

        const result = await pool.query(sql, [
            designation,
            comptegeneral,
            frais_ouverture,
            frais_adhesion,
            frais_tenu_compte,
            nombre_part_social_minimum,
            frais_part_social,
            compte_frais_ouverture,
            compte_frais_adhesion,
            compte_part_social,
            compte_commission,
            compte_frais_tenu_compte,
            compte_interet_crediteur,
            compte_interet_debiteur,
            compte_achat_carnet,
            compte_vente_carnet,
            codetypescomptes,
            id
        ]);

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ========================================
// SUPPRIMER
// DELETE /api/produitepargne/:id
// ========================================
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;

        await pool.query(
            'DELETE FROM fina_produitepargne WHERE idprod=$1',
            [id]
        );

        res.json({
            success: true,
            message: 'Suppression effectuée'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;

*/