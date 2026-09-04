const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- CONFIGURATION DOSSIER ---
const UPLOAD_DIR = path.join(__dirname, '../uploads/finance/clients/comite/signature');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const nom = (req.body.fonction || 'membre').replace(/\s+/g, '_').toUpperCase();
        const unique = Date.now() + '-' + Math.floor(Math.random() * 999999);
        cb(null, `${nom}-${unique}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Seules les images sont autorisées (jpg, png)'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

// ==========================================
// AJOUTER MEMBRE
// ==========================================
router.post('/comite-membre', upload.single('signature'), async (req, res) => {
    try {
        const { idtypecomite, idagence, iduser, fonction, present } = req.body;

        if (!idtypecomite || !idagence || !iduser) {
            return res.status(400).json({ success: false, message: 'Données manquantes' });
        }

        // Vérifier doublon actif
        const check = await pool.query(
            "SELECT 1 FROM fina_comite_membre WHERE idtypecomite = $1 AND iduser = $2 AND etat = TRUE",
            [idtypecomite, iduser]
        );

        if (check.rowCount > 0) {
            return res.status(400).json({ success: false, message: 'Ce membre est déjà actif dans ce comité' });
        }

        const signature = req.file ? req.file.filename : null;

        const result = await pool.query(
            `INSERT INTO fina_comite_membre (idtypecomite, idagence, iduser, fonction, present, signature)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [idtypecomite, idagence, iduser, (fonction || 'MEMBRE').trim().toUpperCase(), present ?? true, signature]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// MODIFIER MEMBRE (Avec gestion de l'ancien fichier)
// ==========================================
router.put('/comite-membre/:idmembrecomite', upload.single('signature'), async (req, res) => {
    try {
        const { idmembrecomite } = req.params;
        const { fonction, present, etat } = req.body;

        // 1. Récupérer l'ancienne signature pour nettoyage éventuel
        const oldData = await pool.query(
            "SELECT signature FROM fina_comite_membre WHERE idmembrecomite = $1",
            [idmembrecomite]
        );

        if (oldData.rowCount === 0) return res.status(404).json({ success: false, message: 'Introuvable' });

        let signature = oldData.rows[0].signature;

        // 2. Si nouveau fichier, supprimer l'ancien
        if (req.file) {
            signature = req.file.filename;
            if (oldData.rows[0].signature) {
                const oldPath = path.join(UPLOAD_DIR, oldData.rows[0].signature);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        const result = await pool.query(
            `UPDATE fina_comite_membre 
             SET fonction = COALESCE($1, fonction), 
                 present = COALESCE($2, present), 
                 signature = $3, 
                 etat = COALESCE($4, etat)
             WHERE idmembrecomite = $5 RETURNING *`,
            [fonction?.toUpperCase(), present, signature, etat, idmembrecomite]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// LISTE MEMBRES (Optimisée)
// ==========================================
router.get('/comite-membre', async (req, res) => {
    try {
        const { idagence, idtypecomite, search } = req.query;

        let query = `
            SELECT fcm.*, fct.designation AS type_comite,
                   CONCAT(ut.nom, ' ', ut.prenom) AS nomcomplet
            FROM fina_comite_membre fcm
            JOIN fina_comite_type fct ON fct.idtypecomite = fcm.idtypecomite
            JOIN utilisateur ut ON ut.iduser = fcm.iduser
            WHERE fcm.idagence = $1 AND fcm.etat = TRUE
        `;

        const values = [idagence];
        if (idtypecomite) {
            query += ` AND fcm.idtypecomite = $2`;
            values.push(idtypecomite);
        }
        
        if (search) {
            query += ` AND (ut.nom ILIKE $${values.length + 1} OR ut.prenom ILIKE $${values.length + 1})`;
            values.push(`%${search}%`);
        }

        query += ` ORDER BY fcm.idmembrecomite DESC`;
        const result = await pool.query(query, values);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// SUPPRESSION (Correction req.query)
// ==========================================
router.delete('/comite-membre/:idmembrecomite', async (req, res) => {
    try {
        const { idmembrecomite } = req.params;
        const { idagence } = req.query; // Utilisation de query au lieu de body

        const result = await pool.query(
            "UPDATE fina_comite_membre SET etat = FALSE WHERE idmembrecomite = $1 AND idagence = $2 RETURNING *",
            [idmembrecomite, idagence]
        );

        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Membre non trouvé' });

        res.json({ success: true, message: 'Membre désactivé' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
        const dir = path.join(
            __dirname,
            '../uploads/finance/clients/comite/signature'
        );

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        cb(null, dir);
    },

    filename: (req, file, cb) => {
        const nom = (req.body.fonction || 'membre')
            .replace(/\s+/g, '_')
            .toUpperCase();

        const unique =
            Date.now() + '-' + Math.floor(Math.random() * 999999);

        cb(
            null,
            `${nom}-${unique}${path.extname(file.originalname)}`
        );
    }
});


// ==========================================
// FILTRE FICHIER
// ==========================================
const fileFilter = (req, file, cb) => {
    const allowed = /jpg|jpeg|png/;
    const ext = allowed.test(
        path.extname(file.originalname).toLowerCase()
    );

    if (ext) {
        cb(null, true);
    } else {
        cb(new Error('Format non autorisé'));
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
// AJOUTER MEMBRE COMITE
// signature facultative
// ==========================================
router.post(
    '/comite-membre',
    upload.single('signature'),
    async (req, res) => {
        try {
            const {
                idtypecomite,
                idagence,
                iduser,
                fonction,
                present
            } = req.body;

            if (!idtypecomite || !idagence || !iduser || !fonction) {
                return res.status(400).json({
                    success: false,
                    message:
                        'idtypecomite, idagence, iduser et fonction obligatoires'
                });
            }

            // signature facultative
            const signature = req.file
                ? req.file.filename
                : null;

            // vérifier doublon
            const check = await pool.query(
                `
                SELECT 1
                FROM fina_comite_membre
                WHERE idtypecomite = $1
                  AND iduser = $2
                  AND etat = TRUE
                `,
                [idtypecomite, iduser]
            );

            if (check.rowCount > 0) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Ce membre existe déjà dans ce comité'
                });
            }

            const result = await pool.query(
                `
                INSERT INTO fina_comite_membre (
                    idtypecomite,
                    idagence,
                    iduser,
                    fonction,
                    present,
                    signature
                )
                VALUES ($1,$2,$3,$4,$5,$6)
                RETURNING *;
                `,
                [
                    idtypecomite,
                    idagence,
                    iduser,
                    fonction.trim().toUpperCase(),
                    present ?? true,
                    signature
                ]
            );

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
// MODIFIER MEMBRE COMITE
// signature facultative
// ==========================================
router.put(
    '/comite-membre/:idmembrecomite',
    upload.single('signature'),
    async (req, res) => {
        try {
            const { idmembrecomite } = req.params;

            const {
                idagence,
                fonction,
                present,
                etat
            } = req.body;

            if (!idagence) {
                return res.status(400).json({
                    success: false,
                    message: 'idagence obligatoire'
                });
            }

            // récupérer ancienne signature
            const oldData = await pool.query(
                `
                SELECT signature
                FROM fina_comite_membre
                WHERE idmembrecomite = $1
                `,
                [idmembrecomite]
            );

            if (oldData.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Membre introuvable'
                });
            }

            const signature = req.file
                ? req.file.filename
                : oldData.rows[0].signature;

            const result = await pool.query(
                `
                UPDATE fina_comite_membre
                SET
                    fonction = $1,
                    present = $2,
                    signature = $3,
                    etat = $4
                WHERE idmembrecomite = $5
                  AND idagence = $6
                RETURNING *;
                `,
                [
                    fonction.trim().toUpperCase(),
                    present,
                    signature,
                    etat,
                    idmembrecomite,
                    idagence
                ]
            );

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


// ==========================================
// LISTE MEMBRES
// ==========================================
router.get('/comite-membre', async (req, res) => {
    try {
        const { idagence, idtypecomite, search } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence obligatoire'
            });
        }

        let query = `
             SELECT
    fcm.*,
    fct.designation AS type_comite,
    CONCAT(
        COALESCE(ut.nom, ''),
        ' ',
        COALESCE(ut.prenom, '')
    ) AS nomcomplet
FROM fina_comite_membre fcm
INNER JOIN fina_comite_type fct
    ON fct.idtypecomite = fcm.idtypecomite
INNER JOIN utilisateur ut
    ON ut.iduser = fcm.iduser

            WHERE fcm.idagence = $1
              AND fcm.etat = TRUE
        `;

        const values = [idagence];
        let index = 2;

        if (idtypecomite) {
            query += ` AND fcm.idtypecomite = $${index}`;
            values.push(idtypecomite);
            index++;
        }

        if (search) {
            query += `
                AND fcm.fonction ILIKE $${index}
            `;
            values.push(`%${search}%`);
        }

        query += ` ORDER BY fcm.idmembrecomite DESC`;

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
// DETAIL MEMBRE
// ==========================================
router.get('/comite-membre/:idmembrecomite', async (req, res) => {
    try {
        const { idmembrecomite } = req.params;

        const result = await pool.query(
            `
            SELECT *
            FROM fina_comite_membre
            WHERE idmembrecomite = $1
            `,
            [idmembrecomite]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Membre introuvable'
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


// ==========================================
// SUPPRESSION LOGIQUE
// ==========================================
router.delete('/comite-membre/:idmembrecomite', async (req, res) => {
    try {
        const { idmembrecomite } = req.params;
        const { idagence } = req.body;

        const result = await pool.query(
            `
            UPDATE fina_comite_membre
            SET etat = FALSE
            WHERE idmembrecomite = $1
              AND idagence = $2
            RETURNING *;
            `,
            [idmembrecomite, idagence]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Membre introuvable'
            });
        }

        res.json({
            success: true,
            message: 'Membre supprimé'
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