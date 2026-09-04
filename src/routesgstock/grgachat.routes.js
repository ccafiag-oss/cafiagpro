const express = require('express');
const router = express.Router();
const pool = require('../config/db');






async function comptabiliserAchat(client, idachat, inverse = false) {

  // Si inverse = true, on échange débit et crédit
  const debitCol = inverse ? 'MONTANTCREDIT' : 'MONTANTDEBIT';
  const creditCol = inverse ? 'MONTANTDEBIT' : 'MONTANTCREDIT';

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
    WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = 'ANNULATION'
    GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenachat,
             GA.idmois, GA.idannee, GA.idagence, GA.iduser, GA.codeachat,GA.refoperation
  `;
  await client.query(insertDebit, [idachat]);

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
    WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = 'ANNULATION'
    GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GF.compteauxiliaire,
             GA.idmois, GA.idannee, GF.idfourn, GA.idagence, GA.iduser, GA.codeachat,GA.refoperation
  `;
  await client.query(insertCredit, [idachat]);

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
    WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = 'ANNULATION'
    GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenstock,
             GA.idmois, GA.idannee, GA.idagence, GA.iduser, GA.codeachat,GA.refoperation
  `;
  await client.query(insertDebitVar, [idachat]);

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
    WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = 'ANNULATION'
    GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenvrstock,
             GA.idmois, GA.idannee, GF.idfourn, GA.idagence, GA.iduser, GA.codeachat,GA.refoperation
  `;
  await client.query(insertCreditVar, [idachat]);

  // Validation du détail
  await client.query(
    `UPDATE gachat_detail SET datevalidation = NOW() WHERE idachat = $1`,
    [idachat]
  );
}







