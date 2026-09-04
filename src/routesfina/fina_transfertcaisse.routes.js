const express = require('express');
const router = express.Router();
const pool = require('../config/db');




router.post('/transferercaisse', async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            codetransf,
            codetypeop,
            codejrnl,
            codemodelop,
            date,
            iduseremeteur,
            iduserdestinateur,
            comptecaisseemeteur,
            comptecaissedestinateur,
            idagence,
            datevalidation,
            montant,
            codeop,
            libele
        } = req.body;

        // Vérification des champs obligatoires
        if (!codetransf || !iduseremeteur || !iduserdestinateur || !montant || !idagence) {
            return res.status(400).json({ error: 'Champs obligatoires manquants.' });
        }

        await client.query('BEGIN');

        // 1️⃣ Récupérer le prénom de l'émetteur
        const caisseemeteurResult = await client.query(
            `
            SELECT prenom FROM public.utilisateur 
            WHERE iduser = $1
            `,
            [iduseremeteur]
        );

        if (caisseemeteurResult.rows.length === 0) {
            throw new Error('Émetteur non trouvé');
        }
        const prenomEmetteur = caisseemeteurResult.rows[0].prenom;

        // 2️⃣ Récupérer le prénom du destinataire
        const caissedestiResult = await client.query(
            `
            SELECT prenom FROM public.utilisateur 
            WHERE iduser = $1
            `,
            [iduserdestinateur]
        );

        if (caissedestiResult.rows.length === 0) {
            throw new Error('Caisse destinatrice non trouvée');
        }
        const prenomDestinateur = caissedestiResult.rows[0].prenom;

        // 3️⃣ Construction dynamique du libellé
        const construitLibelle = libele

        // 4️⃣ Insertion dans la table transfertcaisse
        const insertTransfertQuery = `
            INSERT INTO transfertcaisse (
                codetransf, codetypeop, codejrnl, codemodelop, date,
                iduseremeteur, iduserdestinateur,
                comptecaisseemeteur, comptecaissedestinateur,
                idagence, datevalidation, ref_piece, montant, libele
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *;
        `;
        
        const transfertValues = [
            codetransf, 
            codetypeop, 
            codejrnl || null, 
            codemodelop || null, 
            date,
            iduseremeteur, 
            iduserdestinateur, 
            comptecaisseemeteur, 
            comptecaissedestinateur,
            idagence, 
            datevalidation || null,
            codetransf, // ref_piece
            montant,
            construitLibelle // Utilisation du libellé dynamique construit
        ];

        const result = await client.query(insertTransfertQuery, transfertValues);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Transfert effectué avec succès (Mouvements comptables générés)',
            codetransf: codetransf,
            data: result.rows[0]
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur transaction:', err.message);
        res.status(500).json({
            error: 'Erreur lors du transfert',
            details: err.message
        });
    } finally {
        client.release();
    }
});





// =========================================================================
// 1. LISTER LES TRANSFERTS ENTRE DEUX DATES
// =========================================================================
router.get('/transfertscaisse', async (req, res) => {
    try {
        const { dateDebut, dateFin, idagence } = req.query;

        if (!dateDebut || !dateFin) {
            return res.status(400).json({ error: 'Les dates de début et de fin sont requises.' });
        }

        let query = `
            SELECT 
                t.*,
                u1.nom AS nom_emetteur, u1.prenom AS prenom_emetteur,
                u2.nom AS nom_destinataire, u2.prenom AS prenom_destinataire
            FROM transfertcaisse t
            LEFT JOIN public.utilisateur u1 ON t.iduseremeteur::text = u1.iduser::text
            LEFT JOIN public.utilisateur u2 ON t.iduserdestinateur::text = u2.iduser::text
            WHERE DATE(t.date) >= $1 AND DATE(t.date) <= $2
        `;

        const values = [dateDebut, dateFin];

        if (idagence) {
            values.push(idagence);
            query += ` AND t.idagence = $${values.length}`;
        }

        query += ` ORDER BY t.date DESC, t.id DESC;`;

        const result = await pool.query(query, values);

        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        console.error('Erreur listing transferts:', err.message);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des transferts.' });
    }
});

