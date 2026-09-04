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
            file.fieldname === 'signature_caution' ||
            file.fieldname === 'signature_agence'
        ) {
            subFolder = 'signature';
        }

        const dir = path.join(
            __dirname,
            '../uploads/finance/clients/caution',
            subFolder
        );

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        cb(null, dir);
    },

    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() + '-' + Math.round(Math.random() * 1e9);

        cb(
            null,
            `${file.fieldname}-${uniqueName}${path.extname(file.originalname)}`
        );
    }
});


// ==========================================
// FILTRE TYPE FICHIER
// ==========================================
const fileFilter = (req, file, cb) => {
    const allowed = /jpg|jpeg|png|pdf/;
    const ext = allowed.test(
        path.extname(file.originalname).toLowerCase()
    );

    if (ext) {
        cb(null, true);
    } else {
        cb(new Error('Format de fichier non autorisé'));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});


// ==========================================
// CHAMPS FICHIERS
// ==========================================
const uploadCaution = upload.fields([
    { name: 'photocaution', maxCount: 1 },
    { name: 'photocarterecto', maxCount: 1 },
    { name: 'photocarteverso', maxCount: 1 },
    { name: 'signature_caution', maxCount: 1 },
    { name: 'signature_agence', maxCount: 1 }
]);


// ==========================================
// AJOUTER UNE CAUTION
// ==========================================
router.post(
    '/ajouter-caution',
    uploadCaution,
    async (req, res) => {
        try {
            const {
                iddemande,
                code_demande,
                idclient,
                idagence,
                iduser,
                nomcomplet,
                telephone,
                adresse,
                idpiece_identite,
                numero_piece_identite,
                idquartier,
                revenu_mensuel,
                commentaire
            } = req.body;

            const files = req.files || {};

            const photocaution =
                files.photocaution?.[0]?.filename || null;

            const photocarterecto =
                files.photocarterecto?.[0]?.filename || null;

            const photocarteverso =
                files.photocarteverso?.[0]?.filename || null;

            const signature_caution =
                files.signature_caution?.[0]?.filename || null;

            const signature_agence =
                files.signature_agence?.[0]?.filename || null;

            const query = `
                INSERT INTO fina_caution_credit (
                    iddemande,
                    code_demande,
                    idclient,
                    idagence,
                    iduser,
                    nomcomplet,
                    telephone,
                    adresse,
                    idpiece_identite,
                    numero_piece_identite,
                    idquartier,
                    revenu_mensuel,
                    photocaution,
                    photocarterecto,
                    photocarteverso,
                    signature_caution,
                    signature_agence,
                    commentaire
                )
                VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                    $11,$12,$13,$14,$15,$16,$17,$18
                )
                RETURNING *;
            `;

            const values = [
                iddemande,
                code_demande,
                idclient || null,
                idagence,
                iduser,
                nomcomplet,
                telephone,
                adresse,
                idpiece_identite,
                numero_piece_identite,
                idquartier,
                revenu_mensuel || 0,
                photocaution,
                photocarterecto,
                photocarteverso,
                signature_caution,
                signature_agence,
                commentaire
            ];

            const result = await pool.query(query, values);

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
    }
);


// ==========================================
// MODIFIER UNE CAUTION
// ==========================================
router.put(
    '/modifier-caution/:idcaution',
    uploadCaution,
    async (req, res) => {
        try {
            const { idcaution } = req.params;

            const oldData = await pool.query(
                `SELECT * FROM fina_caution_credit WHERE idcaution=$1`,
                [idcaution]
            );

            if (oldData.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Caution introuvable'
                });
            }

            const ancienne = oldData.rows[0];
            const files = req.files || {};

            const photocaution =
                files.photocaution?.[0]?.filename ||
                ancienne.photocaution;

            const photocarterecto =
                files.photocarterecto?.[0]?.filename ||
                ancienne.photocarterecto;

            const photocarteverso =
                files.photocarteverso?.[0]?.filename ||
                ancienne.photocarteverso;

            const signature_caution =
                files.signature_caution?.[0]?.filename ||
                ancienne.signature_caution;

            const signature_agence =
                files.signature_agence?.[0]?.filename ||
                ancienne.signature_agence;

            const {
                idclient,
                nomcomplet,
                telephone,
                adresse,
                idpiece_identite,
                numero_piece_identite,
                idquartier,
                revenu_mensuel,
                commentaire,
                etat
            } = req.body;

            const query = `
                UPDATE fina_caution_credit
                SET
                    idclient=$1,
                    nomcomplet=$2,
                    telephone=$3,
                    adresse=$4,
                    idpiece_identite=$5,
                    numero_piece_identite=$6,
                    idquartier=$7,
                    revenu_mensuel=$8,
                    photocaution=$9,
                    photocarterecto=$10,
                    photocarteverso=$11,
                    signature_caution=$12,
                    signature_agence=$13,
                    commentaire=$14,
                    etat=$15
                WHERE idcaution=$16
                RETURNING *;
            `;

            const values = [
                idclient || null,
                nomcomplet,
                telephone,
                adresse,
                idpiece_identite,
                numero_piece_identite,
                idquartier,
                revenu_mensuel || 0,
                photocaution,
                photocarterecto,
                photocarteverso,
                signature_caution,
                signature_agence,
                commentaire,
                etat,
                idcaution
            ];

            const result = await pool.query(query, values);

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
    }
);

module.exports = router;