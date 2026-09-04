const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// --- 1. INSERTION (POST) ---
router.post('/operation-tontine', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            codeoperation, dateoperation, idcarnet, idclient, idprod, idcycle,
            iduser, idagence, codeclient, codecompte, designation, libelle,
            montant, typesoperation, solde, case_selectionne, position_case,
            comptetontine, compteTontine, compteDestination, codjrnal, ref_piece
        } = req.body;

        const v_comptetontine = comptetontine || compteTontine;

        if (!ref_piece) {
            throw new Error("La référence de pièce (ref_piece) est obligatoire.");
        }

        const query = `
            INSERT INTO fina_operation_tontine (
                codeoperation, dateoperation, idcarnet, idclient, idprod, idcycle,
                iduser, idagence, codeclient, codecompte, designation, libelle,
                montant, typesoperation, solde, case_selectionne, position_case,
                comptetontine, comptedestination, codjrnal, ref_piece
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            RETURNING *`;

        const values = [
            codeoperation, dateoperation, idcarnet, idclient, idprod, idcycle,
            iduser, idagence, codeclient, codecompte, designation, libelle,
            montant, typesoperation, solde || 0, case_selectionne, position_case || 0,
            v_comptetontine, compteDestination || null, codjrnal, ref_piece
        ];

        const result = await client.query(query, values);

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERREUR SQL DÉTAILLÉE :", err.message, err.detail, err.hint, err.stack);
        res.status(500).json({ success: false, message: err.message, detail: err.detail });
    } finally {
        client.release();
    }
});

// --- 2. MISE A JOUR (PUT) ---
router.put('/operation-tontine/:idoperation', async (req, res) => {
    const client = await pool.connect();
    const { idoperation } = req.params;
    try {
        await client.query('BEGIN');

        const {
            codeoperation, dateoperation, idcarnet, idclient, idprod, idcycle,
            iduser, idagence, codeclient, codecompte, designation, libelle,
            montant, typesoperation, solde, case_selectionne, position_case,
            comptetontine, compteTontine, compteDestination, codjrnal, ref_piece
        } = req.body;

        const v_comptetontine = comptetontine || compteTontine;

        if (!ref_piece) {
            throw new Error("La référence de pièce (ref_piece) est obligatoire pour la mise à jour.");
        }

        // Étape optionnelle de sécurité : nettoyer d'abord les anciennes écritures théoriques liées à cet ID
        // pour éviter tout doublon ou persistance résiduelle avant la mise à jour des champs
        await client.query(`DELETE FROM public.tmvttheorique WHERE idmouvement = $1`, [idoperation]);

        const query = `
            UPDATE fina_operation_tontine SET
                codeoperation = $1, dateoperation = $2, idcarnet = $3, idclient = $4, 
                idprod = $5, idcycle = $6, iduser = $7, idagence = $8, codeclient = $9, 
                codecompte = $10, designation = $11, libelle = $12, montant = $13, typesoperation = $14, 
                solde = $15, case_selectionne = $16, position_case = $17, 
                comptetontine = $18, comptedestination = $19, codjrnal = $20, ref_piece = $21
            WHERE idoperation = $22
            RETURNING *`;

        const values = [
            codeoperation, dateoperation, idcarnet, idclient, idprod, idcycle,
            iduser, idagence, codeclient, codecompte, designation, libelle,
            montant, typesoperation, solde || 0, case_selectionne, position_case || 0,
            v_comptetontine, compteDestination || null, codjrnal, ref_piece, idoperation
        ];

        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            throw new Error("Opération tontine introuvable.");
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, data: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERREUR SQL DÉTAILLÉE :", err.message, err.detail, err.hint, err.stack);
        res.status(500).json({ success: false, message: err.message, detail: err.detail });
    } finally {
        client.release();
    }
});

