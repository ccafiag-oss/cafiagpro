const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // Optionnel mais recommandé

/**
 * LOGIN : Vérification des accès
 */
const login = async (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).json({ success: false, message: "Identifiants requis." });
    }

    try {
        // Recherche de l'utilisateur et de ses permissions
        const query = `
            SELECT u.*, h.* FROM utilisateur u
            LEFT JOIN habilitationprofile h ON u.idrole = h.idrole
            WHERE u.logineuser = $1
        `;
        const result = await pool.query(query, [login]);

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: "Utilisateur non trouvé." });
        }

        const user = result.rows[0];

        // Vérification du mot de passe
        const isMatch = await bcrypt.compare(password, user.passworduser);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Mot de passe incorrect." });
        }

        // Sécurité : Supprimer le hash avant envoi
        delete user.passworduser;

        res.status(200).json({
            success: true,
            message: "Connexion réussie",
            data: user
        });

    } catch (err) {
        console.error("❌ Erreur Login:", err.message);
        res.status(500).json({ success: false, message: "Erreur serveur." });
    }
};

/**
 * CHANGEMENT DE MOT DE PASSE (Première connexion ou manuel)
 */
const changePassword = async (req, res) => {
    const { login, oldPassword, newPassword } = req.body;

    if (!login || !oldPassword || !newPassword) {
        return res.status(400).json({ success: false, message: "Données manquantes." });
    }

    try {
        // 1. Récupérer le hash actuel
        const result = await pool.query('SELECT iduser, passworduser FROM utilisateur WHERE logineuser = $1', [login]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé." });
        }

        const user = result.rows[0];

        // 2. Vérifier l'ancien mot de passe
        const isMatch = await bcrypt.compare(oldPassword, user.passworduser);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "L'ancien mot de passe est incorrect." });
        }

        // 3. Hacher le nouveau mot de passe
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // 4. Mise à jour (On utilise l'ID pour la précision)
        await pool.query(
            `UPDATE utilisateur 
             SET passworduser = $1, premiere_connexion = false 
             WHERE iduser = $2`,
            [hashedNewPassword, user.iduser]
        );

        res.status(200).json({ success: true, message: "Mot de passe mis à jour avec succès." });

    } catch (err) {
        console.error("❌ Erreur ChangePassword:", err.message);
        res.status(500).json({ success: false, message: "Erreur technique." });
    }
};

module.exports = { login, changePassword };