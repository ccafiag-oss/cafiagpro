const express = require('express');
const router = express.Router();
const pool = require('../config/db');

const multer = require('multer');
const path = require('path');
const fs = require('fs');


// ==========================================
// STORAGE MULTER (PHOTOS + SIGNATURES)
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {

        let subFolder = 'photo';

        if (file.fieldname.includes('signature')) {
            subFolder = 'signature';
        }

        const dir = path.join(
            __dirname,
            '../uploads/finance/clients/visite',
            subFolder
        );

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        cb(null, dir);
    },

    filename: (req, file, cb) => {

        const nomClient = (req.body.nomcomplet || 'client')
            .replace(/\s+/g, '_')
            .toLowerCase();

        const unique = Date.now() + '-' + Math.floor(Math.random() * 999999);

        const ext = path.extname(file.originalname);

        cb(null, `${nomClient}_${file.fieldname}_${unique}${ext}`);
    }
});


// ==========================================
// FILTRE FICHIERS
// ==========================================
const fileFilter = (req, file, cb) => {
    const allowed = /jpg|jpeg|png|pdf/;

    const ext = allowed.test(
        path.extname(file.originalname).toLowerCase()
    );

    if (ext) cb(null, true);
    else cb(new Error('Format non autorisé'));
};


// ==========================================
// MULTER CONFIG
// ==========================================
const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});


// ==========================================
// CHAMPS UPLOAD VISITE
// ==========================================
const uploadVisite = upload.fields([
    { name: 'photo1', maxCount: 1 },
    { name: 'photo2', maxCount: 1 },
    { name: 'photo3', maxCount: 1 },
    { name: 'signatureclient', maxCount: 1 },
    { name: 'signatureagence', maxCount: 1 }
]);


// ==========================================
// AJOUT VISITE COMPLET
// ==========================================
router.post('/visitedemandecredit', uploadVisite, async (req, res) => {

    try {
        const {
            iddemande,
            code_demande,
            idclient,
            idagence,
            iduser,
            idobjetvisite,
            objet_visite,
            commentaire,
            latitude,
            longitude,
            adresse_localisation,
            nomcomplet
        } = req.body;

        const files = req.files || {};

        const photo1 = files.photo1?.[0]?.filename || null;
        const photo2 = files.photo2?.[0]?.filename || null;
        const photo3 = files.photo3?.[0]?.filename || null;

        const signatureclient = files.signatureclient?.[0]?.filename || null;
        const signatureagence = files.signatureagence?.[0]?.filename || null;

        const query = `
            INSERT INTO fina_credit_visite (
                iddemande,
                code_demande,
                idclient,
                idagence,
                iduser,
                idobjetvisite,
                objet_visite,
                commentaire,
                latitude,
                longitude,
                adresse_localisation,
                photo1,
                photo2,
                photo3,
                signatureclient,
                signatureagence,
                nomcomplet
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,$16,$17
            )
            RETURNING *;
        `;

        const values = [
            iddemande,
            code_demande,
            idclient || null,
            idagence,
            iduser,
            idobjetvisite,
            objet_visite,
            commentaire,
            latitude,
            longitude,
            adresse_localisation,
            photo1,
            photo2,
            photo3,
            signatureclient,
            signatureagence,
            nomcomplet
        ];

        const result = await pool.query(query, values);


        /*

        const updateStatusQuery = `
            UPDATE fina_credit_demande 
            SET statut = 'EN_COURS' 
            WHERE iddemande = $1
        `;
        
        await pool.query(updateStatusQuery, [iddemande]);

*/

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


// ==========================================
// MODIFIER VISITE
// ==========================================
router.put('/visite/:idvisite', uploadVisite, async (req, res) => {

    try {
        const { idvisite } = req.params;

        const old = await pool.query(
            `SELECT * FROM fina_credit_visite WHERE idvisite=$1`,
            [idvisite]
        );

        if (old.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Visite introuvable"
            });
        }

        const data = old.rows[0];
        const files = req.files || {};

        const photo1 = files.photo1?.[0]?.filename || data.photo1;
        const photo2 = files.photo2?.[0]?.filename || data.photo2;
        const photo3 = files.photo3?.[0]?.filename || data.photo3;

        const signatureclient =
            files.signatureclient?.[0]?.filename || data.signatureclient;

        const signatureagence =
            files.signatureagence?.[0]?.filename || data.signatureagence;

        const {
            idclient,
            idobjetvisite,
            objet_visite,
            commentaire,
            latitude,
            longitude,
            adresse_localisation,
            nomcomplet,
            etat
        } = req.body;

        const query = `
            UPDATE fina_credit_visite
            SET
                idclient=$1,
                idobjetvisite=$2,
                objet_visite=$3,
                commentaire=$4,
                latitude=$5,
                longitude=$6,
                adresse_localisation=$7,
                nomcomplet=$8,
                photo1=$9,
                photo2=$10,
                photo3=$11,
                signatureclient=$12,
                signatureagence=$13,
                etat=$14
            WHERE idvisite=$15
            RETURNING *;
        `;

        const values = [
            idclient || null,
            idobjetvisite,
            objet_visite,
            commentaire,
            latitude,
            longitude,
            adresse_localisation,
            nomcomplet,
            photo1,
            photo2,
            photo3,
            signatureclient,
            signatureagence,
            etat,
            idvisite
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
});


// ==========================================
// LISTE VISITES
// ==========================================
router.get('/visite', async (req, res) => {

    try {
        const { idagence, iddemande } = req.query;

        let query = `
            SELECT *
            FROM fina_credit_visite
            WHERE etat = TRUE
        `;

        const values = [];
        let i = 1;

        if (idagence) {
            query += ` AND idagence = $${i}`;
            values.push(idagence);
            i++;
        }

        if (iddemande) {
            query += ` AND iddemande = $${i}`;
            values.push(iddemande);
            i++;
        }

        query += ` ORDER BY idvisite DESC`;

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


// ==========================================
// DETAIL VISITE
// ==========================================
router.get('/visite/:idvisite', async (req, res) => {

    try {
        const { idvisite } = req.params;

        const result = await pool.query(
            `SELECT * FROM fina_credit_visite WHERE idvisite=$1`,
            [idvisite]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Visite introuvable"
            });
        }

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

module.exports = router;