const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ===============================================
// LISTE DES CARNETS
// GET /api/affichercarnettontine/:idagence?search=test

// ✅ Afficher avec recherche dynamique
router.get('/affichercarnettontine/:idagence', async (req, res) => {
  const { idagence } = req.params;
  const { search } = req.query; // ?search=xxx

  try {
    let query = `SELECT * FROM fina_carnet_tontine WHERE idagence = $1`;
    let values = [idagence];

    if (search && search.length >= 3) {
      query += ` AND (LOWER(designation) LIKE LOWER($2) OR LOWER(codecarnet) LIKE LOWER($2))`;
      values.push(`%${search}%`);
    }

    query += ` ORDER BY idcarnet DESC`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur SQL:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des carnets tontine' });
  }
});





// ✅ Créer un carnet tontine
router.post('/carnettontine', async (req, res) => {
  const {
    codecarnet, idtypescarnet, durree, idclient, codeclient,
    designation, codecompte, idagence, idprod, idcycle, iduser,
    mise, solde, prixvente, case_selectionne, cycles, position_case,
    codjrnal, dateoperation, idmois, idannee, nom_client
  } = req.body;

  if (!codecarnet || !idclient || !idagence || !iduser) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Génération d'une référence de pièce unique pour l'opération
    const ref_piece = codecarnet;
    const dateOp = dateoperation || new Date();
    const moisCalcul = idmois || new Date(dateOp).getMonth() + 1;
    const anneeCalcul = idannee || new Date(dateOp).getFullYear();

    // Insertion du carnet (le trigger s'occupe de la comptabilisation dans tmvttheorique)
    const result = await client.query(
      `INSERT INTO fina_carnet_tontine
       (codecarnet, idtypescarnet, durree, idclient, codeclient, designation, codecompte,
        idagence, idprod, idcycle, iduser, mise, solde, prixvente,
        case_selectionne, cycles, position_case, date_creation, ref_piece, codjrnal, dateoperation, idmois, idannee, nom_client)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               COALESCE($12,0), COALESCE($13,0), COALESCE($14,0),
               $15,$16,COALESCE($17,0),$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`,
      [
        codecarnet, idtypescarnet, durree, idclient, codeclient, designation, codecompte,
        idagence, idprod, idcycle, iduser, mise, solde, prixvente,
        case_selectionne, cycles, position_case, dateOp, ref_piece, codjrnal, dateOp, moisCalcul, anneeCalcul, nom_client
      ]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur SQL:', err);
    res.status(500).json({ error: 'Erreur lors de l’ajout du carnet tontine' });
  } finally {
    client.release();
  }
});


