const express = require('express');
const router = express.Router();
const pool = require('../config/db');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ==========================================
// AJOUTER UN DECAISSEMENT
// ==========================================
// ==========================================
// AJOUTER UN DECAISSEMENT
// ==========================================


/*
router.post('/credit-decaissement-ajouter', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            code_decaissement,
            dateoperation,
            iddemande,
            iduser,
            idclient,
            montant_accorde,
            montant_decaisse,
            duree_mois,
            duree_grace,
            frequence,
            taux_interet,
            idprod,
            comptecredit,
            modepaiement,
            compteepargne,
            idagence,
            codjrnal
        } = req.body;

        // 1. VALIDATION
        if (!code_decaissement || !iddemande || !iduser || !idclient || 
            !montant_decaisse || !compteepargne || !idagence || !codjrnal) {
            return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
        }

        const d = new Date(dateoperation || new Date());
        const idmois = d.getMonth() + 1;
        const idannee = d.getFullYear();

        // 2. RECUPERATION DU COMPTE CAISSE
        const caisseResult = await client.query(
            `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`,
            [iduser]
        );

        if (caisseResult.rows.length === 0) {
            throw new Error('Compte caisse utilisateur introuvable');
        }
        const compteCaisse = caisseResult.rows[0].comptecaisse;

*/



        /*
        // 3. INSERTION DU DECAISSEMENT
        await client.query(
            `INSERT INTO fina_credit_decaissement (
                code_decaissement, dateoperation, iddemande, iduser, idclient,
                montant_accorde, montant_decaisse, duree_mois, duree_grace,
                frequence, taux_interet, idprod, comptecredit, modepaiement,
                compteepargne, statut
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'DECAISSE')`,
            [
                code_decaissement, d, iddemande, iduser, idclient,
                montant_accorde || 0, montant_decaisse, duree_mois || 0,
                duree_grace || 0, frequence || 0, taux_interet || 0,
                idprod, comptecredit, modepaiement, compteepargne
            ]
        );

        */

        /*
await client.query(
    `INSERT INTO fina_credit_decaissement (
        code_decaissement,
        dateoperation,
        iddemande,
        iduser,
        idclient,
        montant_accorde,
        montant_decaisse,
        duree_mois,
        duree_grace,
        frequence,
        taux_interet,
        codemodecalcule,
        idprod,
        comptecredit,
        modepaiement,
        compteepargne,
        statut
    )
    SELECT
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        fcd.taux_interet,
        fcd.codemodecalcule,
        $11,$12,$13,$14,
        'DECAISSE'
    FROM fina_credit_demande fcd
    WHERE fcd.iddemande = $15`,
    [
        code_decaissement,   // $1
        d,                   // $2
        iddemande,           // $3
        iduser,              // $4
        idclient,            // $5
        montant_accorde || 0,// $6
        montant_decaisse,    // $7
        duree_mois || 0,     // $8
        duree_grace || 0,    // $9
        frequence || 0,      // $10
        idprod,              // $11
        comptecredit,        // $12
        modepaiement,        // $13
        compteepargne,       // $14
        iddemande            // $15 (pour le WHERE)
    ]
);




const modeResult = await client.query(
    `SELECT codemodecalcule 
     FROM fina_credit_demande 
     WHERE iddemande = $1`,
    [iddemande]
);

const codemodecalcule = modeResult.rows[0]?.codemodecalcule;


if (codemodecalcule === 'DEG') {

        // 4. GÉNÉRATION DU TABLEAU D'ÉCHÉANCE (Appel de la fonction SQL)
        // Note : On calcule le total des jours (ex: duree_mois * 30)
        const totalJours = (duree_mois || 0) * 30; 
        
        await client.query(
            `SELECT public.fina_fn_generer_tableau_amortissement_degressif_jours(
                $1, -- p_loan_amount (montant_decaisse)
                $2, -- p_roi (taux_interet)
                $3, -- p_total_days (duree_mois * 30)
                $4, -- p_frequency_days (frequence : ex 1 pour journalier, 7 pour hebdo, 30 pour mensuel)
                $5, -- p_dateeffet (dateoperation)
                $6, -- p_idagence
                $7, -- p_grace_periods (duree_grace)
                $8, -- p_idclient
                $9, -- p_codeclient (On peut passer l'ID ou le code)
                $10, -- p_codedec (code_decaissement)
                $11, -- p_comptecredit
                $12  -- p_compteclient (compteepargne)
            )`,
            [
                montant_decaisse,
                taux_interet,
                totalJours,
                frequence, 
                d,
                idagence,
                duree_grace,
                idclient,
                idclient.toString(), // codeclient
                code_decaissement,
                comptecredit,
                compteepargne
            ]
        );




} else if (codemodecalcule === 'LIN') {


        // 4. GÉNÉRATION DU TABLEAU D'ÉCHÉANCE (Appel de la fonction SQL)
        // Note : On calcule le total des jours (ex: duree_mois * 30)
        const totalJours = (duree_mois || 0) * 30; 
        
        await client.query(
            `SELECT public.fina_fn_generer_tableau_amortissement_jours(
                $1, -- p_loan_amount (montant_decaisse)
                $2, -- p_roi (taux_interet)
                $3, -- p_total_days (duree_mois * 30)
                $4, -- p_frequency_days (frequence : ex 1 pour journalier, 7 pour hebdo, 30 pour mensuel)
                $5, -- p_dateeffet (dateoperation)
                $6, -- p_idagence
                $7, -- p_grace_periods (duree_grace)
                $8, -- p_idclient
                $9, -- p_codeclient (On peut passer l'ID ou le code)
                $10, -- p_codedec (code_decaissement)
                $11, -- p_comptecredit
                $12  -- p_compteclient (compteepargne)
            )`,
            [
                montant_decaisse,
                taux_interet,
                totalJours,
                frequence, 
                d,
                idagence,
                duree_grace,
                idclient,
                idclient.toString(), // codeclient
                code_decaissement,
                comptecredit,
                compteepargne
            ]
        );


} else {
    throw new Error("Mode de calcul inconnu : " + codemodecalcule);
}







        // 4. MISE À JOUR DU STATUT DE LA DEMANDE
        await client.query(
            `UPDATE fina_credit_demande SET statut = 'DECAISSE' WHERE iddemande = $1`,
            [iddemande]
        );

        // 5. ECRITURES COMPTABLES (Utilisation du code_decaissement pour idtmvth)
        
        // ==========================================
// ECRITURES COMPTABLES (CORRIGÉES)
// ==========================================

// 1. DÉBIT : Compte Caisse (Sortie de fonds)
await passerEcriture(client, [
    code_decaissement, // $1 -> idtmvth
    d,                 // $2 -> date
    codjrnal,          // $3 -> CODJRL
    compteCaisse,      // $4 -> IDCPTGN (Compte Caisse)
    idclient,          // $5 -> IDTIERS
    `SORTIE CAISSE - DECAISSEMENT ${code_decaissement}`, // $6 -> LIBELLE
    montant_decaisse,  // $7 -> MONTANTDEBIT (DÉBIT ici)
    0,                 // $8 -> MONTANTCREDIT
    iduser,            // $9 -> IDUSER
    idmois,            // $10 -> IDMOIS
    idannee,           // $11 -> IDANNEE
    code_decaissement, // $12 -> CODFACT
    code_decaissement, // $13 -> REFTIERS
    idagence           // $14 -> idagence
]);

// 2. CRÉDIT : Compte Épargne Client (Alimentation du compte client)
await passerEcriture(client, [
    code_decaissement, // $1 -> idtmvth
    d,                 // $2
    codjrnal,          // $3
    compteepargne,     // $4 -> IDCPTGN (Compte Épargne)
    idclient,          // $5
    `MISE A DISPOSITION CREDIT ${code_decaissement}`, // $6
    0,                 // $7 -> MONTANTDEBIT
    montant_decaisse,  // $8 -> MONTANTCREDIT (CRÉDIT ici)
    iduser,            // $9
    idmois,            // $10
    idannee,           // $11
    code_decaissement, // $12
    code_decaissement, // $13
    idagence           // $14
]);
        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Décaissement effectué avec succès',
            code: code_decaissement
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("ERREUR SERVEUR:", error.message);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});

*/




