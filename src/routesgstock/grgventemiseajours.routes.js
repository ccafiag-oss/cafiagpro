const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ==========================================
// 1. OBTENIR LES FACTURES ENTRE DEUX DATES
// ==========================================
router.get('/ventes/liste-date', async (req, res) => {
  const { date1, date2, idagence } = req.query;

  if (!date1 || !date2 || !idagence) {
    return res.status(400).json({ error: 'Les paramètres date1, date2 et idagence sont requis.' });
  }

  try {
    const result = await pool.query(
      `
      SELECT 
          v.idvente,
          v.codevente,
          v.datevente,
          SUM(v.montant_total) AS montant_brut,
          SUM(v.remise) AS montant_remise,
          SUM(v.autres_frais) AS montant_frais,
          SUM(v.montant_total) AS total,
          v.idclients,
          v.iddepot,
          v.idtypecl,
          v.refoperation,
          CONCAT(c.nom, ' ', c.prenom) AS nomclient,
          v.etat AS statut
      FROM gvente_detail v
      JOIN gclients c ON c.idclients = v.idclients
      WHERE v.datevente BETWEEN $1 AND $2
        AND v.idagence = $3 AND v.etat='actif'
      GROUP BY 
          v.idvente, v.codevente, v.datevente, 
          v.idclients, v.iddepot, v.idtypecl, 
          c.nom, c.prenom, v.etat, v.refoperation
      ORDER BY v.datevente DESC, v.idvente DESC;
      `,
      [date1, date2, idagence]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur GET /ventes/liste-date:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. ENREGISTRER LA MISE À JOUR DE LA FACTURE
//    -> Si "details" est vide, la facture entière est supprimée.
// ==========================================
router.put('/gvente/updatemOLDE/:idvente', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const idvente = req.params.idvente;
    const { iddepot, idagence, codevente, details, idclients, refoperation } = req.body;

    const venteRes = await client.query(
      `SELECT idtypecl, iduser, datevente, codevente FROM gvente WHERE idvente = $1`,
      [idvente]
    );

    if (venteRes.rows.length === 0) {
      throw new Error("Facture introuvable.");
    }

    const { idtypecl, iduser, datevente, codevente: oldCodevente } = venteRes.rows[0];
    const finalCodeVente = codevente || oldCodevente;

    const dateObj = new Date(datevente);
    const idannee = dateObj.getFullYear();
    const idmois = dateObj.getMonth() + 1;
    const idjrnal = dateObj.getDate();

    const oldDetails = await client.query(
      `SELECT * FROM gvente_detail WHERE idvente = $1`,
      [idvente]
    );

    // -------------------------------------------------------------------
    // CAS A : LA LISTE DES ARTICLES EST VIDE -> SUPPRESSION DE LA FACTURE
    // -------------------------------------------------------------------
    if (!details || details.length === 0) {
      for (const d of oldDetails.rows) {
        const ancienIdLot = d.idlot || 1;
        await client.query(
          `SELECT public.entree_stock($1, $2, $3, $4, $5, $6, $7)`,
          [
            Number(idagence),
            Number(iddepot),
            Number(d.idarticle),
            Number(d.quantite),
            Number(d.prixvente_brut || 0),
            finalCodeVente,
            ancienIdLot
          ]
        );
      }

      await client.query(
        `DELETE FROM TMVTTHEORIQUE WHERE CODFACT = $1::text`,
        [idvente]
      );

      await client.query(`DELETE FROM gvente_detail WHERE idvente = $1`, [idvente]);
      await client.query(`DELETE FROM gvente WHERE idvente = $1`, [idvente]);

      await client.query('COMMIT');
      return res.json({
        success: true,
        deleted: true,
        message: "Tous les articles ont été retirés : la facture a été supprimée."
      });
    }

    // -------------------------------------------------------------------
    // CAS B : MISE À JOUR NORMALE
    // -------------------------------------------------------------------
    await client.query(
      `DELETE FROM TMVTTHEORIQUE WHERE CODFACT = $1::text`,
      [idvente]
    );

    for (const d of oldDetails.rows) {
      const ancienIdLot = d.idlot || 1;
      await client.query(
        `SELECT public.entree_stock($1, $2, $3, $4, $5, $6, $7)`,
        [
          Number(idagence),
          Number(iddepot),
          Number(d.idarticle),
          Number(d.quantite),
          Number(d.prixvente_brut || 0),
          finalCodeVente,
          ancienIdLot
        ]
      );
    }

    await client.query(`DELETE FROM gvente_detail WHERE idvente = $1`, [idvente]);

    let totalBrut = 0;
    let totalRemise = 0;

    for (const item of details) {
      const qte = Number(item.quantite);
      const prix = Number(item.prixvente_brut);
      const remise = Number(item.remise || 0);
      const idarticle = Number(item.idarticle);
      const nouvelIdLot = item.idlot || 1;
      
      const idassureurLigne = item.idassureur ? Number(item.idassureur) : null;

      const artRes = await client.query(
        `SELECT idunite, prixachat FROM garticle WHERE idarticle = $1`,
        [idarticle]
      );

      const idunite = artRes.rows.length > 0 ? artRes.rows[0].idunite : (item.idunite || 1);
      const prixachatactuel = artRes.rows.length > 0 ? Number(artRes.rows[0].prixachat || 0) : 0;

      totalBrut += qte * prix;
      totalRemise += remise;

      const stockRes = await client.query(
        `SELECT stock_disponible FROM gstock_depot WHERE idarticle = $1 AND iddepot = $2`,
        [idarticle, iddepot]
      );

      const stockDispo = stockRes.rows.length > 0 ? Number(stockRes.rows[0].stock_disponible) : 0;
      if (stockDispo < qte) {
        throw new Error(`Stock insuffisant pour l'article ID ${idarticle} (Dispo: ${stockDispo}, Demandé: ${qte})`);
      }

      // Insertion du détail avec l'idassureur de la ligne
      await client.query(
        `INSERT INTO gvente_detail (
          idvente, idagence, idarticle, idlot, idunite, quantite, 
          prixvente_brut, remise, datevente, idjrnal, idmois, 
          idannee, idtypecl, iduser, idclients, iddepot, prixachatactuel, etat, codevente, refoperation, idassureur
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'actif', $18, $19, $20)`,
        [
          idvente,
          idagence,
          idarticle,
          nouvelIdLot,
          idunite,
          qte,
          prix,
          remise,
          datevente,
          idjrnal,
          idmois,
          idannee,
          idtypecl,
          iduser,
          idclients,
          iddepot,
          prixachatactuel,
          finalCodeVente,
          refoperation,
          idassureurLigne
        ]
      );

      await client.query(
        `SELECT public.sortie_stock($1, $2, $3, $4, $5, $6)`,
        [idagence, iddepot, idarticle, qte, finalCodeVente, nouvelIdLot]
      );
    }

    await client.query(
      `UPDATE gvente 
       SET iddepot = $1,
           idclients = $2,
           montant_brut = $3, 
           montant_remise = $4
       WHERE idvente = $5`,
      [iddepot, idclients, totalBrut, totalRemise, idvente]
    );

    await client.query(`
      UPDATE gvente_detail gv
      SET prixachatactuel = sub.prix_achat_ttc
      FROM (
          SELECT idarticle, prix_achat_ttc
          FROM (
              SELECT
                  idarticle,
                  prix_achat_ttc,
                  ROW_NUMBER() OVER (
                      PARTITION BY idarticle
                      ORDER BY datedebut DESC
                  ) AS rn
              FROM ttarifprixachat
              WHERE datefin IS NULL
          ) t
          WHERE rn = 1
      ) sub
      WHERE gv.idarticle = sub.idarticle
        AND gv.idvente = $1
    `, [idvente]);

    // Écritures comptables
    const insertDebit = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      SELECT
        GV.codevente,
        GV.datevente,
        GC.idjrnalvente,
        GC.comptegenvente,
        0 AS idtiers,
        CONCAT('Vente ', '', ' Fact n° ','' ,GV.codevente),
        0,
        ROUND(SUM(GV.montant_total), 2),
        GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        GV.refoperation,
        GV.idagence,
        GC.idjrnalvente,
        NULL AS idmouvement,
        0 AS idclient
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat = 'actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenvente,
               GV.idmois, GV.idannee, GV.idagence, GV.iduser, GV.codevente, GV.refoperation
    `;
    await client.query(insertDebit, [idvente]);

    const insertCredit = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      SELECT
        GV.codevente,
        GV.datevente,
        GC.idjrnalvente,
        GCL.compteauxiliaire,
        GCL.idclients,
        CONCAT('Vente ', '', ' Fact n° ','' ,GV.codevente),
        ROUND(SUM(GV.montant_total), 2),
        0,
        GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        GV.refoperation,
        GV.idagence,
        GC.idjrnalvente,
        NULL AS idmouvement,
        GCL.idclients
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      JOIN gclients GCL ON GV.idclients = GCL.idclients
      WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat = 'actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GCL.compteauxiliaire,
               GV.idmois, GV.idannee, GCL.idclients, GV.idagence, GV.iduser, GV.codevente, GV.refoperation
    `;
    await client.query(insertCredit, [idvente]);

    const insertDebitVar = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      SELECT
        GV.codevente,
        GV.datevente,
        GC.idjrnalvente,
        GC.comptegenvrstock,
        0 AS idtiers,
        CONCAT('Vente ', '', ' Fact n° ','' ,GV.codevente),
        ROUND(SUM(GV.montant_total), 2),
        0,
        GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        GV.refoperation,
        GV.idagence,
        GC.idjrnalvente,
        NULL AS idmouvement,
        0 AS idclient
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat = 'actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenvrstock,
               GV.idmois, GV.idannee, GV.idagence, GV.iduser, GV.codevente, GV.refoperation
    `;
    await client.query(insertDebitVar, [idvente]);

    const insertCreditVar = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      SELECT
        GV.codevente,
        GV.datevente,
        GC.idjrnalvente,
        GC.comptegenstock,
        0 AS idtiers,
        CONCAT('Vente ', '', ' Fact n° ','' ,GV.codevente),
        0,
        ROUND(SUM(GV.montant_total), 2),
        GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        GV.refoperation,
        GV.idagence,
        GC.idjrnalvente,
        NULL AS idmouvement,
        0 AS idclient
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      JOIN gclients GCL ON GV.idclients = GCL.idclients
      WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat = 'actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenstock,
               GV.idmois, GV.idannee, GCL.idclients, GV.idagence, GV.iduser, GV.codevente, GV.refoperation
    `;
    await client.query(insertCreditVar, [idvente]);

    await client.query(
      `UPDATE gvente_detail SET datevalidation = NOW() WHERE idvente = $1`,
      [idvente]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: "Facture mise à jour et validée." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 3. ANNULER / SUPPRIMER UNE FACTURE COMPLETE (DELETE)
// ==========================================
router.delete('/gvente/deletemOLDE/:idvente', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const idvente = req.params.idvente;

    // A. Récupération de l'entête de la facture d'origine pour obtenir le dépôt associé
    const venteRes = await client.query(
      `SELECT iddepot, codevente FROM gvente WHERE idvente = $1`,
      [idvente]
    );

    if (venteRes.rows.length === 0) {
      throw new Error("Facture introuvable.");
    }

    const { iddepot, codevente } = venteRes.rows[0];

    // B. Récupération des anciens détails de la facture pour réintégrer le stock
    const oldDetails = await client.query(
      `SELECT idarticle, quantite, prixvente_brut, idlot, idagence FROM gvente_detail WHERE idvente = $1`,
      [idvente]
    );

    // C. Restitution des stocks physiques de chaque article
    for (const d of oldDetails.rows) {
      const ancienIdLot = d.idlot || 1;
      const dIdAgence = d.idagence || 1; // Valeur de secours si l'agence est indéterminée

      await client.query(
        `SELECT public.entree_stock($1, $2, $3, $4, $5, $6, $7)`,
        [
          Number(dIdAgence),
          Number(iddepot),
          Number(d.idarticle),
          Number(d.quantite),
          Number(d.prixvente_brut || 0),
          codevente,
          ancienIdLot
        ]
      );
    }

    // D. Suppression des écritures comptables liées à cette facture dans TMVTTHEORIQUE
    await client.query(
      `DELETE FROM TMVTTHEORIQUE WHERE CODFACT = $1::text`,
      [idvente]
    );

    // E. Suppression des détails de vente
    await client.query(`DELETE FROM gvente_detail WHERE idvente = $1`, [idvente]);

    // F. Suppression de l'entête de facture
    await client.query(`DELETE FROM gvente WHERE idvente = $1`, [idvente]);

    await client.query('COMMIT');
    res.json({
      success: true,
      deleted: true,
      message: "La facture a été annulée et supprimée avec succès."
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur DELETE /gvente/deletem/:idvente:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});





///  PARTIE  TRIGGER



router.put('/gvente/updatem/:idvente', async (req, res) => {
  const { idvente } = req.params;
  const { 
    idagence, idclients, iddepot, idtypecl, iduser, 
    codevente, refoperation, datevente, details ,  frais_transport,
      autres_frais
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

     const transport = parseFloat(frais_transport) || 0;
    const autres = parseFloat(autres_frais) || 0;

    // 1. Suppression de tout le détail existant pour ce codevente
    // Les triggers feront le nettoyage des stocks et de la compta automatiquement
    await client.query('DELETE FROM gvente_detail WHERE codevente = $1', [codevente]);

    // 2. Si le tableau 'details' est vide, on arrête ici (c'est une annulation totale)
    if (!details || details.length === 0) {
        await client.query('DELETE FROM gvente_autres_frais WHERE ref_piece = $1', [codevente]);
      await client.query('COMMIT');
      return res.status(200).json({ success: true, message: 'Facture annulée et supprimée.' });
    }

    // 3. Réinsertion des nouveaux détails (ajout/modification)
    const insertQuery = `
      INSERT INTO gvente_detail (
        idagence, idarticle, idlot, idunite, quantite, poid_unitaire, 
        prixvente_brut, remise, numerolot, dateperemption, etat, datevente, 
        idjrnal, idmois, idannee, idtypecl, iduser, idclients, iddepot, 
        prixbase, taux, prixassure, prixassurance, idassureur, 
        codevente, refoperation, ref_piece
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
    `;

    const d = new Date(datevente);
    const idmois = d.getMonth() + 1;
    const idannee = d.getFullYear();

    for (const item of details) {
      await client.query(insertQuery, [
        idagence, item.idarticle, item.idlot || null, item.idunite || 1, 
        item.quantite, item.poid_unitaire || 0, item.prixvente_brut, 
        item.remise || 0, item.numerolot || null, item.dateperemption || null, 
        'actif', datevente, item.idjrnal || 1, idmois, idannee, 
        idtypecl, iduser, idclients, iddepot, item.prixbase, item.taux, 
        item.prixassure, item.prixassurance, item.idassureur, 
        codevente, refoperation, codevente
      ]);
    }


     // 2. Si le tableau 'details' est vide, c'est une annulation totale
   

       // 4. Gestion de la table gvente_autres_frais (Transport / Autres frais)
    const checkFrais = await client.query(
      `SELECT id FROM gvente_autres_frais WHERE ref_piece = $1 LIMIT 1`,
      [codevente]
    );

    if (checkFrais.rows.length > 0) {
      if (transport > 0 || autres > 0) {
        // Mise à jour des frais existants
        await client.query(
          `UPDATE gvente_autres_frais 
           SET frais_transport = $1, autres_frais = $2 
           WHERE ref_piece = $3`,
          [transport, autres, codevente]
        );
      } else {
        // Suppression si les frais ont été remis à 0
        await client.query(
          `DELETE FROM gvente_autres_frais WHERE ref_piece = $1`,
          [codevente]
        );
      }
    } else {
      if (transport > 0 || autres > 0) {
        // Insertion d'une nouvelle ligne si frais > 0
        await client.query(
          `INSERT INTO gvente_autres_frais (ref_piece, frais_transport, autres_frais)
           VALUES ($1, $2, $3)`,
          [codevente, transport, autres]
        );
      }
    }



    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Facture mise à jour avec succès.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur mise à jour vente :", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});





router.delete('/gvente/supprimer/:idvente', async (req, res) => {
  const { idvente } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // On récupère le codevente pour supprimer les détails
    const resVente = await client.query('SELECT codevente FROM gvente WHERE idvente = $1', [idvente]);
    
    if (resVente.rows.length === 0) {
      throw new Error("Facture non trouvée");
    }

    const codevente = resVente.rows[0].codevente;

    // Suppression des détails (déclenche les triggers de stock/compta)
    await client.query('DELETE FROM gvente_detail WHERE codevente = $1', [codevente]);
    
       // 2. Suppression des frais associés dans gvente_autres_frais
    await client.query('DELETE FROM gvente_autres_frais WHERE ref_piece = $1', [codevente]);
    
    // Suppression de l'en-tête de la facture
    await client.query('DELETE FROM gvente WHERE idvente = $1', [idvente]);

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Facture supprimée avec succès.' });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});



////  DEVIS  MISE A JOURS




router.get('/ventesdevis/detailm/:ref_piece', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT d.*, a.designation,u.designation as designationunite
      FROM gvente_detaildevis d
      JOIN garticle a ON a.idarticle = d.idarticle
      JOIN gunite u on u.idunite=d.idunite
      WHERE d.ref_piece = $1
      `,
      [req.params.ref_piece]
    );

    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




router.get('/ventesdevis/liste-date', async (req, res) => {
  const { date1, date2, idagence } = req.query;

  if (!date1 || !date2 || !idagence) {
    return res.status(400).json({ error: 'Les paramètres date1, date2 et idagence sont requis.' });
  }

  try {
    const result = await pool.query(
      `
      SELECT 
          v.ref_piece,
          v.codevente,
          v.datevente,
          SUM(v.montant_total) AS montant_brut,
          SUM(v.remise) AS montant_remise,
          SUM(v.autres_frais) AS montant_frais,
          SUM(v.montant_total) AS total,
          v.idclients,
          v.iddepot,
          v.idtypecl,
          v.refoperation,
          CONCAT(c.nom, ' ', c.prenom) AS nomclient,
          v.etat AS statut
      FROM gvente_detaildevis v
      JOIN gclients c ON c.idclients = v.idclients
      WHERE v.datevente BETWEEN $1 AND $2
        AND v.idagence = $3 AND v.etat='actif'
      GROUP BY 
          v.codevente, v.datevente, 
          v.idclients, v.iddepot, v.idtypecl, 
          c.nom, c.prenom, v.etat, v.refoperation,v.ref_piece
      ORDER BY v.datevente  DESC;
      `,
      [date1, date2, idagence]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur GET /ventesdevis/liste-date:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});



router.put('/gventedevis/updatem/:ref_piece', async (req, res) => {
  const { ref_piece } = req.params;
  const { 
    idagence, idclients, iddepot, idtypecl, iduser, 
    codevente, refoperation, datevente, details 
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Suppression de tout le détail existant pour ce codevente
    // Les triggers feront le nettoyage des stocks et de la compta automatiquement
    await client.query('DELETE FROM gvente_detaildevis WHERE ref_piece = $1', [ref_piece]);

    // 2. Si le tableau 'details' est vide, on arrête ici (c'est une annulation totale)
    if (!details || details.length === 0) {
      await client.query('COMMIT');
      return res.status(200).json({ success: true, message: 'Facture annulée et supprimée.' });
    }

    // 3. Réinsertion des nouveaux détails (ajout/modification)
    const insertQuery = `
      INSERT INTO gvente_detaildevis (
        idagence, idarticle, idlot, idunite, quantite, poid_unitaire, 
        prixvente_brut, remise, numerolot, dateperemption, etat, datevente, 
        idjrnal, idmois, idannee, idtypecl, iduser, idclients, iddepot, 
        prixbase, taux, prixassure, prixassurance, idassureur, 
        codevente, refoperation, ref_piece
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
    `;

    const d = new Date(datevente);
    const idmois = d.getMonth() + 1;
    const idannee = d.getFullYear();

    for (const item of details) {
      await client.query(insertQuery, [
        idagence, item.idarticle, item.idlot || null, item.idunite || 1, 
        item.quantite, item.poid_unitaire || 0, item.prixvente_brut, 
        item.remise || 0, item.numerolot || null, item.dateperemption || null, 
        'actif', datevente, item.idjrnal || 1, idmois, idannee, 
        idtypecl, iduser, idclients, iddepot, item.prixbase, item.taux, 
        item.prixassure, item.prixassurance, item.idassureur, 
        codevente, refoperation, codevente
      ]);
    }

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Facture mise à jour avec succès.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur mise à jour vente :", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});







router.put('/gventedevis/updatemshop/:ref_piece', async (req, res) => {
  const { ref_piece } = req.params;
  const { 
    idagence, idclients, iddepot, idtypecl, iduser, 
    codevente, refoperation, datevente, details 
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Suppression de tout le détail existant pour ce codevente
    // Les triggers feront le nettoyage des stocks et de la compta automatiquement
    ///await client.query('DELETE FROM gvente_detaildevis WHERE ref_piece = $1', [ref_piece]);

    // 2. Si le tableau 'details' est vide, on arrête ici (c'est une annulation totale)
    ////if (!details || details.length === 0) {
     //// await client.query('COMMIT');
     /// return res.status(200).json({ success: true, message: 'Facture annulée et supprimée.' });
   /// }

    // 3. Réinsertion des nouveaux détails (ajout/modification)
    const insertQuery = `
      INSERT INTO gvente_detaildevis (
        idagence, idarticle, idlot, idunite, quantite, poid_unitaire, 
        prixvente_brut, remise, numerolot, dateperemption, etat, datevente, 
        idjrnal, idmois, idannee, idtypecl, iduser, idclients, iddepot, 
        prixbase, taux, prixassure, prixassurance, idassureur, 
        codevente, refoperation, ref_piece
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
    `;

    const d = new Date(datevente);
    const idmois = d.getMonth() + 1;
    const idannee = d.getFullYear();

    for (const item of details) {
      await client.query(insertQuery, [
        idagence, item.idarticle, item.idlot || null, item.idunite || 1, 
        item.quantite, item.poid_unitaire || 0, item.prixvente_brut, 
        item.remise || 0, item.numerolot || null, item.dateperemption || null, 
        'actif', datevente, item.idjrnal || 1, idmois, idannee, 
        idtypecl, iduser, idclients, iddepot, item.prixbase, item.taux, 
        item.prixassure, item.prixassurance, item.idassureur, 
        codevente, refoperation, codevente
      ]);
    }

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Facture mise à jour avec succès.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur mise à jour vente :", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});


router.delete('/gventedevis/supprimer/:ref_piece', async (req, res) => {
  const { ref_piece } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

   

    // Suppression des détails (déclenche les triggers de stock/compta)
    await client.query('DELETE FROM gvente_detaildevis WHERE ref_piece = $1', [ref_piece]);
    
 
    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Facture supprimée avec succès.' });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});











module.exports = router;




























/*

const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ==========================================
// 1. OBTENIR LES FACTURES ENTRE DEUX DATES
// ==========================================
router.get('/ventes/liste-date', async (req, res) => {
  const { date1, date2, idagence } = req.query;

  if (!date1 || !date2 || !idagence) {
    return res.status(400).json({ error: 'Les paramètres date1, date2 et idagence sont requis.' });
  }

  try {
    const result = await pool.query(
      `
     	  SELECT 
    v.idvente,
    v.codevente,
    v.datevente,
    SUM(v.montant_total) AS montant_brut,
    SUM(v.remise) AS montant_remise,
    SUM(v.autres_frais) AS montant_frais,
    SUM(v.montant_total) AS total,
    v.idclients,
    v.iddepot,
    v.idtypecl,
    v.refoperation,
    CONCAT(c.nom, ' ', c.prenom) AS nomclient,
    v.etat AS statut
FROM gvente_detail v
JOIN gclients c ON c.idclients = v.idclients
WHERE v.datevente BETWEEN $1 AND $2
  AND v.idagence = $3 and v.etat='actif'
GROUP BY 
    v.idvente, v.codevente, v.datevente, 
    v.idclients, v.iddepot, v.idtypecl, 
    c.nom, c.prenom, v.etat,v.refoperation
ORDER BY v.datevente DESC, v.idvente DESC;
      `,
      [date1, date2, idagence]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur GET /ventes/liste-date:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. ENREGISTRER LA MISE À JOUR DE LA FACTURE (DEJA VALIDEE)
// ==========================================
router.put('/gvente/updatem/:idvente', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const idvente = req.params.idvente;
    // On retire idlot du destructuring global car il est géré par ligne d'article
    const { iddepot, idagence, codevente, details, idclients,refoperation } = req.body;

    if (!details || details.length === 0) {
      throw new Error("La facture doit contenir au moins un article.");
    }

    // Récupération des informations de l'ancienne facture
    const venteRes = await client.query(
      `SELECT idtypecl, iduser, datevente, codevente FROM gvente WHERE idvente = $1`,
      [idvente]
    );

    if (venteRes.rows.length === 0) {
      throw new Error("Facture introuvable.");
    }

    const { idtypecl, iduser, datevente, codevente: oldCodevente } = venteRes.rows[0];
    const finalCodeVente = codevente || oldCodevente;
    
    const dateObj = new Date(datevente);
    const idannee = dateObj.getFullYear();
    const idmois = dateObj.getMonth() + 1;
    const idjrnal = dateObj.getDate(); 

    // A. SUPPRESSION DE L'ANCIENNE COMPTABILITÉ (TMVTTHEORIQUE)
    await client.query(
      `DELETE FROM TMVTTHEORIQUE WHERE CODFACT = $1::text`,
      [idvente]
    );

    // B. RESTOCKAGE DES ANCIENS DÉTAILS
    const oldDetails = await client.query(
      `SELECT * FROM gvente_detail WHERE idvente = $1`,
      [idvente]
    );

    for (const d of oldDetails.rows) {
      // Récupération de l'idlot d'origine ou valeur par défaut (1)
      const ancienIdLot = d.idlot || 1;

      await client.query(
        `SELECT public.entree_stock($1, $2, $3, $4, $5, $6, $7)`,
        [
          Number(idagence), 
          Number(iddepot), 
          Number(d.idarticle), 
          Number(d.quantite), 
          Number(d.prixvente_brut || 0), 
          finalCodeVente, 
          ancienIdLot
        ]
      );
    }

    // Suppression des anciens détails de gvente_detail
    await client.query(`DELETE FROM gvente_detail WHERE idvente = $1`, [idvente]);

    let totalBrut = 0;
    let totalRemise = 0;

    // C. VÉRIFICATION DU STOCK, INSERTION DES NOUVEAUX DÉTAILS ET SORTIE STOCK
    for (const item of details) {
      const qte = Number(item.quantite);
      const prix = Number(item.prixvente_brut);
      const remise = Number(item.remise || 0);
      const idarticle = Number(item.idarticle);
      // Récupération de l'idlot de la ligne courante ou valeur par défaut (1)
      const nouvelIdLot = item.idlot || 1;

      const artRes = await client.query(
        `SELECT idunite, prixachat FROM garticle WHERE idarticle = $1`,
        [idarticle]
      );
      
      const idunite = artRes.rows.length > 0 ? artRes.rows[0].idunite : (item.idunite || 1);
      const prixachatactuel = artRes.rows.length > 0 ? Number(artRes.rows[0].prixachat || 0) : 0;

      totalBrut += qte * prix;
      totalRemise += remise;

      // Vérification du stock physique disponible après restockage
      const stockRes = await client.query(
        `SELECT stock_disponible FROM gstock_depot WHERE idarticle = $1 AND iddepot = $2`,
        [idarticle, iddepot]
      );

      const stockDispo = stockRes.rows.length > 0 ? Number(stockRes.rows[0].stock_disponible) : 0;
      if (stockDispo < qte) {
        throw new Error(`Stock insuffisant pour l'article ID ${idarticle} (Dispo: ${stockDispo}, Demandé: ${qte})`);
      }

      // Insertion du détail
      await client.query(
        `INSERT INTO gvente_detail (
          idvente, idagence, idarticle, idlot, idunite, quantite, 
          prixvente_brut, remise, datevente, idjrnal, idmois, 
          idannee, idtypecl, iduser, idclients, iddepot, prixachatactuel, etat, codevente,refoperation
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'actif', $18,$19)`,
        [
          idvente, 
          idagence, 
          idarticle, 
          nouvelIdLot, 
          idunite, 
          qte, 
          prix, 
          remise, 
          datevente, 
          idjrnal, 
          idmois, 
          idannee, 
          idtypecl, 
          iduser, 
          idclients, 
          iddepot, 
          prixachatactuel, 
          finalCodeVente,
          refoperation
        ]
      );

      // Sortie du stock
      await client.query(
        `SELECT public.sortie_stock($1, $2, $3, $4, $5, $6)`,
        [idagence, iddepot, idarticle, qte, finalCodeVente, nouvelIdLot]
      );
    }

    // D. MISE À JOUR DE L'ENTÊTE DE FACTURE
    await client.query(
      `UPDATE gvente 
       SET iddepot = $1,
           idclients = $2,
           montant_brut = $3, 
           montant_remise = $4
       WHERE idvente = $5`,
      [iddepot, idclients, totalBrut, totalRemise, idvente]
    );

    // E. MISE À JOUR DU PRIX ACHAT ACTUEL
    await client.query(`
      UPDATE gvente_detail gv
      SET prixachatactuel = sub.prix_achat_ttc
      FROM (
          SELECT idarticle, prix_achat_ttc
          FROM (
              SELECT
                  idarticle,
                  prix_achat_ttc,
                  ROW_NUMBER() OVER (
                      PARTITION BY idarticle
                      ORDER BY datedebut DESC
                  ) AS rn
              FROM ttarifprixachat
              WHERE datefin IS NULL
          ) t
          WHERE rn = 1
      ) sub
      WHERE gv.idarticle = sub.idarticle
        AND gv.idvente = $1
    `, [idvente]);

    // F. COMPTABILISATION DES NOUVELLES ÉCRITURES DE LA FACTURE

    // Débit (compte général vente)
    const insertDebit = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      SELECT
        GV.codevente,
        GV.datevente,
        GC.idjrnalvente,
        GC.comptegenvente,
        0 AS idtiers,
        CONCAT('Vente ', '', ' Fact n° ','' ,GV.codevente),
        0,
        ROUND(SUM(GV.montant_total), 2),
        GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        GV.refoperation,
        GV.idagence,
        GC.idjrnalvente,
        NULL AS idmouvement,
        0 AS idclient
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat = 'actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenvente,
               GV.idmois, GV.idannee, GV.idagence, GV.iduser, GV.codevente,GV.refoperation
    `;
    await client.query(insertDebit, [idvente]);

    // Crédit (compte client)
    const insertCredit = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      SELECT
        GV.codevente,
        GV.datevente,
        GC.idjrnalvente,
        GCL.compteauxiliaire,
        GCL.idclients,
        CONCAT('Vente ', '', ' Fact n° ','' ,GV.codevente),
        ROUND(SUM(GV.montant_total), 2),
        0,
        GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        GV.refoperation,
        GV.idagence,
        GC.idjrnalvente,
        NULL AS idmouvement,
        GCL.idclients
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      JOIN gclients GCL ON GV.idclients = GCL.idclients
      WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat = 'actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GCL.compteauxiliaire,
               GV.idmois, GV.idannee, GCL.idclients, GV.idagence, GV.iduser, GV.codevente,GV.refoperation
    `;
    await client.query(insertCredit, [idvente]);

    // Débit variation de stock
    const insertDebitVar = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      SELECT
        GV.codevente,
        GV.datevente,
        GC.idjrnalvente,
        GC.comptegenvrstock,
        0 AS idtiers,
        CONCAT('Vente ', '', ' Fact n° ','' ,GV.codevente),
        ROUND(SUM(GV.montant_total), 2),
        0,
        GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        GV.refoperation,
        GV.idagence,
        GC.idjrnalvente,
        NULL AS idmouvement,
        0 AS idclient
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat = 'actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenvrstock,
               GV.idmois, GV.idannee, GV.idagence, GV.iduser, GV.codevente,GV.refoperation
    `;
    await client.query(insertDebitVar, [idvente]);

    // Crédit variation de stock
    const insertCreditVar = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      SELECT
        GV.codevente,
        GV.datevente,
        GC.idjrnalvente,
        GC.comptegenstock,
        0 AS idtiers,
        CONCAT('Vente ', '', ' Fact n° ','' ,GV.codevente),
        0,
        ROUND(SUM(GV.montant_total), 2),
        GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        GV.refoperation,
        GV.idagence,
        GC.idjrnalvente,
        NULL AS idmouvement,
        0 AS idclient
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      JOIN gclients GCL ON GV.idclients = GCL.idclients
      WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat = 'actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenstock,
               GV.idmois, GV.idannee, GCL.idclients, GV.idagence, GV.iduser, GV.codevente,GV.refoperation
    `;
    await client.query(insertCreditVar, [idvente]);

    // Validation finale de gvente_detail
    await client.query(
      `UPDATE gvente_detail SET datevalidation = NOW() WHERE idvente = $1`,
      [idvente]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: "Facture mise à jour et validée." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

*/