router.get('/garticleachat', async (req, res) => {
  const { idagence, iddepot, idtypefr, search } = req.query;

  // Vérification des paramètres obligatoires
  if (!idagence || !iddepot || !idtypefr) {
    return res.status(400).json({ error: 'Les paramètres "idagence", "iddepot" et "idtypefr" sont obligatoires.' });
  }

  // Construction de la requête SQL avec placeholders
  let queryText = `
    SELECT DISTINCT ON (a.idarticle)
      a.idagence,
      a.idarticle,
      a.designation,
      a.idcategorie,
      c.designation AS designationcategorie,
      a.idsouscategorie,
      sc.designation AS designationsouscategorie,
      sc.idjrnalachat as idjrnal,
      a.idsouscategoriedetail,
      scd.designation AS designationsouscatdetail,
      a.idunite,
      u.designation AS designationunite,
      st.quantite,
      st.quantite_reservee,
      st.stock_disponible,
      ttpa.prix_achat_ht,
      ttpa.prix_achat_ttc
    FROM garticle a
    LEFT JOIN gstock_depot st
      ON st.idarticle = a.idarticle
     AND st.idagence = a.idagence
    LEFT JOIN (
        SELECT DISTINCT ON (idarticle)
               idarticle, idagence, prix_achat_ht, prix_achat_ttc
        FROM ttarifprixachat
        WHERE idtypefr = $3 AND datefin IS NULL
        ORDER BY idarticle, datedebut DESC
    ) ttpa
      ON ttpa.idarticle = a.idarticle
     AND ttpa.idagence = a.idagence
    LEFT JOIN gsouscategorie sc 
      ON sc.idsouscategorie = a.idsouscategorie
     AND sc.idagence = a.idagence
    LEFT JOIN gsouscategoriedetail scd 
      ON scd.idsouscategoriedetail = a.idsouscategoriedetail
     AND scd.idagence = a.idagence
    LEFT JOIN gcategorie c 
      ON c.idcategorie = a.idcategorie
     AND c.idagence = a.idagence
    LEFT JOIN gunite u 
      ON u.idunite = a.idunite
     AND u.idagence = a.idagence
    WHERE a.idagence = $1
      AND st.iddepot = $2
    ORDER BY a.idarticle;
  `;

  const values = [idagence, iddepot, idtypefr];

  // Ajout de la recherche si 'search' est fourni et contient au moins 3 caractères
  if (search && search.length >= 3) {
    queryText = queryText.replace(
      'ORDER BY a.idarticle;',
      'AND a.designation ILIKE $4 ORDER BY a.idarticle;'
    );
    values.push(`%${search}%`);
  }

  try {
    const { rows } = await pool.query(queryText, values);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /garticleachat:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});






// ==========================================
// 1. AFFICHER TOUS LES ACHATS
// ==========================================
router.get('/gachat', async (req, res) => {
  const { idagence } = req.query;

  if (!idagence) {
    return res.status(400).json({
      error: 'idagence obligatoire'
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM gachat
       WHERE idagence = $1
       ORDER BY dateachat DESC`,
      [idagence]
    );

    res.json({ data: rows });

  } catch (err) {
    console.error('Erreur GET /gachat', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});







router.get('/gachat_resume', async (req, res) => {
  const client = await pool.connect();
  try {
    const queryText = `
      SELECT
        GA.idachat,
        GA.dateachat,
        ROUND(SUM(GA.cout_total), 2) AS total_achat,
        GF.nomcomplet AS fournisseur,
        GF.idfourn,
        GA.idagence
      FROM gachat_detail GA
      JOIN gfournisseur GF ON GA.idfourn = GF.idfourn
      WHERE GA.datevalidation IS NULL
        AND GA.etat = 'actif'
      GROUP BY GA.idachat, GA.dateachat, GF.nomcomplet, GF.idfourn, GA.idagence
      ORDER BY  GA.dateachat ,GA.idachat DESC;
    `;

    const { rows } = await client.query(queryText);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /gachat_resume:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  } finally {
    client.release();
  }
});
// ==========================================
// 2. DETAIL D’UNE FACTURE
// ==========================================
router.get('/gachat/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const facture = await pool.query(
      `SELECT * FROM gachat WHERE idachat = $1`,
      [id]
    );

    const details = await pool.query(
      `SELECT *
       FROM gachat_detail
       WHERE idachat = $1`,
      [id]
    );

    const frais = await pool.query(
      `SELECT *
       FROM gachat_frais
       WHERE idachat = $1`,
      [id]
    );

    res.json({
      facture: facture.rows[0],
      details: details.rows,
      frais: frais.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// ==========================================
// 3. ENREGISTRER ACHAT COMPLET
// ==========================================




/*
router.post('/gachat', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      idagence,
      idfourn,
      iddepot,
      idtypefr,
      iduser,
      codeachat,
      montant_brut,
      montant_frais,
      reference_facture,
      observation,
      details,
      frais,
      dateperemption
      
    } = req.body;


    

    for (const item of details) {

  // 🔥 1. récupérer lot PAR article
  let idlotrecupere = null;

  if (item.dateperemption) {
    const lotResult = await client.query(
      `SELECT idlot
       FROM glot
       WHERE idmois = EXTRACT(MONTH FROM $1::date)
         AND idannee = EXTRACT(YEAR FROM $1::date)
       LIMIT 1`,
      [item.dateperemption]
    );

    idlotrecupere = lotResult.rows[0]?.idlot || null;
  }





    // En-tête achat
    const achatResult = await client.query(
      `INSERT INTO gachat (
          idagence,
          idfourn,
          iddepot,
          idtypefr,
          iduser,
          codeachat,
          montant_brut,
          montant_frais,
          reference_facture,
          observation
          
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        idagence,
        idfourn,
        iddepot,
        idtypefr,
        iduser,
        codeachat,
        montant_brut || 0,
        montant_frais || 0,
        reference_facture || null,
        observation || null
        
      ]
    );

    const achat = achatResult.rows[0];
    const idachat = achat.idachat;



    // Détails achat
   //// for (const item of details) {




      await client.query(
        `INSERT INTO gachat_detail (
            idachat,
            idagence,
            idarticle,
            idlot,
            idunite,
            quantite,
            poid_unitaire,
            prixachat_brut,
            remise,
            prixvente,
            numerolot,
            dateperemption,
            datevalidation,
            etat,
            dateachat,
            idjrnal,
            idmois,
            idannee,
            idfourn,
            iduser
            
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          idachat,
          idagence,
          item.idarticle,
          idlotrecupere,
          item.idunite,
          item.quantite,
          item.poid_unitaire || 0,
          item.prixachat_brut,
          item.remise || 0,
          item.prixvente || 0,
          item.numerolot || null,
          item.dateperemption || null,
          item.datevalidation,
          item.etat,
          item.dateachat,
          item.idjrnal,
          item.idmois,
          item.idannee,
          item.idfourn,
          item.iduser
        ]
      );





      const checkLot = await client.query(
  `SELECT gere_lot
   FROM garticle
   WHERE idarticle = $1`,
  [item.idarticle]
);

const gereLot = checkLot.rows[0]?.gere_lot === true;

let idlotFinal = idlotrecupere;

if (gereLot) {
  if (!idlotFinal) {
    idlotFinal = 0; // fallback sécurisé
  }
} else {
  idlotFinal = null; // ou 0 selon ton modèle
}



 // 🔥 MISE À JOUR DU STOCK AUTOMATIQUE
  await client.query(
    `SELECT public.entree_stock($1,$2,$3,$4,$5,$6,$7)`,
    [
      idagence,
      iddepot,
      item.idarticle,
      item.quantite,
      item.prixachat_brut,
      codeachat,
      idlotrecupere
    ]
  );


    }

    // Frais achat
    for (const f of frais) {
      await client.query(
        `INSERT INTO gachat_frais (
            idachat,
            idagence,
            idtypefrais,
            montant,
            mode_repartition
        )
        VALUES ($1,$2,$3,$4,$5)`,
        [
          idachat,
          idagence,
          f.idtypefrais,
          f.montant,
          f.mode_repartition
        ]
      );







    }

    // Répartition automatique des frais
    await client.query(
      `SELECT repartir_frais_achat($1)`,
      [idachat]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Achat enregistré',
      data: achat
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({
      error: 'Erreur enregistrement achat'
    });

  } finally {
    client.release();
  }
});

*/

router.post('/gachatolde', async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const {
      idagence,
      idfourn,
      iddepot,
      idtypefr,
      iduser,
      codeachat,
      montant_brut,
      montant_frais,
      reference_facture,
      observation,
      details,
      frais
    } = req.body;

    // =====================================
    // INSERT ENTETE ACHAT UNE SEULE FOIS
    // =====================================

    const achatResult = await client.query(
      `INSERT INTO gachat (
          idagence,
          idfourn,
          iddepot,
          idtypefr,
          iduser,
          codeachat,
          montant_brut,
          montant_frais,
          reference_facture,
          observation
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        idagence,
        idfourn,
        iddepot,
        idtypefr,
        iduser,
        codeachat,
        montant_brut || 0,
        montant_frais || 0,
        reference_facture || null,
        observation || null
      ]
    );

    const achat = achatResult.rows[0];
    const idachat = achat.idachat;

    // =====================================
    // DETAILS ACHAT
    // =====================================

    for (const item of details) {

      let idlotrecupere = null;

      // récupération lot
      if (item.dateperemption) {

        const lotResult = await client.query(
          `SELECT idlot
           FROM glot
           WHERE idmois = EXTRACT(MONTH FROM $1::date)
           AND idannee = EXTRACT(YEAR FROM $1::date)
           LIMIT 1`,
          [item.dateperemption]
        );

        idlotrecupere = lotResult.rows[0]?.idlot || null;
      }

      // vérifier gestion lot
      const checkLot = await client.query(
        `SELECT gere_lot
         FROM garticle
         WHERE idarticle = $1`,
        [item.idarticle]
      );

      const gereLot = checkLot.rows[0]?.gere_lot === true;

      let idlotFinal = null;

      if (gereLot) {
        idlotFinal = idlotrecupere || 0;
      }

      // insert détail
      await client.query(
        `INSERT INTO gachat_detail (
            idachat,
            idagence,
            idarticle,
            idlot,
            idunite,
            quantite,
            poid_unitaire,
            prixachat_brut,
            remise,
            prixvente,
            numerolot,
            dateperemption,
            datevalidation,
            etat,
            dateachat,
            idjrnal,
            idmois,
            idannee,
            idfourn,
            iduser,
            codeachat
        )
        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,$21
        )`,
        [
          idachat,
          idagence,
          item.idarticle,
          idlotFinal,
          item.idunite,
          item.quantite,
          item.poid_unitaire || 0,
          item.prixachat_brut,
          item.remise || 0,
          item.prixvente || 0,
          item.numerolot || null,
          item.dateperemption || null,
          item.datevalidation || null,
          item.etat || actif,
          item.dateachat,
          item.idjrnal || null,
          item.idmois,
          item.idannee,
          item.idfourn,
          item.iduser,
          codeachat
        ]
      );

      // entrée stock
      await client.query(
        `SELECT public.entree_stock($1,$2,$3,$4,$5,$6,$7)`,
        [
          idagence,
          iddepot,
          item.idarticle,
          item.quantite,
          item.prixachat_brut,
          codeachat,
          idlotFinal
        ]
      );

    }

    // =====================================
    // FRAIS ACHAT
    // =====================================

    for (const f of frais) {

      await client.query(
        `INSERT INTO gachat_frais (
            idachat,
            idagence,
            idtypefrais,
            montant,
            mode_repartition
        )
        VALUES ($1,$2,$3,$4,$5)`,
        [
          idachat,
          idagence,
          f.idtypefrais,
          f.montant,
          f.mode_repartition
        ]
      );

    }

    // =====================================
    // REPARTITION FRAIS
    // =====================================

    await client.query(
      `SELECT repartir_frais_achat($1)`,
      [idachat]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Achat enregistré',
      data: achat
    });

  } catch (err) {

    await client.query('ROLLBACK');

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  } finally {

    client.release();

  }

});





/*

router.post('/gachat', async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const {
      idagence,
      idfourn,
      iddepot,
      idtypefr,
      iduser,
      codeachat,
      montant_brut,
      montant_frais,
      reference_facture,
      observation,
      details,
      frais,
      refoperation
    } = req.body;

    // =====================================
    // INSERT ENTETE ACHAT UNE SEULE FOIS
    // =====================================

    const achatResult = await client.query(
      `INSERT INTO gachat (
          idagence,
          idfourn,
          iddepot,
          idtypefr,
          iduser,
          codeachat,
          montant_brut,
          montant_frais,
          reference_facture,
          observation
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        idagence,
        idfourn,
        iddepot,
        idtypefr,
        iduser,
        codeachat,
        montant_brut || 0,
        montant_frais || 0,
        reference_facture || null,
        observation || null
      ]
    );

    const achat = achatResult.rows[0];
    const idachat = achat.idachat;

    // =====================================
    // DETAILS ACHAT
    // =====================================

    for (const item of details) {

      let idlotrecupere = null;

      // récupération lot
      if (item.dateperemption) {

        const lotResult = await client.query(
          `SELECT idlot
           FROM glot
           WHERE idmois = EXTRACT(MONTH FROM $1::date)
           AND idannee = EXTRACT(YEAR FROM $1::date)
           LIMIT 1`,
          [item.dateperemption]
        );

        idlotrecupere = lotResult.rows[0]?.idlot || null;
      }

      // vérifier gestion lot
      const checkLot = await client.query(
        `SELECT gere_lot
         FROM garticle
         WHERE idarticle = $1`,
        [item.idarticle]
      );

      const gereLot = checkLot.rows[0]?.gere_lot === true;

      let idlotFinal = null;

      if (gereLot) {
        idlotFinal = idlotrecupere || 0;
      }

      // insert détail
      await client.query(
        `INSERT INTO gachat_detail (
            idachat,
            idagence,
            idarticle,
            idlot,
            idunite,
            quantite,
            poid_unitaire,
            prixachat_brut,
            remise,
            prixvente,
            numerolot,
            dateperemption,
            datevalidation,
            etat,
            dateachat,
            idjrnal,
            idmois,
            idannee,
            idfourn,
            iduser,
            codeachat,
            refoperation
        )
        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,$21,$22
        )`,
        [
          idachat,
          idagence,
          item.idarticle,
          idlotFinal,
          item.idunite,
          item.quantite,
          item.poid_unitaire || 0,
          item.prixachat_brut,
          item.remise || 0,
          item.prixvente || 0,
          item.numerolot || null,
          item.dateperemption || null,
          item.datevalidation || null,
          item.etat || 'actif',
          item.dateachat,
          item.idjrnal || null,
          item.idmois,
          item.idannee,
          item.idfourn,
          item.iduser,
          codeachat,
          refoperation
        ]
      );

      // entrée stock
      await client.query(
        `SELECT public.entree_stock($1,$2,$3,$4,$5,$6,$7)`,
        [
          idagence,
          iddepot,
          item.idarticle,
          item.quantite,
          item.prixachat_brut,
          codeachat,
          idlotFinal
        ]
      );

    }

    // =====================================
    // FRAIS ACHAT
    // =====================================

    for (const f of frais) {

      await client.query(
        `INSERT INTO gachat_frais (
            idachat,
            idagence,
            idtypefrais,
            montant,
            mode_repartition
        )
        VALUES ($1,$2,$3,$4,$5)`,
        [
          idachat,
          idagence,
          f.idtypefrais,
          f.montant,
          f.mode_repartition
        ]
      );

    }

    // =====================================
    // REPARTITION FRAIS
    // =====================================

    await client.query(
      `SELECT repartir_frais_achat($1)`,
      [idachat]
    );

    // =====================================
    // COMPTABILISATION AUTOMATIQUE
    // =====================================

    // INSERT Débit (compte général achat)
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
        ROUND(SUM(GA.cout_total), 2),
        0,
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
      WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = 'actif'
      GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenachat,
               GA.idmois, GA.idannee, GA.idagence, GA.iduser,GA.codeachat,GA.refoperation
    `;
    await client.query(insertDebit, [idachat]);

    // INSERT Crédit (compte fournisseur)
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
        0,
        ROUND(SUM(GA.cout_total), 2),
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
      WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = 'actif'
      GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GF.compteauxiliaire,
               GA.idmois, GA.idannee, GF.idfourn, GA.idagence, GA.iduser,GA.codeachat,GA.refoperation
    `;
    await client.query(insertCredit, [idachat]);

    // INSERT Débit variation de stock
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
        ROUND(SUM(GA.cout_total), 2),
        0,
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
      WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = 'actif'
      GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenstock,
               GA.idmois, GA.idannee, GA.idagence, GA.iduser,GA.codeachat,GA.refoperation
    `;
    await client.query(insertDebitVar, [idachat]);

    // INSERT Crédit variation de stock
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
        0,
        ROUND(SUM(GA.cout_total), 2),
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
      WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = 'actif'
      GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenvrstock,
               GA.idmois, GA.idannee, GF.idfourn, GA.idagence, GA.iduser,GA.codeachat,GA.refoperation
    `;
    await client.query(insertCreditVar, [idachat]);

    // UPDATE validation des détails
    await client.query(
      `UPDATE gachat_detail SET datevalidation = NOW() WHERE idachat = $1`,
      [idachat]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Achat enregistré et comptabilisé',
      data: achat
    });

  } catch (err) {

    await client.query('ROLLBACK');

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  } finally {

    client.release();

  }

});

*/



router.post('/gachat', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      idagence,
      idfourn,
      iddepot,
      idtypefr,
      iduser,
      codeachat,
      details,
      frais,
      refoperation
    } = req.body;




    // ==========================================
    // 0. VÉRIFICATION DE L'INVENTAIRE EN COURS PAR AGENCE
    // ==========================================
    const checkInventaire = await client.query(
      `SELECT * FROM g_fiche_inventaire WHERE etat = 'true' AND idagence = $1 LIMIT 1`,
      [idagence]
    );

    if (checkInventaire.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        code: 'INVENTAIRE_EN_COURS',
        message: 'Veuillez patienter, inventaire en cours.'
      });
    }
    // ==========================================




    let idachat = null;

    // =====================================
    // INSERTION DANS GACHAT_DETAIL AVEC DEPOT ET TYPEFR
    // =====================================
    for (const item of details) {
      const result = await client.query(
        `INSERT INTO gachat_detail (
            idachat,
            idagence,
            idarticle,
            idunite,
            quantite,
            poid_unitaire,
            prixachat_brut,
            remise,
            prixvente,
            numerolot,
            dateperemption,
            etat,
            dateachat,
            idjrnal,
            idmois,
            idannee,
            idfourn,
            iduser,
            codeachat,
            refoperation,
            ref_piece,
            iddepot,   -- Ajouté
            idtypefr   -- Ajouté
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,$23)
        RETURNING idachat`,
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
          codeachat,
          iddepot,   // Transmis au trigger
          idtypefr   // Transmis au trigger
        ]
      );

      if (!idachat) {
        idachat = result.rows[0].idachat;
      }
    }

    // =====================================
    // INSERTION DES FRAIS DE L'ACHAT
    // =====================================
    if (frais && frais.length > 0) {
      for (const f of frais) {
        await client.query(
          `INSERT INTO gachat_frais (
              idachat,
              idagence,
              idtypefrais,
              montant,
              mode_repartition
          )
          VALUES ($1, $2, $3, $4, $5)`,
          [
            idachat,
            idagence,
            f.idtypefrais,
            f.montant,
            f.mode_repartition
          ]
        );
      }

      await client.query(
        `SELECT public.repartir_frais_achat($1)`,
        [idachat]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Achat enregistré, stocks mis à jour, et comptabilisé automatiquement par la base de données.',
      idachat: idachat
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({
      error: err.message || 'Erreur lors de l’enregistrement de l’achat'
    });
  } finally {
    client.release();
  }
});














