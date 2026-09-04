const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ==========================================
// CONFIGURATION MULTER (SIGNATURES ET PIECES)
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/finance/demandes/signatures');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}_${unique}.png`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedFields = ['signatureproducteur', 'signatureagent', 'photo_piece_recto', 'photo_piece_verso'];
    if (allowedFields.includes(file.fieldname)) {
        return cb(null, true);
    }

    const allowed = /jpg|jpeg|png/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = /image\/(jpeg|png)/.test(file.mimetype);
    
    if (ext && mime) {
        cb(null, true);
    } else {
        cb(new Error('Format non autorisé. Utilisez PNG ou JPEG.'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
    { name: 'signatureproducteur', maxCount: 1 },
    { name: 'signatureagent', maxCount: 1 },
    { name: 'photo_piece_recto', maxCount: 1 },
    { name: 'photo_piece_verso', maxCount: 1 }
]);

// ==========================================
// DETAIL D'UN FOURNISSEUR PAR ID
// ==========================================
router.get('/gfournisseur/detail/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('SELECT * FROM gfournisseur WHERE idfourn = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Fournisseur non trouvé" });
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// RESOLUTION DES COMPTES COMPTABLES
// ==========================================



router.get('/resolve_comptes_demande', async (req, res) => {
    const { idprod, idfourn } = req.query;

    if (!idprod || !idfourn) {
        return res.status(400).json({ success: false, message: "idprod et idfourn sont requis." });
    }

    // Récupération d'un client du pool pour gérer la transaction
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Récupération des informations du fournisseur
        const fournRes = await client.query(`
            SELECT compteauxiliaire, codefournisseurs, codeagence, nomcomplet, idagence 
            FROM public.gfournisseur 
            WHERE idfourn = $1
        `, [idfourn]);

        if (fournRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "Fournisseur introuvable." });
        }

        const { 
            compteauxiliaire, 
            codefournisseurs, 
            codeagence, 
            nomcomplet, 
            idagence 
        } = fournRes.rows[0];

        // 2. Récupération du compte général du produit financier
        const prodRes = await client.query(`
            SELECT comptegeneral 
            FROM public.agro_produit_finance 
            WHERE idprod = $1
        `, [idprod]);

        if (prodRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "Produit financier introuvable." });
        }

        const comptegeneral = prodRes.rows[0].comptegeneral;

        // 3. Vérification de l'existence du compte d'avance dans tcomptegeninter
        const avanceRes = await client.query(`
            SELECT idcptintern 
            FROM public.tcomptegeninter 
            WHERE idcptgen = $1 AND idtiers = $2
        `, [comptegeneral, idfourn]);

        let compteavance = null;

        if (avanceRes.rows.length > 0) {
            // Le compte existe déjà
            compteavance = avanceRes.rows[0].idcptintern;
        } else {
           
            const cleanCompteGen = (comptegeneral || '').trim();
            const cleanCodeAgence = (codeagence || '').trim();
            const cleanCodeFourn = (codefournisseurs || '').trim();

           
            const idcptintern = `${cleanCompteGen}${cleanCodeFourn}`;
            
           
            const designationcptint = `AVANCE ${nomcomplet}`.trim();
            const idclasse = cleanCompteGen ? cleanCompteGen.charAt(0) : null;

           
            const insertRes = await client.query(`
                INSERT INTO public.tcomptegeninter (
                    idcptintern, date, idcptgen, designationcptint, idclasse, 
                    codetiers, nomtiers, idagence, codeagence, idprod, idtiers, source
                ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'AGRO')
                ON CONFLICT (idcptintern) 
                DO UPDATE SET idtiers = EXCLUDED.idtiers, idprod = EXCLUDED.idprod
                RETURNING idcptintern
            `, [
                idcptintern,
                cleanCompteGen,
                designationcptint,
                idclasse,
                cleanCodeFourn,
                nomcomplet,
                idagence,
                cleanCodeAgence,
                idprod,
                idfourn
            ]);

            compteavance = insertRes.rows[0].idcptintern;
        }

        // Validation de la transaction
        await client.query('COMMIT');

        res.json({
            success: true,
            comptefournisseur: compteauxiliaire || null,
            compteavance
        });

    } catch (error) {
        // Annulation des changements en cas d'erreur
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: error.message });
    } finally {
        // Libération du client pour le remettre dans le pool
        client.release();
    }
});



