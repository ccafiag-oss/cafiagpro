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
        if (file.fieldname === 'signature_client' || file.fieldname === 'signature_caisse') {
            subFolder = 'signature';
        }
        const dir = path.join(__dirname, '../uploads/finance/clients/epargne', subFolder);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.floor(Math.random() * 999999);
        cb(null, `${file.fieldname}-${unique}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});


// ==========================================
// 1. AJOUT (POST) - Géré par Trigger
// ==========================================
router.post(
    '/ajouter-operation-epargne',
    upload.fields([
        { name: 'signature_client', maxCount: 1 },
        { name: 'signature_caisse', maxCount: 1 },
        { name: 'photocarterecto', maxCount: 1 },
        { name: 'photocarteverso', maxCount: 1 }
    ]),
    async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const {
                codeoperation, dateoperation, idclient, idprod, iduser, idagence,
                codeclient, codecompte, designation, libelle, montant, typesoperation,
                solde, codjrnal, compteDestination, ref_piece
            } = req.body;

            if (!codeoperation || !idclient || !iduser || !idagence || !montant || !typesoperation || !ref_piece) {
                return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
            }

            const signature_client = req.files?.signature_client?.[0]?.filename || null;
            const signature_caisse = req.files?.signature_caisse?.[0]?.filename || null;
            const photocarterecto = req.files?.photocarterecto?.[0]?.filename || null;
            const photocarteverso = req.files?.photocarteverso?.[0]?.filename || null;

            const query = `
                INSERT INTO fina_operation_epargne (
                    codeoperation, dateoperation, idclient, idprod, iduser, idagence,
                    codeclient, codecompte, designation, libelle, montant, typesoperation,
                    solde, codjrnal, comptedestination, ref_piece,
                    signature_client, signature_caisse, photocarterecto, photocarteverso
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
                RETURNING *`;

            const values = [
                codeoperation, dateoperation || new Date(), idclient, idprod || null, iduser, idagence,
                codeclient || null, codecompte || null, designation || null, libelle || null,
                montant, typesoperation, solde || 0, codjrnal || null, compteDestination || null, ref_piece,
                signature_client, signature_caisse, photocarterecto, photocarteverso
            ];

            const result = await client.query(query, values);

            await client.query('COMMIT');
            res.status(201).json({ success: true, message: 'Opération enregistrée et comptabilisée', data: result.rows[0] });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error("ERREUR SQL INSERTION :", err.message);
            res.status(500).json({ success: false, message: err.message });
        } finally {
            client.release();
        }
    }
);


// ==========================================
// 2. MISE A JOUR (PUT)
// ==========================================
router.put(
    '/operation-epargne/:idoperation',
    upload.fields([
        { name: 'signature_client', maxCount: 1 },
        { name: 'signature_caisse', maxCount: 1 },
        { name: 'photocarterecto', maxCount: 1 },
        { name: 'photocarteverso', maxCount: 1 }
    ]),
    async (req, res) => {
        const client = await pool.connect();
        const { idoperation } = req.params;
        try {
            await client.query('BEGIN');

            const {
                codeoperation, dateoperation, idclient, idprod, iduser, idagence,
                codeclient, codecompte, designation, libelle, montant, typesoperation,
                solde, codjrnal, compteDestination, ref_piece
            } = req.body;

            if (!ref_piece) {
                throw new Error("La référence de pièce (ref_piece) est obligatoire pour la mise à jour.");
            }

            // Récupération des anciens fichiers si de nouveaux ne sont pas fournis
            const existing = await client.query(`SELECT signature_client, signature_caisse, photocarterecto, photocarteverso FROM fina_operation_epargne WHERE idoperation = $1`, [idoperation]);
            const oldFiles = existing.rows[0] || {};

            const signature_client = req.files?.signature_client?.[0]?.filename || oldFiles.signature_client;
            const signature_caisse = req.files?.signature_caisse?.[0]?.filename || oldFiles.signature_caisse;
            const photocarterecto = req.files?.photocarterecto?.[0]?.filename || oldFiles.photocarterecto;
            const photocarteverso = req.files?.photocarteverso?.[0]?.filename || oldFiles.photocarteverso;

            const query = `
                UPDATE fina_operation_epargne SET
                    codeoperation = $1, dateoperation = $2, idclient = $3, idprod = $4, iduser = $5, idagence = $6,
                    codeclient = $7, codecompte = $8, designation = $9, libelle = $10, montant = $11, typesoperation = $12,
                    solde = $13, codjrnal = $14, comptedestination = $15, ref_piece = $16,
                    signature_client = $17, signature_caisse = $18, photocarterecto = $19, photocarteverso = $20
                WHERE idoperation = $21
                RETURNING *`;

            const values = [
                codeoperation, dateoperation, idclient, idprod || null, iduser, idagence,
                codeclient || null, codecompte || null, designation || null, libelle || null,
                montant, typesoperation, solde || 0, codjrnal || null, compteDestination || null, ref_piece,
                signature_client, signature_caisse, photocarterecto, photocarteverso, idoperation
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error("Opération épargne introuvable.");
            }

            await client.query('COMMIT');
            res.status(200).json({ success: true, message: 'Opération mise à jour avec succès', data: result.rows[0] });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error("ERREUR SQL MISE A JOUR :", err.message);
            res.status(500).json({ success: false, message: err.message });
        } finally {
            client.release();
        }
    }
);


// ==========================================
// 3. SUPPRESSION (DELETE)
// ==========================================
router.delete('/operation-epargne/:idoperation', async (req, res) => {
    const client = await pool.connect();
    const { idoperation } = req.params;
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `DELETE FROM fina_operation_epargne WHERE idoperation = $1 RETURNING *`, 
            [idoperation]
        );

        if (result.rows.length === 0) {
            throw new Error("Opération épargne introuvable.");
        }

        await client.query('COMMIT');
        res.status(200).json({ 
            success: true, 
            message: "Opération épargne et écritures comptables associées supprimées avec succès." 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERREUR SQL SUPPRESSION :", err.message);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;


/*
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
            file.fieldname === 'signature_caisse'
        ) {
            subFolder = 'signature';
        }

        const dir = path.join(
            __dirname,
            '../uploads/finance/clients/epargne',
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
// AJOUT OPERATION EPARGNE + ECRITURE COMPTABLE
// ==========================================
router.post(
    '/ajouter-operation-epargne',
    upload.fields([
        { name: 'signature_client', maxCount: 1 },
        { name: 'signature_caisse', maxCount: 1 },
        { name: 'photocarterecto', maxCount: 1 },
        { name: 'photocarteverso', maxCount: 1 }
    ]),
    async (req, res) => {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const {
                codeoperation,
                dateoperation,
                idclient,
                idprod,
                iduser,
                idagence,
                codeclient,
                codecompte,
                designation,
                libelle,
                montant,
                typesoperation,
                solde,
                idcarnet,
                codjrnal,
                idmois,
                idannee,
                compteTontine,
                compteDestination
            } = req.body;

            // Vérification champs obligatoires
            if (
                !codeoperation ||
                !idclient ||
                !iduser ||
                !idagence ||
                !montant ||
                !typesoperation
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Champs obligatoires manquants'
                });
            }

            // fichiers uploadés
            const signature_client =
                req.files?.signature_client?.[0]?.filename || null;

            const signature_caisse =
                req.files?.signature_caisse?.[0]?.filename || null;

            const photocarterecto =
                req.files?.photocarterecto?.[0]?.filename || null;

            const photocarteverso =
                req.files?.photocarteverso?.[0]?.filename || null;

            // récupérer compte caisse utilisateur
            const caisseResult = await client.query(
                `
                SELECT comptecaisse
                FROM caisse_utilisateur
                WHERE iduser = $1
                `,
                [iduser]
            );

            if (
                caisseResult.rows.length === 0 &&
                typesoperation !== 'TRANSFERT'
            ) {
                throw new Error(
                    'Configuration comptable manquante (Caisse utilisateur)'
                );
            }

            const compteCaisseEffective =
                caisseResult.rows[0]?.comptecaisse || null;

            // ==========================================
            // INSERT OPERATION EPARGNE (UNE SEULE FOIS)
            // ==========================================
            const result = await client.query(
                `
                INSERT INTO fina_operation_epargne (
                    codeoperation,
                    dateoperation,
                    idclient,
                    idprod,
                    iduser,
                    idagence,
                    codeclient,
                    codecompte,
                    designation,
                    libelle,
                    montant,
                    typesoperation,
                    solde,
                    signature_client,
                    signature_caisse,
                    photocarterecto,
                    photocarteverso
                )
                VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                    $11,$12,$13,$14,$15,$16,$17
                )
                RETURNING *
                `,
                [
                    codeoperation,
                    dateoperation || new Date(),
                    idclient,
                    idprod || null,
                    iduser,
                    idagence,
                    codeclient || null,
                    codecompte || null,
                    designation || null,
                    libelle || null,
                    montant,
                    typesoperation,
                    solde || 0,
                    signature_client,
                    signature_caisse,
                    photocarterecto,
                    photocarteverso
                ]
            );

            // ==========================================
            // ECRITURES COMPTABLES
            // ==========================================

            if (typesoperation === 'DEPOT') {

                // Débit caisse
                await passerEcriture(client, [
                    codeoperation,
                    dateoperation,
                    codjrnal,
                    compteCaisseEffective,
                    idclient,
                    `DEPOT CAISSE - ${designation}`,
                    montant,
                    0,
                    iduser,
                    idmois,
                    idannee,
                    codeoperation,
                    codeclient,
                    idagence
                ]);

                // Crédit épargne
                await passerEcriture(client, [
                    codeoperation,
                    dateoperation,
                    codjrnal,
                    codecompte,
                    idclient,
                    `DEPOT EPARGNE - ${designation}`,
                    0,
                    montant,
                    iduser,
                    idmois,
                    idannee,
                    codeoperation,
                    codeclient,
                    idagence
                ]);

            } else if (typesoperation === 'RETRAIT') {

                // Débit épargne
                await passerEcriture(client, [
                    codeoperation,
                    dateoperation,
                    codjrnal,
                    codecompte,
                    idclient,
                    `RETRAIT EPARGNE - ${designation}`,
                    montant,
                    0,
                    iduser,
                    idmois,
                    idannee,
                    codeoperation,
                    codeclient,
                    idagence
                ]);

                // Crédit caisse
                await passerEcriture(client, [
                    codeoperation,
                    dateoperation,
                    codjrnal,
                    compteCaisseEffective,
                    idclient,
                    `RETRAIT CAISSE - ${designation}`,
                    0,
                    montant,
                    iduser,
                    idmois,
                    idannee,
                    codeoperation,
                    codeclient,
                    idagence
                ]);

            } else if (typesoperation === 'TRANSFERT') {

                if (!compteDestination) {
                    throw new Error(
                        'Compte destination obligatoire pour transfert'
                    );
                }

                // Débit compte source
                await passerEcriture(client, [
                    codeoperation,
                    dateoperation,
                    codjrnal,
                    codecompte,
                    idclient,
                    `TRANSFERT SORTANT - ${designation}`,
                    montant,
                    0,
                    iduser,
                    idmois,
                    idannee,
                    codeoperation,
                    codeclient,
                    idagence
                ]);

                // Crédit compte destination
                await passerEcriture(client, [
                    codeoperation,
                    dateoperation,
                    codjrnal,
                    compteDestination,
                    idclient,
                    `TRANSFERT ENTRANT - ${designation}`,
                    0,
                    montant,
                    iduser,
                    idmois,
                    idannee,
                    codeoperation,
                    codeclient,
                    idagence
                ]);
            }

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                message: 'Opération enregistrée avec succès',
                data: result.rows[0]
            });

        } catch (err) {
            await client.query('ROLLBACK');

            return res.status(500).json({
                success: false,
                message: err.message
            });

        } finally {
            client.release();
        }
    }
);


// ==========================================
// FONCTION INSERT ECRITURE COMPTABLE
// ==========================================
async function passerEcriture(client, params) {
    const query = `
        INSERT INTO TMVTTHEORIQUE(
            idtmvth,
            date,
            CODJRL,
            IDCPTGN,
            IDTIERS,
            LIBELLE,
            MONTANTDEBIT,
            MONTANTCREDIT,
            IDUSER,
            IDMOIS,
            IDANNEE,
            CODFACT,
            REFTIERS,
            idagence
        )
        VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,
            $9,$10,$11,$12,$13,$14
        )
    `;

    return client.query(query, params);
}

module.exports = router;
*/