// =========================================================================
// 2. MODIFIER COMPLETEMENT UN TRANSFERT
// =========================================================================
router.put('/transfertcaisse/:codetransf', async (req, res) => {
    const client = await pool.connect();
    try {
        const { codetransf } = req.params;
        const {
            codetypeop,
            codejrnl,
            codemodelop,
            date,
            iduseremeteur,
            iduserdestinateur,
            comptecaisseemeteur,
            comptecaissedestinateur,
            idagence,
            datevalidation,
            montant,
            libele,
            ref_piece
        } = req.body;

        await client.query('BEGIN');

        // Vérifier si le transfert existe
        const check = await client.query('SELECT * FROM transfertcaisse WHERE codetransf = $1', [codetransf]);
        if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Transfert introuvable.' });
        }

        const updateQuery = `
            UPDATE transfertcaisse SET
                codetypeop = $1,
                codejrnl = $2,
                codemodelop = $3,
                date = $4,
                iduseremeteur = $5,
                iduserdestinateur = $6,
                comptecaisseemeteur = $7,
                comptecaissedestinateur = $8,
                idagence = $9,
                datevalidation = $10,
                montant = $11,
                libele = $12,
                ref_piece = $13
            WHERE codetransf = $14
            RETURNING *;
        `;

        const values = [
            codetypeop || 'TRANSF',
            codejrnl || 'CAISSE',
            codemodelop || 'TRANSF',
            date,
            iduseremeteur,
            iduserdestinateur,
            comptecaisseemeteur,
            comptecaissedestinateur,
            idagence,
            datevalidation || null,
            montant,
            libele,
            ref_piece || codetransf,
            codetransf
        ];

        const result = await client.query(updateQuery, values);

        await client.query('COMMIT');

        res.status(200).json({
            message: 'Transfert mis à jour avec succès.',
            data: result.rows[0]
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur mise à jour transfert:', err.message);
        res.status(500).json({ error: 'Erreur lors de la modification', details: err.message });
    } finally {
        client.release();
    }
});

// =========================================================================
// 3. SUPPRIMER UN TRANSFERT
// =========================================================================
router.delete('/transfertcaisse/:codetransf', async (req, res) => {
    const client = await pool.connect();
    try {
        const { codetransf } = req.params;

        await client.query('BEGIN');

        const deleteQuery = `DELETE FROM transfertcaisse WHERE codetransf = $1 RETURNING *;`;
        const result = await client.query(deleteQuery, [codetransf]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Transfert non trouvé.' });
        }

        await client.query('COMMIT');

        res.status(200).json({
            message: 'Transfert supprimé avec succès.',
            deleted: result.rows[0]
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur suppression transfert:', err.message);
        res.status(500).json({ error: 'Erreur lors de la suppression', details: err.message });
    } finally {
        client.release();
    }
});










/*
router.post('/transferercaisseOLDE', async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            codetransf,
            codetypeop,
            codejrnl,
            codemodelop,
            date,
            iduseremeteur,
            iduserdestinateur,
            comptecaisseemeteur, // C'est l'idcptgn de l'émetteur
            comptecaissedestinateur, // C'est l'idcptgn du destinataire
            idagence,
            datevalidation,
            iduser, // L'utilisateur qui effectue la saisie
            montant,
            libele,
            codeop
        } = req.body;

        // Vérification des champs obligatoires
        if (!codetransf || !iduseremeteur || !iduserdestinateur || !montant || !idagence) {
            return res.status(400).json({ error: 'Champs obligatoires manquants.' });
        }

        await client.query('BEGIN');

        // 1️⃣ Insertion dans la table transfertcaisse
        const insertTransfertQuery = `
            INSERT INTO transfertcaisse (
                codetransf, codetypeop, codejrnl, codemodelop, date,
                iduseremeteur, iduserdestinateur,
                comptecaisseemeteur, comptecaissedestinateur,
                idagence, datevalidation
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING *;
        `;
        const transfertValues = [
            codetransf, codetypeop, codejrnl || null, codemodelop || null, date,
            iduseremeteur, iduserdestinateur, comptecaisseemeteur, comptecaissedestinateur,
            idagence, datevalidation || null
        ];
        await client.query(insertTransfertQuery, transfertValues);

        // 2️⃣ Préparation de l'insertion dans tmvttheorique
        const insertMvtt = `
            INSERT INTO tmvttheorique(idtmvth,
                date, codjrl, idcptgn, idtiers, libelle,
                montantdebit, montantcredit, iduser, idagence, codfact
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);
        `;

        const commonLibelle = libele || `Transfert caisse ${codetransf}`;
        const commonJournal = codejrnl || 'CAISSE';

        // --- MOUVEMENT CRÉDIT (Émetteur / Sortie de fonds) ---
        const valuesEmetteur = [
            codetransf,
            date, 
            commonJournal,
            comptecaisseemeteur, // idcptgn source
            iduseremeteur,       // idtiers
            commonLibelle,
            0,                   // montantdebit
            montant,             // montantcredit
            iduseremeteur, 
            idagence,
            codetransf           // codfact
        ];
        await client.query(insertMvtt, valuesEmetteur);

        // --- MOUVEMENT DÉBIT (Destinataire / Entrée de fonds) ---
        const valuesDestinateur = [
            codetransf,
            date, 
            commonJournal,
            comptecaissedestinateur, // idcptgn destination
            iduserdestinateur,       // idtiers
            commonLibelle,
            montant,                 // montantdebit
            0,                       // montantcredit
            iduserdestinateur, 
            idagence,
            codetransf               // codfact
        ];
        await client.query(insertMvtt, valuesDestinateur);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Transfert effectué avec succès (Mouvements comptables générés)',
            codetransf: codetransf
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur transaction:', err.message);
        res.status(500).json({
            error: 'Erreur lors du transfert',
            details: err.message
        });
    } finally {
        client.release();
    }
});

*/

module.exports = router;