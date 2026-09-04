const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/ajouterremboursementagro', async (req, res) => {
    const { 
        coderemb, date_remb, idcampagne, idcooperative, iddemandefinancement, 
        iddecaissementfinancement, idfourn, idagence, iduser, codedec, montant, interet, total 
    } = req.body;

    // Validation des entrées fondamentales
    if (!coderemb || !iduser || !total || parseFloat(total) <= 0) {
        return res.status(400).json({ success: false, message: "Données invalides ou montant total incorrect" });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Récupération et vérification de la caisse utilisateur
        const caisseResult = await client.query(
            'SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1', [iduser]
        );
        if (caisseResult.rows.length === 0) {
            throw new Error('Compte caisse introuvable pour cet utilisateur');
        }

        // Récupération et vérification du fournisseur
        const fournisseurResult = await client.query(
            'SELECT compteauxiliaire FROM gfournisseur WHERE idfourn = $1', [idfourn]
        );
        if (fournisseurResult.rows.length === 0) {
            throw new Error('Compte fournisseur introuvable');
        }

        const dateObj = new Date(date_remb || new Date());
        const periodeMois = dateObj.getMonth() + 1;

        // --- Insertion du remboursement avec capital, intérêts et total ---
        const query = `
            INSERT INTO agro_remboursement (
                coderemb, date_remb, idcampagne, idcooperative, iddemandefinancement, 
                iddecaissementfinancement, idfourn, idagence, iduser, codedec, period, montant, interet, total
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *;
        `;
        const result = await client.query(query, [
            coderemb, 
            date_remb || new Date(), 
            idcampagne, 
            idcooperative, 
            iddemandefinancement, 
            iddecaissementfinancement, 
            idfourn, 
            idagence, 
            iduser, 
            codedec, 
            periodeMois, 
            montant || 0,
            interet || 0,
            total
        ]);

        // --- RECALCULS ET MISES À JOUR DES TOTAUX ---
        
        // 1. Calcul des sommes cumulées (capital remboursé ET intérêts remboursés)
        const sumResult = await client.query(
            `SELECT 
                COALESCE(SUM(montant), 0) as total_capital,
                COALESCE(SUM(interet), 0) as total_interet
             FROM agro_remboursement 
             WHERE iddecaissementfinancement = $1`, 
            [iddecaissementfinancement]
        );

        const v_somme_capital = sumResult.rows[0].total_capital;
        const v_somme_interet = sumResult.rows[0].total_interet;

        // 2. Mise à jour de la fiche de décaissement (capital amorti + intérêts remboursés)
        await client.query(
            `UPDATE agro_decaissement_financement 
             SET montantrembourse = $1, interetremb = $2 
             WHERE iddecaissementfinancement = $3`, 
            [v_somme_capital, v_somme_interet, iddecaissementfinancement]
        );

        // 3. Mise à jour de la demande de financement associée
        await client.query(
            `UPDATE agro_demande_financement 
             SET montantrembourse = $1, interetremb = $2 
             WHERE iddemandefinancement = $3`, 
            [v_somme_capital, v_somme_interet, iddemandefinancement]
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur transaction remboursement agro:', error);
        res.status(500).json({ success: false, message: error.message || "Erreur interne du serveur" });
    } finally {
        client.release();
    }
});







// 1. Lister les remboursements groupés par Coopérative et par Fournisseur
router.get('/listremboursementsagro', async (req, res) => {
    try {
        const query = `
            SELECT 
                r.idremboursement,
                r.coderemb,
                r.date_remb,
                r.montant,
                r.interet,
                r.total,
                r.codedec,
                r.iddecaissementfinancement,
                r.iddemandefinancement,
                c.idcooperative,
                c.codecooperative,
                c.raisonsociale AS cooperativenom,
                f.idfourn,
                f.codefournisseurs,
                f.nomcomplet AS fournisseurspremiernom
            FROM agro_remboursement r
            JOIN fina_cooperative c ON r.idcooperative = c.idcooperative
            JOIN gfournisseur f ON r.idfourn = f.idfourn
            ORDER BY c.raisonsociale, f.nomcomplet, r.date_remb DESC;
        `;
        const result = await pool.query(query);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Erreur liste remboursements agro:', error);
        res.status(500).json({ success: false, message: error.message || "Erreur serveur" });
    }
});

