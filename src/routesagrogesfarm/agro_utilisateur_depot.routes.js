const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 1. AJOUTER un utilisateur au dépôt
router.post('/ajouteragro_utilisateur_depot', async (req, res) => {
    const { idagence, iduser, iddepot, etat } = req.body;
    try {
        const query = `INSERT INTO agro_utilisateur_depot (idagence, iduser, iddepot, etat) VALUES ($1, $2, $3, $4) RETURNING *`;
        const result = await pool.query(query, [idagence, iduser, iddepot, etat || true]);
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});



// 2. AFFICHER les utilisateurs par dépôt pour une agence donnée
router.get('/listeagro_utilisateur_depot', async (req, res) => {
    try {
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({ success: false, message: "Le paramètre idagence est requis." });
        }

        const query = `
            SELECT 
                ut.nom || ' ' || ut.prenom AS nom_complet,
                gd.designation,
                ud.idutilisateur_depot,
                ud.etat
            FROM agro_utilisateur_depot ud
            INNER JOIN utilisateur ut ON ut.iduser = ud.iduser
            INNER JOIN gdepot gd ON gd.iddepot = ud.iddepot
            WHERE ud.idagence = $1
            ORDER BY ud.idutilisateur_depot ASC
        `;

        const result = await pool.query(query, [idagence]);

        res.json({ 
            success: true, 
            total: result.rowCount,
            data: result.rows 
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// 3. MODIFIER l'état d'un utilisateur dépôt
router.put('/modifieragro_utilisateur_depot/:id', async (req, res) => {
    const { id } = req.params;
    const { etat } = req.body;
    try {
        const query = `UPDATE agro_utilisateur_depot SET etat = $1 WHERE idutilisateur_depot = $2 RETURNING *`;
        const result = await pool.query(query, [etat, id]);
        
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Enregistrement introuvable" });
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;