// ==========================================
// CONFIGURATION MULTER
// ==========================================










// ==========================================
// CONFIGURATION MULTER
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let subFolder = 'photo';

        // Signatures dans le dossier signature
        if (
            file.fieldname === 'signature_client' ||
            file.fieldname === 'signature_agence'
        ) {
            subFolder = 'signature';
        }

        const dir = path.join(
            __dirname,
            '../uploads/finance/clients/decaisse',
            subFolder
        );

        // Création du dossier si inexistant
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        cb(null, dir);
    },

    filename: (req, file, cb) => {
        const unique =
            Date.now() + '-' + Math.floor(Math.random() * 999999);

        const extension = path.extname(file.originalname);

        cb(
            null,
            `${file.fieldname}-${unique}${extension}`
        );
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 Mo
    }
});


// ==========================================
// AJOUT DECAISSEMENT CREDIT
// ==========================================
/*
router.post(
    '/credit-decaissement-ajouter',
    upload.fields([
        { name: 'signature_client', maxCount: 1 },
        { name: 'signature_agence', maxCount: 1 }
    ]),
    async (req, res) => {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const {
                code_decaissement,
                dateoperation,
                iddemande,
                iduser,
                idclient,
                montant_accorde,
                montant_decaisse,
                duree_mois,
                duree_grace,
                frequence,
                idprod,
                comptecredit,
                modepaiement,
                compteepargne,
                idagence,
                codjrnal
            } = req.body;

            // =========================
            // VALIDATION
            // =========================
            if (
                !code_decaissement ||
                !iddemande ||
                !iduser ||
                !idclient ||
                !montant_decaisse ||
                !compteepargne ||
                !idagence ||
                !codjrnal
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Champs obligatoires manquants'
                });
            }

            // Récupération signatures uploadées
            const signature_client =
                req.files?.signature_client?.[0]?.filename || null;

            const signature_agence =
                req.files?.signature_agence?.[0]?.filename || null;

            const d = new Date(dateoperation || new Date());

            // =========================
            // COMPTE CAISSE
            // =========================
            const caisseResult = await client.query(
                `SELECT comptecaisse 
                 FROM caisse_utilisateur 
                 WHERE iduser = $1`,
                [iduser]
            );

            if (caisseResult.rows.length === 0) {
                throw new Error('Compte caisse introuvable');
            }

            const compteCaisse =
                caisseResult.rows[0].comptecaisse;

            // =========================
            // DEMANDE CREDIT
            // =========================
            const demandeResult = await client.query(
                `SELECT taux_interet, codemodecalcule
                 FROM fina_credit_demande
                 WHERE iddemande = $1`,
                [iddemande]
            );

            if (demandeResult.rows.length === 0) {
                throw new Error('Demande introuvable');
            }

            const {
                taux_interet,
                codemodecalcule
            } = demandeResult.rows[0];

            // =========================
            // INSERT DECAISSEMENT
            // =========================
            await client.query(
                `INSERT INTO fina_credit_decaissement (
                    code_decaissement,
                    dateoperation,
                    iddemande,
                    iduser,
                    idclient,
                    montant_accorde,
                    montant_decaisse,
                    duree_mois,
                    duree_grace,
                    frequence,
                    taux_interet,
                    codemodecalcule,
                    idprod,
                    comptecredit,
                    modepaiement,
                    compteepargne,
                    statut,
                    signature_client,
                    signature_agence,
                    idagence
                )
                VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                    $11,$12,$13,$14,$15,$16,
                    'DECAISSE',$17,$18,$19
                )`,
                [
                    code_decaissement,
                    d,
                    iddemande,
                    iduser,
                    idclient,
                    montant_accorde || 0,
                    montant_decaisse,
                    duree_mois || 0,
                    duree_grace || 0,
                    frequence || 0,
                    taux_interet,
                    codemodecalcule,
                    idprod,
                    comptecredit,
                    modepaiement,
                    compteepargne,
                    signature_client,
                    signature_agence,
                    idagence
                ]
            );

           

/*
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
            '../uploads/finance/clients/decaisse',
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













router.post('/credit-decaissement-ajouter', async (req, res) => {
    const client = await pool.connect();

     upload.fields([
       
        { name: 'signature_client', maxCount: 1 },
        { name: 'signature_agence', maxCount: 1 }
    ]),

    try {
        await client.query('BEGIN');

        const {
            code_decaissement,
            dateoperation,
            iddemande,
            iduser,
            idclient,
            montant_accorde,
            montant_decaisse,
            duree_mois,
            duree_grace,
            frequence,
            idprod,
            comptecredit,
            modepaiement,
            compteepargne,
            idagence,
            codjrnal
        } = req.body;

        // =========================
        // 1. VALIDATION
        // =========================
        if (
            !code_decaissement ||
            !iddemande ||
            !iduser ||
            !idclient ||
            !montant_decaisse ||
            !compteepargne ||
            !idagence ||
            !codjrnal
        ) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants'
            });
        }

        const d = new Date(dateoperation || new Date());

        // =========================
        // 2. COMPTE CAISSE
        // =========================
        const caisseResult = await client.query(
            `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`,
            [iduser]
        );

        if (caisseResult.rows.length === 0) {
            throw new Error('Compte caisse introuvable');
        }

        const compteCaisse = caisseResult.rows[0].comptecaisse;

        // =========================
        // 3. DEMANDE + MODE CALCUL
        // =========================
        const demandeResult = await client.query(
            `SELECT taux_interet, codemodecalcule 
             FROM fina_credit_demande 
             WHERE iddemande = $1`,
            [iddemande]
        );

        if (demandeResult.rows.length === 0) {
            throw new Error('Demande introuvable');
        }

        const {
            taux_interet,
            codemodecalcule
        } = demandeResult.rows[0];


         const signature_client =
                req.files?.signature_client?.[0]?.filename || null;

            const signature_agence =
                req.files?.signature_agence?.[0]?.filename || null;

        // =========================
        // 4. INSERT DECAISSEMENT
        // =========================
        await client.query(
            `INSERT INTO fina_credit_decaissement (
                code_decaissement,
                dateoperation,
                iddemande,
                iduser,
                idclient,
                montant_accorde,
                montant_decaisse,
                duree_mois,
                duree_grace,
                frequence,
                taux_interet,
                codemodecalcule,
                idprod,
                comptecredit,
                modepaiement,
                compteepargne,
                statut,
                signature_client,
                signature_agence
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,$16,'DECAISSE',$17,$18
            )`,
            [
                code_decaissement,
                d,
                iddemande,
                iduser,
                idclient,
                montant_accorde || 0,
                montant_decaisse,
                duree_mois || 0,
                duree_grace || 0,
                frequence || 0,
                taux_interet,
                codemodecalcule,
                idprod,
                comptecredit,
                modepaiement,
                compteepargne,
                 signature_client,
                signature_agence
            ]
        );
        */








