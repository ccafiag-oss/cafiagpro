const express = require('express');
const router = express.Router();
const pool = require('../config/db');


// ==========================================
// AJOUTER UN COMPTE
// ==========================================

router.post('/finacreercompte', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const {
            idclient, codeclient, idprod, idagence, codecompte,
            frais_ouverture, frais_adhesion, nombre_part_social,
            frais_part_social, codeoperation, iduser, 
            dateoperation, codjrnal, nom_client, codetypescomptes
        } = req.body;

        if (!iduser) {
            throw new Error("L'identifiant utilisateur (iduser) est requis.");
        }

        await client.query('BEGIN');

        // 1. Vérification d'existence
        const checkCompte = await client.query(
            `SELECT idcompte FROM finaclient_comptes WHERE codecompte = $1`, [codecompte]
        );

        if (checkCompte.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Code compte déjà existant' });
        }

        // 2. Génération d'une référence de pièce unique pour l'opération
        const ref_piece = codeoperation;

        const f_ouv = parseFloat(frais_ouverture) || 0;
        const f_adh = parseFloat(frais_adhesion) || 0;
        const n_part = parseInt(nombre_part_social) || 0;
        const f_part = parseFloat(frais_part_social) || 0;

        // 3. Insertion unique dans finaclient_comptes 
        // (Le trigger se chargera de tcomptegeninter et de tmvttheorique automatiquement)
        const sqlInsertCompte = `
            INSERT INTO finaclient_comptes (
                idclient, codeclient, idprod, idagence, codecompte,
                frais_ouverture, frais_adhesion, nombre_part_social, frais_part_social, 
                codeoperation, dateoperation, codetypescomptes, ref_piece, codjrnal, nom_client, iduser
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
            RETURNING idcompte`;

        await client.query(sqlInsertCompte, [
            idclient, codeclient, idprod, idagence, codecompte,
            f_ouv, f_adh, n_part, f_part, codeoperation, dateoperation, 
            codetypescomptes, ref_piece, codjrnal, nom_client, iduser
        ]);

        await client.query('COMMIT'); 
        res.json({ success: true, message: 'Compte créé et comptabilisé automatiquement par le trigger.' });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("Erreur complète:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});


/*
router.post('/finacreercompte', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const {
            idclient, codeclient, idprod, idagence, codecompte,
            frais_ouverture, frais_adhesion, nombre_part_social,
            frais_part_social, codeoperation, iduser, idmois, idannee, 
            dateoperation, codjrnal, nom_client,codetypescomptes // Assurez-vous de passer le nom du client depuis Flutter
        } = req.body;

        if (!iduser) {
            throw new Error("L'identifiant utilisateur (iduser) est requis.");
        }

        await client.query('BEGIN');

        // 1. Vérification existance
        const checkCompte = await client.query(
            `SELECT idcompte FROM finaclient_comptes WHERE codecompte = $1`, [codecompte]
        );

        if (checkCompte.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Code compte déjà existant' });
        }

        // 2. Récupération infos Produit et Caisse
        const prodData = await client.query(
            `SELECT compte_frais_ouverture, compte_frais_adhesion, compte_part_social, designation 
             FROM fina_produitepargne WHERE idprod = $1`, [idprod]
        );

        const caisseData = await client.query(
            `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`, [iduser]
        );

        if (prodData.rows.length === 0 || caisseData.rows.length === 0) {
            throw new Error("Configuration comptable manquante.");
        }

        const infoProd = prodData.rows[0];
        const compteCaisse = caisseData.rows[0].comptecaisse;
        
        const f_ouv = parseFloat(frais_ouverture) || 0;
        const f_adh = parseFloat(frais_adhesion) || 0;
        const n_part = parseInt(nombre_part_social) || 0;
        const f_part = parseFloat(frais_part_social) || 0;
        const totalParts = n_part * f_part;

        // 3. Insertion du compte client
        const sqlInsertCompte = `
            INSERT INTO finaclient_comptes (
                idclient, codeclient, idprod, idagence, codecompte,
                frais_ouverture, frais_adhesion, nombre_part_social, frais_part_social, codeoperation, dateoperation,codetypescomptes
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING idcompte`;

        const resCompte = await client.query(sqlInsertCompte, [
            idclient, codeclient, idprod, idagence, codecompte,
            f_ouv, f_adh, n_part, f_part, codeoperation, dateoperation,codetypescomptes
        ]);

                            // ... juste avant l'insertion dans tcomptegeninter

// 1. Extraction des segments comptables
// idclasse = le tout premier chiffre (ex: "2" pour un compte commençant par 25110)
const idclasse = codecompte.toString().substring(0, 1);

// idcptgen = les 5 premiers chiffres (ex: "25110")
const idcptgen = codecompte.toString().substring(0, 5);

// 2. Insertion dans tcomptegeninter
const sqlInsertInter = `
    INSERT INTO tcomptegeninter(
        idcptintern, date, idcptgen, designationcptint, idclasse, 
        codetiers, nomtiers, idcptinternsage, idag, idagence, 
        codeagence, source, idprod
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`;

await client.query(sqlInsertInter, [
    codecompte,                         // idcptintern (Le compte complet)
    dateoperation,                      // date
    idcptgen,                           // idcptgen (Les 5 premiers chiffres)
    nom_client || 'COMPTE EPARGNE',    // designationcptint
    idclasse,                           // idclasse (Le 1er chiffre)
    codeclient,                         // codetiers
    nom_client,                         // nomtiers
    codecompte,                         // idcptinternsage
    idagence,                           // idag
    idagence,                           // idagence
    'AGENCE',                           // codeagence
    'EPARGNE',                          // source
    idprod                              // idprod
]);

       

        // 5. GÉNÉRATION DES ÉCRITURES COMPTABLES (TMVTTHEORIQUE)
        const ecritures = [
            { libelle: 'FRAIS OUVERTURE', montant: f_ouv, cptCredit: infoProd.compte_frais_ouverture },
            { libelle: 'FRAIS ADHESION', montant: f_adh, cptCredit: infoProd.compte_frais_adhesion },
            { libelle: 'PARTS SOCIALES', montant: totalParts, cptCredit: infoProd.compte_part_social }
        ];

        for (let item of ecritures) {
            if (item.montant > 0) {
                // DEBIT CAISSE
                await client.query(
                    `INSERT INTO TMVTTHEORIQUE (idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE, MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12,$13)`,
                    [codeoperation, dateoperation, codjrnal, compteCaisse, idclient, `DEBIT CAISSE - ${item.libelle}`, item.montant, iduser, idmois, idannee, codeoperation, codeclient, idagence]
                );

                // CREDIT COMPTE PRODUIT/FRAIS
                await client.query(
                    `INSERT INTO TMVTTHEORIQUE (idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE, MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence)
                     VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12,$13)`,
                    [codeoperation, dateoperation, codjrnal, item.cptCredit, idclient, `CREDIT ${item.libelle}`, item.montant, iduser, idmois, idannee, codeoperation, codeclient, idagence]
                );
            }
        }

        await client.query('COMMIT'); 
        res.json({ success: true, message: 'Compte créé, référentiel mis à jour et écritures générées.' });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("Erreur complète:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});
*/




// ==========================================
// LISTE DES COMPTES
// ==========================================
router.get('/selectioncompteclients', async (req, res) => {
    try {
        const { idagence, search } = req.query;

        let sql = `
            SELECT 
                c.*,
                cl.nom,
                cl.prenom,
                p.designation
            FROM finaclient_comptes c
            INNER JOIN finaclients cl 
                ON cl.idclient = c.idclient
            INNER JOIN fina_produitepargne p 
                ON p.idprod = c.idprod
            WHERE 1=1 and c.codetypescomptes='TONT'
        `;

        const params = [];
        let index = 1;

        if (idagence) {
            sql += ` AND c.idagence = $${index}`;
            params.push(idagence);
            index++;
        }

        if (search) {
            sql += `
                AND (
                    c.codecompte ILIKE $${index}
                    OR c.codeclient ILIKE $${index}
                    OR cl.nom ILIKE $${index}
                    OR cl.prenom ILIKE $${index}
                )
            `;
            params.push(`%${search}%`);
            index++;
        }

        sql += ` ORDER BY c.idcompte DESC`;

        const result = await pool.query(sql, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});





// ==========================================
router.get('/listecompteclients', async (req, res) => {
    try {
        const { idagence, search } = req.query;

        let sql = `
            SELECT 
                c.*,
                cl.nom,
                cl.prenom,
                p.designation
            FROM finaclient_comptes c
            INNER JOIN finaclients cl 
                ON cl.idclient = c.idclient
            INNER JOIN fina_produitepargne p 
                ON p.idprod = c.idprod
            WHERE 1=1 
        `;

        const params = [];
        let index = 1;

        if (idagence) {
            sql += ` AND c.idagence = $${index}`;
            params.push(idagence);
            index++;
        }

        if (search) {
            sql += `
                AND (
                    c.codecompte ILIKE $${index}
                    OR c.codeclient ILIKE $${index}
                    OR cl.nom ILIKE $${index}
                    OR cl.prenom ILIKE $${index}
                )
            `;
            params.push(`%${search}%`);
            index++;
        }

        sql += ` ORDER BY c.idcompte DESC`;

        const result = await pool.query(sql, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});



// ==========================================
// DETAIL D'UN COMPTE
// ==========================================
router.get('/:idcompte', async (req, res) => {
    try {
        const { idcompte } = req.params;

        const result = await pool.query(
            `SELECT * 
             FROM finaclient_comptes
             WHERE idcompte = $1`,
            [idcompte]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Compte introuvable'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ==========================================
// MODIFIER UN COMPTE
// ==========================================
router.put('/modifier/:idcompte', async (req, res) => {
    try {
        const { idcompte } = req.params;

        const {
            idclient,
            codeclient,
            idprod,
            idagence,
            codecompte,
            frais_ouverture,
            frais_adhesion,
            nombre_part_social,
            frais_part_social,
            codetypescomptes
            
        } = req.body;

        const sql = `
            UPDATE finaclient_comptes
            SET
                idclient = $1,
                codeclient = $2,
                idprod = $3,
                idagence = $4,
                codecompte = $5,
                frais_ouverture = $6,
                frais_adhesion = $7,
                nombre_part_social = $8,
                frais_part_social = $9,
                codetypescomptes=$10
               
            WHERE idcompte = $11
            RETURNING *
        `;

        const values = [
            idclient,
            codeclient,
            idprod,
            idagence,
            codecompte,
            frais_ouverture,
            frais_adhesion,
            nombre_part_social,
            frais_part_social,
           codetypescomptes,
            idcompte
        ];

        const result = await pool.query(sql, values);

        res.json({
            success: true,
            message: 'Compte modifié avec succès',
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ==========================================
// ACTIVER / DESACTIVER
// ==========================================
router.put('/etat/:idcompte', async (req, res) => {
    try {
        const { idcompte } = req.params;

        const sql = `
            UPDATE finaclient_comptes
            SET etat = NOT etat
            WHERE idcompte = $1
            RETURNING *
        `;

        const result = await pool.query(sql, [idcompte]);

        res.json({
            success: true,
            message: 'Etat modifié',
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ==========================================
// SUPPRIMER
// ==========================================
router.delete('/supprimer/:idcompte', async (req, res) => {
    try {
        const { idcompte } = req.params;

        await pool.query(
            `DELETE FROM finaclient_comptes
             WHERE idcompte = $1`,
            [idcompte]
        );

        res.json({
            success: true,
            message: 'Compte supprimé'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;