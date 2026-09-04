const express = require('express');
const router = express.Router();
const pool = require('../config/db');

const multer = require('multer');
const path = require('path');
const fs = require('fs');


// ==========================================
// CONFIGURATION MULTER
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let subFolder = 'photo';

        if (
            file.fieldname === 'signature_client' ||
            file.fieldname === 'signature_agence'
        ) {
            subFolder = 'signature';
        }

        const dir = path.join(
            __dirname,
            '../uploads/finance/clients/credit',
            subFolder
        );

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        cb(null, dir);
    },

    filename: (req, file, cb) => {
        const unique =
            Date.now() + '-' + Math.floor(Math.random() * 999999);

        cb(
            null,
            `${file.fieldname}-${unique}${path.extname(file.originalname)}`
        );
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});


// ==========================================
// AJOUT CREDIT DEMANDE
// ==========================================
router.post(
    '/ajouter_credit_demande',
    upload.fields([
        { name: 'photoclient', maxCount: 1 },
        { name: 'photocarterecto', maxCount: 1 },
        { name: 'photocarteverso', maxCount: 1 },
        { name: 'signature_client', maxCount: 1 },
        { name: 'signature_agence', maxCount: 1 }
    ]),
    async (req, res) => {


         const client = await pool.connect();
         
        try {
            const {
                code_demande,
                code_decaissement,
                idclient,
                idagence,
                iduser,
                idobjet,
                montant_demande,
                montant_accorde,
                montant_rembourse,
                duree_mois,
                duree_grace,
                frequence,
                taux_interet,
                objetdetail,
                telephone,
                adresse,
                idpiece_identite,
                numero_piece_identite,
                idquartier,
                revenu_mensuel,
                garantie,
                commentaire,
                idprod,
                comptecredit
            } = req.body;

            if (
                !code_demande ||
                !idclient ||
                !idagence ||
                !iduser ||
                !idobjet ||
                !montant_demande ||
                !duree_mois ||
                !telephone||
                !idprod||
                !comptecredit
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Champs obligatoires manquants'
                });
            }


             await client.query('BEGIN');


            // récupération fichiers
            const photoclient =
                req.files?.photoclient?.[0]?.filename || null;

            const photocarterecto =
                req.files?.photocarterecto?.[0]?.filename || null;

            const photocarteverso =
                req.files?.photocarteverso?.[0]?.filename || null;

            const signature_client =
                req.files?.signature_client?.[0]?.filename || null;

            const signature_agence =
                req.files?.signature_agence?.[0]?.filename || null;

            const result = await pool.query(`
                INSERT INTO fina_credit_demande (
                    code_demande,
                    code_decaissement,
                    idclient,
                    idagence,
                    iduser,
                    idobjet,
                    montant_demande,
                    montant_accorde,
                    montant_rembourse,
                    duree_mois,
                    duree_grace,
                    frequence,
                    taux_interet,
                    objetdetail,
                    telephone,
                    adresse,
                    idpiece_identite,
                    numero_piece_identite,
                    idquartier,
                    revenu_mensuel,
                    garantie,
                    photoclient,
                    photocarterecto,
                    photocarteverso,
                    signature_client,
                    signature_agence,
                    commentaire,
                    idprod,
                    comptecredit
                )
                VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                    $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                    $21,$22,$23,$24,$25,$26,$27,$28,$29
                )
                RETURNING *
            `, [
                code_demande,
                code_decaissement || null,
                idclient,
                idagence,
                iduser,
                idobjet,
                montant_demande,
                montant_accorde || null,
                montant_rembourse || 0,
                duree_mois,
                duree_grace || 0,
                frequence || 1,
                taux_interet || 0,
                objetdetail || null,
                telephone,
                adresse || null,
                idpiece_identite || null,
                numero_piece_identite || null,
                idquartier || null,
                revenu_mensuel || 0,
                garantie || null,
                photoclient,
                photocarterecto,
                photocarteverso,
                signature_client,
                signature_agence,
                commentaire || null,
                idprod,
                comptecredit
            ]);




             // UPDATE automatique après INSERT
            await client.query(`
                UPDATE fina_credit_demande fcd
                SET
                    taux_interet = fpe.taux_interet_max,
                    codemodecalcule = fpe.codemodecalcule
                FROM fina_produitepargne fpe
                WHERE fpe.idprod = fcd.idprod
                AND fcd.iddemande = $1
            `, [result.rows[0].iddemande]);

            await client.query('COMMIT');





            res.status(201).json({
                success: true,
                message: 'Demande de crédit enregistrée avec succès',
                data: result.rows[0]
            });

        } catch (error) {

              await client.query('ROLLBACK');



            res.status(500).json({

                success: false,
                message: error.message
            });
        }
    }
);


// ==========================================
// AFFICHER
// ==========================================
router.get('/fina_credit_demande', async (req, res) => {
    try {
        const { idagence, search } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence obligatoire'
            });
        }

        let sql = `
            SELECT *
            FROM fina_credit_demande
            WHERE idagence = $1
        `;

        const params = [idagence];

        if (search) {
            sql += `
                AND (
                    code_demande ILIKE $2
                    OR telephone ILIKE $2
                )
            `;
            params.push(`%${search}%`);
        }

        sql += ` ORDER BY iddemande DESC`;

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

module.exports = router;