router.get('/resolve_comptes_demande22', async (req, res) => {
    const { idprod, idfourn } = req.query;

    if (!idprod || !idfourn) {
        return res.status(400).json({ success: false, message: "idprod et idfourn sont requis." });
    }

    try {
        const fournRes = await pool.query('SELECT compteauxiliaire FROM gfournisseur WHERE idfourn = $1', [idfourn]);
        const comptefournisseur = fournRes.rows[0]?.compteauxiliaire || null;

        const avanceRes = await pool.query(`
            SELECT idcptintern FROM tcomptegeninter 
            WHERE idcptgen = (SELECT comptegeneral FROM agro_produit_finance WHERE idprod = $1) 
              AND idtiers = $2
        `, [idprod, idfourn]);
        const compteavance = avanceRes.rows[0]?.idcptintern || null;

        res.json({
            success: true,
            comptefournisseur,
            compteavance
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// 1. AJOUTER UNE DEMANDE
// ==========================================
router.post('/ajouterdemandeagro', upload, async (req, res) => {
    try {
        const {
            codedemandefinancement, idcampagne, idcooperative, idfourn, idagence, iduser, datedemande, objet,
            montantdemande, montantaccord, montantrembourse, idmois, idannee, statut,
            idprod, taux_interet, dureetotal, echeance, idmodepaiements, paiementsduree, avoircaution,
            total_interet, comptefournisseur, compteavance
        } = req.body;

        const files = req.files || {};
        const sigProd = files.signatureproducteur?.[0]?.filename || null;
        const sigAgent = files.signatureagent?.[0]?.filename || null;
        const photoRecto = files.photo_piece_recto?.[0]?.filename 
            ? `uploads/finance/demandes/signatures/${files.photo_piece_recto[0].filename}` 
            : null;
        const photoVerso = files.photo_piece_verso?.[0]?.filename 
            ? `uploads/finance/demandes/signatures/${files.photo_piece_verso[0].filename}` 
            : null;

        const query = `
            INSERT INTO agro_demande_financement (
                codedemandefinancement, idcampagne, idcooperative, idfourn, idagence, iduser, datedemande, objet, 
                montantdemande, montantaccord, montantrembourse, signatureproducteur, signatureagent, idmois, idannee, statut,
                idprod, taux_interet, dureetotal, echeance, idmodepaiements, paiementsduree, avoircaution,
                total_interet, comptefournisseur, compteavance, photo_piece_recto, photo_piece_verso
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
            ) RETURNING *;
        `;
        
        const result = await pool.query(query, [
            codedemandefinancement, idcampagne, idcooperative, idfourn, idagence, iduser, datedemande, objet, 
            montantdemande, montantaccord, montantrembourse, sigProd, sigAgent, idmois, idannee, statut,
            idprod || null, taux_interet || 0, dureetotal || 1, echeance || 0, idmodepaiements || null,
            paiementsduree || 1, avoircaution || 0, total_interet || 0, comptefournisseur, compteavance,
            photoRecto, photoVerso
        ]);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 2. MODIFIER UNE DEMANDE
// ==========================================
router.put('/modifierdemandeagro/:iddemandefinancement', upload, async (req, res) => {
    try {
        const { iddemandefinancement } = req.params;
        const {
            objet, montantdemande, montantaccord, montantrembourse, statut,
            idprod, taux_interet, dureetotal, echeance, idmodepaiements, paiementsduree, avoircaution,
            total_interet, comptefournisseur, compteavance
        } = req.body;

        const files = req.files || {};

        const oldData = await pool.query(
            'SELECT signatureproducteur, signatureagent, photo_piece_recto, photo_piece_verso FROM agro_demande_financement WHERE iddemandefinancement=$1',
            [iddemandefinancement]
        );
        
        if (oldData.rowCount === 0) return res.status(404).json({ success: false, message: "Demande introuvable" });

        const sigProd = files.signatureproducteur?.[0]?.filename || oldData.rows[0]?.signatureproducteur;
        const sigAgent = files.signatureagent?.[0]?.filename || oldData.rows[0]?.signatureagent;
        
        // Conservation de l'ancienne pièce si aucune nouvelle n'est capturée
        const photoRecto = files.photo_piece_recto?.[0]?.filename 
            ? `uploads/finance/demandes/signatures/${files.photo_piece_recto[0].filename}` 
            : oldData.rows[0]?.photo_piece_recto;
        const photoVerso = files.photo_piece_verso?.[0]?.filename 
            ? `uploads/finance/demandes/signatures/${files.photo_piece_verso[0].filename}` 
            : oldData.rows[0]?.photo_piece_verso;

        const query = `
            UPDATE agro_demande_financement
            SET objet=$1, montantdemande=$2, montantaccord=$3, montantrembourse=$4, statut=$5, 
                signatureproducteur=$6, signatureagent=$7, idprod=$8, taux_interet=$9, dureetotal=$10,
                echeance=$11, idmodepaiements=$12, paiementsduree=$13, avoircaution=$14, total_interet=$15,
                comptefournisseur=$16, compteavance=$17, photo_piece_recto=$18, photo_piece_verso=$19
            WHERE iddemandefinancement=$20 RETURNING *;
        `;

        const result = await pool.query(query, [
            objet, montantdemande, montantaccord, montantrembourse, statut,
            sigProd, sigAgent, idprod || null, taux_interet || 0, dureetotal || 1,
            echeance || 0, idmodepaiements || null, paiementsduree || 1, avoircaution || 0, total_interet || 0,
            comptefournisseur, compteavance, photoRecto, photoVerso, iddemandefinancement
        ]);
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});




// ==========================================
// MODIFIER LE STATUT D'UNE DEMANDE
// ==========================================
// ==========================================
// MODIFIER LE STATUT ET LE MONTANT ACCORDE
// ==========================================


// ==========================================
// MODIFIER LE STATUT ET LE DESCRIPTIF DE L'ACCORD DE FINANCEMENT
// ==========================================
router.put('/modifierstatutdemandefinancement/:iddemandefinancement', async (req, res) => {
    try {
        const { iddemandefinancement } = req.params;

        const {
            statut,
            montantaccord,
            taux_interet,
            dureetotal,
            echeance,
            idmodepaiements,
            paiementsduree,
            avoircaution,
            total_interet
        } = req.body;

        const query = `
            UPDATE agro_demande_financement
            SET
                statut = $1,
                montantaccord = $2,
                taux_interet = $3,
                dureetotal = $4,
                echeance = $5,
                idmodepaiements = $6,
                paiementsduree = $7,
                avoircaution = $8,
                total_interet = $9,
                date_creation = CURRENT_TIMESTAMP
            WHERE iddemandefinancement = $10
            RETURNING *;
        `;

        const values = [
            statut,
            montantaccord || 0,
            taux_interet || 0,
            dureetotal || 1,
            echeance || 0,
            idmodepaiements || null,
            paiementsduree || 1,
            avoircaution || 0,
            total_interet || 0,
            iddemandefinancement
        ];

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Demande introuvable"
            });
        }

        res.json({
            success: true,
            message: "Mise à jour de l'accord effectuée avec succès",
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
// 3. LISTER LES DEMANDES (CORRIGÉ AVEC df.*)
// ==========================================
router.get('/listedenandesagro', async (req, res) => {
    try {
        const { idcampagne, idcooperative, idfourn } = req.query;
        let query = `SELECT * FROM agro_demande_financement WHERE 1=1`;
        let values = [];
        let i = 1;

        if (idcampagne) { query += ` AND idcampagne = $${i++}`; values.push(idcampagne); }
        if (idcooperative) { query += ` AND idcooperative = $${i++}`; values.push(idcooperative); }
        if (idfourn) { query += ` AND idfourn = $${i++}`; values.push(idfourn); }

        query += ` ORDER BY datedemande DESC`;
        
        const result = await pool.query(query, values);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/listedenandesencoursagro', async (req, res) => {
    try {
        const { idcampagne } = req.query;
        const query = `
            SELECT fc.raisonsociale, fc.siege, gf.nomcomplet, df.*
            FROM agro_demande_financement df
            INNER JOIN fina_cooperative fc ON fc.idcooperative = df.idcooperative
            INNER JOIN gfournisseur gf ON gf.idfourn = df.idfourn
            WHERE statut='ENCOURS' AND df.idcampagne = $1
            ORDER BY df.datedemande DESC
        `;
        const result = await pool.query(query, [idcampagne]);
        res.json({ success: true, total: result.rowCount, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/listedenandesaccorderagro', async (req, res) => {
    try {
        const { idcampagne } = req.query;
        const query = `
            SELECT fc.raisonsociale, fc.siege, gf.nomcomplet, df.*
            FROM agro_demande_financement df
            INNER JOIN fina_cooperative fc ON fc.idcooperative = df.idcooperative
            INNER JOIN gfournisseur gf ON gf.idfourn = df.idfourn
            WHERE statut='ACCORDER' AND df.idcampagne = $1
            ORDER BY df.datedemande DESC
        `;
        const result = await pool.query(query, [idcampagne]);
        res.json({ success: true, total: result.rowCount, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});





router.get('/listedenandesdecaisseagro', async (req, res) => {
    try {
        // Extraction des paramètres de la requête
        const { idcampagne, idcooperative, idfourn } = req.query;

        // Validation basique
        if (!idcampagne || !idcooperative || !idfourn) {
            return res.status(400).json({ 
                success: false, 
                message: "Les paramètres idcampagne, idcooperative et idfourn sont requis." 
            });
        }

        const query = `
            SELECT
                fc.raisonsociale,
                fc.siege,
                gf.nomcomplet,
                df.iddemandefinancement,
                df.codedecaissementfinancement,
                df.iddecaissementfinancement,
                df.idcampagne,
                df.idcooperative,
                df.idfourn,
                df.idagence,
                df.iduser,
                df.datedecaissement,
                df.objet,
                df.montantdemande,
                df.montantaccord,
                df.montantrembourse,
                df.solde,
                df.etatcredit,
                df.signatureproducteur,
                df.signatureagent,
                df.idmois,
                df.idannee,
                df.statut,
                df.date_creation,
                df.solde_interet,
                df.taux_interet
            FROM agro_decaissement_financement df
            INNER JOIN fina_cooperative fc ON fc.idcooperative = df.idcooperative
            INNER JOIN gfournisseur gf ON gf.idfourn = df.idfourn
            WHERE df.etatcredit = 'ENCOURS' 
              AND df.idcampagne = $1 
              AND df.idcooperative = $2 
              AND df.idfourn = $3
            ORDER BY df.datedecaissement DESC
        `;

        // Les variables sont maintenant liées aux $1, $2, $3
        const values = [idcampagne, idcooperative, idfourn];
        const result = await pool.query(query, values);

        res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur lors de la récupération:', error);
        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur lors de la récupération des données."
        });
    }
});






///  RAPPORT


router.get('/listedenandesaccorderagroentredeuxdate', async (req, res) => {
    try {
        // Récupération des paramètres
        const { idagence, dateDebut, dateFin, etatcredit, statut } = req.query;

        // Base de la requête
        let query = `
            SELECT 
                fc.raisonsociale, fc.siege, gf.nomcomplet,
                df.*
            FROM agro_demande_financement df
            INNER JOIN fina_cooperative fc ON fc.idcooperative = df.idcooperative
            INNER JOIN gfournisseur gf ON gf.idfourn = df.idfourn
            WHERE df.idagence = $1 
            AND df.datedemande BETWEEN $2 AND $3
        `;

        // Tableau pour les valeurs préparées
        const values = [idagence, dateDebut, dateFin];
        let paramIndex = 4;

        // Ajout dynamique du filtre sur l'état du crédit
        if (etatcredit) {
            query += ` AND df.etatcredit = $${paramIndex}`;
            values.push(etatcredit);
            paramIndex++;
        }

        // Ajout dynamique du filtre sur le statut
        if (statut) {
            query += ` AND df.statut = $${paramIndex}`;
            values.push(statut);
            paramIndex++;
        }

        // Tri final
        query += ` ORDER BY df.datedemande DESC`;

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



router.get('/listedenandesaccorderagroentredeuxdate1', async (req, res) => {
    try {
        const { idagence, dateDebut, dateFin, etatcredit, statut } = req.query;

        let query = `
            SELECT 
                fc.raisonsociale, fc.siege, gf.nomcomplet,
                c.designation AS campagne_nom,
                df.*
            FROM agro_demande_financement df
            INNER JOIN fina_cooperative fc ON fc.idcooperative = df.idcooperative
            INNER JOIN gfournisseur gf ON gf.idfourn = df.idfourn
            LEFT JOIN agro_campagne c ON c.idcampagne = df.idcampagne
            WHERE df.idagence = $1 
            AND df.datedemande BETWEEN $2 AND $3
        `;

        const values = [idagence, dateDebut, dateFin];
        let paramIndex = 4;

        if (etatcredit) {
            query += ` AND df.etatcredit = $${paramIndex}`;
            values.push(etatcredit);
            paramIndex++;
        }

        if (statut) {
            query += ` AND df.statut = $${paramIndex}`;
            values.push(statut);
            paramIndex++;
        }

        query += ` ORDER BY c.designation ASC, fc.raisonsociale ASC, gf.nomcomplet ASC`;

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


// 1. Définition du stockage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/finance/demandes/signatures');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}_${unique}.png`);
    }
});

// 2. Définition du filtre
const fileFilter = (req, file, cb) => {
    // Autoriser explicitement les champs signature
    if (file.fieldname === 'signatureproducteur' || file.fieldname === 'signatureagent') {
        return cb(null, true);
    }

    // Vérification classique pour les autres types de fichiers
    const allowed = /jpg|jpeg|png/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = /image\/(jpeg|png)/.test(file.mimetype);
    
    if (ext && mime) {
        cb(null, true);
    } else {
        cb(new Error('Format non autorisé. Utilisez PNG ou JPEG.'));
    }
};

// 3. Initialisation de l'instance multer avec config et définition des champs
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
    { name: 'signatureproducteur', maxCount: 1 },
    { name: 'signatureagent', maxCount: 1 }
]);

// ==========================================
// 1. AJOUTER UNE DEMANDE
// ==========================================
router.post('/ajouterdemandeagro', upload, async (req, res) => {
    try {
        const { codedemandefinancement, idcampagne, idcooperative, idfourn, idagence, iduser, datedemande, objet, montantdemande, montantaccord, montantrembourse, idmois, idannee, statut } = req.body;
        const files = req.files || {};
        const sigProd = files.signatureproducteur?.[0]?.filename || null;
        const sigAgent = files.signatureagent?.[0]?.filename || null;

        const query = `
            INSERT INTO agro_demande_financement (
                codedemandefinancement, idcampagne, idcooperative, idfourn, idagence, iduser, datedemande, objet, 
                montantdemande, montantaccord, montantrembourse, signatureproducteur, signatureagent, idmois, idannee, statut
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *;
        `;
        
        const result = await pool.query(query, [codedemandefinancement, idcampagne, idcooperative, idfourn, idagence, iduser, datedemande, objet, montantdemande, montantaccord, montantrembourse, sigProd, sigAgent, idmois, idannee, statut]);
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 2. MODIFIER UNE DEMANDE
// ==========================================
router.put('/modifierdemandeagro/:iddemandefinancement', upload, async (req, res) => {
    try {
        const { iddemandefinancement } = req.params;
        const { objet, montantdemande, montantaccord, montantrembourse, statut } = req.body;
        const files = req.files || {};

        // Récupérer l'ancienne ligne pour garder les signatures si aucune nouvelle n'est envoyée
        const oldData = await pool.query('SELECT signatureproducteur, signatureagent FROM agro_demande_financement WHERE iddemandefinancement=$1', [iddemandefinancement]);
        
        const sigProd = files.signatureproducteur?.[0]?.filename || oldData.rows[0]?.signatureproducteur;
        const sigAgent = files.signatureagent?.[0]?.filename || oldData.rows[0]?.signatureagent;

        const query = `
            UPDATE agro_demande_financement
            SET objet=$1, montantdemande=$2, montantaccord=$3, montantrembourse=$4, statut=$5, 
                signatureproducteur=$6, signatureagent=$7
            WHERE iddemandefinancement=$8 RETURNING *;
        `;

        const result = await pool.query(query, [objet, montantdemande, montantaccord, montantrembourse, statut, sigProd, sigAgent, iddemandefinancement]);
        
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Demande introuvable" });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 3. LISTER LES DEMANDES
// ==========================================
router.get('/listedenandesagro', async (req, res) => {
    try {
        const { idcampagne, idcooperative, idfourn } = req.query;
        let query = `SELECT * FROM agro_demande_financement WHERE 1=1`;
        let values = [];
        let i = 1;

        if (idcampagne) { query += ` AND idcampagne = $${i++}`; values.push(idcampagne); }
        if (idcooperative) { query += ` AND idcooperative = $${i++}`; values.push(idcooperative); }
        if (idfourn) { query += ` AND idfourn = $${i++}`; values.push(idfourn); }

        query += ` ORDER BY datedemande DESC`;
        
        const result = await pool.query(query, values);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


router.get('/listedenandesencoursagro', async (req, res) => {
    try {

        const { idcampagne } = req.query;

        const query = `
            SELECT
                fc.raisonsociale,
                fc.siege,
                gf.nomcomplet,
                df.iddemandefinancement,
                df.codedemandefinancement,
                df.idcampagne,
                df.idcooperative,
                df.idfourn,
                df.idagence,
                df.iduser,
                df.datedemande,
                df.objet,
                df.montantdemande,
                df.montantaccord,
                df.montantrembourse,
                df.solde,
                df.etatcredit,
                df.signatureproducteur,
                df.signatureagent,
                df.idmois,
                df.idannee,
                df.statut,
                df.date_creation
            FROM agro_demande_financement df
            INNER JOIN fina_cooperative fc
                ON fc.idcooperative = df.idcooperative
            INNER JOIN gfournisseur gf
                ON gf.idfourn = df.idfourn
            WHERE  statut='ENCOURS'  and  df.idcampagne = $1
            ORDER BY df.datedemande DESC
        `;

        const values = [idcampagne];

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






router.get('/listedenandesaccorderagro', async (req, res) => {
    try {

        const { idcampagne } = req.query;

        const query = `
            SELECT
                fc.raisonsociale,
                fc.siege,
                gf.nomcomplet,
                df.iddemandefinancement,
                df.codedemandefinancement,
                df.idcampagne,
                df.idcooperative,
                df.idfourn,
                df.idagence,
                df.iduser,
                df.datedemande,
                df.objet,
                df.montantdemande,
                df.montantaccord,
                df.montantrembourse,
                df.solde,
                df.etatcredit,
                df.signatureproducteur,
                df.signatureagent,
                df.idmois,
                df.idannee,
                df.statut,
                df.date_creation
            FROM agro_demande_financement df
            INNER JOIN fina_cooperative fc
                ON fc.idcooperative = df.idcooperative
            INNER JOIN gfournisseur gf
                ON gf.idfourn = df.idfourn
            WHERE  statut='ACCORDER'  and  df.idcampagne = $1
            ORDER BY df.datedemande DESC
        `;

        const values = [idcampagne];

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







router.get('/listedenandesdecaisseagro', async (req, res) => {
    try {
        // Extraction des paramètres de la requête
        const { idcampagne, idcooperative, idfourn } = req.query;

        // Validation basique
        if (!idcampagne || !idcooperative || !idfourn) {
            return res.status(400).json({ 
                success: false, 
                message: "Les paramètres idcampagne, idcooperative et idfourn sont requis." 
            });
        }

        const query = `
            SELECT
                fc.raisonsociale,
                fc.siege,
                gf.nomcomplet,
                df.iddemandefinancement,
                df.codedecaissementfinancement,
                df.iddecaissementfinancement,
                df.idcampagne,
                df.idcooperative,
                df.idfourn,
                df.idagence,
                df.iduser,
                df.datedecaissement,
                df.objet,
                df.montantdemande,
                df.montantaccord,
                df.montantrembourse,
                df.solde,
                df.etatcredit,
                df.signatureproducteur,
                df.signatureagent,
                df.idmois,
                df.idannee,
                df.statut,
                df.date_creation
            FROM agro_decaissement_financement df
            INNER JOIN fina_cooperative fc ON fc.idcooperative = df.idcooperative
            INNER JOIN gfournisseur gf ON gf.idfourn = df.idfourn
            WHERE df.etatcredit = 'ENCOURS' 
              AND df.idcampagne = $1 
              AND df.idcooperative = $2 
              AND df.idfourn = $3
            ORDER BY df.datedecaissement DESC
        `;

        // Les variables sont maintenant liées aux $1, $2, $3
        const values = [idcampagne, idcooperative, idfourn];
        const result = await pool.query(query, values);

        res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur lors de la récupération:', error);
        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur lors de la récupération des données."
        });
    }
});

// ==========================================
// MODIFIER LE STATUT D'UNE DEMANDE
// ==========================================
// ==========================================
// MODIFIER LE STATUT ET LE MONTANT ACCORDE
// ==========================================
router.put('/modifierstatutdemandefinancement/:iddemandefinancement', async (req, res) => {

    try {

        const { iddemandefinancement } = req.params;

        const {
            statut,
            montantaccord
        } = req.body;

        const query = `
            UPDATE agro_demande_financement
            SET
                statut = $1,
                montantaccord = $2
            WHERE iddemandefinancement = $3
            RETURNING *;
        `;

        const values = [
            statut,
            montantaccord,
            iddemandefinancement
        ];

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Demande introuvable"
            });
        }

        res.json({
            success: true,
            message: "Mise à jour effectuée avec succès",
            data: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

});



///  RAPPORT


router.get('/listedenandesaccorderagroentredeuxdate', async (req, res) => {
    try {
        // Récupération des paramètres
        const { idagence, dateDebut, dateFin, etatcredit, statut } = req.query;

        // Base de la requête
        let query = `
            SELECT 
                fc.raisonsociale, fc.siege, gf.nomcomplet,
                df.*
            FROM agro_demande_financement df
            INNER JOIN fina_cooperative fc ON fc.idcooperative = df.idcooperative
            INNER JOIN gfournisseur gf ON gf.idfourn = df.idfourn
            WHERE df.idagence = $1 
            AND df.datedemande BETWEEN $2 AND $3
        `;

        // Tableau pour les valeurs préparées
        const values = [idagence, dateDebut, dateFin];
        let paramIndex = 4;

        // Ajout dynamique du filtre sur l'état du crédit
        if (etatcredit) {
            query += ` AND df.etatcredit = $${paramIndex}`;
            values.push(etatcredit);
            paramIndex++;
        }

        // Ajout dynamique du filtre sur le statut
        if (statut) {
            query += ` AND df.statut = $${paramIndex}`;
            values.push(statut);
            paramIndex++;
        }

        // Tri final
        query += ` ORDER BY df.datedemande DESC`;

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
*/