// ✅ Modifier un carnet tontine
router.put('/carnettontine/:idcarnet', async (req, res) => {
  const { idcarnet } = req.params;
  const {
    codecarnet, idtypescarnet, durree, idclient, codeclient,
    designation, codecompte, idprod, idcycle, iduser,
    mise, solde, prixvente, case_selectionne, cycles, position_case, etat, nom_client
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE fina_carnet_tontine
       SET codecarnet = COALESCE($1, codecarnet),
           idtypescarnet = COALESCE($2, idtypescarnet),
           durree = COALESCE($3, durree),
           idclient = COALESCE($4, idclient),
           codeclient = COALESCE($5, codeclient),
           designation = COALESCE($6, designation),
           codecompte = COALESCE($7, codecompte),
           idprod = COALESCE($8, idprod),
           idcycle = COALESCE($9, idcycle),
           iduser = COALESCE($10, iduser),
           mise = COALESCE($11, mise),
           solde = COALESCE($12, solde),
           prixvente = COALESCE($13, prixvente),
           case_selectionne = COALESCE($14, case_selectionne),
           cycles = COALESCE($15, cycles),
           position_case = COALESCE($16, position_case),
           etat = COALESCE($17, etat),
           nom_client = COALESCE($18, nom_client),
           date_fermeture = CASE WHEN $17 = false THEN CURRENT_DATE ELSE date_fermeture END
       WHERE idcarnet = $19
       RETURNING *`,
      [
        codecarnet, idtypescarnet, durree, idclient, codeclient,
        designation, codecompte, idprod, idcycle, iduser,
        mise, solde, prixvente, case_selectionne, cycles, position_case, etat, nom_client, idcarnet
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Carnet tontine introuvable' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur SQL:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du carnet tontine' });
  }
});

/*
router.post('/carnettontine', async (req, res) => {
  const {
    codecarnet, idtypescarnet, durree, idclient, codeclient,
    designation, codecompte, idagence, idprod, idcycle, iduser,
    mise, solde, prixvente, case_selectionne, cycles, position_case,
    codjrnal, dateoperation, idmois, idannee
  } = req.body;

  if (!codecarnet || !idclient || !idagence || !iduser) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 🔹 Récupération infos Produit et Caisse
    const prodData = await client.query(
      `SELECT compte_vente_carnet, designation 
       FROM fina_produitepargne WHERE idprod = $1`, [idprod]
    );

    const caisseData = await client.query(
      `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`, [iduser]
    );

    if (prodData.rows.length === 0 || caisseData.rows.length === 0) {
      throw new Error("Configuration comptable manquante.");
    }

    const compteProduit = prodData.rows[0].compte_vente_carnet;
    const compteCaisse = caisseData.rows[0].comptecaisse;

    // 🔹 Insertion carnet
    const result = await client.query(
      `INSERT INTO fina_carnet_tontine
       (codecarnet, idtypescarnet, durree, idclient, codeclient, designation, codecompte,
        idagence, idprod, idcycle, iduser, mise, solde, prixvente,
        case_selectionne, cycles, position_case, date_creation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               COALESCE($12,0), COALESCE($13,0), COALESCE($14,0),
               $15,$16,COALESCE($17,0),$18)
       RETURNING *`,
      [
        codecarnet, idtypescarnet, durree, idclient, codeclient, designation, codecompte,
        idagence, idprod, idcycle, iduser, mise, solde, prixvente,
        case_selectionne, cycles, position_case, dateoperation || new Date()
      ]
    );

    // 🔹 Comptabilisation si prixvente > 0
    if (prixvente > 0) {
      const codeoperation = codecarnet; // ou autre logique

      // DEBIT CAISSE
      await client.query(
        `INSERT INTO TMVTTHEORIQUE 
         (idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE, MONTANTDEBIT, MONTANTCREDIT, 
          IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12,$13)`,
        [codecarnet, dateoperation, codjrnal, compteCaisse, idclient,
         `DEBIT CAISSE - ${designation}`, prixvente, iduser, idmois, idannee,
         codeoperation, codeclient, idagence]
      );

      // CREDIT PRODUIT
      await client.query(
        `INSERT INTO TMVTTHEORIQUE 
         (idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE, MONTANTDEBIT, MONTANTCREDIT, 
          IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence)
         VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12,$13)`,
        [codecarnet, dateoperation, codjrnal, compteProduit, idclient,
         `CREDIT VENTE CARNET - ${designation}`, prixvente, iduser, idmois, idannee,
         codeoperation, codeclient, idagence]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur SQL:', err);
    res.status(500).json({ error: 'Erreur lors de l’ajout du carnet tontine' });
  } finally {
    client.release();
  }
});









// ✅ Modifier un carnet
router.put('/carnettontine/:idcarnet', async (req, res) => {
  const { idcarnet } = req.params;
  const {
    codecarnet, idtypescarnet, durree, idclient, codeclient,
    designation, codecompte, idprod, idcycle, iduser,
    mise, solde, prixvente, case_selectionne, cycles, position_case, etat
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE fina_carnet_tontine
       SET codecarnet = COALESCE($1, codecarnet),
           idtypescarnet = COALESCE($2, idtypescarnet),
           durree = COALESCE($3, durree),
           idclient = COALESCE($4, idclient),
           codeclient = COALESCE($5, codeclient),
           designation = COALESCE($6, designation),
           codecompte = COALESCE($7, codecompte),
           idprod = COALESCE($8, idprod),
           idcycle = COALESCE($9, idcycle),
           iduser = COALESCE($10, iduser),
           mise = COALESCE($11, mise),
           solde = COALESCE($12, solde),
           prixvente = COALESCE($13, prixvente),
           case_selectionne = COALESCE($14, case_selectionne),
           cycles = COALESCE($15, cycles),
           position_case = COALESCE($16, position_case),
           etat = COALESCE($17, etat),
           date_fermeture = CASE WHEN $17 = false THEN CURRENT_DATE ELSE date_fermeture END
       WHERE idcarnet = $18
       RETURNING *`,
      [
        codecarnet, idtypescarnet, durree, idclient, codeclient,
        designation, codecompte, idprod, idcycle, iduser,
        mise, solde, prixvente, case_selectionne, cycles, position_case, etat, idcarnet
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Carnet tontine introuvable' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur SQL:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du carnet tontine' });
  }
});

*/