// 2. Annuler un remboursement et réajuster les soldes
router.delete('/annulerremboursementagro/:idremboursement', async (req, res) => {
    const { idremboursement } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Récupérer le remboursement à annuler pour connaître les montants et les IDs liés
        const rembResult = await client.query(
            'SELECT * FROM agro_remboursement WHERE idremboursement = $1',
            [idremboursement]
        );

        if (rembResult.rows.length === 0) {
            throw new Error('Remboursement introuvable');
        }

        const remb = rembResult.rows[0];
        const { iddecaissementfinancement, iddemandefinancement } = remb;

        // Supprimer le remboursement
        await client.query('DELETE FROM agro_remboursement WHERE idremboursement = $1', [idremboursement]);

        // Recalculer les totaux restants pour ce décaissement
        const sumResult = await client.query(
            `SELECT 
                COALESCE(SUM(montant), 0) as total_capital,
                COALESCE(SUM(interet), 0) as total_interet
             FROM agro_remboursement 
             WHERE iddecaissementfinancement = $1`,
            [iddecaissementfinancement]
        );

        const v_somme_capital = sumResult.rows[0].total_capital;
        const v_somme_interet = sumResult.rows[0].total_interet;

        // Mettre à jour la fiche de décaissement
        await client.query(
            `UPDATE agro_decaissement_financement 
             SET montantrembourse = $1, interetremb = $2 
             WHERE iddecaissementfinancement = $3`,
            [v_somme_capital, v_somme_interet, iddecaissementfinancement]
        );

        // Mettre à jour la demande de financement associée
        await client.query(
            `UPDATE agro_demande_financement 
             SET montantrembourse = $1, interetremb = $2 
             WHERE iddemandefinancement = $3`,
            [v_somme_capital, v_somme_interet, iddemandefinancement]
        );

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: 'Remboursement annulé avec succès' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur annulation remboursement agro:', error);
        res.status(500).json({ success: false, message: error.message || "Erreur lors de l'annulation" });
    } finally {
        client.release();
    }
});













module.exports = router;




/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/ajouterremboursementagro', async (req, res) => {
    // 1. Validation de base des entrées
    const { 
        coderemb, date_remb, idcampagne, idcooperative, iddemandefinancement, 
        iddecaissementfinancement, idfourn, idagence, iduser, codedec, montant 
    } = req.body;

    if (!coderemb || !iduser || !montant || montant <= 0) {
        return res.status(400).json({ success: false, message: "Données invalides ou montant incorrect" });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Récupération et vérification préalable de la caisse
        const caisseResult = await client.query(
            'SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1', [iduser]
        );
        if (caisseResult.rows.length === 0) {
            throw new Error('Compte caisse introuvable pour cet utilisateur');
        }

        // Récupération et vérification préalable du fournisseur
        const fournisseurResult = await client.query(
            'SELECT compteauxiliaire FROM gfournisseur WHERE idfourn = $1', [idfourn]
        );
        if (fournisseurResult.rows.length === 0) {
            throw new Error('Compte fournisseur introuvable');
        }

        const dateObj = new Date(date_remb || new Date());
        const periodeMois = dateObj.getMonth() + 1; // Calcul automatique du mois pour la période

        // --- Insertion du remboursement ---
        // Le trigger PostgreSQL prendra automatiquement le relais après l'insertion
        const query = `
            INSERT INTO agro_remboursement (
                coderemb, date_remb, idcampagne, idcooperative, iddemandefinancement, 
                iddecaissementfinancement, idfourn, idagence, iduser, codedec, period, montant
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *;
        `;
        const result = await client.query(query, [
            coderemb, 
            date_remb || new Date(), 
            idcampagne, 
            idcooperative, 
            iddemandefinancement, 
            iddecaissementfinancement, 
            idfourn, 
            idagence, 
            iduser, 
            codedec, 
            periodeMois, 
            montant
        ]);

        // --- MISE À JOUR DES TOTAUX DE REMBOURSEMENT ---
        // 1. Calcul de la somme totale remboursée pour ce décaissement
        const sumResult = await client.query(
            'SELECT COALESCE(SUM(montant), 0) as total FROM agro_remboursement WHERE iddecaissementfinancement = $1', 
            [iddecaissementfinancement]
        );

        const v_somme = sumResult.rows[0].total;

        // 2. Mise à jour de la table de décaissement
        await client.query(
            'UPDATE agro_decaissement_financement SET montantrembourse = $1 WHERE iddecaissementfinancement = $2', 
            [v_somme, iddecaissementfinancement]
        );

        // 3. Mise à jour de la demande de financement initiale
        await client.query(
            'UPDATE agro_demande_financement SET montantrembourse = $1 WHERE iddemandefinancement = $2', 
            [v_somme, iddemandefinancement]
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur de transaction pour le remboursement:', error);
        res.status(500).json({ success: false, message: error.message || "Erreur interne du serveur" });
    } finally {
        client.release(); // Libération indispensable du client de connexion
    }
});

