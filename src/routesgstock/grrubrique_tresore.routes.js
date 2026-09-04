const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================
// AFFICHER TOUTES LES RUBRIQUES DE TRÉSORERIE
// =========================================
router.get('/g_rubrique_tresore', async (req, res) => {
    try {
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est obligatoire pour afficher les données'
            });
        }

        const query = `
            SELECT * FROM g_rubrique_tresore
            WHERE idagence = $1
            ORDER BY id DESC;
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
// ENREGISTRER UNE RUBRIQUE DE TRÉSORERIE
// =========================================
router.post('/g_rubrique_tresore', async (req, res) => {
    try {
        const { idagence, designation, description, etat,id_rubrique_poste } = req.body;

        if (!idagence || !designation) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez renseigner les champs obligatoires (idagence, designation)'
            });
        }

        const query = `
            INSERT INTO g_rubrique_tresore (idagence, designation, description, etat,id_rubrique_poste)
            VALUES ($1, $2, $3, $4,$5)
            RETURNING *;
        `;

        const values = [
            idagence, 
            designation, 
            description || '', 
            etat !== undefined ? etat : true,id_rubrique_poste
        ];

        const { rows } = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: 'Rubrique de trésorerie enregistrée avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// MODIFIER UNE RUBRIQUE DE TRÉSORERIE
// =========================================
router.put('/g_rubrique_tresore/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { designation, description,id_rubrique_poste, etat } = req.body;

        if (!designation) {
            return res.status(400).json({
                success: false,
                message: 'La désignation est obligatoire'
            });
        }

        const query = `
            UPDATE g_rubrique_tresore
            SET designation = $1,
                description = $2,
                etat = $3,
                id_rubrique_poste=$4
            WHERE id = $5
            RETURNING *;
        `;

        const values = [
            designation, 
            description || '', 
            etat !== undefined ? etat : true,id_rubrique_poste,
            id
        ];

        const { rows, rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Rubrique de trésorerie introuvable'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Rubrique de trésorerie mise à jour avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});








// =========================================
// 1. RÉCUPÉRER LES RUBRIQUES ACTIVES (etat = true)
// =========================================
router.get('/g_rubrique_tresore/actives', async (req, res) => {
    try {
        const { idagence } = req.query;
        if (!idagence) {
            return res.status(400).json({ success: false, message: 'idagence requis' });
        }
        const query = `
            SELECT * FROM g_rubrique_tresore 
            WHERE idagence = $1 AND etat = true 
            ORDER BY id ASC;
        `;
        const { rows } = await pool.query(query, [idagence]);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// 2. ENREGISTRER UNE SAISIE GROUPÉE DANS g_solde_tresor
// =========================================
router.post('/g_solde_tresor/batch', async (req, res) => {
    const client = await pool.connect();
    try {
        const { idagence, iduser, date_operation, lignes } = req.body;

        if (!idagence || !iduser || !date_operation || !lignes || !lignes.length) {
            return res.status(400).json({ success: false, message: 'Données incomplètes' });
        }

        await client.query('BEGIN');

        for (const ligne of lignes) {
            const { id_rubrique_tresore, designation, montant, description, id_rubrique_poste } = ligne;
            
            if (montant && parseFloat(montant) !== 0) {
                const query = `
                    INSERT INTO g_solde_tresor 
                    (id_rubrique_tresore, idagence, iduser, date_operation, designation, montant, description, datevalidation, id_rubrique_poste)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)
                `;
                await client.query(query, [
                    id_rubrique_tresore,
                    idagence,
                    iduser,
                    date_operation,
                    designation || '',
                    montant,
                    description || '',
                    id_rubrique_poste
                ]);
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, message: 'Saisie enregistrée avec succès' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// =========================================
// 3. RÉCUPÉRER LES SAISIES NON VALIDÉES (datevalidation IS NULL) ENTRE DEUX DATES
// =========================================
router.get('/g_solde_tresor/non_valides', async (req, res) => {
    try {
        const { idagence, datedebut, datefin } = req.query;
        if (!idagence || !datedebut || !datefin) {
            return res.status(400).json({ success: false, message: 'Paramètres manquants' });
        }

        const query = `
            SELECT 
                date_operation,
                idagence,
                COUNT(*) as nombre_lignes,
                SUM(montant) as total_montant
            FROM g_solde_tresor
            WHERE idagence = $1 
              AND datevalidation IS NULL
              AND date_operation BETWEEN $2 AND $3
            GROUP BY date_operation, idagence
            ORDER BY date_operation DESC;
        `;
        const { rows } = await pool.query(query, [idagence, datedebut, datefin]);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// 4. RÉCUPÉRER LES LIGNES POUR UNE DATE SPÉCIFIQUE (Pour modification)
// =========================================
router.get('/g_solde_tresor/par_date', async (req, res) => {
    try {
        const { idagence, date_operation } = req.query;
        const query = `
            SELECT s.*, r.designation as rubrique_nom 
            FROM g_solde_tresor s
            JOIN g_rubrique_tresore r ON s.id_rubrique_tresore = r.id
            WHERE s.idagence = $1 AND s.date_operation = $2 AND s.datevalidation IS NULL
        `;
        const { rows } = await pool.query(query, [idagence, date_operation]);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// 5. METTRE À JOUR ET VALIDER (datevalidation = CURRENT_DATE)
// =========================================
router.put('/g_solde_tresor/valider_groupe', async (req, res) => {
    const client = await pool.connect();
    try {
        const { idagence, date_operation, lignes } = req.body;

        await client.query('BEGIN');

        // Mettre à jour les lignes modifiées et valider
        for (const ligne of lignes) {
            if (ligne.id) {
                await client.query(`
                    UPDATE g_solde_tresor 
                    SET designation = $1, montant = $2, description = $3, datevalidation = CURRENT_DATE
                    WHERE id = $4
                `, [ligne.designation, ligne.montant, ligne.description, ligne.id]);
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: 'Données mises à jour et validées avec succès' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});






// =========================================
// 1. RÉCUPÉRER LES DONNÉES COMPARATIVES DE DEUX DATES
// =========================================
router.get('/g_solde_tresor/comparatif', async (req, res) => {
    try {
        const { idagence, dateA, dateB } = req.query;

        if (!idagence || !dateA || !dateB) {
            return res.status(400).json({ success: false, message: 'Paramètres manquants (idagence, dateA, dateB requis)' });
        }

        const query = `
            SELECT 
                r.id AS id_rubrique,
                r.designation AS rubrique_nom,
                COALESCE(SUM(CASE WHEN s.date_operation = $2 THEN s.montant ELSE 0 END), 0) AS montant_date_a,
                COALESCE(SUM(CASE WHEN s.date_operation = $3 THEN s.montant ELSE 0 END), 0) AS montant_date_b
            FROM g_rubrique_tresore r
            LEFT JOIN g_solde_tresor s ON r.id = s.id_rubrique_tresore AND s.idagence = $1 AND s.date_operation IN ($2, $3)
            WHERE r.idagence = $1 AND r.etat = true
            GROUP BY r.id, r.designation
            ORDER BY r.designation ASC;
        `;

        const { rows } = await pool.query(query, [idagence, dateA, dateB]);

        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// 2. RÉCUPÉRER L'ÉVOLUTION DE LA DIFFÉRENCE ENTRE DEUX DATES (Pour le graphique d'évolution)
// =========================================
router.get('/g_solde_tresor/evolution_difference', async (req, res) => {
    try {
        const { idagence, datedebut, datefin } = req.query;

        if (!idagence || !datedebut || !datefin) {
            return res.status(400).json({ success: false, message: 'Paramètres manquants' });
        }

        const query = `
            SELECT 
                date_operation,
                SUM(montant) AS total_jour
            FROM g_solde_tresor
            WHERE idagence = $1 AND date_operation BETWEEN $2 AND $3
            GROUP BY date_operation
            ORDER BY date_operation ASC;
        `;

        const { rows } = await pool.query(query, [idagence, datedebut, datefin]);

        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});



// =========================================
// 1. RÉCUPÉRER LES DONNÉES COMPARATIVES DE DEUX DATES
// =========================================
router.get('/g_solde_tresor/comparatif1', async (req, res) => {
    try {
        const { idagence, dateA, dateB } = req.query;

        if (!idagence || !dateA || !dateB) {
            return res.status(400).json({ success: false, message: 'Paramètres manquants (idagence, dateA, dateB requis)' });
        }

        const query = `
            SELECT 
                r.id AS id_rubrique,
                r.designation AS rubrique_nom,
                r.id_rubrique_poste,
                COALESCE(SUM(CASE WHEN s.date_operation = $2 THEN s.montant ELSE 0 END), 0) AS montant_date_a,
                COALESCE(SUM(CASE WHEN s.date_operation = $3 THEN s.montant ELSE 0 END), 0) AS montant_date_b
            FROM g_rubrique_tresore r
            LEFT JOIN g_solde_tresor s ON r.id = s.id_rubrique_tresore AND s.idagence = $1 AND s.date_operation IN ($2, $3)
            WHERE r.idagence = $1 AND r.etat = true
            GROUP BY r.id, r.designation, r.id_rubrique_poste
            ORDER BY r.designation ASC;
        `;

        const { rows } = await pool.query(query, [idagence, dateA, dateB]);

        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// 2. RÉCUPÉRER L'ÉVOLUTION DE LA DIFFÉRENCE ENTRE DEUX DATES (Pour le graphique d'évolution)
// =========================================
router.get('/g_solde_tresor/evolution_difference1', async (req, res) => {
    try {
        const { idagence, datedebut, datefin } = req.query;

        if (!idagence || !datedebut || !datefin) {
            return res.status(400).json({ success: false, message: 'Paramètres manquants' });
        }

        const query = `
            SELECT 
                date_operation,
                SUM(montant) AS total_jour
            FROM g_solde_tresor
            WHERE idagence = $1 AND date_operation BETWEEN $2 AND $3
            GROUP BY date_operation
            ORDER BY date_operation ASC;
        `;

        const { rows } = await pool.query(query, [idagence, datedebut, datefin]);

        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});



// 1. AFFICHER TOUTES LES RUBRIQUES DE POSTE (par agence)
// =========================================
router.get('/g_rubrique_poste', async (req, res) => {
    try {
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est obligatoire pour afficher les données'
            });
        }

        const query = `
            SELECT * FROM g_rubrique_poste
            WHERE idagence = $1
            ORDER BY id_rubrique_poste DESC;
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
// 2. ENREGISTRER UNE RUBRIQUE DE POSTE
// =========================================
router.post('/g_rubrique_poste', async (req, res) => {
    try {
        const { idagence, designation, etat } = req.body;

        if (!idagence || !designation) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez renseigner les champs obligatoires (idagence, designation)'
            });
        }

        const query = `
            INSERT INTO g_rubrique_poste (idagence, designation, etat)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;

        const values = [
            idagence, 
            designation, 
            etat !== undefined ? etat : true
        ];

        const { rows } = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: 'Rubrique de poste enregistrée avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// 3. MODIFIER UNE RUBRIQUE DE POSTE
// =========================================
router.put('/g_rubrique_poste/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { designation, etat } = req.body;

        if (!designation) {
            return res.status(400).json({
                success: false,
                message: 'La désignation est obligatoire'
            });
        }

        const query = `
            UPDATE g_rubrique_poste
            SET designation = $1,
                etat = $2
            WHERE id_rubrique_poste = $3
            RETURNING *;
        `;

        const values = [
            designation, 
            etat !== undefined ? etat : true, 
            id
        ];

        const { rows, rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Rubrique de poste introuvable'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Rubrique de poste mise à jour avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// 4. RÉCUPÉRER UNIQUEMENT LES RUBRIQUES ACTIVES (etat = true)
// =========================================
router.get('/g_rubrique_poste/actives', async (req, res) => {
    try {
        const { idagence } = req.query;
        if (!idagence) {
            return res.status(400).json({ success: false, message: 'idagence requis' });
        }
        
        const query = `
            SELECT * FROM g_rubrique_poste 
            WHERE idagence = $1 AND etat = true 
            ORDER BY id_rubrique_poste ASC;
        `;
        
        const { rows } = await pool.query(query, [idagence]);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});




module.exports = router;