// ==========================================
// 4. MODIFIER ACHAT
// ==========================================
router.put('/gachat/:id', async (req, res) => {
  const { id } = req.params;
  const {
    montant_brut,
    montant_frais,
    observation,
    reference_facture,
    statut
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE gachat
       SET montant_brut = $1,
           montant_frais = $2,
           observation = $3,
           reference_facture = $4,
           statut = $5
       WHERE idachat = $6
       RETURNING *`,
      [
        montant_brut,
        montant_frais,
        observation,
        reference_facture,
        statut,
        id
      ]
    );

    res.json({
      message: 'Facture modifiée',
      data: rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Erreur modification'
    });
  }
});













// ==========================================
// AFFICHER DETAILS ACHATS
// ==========================================
router.get('/gachatdetail/:idagence', async (req, res) => {

  const client = await pool.connect();

  try {

    const { idagence } = req.params;

    const result = await client.query(
      `
      SELECT 
          gad.iddetail,
          gad.idachat,
          gad.ref_piece,
          gad.idagence,
          gad.idarticle,
          gad.idlot,
          gad.idunite,
          gad.quantite,
          gad.poid_unitaire,
          gad.prixachat_brut,
          gad.remise,
          gad.prixvente,
          gad.transport_reparti,
          gad.taxe_repartie,
          gad.autres_frais,
          gad.cout_achat_unitaire,
          gad.cout_total,
          gad.numerolot,
          gad.dateperemption,
          gad.datevalidation,
          gad.etat,
          gad.dateachat,
          gad.idjrnal,
          gad.idmois,
          gad.idannee,
          gad.idfourn,
          gad.iduser,

          ga.designation,
          gf.nomcomplet

      FROM gachat_detail gad

      INNER JOIN garticle ga
          ON ga.idarticle = gad.idarticle

      INNER JOIN gfournisseur gf
          ON gf.idfourn = gad.idfourn

      WHERE gad.idagence = $1 and etat='actif'

      ORDER BY gad.iddetail DESC
      `,
      [idagence]
    );

    res.status(200).json({
      success: true,
      total: result.rows.length,
      data: result.rows
    });

  } catch (err) {

    console.error('Erreur affichage achat détail :', err);

    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });

  } finally {

    client.release();

  }

});




// ==========================================
// ANNULATION ACHAT
// ==========================================
router.post('/annulerachat/:idachat', async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const { idachat } = req.params;
    const { iduser } = req.body;

    // Vérifier achat
    const achatResult = await client.query(
      `SELECT *
       FROM gachat
       WHERE idachat = $1`,
      [idachat]
    );

    if (achatResult.rows.length === 0) {
      throw new Error("Achat introuvable");
    }

    const achat = achatResult.rows[0];

    // Vérifier si déjà annulé
    const verifAnnulation = await client.query(
      `SELECT 1
       FROM gachat
       WHERE idachat_source = $1
       AND type_operation = 'ANNULATION'
       LIMIT 1`,
      [idachat]
    );

    if (verifAnnulation.rows.length > 0) {
      throw new Error("Cet achat est déjà annulé");
    }

    // =====================================
    // CREER ENTETE ANNULATION
    // =====================================


console.log({
  codeachat: ('ANNUL-' + achat.codeachat),
  observation: ('ANNUL ACHAT ' + achat.codeachat),
  type_operation: 'ANNULATION'
});



    const annulationResult = await client.query(
      `
      INSERT INTO gachat (
          idagence,
          idfourn,
          iddepot,
          idtypefr,
          iduser,
          codeachat,
          montant_brut,
          montant_frais,
          reference_facture,
          observation,
          idachat_source,
          type_operation
      )
      VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10,
          $11,$12
      )
      RETURNING *
      `,
      [
        achat.idagence,
        achat.idfourn,
        achat.iddepot,
        achat.idtypefr,
        iduser,
        'ANNUL-' + achat.codeachat,
        (achat.montant_brut || 0),
        (achat.montant_frais || 0),
        achat.reference_facture,
        'ANNULATION ACHAT : ' + achat.codeachat,
        achat.idachat,
        'ANNULATION'
      ]
    );

    const annulation = annulationResult.rows[0];

    // =====================================
    // RECUPERATION DETAILS
    // =====================================

    const detailsResult = await client.query(
      `
      SELECT *
      FROM gachat_detail
      WHERE idachat = $1
      `,
      [idachat]
    );

    // =====================================
    // INSERTION DETAILS INVERSES
    // =====================================

    for (const item of detailsResult.rows) {

      await client.query(
        `
        INSERT INTO gachat_detail (
            idachat,
            idagence,
            idarticle,
            idlot,
            idunite,
            quantite,
            poid_unitaire,
            prixachat_brut,
            remise,
            prixvente,
            numerolot,
            dateperemption,
            datevalidation,
            etat,
            dateachat,
            idjrnal,
            idmois,
            idannee,
            idfourn,
            iduser,codeachat,refoperation
        )
        VALUES (
            $1,$2,$3,$4,$5,
            $6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,
            $16,$17,$18,$19,$20,$21,$22
        )
        `,
        [
          annulation.idachat,
          item.idagence,
          item.idarticle,
          item.idlot,
          item.idunite,

          // QUANTITE NEGATIVE
          (item.quantite || 0),

          item.poid_unitaire || 0,

          // PRIX NEGATIF
          (item.prixachat_brut || 0),

          (item.remise || 0),

          (item.prixvente || 0),

          item.numerolot,
          item.dateperemption,
           null,
          'ANNULATION',
          new Date(),
          item.idjrnal,
          item.idmois,
          item.idannee,
          item.idfourn,
          iduser,
          'ANNUL-LIGNE-' + item.codeachat +idachat+iduser,
          item.refoperation
        ]
      );




// ==========================================
// METTRE LA LIGNE ORIGINALE EN ANNULATION
// ==========================================
await client.query(
  `
  UPDATE gachat_detail
  SET etat = $1
  WHERE idachat = $2
  `,
  [
    'ANNULATION',
    item.idachat
  ]
);



      // =====================================
      // SORTIE STOCK
      // =====================================

      await client.query(
        `SELECT public.sortie_stock($1,$2,$3,$4,$5,$6)`,
        [
          item.idagence,
          achat.iddepot,
          item.idarticle,
          item.quantite,
          achat.codeachat,
          item.idlot
         /// item.prixachat_brut
        ]
      );

    }

    // =====================================
    // ANNULATION DES FRAIS
    // =====================================

    const fraisResult = await client.query(
      `
      SELECT *
      FROM gachat_frais
      WHERE idachat = $1
      `,
      [idachat]
    );

    for (const f of fraisResult.rows) {

      await client.query(
        `
        INSERT INTO gachat_frais (
            idachat,
            idagence,
            idtypefrais,
            montant,
            mode_repartition
        )
        VALUES ($1,$2,$3,$4,$5)
        `,
        [
          annulation.idachat,
          f.idagence,
          f.idtypefrais,
          -(f.montant || 0),
          f.mode_repartition
        ]
      );

    }


    // =====================================
// COMPTABILISATION DE L'ANNULATION (écritures inversées)
// =====================================
await comptabiliserAchat(client, annulation.idachat, true);



    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Achat annulé avec succès',
      data: annulation
    });

  } catch (err) {

    await client.query('ROLLBACK');

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  } finally {

    client.release();

  }

});












// ==========================================
// ANNULATION LIGNE ACHAT
// ==========================================
router.post('/annulerachatligne/:iddetail', async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const { iddetail } = req.params;
    const { iduser } = req.body;

    // ==========================================
    // DETAIL ORIGINAL
    // ==========================================
    const detailResult = await client.query(
      `
      SELECT d.*, a.iddepot, a.codeachat
      FROM gachat_detail d
      INNER JOIN gachat a
        ON a.idachat = d.idachat
      WHERE d.iddetail = $1
      `,
      [iddetail]
    );

    if (detailResult.rows.length === 0) {
      throw new Error("Ligne achat introuvable");
    }

    const item = detailResult.rows[0];

    // ==========================================
    // VERIFIER SI DEJA ANNULE
    // ==========================================
    const verif = await client.query(
      `
      SELECT 1
      FROM gachat_detail
      WHERE iddetail_source = $1
      LIMIT 1
      `,
      [iddetail]
    );

    if (verif.rows.length > 0) {
      throw new Error("Cette ligne est déjà annulée");
    }

    // ==========================================
    // CREER ENTETE ANNULATION
    // ==========================================
    const achatAnnulResult = await client.query(
      `
      INSERT INTO gachat (
          idagence,
          idfourn,
          iddepot,
          idtypefr,
          iduser,
          codeachat,
          montant_brut,
          montant_frais,
          observation,
          type_operation
      )
      VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10
      )
      RETURNING *
      `,
      [
        item.idagence,
        item.idfourn,
        item.iddepot,
        1,
        iduser,
        'ANNUL-LIGNE-' + item.codeachat +iddetail,
        item.cout_total || 0,
        0,
        'ANNULATION LIGNE ACHAT',
        'ANNULATION'
      ]
    );

    const achatAnnul = achatAnnulResult.rows[0];

    // ==========================================
    // INSERTION DETAIL ANNULATION
    // ==========================================
    await client.query(
      `
      INSERT INTO gachat_detail (
          idachat,
          idagence,
          idarticle,
          idlot,
          idunite,
          quantite,
          poid_unitaire,
          prixachat_brut,
          remise,
          prixvente,
         
        
          numerolot,
          dateperemption,
          datevalidation,
          etat,
          dateachat,
          idjrnal,
          idmois,
          idannee,
          idfourn,
          iduser,
          iddetail_source,codeachat,refoperation
      )
      VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,
          $21,$22,$23
      )
      `,
      [
        achatAnnul.idachat,
        item.idagence,
        item.idarticle,
        item.idlot,
        item.idunite,

        // PAS NEGATIF
        item.quantite || 0,

        item.poid_unitaire || 0,
        item.prixachat_brut || 0,
        item.remise || 0,
        item.prixvente || 0,

       
       

        item.numerolot,
        item.dateperemption,

        null,

        'ANNULATION',

        new Date(),

        item.idjrnal,
        item.idmois,
        item.idannee,
        item.idfourn,
        iduser,

        item.iddetail,
        'ANNUL-LIGNE-' + item.codeachat +iddetail,
        item.refoperation
      ]
    );


// ==========================================
// METTRE LA LIGNE ORIGINALE EN ANNULATION
// ==========================================
await client.query(
  `
  UPDATE gachat_detail
  SET etat = $1
  WHERE iddetail = $2
  `,
  [
    'ANNULATION',
    item.iddetail
  ]
);

   



    // ==========================================
    // SORTIE STOCK
    // ==========================================
    await client.query(
      `
      SELECT public.sortie_stock($1,$2,$3,$4,$5,$6)
      `,
      [
        item.idagence,
        item.iddepot,
        item.idarticle,
        item.quantite,
        item.codeachat,
         item.idlot
      ]
    );


    console.log("=== DEBUG ANNULATION ACHAT ===");
console.log("Client:", client);
console.log("ID Achat Annulé:", achatAnnul.idachat);
console.log("Mode Annulation:", true);




    await comptabiliserAchat(client, achatAnnul.idachat, true);



    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Ligne annulée avec succès'
    });

  } catch (err) {

    await client.query('ROLLBACK');

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  } finally {

    client.release();

  }

});









///  PARTIE  POUR MODIFICATION  FACTURE  ACHAT

// ======================================================
// LISTE FOURNISSEURS POUR MODIFICATION FACTURE ACHAT
// ======================================================
router.get('/achats/fournisseursm', async (req, res) => {

  const { date1, date2, idagence } = req.query;

  try {

    const result = await pool.query(
      `
      SELECT
          a.idfourn,

         nomcomplet,

          COUNT(a.idachat) AS nb_factures,

          SUM(a.montant_brut + a.montant_frais) AS total

      FROM gachat a

      JOIN gfournisseur f
           ON f.idfourn = a.idfourn

      WHERE a.dateachat BETWEEN $1 AND $2
        AND a.idagence = $3

      GROUP BY
          a.idfourn,

        nomcomplet

      ORDER BY
        nomcomplet
      `,
      [date1, date2, idagence]
    );

    res.json({
      data: result.rows
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});



// ======================================================
// LISTE FACTURES ACHAT PAR FOURNISSEUR
// ======================================================
router.get('/achats/facturesm', async (req, res) => {

  const { idfourn, date1, date2 } = req.query;

  try {

    const result = await pool.query(
      `
      SELECT *
      FROM gachat

      WHERE idfourn = $1
        AND dateachat BETWEEN $2 AND $3

      ORDER BY dateachat DESC
      `,
      [idfourn, date1, date2]
    );

    res.json({
      data: result.rows
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});


// ======================================================
// DETAIL FACTURE ACHAT
// ======================================================
router.get('/achats/detailm/:idachat', async (req, res) => {

  try {

    const result = await pool.query(
      `
      SELECT
          d.*,
          a.designation,a.codearticle

      FROM gachat_detail d

      JOIN garticle a
           ON a.idarticle = d.idarticle

      WHERE d.idachat = $1
      `,
      [req.params.idachat]
    );

    res.json({
      data: result.rows
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});






router.get('/achats/detailmgerelot/:idachat', async (req, res) => {

  try {

    const result = await pool.query(
      `
     SELECT 
    d.*, 
    a.designation, 
    ttpv.prix_vente_ttc, 
    a.codearticle, 
    glo.numerolot  -- On récupère le lot depuis la table glot liée par idlot
