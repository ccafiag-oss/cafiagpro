const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assurez-vous que le chemin vers votre config DB est correct

// 1. Enregistrer ou mettre à jour la session lors de la connexion (avec vérification du blocage)
router.post('/session/login', async (req, res) => {
    const { iduser, nom, adresseip, adressmac, localisation } = req.body;

    if (!iduser) {
        return res.status(400).json({ error: 'Le paramètre "iduser" est obligatoire.' });
    }

    try {
        // Vérifier si l'utilisateur est bloqué (etat = FALSE)
        const checkQuery = 'SELECT etat FROM user_sessions WHERE iduser = $1';
        const existingUser = await pool.query(checkQuery, [iduser]);

        if (existingUser.rows.length > 0 && existingUser.rows[0].etat === false) {
            return res.status(403).json({ error: 'Accès refusé : votre compte a été bloqué.' });
        }

        // Insérer ou mettre à jour la session (Upsert) - etat est mis à TRUE (actif)
        const upsertQuery = `
            INSERT INTO user_sessions (iduser, nom, adresseip, adressmac, localisation, etat, message_lu, derniere_activite)
            VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, CURRENT_TIMESTAMP)
            ON CONFLICT (iduser) 
            DO UPDATE SET 
                nom = EXCLUDED.nom,
                adresseip = EXCLUDED.adresseip,
                adressmac = EXCLUDED.adressmac,
                localisation = EXCLUDED.localisation,
                etat = TRUE,
                derniere_activite = CURRENT_TIMESTAMP
            RETURNING *;
        `;

        const { rows } = await pool.query(upsertQuery, [iduser, nom, adresseip, adressmac, localisation]);
        res.json({ message: 'Connexion enregistrée', data: rows[0] });
    } catch (err) {
        console.error('Erreur POST /session/login:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 2. Vérifier l'état et récupérer les messages en attente (Polling Flutter)
router.get('/session/check/:iduser', async (req, res) => {
    const { iduser } = req.params;

    try {
        const { rows } = await pool.query(
            'SELECT iduser, etat, message, message_lu FROM user_sessions WHERE iduser = $1',
            [iduser]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Session non trouvée' });
        }

        res.json({ data: rows[0] });
    } catch (err) {
        console.error('Erreur GET /session/check/:iduser:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 3. Modifier l'état d'un utilisateur (true = Actif, false = Bloqué)
router.patch('/session/status', async (req, res) => {
    const { iduser, etat } = req.body; // etat doit être un booléen (true ou false)

    if (!iduser || etat === undefined || typeof etat !== 'boolean') {
        return res.status(400).json({ error: 'Champs obligatoires manquants ou invalides (iduser, etat doit être un boolean)' });
    }

    try {
        const query = `
            UPDATE user_sessions 
            SET etat = $1, derniere_activite = CURRENT_TIMESTAMP 
            WHERE iduser = $2 
            RETURNING *;
        `;
        const { rowCount, rows } = await pool.query(query, [etat, iduser]);

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        res.json({ message: `Statut mis à jour avec succès : ${etat ? 'Actif' : 'Bloqué'}`, data: rows[0] });
    } catch (err) {
        console.error('Erreur PATCH /session/status:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 4. Envoyer un message à un utilisateur
router.post('/session/message', async (req, res) => {
    const { iduser, message } = req.body;

    if (!iduser || !message) {
        return res.status(400).json({ error: 'Champs obligatoires manquants (iduser, message)' });
    }

    try {
        const query = `
            UPDATE user_sessions 
            SET message = $1, message_lu = FALSE 
            WHERE iduser = $2 
            RETURNING *;
        `;
        const { rowCount, rows } = await pool.query(query, [message, iduser]);

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        res.json({ message: 'Message envoyé avec succès', data: rows[0] });
    } catch (err) {
        console.error('Erreur POST /session/message:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 5. Marquer le message comme lu par l'utilisateur
router.patch('/session/message-read', async (req, res) => {
    const { iduser } = req.body;

    if (!iduser) {
        return res.status(400).json({ error: 'Le paramètre "iduser" est obligatoire.' });
    }

    try {
        const { rowCount } = await pool.query(
            'UPDATE user_sessions SET message_lu = TRUE WHERE iduser = $1',
            [iduser]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        res.json({ message: 'Message marqué comme lu' });
    } catch (err) {
        console.error('Erreur PATCH /session/message-read:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;