const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');

// ===============================
// MULTER CONFIGURATION (upload fichiers)
// ===============================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

// ===============================
// FONCTION UTILITAIRE
// ===============================
function generateChatId(phone1, phone2) {
    return [phone1, phone2].sort().join('_');
}

// ===============================
// 1️⃣ ENVOYER MESSAGE
// ===============================
router.post('/send-message', upload.single('media'), async (req, res) => {
    const { sender, receiver, text, type } = req.body;
    let fileUrl = null;

    if (!sender || !receiver) return res.status(400).json({ error: "Numéros requis" });
    if (req.file) fileUrl = `/uploads/${req.file.filename}`;

    const chatId = generateChatId(sender, receiver);

    try {
        let conversation = await pool.query(`SELECT * FROM conversations WHERE chat_id = $1`, [chatId]);
        let conversationId;
        if (conversation.rows.length === 0) {
            const newConv = await pool.query(
                `INSERT INTO conversations (chat_id) VALUES ($1) RETURNING id`,
                [chatId]
            );
            conversationId = newConv.rows[0].id;
        } else conversationId = conversation.rows[0].id;

        const result = await pool.query(
            `INSERT INTO messages 
            (conversation_id, sender_phone, receiver_phone, message_text, message_type, file_url)
            VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [conversationId, sender, receiver, text || '', type || 'text', fileUrl]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur envoi message" });
    }
});

// ===============================
// 2️⃣ RÉCUPÉRER MESSAGES D'UNE CONVERSATION
// ===============================

/*
router.get('/conversation/:sender/:receiver/:myPhone', async (req, res) => {
    const { sender, receiver, myPhone } = req.params;
    const chatId = generateChatId(sender, receiver);

    try {
        const conversation = await pool.query(`SELECT * FROM conversations WHERE chat_id = $1`, [chatId]);
        if (conversation.rows.length === 0) return res.json([]);

        const conversationId = conversation.rows[0].id;

        const messages = await pool.query(
            `SELECT m.*, COALESCE(c.contact_name, m.sender_phone) AS display_name
             FROM messages m
             LEFT JOIN contacts c
             ON c.contact_phone = m.sender_phone AND c.user_phone = $2
             WHERE m.conversation_id = $1
             ORDER BY m.timestamp ASC`,
            [conversationId, myPhone]
        );

        res.json(messages.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur récupération messages" });
    }
});

*/

// ===============================
// RÉCUPÉRER MESSAGES D'UNE CONVERSATION (Corrigé)
// ===============================
router.get('/conversation/:myPhone/:otherPhone', async (req, res) => {
    const { myPhone, otherPhone } = req.params;
    const chatId = generateChatId(myPhone, otherPhone);

    try {
        const conversation = await pool.query(`SELECT id FROM conversations WHERE chat_id = $1`, [chatId]);
        if (conversation.rows.length === 0) return res.json([]);

        const conversationId = conversation.rows[0].id;

        const messages = await pool.query(
            `SELECT m.*, COALESCE(c.contact_name, m.sender_phone) AS display_name
             FROM messages m
             LEFT JOIN contacts c ON c.contact_phone = m.sender_phone AND c.user_phone = $2
             WHERE m.conversation_id = $1
             ORDER BY m.timestamp ASC`,
            [conversationId, myPhone]
        );

        res.json(messages.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur récupération messages" });
    }
});








// ===============================
// 3️⃣ AJOUTER UN CONTACT
// ===============================
router.post('/add-contact', async (req, res) => {
    const { user_phone, contact_phone, contact_name } = req.body;
    if (!user_phone || !contact_phone || !contact_name) return res.status(400).json({ error: "Champs requis" });

    try {
        const result = await pool.query(
            `INSERT INTO contacts (user_phone, contact_phone, contact_name)
             VALUES ($1,$2,$3) RETURNING *`,
            [user_phone, contact_phone, contact_name]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur ajout contact" });
    }
});

// ===============================
// 4️⃣ LISTE DES CONTACTS D'UN UTILISATEUR
// ===============================
router.get('/contacts/:userPhone', async (req, res) => {
    const { userPhone } = req.params;

    try {
        const contacts = await pool.query(
            `SELECT * FROM contacts WHERE user_phone = $1 ORDER BY contact_name ASC`,
            [userPhone]
        );
        res.json(contacts.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur récupération contacts" });
    }
});

// ===============================
// 5️⃣ LISTE DES CONVERSATIONS D'UN UTILISATEUR
// ===============================
router.get('/my-conversations/:myPhone', async (req, res) => {
    const { myPhone } = req.params;

    try {
        const result = await pool.query(
            `SELECT DISTINCT ON (c.id) c.id, c.chat_id, m.message_text, m.timestamp, m.sender_phone,
             COALESCE(ct.contact_name, m.sender_phone) AS display_name
             FROM conversations c
             JOIN messages m ON m.conversation_id = c.id
             LEFT JOIN contacts ct 
             ON ct.contact_phone = CASE WHEN m.sender_phone = $1 THEN m.receiver_phone ELSE m.sender_phone END
             AND ct.user_phone = $1
             WHERE c.chat_id LIKE '%' || $1 || '%'
             ORDER BY c.id, m.timestamp DESC`,
            [myPhone]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur récupération conversations" });
    }
});

// ===============================
// 6️⃣ SUPPRIMER UN MESSAGE
// ===============================
router.delete('/message/:messageId', async (req, res) => {
    const { messageId } = req.params;

    try {
        const result = await pool.query(`DELETE FROM messages WHERE id = $1 RETURNING *`, [messageId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Message non trouvé" });
        res.json({ success: true, deleted: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur suppression message" });
    }
});

// ===============================
// 7️⃣ SUPPRIMER UNE CONVERSATION
// ===============================
router.delete('/conversation/:chatId', async (req, res) => {
    const { chatId } = req.params;

    try {
        const conv = await pool.query(`DELETE FROM conversations WHERE chat_id = $1 RETURNING *`, [chatId]);
        if (conv.rows.length === 0) return res.status(404).json({ error: "Conversation non trouvée" });
        res.json({ success: true, deleted: conv.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur suppression conversation" });
    }
});

module.exports = router;