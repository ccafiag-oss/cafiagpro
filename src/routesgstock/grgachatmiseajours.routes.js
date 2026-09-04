const express = require('express');
const router = express.Router();
const pool = require('../config/db');



router.put('/gachat/:idachat', async (req, res) => {
  const { idachat } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Suppression des données existantes pour cette facture
    await client.query('DELETE FROM gachat_detail WHERE idachat = $1', [idachat]);
    await client.query('DELETE FROM gachat_frais WHERE idachat = $1', [idachat]);

    // 2. Réinsertion avec les nouvelles données du corps de la requête
    const { details, frais, idagence, idfourn, iddepot, idtypefr, iduser, codeachat, refoperation } = req.body;

    for (const item of details) {
      await client.query(
        `INSERT INTO gachat_detail (
            idachat, idagence, idarticle, idunite, quantite, poid_unitaire, 
            prixachat_brut, remise, prixvente, numerolot, dateperemption, 
            etat, dateachat, idjrnal, idmois, idannee, idfourn, iduser, 
            codeachat, refoperation,ref_piece, iddepot, idtypefr
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,$23)`,
        [
          idachat, idagence, item.idarticle, item.idunite, item.quantite, 
          item.poid_unitaire || 0, item.prixachat_brut, item.remise || 0, 
          item.prixvente || 0, item.numerolot || null, item.dateperemption || null, 
          item.etat || 'actif', item.dateachat || new Date(), item.idjrnal || null, 
          item.idmois, item.idannee, idfourn, iduser, codeachat, refoperation,codeachat, iddepot, idtypefr
        ]
      );
    }

    // 3. Réinsertion des frais
    if (frais && frais.length > 0) {
      for (const f of frais) {
        await client.query(
          `INSERT INTO gachat_frais (idachat, idagence, idtypefrais, montant, mode_repartition) 
           VALUES ($1, $2, $3, $4, $5)`,
          [idachat, idagence, f.idtypefrais, f.montant, f.mode_repartition]
        );
      }
      // Relancer le recalcul des frais
      await client.query('SELECT public.repartir_frais_achat($1)', [idachat]);
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Facture mise à jour avec succès.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour : ' + err.message });
  } finally {
    client.release();
  }
});



router.delete('/gachat/:idachat', async (req, res) => {
  const { idachat } = req.params;
  const client = await pool.connect();

  try {
    // La suppression dans 'gachat' supprimera automatiquement 
    // tous les enregistrements dans 'gachat_detail' et 'gachat_frais'
    // grâce au ON DELETE CASCADE défini dans votre schéma.
    const result = await client.query('DELETE FROM gachat_detail WHERE idachat = $1', [idachat]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Facture introuvable.' });
    }

    res.status(200).json({ message: 'Facture supprimée intégralement.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression : ' + err.message });
  } finally {
    client.release();
  }
});