/*
        // =========================
        // 5. PARAMÈTRES AMORTISSEMENT
        // =========================
        const totalJours = (duree_mois || 0) * 30;

        const params = [
            montant_decaisse,
            taux_interet,
            totalJours,
            frequence,
            d,
            idagence,
            duree_grace,
            idclient,
            idclient.toString(),
            code_decaissement,
            comptecredit,
            compteepargne
        ];

        // =========================
        // 6. GENERATION TABLEAU
        // =========================
        if (codemodecalcule === 'DEG') {

            await client.query(
                `SELECT public.fina_fn_generer_tableau_amortissement_degressif_jours(
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
                )`,
                params
            );

        } 
        else if (codemodecalcule === 'LIN') {

            await client.query(
                `SELECT public.fina_fn_generer_tableau_amortissement_jours(
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
                )`,
                params
            );

        } 
        else {
            throw new Error("Mode de calcul inconnu : " + codemodecalcule);
        }

        // =========================
        // 7. MISE À JOUR STATUT
        // =========================
       

        await client.query(

            `UPDATE fina_credit_demande

             SET statut = 'DECAISSE' ,

                 code_decaissement=code_decaissement

             WHERE iddemande = $1`,

            [iddemande]

        );

        // =========================
        // 8. ECRITURES COMPTABLES
        // =========================

        await passerEcriture(client, [
            code_decaissement,
            d,
            codjrnal,
            comptecredit,
            idclient,
            `MISE A DISPOSITION CREDIT - ${code_decaissement}`,
            montant_decaisse,
            0,
            iduser,
            d.getMonth() + 1,
            d.getFullYear(),
            code_decaissement,
            code_decaissement,
            idagence
        ]);

        await passerEcriture(client, [
            code_decaissement,
            d,
            codjrnal,
            compteepargne,
            idclient,
            `MISE A DISPOSITION CREDIT ${code_decaissement}`,
            0,
            montant_decaisse,
            iduser,
            d.getMonth() + 1,
            d.getFullYear(),
            code_decaissement,
            code_decaissement,
            idagence
        ]);

        // =========================
        // 9. COMMIT
        // =========================
        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Décaissement effectué avec succès',
            code: code_decaissement,
            mode: codemodecalcule
        });

    } catch (error) {

        await client.query('ROLLBACK');

        console.error("ERREUR SERVEUR:", error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {
        client.release();
    }
});
*/



