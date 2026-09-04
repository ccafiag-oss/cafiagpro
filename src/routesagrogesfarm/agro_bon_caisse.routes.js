// =========================================
// ROUTES NODE.JS POUR agro_bon_caisse
// =========================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================
// 1. AFFICHER LES BONS DE CAISSE (PAR AGENCE ET STATUT / FILTRE DE DATES)
// =========================================
router.get('/agro_bon_caisse', async (req, res) => {
    try {
        const { idagence, statuts, date_debut, date_fin } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est obligatoire'
            });
        }

        let query = `
            SELECT bc.*, 
                   t.nom AS type_operation_nom,
                   b.immatriculation AS bien_immatriculation
            FROM agro_bon_caisse bc
            LEFT JOIN agro_types_operation t ON bc.idtypes_operation = t.idtypes_operation
            LEFT JOIN agro_bien b ON bc.id_bien = b.id
            WHERE bc.idagence = $1
        `;
        let values = [idagence];
        let paramIndex = 2;

        if (statuts) {
            query += ` AND bc.statuts = $${paramIndex}`;
            values.push(statuts);
            paramIndex++;
        }

        if (date_debut && date_fin) {
            query += ` AND bc.datesaisie BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            values.push(date_debut, date_fin);
            paramIndex += 2;
        }

        query += ` ORDER BY bc.id_bon_caisse DESC;`;

        const { rows } = await pool.query(query, values);

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
// 2. ENREGISTRER UN BON DE CAISSE
// =========================================
router.post('/agro_bon_caisse', async (req, res) => {
    try {
        const {
            idtypes_operation,
            idmodel,
            id_bien,
            idagence,
            iduser,
            montantsollicite,
            description,
            beneficiare
        } = req.body;

        if (!idtypes_operation || !idmodel || !idagence || !iduser || montantsollicite === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez renseigner tous les champs obligatoires'
            });
        }

        // Récupérer le nom et prénom de l'émetteur (iduser) depuis la table utilisateur
        const userQuery = `SELECT nom, prenom FROM utilisateur WHERE iduser = $1`;
        const userRes = await pool.query(userQuery, [iduser]);
        let infos_emeteur = "Utilisateur inconnu";
        if (userRes.rows.length > 0) {
            infos_emeteur = `${userRes.rows[0].nom} ${userRes.rows[0].prenom}`;
        }

        const insertQuery = `
            INSERT INTO agro_bon_caisse (
                idtypes_operation, idmodel, id_bien, idagence, iduser,
                infos_emeteur, montantsollicite, description, beneficiare,
                montantaccorder, statuts, iduser_valideur, infos_valideur
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'encours', $5, $6)
            RETURNING *;
        `;

        // Par défaut à la création, montantaccorder = montantsollicite ou 0, et valideur temporaire = émetteur
        const values = [
            idtypes_operation,
            idmodel,
            id_bien || null,
            idagence,
            iduser,
            infos_emeteur,
            montantsollicite,
            description,
            beneficiare,
            montantsollicite // par défaut le montant accordé initial = montant sollicité
        ];

        const { rows } = await pool.query(insertQuery, values);

        res.status(201).json({
            success: true,
            message: 'Bon de caisse enregistré avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// 3. MODIFIER UN BON DE CAISSE (UNIQUEMENT SI STATUT = 'encours')
// =========================================
router.put('/agro_bon_caisse/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            idtypes_operation,
            idmodel,
            id_bien,
            montantsollicite,
            description,
            beneficiare
        } = req.body;

        // Vérifier le statut actuel
        const checkQuery = `SELECT statuts FROM agro_bon_caisse WHERE id_bon_caisse = $1`;
        const checkRes = await pool.query(checkQuery, [id]);

        if (checkRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Bon de caisse introuvable' });
        }

        if (checkRes.rows[0].statuts !== 'encours') {
            return res.status(400).json({ success: false, message: 'Modification impossible : ce bon n\'est plus en cours' });
        }

        const updateQuery = `
            UPDATE agro_bon_caisse
            SET idtypes_operation = $1,
                idmodel = $2,
                id_bien = $3,
                montantsollicite = $4,
                description = $5,
                beneficiare = $6,
                montantaccorder = $4
            WHERE id_bon_caisse = $7
            RETURNING *;
        `;

        const values = [
            idtypes_operation,
            idmodel,
            id_bien || null,
            montantsollicite,
            description,
            beneficiare,
            id
        ];

        const { rows } = await pool.query(updateQuery, values);

        res.status(200).json({
            success: true,
            message: 'Bon de caisse mis à jour avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// 4. MISE À JOUR DU STATUT ET DU MONTANT ACCORDÉ (VALIDATION / REJET)
// =========================================
router.put('/agro_bon_caisse/statut/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { statuts, montantaccorder, iduser_valideur } = req.body;

        if (!statuts || montantaccorder === undefined || !iduser_valideur) {
            return res.status(400).json({ success: false, message: 'Informations manquantes pour la validation' });
        }

        // Récupérer le nom et prénom du valideur
        const userQuery = `SELECT nom, prenom FROM utilisateur WHERE iduser = $1`;
        const userRes = await pool.query(userQuery, [iduser_valideur]);
        let infos_valideur = "Valideur inconnu";
        if (userRes.rows.length > 0) {
            infos_valideur = `${userRes.rows[0].nom} ${userRes.rows[0].prenom}`;
        }

        const updateQuery = `
            UPDATE agro_bon_caisse
            SET statuts = $1,
                montantaccorder = $2,
                iduser_valideur = $3,
                infos_valideur = $4,
                dateaccord = CURRENT_DATE
            WHERE id_bon_caisse = $5
            RETURNING *;
        `;

        const values = [statuts, montantaccorder, iduser_valideur, infos_valideur, id];
        const { rows, rowCount } = await pool.query(updateQuery, values);

        if (rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Bon de caisse introuvable' });
        }

        res.status(200).json({
            success: true,
            message: 'Statut du bon mis à jour avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});




// =========================================
// 5. METTRE À JOUR LE STATUT DU BON À 'decaisse' LORS DU PAIEMENT EN CAISSE
// =========================================
router.put('/agro_bon_caisse/decaisse/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { iduser_decaisseur } = req.body;

        // Récupérer le nom et prénom du caissier/valideur
        const userQuery = `SELECT nom, prenom FROM utilisateur WHERE iduser = $1`;
        const userRes = await pool.query(userQuery, [iduser_decaisseur]);
        let infos_decaisseur = "Caissier inconnu";
        if (userRes.rows.length > 0) {
            infos_decaisseur = `${userRes.rows[0].nom} ${userRes.rows[0].prenom}`;
        }

        const updateQuery = `
            UPDATE agro_bon_caisse
            SET statuts = 'decaisse',
                iduser_decaisseur = $1,
                infos_decaisseur = $2,
                date_decaisse = CURRENT_DATE
            WHERE id_bon_caisse = $3
            RETURNING *;
        `;

        const values = [iduser_decaisseur, infos_decaisseur, id];
        const { rows, rowCount } = await pool.query(updateQuery, values);

        if (rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Bon de caisse introuvable' });
        }

        res.status(200).json({
            success: true,
            message: 'Bon de caisse marqué comme décaissé avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});


module.exports = router;