module.exports = router;

*/


/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
// Assurez-vous d'importer votre fonction ou de l'inclure
// const { passerEcriture } = require('../utils/compta'); 

router.post('/ajouterremboursementagro', async (req, res) => {
    // 1. Validation de base des entrées
    const { coderemb, date_remb, idcampagne, idcooperative, iddemandefinancement, 
            iddecaissementfinancement, idfourn, idagence, iduser, codedec, period, montant } = req.body;

    if (!coderemb || !iduser || !montant || montant <= 0) {
        return res.status(400).json({ success: false, message: "Données invalides ou montant incorrect" });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Récupération compte caisse
        const caisseResult = await client.query(
            'SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1', [iduser]
        );
        if (caisseResult.rows.length === 0) throw new Error('Compte caisse introuvable');
        const compteCaisse = caisseResult.rows[0].comptecaisse;

        // Récupération compte fournisseur
        const fournisseurResult = await client.query(
            'SELECT compteauxiliaire FROM gfournisseur WHERE idfourn = $1', [idfourn]
        );
        if (fournisseurResult.rows.length === 0) throw new Error('Compte fournisseur introuvable');
        const compteFournisseur = fournisseurResult.rows[0].compteauxiliaire;

        const d = new Date(date_remb);
        const codjrnal = 1;

        const periodeMois = new Date(date_remb).getMonth() + 1;

        // --- Écritures comptables ---
        // Assurez-vous que passerEcriture attend (client, [tableau_valeurs])
        await passerEcriture(client, [coderemb, d, codjrnal, compteCaisse, idfourn, `REMBOURSEMENT CREDIT ${codedec}`, montant, 0, iduser, d.getMonth() + 1, d.getFullYear(), coderemb, codedec, idagence,idfourn]);
        await passerEcriture(client, [coderemb, d, codjrnal, compteFournisseur, idfourn, `REMBOURSEMENT CREDIT ${codedec}`, 0, montant, iduser, d.getMonth() + 1, d.getFullYear(), coderemb, codedec, idagence,idfourn]);

        // --- Insertion du remboursement ---
        const query = `
            INSERT INTO agro_remboursement (coderemb, date_remb, idcampagne, idcooperative, iddemandefinancement, iddecaissementfinancement, idfourn, idagence, iduser, codedec, period, montant)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *;
        `;
        const result = await client.query(query, [coderemb, date_remb, idcampagne, idcooperative, iddemandefinancement, iddecaissementfinancement, idfourn, idagence, iduser, codedec, periodeMois, montant]);



        // ... après avoir inséré dans agroremboursement (ligne result = await client.query(...))

// --- MISE À JOUR DES TOTAUX (Optimisation) ---

/*
const updateQuery = `
    DO $$
    DECLARE
        v_somme NUMERIC;
    BEGIN
        SELECT COALESCE(SUM(montant), 0) INTO v_somme 
        FROM agroremboursement 
        WHERE iddecaissementfinancement = $1;

        UPDATE agro_decaissement_financement 
        SET montantrembourse = v_somme 
        WHERE iddecaissementfinancement = $1;

        UPDATE agro_demande_financement 
        SET montantrembourse = v_somme 
        WHERE iddecaissementfinancement = $1;
    END $$;
`;

await client.query(updateQuery, [iddecaissementfinancement]);
*/


/*
// --- MISE À JOUR DES TOTAUX (Corrigé) ---
// On calcule d'abord la somme dans Node ou avec une requête séparée
const sumResult = await client.query(
    'SELECT COALESCE(SUM(montant), 0) as total FROM agro_remboursement WHERE iddecaissementfinancement = $1', 
    [iddecaissementfinancement]
);

const v_somme = sumResult.rows[0].total;

// Ensuite on met à jour les deux tables sans utiliser DO $$
await client.query(
    'UPDATE agro_decaissement_financement SET montantrembourse = $1 WHERE iddecaissementfinancement = $2', 
    [v_somme, iddecaissementfinancement]
);

await client.query(
    'UPDATE agro_demande_financement SET montantrembourse = $1 WHERE iddemandefinancement = $2', 
    [v_somme, iddemandefinancement]
);




        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur transaction:', error); // Pour le débogage serveur
        res.status(500).json({ success: false, message: error.message || "Erreur interne du serveur" });
    } finally {
        client.release(); // Crucial pour éviter les fuites de connexion
    }
});


async function passerEcriture(client, params) {
    const query = `
        INSERT INTO TMVTTHEORIQUE (
            idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
            MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
            CODFACT, REFTIERS, idagence,idclient
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,$15
        )`;
    return await client.query(query, params);
}

module.exports = router;
*/