FROM gachat_detail d
-- Jointure avec l'article
INNER JOIN garticle a ON a.idarticle = d.idarticle
-- Jointure avec la table des lots via l'idlot (Clé primaire/étrangère)
LEFT JOIN glot_stock glo ON glo.idlot = d.idlot
-- Jointure avec le stock (optionnel, seulement si vous avez besoin d'infos de stock)
-- Jointure avec Tarif
INNER JOIN public.ttarifprixvente ttpv ON ttpv.idarticle = d.idarticle AND ttpv.datefin IS NULL
      WHERE d.idachat = $1
      `,
      [req.params.idachat]
    );

    res.json({
      data: result.rows
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});



// ==========================================
// MODIFIER FACTURE ACHAT
// ==========================================
router.put('/gachat/updatem/:idachat', async (req, res) => {
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
      details,
      frais
    } = req.body;

    if (!details || details.length === 0) {
      throw new Error("L'achat doit contenir au moins un article.");
    }

    // =========================================================
    // 1. RECUPERATION ANCIEN ACHAT
    // =========================================================
    const achatRes = await client.query(
      `SELECT * FROM gachat WHERE idachat = $1`,
      [idachat]
    );

    if (achatRes.rows.length === 0) {
      throw new Error("Facture achat introuvable.");
    }

    // =========================================================
    // 2. RESTOCKAGE INVERSE
    //    (SUPPRIMER LES ANCIENNES ENTREES STOCK)
    // =========================================================
    const oldDetails = await client.query(
      `SELECT *
       FROM gachat_detail
       WHERE idachat = $1`,
      [idachat]
    );

    for (const d of oldDetails.rows) {

      // SORTIE STOCK POUR ANNULER ANCIEN ACHAT
      await client.query(
        `SELECT public.sortie_stock($1,$2,$3,$4,$5)`,
        [
          idagence,
          iddepot,
          d.idarticle,
          d.quantite,
          codeachat
        ]
      );
    }

    // =========================================================
    // 3. SUPPRESSION ANCIENS DETAILS + FRAIS
    // =========================================================
    await client.query(
      `DELETE FROM gachat_detail WHERE idachat = $1`,
      [idachat]
    );

    await client.query(
      `DELETE FROM gachat_frais WHERE idachat = $1`,
      [idachat]
    );

    // =========================================================
    // 4. INSERTION NOUVEAUX DETAILS
    // =========================================================
    let totalBrut = 0;

    for (const item of details) {

      const qte = Number(item.quantite || 0);
      const prix = Number(item.prixachat_brut || 0);
      const remise = Number(item.remise || 0);

      totalBrut += (qte * prix) - remise;

      // INSERT DETAIL
      await client.query(
        `INSERT INTO gachat_detail (
            idachat,
            idagence,
            idarticle,
            idlot,
            idunite,
            quantite,
            poid_unitaire,
            prixachat_brut,
            remise,
            prixvente,
            numerolot,
            dateperemption,
            datevalidation,
            etat,
            dateachat,
            idjrnal,
            idmois,
            idannee,
            idfourn,
            iduser
        )
        VALUES (
            $1,$2,$3,$4,$5,
            $6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,
            $16,$17,$18,$19,$20
        )`,
        [
          idachat,
          idagence,
          item.idarticle,
          item.idlot || null,
          item.idunite,
          qte,
          item.poid_unitaire || 0,
          prix,
          remise,
          item.prixvente || 0,
          item.numerolot || null,
          item.dateperemption || null,
          item.datevalidation,
          item.etat,
          item.dateachat,
          item.idjrnal,
          item.idmois,
          item.idannee,
          idfourn,
          iduser
        ]
      );

      // =====================================================
      // ENTREE STOCK NOUVEL ACHAT
      // =====================================================
      await client.query(
        `SELECT public.entree_stock($1,$2,$3,$4,$5,$6)`,
        [
          idagence,
          iddepot,
          item.idarticle,
          qte,
          prix,
          codeachat
        ]
      );
    }

    // =========================================================
    // 5. INSERTION NOUVEAUX FRAIS
    // =========================================================
    if (frais && frais.length > 0) {

      for (const f of frais) {

        await client.query(
          `INSERT INTO gachat_frais (
              idachat,
              idagence,
              idtypefrais,
              montant,
              mode_repartition
          )
          VALUES ($1,$2,$3,$4,$5)`,
          [
            idachat,
            idagence,
            f.idtypefrais,
            f.montant,
            f.mode_repartition
          ]
        );
      }
    }

    // =========================================================
    // 6. MISE A JOUR EN-TETE ACHAT
    // =========================================================
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

    // =========================================================
    // 7. REPARTITION DES FRAIS
    // =========================================================
    await client.query(
      `SELECT repartir_frais_achat($1)`,
      [idachat]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Facture achat modifiée avec succès'
    });

  } catch (err) {

    await client.query('ROLLBACK');

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  } finally {
    client.release();
  }
});





///  COMMANDE  ACHAT



router.post('/gachatcommande', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      idagence,
      idfourn,
      iddepot,
      idtypefr,
      iduser,
      codeachat,
      details,
      frais,
      refoperation
    } = req.body;

    let idachat = null;

    // =====================================
    // INSERTION DANS GACHAT_DETAIL AVEC DEPOT ET TYPEFR
    // =====================================
    for (const item of details) {
      const result = await client.query(
        `INSERT INTO gachat_detailcommande (
            idachat,
            idagence,
            idarticle,
            idunite,
            quantite,
            poid_unitaire,
            prixachat_brut,
            remise,
            prixvente,
            numerolot,
            dateperemption,
            etat,
            dateachat,
            idjrnal,
            idmois,
            idannee,
            idfourn,
            iduser,
            codeachat,
            refoperation,
            ref_piece,
            iddepot,   -- Ajouté
            idtypefr   -- Ajouté
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,$23)
        RETURNING idachat`,
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
          codeachat,
          iddepot,   // Transmis au trigger
          idtypefr   // Transmis au trigger
        ]
      );

      if (!codeachat) {
        codeachat = result.rows[0].codeachat;
      }
    }


    await client.query('COMMIT');

    res.status(201).json({
      message: 'Achat enregistré, stocks mis à jour, et comptabilisé automatiquement par la base de données.',
      idachat: idachat
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({
      error: err.message || 'Erreur lors de l’enregistrement de l’achat'
    });
  } finally {
    client.release();
  }
});




///  REPARTITION  FRAIS  (ref_piece IS NULL OR ref_piece = '') AND

router.post('/initialiser-taxes', async (req, res) => {
  const { refPiece, idagence } = req.body;

  if (!refPiece || !idagence) {
    return res.status(400).json({ error: 'Les champs refPiece et idagence (integer) sont requis.' });
  }

  const client = await pool.connect();
  try {
    const parsedIdAgence = parseInt(idagence, 10);

    const result = await client.query(
      `UPDATE public.t_taxe 
       SET ref_piece = $1 
       WHERE  idagence = $2::integer;`,
      [refPiece, parsedIdAgence]
    );

    res.status(200).json({ 
      message: 'Initialisation réussie', 
      rowsAffected: result.rowCount 
    });
  } catch (err) {
    console.error("Erreur lors de l'initialisation des taxes :", err);
    res.status(500).json({ 
      error: 'Erreur lors de l\'initialisation des taxes', 
      details: err.message 
    });
  } finally {
    client.release();
  }
});






router.get('/taxes-facture', async (req, res) => {
  const { refPiece, idagence } = req.query;

  if (!refPiece || !idagence) {
    return res.status(400).json({ error: 'Les paramètres refPiece et idagence sont obligatoires.' });
  }

  const client = await pool.connect();
  try {
    const parsedIdAgence = parseInt(idagence, 10);

    const result = await client.query(
      `SELECT idtx, codetx, designation, montant, mode_calcule, ref_colonne_achatdetail 
       FROM public.t_taxe 
       WHERE ref_piece = $1 AND idagence = $2::integer
       ORDER BY idtx ASC;`,
      [refPiece, parsedIdAgence]
    );
    res.status(200).json({ data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des taxes' });
  } finally {
    client.release();
  }
});

router.put('/update-taxe-montant', async (req, res) => {
  const { idtx, montant } = req.body;
  const client = await pool.connect();

  try {
    await client.query(
      'UPDATE public.t_taxe SET montant = $1 WHERE idtx = $2;',
      [montant, idtx]
    );
    res.status(200).json({ message: 'Montant mis à jour avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du montant' });
  } finally {
    client.release();
  }
});




router.post('/repartir-frais', async (req, res) => {
  const { refPiece } = req.body;
  const client = await pool.connect();

  try {
    // 1. Début de la transaction pour garantir la cohérence
    await client.query('BEGIN');

    // 2. Exécution de la procédure stockée
    await client.query('SELECT public.sp_repartir_frais_facture($1);', [refPiece]);

    // 3. Exécution de votre mise à jour
    // Note: Assurez-vous de passer refPiece en paramètre pour éviter les injections SQL
    await client.query(
      'UPDATE gachat_detail SET taxe_repartie = total_f WHERE ref_piece = $1', 
      [refPiece]
    );

    // 4. Validation des changements
    await client.query('COMMIT');
    
    res.status(200).json({ message: 'Répartition et mise à jour effectuées avec succès' });
  } catch (err) {
    // Annulation en cas d'erreur
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la répartition des frais' });
  } finally {
    client.release();
  }
});



router.post('/repartir-frais2222OLDE', async (req, res) => {
  const { refPiece } = req.body;
  const client = await pool.connect();

  try {
    await client.query('SELECT public.sp_repartir_frais_facture($1);', [refPiece]);
    res.status(200).json({ message: 'Répartition effectuée avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la répartition des frais' });
  } finally {
    client.release();
  }
});



///  RAPPORT



// 1. Point de terminaison pour le résumé financier regroupé des ACHATS
router.get('/summarysituationachat', async (req, res) => {
  const { idagence, start_date, end_date } = req.query;

  if (!idagence || !start_date || !end_date) {
    return res.status(400).json({ success: false, message: "Paramètres manquants (idagence, start_date, end_date)" });
  }

  const query = `
    WITH purchases AS (
      SELECT
        gad.dateachat,
        gad.ref_piece,
        SUM(gad.cout_total) AS total_achat,
        SUM(gad.remise) AS total_remise
      FROM gachat_detail gad
      WHERE gad.etat = 'actif' AND gad.idagence = $1
        AND gad.dateachat BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY')
      GROUP BY gad.dateachat, gad.ref_piece
    ),
    payments AS (
      SELECT
        gr.dateregle,
        gr.ref_piece_regle,
        SUM(gr.montant) AS total_paye
      FROM greglementfournisseur gr
      WHERE gr.idagence = $1
        AND gr.dateregle BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY')
      GROUP BY gr.dateregle, gr.ref_piece_regle
    ),
    payment_details AS (
      SELECT
        p.dateregle,
        p.ref_piece_regle,
        p.total_paye,
        s.dateachat AS purchase_date,
        CASE
          WHEN s.dateachat = p.dateregle THEN p.total_paye
          ELSE 0
        END AS montant_regle_meme_date,
        CASE
          WHEN s.dateachat IS NULL OR p.dateregle > s.dateachat THEN p.total_paye
          ELSE 0
        END AS montant_recouvrement
      FROM payments p
      LEFT JOIN (
        SELECT ref_piece, MIN(dateachat) as dateachat
        FROM gachat_detail
        WHERE etat = 'actif' AND idagence = $1
        GROUP BY ref_piece
      ) s ON s.ref_piece = p.ref_piece_regle
    ),
    all_dates_pieces AS (
      SELECT dateachat AS date_ref, ref_piece FROM purchases
      UNION
      SELECT dateregle AS date_ref, ref_piece_regle AS ref_piece FROM payments
    ),
    -- Résolution unique et optimisée du fournisseur pour chaque ref_piece d'achat
    fournisseur_resolver AS (
      SELECT DISTINCT ON (gad.ref_piece)
        gad.ref_piece,
        gf.nomcomplet AS fournisseur
      FROM gachat_detail gad
      INNER JOIN gfournisseur gf ON gf.idfourn = gad.idfourn
      WHERE gad.idagence = $1 AND gad.etat = 'actif'
    )
    SELECT
      EXTRACT(YEAR FROM adp.date_ref)::integer AS annee,
      EXTRACT(MONTH FROM adp.date_ref)::integer AS mois,
      TO_CHAR(adp.date_ref, 'YYYY-MM-DD') AS date_achat,
      adp.ref_piece,
      COALESCE(fr.fournisseur, 'Fournisseur Inconnu') AS fournisseur,
      COALESCE(p.total_achat, 0)::double precision AS total_achat,
      COALESCE(p.total_remise, 0)::double precision AS total_remise,
      COALESCE(pd.montant_regle_meme_date, 0)::double precision AS montant_regler,
      GREATEST(0, COALESCE(p.total_achat, 0) - COALESCE(pd.montant_regle_meme_date, 0))::double precision AS montant_credit,
      COALESCE(pd.montant_recouvrement, 0)::double precision AS montant_recouvre,
      (COALESCE(pd.montant_regle_meme_date, 0) + COALESCE(pd.montant_recouvrement, 0))::double precision AS total_achat_decaisse
    FROM all_dates_pieces adp
    LEFT JOIN purchases p ON p.dateachat = adp.date_ref AND p.ref_piece = adp.ref_piece
    LEFT JOIN payment_details pd ON pd.dateregle = adp.date_ref AND pd.ref_piece_regle = adp.ref_piece
    LEFT JOIN fournisseur_resolver fr ON fr.ref_piece = adp.ref_piece
    ORDER BY adp.date_ref DESC, adp.ref_piece;
  `;

  try {
    const result = await pool.query(query, [parseInt(idagence), start_date, end_date]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Détails d'un ou plusieurs achats
router.get('/detailssituationachat', async (req, res) => {
  const { idgagence, idagence, start_date, end_date, ref_piece } = req.query;
  const targetAgence = idagence || idgagence;

  let query = `
    SELECT
      gad.iddetail,
      gad.idachat,
      gad.ref_piece,
      gad.codeachat,
      gad.idagence,
      gad.idarticle,
      gsc.designation AS souscategorie,
      concat_ws(' ', ut.nom, ut.prenom) AS utilisateur,
      gad.idlot,
      ga.designation AS article_designation,
      gu.designation AS unite_designation,
      gad.idunite,
      gad.quantite,
      gad.poid_unitaire,
      gad.prixachat_brut,
      gad.remise,
      gad.transport_reparti,
      gad.taxe_repartie,
      gad.autres_frais,
      gad.cout_achat_unitaire,
      gad.cout_total,
      gad.numerolot,
      gad.dateperemption,
      gad.datevalidation,
      gad.etat,
      TO_CHAR(gad.dateachat, 'YYYY-MM-DD') AS dateachat,
      gad.idjrnal,
      gad.idmois,
      gad.idannee,
      gad.idfourn,
      gad.iduser,
      gf.nomcomplet AS fournisseur,
      gad.iddepot,
      gad.idtypefr,
      gad.f1, gad.f2, gad.f3, gad.f4, gad.f5, gad.f6, gad.f7, gad.f8,
      gad.r1, gad.r2, gad.total_f
    FROM gachat_detail gad
      INNER JOIN garticle ga ON ga.idarticle = gad.idarticle
      INNER JOIN gunite gu   ON gu.idunite   = gad.idunite
      INNER JOIN gsouscategorie gsc ON gsc.idsouscategorie = ga.idsouscategorie
      INNER JOIN gfournisseur gf   ON gf.idfourn   = gad.idfourn
      LEFT JOIN utilisateur ut ON ut.iduser = gad.iduser
    WHERE gad.etat = 'actif'
      AND gad.idagence = $1
  `;

  const params = [parseInt(targetAgence)];

  if (ref_piece) {
    query += ` AND gad.ref_piece = $2 ORDER BY gad.iddetail DESC`;
    params.push(ref_piece);
  } else {
    query += ` AND gad.dateachat BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY') ORDER BY gad.iddetail DESC`;
    params.push(start_date);
    params.push(end_date);
  }

  try {
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});


