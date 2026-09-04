const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ... (Gardez votre configuration Multer inchangée) ...

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
// AJOUT VISITE
// ==========================================
router.post('/ajouteragrovisite', uploadVisite, async (req, res) => {
    try {
        const {
            code_visite, idcampagne, idcooperative, idfourn, idagence, 
            iduser, idobjetvisite, objet_visite, commentaire, latitude, 
            longitude, adresse_localisation, nomcomplet
        } = req.body;

        const files = req.files || {};
        const photo1 = files.photo1?.[0]?.filename || null;
        const photo2 = files.photo2?.[0]?.filename || null;
        const photo3 = files.photo3?.[0]?.filename || null;
        const signatureclient = files.signatureclient?.[0]?.filename || null;
        const signatureagence = files.signatureagence?.[0]?.filename || null;

        const query = `
            INSERT INTO public.agro_campagne_visite (
                code_visite, idcampagne, idcooperative, idfourn, idagence, 
                iduser, idobjetvisite, objet_visite, commentaire, latitude, 
                longitude, adresse_localisation, photo1, photo2, photo3, 
                signatureclient, signatureagence, nomcomplet
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *;
        `;

        const values = [
            code_visite, idcampagne, idcooperative, idfourn, idagence, 
            iduser, idobjetvisite, objet_visite, commentaire, latitude, 
            longitude, adresse_localisation, photo1, photo2, photo3, 
            signatureclient, signatureagence, nomcomplet
        ];

        const result = await pool.query(query, values);
        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// MODIFIER VISITE
// ==========================================
router.put('/visiteagrovisite/:idvisite', uploadVisite, async (req, res) => {
    try {
        const { idvisite } = req.params;
        const old = await pool.query(`SELECT * FROM public.agro_campagne_visite WHERE idvisite=$1`, [idvisite]);

        if (old.rowCount === 0) return res.status(404).json({ success: false, message: "Visite introuvable" });

        const data = old.rows[0];
        const files = req.files || {};

        const photo1 = files.photo1?.[0]?.filename || data.photo1;
        const photo2 = files.photo2?.[0]?.filename || data.photo2;
        const photo3 = files.photo3?.[0]?.filename || data.photo3;
        const signatureclient = files.signatureclient?.[0]?.filename || data.signatureclient;
        const signatureagence = files.signatureagence?.[0]?.filename || data.signatureagence;

        const {
            idcampagne, idcooperative, idfourn, idobjetvisite, objet_visite, 
            commentaire, latitude, longitude, adresse_localisation, nomcomplet
        } = req.body;

        const query = `
            UPDATE public.agro_campagne_visite
            SET idcampagne=$1, idcooperative=$2, idfourn=$3, idobjetvisite=$4, objet_visite=$5, 
                commentaire=$6, latitude=$7, longitude=$8, adresse_localisation=$9, 
                nomcomplet=$10, photo1=$11, photo2=$12, photo3=$13, 
                signatureclient=$14, signatureagence=$15
            WHERE idvisite=$16 RETURNING *;
        `;

        const values = [
            idcampagne, idcooperative, idfourn, idobjetvisite, objet_visite, 
            commentaire, latitude, longitude, adresse_localisation, nomcomplet, 
            photo1, photo2, photo3, signatureclient, signatureagence, idvisite
        ];

        const result = await pool.query(query, values);
        res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// LISTE / DETAIL (Adapter le SELECT vers public.agro_campagne_visite)
// ==========================================
router.get('/visiteagrovisite', async (req, res) => {
    try {
        const { idagence, idcampagne,idfourn } = req.query;
        let query = `SELECT * FROM public.agro_campagne_visite WHERE etat = TRUE`;
        const values = [];
        
        if (idagence) { values.push(idagence); query += ` AND idagence = $${values.length}`; }
        if (idcampagne) { values.push(idcampagne); query += ` AND idcampagne = $${values.length}`; }
        

        if (idfourn) { 
            values.push(idfourn); 
            query += ` AND idfourn = $${values.length}`; 
        }

        query += ` ORDER BY idvisite DESC`;
        const result = await pool.query(query, values);
        res.json({ success: true, total: result.rowCount, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});




// ==========================================
// RAPPORT DES VISITES PAR CAMPAGNE, COOPÉRATIVE ET MEMBRE (TRIÉES PAR OBJET ET DATE)
// ==========================================
router.get('/rapportvisites', async (req, res) => {
    try {
        const { idagence, idcampagne } = req.query;

        let query = `
            SELECT 
                v.*,
                c.designation AS campagne_nom,
                fc.raisonsociale AS cooperative_nom,
                gf.nomcomplet AS fournisseur_nom
            FROM public.agro_campagne_visite v
            LEFT JOIN public.agro_campagne c ON c.idcampagne = v.idcampagne
            LEFT JOIN public.fina_cooperative fc ON fc.idcooperative = v.idcooperative
            LEFT JOIN public.gfournisseur gf ON gf.idfourn = v.idfourn
            WHERE v.etat = TRUE AND v.idagence = $1
        `;

        const values = [idagence];

        if (idcampagne && idcampagne !== 'all') {
            values.push(idcampagne);
            query += ` AND v.idcampagne = $${values.length}`;
        }

        // Tri strict demandé : Campagne -> Coopérative -> Membre -> Objet de visite -> Date (chronologique)
        query += ` ORDER BY c.designation ASC, fc.raisonsociale ASC, v.nomcomplet ASC, v.objet_visite ASC, v.date_creation ASC `;

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

module.exports = router;