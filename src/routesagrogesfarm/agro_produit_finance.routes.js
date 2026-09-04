const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// =========================================
// AFFICHER TOUS LES PRODUITS FINANCIERS (idagence obligatoire)
// =========================================
router.get('/agro_produit_finance', async (req, res) => {
    try {
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est obligatoire pour afficher les données'
            });
        }

        const query = `
            SELECT * FROM agro_produit_finance
            WHERE idagence = $1
            ORDER BY idprod DESC;
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
// ENREGISTRER UN PRODUIT FINANCIER
// =========================================
router.post('/agro_produit_finance', async (req, res) => {
    try {
        const {
            codeprod,
            idagence,
            designation,
            comptegeneral,
            taux_interet_min,
            taux_interet_max,
            duree_min,
            duree_max,
            nbre_semaine_annee,
            nbre_jour_annee,
            compteinteret,
            comptepenalite,
            etat
        } = req.body;

        // Validation minimale
        if (!codeprod || !idagence || !designation || !compteinteret || !comptepenalite) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez renseigner tous les champs obligatoires'
            });
        }

        const query = `
            INSERT INTO agro_produit_finance (
                codeprod, idagence, designation, comptegeneral,
                taux_interet_min, taux_interet_max, duree_min, duree_max,
                nbre_semaine_annee, nbre_jour_annee, compteinteret, comptepenalite,
                etat
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
            RETURNING *;
        `;

        const values = [
            codeprod,
            idagence,
            designation,
            comptegeneral,
            taux_interet_min,
            taux_interet_max,
            duree_min,
            duree_max,
            nbre_semaine_annee,
            nbre_jour_annee,
            compteinteret,
            comptepenalite,
            etat ?? true
        ];

        const { rows } = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: 'Produit financier enregistré avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================
// MODIFIER UN PRODUIT FINANCIER
// =========================================
router.put('/agro_produit_finance/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            codeprod,
            designation,
            comptegeneral,
            taux_interet_min,
            taux_interet_max,
            duree_min,
            duree_max,
            nbre_semaine_annee,
            nbre_jour_annee,
            compteinteret,
            comptepenalite,
            etat
        } = req.body;

        const query = `
            UPDATE agro_produit_finance
            SET codeprod = $1,
                designation = $2,
                comptegeneral = $3,
                taux_interet_min = $4,
                taux_interet_max = $5,
                duree_min = $6,
                duree_max = $7,
                nbre_semaine_annee = $8,
                nbre_jour_annee = $9,
                compteinteret = $10,
                comptepenalite = $11,
                etat = $12
            WHERE idprod = $13
            RETURNING *;
        `;

        const values = [
            codeprod,
            designation,
            comptegeneral,
            taux_interet_min,
            taux_interet_max,
            duree_min,
            duree_max,
            nbre_semaine_annee,
            nbre_jour_annee,
            compteinteret,
            comptepenalite,
            etat,
            id
        ];

        const { rows, rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produit financier introuvable'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Produit financier mis à jour avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;