// ==========================================
// AJOUT DECAISSEMENT CREDIT (CORRIGÉ)
// ==========================================

/*
router.post(
    '/credit-decaissement-ajouter',
    upload.fields([
        { name: 'signature_client', maxCount: 1 },
        { name: 'signature_agence', maxCount: 1 }
    ]),
    async (req, res) => {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const {
                code_decaissement,
                dateoperation,
                iddemande,
                iduser,
                idclient,
                montant_accorde,
                montant_decaisse,
                duree_mois,
                duree_grace,
                frequence,
                idprod,
                comptecredit,
                modepaiement,
                compteepargne,
                idagence,
                codjrnal
            } = req.body;

            // =========================
            // 1. VALIDATION
            // =========================
            if (
                !code_decaissement ||
                !iddemande ||
                !iduser ||
                !idclient ||
                !montant_decaisse ||
                !compteepargne ||
                !idagence ||
                !codjrnal
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Champs obligatoires manquants'
                });
            }

            const d = new Date(dateoperation || new Date());

            // Récupération des signatures uploadées via Multer
            const signature_client = req.files?.signature_client?.[0]?.filename || null;
            const signature_agence = req.files?.signature_agence?.[0]?.filename || null;

            // =========================
            // 2. COMPTE CAISSE
            // =========================
            const caisseResult = await client.query(
                `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`,
                [iduser]
            );

            if (caisseResult.rows.length === 0) {
                throw new Error('Compte caisse introuvable');
            }

            const compteCaisse = caisseResult.rows[0].comptecaisse;

            // =========================
            // 3. DEMANDE + MODE CALCUL
            // =========================
            const demandeResult = await client.query(
                `SELECT taux_interet, codemodecalcule 
                 FROM fina_credit_demande 
                 WHERE iddemande = $1`,
                [iddemande]
            );

            if (demandeResult.rows.length === 0) {
                throw new Error('Demande introuvable');
            }

            const { taux_interet, codemodecalcule } = demandeResult.rows[0];

            // =========================
            // 4. INSERT DECAISSEMENT
            // =========================
            await client.query(
                `INSERT INTO fina_credit_decaissement (
                    code_decaissement, dateoperation, iddemande, iduser, idclient,
                    montant_accorde, montant_decaisse, duree_mois, duree_grace, frequence,
                    taux_interet, codemodecalcule, idprod, comptecredit, modepaiement,
                    compteepargne, statut, signature_client, signature_agence, idagence
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, 'DECAISSE', $17, $18, $19
                )`,
                [
                    code_decaissement,
                    d,
                    iddemande,
                    iduser,
                    idclient,
                    montant_accorde || 0,
                    montant_decaisse,
                    duree_mois || 0,
                    duree_grace || 0,
                    frequence || 0,
                    taux_interet,
                    codemodecalcule,
                    idprod,
                    comptecredit,
                    modepaiement,
                    compteepargne,
                    signature_client,
                    signature_agence,
                    idagence
                ]
            );

            // =========================
            // 5. PARAMÈTRES AMORTISSEMENT
            // =========================
            const totalJours = (duree_mois || 0) * 30;

            const params = [
                montant_decaisse,
                taux_interet,
                totalJours,
                frequence,
                d,
                idagence,
                duree_grace,
                idclient,
                idclient.toString(),
                code_decaissement,
                comptecredit,
                compteepargne
            ];

            // =========================
            // 6. GENERATION TABLEAU
            // =========================
            if (codemodecalcule === 'DEG') {
                await client.query(
                    `SELECT public.fina_fn_generer_tableau_amortissement_degressif_jours($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
                    params
                );
            } 
            else if (codemodecalcule === 'LIN') {
                await client.query(
                    `SELECT public.fina_fn_generer_tableau_amortissement_jours($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
                    params
                );
            } 
            else {
                throw new Error("Mode de calcul inconnu : " + codemodecalcule);
            }

            // =========================
            // 7. MISE À JOUR STATUT (CORRIGÉ — Utilisation de $2)
            // =========================
            await client.query(
                `UPDATE fina_credit_demande 
                 SET statut = 'DECAISSE',
                     code_decaissement = $2
                 WHERE iddemande = $1`,
                [iddemande, code_decaissement]
            );

            // =========================
            // 8. ECRITURES COMPTABLES
            // =========================
            await passerEcriture(client, [
                code_decaissement,
                d,
                codjrnal,
                comptecredit,
                idclient,
                `MISE A DISPOSITION CREDIT - ${code_decaissement}`,
                montant_decaisse,
                0,
                iduser,
                d.getMonth() + 1,
                d.getFullYear(),
                code_decaissement,
                code_decaissement,
                idagence
            ]);

            await passerEcriture(client, [
                code_decaissement,
                d,
                codjrnal,
                compteepargne,
                idclient,
                `MISE A DISPOSITION CREDIT ${code_decaissement}`,
                0,
                montant_decaisse,
                iduser,
                d.getMonth() + 1,
                d.getFullYear(),
                code_decaissement,
                code_decaissement,
                idagence
            ]);

            // =========================
            // 9. COMMIT
            // =========================
            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Décaissement effectué avec succès',
                code: code_decaissement,
                mode: codemodecalcule
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("ERREUR SERVEUR:", error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        } finally {
            client.release();
        }
});
*/



