const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================
// AFFICHER TOUS LES MODES DE PAIEMENT (idagence obligatoire)
// =========================================
router.get('/cabmodepaiement', async (req, res) => {
    try {
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est obligatoire pour afficher les données'
            });
        }

        const query = `
            SELECT idmodep,abrege,designation,compte,typescompte,idagence
            FROM cabmodepaiement
            WHERE idagence = $1
            ORDER BY 
                CASE 
                    WHEN compte LIKE '571%' THEN 0 
                    ELSE 1 
                END, 
                compte;
        `;

        const { rows } = await pool.query(query, [idagence]);

        res.status(200).json({
            success: true,
            total: rows.length,
            data: rows
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// =========================================
// ENREGISTRER UN MODE DE PAIEMENT
// =========================================
router.post('/cabmodepaiement', async (req, res) => {
    try {
        const {
            abrege,
            designation,
            compte,
            typescompte,
            idagence
        } = req.body;

        // Validation minimale
        if (!abrege || !designation || !compte || !typescompte || !idagence) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez renseigner tous les champs obligatoires'
            });
        }

        const query = `
            INSERT INTO cabmodepaiement (
                abrege, designation, compte, typescompte, idagence
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;

        const values = [
            abrege,
            designation,
            compte,
            typescompte,
            idagence
        ];

        const { rows } = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: 'Mode de paiement enregistré avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// MODIFIER UN MODE DE PAIEMENT
// =========================================
router.put('/cabmodepaiement/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            abrege,
            designation,
            compte,
            typescompte
        } = req.body;

        const query = `
            UPDATE cabmodepaiement
            SET abrege = $1,
                designation = $2,
                compte = $3,
                typescompte = $4
            WHERE idmodep = $5
            RETURNING *;
        `;

        const values = [
            abrege,
            designation,
            compte,
            typescompte,
            id
        ];

        const { rows, rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Mode de paiement introuvable'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Mode de paiement mis à jour avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});



// ==========================================
// 4️⃣ DUPLIQUER DES MODES DE PAIEMENT VERS UNE AUTRE AGENCE
// POST: http://localhost:5265/api/cabmodepaiement/dupliquer
// ==========================================
router.post('/cabmodepaiement/dupliquer', async (req, res) => {
    const { idagence_source, idagence_destination, ids_modepaiement } = req.body;

    // Validation des paramètres obligatoires
    if (!idagence_source || !idagence_destination || !ids_modepaiement || !Array.isArray(ids_modepaiement) || ids_modepaiement.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'Paramètres manquants ou invalides (idagence_source, idagence_destination, ids_modepaiement)' 
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Récupérer les modes de paiement source à dupliquer
        const selectQuery = `
            SELECT abrege, designation, compte, typescompte 
            FROM cabmodepaiement 
            WHERE idagence = $1 AND idmodep = ANY($2::bigint[])
        `;
        const { rows: modesToDuplicate } = await client.query(selectQuery, [idagence_source, ids_modepaiement]);

        if (modesToDuplicate.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                success: false, 
                message: 'Aucun mode de paiement trouvé pour les identifiants fournis dans cette agence.' 
            });
        }

        // 2. Insérer dans l'agence de destination avec vérification d'unicité (sur l'abrégé ou la désignation)
        let duplicatedCount = 0;
        for (const m of modesToDuplicate) {

            // Vérifier si un mode avec le même abrégé existe déjà dans l'agence de destination
            const checkExistQuery = `
                SELECT idmodep FROM cabmodepaiement 
                WHERE idagence = $1 AND LOWER(TRIM(abrege)) = LOWER(TRIM($2))
            `;
            const existingRows = await client.query(checkExistQuery, [idagence_destination, m.abrege]);

            if (existingRows.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ 
                    success: false,
                    message: `Le mode de paiement avec l'abrégé "${m.abrege}" existe déjà dans l'agence de destination.` 
                });
            }

            // Insertion
            const insertQuery = `
                INSERT INTO cabmodepaiement (
                    abrege, designation, compte, typescompte, idagence
                ) VALUES ($1, $2, $3, $4, $5)
            `;

            const values = [
                m.abrege,
                m.designation,
                m.compte,
                m.typescompte,
                idagence_destination
            ];

            await client.query(insertQuery, values);
            duplicatedCount++;
        }

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: `${duplicatedCount} mode(s) de paiement dupliqué(s) avec succès vers l'agence de destination ✨`
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur POST /cabmodepaiement/dupliquer:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;