// --- 3. SUPPRESSION (DELETE) ---
router.delete('/operation-tontine/:idoperation', async (req, res) => {
    const client = await pool.connect();
    const { idoperation } = req.params;
    try {
        await client.query('BEGIN');

        // Nettoyage explicite préalable dans tmvttheorique avant de supprimer l'opération
        await client.query(`DELETE FROM public.tmvttheorique WHERE idmouvement = $1`, [idoperation]);

        const result = await client.query(
            `DELETE FROM fina_operation_tontine WHERE idoperation = $1 RETURNING *`, 
            [idoperation]
        );

        if (result.rows.length === 0) {
            throw new Error("Opération tontine introuvable.");
        }

        await client.query('COMMIT');
        res.status(200).json({ 
            success: true, 
            message: "Opération tontine et écritures comptables associées supprimées avec succès." 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERREUR SQL DÉTAILLÉE :", err.message, err.detail, err.hint, err.stack);
        res.status(500).json({ success: false, message: err.message, detail: err.detail });
    } finally {
        client.release();
    }
});



/*
router.post('/operation-tontine', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            codeoperation, dateoperation, idcarnet, idclient, idprod, idcycle,
            iduser, idagence, codeclient, codecompte, designation, libelle,
            montant, typesoperation, solde, case_selectionne, position_case,
            compteTontine, compteDestination, codjrnal, idmois, idannee
        } = req.body;

        // 1. Récupération du compte caisse de l'utilisateur (pour dépôts/retraits)
        const caisseResult = await client.query(
            `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`, [iduser]
        );

        if (caisseResult.rows.length === 0 && typesoperation !== 'transfert') {
            throw new Error("Configuration comptable manquante (Caisse).");
        }
        
        const compteCaisseEffective = caisseResult.rows[0]?.comptecaisse;

        // 2. Enregistrer l'opération principale
        const result = await client.query(
            `INSERT INTO fina_operation_tontine (
                codeoperation, dateoperation, idcarnet, idclient, idprod, idcycle,
                iduser, idagence, codeclient, codecompte, designation, libelle,
                montant, typesoperation, solde, case_selectionne, position_case
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
            RETURNING *`,
            [
                codeoperation, dateoperation, idcarnet, idclient, idprod, idcycle,
                iduser, idagence, codeclient, codecompte, designation, libelle,
                montant, typesoperation, solde || 0, case_selectionne, position_case || 0
            ]
        );

        // 3. Logique des écritures comptables (TMVTTHEORIQUE)
        
        if (typesoperation === 'depot') {
            // DEBIT CAISSE / CREDIT TONTINE
            await passerEcriture(client, [idcarnet, dateoperation, codjrnal, compteCaisseEffective, idclient, `DEPOT CAISSE - ${designation}`, montant, 0, iduser, idmois, idannee, codeoperation, codeclient, idagence]);
            await passerEcriture(client, [idcarnet, dateoperation, codjrnal, compteTontine, idclient, `DEPOT TONTINE - ${designation}`, 0, montant, iduser, idmois, idannee, codeoperation, codeclient, idagence]);

        } else if (typesoperation === 'retrait') {
            // DEBIT TONTINE / CREDIT CAISSE
            await passerEcriture(client, [idcarnet, dateoperation, codjrnal, compteTontine, idclient, `RETRAIT TONTINE - ${designation}`, montant, 0, iduser, idmois, idannee, codeoperation, codeclient, idagence]);
            await passerEcriture(client, [idcarnet, dateoperation, codjrnal, compteCaisseEffective, idclient, `RETRAIT CAISSE - ${designation}`, 0, montant, iduser, idmois, idannee, codeoperation, codeclient, idagence]);

        } else if (typesoperation === 'transfert') {
            // DEBIT COMPTE SOURCE (Tontine actuelle)
            await passerEcriture(client, [idcarnet, dateoperation, codjrnal, compteTontine, idclient, `TRANSFERT SORTANT - ${designation}`, montant, 0, iduser, idmois, idannee, codeoperation, codeclient, idagence]);
            
            // CREDIT COMPTE DESTINATION
            if (!compteDestination) throw new Error("Compte destination manquant pour le transfert.");
            
            await passerEcriture(client, [idcarnet, dateoperation, codjrnal, compteDestination, idclient, `TRANSFERT ENTRANT - ${designation}`, 0, montant, iduser, idmois, idannee, codeoperation, codeclient, idagence]);
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});
*/

/**
 * Fonction utilitaire pour éviter la répétition des inserts TMVTTHEORIQUE
 */
/*
async function passerEcriture(client, params) {
    const query = `
        INSERT INTO TMVTTHEORIQUE (
            idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
            MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS,
            IDANNEE, CODFACT, REFTIERS, idagence
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`;
    return client.query(query, params);
}

*/




module.exports = router;