// ==========================================
// 1. AJOUT DECAISSEMENT (POST)
// ==========================================
router.post(
    '/credit-decaissement-ajouter',
    upload.fields([
        { name: 'signature_client', maxCount: 1 },
        { name: 'signature_agence', maxCount: 1 }
    ]),
    async (req, res) => {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const {
                code_decaissement, dateoperation, iddemande, iduser, idclient,
                montant_accorde, montant_decaisse, duree_mois, duree_grace, frequence,
                idprod, comptecredit, modepaiement, compteepargne, idagence, codjrnal
            } = req.body;

            if (!code_decaissement || !iddemande || !iduser || !idclient || !montant_decaisse || !compteepargne || !idagence || !codjrnal) {
                return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
            }

            const d = new Date(dateoperation || new Date());
            const signature_client = req.files?.signature_client?.[0]?.filename || null;
            const signature_agence = req.files?.signature_agence?.[0]?.filename || null;

            // Récupération du code client pour la table
            const clientRes = await client.query(`SELECT codeclient FROM finaclient WHERE idclient = $1`, [idclient]);
            const codeclient = clientRes.rows[0]?.codeclient || null;

            // Récupération des infos de la demande
            const demandeResult = await client.query(
                `SELECT taux_interet, codemodecalcule FROM fina_credit_demande WHERE iddemande = $1`,
                [iddemande]
            );

            if (demandeResult.rows.length === 0) {
                throw new Error('Demande introuvable');
            }

            const { taux_interet, codemodecalcule } = demandeResult.rows[0];

            // Insertion dans fina_credit_decaissement (Le trigger génère les écritures comptables automatiquement via ref_piece)
            await client.query(
                `INSERT INTO fina_credit_decaissement (
                    code_decaissement, dateoperation, iddemande, iduser, idclient,
                    montant_accorde, montant_decaisse, duree_mois, duree_grace, frequence,
                    taux_interet, codemodecalcule, idprod, comptecredit, modepaiement,
                    compteepargne, statut, signature_client, signature_agence, idagence,
                    ref_piece, codjrnal, codeclient
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'DECAISSE', $17, $18, $19, $20, $21, $22)`,
                [
                    code_decaissement, d, iddemande, iduser, idclient,
                    montant_accorde || 0, montant_decaisse, duree_mois || 0, duree_grace || 0, frequence || 0,
                    taux_interet, codemodecalcule, idprod, comptecredit, modepaiement,
                    compteepargne, signature_client, signature_agence, idagence,
                    code_decaissement, codjrnal, codeclient
                ]
            );

            // Génération du tableau d'amortissement
            const totalJours = (duree_mois || 0) * 30;
            const params = [
                montant_decaisse, taux_interet, totalJours, frequence, d,
                idagence, duree_grace, idclient, idclient.toString(),
                code_decaissement, comptecredit, compteepargne
            ];

            if (codemodecalcule === 'DEG') {
                await client.query(`SELECT public.fina_fn_generer_tableau_amortissement_degressif_jours($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, params);
            } else if (codemodecalcule === 'LIN') {
                await client.query(`SELECT public.fina_fn_generer_tableau_amortissement_jours($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, params);
            } else {
                throw new Error("Mode de calcul inconnu : " + codemodecalcule);
            }

            // Mise à jour du statut de la demande
            await client.query(
                `UPDATE fina_credit_demande SET statut = 'DECAISSE', code_decaissement = $2 WHERE iddemande = $1`,
                [iddemande, code_decaissement]
            );

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Décaissement effectué et comptabilisé avec succès',
                code: code_decaissement,
                mode: codemodecalcule
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("ERREUR SERVEUR INSERTION:", error.message);
            res.status(500).json({ success: false, message: error.message });
        } finally {
            client.release();
        }
    }
);