///  RAPPORT  AGRO GES


// ==========================================
// RAPPORT DES ACHATS ENTRE DEUX DATES (PAR CAMPAGNE, COOPÉRATIVE, MEMBRE, ARTICLE)



router.get('/rapportachats', async (req, res) => {
    try {
        const { idagence, dateDebut, dateFin } = req.query;

        let query = `
            SELECT 
                gd.iddetail,
                gd.idachat,
                gd.dateachat,
                gd.quantite,
                gd.cout_achat_unitaire,
                gd.cout_total,
                fc.idcooperative,
                fc.raisonsociale AS cooperative_nom,
                gf.idfourn,
                gf.nomcomplet AS membre_nom,
                art.idarticle,
                art.codearticle,
                art.designation AS article_nom
            FROM public.gachat_detail gd
            LEFT JOIN public.gfournisseur gf ON gf.idfourn = gd.idfourn
            LEFT JOIN public.fina_cooperative fc ON fc.idcooperative = gf.idcooperative
            LEFT JOIN public.garticle art ON art.idarticle = gd.idarticle
            WHERE gd.idagence = $1 
            AND gd.dateachat BETWEEN $2 AND $3
            ORDER BY fc.raisonsociale ASC, gf.nomcomplet ASC, art.designation ASC
        `;

        const values = [idagence, dateDebut, dateFin];
        const result = await pool.query(query, values);

        res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


module.exports = router;











