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
        const dir = path.join(__dirname, '../uploads/finance/decaissement/signatures');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}_${unique}.png`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'signatureproducteur' || file.fieldname === 'signatureagent') {
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
    { name: 'signatureagent', maxCount: 1 }
]);

// ==========================================
// 1. AJOUTER UN DECAISSEMENT
// ==========================================
router.post('/ajouterdecaissementagro', upload, async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            iddemandefinancement,
            codedecaissementfinancement,
            idcampagne,
            idcooperative,
            idfourn,
            idagence,
            iduser,
            datedecaissement,
            objet,
            montantdemande,
            montantaccord,
            montantrembourse,
            idmois,
            idannee,
            statut,
            // Nouveaux champs récupérés de la demande d'origine
            idprod,
            taux_interet,
            dureetotal,
            echeance,
            idmodepaiements,
            paiementsduree,
            avoircaution,
            total_interet,
            comptefournisseur,
            compteavance
        } = req.body;

        const files = req.files || {};
        const sigProd = files.signatureproducteur?.[0]?.filename || null;
        const sigAgent = files.signatureagent?.[0]?.filename || null;

        await client.query('BEGIN');

        // 1. Récupération des pièces justificatives recto/verso de la demande initiale
        const demandRes = await client.query(
            `SELECT photo_piece_recto, photo_piece_verso, comptefournisseur, compteavance 
             FROM agro_demande_financement 
             WHERE iddemandefinancement = $1`,
            [iddemandefinancement]
        );
        const originalDemand = demandRes.rows[0] || {};
        const pieceRecto = originalDemand.photo_piece_recto || null;
        const pieceVerso = originalDemand.photo_piece_verso || null;

        // 2. Vérification préalable de la caisse de l'utilisateur
        const caisseResult = await client.query(
            `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`,
            [iduser]
        );
        if (caisseResult.rows.length === 0) {
            throw new Error('Compte caisse introuvable pour cet utilisateur.');
        }

        // 3. Vérification préalable du compte fournisseur
        const comptefournisseurResult = await client.query(
            `SELECT compteauxiliaire FROM gfournisseur WHERE idfourn = $1`,
            [idfourn]
        );
        if (comptefournisseurResult.rows.length === 0) {
            throw new Error('Compte auxiliaire introuvable pour ce fournisseur.');
        }

        // 4. Mise à jour du statut de la demande de financement
        await client.query(
            `UPDATE agro_demande_financement 
             SET statut = 'DECAISSE',
                 code_decaissement = $2
             WHERE iddemandefinancement = $1`,
            [iddemandefinancement, codedecaissementfinancement]
        );

        // 5. Insertion du décaissement avec l'ensemble des colonnes clonées
        const query = `
            INSERT INTO agro_decaissement_financement (
                codedecaissementfinancement, iddemandefinancement, idcampagne, idcooperative, 
                idfourn, idagence, iduser, datedecaissement, objet, montantdemande, 
                montantaccord, montantrembourse, signatureproducteur, signatureagent, 
                idmois, idannee, statut,
                idprod, taux_interet, dureetotal, echeance, idmodepaiements, paiementsduree,
                avoircaution, total_interet, comptefournisseur, compteavance, photo_piece_recto, photo_piece_verso
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
            ) 
            RETURNING *;
        `;

        const result = await client.query(query, [
            codedecaissementfinancement,
            iddemandefinancement,
            idcampagne,
            idcooperative,
            idfourn,
            idagence,
            iduser,
            datedecaissement || new Date(),
            objet,
            montantdemande,
            montantaccord,
            montantrembourse,
            sigProd,
            sigAgent,
            idmois,
            idannee,
            statut,
            idprod || null,
            taux_interet || 0,
            dureetotal || 1,
            echeance || 0,
            idmodepaiements || null,
            paiementsduree || 1,
            avoircaution || 0,
            total_interet || 0,
            comptefournisseur || originalDemand.comptefournisseur,
            compteavance || originalDemand.compteavance,
            pieceRecto,
            pieceVerso
        ]);

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});






// ==========================================
// 2. RÉCUPÉRER LES DÉCAISSEMENTS "ENCOURS"
// ==========================================
router.get('/agro_decaissement_financement', async (req, res) => {
    try {
        const { idagence } = req.query;
        if (!idagence) {
            return res.status(400).json({ success: false, message: "idagence est requis" });
        }

        const query = `
            SELECT df.codedecaissementfinancement, df.comptefournisseur, gf.nomcomplet, df.montantaccord 
            FROM agro_decaissement_financement df
            INNER JOIN public.gfournisseur gf ON df.idfourn = gf.idfourn
            WHERE df.idagence = $1 AND df.etatfond = 'ENCOURS'
        `;

        const result = await pool.query(query, [idagence]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Erreur GET decaissement financement:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 3. VALIDER LE RETRAIT ET METTRE À JOUR À 'RETIRE'
// ==========================================
router.put('/agro_decaissement_financement/retirer/:code', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { code } = req.params;
        const { iduser, comptecaisse, montant, comptefournisseur } = req.body;

        // Ici, vous pouvez ajouter l'écriture comptable / mouvement de caisse si nécessaire
        // Exemple : Insertion dans le journal de caisse en utilisant comptecaisse et comptefournisseur

        // Mise à jour de l'état du fond à 'RETIRE'
        const updateQuery = `
            UPDATE agro_decaissement_financement 
            SET etatfond = 'RETIRE' 
            WHERE codedecaissementfinancement = $1
        `;
        await client.query(updateQuery, [code]);

        await client.query('COMMIT');
        res.json({ success: true, message: "Décaissement validé et marqué comme retiré avec succès." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur validation décaissement:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});




// ==========================================
// 4. ANNULER UN DÉCAISSEMENT (Si aucun remboursement & etatfond = 'ENCOURS')
// ==========================================


// ==========================================
// RÉCUPÉRER LES DÉCAISSEMENTS "ENCOURS" GROUPÉS PAR COOPÉRATIVE ET FOURNISSEUR
// ==========================================
router.get('/agro_decaissements_par_cooperative', async (req, res) => {
    try {
        const { idagence } = req.query;
        if (!idagence) {
            return res.status(400).json({ success: false, message: "idagence est requis" });
        }

        const query = `
            SELECT 
                df.iddecaissementfinancement,
                df.codedecaissementfinancement,
                df.comptefournisseur,
                df.montantaccord,
                df.etatfond,
                c.idcooperative,
                c.codecooperative,
                c.raisonsociale AS cooperativenom,
                f.idfourn,
                f.codefournisseurs,
                f.nomcomplet AS fournisseurspremiernom
            FROM agro_decaissement_financement df
            INNER JOIN public.fina_cooperative c ON df.idcooperative = c.idcooperative
            INNER JOIN public.gfournisseur f ON df.idfourn = f.idfourn
            WHERE df.idagence = $1 AND df.etatfond = 'ENCOURS'
            ORDER BY c.raisonsociale, f.nomcomplet, df.datedecaissement DESC;
        `;

        const result = await pool.query(query, [idagence]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Erreur GET decaissements par cooperative:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});


router.delete('/agro_decaissement_financement/annuler/:iddecaissementfinancement', async (req, res) => {
    const { iddecaissementfinancement } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Vérifier si le décaissement existe et si son etatfond est bien 'ENCOURS'
        const decaissementResult = await client.query(
            `SELECT * FROM agro_decaissement_financement WHERE iddecaissementfinancement = $1`,
            [iddecaissementfinancement]
        );

        if (decaissementResult.rows.length === 0) {
            throw new Error('Décaissement introuvable.');
        }

        const decaissement = decaissementResult.rows[0];

        if (decaissement.etatfond !== 'ENCOURS') {
            throw new Error(`Impossible d'annuler ce décaissement car son état de fond est '${decaissement.etatfond}' (doit être 'ENCOURS').`);
        }

        // 2. Vérifier si des remboursements existent pour ce décaissement
        const remboursementResult = await client.query(
            `SELECT COUNT(*) AS total FROM agro_remboursement WHERE iddecaissementfinancement = $1`,
            [iddecaissementfinancement]
        );

        const nbRemboursements = parseInt(remboursementResult.rows[0].total, 10);
        if (nbRemboursements > 0) {
            throw new Error('Impossible d\'annuler ce décaissement car un ou plusieurs remboursements y sont rattachés.');
        }

        const iddemandefinancement = decaissement.iddemandefinancement;

        // 3. Remettre la demande de financement initiale à son état précédent (ex: 'ACCORDER' ou 'ENETUDE')
        await client.query(
            `UPDATE agro_demande_financement 
             SET statut = 'ACCORDER', code_decaissement = NULL 
             WHERE iddemandefinancement = $1`,
            [iddemandefinancement]
        );

        // 4. Supprimer le décaissement
        await client.query(
            `DELETE FROM agro_decaissement_financement WHERE iddecaissementfinancement = $1`,
            [iddecaissementfinancement]
        );

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: 'Décaissement annulé avec succès.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur annulation décaissement:', error);
        res.status(500).json({ success: false, message: error.message || "Erreur interne du serveur" });
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
        const dir = path.join(__dirname, '../uploads/finance/decaissement/signatures');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}_${unique}.png`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'signatureproducteur' || file.fieldname === 'signatureagent') {
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
    { name: 'signatureagent', maxCount: 1 }
]);

// ==========================================
// 1. AJOUTER UN DECAISSEMENT
// ==========================================
router.post('/ajouterdecaissementagro', upload, async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            iddemandefinancement,
            codedecaissementfinancement,
            idcampagne,
            idcooperative,
            idfourn,
            idagence,
            iduser,
            datedecaissement,
            objet,
            montantdemande,
            montantaccord,
            montantrembourse,
            idmois,
            idannee,
            statut
        } = req.body;

        const files = req.files || {};
        const sigProd = files.signatureproducteur?.[0]?.filename || null;
        const sigAgent = files.signatureagent?.[0]?.filename || null;

        await client.query('BEGIN');

        // 1. Vérification préalable de la caisse de l'utilisateur
        const caisseResult = await client.query(
            `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`,
            [iduser]
        );
        if (caisseResult.rows.length === 0) {
            throw new Error('Compte caisse introuvable pour cet utilisateur.');
        }

        // 2. Vérification préalable du compte fournisseur
        const comptefournisseurResult = await client.query(
            `SELECT compteauxiliaire FROM gfournisseur WHERE idfourn = $1`,
            [idfourn]
        );
        if (comptefournisseurResult.rows.length === 0) {
            throw new Error('Compte auxiliaire introuvable pour ce fournisseur.');
        }

        // 3. Mise à jour du statut de la demande de financement
        await client.query(
            `UPDATE agro_demande_financement 
             SET statut = 'DECAISSE',
                 code_decaissement = $2
             WHERE iddemandefinancement = $1`,
            [iddemandefinancement, codedecaissementfinancement]
        );

        // 4. Insertion du décaissement
        // Le trigger "trg_after_agro_decaissement" interceptera cette requête 
        // et écrira automatiquement dans "public.tmvttheorique"
        const query = `
            INSERT INTO agro_decaissement_financement (
                codedecaissementfinancement, iddemandefinancement, idcampagne, idcooperative, 
                idfourn, idagence, iduser, datedecaissement, objet, montantdemande, 
                montantaccord, montantrembourse, signatureproducteur, signatureagent, 
                idmois, idannee, statut
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
            RETURNING *;
        `;

        const result = await client.query(query, [
            codedecaissementfinancement,
            iddemandefinancement,
            idcampagne,
            idcooperative,
            idfourn,
            idagence,
            iduser,
            datedecaissement || new Date(),
            objet,
            montantdemande,
            montantaccord,
            montantrembourse,
            sigProd,
            sigAgent,
            idmois,
            idannee,
            statut
        ]);

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;

*/





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
        const dir = path.join(__dirname, '../uploads/finance/decaissement/signatures');
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
    if (file.fieldname === 'signatureproducteur' || file.fieldname === 'signatureagent') {
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

// 3. Initialisation de multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
    { name: 'signatureproducteur', maxCount: 1 },
    { name: 'signatureagent', maxCount: 1 }
]);

// ==========================================
// 1. AJOUTER UN DECAISSEMENT
// ==========================================
router.post('/ajouterdecaissementagro', upload, async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            iddemandefinancement,
            codedecaissementfinancement,
            idcampagne,
            idcooperative,
            idfourn,
            idagence,
            iduser,
            datedecaissement,
            objet,
            montantdemande,
            montantaccord,
            montantrembourse,
            idmois,
            idannee,
            statut
        } = req.body;

        const files = req.files || {};
        const sigProd = files.signatureproducteur?.[0]?.filename || null;
        const sigAgent = files.signatureagent?.[0]?.filename || null;

        await client.query('BEGIN');

        // Vérifier compte caisse utilisateur
        const caisseResult = await client.query(
            `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`,
            [iduser]
        );
        if (caisseResult.rows.length === 0) throw new Error('Compte caisse introuvable');
        const compteCaisse = caisseResult.rows[0].comptecaisse;

        // Vérifier compte fournisseur
        const comptefournisseurResult = await client.query(
            `SELECT compteauxiliaire FROM gfournisseur WHERE idfourn = $1`,
            [idfourn]
        );
        if (comptefournisseurResult.rows.length === 0) throw new Error('Compte fournisseur introuvable');
        const Comptefournisseur = comptefournisseurResult.rows[0].compteauxiliaire;

        const d = new Date(datedecaissement || new Date());
        const codjrnal = 1;

        // Mettre à jour la demande de financement
        await client.query(
            `UPDATE agro_demande_financement 
             SET statut = 'DECAISSE',
                 code_decaissement = $2
             WHERE iddemandefinancement = $1`,
            [iddemandefinancement, codedecaissementfinancement]
        );

        // =========================
        // 8. ECRITURES COMPTABLES
        // =========================
        await passerEcriture(client, [
            codedecaissementfinancement,
            d,
            codjrnal,
            Comptefournisseur,
            idfourn,
            `MISE A DISPOSITION CREDIT - ${codedecaissementfinancement}`,
            montantaccord,
            0,
            iduser,
            d.getMonth() + 1,
            d.getFullYear(),
            codedecaissementfinancement,
            codedecaissementfinancement,
            idagence
        ]);

        await passerEcriture(client, [
            codedecaissementfinancement,
            d,
            codjrnal,
            compteCaisse,
            idfourn,
            `MISE A DISPOSITION CREDIT ${codedecaissementfinancement}`,
            0,
            montantaccord,
            iduser,
            d.getMonth() + 1,
            d.getFullYear(),
            codedecaissementfinancement,
            codedecaissementfinancement,
            idagence
        ]);

        // Insertion du décaissement
        const query = `
            INSERT INTO agro_decaissement_financement (
                codedecaissementfinancement,iddemandefinancement, idcampagne, idcooperative, idfourn, idagence, iduser, datedecaissement, objet, 
                montantdemande, montantaccord, montantrembourse, signatureproducteur, signatureagent, idmois, idannee, statut
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,$17) RETURNING *;
        `;

        const result = await client.query(query, [
            codedecaissementfinancement,
            iddemandefinancement,
            idcampagne,
            idcooperative,
            idfourn,
            idagence,
            iduser,
            datedecaissement,
            objet,
            montantdemande,
            montantaccord,
            montantrembourse,
            sigProd,
            sigAgent,
            idmois,
            idannee,
            statut
        ]);

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});

// ==========================================
// Fonction utilitaire pour passer une écriture
// ==========================================
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

module.exports = router;

*/