// ==========================================
// 2. MISE A JOUR DECAISSEMENT (PUT)
// ==========================================
router.put(
    '/credit-decaissement/:iddecaissement',
    upload.fields([
        { name: 'signature_client', maxCount: 1 },
        { name: 'signature_agence', maxCount: 1 }
    ]),
    async (req, res) => {
        const client = await pool.connect();
        const { iddecaissement } = req.params;

        try {
            await client.query('BEGIN');

            const {
                code_decaissement, dateoperation, iddemande, iduser, idclient,
                montant_accorde, montant_decaisse, duree_mois, duree_grace, frequence,
                idprod, comptecredit, modepaiement, compteepargne, idagence, codjrnal
            } = req.body;

            if (!code_decaissement) {
                throw new Error("Le code décaissement (ref_piece) est obligatoire pour la mise à jour.");
            }

            // Récupération des anciens fichiers si absents
            const existing = await client.query(`SELECT signature_client, signature_agence FROM fina_credit_decaissement WHERE iddecaissement = $1`, [iddecaissement]);
            const oldFiles = existing.rows[0] || {};

            const signature_client = req.files?.signature_client?.[0]?.filename || oldFiles.signature_client;
            const signature_agence = req.files?.signature_agence?.[0]?.filename || oldFiles.signature_agence;
            const d = new Date(dateoperation || new Date());

            const clientRes = await client.query(`SELECT codeclient FROM finaclient WHERE idclient = $1`, [idclient]);
            const codeclient = clientRes.rows[0]?.codeclient || null;

            const query = `
                UPDATE fina_credit_decaissement SET
                    code_decaissement = $1, dateoperation = $2, iddemande = $3, iduser = $4, idclient = $5,
                    montant_accorde = $6, montant_decaisse = $7, duree_mois = $8, duree_grace = $9, frequence = $10,
                    comptecredit = $11, modepaiement = $12, compteepargne = $13, idagence = $14, codjrnal = $15,
                    ref_piece = $16, codeclient = $17, signature_client = $18, signature_agence = $19
                WHERE iddecaissement = $20
                RETURNING *`;

            const values = [
                code_decaissement, d, iddemande, iduser, idclient,
                montant_accorde || 0, montant_decaisse, duree_mois || 0, duree_grace || 0, frequence || 0,
                comptecredit, modepaiement, compteepargne, idagence, codjrnal,
                code_decaissement, codeclient, signature_client, signature_agence, iddecaissement
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error("Décaissement introuvable.");
            }

            await client.query('COMMIT');
            res.status(200).json({ success: true, message: 'Décaissement mis à jour avec succès', data: result.rows[0] });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error("ERREUR SERVEUR MISE A JOUR:", err.message);
            res.status(500).json({ success: false, message: err.message });
        } finally {
            client.release();
        }
    }
);