router.post('/gestion-cycle', async (req, res) => {
    const { idagence, date } = req.body;

    if (!idagence || !date) {
        return res.status(400).json({
            success: false,
            message: 'idagence et date obligatoires'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ==========================================
        // 1. OUVRIR LE PROCHAIN CYCLE DISPONIBLE
        // ==========================================
        const openCycleQuery = `
            UPDATE fina_carnet_cycle c
            SET 
                datedebut = $1,
                etat = TRUE
            WHERE c.idcycle IN (
                SELECT c_actuel.idcycle
                FROM fina_carnet_cycle c_actuel
                WHERE c_actuel.idagence = $2
                  AND c_actuel.datedebut IS NULL
                  AND c_actuel.datecloture IS NULL
                  AND c_actuel.etat = FALSE
                  AND (
                        c_actuel.page = 1
                        OR EXISTS (
                            SELECT 1
                            FROM fina_carnet_cycle c_prec
                            WHERE c_prec.idcarnet = c_actuel.idcarnet
                              AND c_prec.page = c_actuel.page - 1
                              AND c_prec.datecloture IS NOT NULL
                        )
                  )
            )
            RETURNING c.idcycle, c.idcarnet, c.page;
        `;

        const result = await client.query(openCycleQuery, [date, idagence]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');

            return res.json({
                success: false,
                message: 'Aucun cycle à ouvrir'
            });
        }

        // ==========================================
        // 2. SYNCHRONISER LE CARNET
        // ==========================================
        const syncQuery = `
            UPDATE fina_carnet_tontine t
            SET
                idcycle = c.idcycle,
                cycles = 'Page ' || c.page
            FROM fina_carnet_cycle c
            WHERE t.idcarnet = c.idcarnet
              AND t.idagence = c.idagence
              AND c.etat = TRUE
              AND c.datedebut IS NOT NULL
              AND c.datecloture IS NULL
              AND c.idagence = $1
        `;

        await client.query(syncQuery, [idagence]);

        // ==========================================
        // 3. SYNCHRONISER LA MISE
        // ==========================================
        const updateMiseQuery = `
            UPDATE fina_carnet_cycle c
            SET mise = t.mise
            FROM fina_carnet_tontine t
            WHERE c.idcarnet = t.idcarnet
              AND c.idagence = t.idagence
              AND c.etat = TRUE
              AND c.datedebut IS NOT NULL
              AND c.datecloture IS NULL
              AND c.idagence = $1
        `;

        await client.query(updateMiseQuery, [idagence]);

        await client.query('COMMIT');

        return res.json({
            success: true,
            message: `${result.rowCount} cycle(s) ouvert(s) avec succès`,
            details: result.rows
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error('Erreur Gestion Cycle:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {
        client.release();
    }
});










/*

router.post('/gestion-cycle', async (req, res) => {
    const { idagence, date } = req.body;

    if (!idagence || !date) {
        return res.status(400).json({
            success: false,
            message: 'idagence et date obligatoires'
        });
    }

    try {
        
        const query = `
            UPDATE fina_carnet_cycle
            SET 
                datedebut = $1,
                etat = TRUE
            WHERE idcycle IN (
                SELECT c_actuel.idcycle
                FROM fina_carnet_cycle c_actuel
                -- On cherche la page la plus petite qui n'est pas encore commencée pour chaque carnet
                WHERE c_actuel.idagence = $2
                AND c_actuel.datedebut IS NULL
                AND c_actuel.etat = FALSE
                AND (
                    -- Soit c'est la page 1
                    c_actuel.page = 1 
                    OR 
                    -- Soit la page précédente (page - 1) du MEME carnet est déjà clôturée
                    EXISTS (
                        SELECT 1 FROM fina_carnet_cycle c_prec
                        WHERE c_prec.idcarnet = c_actuel.idcarnet
                        AND c_prec.page = c_actuel.page - 1
                        AND c_prec.datecloture IS NOT NULL
                    )
                )
            )
            RETURNING idcarnet, page;
        `;

        await pool.query(`
    UPDATE fina_carnet_tontine t
    SET
        idcycle = c.idcycle,
        cycles = 'Page ' || c.page
    FROM fina_carnet_cycle c
    WHERE t.idcarnet = c.idcarnet
      AND t.idagence = c.idagence
      AND c.etat = TRUE
      AND c.datedebut IS NOT NULL
      AND c.datecloture IS NULL
`);

        const result = await pool.query(query, [date, idagence]);

        if (result.rowCount === 0) {
            return res.json({
                success: false,
                message: 'Aucun nouveau cycle à ouvrir (tous les cycles sont peut-être déjà ouverts ou terminés)'
            });
        }

        return res.json({
            success: true,
            message: `${result.rowCount} cycle(s) ouvert(s) avec succès`,
            details: result.rows // Liste des carnets et pages activés
        });

    } catch (error) {
        console.error('Erreur Gestion Cycle:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur : ' + error.message
        });
    }
});

*/









router.post('/cloturer-cycle', async (req, res) => {

    const { idagence, date } = req.body;

    if (!idagence || !date) {
        return res.status(400).json({
            success: false,
            message: 'idagence et date obligatoires'
        });
    }

    try {

        const result = await pool.query(`
            UPDATE fina_carnet_cycle
            SET 
                datecloture = $1,
                etat = FALSE
            WHERE idagence = $2
            AND etat = TRUE
            AND datecloture IS NULL
        `, [date, idagence]);

        return res.json({
            success: true,
            message: 'Cycles clôturés avec succès',
            lignes_modifiees: result.rowCount
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


module.exports = router;