router.put('/gachat/updatem/:idachat', async (req, res) => {
  const { idachat } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { 
      details, frais, idagence, idfourn, iddepot, idtypefr, 
      iduser, codeachat, refoperation 
    } = req.body;

    // 1. Suppression
    await client.query('DELETE FROM gachat_detail WHERE idachat = $1', [idachat]);
    await client.query('DELETE FROM gachat_frais WHERE idachat = $1', [idachat]);

    // 2. Réinsertion avec ref_piece
    for (const item of details) {
      await client.query(
        `INSERT INTO gachat_detail (
            idachat, idagence, idarticle, idunite, quantite, poid_unitaire, 
            prixachat_brut, remise, prixvente, numerolot, dateperemption, 
            etat, dateachat, idjrnal, idmois, idannee, idfourn, iduser, 
            codeachat, refoperation, ref_piece, iddepot, idtypefr
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
        [
          idachat, 
          idagence, 
          item.idarticle, 
          item.idunite, 
          item.quantite, 
          item.poid_unitaire || 0, 
          item.prixachat_brut, 
          item.remise || 0, 
          item.prixvente || 0, 
          item.numerolot || null, 
          item.dateperemption || null, 
          item.etat || 'actif', 
          item.dateachat || new Date(), 
          item.idjrnal || null, 
          item.idmois, 
          item.idannee, 
          idfourn, 
          iduser, 
          codeachat, 
          refoperation, 
          item.ref_piece || '', // Valeur de ref_piece
          iddepot, 
          idtypefr
        ]
      );
    }

    // 3. Frais
    if (frais && frais.length > 0) {
      for (const f of frais) {
        await client.query(
          `INSERT INTO gachat_frais (idachat, idagence, idtypefrais, montant, mode_repartition) 
           VALUES ($1, $2, $3, $4, $5)`,
          [idachat, idagence, f.idtypefrais, f.montant, f.mode_repartition]
        );
      }
      await client.query('SELECT public.repartir_frais_achat($1)', [idachat]);
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Facture mise à jour avec succès.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});



// =========================================================================
// RÉCUPÉRATION COMPTABILISATION ASSISTÉE (Inclus dans vos fonctions globales)
// =========================================================================



async function comptabiliserAchat(client, idachat, inverse = false) {
  // Sélection dynamique de l'état selon s'il s'agit d'un achat normal ou d'une annulation
  const etatFilter = inverse ? 'ANNULATION' : 'actif';

  // INSERT Débit (compte général achat) -> devient crédit si inverse
  const insertDebit = `
    INSERT INTO TMVTTHEORIQUE (
      IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
      MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
      CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
    )
    SELECT
      GA.codeachat,
      GA.dateachat,
      GC.idjrnalachat,
      GC.comptegenachat,
      0 AS idtiers,
      CONCAT('Achat chez ', '', ' Fact n° ' ,'' ,GA.codeachat),
      ${inverse ? '0' : 'ROUND(SUM(GA.cout_total), 2)'},
      ${inverse ? 'ROUND(SUM(GA.cout_total), 2)' : '0'},
      GA.iduser,
      GA.idmois,
      GA.idannee,
      GA.idachat,
      GA.refoperation,
      GA.idagence,
      GC.idjrnalachat,
      NULL AS idmouvement,
      0 AS idclient
    FROM gachat_detail GA
    JOIN garticle GP ON GA.idarticle = GP.idarticle
    JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
    WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = $2
    GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenachat,
             GA.idmois, GA.idannee, GA.idagence, GA.iduser, GA.codeachat, GA.refoperation
  `;
  await client.query(insertDebit, [idachat, etatFilter]);

  // INSERT Crédit (compte fournisseur) -> devient débit si inverse
  const insertCredit = `
    INSERT INTO TMVTTHEORIQUE (
      IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
      MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
      CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
    )
    SELECT
      GA.codeachat,
      GA.dateachat,
      GC.idjrnalachat,
      GF.compteauxiliaire,
      GF.idfourn,
      CONCAT('Achat chez ', '', ' Fact n° ','' ,GA.codeachat ),
      ${inverse ? 'ROUND(SUM(GA.cout_total), 2)' : '0'},
      ${inverse ? '0' : 'ROUND(SUM(GA.cout_total), 2)'},
      GA.iduser,
      GA.idmois,
      GA.idannee,
      GA.idachat,
      GA.refoperation,
      GA.idagence,
      GC.idjrnalachat,
      NULL AS idmouvement,
      GF.idfourn
    FROM gachat_detail GA
    JOIN garticle GP ON GA.idarticle = GP.idarticle
    JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
    JOIN gfournisseur GF ON GA.idfourn = GF.idfourn
    WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = $2
    GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GF.compteauxiliaire,
             GA.idmois, GA.idannee, GF.idfourn, GA.idagence, GA.iduser, GA.codeachat, GA.refoperation
  `;
  await client.query(insertCredit, [idachat, etatFilter]);

  // INSERT Débit variation de stock -> devient crédit si inverse
  const insertDebitVar = `
    INSERT INTO TMVTTHEORIQUE (
      IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
      MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
      CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
    )
    SELECT
      GA.codeachat,
      GA.dateachat,
      GC.idjrnalachat,
      GC.comptegenstock,
      0 AS idtiers,
      CONCAT('Achat chez ', '', ' Fact n° ','' ,GA.codeachat),
      ${inverse ? '0' : 'ROUND(SUM(GA.cout_total), 2)'},
      ${inverse ? 'ROUND(SUM(GA.cout_total), 2)' : '0'},
      GA.iduser,
      GA.idmois,
      GA.idannee,
      GA.idachat,
      GA.refoperation,
      GA.idagence,
      GC.idjrnalachat,
      NULL AS idmouvement,
      0 AS idclient
    FROM gachat_detail GA
    JOIN garticle GP ON GA.idarticle = GP.idarticle
    JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
    WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = $2
    GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenstock,
             GA.idmois, GA.idannee, GA.idagence, GA.iduser, GA.codeachat, GA.refoperation
  `;
  await client.query(insertDebitVar, [idachat, etatFilter]);

  // INSERT Crédit variation de stock -> devient débit si inverse
  const insertCreditVar = `
    INSERT INTO TMVTTHEORIQUE (
      IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
      MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
      CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
    )
    SELECT
      GA.codeachat,
      GA.dateachat,
      GC.idjrnalachat,
      GC.comptegenvrstock,
      GF.idfourn,
      CONCAT('Achat chez ', '', ' Fact n° ','' ,GA.codeachat),
      ${inverse ? 'ROUND(SUM(GA.cout_total), 2)' : '0'},
      ${inverse ? '0' : 'ROUND(SUM(GA.cout_total), 2)'},
      GA.iduser,
      GA.idmois,
      GA.idannee,
      GA.idachat,
      GA.refoperation,
      GA.idagence,
      GC.idjrnalachat,
      NULL AS idmouvement,
      GF.idfourn
    FROM gachat_detail GA
    JOIN garticle GP ON GA.idarticle = GP.idarticle
    JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
    JOIN gfournisseur GF ON GA.idfourn = GF.idfourn
    WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = $2
    GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenvrstock,
             GA.idmois, GA.idannee, GF.idfourn, GA.idagence, GA.iduser, GA.codeachat, GA.refoperation
  `;
  await client.query(insertCreditVar, [idachat, etatFilter]);

  // Validation du détail
  await client.query(
    `UPDATE gachat_detail SET datevalidation = NOW() WHERE idachat = $1`,
    [idachat]
  );
}

// =========================================================================
// 1. FILTRER LES FACTURES D'ACHAT ENTRE DEUX DATES INDÉPENDANTES
// =========================================================================
router.get('/achats/liste-filtrer', async (req, res) => {
  const { dateDebut, dateFin, idagence } = req.query;

  if (!dateDebut || !dateFin || !idagence) {
    return res.status(400).json({ error: 'dateDebut, dateFin et idagence sont obligatoires.' });
  }

  try {
    const queryText = `
      SELECT 
    a.idachat,
    a.dateachat,
    a.codeachat,
    ROUND(SUM(a.cout_total), 2) AS montant_brut,
    ROUND(SUM(a.autres_frais), 2) AS montant_frais,
    a.refoperation AS observation,
    a.codeachat AS reference_facture,
    a.idfourn,
    f.nomcomplet AS fournisseur_nom,
    f.idtypefr
FROM gachat_detail a
JOIN gfournisseur f ON a.idfourn = f.idfourn
WHERE a.idagence = $1 
  AND a.dateachat BETWEEN $2 AND $3
  AND a.etat='actif' 
GROUP BY 
    a.idachat,
    a.dateachat,
    a.codeachat,
    a.refoperation,
    a.idfourn,
    f.nomcomplet,
    f.idtypefr
ORDER BY a.dateachat DESC, a.idachat DESC;

    `;
    const { rows } = await pool.query(queryText, [idagence, dateDebut, dateFin]);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /achats/liste-filtrer:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// =========================================================================
// 2. RECUPERER LES DETAILS COMPLETS D'UNE FACTURE AVEC UNITE ET DESIGNATION
// =========================================================================
router.get('/achats/detailm/:idachat', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          d.*,
          a.designation,
          u.designation AS designationunite
       FROM gachat_detail d
       JOIN garticle a ON a.idarticle = d.idarticle
       LEFT JOIN gunite u ON u.idunite = d.idunite
       WHERE d.idachat = $1`,
      [req.params.idachat]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Erreur GET /achats/detailm/:idachat:', err);
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 3. ENREGISTRER LES MODIFICATIONS (EDITION COMPLETE AVEC RE-STOCKAGE)
// =========================================================================
router.put('/gachatOLDE/updatem/:idachat', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const idachat = req.params.idachat;

    const {
      idagence,
      idfourn,
      iddepot,
      idtypefr,
      iduser,
      codeachat,
      montant_frais,
      reference_facture,
      observation,
      refoperation,
      details,
      frais
    } = req.body;

    if (!details || details.length === 0) {
      throw new Error("L'achat doit contenir au moins un article.");
    }

    // 1. Récupération de l'ancien achat
    const achatRes = await client.query(
      `SELECT * FROM gachat WHERE idachat = $1`,
      [idachat]
    );
    if (achatRes.rows.length === 0) {
      throw new Error("Facture achat introuvable.");
    }

    // 2. Restockage inverse (Sortie du stock pour annuler l'ancien mouvement d'achat)
    const oldDetails = await client.query(
      `SELECT * FROM gachat_detail WHERE idachat = $1`,
      [idachat]
    );
    for (const d of oldDetails.rows) {
      const oldLotId = d.idlot !== null ? d.idlot : 0;
      await client.query(
        `SELECT public.sortie_stock($1,$2,$3,$4,$5,$6)`,
        [idagence, iddepot, d.idarticle, d.quantite, codeachat, oldLotId]
      );
    }

    // 3. Suppression des anciennes écritures comptables
    await client.query(
      `DELETE FROM TMVTTHEORIQUE WHERE CODFACT = $1`,
      [idachat]
    );

    // 4. Suppression des anciens détails et frais
    await client.query(`DELETE FROM gachat_detail WHERE idachat = $1`, [idachat]);
    await client.query(`DELETE FROM gachat_frais WHERE idachat = $1`, [idachat]);

    // 5. Insertion des nouveaux détails
    let totalBrut = 0;
    for (const item of details) {
      const qte = Number(item.quantite || 0);
      const prix = Number(item.prixachat_brut || 0);
      const remise = Number(item.remise || 0);
      totalBrut += (qte * prix) - remise;







      let idlotFinal = null;

console.log("📦 Item reçu:", item);

if (item.idlot && Number(item.idlot) > 0) {
  // idlot fourni et valide
  idlotFinal = Number(item.idlot);
  console.log("✅ idlot fourni directement:", idlotFinal);
} else if (item.dateperemption) {
  console.log("📅 dateperemption reçue:", item.dateperemption);

  const lotResult = await client.query(
    `SELECT idlot
     FROM glot
     WHERE idmois = EXTRACT(MONTH FROM $1::date)
       AND idannee = EXTRACT(YEAR FROM $1::date)
     LIMIT 1`,
    [item.dateperemption]
  );

  console.log("🔎 Résultat lotResult:", lotResult.rows);

  if (lotResult.rows.length > 0) {
    idlotFinal = lotResult.rows[0].idlot;
    console.log("➡️ idlotFinal trouvé:", idlotFinal);
  } else {
    throw new Error(`⚠️ Aucun lot trouvé pour la date ${item.dateperemption}`);
  }
} else {
  throw new Error(`⚠️ Aucun idlot ni dateperemption fourni pour l'article ${item.idarticle}`);
}

/*
      let idlotFinal = 0;
console.log("📦 Item reçu:", item);

if (item.idlot !== undefined && item.idlot !== null) {
  idlotFinal = Number(item.idlot);
  console.log("✅ idlot fourni directement:", idlotFinal);
} else if (item.dateperemption) {
  console.log("📅 dateperemption reçue:", item.dateperemption);

  const lotResult = await client.query(
    `SELECT idlot
     FROM glot
     WHERE idmois = EXTRACT(MONTH FROM $1::date)
       AND idannee = EXTRACT(YEAR FROM $1::date)
     LIMIT 1`,
    [item.dateperemption]
  );

  console.log("🔎 Résultat lotResult:", lotResult.rows);

  idlotFinal = lotResult.rows[0]?.idlot || 0;
  console.log("➡️ idlotFinal après recherche:", idlotFinal);
} else {
  console.log("⚠️ Aucun idlot ni dateperemption fourni pour l'article:", item.idarticle);
}

*/


      /*
      // Résolution de l'idlot (0 par défaut)
      let idlotFinal = 0;
      if (item.idlot !== undefined && item.idlot !== null) {
        idlotFinal = Number(item.idlot);
      } else if (item.dateperemption) {
        const lotResult = await client.query(
          `SELECT idlot
           FROM glot
           WHERE idmois = EXTRACT(MONTH FROM $1::date)
             AND idannee = EXTRACT(YEAR FROM $1::date)
           LIMIT 1`,
          [item.dateperemption]
        );
        idlotFinal = lotResult.rows[0]?.idlot || 0;
      }

*/



      // Résolution automatique de idjrnal s'il est manquant
      let idjrnalFinal = item.idjrnal || null;
      if (!idjrnalFinal) {
        const jrnalResult = await client.query(
          `SELECT sc.idjrnalachat 
           FROM garticle a
           JOIN gsouscategorie sc ON a.idsouscategorie = sc.idsouscategorie
           WHERE a.idarticle = $1`,
          [item.idarticle]
        );
        idjrnalFinal = jrnalResult.rows[0]?.idjrnalachat || null;
      }

      // Insertion du détail (incluant codeachat et refoperation indispensables pour la compta)
      await client.query(
        `INSERT INTO gachat_detail (
            idachat, idagence, idarticle, idlot, idunite,
            quantite, poid_unitaire, prixachat_brut, remise, prixvente,
            numerolot, dateperemption, datevalidation, etat, dateachat,
            idjrnal, idmois, idannee, idfourn, iduser, codeachat, refoperation
        )
        VALUES (
            $1,$2,$3,$4,$5,
            $6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,
            $16,$17,$18,$19,$20,
            $21,$22
        )`,
        [
          idachat,
          idagence,
          item.idarticle,
          idlotFinal,
          item.idunite,
          qte,
          item.poid_unitaire || 0,
          prix,
          remise,
          item.prixvente || 0,
          item.numerolot || null,
          item.dateperemption || null,
          null, // datevalidation (mis à jour plus tard par comptabiliserAchat)
          item.etat || 'actif',
          item.dateachat || new Date(),
          idjrnalFinal,
          item.idmois || new Date().getMonth() + 1,
          item.idannee || new Date().getFullYear(),
          idfourn,
          iduser,
          codeachat,
          refoperation || observation || null
        ]
      );

      // Entrée en stock du nouvel achat
      await client.query(
        `SELECT public.entree_stock($1,$2,$3,$4,$5,$6,$7)`,
        [idagence, iddepot, item.idarticle, qte, prix, codeachat, idlotFinal]
      );
    }

    // 6. Insertion des nouveaux frais si applicables
    if (frais && frais.length > 0) {
      for (const f of frais) {
        await client.query(
          `INSERT INTO gachat_frais (idachat, idagence, idtypefrais, montant, mode_repartition)
           VALUES ($1,$2,$3,$4,$5)`,
          [idachat, idagence, f.idtypefrais, f.montant, f.mode_repartition]
        );
      }
    }

    // 7. Mise à jour de l'en-tête de la facture d'achat
    await client.query(
      `UPDATE gachat
       SET idagence = $1,
           idfourn = $2,
           iddepot = $3,
           idtypefr = $4,
           montant_brut = $5,
           montant_frais = $6,
           reference_facture = $7,
           observation = $8
       WHERE idachat = $9`,
      [
        idagence,
        idfourn,
        iddepot,
        idtypefr,
        totalBrut,
        montant_frais || 0,
        reference_facture || null,
        observation || null,
        idachat
      ]
    );

    // 8. Réévaluation de la répartition des frais
    await client.query(`SELECT repartir_frais_achat($1)`, [idachat]);

    // 9. Lancer la comptabilisation pour le nouvel achat (génère les écritures dans TMVTTHEORIQUE)
    await comptabiliserAchat(client, idachat, false);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Facture achat modifiée et comptabilisée avec succès' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur PUT /gachat/updatem/:idachat:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// =========================================================================
// 4. ANNULATION COMPLÈTE DE L'ACHAT
// =========================================================================
router.post('/annulerachatOLDE/:idachat', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { idachat } = req.params;
    const { iduser } = req.body;

    const achatResult = await client.query(`SELECT * FROM gachat WHERE idachat = $1`, [idachat]);
    if (achatResult.rows.length === 0) throw new Error("Achat introuvable");
    const achat = achatResult.rows[0];

    const verifAnnulation = await client.query(
      `SELECT 1 FROM gachat WHERE idachat_source = $1 AND type_operation = 'ANNULATION' LIMIT 1`,
      [idachat]
    );
    if (verifAnnulation.rows.length > 0) throw new Error("Cet achat est déjà annulé");

    const annulationResult = await client.query(
      `INSERT INTO gachat (
          idagence, idfourn, iddepot, idtypefr, iduser,
          codeachat, montant_brut, montant_frais, reference_facture,
          observation, idachat_source, type_operation
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        achat.idagence, achat.idfourn, achat.iddepot, achat.idtypefr, iduser,
        'ANNUL-' + achat.codeachat, (achat.montant_brut || 0), (achat.montant_frais || 0),
        achat.reference_facture, 'ANNULATION ACHAT : ' + achat.codeachat, achat.idachat, 'ANNULATION'
      ]
    );
    const annulation = annulationResult.rows[0];

    const detailsResult = await client.query(`SELECT * FROM gachat_detail WHERE idachat = $1`, [idachat]);
    for (const item of detailsResult.rows) {
      await client.query(
        `INSERT INTO gachat_detail (
            idachat, idagence, idarticle, idlot, idunite,
            quantite, poid_unitaire, prixachat_brut, remise, prixvente,
            numerolot, dateperemption, datevalidation, etat, dateachat,
            idjrnal, idmois, idannee, idfourn, iduser, codeachat, refoperation
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [
          annulation.idachat, item.idagence, item.idarticle, item.idlot, item.idunite,
          (item.quantite || 0), item.poid_unitaire || 0, (item.prixachat_brut || 0),
          (item.remise || 0), (item.prixvente || 0), item.numerolot, item.dateperemption,
          null, 'ANNULATION', new Date(), item.idjrnal, item.idmois, item.idannee,
          item.idfourn, iduser, 'ANNUL-LIGNE-' + item.codeachat, item.refoperation
        ]
      );

      await client.query(`UPDATE gachat_detail SET etat = 'ANNULATION' WHERE idachat = $1`, [item.idachat]);
      

       await client.query(`UPDATE gachat SET statut = 'ANNULATION' WHERE idachat = $1`, [item.idachat]);
      
      
      
      await client.query(
        `SELECT public.sortie_stock($1,$2,$3,$4,$5,$6)`,
        [item.idagence, achat.iddepot, item.idarticle, item.quantite, achat.codeachat, item.idlot]
      );
    }





    const fraisResult = await client.query(`SELECT * FROM gachat_frais WHERE idachat = $1`, [idachat]);
    for (const f of fraisResult.rows) {
      await client.query(
        `INSERT INTO gachat_frais (idachat, idagence, idtypefrais, montant, mode_repartition)
         VALUES ($1,$2,$3,$4,$5)`,
        [annulation.idachat, f.idagence, f.idtypefrais, -(f.montant || 0), f.mode_repartition]
      );
    }

    // Lancement de la comptabilisation d'annulation (inverse = true)
    await comptabiliserAchat(client, annulation.idachat, true);
    await client.query('COMMIT');

    res.status(200).json({ success: true, message: 'Achat annulé avec succès', data: annulation });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur annulerachat:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});








///  MISE A JOURS COMMANDE



router.get('/achatscommande/liste-filtrer', async (req, res) => {
  const { dateDebut, dateFin, idagence } = req.query;

  if (!dateDebut || !dateFin || !idagence) {
    return res.status(400).json({ error: 'dateDebut, dateFin et idagence sont obligatoires.' });
  }

  try {
    const queryText = `
      SELECT 
    a.ref_piece,
    a.dateachat,
    a.codeachat,
    ROUND(SUM(a.cout_total), 2) AS montant_brut,
    ROUND(SUM(a.autres_frais), 2) AS montant_frais,
    a.refoperation AS observation,
    a.codeachat AS reference_facture,
    a.idfourn,
    f.nomcomplet AS fournisseur_nom,
    f.idtypefr
FROM gachat_detailcommande a
JOIN gfournisseur f ON a.idfourn = f.idfourn
WHERE a.idagence = $1 
  AND a.dateachat BETWEEN $2 AND $3
  AND a.etat='actif' 
GROUP BY 
    a.ref_piece,
    a.dateachat,
    a.codeachat,
    a.refoperation,
    a.idfourn,
    f.nomcomplet,
    f.idtypefr
ORDER BY a.dateachat  DESC;

    `;
    const { rows } = await pool.query(queryText, [idagence, dateDebut, dateFin]);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /achats/liste-filtrer:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// =========================================================================
// 2. RECUPERER LES DETAILS COMPLETS D'UNE FACTURE AVEC UNITE ET DESIGNATION
// =========================================================================
router.get('/achatscommande/detailm/:ref_piece', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          d.*,
          a.designation,
          u.designation AS designationunite
       FROM gachat_detailcommande d
       JOIN garticle a ON a.idarticle = d.idarticle
       LEFT JOIN gunite u ON u.idunite = d.idunite
       WHERE d.ref_piece = $1`,
      [req.params.ref_piece]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Erreur GET /achats/detailm/:ref_piece:', err);
    res.status(500).json({ error: err.message });
  }
});




router.put('/gachatcommande/updatem/:ref_piece', async (req, res) => {
  const { ref_piece } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { 
      details, frais, idagence, idfourn, iddepot, idtypefr, 
      iduser, codeachat, refoperation 
    } = req.body;

    // 1. Suppression
    await client.query('DELETE FROM gachat_detailcommande WHERE ref_piece = $1', [ref_piece]);
   

    // 2. Réinsertion avec ref_piece
    for (const item of details) {
      await client.query(
        `INSERT INTO gachat_detailcommande (
            idachat, idagence, idarticle, idunite, quantite, poid_unitaire, 
            prixachat_brut, remise, prixvente, numerolot, dateperemption, 
            etat, dateachat, idjrnal, idmois, idannee, idfourn, iduser, 
            codeachat, refoperation, ref_piece, iddepot, idtypefr
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
        [
          0, 
          idagence, 
          item.idarticle, 
          item.idunite, 
          item.quantite, 
          item.poid_unitaire || 0, 
          item.prixachat_brut, 
          item.remise || 0, 
          item.prixvente || 0, 
          item.numerolot || null, 
          item.dateperemption || null, 
          item.etat || 'actif', 
          item.dateachat || new Date(), 
          item.idjrnal || null, 
          item.idmois, 
          item.idannee, 
          idfourn, 
          iduser, 
          codeachat, 
          refoperation, 
          codeachat, // Valeur de ref_piece
          iddepot, 
          idtypefr
        ]
      );
    }

  
   

    await client.query('COMMIT');
    res.status(200).json({ message: 'Facture mise à jour avec succès.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});





router.delete('/gachatcommande/:ref_piece', async (req, res) => {
  const { ref_piece } = req.params;
  const client = await pool.connect();

  try {
    // La suppression dans 'gachat' supprimera automatiquement 
    // tous les enregistrements dans 'gachat_detail' et 'gachat_frais'
    // grâce au ON DELETE CASCADE défini dans votre schéma.
    const result = await client.query('DELETE FROM gachat_detailcommande WHERE ref_piece = $1', [ref_piece]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Facture introuvable.' });
    }

    res.status(200).json({ message: 'Facture supprimée intégralement.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression : ' + err.message });
  } finally {
    client.release();
  }
});







module.exports = router;