// ==========================================
// 3. SUPPRESSION DECAISSEMENT (DELETE)
// ==========================================
router.delete('/credit-decaissement/:iddecaissement', async (req, res) => {
    const client = await pool.connect();
    const { iddecaissement } = req.params;

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `DELETE FROM fina_credit_decaissement WHERE iddecaissement = $1 RETURNING *`,
            [iddecaissement]
        );

        if (result.rows.length === 0) {
            throw new Error("Décaissement introuvable.");
        }

        await client.query('COMMIT');
        res.status(200).json({
            success: true,
            message: "Décaissement et écritures comptables associées supprimés avec succès."
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERREUR SERVEUR SUPPRESSION:", err.message);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});





/**
 * Fonction utilitaire mise à jour avec 14 paramètres
 */
async function passerEcriture(client, params) {
    const query = `
        INSERT INTO TMVTTHEORIQUE (
            idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
            MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
            CODFACT, REFTIERS, idagence
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )`;
    return await client.query(query, params);
}








// ==========================================
// AFFICHER LES DECAISSEMENTS
// ==========================================
router.get('/credit-decaissement-afficher', async (req, res) => {
    try {
        const { statut } = req.query;

        let query = `
            SELECT *
            FROM fina_credit_decaissement
        `;

        let values = [];

        if (statut) {
            query += ` WHERE statut = $1 `;
            values.push(statut);
        }

        query += ` ORDER BY iddecaissement DESC`;

        const result = await pool.query(query, values);

        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ==========================================
// AFFICHER UN DECAISSEMENT PAR ID
// ==========================================
router.get('/credit-decaissement-afficher/:iddecaissement', async (req, res) => {
    try {
        const { iddecaissement } = req.params;

        const query = `
            SELECT *
            FROM fina_credit_decaissement
            WHERE iddecaissement = $1
        `;

        const result = await pool.query(query, [iddecaissement]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Décaissement introuvable'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ==========================================
// MODIFIER UN DECAISSEMENT
// ==========================================
router.put('/credit-decaissement-modifier/:iddecaissement', async (req, res) => {
    try {
        const { iddecaissement } = req.params;

        const {
            dateoperation,
            montant_accorde,
            montant_decaisse,
            duree_mois,
            duree_grace,
            frequence,
            taux_interet,
            idprod,
            comptecredit,
            modepaiement,
            compteepargne
        } = req.body;

        const query = `
            UPDATE fina_credit_decaissement
            SET
                dateoperation = $1,
                montant_accorde = $2,
                montant_decaisse = $3,
                duree_mois = $4,
                duree_grace = $5,
                frequence = $6,
                taux_interet = $7,
                idprod = $8,
                comptecredit = $9,
                modepaiement = $10,
                compteepargne = $11,
                updated_at = CURRENT_TIMESTAMP
            WHERE iddecaissement = $12
            RETURNING *
        `;

        const values = [
            dateoperation,
            montant_accorde,
            montant_decaisse,
            duree_mois,
            duree_grace,
            frequence,
            taux_interet,
            idprod,
            comptecredit,
            modepaiement,
            compteepargne,
            iddecaissement
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Décaissement introuvable'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Décaissement modifié avec succès',
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ==========================================
// ANNULER UN DECAISSEMENT
// ==========================================
router.put('/credit-decaissement-annuler/:iddecaissement', async (req, res) => {
    try {
        const { iddecaissement } = req.params;

        const query = `
            UPDATE fina_credit_decaissement
            SET
                statut = 'ANNULE',
                updated_at = CURRENT_TIMESTAMP
            WHERE iddecaissement = $1
            RETURNING *
        `;

        const result = await pool.query(query, [iddecaissement]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Décaissement introuvable'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Décaissement annulé avec succès',
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


module.exports = router;