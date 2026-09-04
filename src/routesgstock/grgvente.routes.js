const express = require('express');
const router = express.Router();
const pool = require('../config/db');





async function comptabiliserVente(client, idvente, inverse = false) {

  const debitTotal = inverse ? '0' : 'ROUND(SUM(GV.montant_total), 2)';
  const creditTotal = inverse ? 'ROUND(SUM(GV.montant_total), 2)' : '0';

  // INSERT Débit (compte général vente) -> devient crédit si inverse
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
      ${debitTotal},
      ${creditTotal},
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
    WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat ='ANNULATION'
    GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenvente,
             GV.idmois, GV.idannee, GV.idagence, GV.iduser, GV.codevente,GV.refoperation
  `;
  await client.query(insertDebit, [idvente]);

  // INSERT Crédit (compte client) -> devient débit si inverse
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
      ${creditTotal},
      ${debitTotal},
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
    WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat ='ANNULATION'
    GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GCL.compteauxiliaire,
             GV.idmois, GV.idannee, GCL.idclients, GV.idagence, GV.iduser, GV.codevente,GV.refoperation
  `;
  await client.query(insertCredit, [idvente]);

  // INSERT Débit variation de stock -> devient crédit si inverse
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
      ${inverse ? 'ROUND(SUM(GV.montant_total), 2)' : '0'},
      ${inverse ? '0' : 'ROUND(SUM(GV.montant_total), 2)'},
      
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
    WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat ='ANNULATION'
    GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenvrstock,
             GV.idmois, GV.idannee, GV.idagence, GV.iduser, GV.codevente,GV.refoperation
  `;
  await client.query(insertDebitVar, [idvente]);

  // INSERT Crédit variation de stock -> devient débit si inverse
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
      ${inverse ? '0' : 'ROUND(SUM(GV.montant_total), 2)'},
      ${inverse ? 'ROUND(SUM(GV.montant_total), 2)' : '0'},
      
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
    WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat ='ANNULATION'
    GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenstock,
             GV.idmois, GV.idannee, GCL.idclients, GV.idagence, GV.iduser, GV.codevente,GV.refoperation
  `;
  await client.query(insertCreditVar, [idvente]);

  // Validation du détail
  await client.query(
    `UPDATE gvente_detail SET datevalidation = NOW() WHERE idvente = $1`,
    [idvente]
  );
}






router.get('/garticlevente', async (req, res) => {
  const { idagence, iddepot, idtypecl, search } = req.query;

  // Vérification des paramètres obligatoires
  if (!idagence || !iddepot || !idtypecl) {
    return res.status(400).json({ error: 'Les paramètres "idagence", "iddepot" et "idtypecl" sont obligatoires.' });
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
      sc.idjrnalvente as idjrnal,
      a.idsouscategoriedetail,
      scd.designation AS designationsouscatdetail,
      a.idunite,
      u.designation AS designationunite,
      st.quantite,
      st.quantite_reservee,
      st.stock_disponible,
      ttpv.prix_vente_ht,
      ttpv.prix_vente_ttc,
      ttpv.prix_base
    FROM garticle a
    LEFT JOIN gstock_depot st
      ON st.idarticle = a.idarticle
     AND st.idagence = a.idagence
    LEFT JOIN (
        SELECT DISTINCT ON (idarticle)
               idarticle, idagence,prix_vente_ht , prix_vente_ttc,prix_base
        FROM ttarifprixvente
        WHERE  idtypecl= $3 AND datefin IS NULL
        ORDER BY idarticle, datedebut DESC
    ) ttpv
      ON ttpv.idarticle = a.idarticle
     AND ttpv.idagence = a.idagence
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

  const values = [idagence, iddepot, idtypecl];

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
    console.error('Erreur GET /garticlevente:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});






router.get('/gvente_resume', async (req, res) => {
  const client = await pool.connect();
  try {
    const queryText = `
     SELECT
        GV.idvente,
        GV.datevente,
        ROUND(SUM(GV.montant_total), 2) AS total_vente,
        GC.nom || ' ' || GC.prenom AS clients,
        GC.idclients,
        GV.idagence
      FROM gvente_detail GV
      JOIN gclients GC ON GV.idclients = GC.idclients
      WHERE GV.datevalidation IS NULL
        AND GV.etat = 'actif'
      GROUP BY GV.idvente, GV.datevente, GC.nom, GC.idclients, GV.idagence
      ORDER BY GV.datevente,GV.idvente DESC;
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








router.post('/gventeOLDE', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      idagence,
      idclients,
      iddepot,
      idtypecl,
      iduser,
      codevente,
      montant_brut,
      montant_frais,
      montant_remise,
      reference_facture,
      observation,
      details,
      prixbase, 
      taux,
      prixassure,
      prixassurance,
      idassureur
    } = req.body;

    // =========================
    // 1. INSERT ENTETE VENTE
    // =========================
    const venteResult = await client.query(
      `INSERT INTO gvente (
        idagence,
        idclients,
        iddepot,
        idtypecl,
        iduser,
        codevente,
        montant_brut,
        montant_frais,
        montant_remise,
        reference_facture,
        observation
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        idagence,
        idclients,
        iddepot,
        idtypecl,
        iduser,
        codevente,
        montant_brut || 0,
        montant_frais || 0,
        montant_remise || 0,
        reference_facture || null,
        observation || null
      ]
    );

    const vente = venteResult.rows[0];
    const idvente = vente.idvente;



const montant_ttc = (montant_brut || 0) 
                  + (montant_frais || 0) 
                  - (montant_remise || 0);

                  

                  // 🔥 INSERT OPERATION CUMULE (VENTE)

 

    // =========================
    // 2. INSERT DETAILS + STOCK
    // =========================
    for (const item of details) {

      // 🔹 insertion détail
      await client.query(
        `INSERT INTO gvente_detail (
          idvente,
          idagence,
          idarticle,
          idlot,
          idunite,
          quantite,
          poid_unitaire,
          prixvente_brut,
          remise,
          numerolot,
          dateperemption,
          datevalidation,
          etat,
          datevente,
          idjrnal,
          idmois,
          idannee,
          idtypecl,
          iduser,
          idclients,
          iddepot,
          prixbase, 
          taux,
          prixassure,
          prixassurance,
          idassureur,
          codevente
          
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
        [
          idvente,
          idagence,
          item.idarticle,
          item.idlot || null,
          item.idunite,
          item.quantite,
          item.poid_unitaire || 0,
          item.prixvente_brut,
          item.remise || 0,
          item.numerolot || null,
          item.dateperemption || null,
          item.datevalidation || null,
          item.etat || 'EN_ATTENTE',
          item.datevente || new Date(),
          item.idjrnal,
          item.idmois,
          item.idannee,
          idtypecl,
          iduser,
          item. idclients,
          iddepot,
          item.prixbase, 
          item.taux,
          item.prixassure,
          item.prixassurance,
          item.idassureur,
          codevente
        ]
      );

      // 🔥 SORTIE STOCK AUTOMATIQUE
      await client.query(
        `SELECT public.sortie_stock($1,$2,$3,$4,$5,$6)`,
        [
          idagence,
          iddepot,
          item.idarticle,
          item.quantite,
          codevente,
          item.idlot
        ]
      );
    }





    // =========================
    // 3. UPDATE PRIX ACHAT ACTUEL (TON CODE INTEGRÉ)
    // =========================
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

    

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Vente enregistrée',
      data: vente
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);

    res.status(500).json({
      error: err.message || 'Erreur enregistrement vente'
    });
  } finally {
    client.release();
  }
});



















router.post('/remises/apply', async (req, res) => {
  const { idagence, lines } = req.body;
  if (!idagence || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  try {
    // Construire VALUES list et paramètres
    // On ajoute un idfacture fictif par ligne (ex: 1,2,3...) pour garder la structure
    const valuesParts = [];
    const params = [];
    let idx = 1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      // idfacture temporaire = i+1
      valuesParts.push(`($${idx++}, $${idx++}, $${idx++})`);
      params.push(i + 1, l.idarticle, l.quantite);
    }
    const valuesSql = valuesParts.join(', ');
    const sql = remiseQueryFromValues.replace('%VALUES_PLACEHOLDER%', valuesSql);

    const { rows } = await pool.query(sql, params);

    // Normaliser les types si besoin
    const normalized = rows.map(r => ({
      ...r,
      idtarpro: r.idtarpro,
      idarticle: r.idarticle ? Number(r.idarticle) : null,
      idcategorie: r.idcategorie ? Number(r.idcategorie) : null,
      idunite: r.idunite ? Number(r.idunite) : null,
      qtemin_remise: r.qtemin_remise !== null ? Number(r.qtemin_remise) : null,
      qtemax_remise: r.qtemax_remise !== null ? Number(r.qtemax_remise) : null,
      montant_remise_par_unite: r.montant_remise_par_unite !== null ? Number(r.montant_remise_par_unite) : null,
      taux_remise: r.taux_remise !== null ? Number(r.taux_remise) : null,
      actif: Boolean(r.actif),
      datedebut: r.datedebut ? r.datedebut.toISOString() : null,
      datefin: r.datefin ? r.datefin.toISOString() : null,
    }));

    res.json({ data: normalized });
  } catch (err) {
    console.error('Erreur /remises/apply', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});






///   SYNCRONISATION DES VENTES


router.post('/gvente-sync', async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const {
       idagence,
      idclients,
      iddepot,
      idtypecl,
      iduser,
      codevente,
      montant_brut,
      montant_frais,
      montant_remise,
      reference_facture,
      observation,
      details
    } = req.body;

    //===========================================
    // VALIDATION
    //===========================================

    if (!codevente) {
      throw new Error("Code vente obligatoire");
    }

    //===========================================
    // INSERTION ENTETE
    //===========================================

    const venteResult = await client.query(
      `
      INSERT INTO gvente (
        idagence,
        idclients,
        iddepot,
        idtypecl,
        iduser,
        codevente,
        montant_brut,
        montant_frais,
        montant_remise,
        reference_facture,
        observation
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
      )
      RETURNING *
      `,
      [
        idagence,
        idclients,
        iddepot,
        idtypecl,
        iduser,
        codevente,
        montant_brut || 0,
        montant_frais || 0,
        montant_remise || 0,
        reference_facture || null,
        observation || null
      ]
    );

    const vente = venteResult.rows[0];

    const idvente = vente.idvente;

    //===========================================
    // DETAILS
    //===========================================

    for (const item of details) {

      await client.query(
        `
        INSERT INTO gvente_detail (
          idvente,
          idagence,
          idarticle,
          idlot,
          idunite,
          quantite,
          poid_unitaire,
          prixvente_brut,
          remise,
          numerolot,
          dateperemption,
          datevalidation,
          etat,
          datevente,
          idjrnal,
          idmois,
          idannee,
          idtypecl,
          iduser,
          idclients
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20
        )
        `,
        [
          idvente,
          idagence,
          item.idarticle,
          item.idlot || null,
          item.idunite,
          item.quantite,
          item.poid_unitaire || 0,
          item.prixvente_brut,
          item.remise || 0,
          item.numerolot || null,
          item.dateperemption || null,
          item.datevalidation || null,
          item.etat || 'ACTIF',
          item.datevente || new Date(),
          item.idjrnal,
          item.idmois,
          item.idannee,
          idtypecl,
          iduser,
          item.idclients
        ]
      );

      //===========================================
      // SORTIE STOCK
      //===========================================

      await client.query(
        `
        SELECT public.sortie_stock(
          $1,
          $2,
          $3,
          $4,
          $5
        )
        `,
        [
          idagence,
          iddepot,
          item.idarticle,
          item.quantite,
          codevente
        ]
      );
    }


// =========================
    // 3. UPDATE PRIX ACHAT ACTUEL (TON CODE INTEGRÉ)
    // =========================
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


    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: "Synchronisation réussie",
      codevente: codevente,
      idvente: idvente
    });

  } catch (e) {

    await client.query('ROLLBACK');

    console.log(e);

    return res.status(500).json({
      success: false,
      error: e.message
    });

  } finally {

    client.release();
  }
});







/*
router.post('/gvente', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      idagence,
      idclients,
      iddepot,
      idtypecl,
      iduser,
      codevente,
      montant_brut,
      montant_frais,
      montant_remise,
      reference_facture,
      observation,
      details,
      prixbase, 
      taux,
      prixassure,
      prixassurance,
      idassureur,
      refoperation
    } = req.body;

    // =========================
    // 1. INSERT ENTETE VENTE
    // =========================
    const venteResult = await client.query(
      `INSERT INTO gvente (
        idagence,
        idclients,
        iddepot,
        idtypecl,
        iduser,
        codevente,
        montant_brut,
        montant_frais,
        montant_remise,
        reference_facture,
        observation
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        idagence,
        idclients,
        iddepot,
        idtypecl,
        iduser,
        codevente,
        montant_brut || 0,
        montant_frais || 0,
        montant_remise || 0,
        reference_facture || null,
        observation || null
      ]
    );

    const vente = venteResult.rows[0];
    const idvente = vente.idvente;

    const montant_ttc = (montant_brut || 0) 
                      + (montant_frais || 0) 
                      - (montant_remise || 0);

    // =========================
    // 2. INSERT DETAILS + STOCK
    // =========================
    for (const item of details) {

      // 🔹 insertion détail
      await client.query(
        `INSERT INTO gvente_detail (
          idvente,
          idagence,
          idarticle,
          idlot,
          idunite,
          quantite,
          poid_unitaire,
          prixvente_brut,
          remise,
          numerolot,
          dateperemption,
          datevalidation,
          etat,
          datevente,
          idjrnal,
          idmois,
          idannee,
          idtypecl,
          iduser,
          idclients,
          iddepot,
          prixbase, 
          taux,
          prixassure,
          prixassurance,
          idassureur,
          codevente,
          refoperation
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
        [
          idvente,
          idagence,
          item.idarticle,
          item.idlot || null,
          item.idunite,
          item.quantite,
          item.poid_unitaire || 0,
          item.prixvente_brut,
          item.remise || 0,
          item.numerolot || null,
          item.dateperemption || null,
          item.datevalidation || null,
          item.etat || 'actif',
          item.datevente || new Date(),
          item.idjrnal,
          item.idmois,
          item.idannee,
          idtypecl,
          iduser,
          item.idclients,
          iddepot,
          item.prixbase, 
          item.taux,
          item.prixassure,
          item.prixassurance,
          item.idassureur,
          codevente,
          refoperation
        ]
      );

      // 🔥 SORTIE STOCK AUTOMATIQUE
      await client.query(
        `SELECT public.sortie_stock($1,$2,$3,$4,$5,$6)`,
        [
          idagence,
          iddepot,
          item.idarticle,
          item.quantite,
          codevente,
          item.idlot
        ]
      );
    }

    // =========================
    // 3. UPDATE PRIX ACHAT ACTUEL
    // =========================
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

    // =========================
    // 4. COMPTABILISATION AUTOMATIQUE
    // =========================

    // INSERT Débit (compte général vente)
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
               GV.idmois, GV.idannee, GV.idagence, GV.iduser,GV.codevente,GV.refoperation
    `;
    await client.query(insertDebit, [idvente]);

    // INSERT Crédit (compte client)
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
               GV.idmois, GV.idannee, GCL.idclients, GV.idagence, GV.iduser,GV.codevente,GV.refoperation
    `;
    await client.query(insertCredit, [idvente]);

    // INSERT Débit variation de stock
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
               GV.idmois, GV.idannee, GV.idagence, GV.iduser,GV.codevente,GV.refoperation
    `;
    await client.query(insertDebitVar, [idvente]);

    // INSERT Crédit variation de stock
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
               GV.idmois, GV.idannee, GCL.idclients, GV.idagence, GV.iduser,GV.codevente,GV.refoperation
    `;
    await client.query(insertCreditVar, [idvente]);

    // UPDATE validation
    await client.query(
      `UPDATE gvente_detail SET datevalidation = NOW() WHERE idvente = $1`,
      [idvente]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Vente enregistrée et comptabilisée',
      data: vente
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);

    res.status(500).json({
      error: err.message || 'Erreur enregistrement vente'
    });
  } finally {
    client.release();
  }
});

*/




/*
router.post('/gvente', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      idagence,
      idclients,
      iddepot,
      idtypecl,
      iduser,
      codevente,
      refoperation,
      details
    } = req.body;

    // L'insertion se fait uniquement sur gvente_detail.
    // Les triggers BEFORE et AFTER s'occupent de gvente, stocks, cumuls et comptabilité.
    for (const item of details) {



    // Remplacez votre SELECT actuel par celui-ci
const checkStock = await client.query(
  `SELECT 
     COALESCE(gs.quantite, 0) as stock_disponible,
     a.designation as nom_article
   FROM glot_stock gs
   JOIN garticle a ON gs.idarticle = a.idarticle
   WHERE gs.idarticle = $1 
     AND gs.iddepot = $2 
     AND gs.idagence = $3 
     AND gs.idlot = $4
   FOR UPDATE`,
  [item.idarticle, iddepot, idagence, item.idlot]
);

const stockRow = checkStock.rows[0];

if (!stockRow) {
  throw new Error(`Le lot ID ${item.idlot} n'existe pas pour cet article.`);
}

const stockDisponible = parseFloat(stockRow.stock_disponible);
const nomArticle = stockRow.nom_article;

if (stockDisponible < parseFloat(item.quantite)) {
  // Un message clair et humainement lisible
  throw new Error(
    `Stock insuffisant pour "${nomArticle}" (Lot: ${item.idlot}). ` +
    `Disponible : ${stockDisponible}, Demandé : ${item.quantite}.`
  );
}



      await client.query(
        `INSERT INTO gvente_detail (
          idagence,
          idarticle,
          idlot,
          idunite,
          quantite,
          poid_unitaire,
          prixvente_brut,
          remise,
          numerolot,
          dateperemption,
          etat,
          datevente,
          idjrnal,
          idmois,
          idannee,
          idtypecl,
          iduser,
          idclients,
          iddepot,
          prixbase, 
          taux,
          prixassure,
          prixassurance,
          idassureur,
          codevente,
          refoperation,
          ref_piece
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
        [
          idagence,
          item.idarticle,
          item.idlot || null,
          item.idunite,
          item.quantite,
          item.poid_unitaire || 0,
          item.prixvente_brut,
          item.remise || 0,
          item.numerolot || null,
          item.dateperemption || null,
          item.etat || 'actif',
          item.datevente || new Date(),
          item.idjrnal,
          item.idmois,
          item.idannee,
          idtypecl,
          iduser,
          item.idclients,
          iddepot,
          item.prixbase, 
          item.taux,
          item.prixassure,
          item.prixassurance,
          item.idassureur,
          codevente,
          refoperation,
          codevente 
        ]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Vente enregistrée et traitée automatiquement par la base de données.'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({
      error: err.message || 'Erreur lors de l’enregistrement de la vente'
    });
  } finally {
    client.release();
  }
});
*/


router.post('/gvente', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      idagence,
      idclients,
      iddepot,
      idtypecl,
      iduser,
      codevente,
      refoperation,
      datevente,
      details,
      frais_transport,
      autres_frais
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

    // 1. PHASE DE VÉRIFICATION : On vérifie les stocks pour TOUS les articles d'abord
    const stockErrors = [];

    for (const item of details) {
      const checkStock = await client.query(
        `SELECT 
           COALESCE(gs.quantite, 0) as stock_disponible,
           a.designation as nom_article
         FROM glot_stock gs
         JOIN garticle a ON gs.idarticle = a.idarticle
         WHERE gs.idarticle = $1 
           AND gs.iddepot = $2 
           AND gs.idagence = $3 
           AND gs.idlot = $4
         FOR UPDATE`,
        [item.idarticle, iddepot, idagence, item.idlot || 1]
      );

      const stockRow = checkStock.rows[0];

      if (!stockRow) {
        stockErrors.push({
          nom: `Article ID ${item.idarticle} (Lot ${item.idlot || 1})`,
          disponible: 0,
          demande: parseFloat(item.quantite),
          manquant: parseFloat(item.quantite),
          message: "Cet article n'existe pas dans le dépôt ou lot sélectionné."
        });
        continue;
      }

      const stockDisponible = parseFloat(stockRow.stock_disponible);
      const nomArticle = stockRow.nom_article;
      const quantiteDemandee = parseFloat(item.quantite);

      if (stockDisponible < quantiteDemandee) {
        stockErrors.push({
          nom: nomArticle,
          disponible: stockDisponible,
          demande: quantiteDemandee,
          manquant: (quantiteDemandee - stockDisponible)
        });
      }
    }

    // S'il y a au moins un problème de stock, on annule et on renvoie les détails
    if (stockErrors.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        code: 'STOCK_INSUFFISANT',
        message: 'Stock insuffisant pour certains articles.',
        details: stockErrors
      });
    }



    for (const item of details) {
      await client.query(
        `INSERT INTO gvente_detail (
          idagence,
          idarticle,
          idlot,
          idunite,
          quantite,
          poid_unitaire,
          prixvente_brut,
          remise,
          numerolot,
          dateperemption,
          etat,
          datevente,
          idjrnal,
          idmois,
          idannee,
          idtypecl,
          iduser,
          idclients,
          iddepot,
          prixbase, 
          taux,
          prixassure,
          prixassurance,
          idassureur,
          codevente,
          refoperation,
          ref_piece
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
        [
          idagence,                  // $1
          item.idarticle,            // $2
          item.idlot || null,        // $3
          item.idunite,              // $4
          item.quantite,             // $5
          item.poid_unitaire || 0,   // $6
          item.prixvente_brut,       // $7
          item.remise || 0,          // $8 -> Corrigé pour pointer vers la remise
          item.numerolot || null,    // $9
          item.dateperemption || null, // $10
          item.etat || 'actif',      // $11
          datevente,                 // $12
          item.idjrnal,              // $13
          item.idmois,               // $14
          item.idannee,              // $15
          idtypecl,                  // $16
          item.iduser,               // $17
          item.idclients,            // $18
          iddepot,                   // $19
          item.prixbase,             // $20 -> Corrigé pour pointer vers le prix base
          item.taux,                 // $21
          item.prixassure,           // $22
          item.prixassurance,        // $23
          item.idassureur,           // $24
          codevente,                 // $25
          refoperation,              // $26
          codevente                  // $27
        ]
      );
    }


      // 3. INSERTION DANS GVENTE_AUTRES_FRAIS (SI FRAIS > 0)
    const transport = parseFloat(frais_transport) || 0;
    const autres = parseFloat(autres_frais) || 0;

    if (transport > 0 || autres > 0) {
      await client.query(
        `INSERT INTO gvente_autres_frais (ref_piece, frais_transport, autres_frais)
         VALUES ($1, $2, $3)`,
        [codevente, transport, autres]
      );
    }


    /*
    // 2. PHASE D'INSERTION : Si tous les stocks sont corrects
    for (const item of details) {
      await client.query(
        `INSERT INTO gvente_detail (
          idagence,
          idarticle,
          idlot,
          idunite,
          quantite,
          poid_unitaire,
          prixvente_brut,
          remise,
          numerolot,
          dateperemption,
          etat,
          datevente,
          idjrnal,
          idmois,
          idannee,
          idtypecl,
          iduser,
          idclients,
          iddepot,
          prixbase, 
          taux,
          prixassure,
          prixassurance,
          idassureur,
          codevente,
          refoperation,
          ref_piece
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
        [
          idagence,
          item.idarticle,
          item.idlot || null,
          item.idunite,
          item.quantite,
          item.poid_unitaire || 0,
          item.prixvente_brut,
          item.remise || 0,
          item.numerolot || null,
          item.dateperemption || null,
          item.etat || 'actif',
          datevente ,
          item.idjrnal,
          item.idmois,
          item.idannee,
          idtypecl,
          iduser,
          item.idclients,
          iddepot,
          item.prixbase, 
          item.taux,
          item.prixassure,
          item.prixassurance,
          item.idassureur,
          codevente,
          refoperation,
          codevente 
        ]
      );
    }
*/




    await client.query('COMMIT');

    res.status(201).json({
      message: 'Vente enregistrée et traitée automatiquement par la base de données.'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({
      error: err.message || 'Erreur lors de l’enregistrement de la vente'
    });
  } finally {
    client.release();
  }
});





router.get('/gvente_autres_frais/:ref_piece', async (req, res) => {
  try {
    const { ref_piece } = req.params;

    const query = `
      SELECT 
        id,
        ref_piece,
        COALESCE(frais_transport, 0) AS frais_transport,
        COALESCE(autres_frais, 0) AS autres_frais,
        date_creation
      FROM gvente_autres_frais
      WHERE ref_piece = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [ref_piece]);

    if (result.rows.length === 0) {
      // Si aucun frais enregistré, on retourne des valeurs par défaut à 0
      return res.status(200).json({
        success: true,
        data: {
          ref_piece: ref_piece,
          frais_transport: 0,
          autres_frais: 0
        }
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Erreur GET gvente_autres_frais :', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des frais : ' + err.message
    });
  }
});




router.post('/annulervente/:idvente', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { idvente } = req.params;
    const { iduser } = req.body;

    // 1. Récupération de la vente originale
    const venteResult = await client.query(
      `SELECT * FROM gvente WHERE idvente = $1`,
      [idvente]
    );
    if (venteResult.rows.length === 0) throw new Error("Vente introuvable");
    const vente = venteResult.rows[0];

    // 2. Vérifier si déjà annulée
    const verif = await client.query(
      `SELECT 1 FROM gvente WHERE idvente_source = $1 AND type_operation = 'ANNULATION' LIMIT 1`,
      [idvente]
    );
    if (verif.rows.length > 0) throw new Error("Cette vente est déjà annulée");

    // 3. Créer entête annulation
    const annulationResult = await client.query(
      `INSERT INTO gvente (
        idagence, idclients, iddepot, idtypecl, iduser,
        codevente, montant_brut, montant_frais, montant_remise,
        reference_facture, observation, idvente_source,
         statut
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        vente.idagence, vente.idclients, vente.iddepot, vente.idtypecl, iduser,
        'ANNUL-' + vente.codevente,
        vente.montant_brut || 0,
        vente.montant_frais || 0,
        vente.montant_remise || 0,
        vente.reference_facture,
        'ANNULATION VENTE : ' + vente.codevente,
        vente.idvente,
        'ANNULATION'
       
      ]
    );
    const annulation = annulationResult.rows[0];

    // 4. Récupérer détails de la vente
    const detailsResult = await client.query(
      `SELECT * FROM gvente_detail WHERE idvente = $1`,
      [idvente]
    );

    // 5. Insérer détails d’annulation + remise en stock
    for (const item of detailsResult.rows) {
      await client.query(
        `INSERT INTO gvente_detail (
          idvente, idagence, idarticle, idlot, idunite, quantite,
          poid_unitaire, prixvente_brut, remise, numerolot,
          dateperemption, datevalidation, etat, datevente,
          idjrnal, idmois, idannee, idtypecl, iduser, idclients,
          iddetail_source, iddepot,prixachatactuel,
          prixbase, taux, prixassure, prixassurance, idassureur, codevente,refoperation
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)`,
        [
          annulation.idvente,
          item.idagence, item.idarticle, item.idlot, item.idunite,
          item.quantite,
          item.poid_unitaire || 0,
          item.prixvente_brut || 0,
          item.remise || 0,
          item.numerolot,
          item.dateperemption,
          null,
          'ANNULATION',
          new Date(),
          item.idjrnal, item.idmois, item.idannee, item.idtypecl,
          iduser,
          item.idclients,
          item.iddetail,
          item.iddepot,
          item.prixachatactuel ?? 0,
          item.prixbase, item.taux, item.prixassure, item.prixassurance, item.idassureur,
          'ANNUL-' + vente.codevente + idvente + iduser,
          item.refoperation
        ]
      );




      // 🔹 Remise en stock


       await client.query(
        `SELECT public.entree_stock($1,$2,$3,$4,$5,$6,$7)`,
        [
          item.idagence,
          item.iddepot,
          item.idarticle,
          item.quantite,
          item.prixachat_brut,
          vente.codevente,
          item.idlot
        ]
      );


      // 🔹 Annuler ligne originale
      await client.query(
        `UPDATE gvente_detail SET etat = 'ANNULATION' WHERE iddetail = $1`,
        [item.iddetail]
      );
    }

    // 6. Annuler entête originale
    await client.query(
      `UPDATE gvente SET statut = 'ANNULATION' WHERE idvente = $1`,
      [idvente]
    );

    await comptabiliserVente(client, annulation.idvente, false);

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Vente annulée avec succès', data: annulation });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});






router.post('/annulerventeligne/:iddetail', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { iddetail } = req.params;
    const { iduser } = req.body;

    // Détail original + info vente
    const detailResult = await client.query(
      `SELECT d.*, v.iddepot, v.codevente
       FROM gvente_detail d
       INNER JOIN gvente v ON v.idvente = d.idvente
       WHERE d.iddetail = $1`,
      [iddetail]
    );
    if (detailResult.rows.length === 0) throw new Error("Ligne vente introuvable");
    const item = detailResult.rows[0];

    // Vérifier si déjà annulée (id detail source existant)
    const verif = await client.query(
      `SELECT 1 FROM gvente_detail WHERE iddetail_source = $1 LIMIT 1`,
      [iddetail]
    );
    if (verif.rows.length > 0) throw new Error("Cette ligne est déjà annulée");

    // Créer entête annulation (nouvelle vente pour la ligne)
    const venteAnnulResult = await client.query(
      `INSERT INTO gvente (
         idagence, idclients, iddepot, idtypecl, iduser,
        codevente, montant_brut, montant_frais, montant_remise,
        reference_facture, observation, idvente_source,
         statut
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
       ) RETURNING *`,
      [
        item.idagence,
        item.idclients,
        item.iddepot,
        item.idtypecl,
        iduser,
       'ANNUL-'+ item.idvente + item.codevente + iddetail,
        item.montant_brut || 0,
        item.montant_frais || 0,
        item.montant_remise || 0,
        item.reference_facture,
        'ANNULATION VENTE : ' + item.codevente + iddetail,
        item.idvente,
        'ANNULATION'
       
      ]
    );
    const venteAnnul = venteAnnulResult.rows[0];

    // Insertion détail annulation (avec nouvelles colonnes)
    await client.query(
      `INSERT INTO gvente_detail (
         idvente, idagence, idarticle, idlot, idunite,
         quantite, poid_unitaire, prixvente_brut, remise,
         numerolot, dateperemption, datevalidation, etat, datevente,
         idjrnal, idmois, idannee, idtypecl, iduser, idclients,
         iddetail_source, iddepot,prixachatactuel,
         prixbase, taux, prixassure, prixassurance, idassureur, codevente,refoperation
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30
       )`,
      [
        venteAnnul.idvente,
        item.idagence,
        item.idarticle,
        item.idlot || null,
        item.idunite,
        item.quantite || 0,
        item.poid_unitaire || 0,
        item.prixvente_brut || 0,
        item.remise || 0,
        item.numerolot || null,
        item.dateperemption || null,
         null,
        'ANNULATION',
        new Date(),
        item.idjrnal,
        item.idmois,
        item.idannee,
        item.idtypecl,
        iduser,
        item.idclients,
        item.iddetail,
        item.iddepot,
        item.prixachatactuel ?? 0,
        item.prixbase ?? 0,
        item.taux ?? 0,
        item.prixassure ?? 0,
        item.prixassurance ?? 0,
        item.idassureur || null,
         'ANNUL-'+ item.idvente + item.codevente + iddetail,
        item.refoperation
      ]
    );

    // Remettre en stock
   
       await client.query(
        `SELECT public.entree_stock($1,$2,$3,$4,$5,$6,$7)`,
        [
          item.idagence,
          item.iddepot,
          item.idarticle,
          item.quantite,
          item.prixachat_brut,
          item.codevente,
          item.idlot
        ]
      );

    // Annuler ligne originale
    await client.query(
      `UPDATE gvente_detail SET etat = 'ANNULATION' WHERE iddetail = $1`,
      [iddetail]
    );


    
    /*
    // Annuler ligne originale
   await client.query(
  `UPDATE gvente SET statut = 'ANNULATION' WHERE idvente = $1`,
  [item.idvente]   // ✅ pas venteAnnul.idvente
);
*/


// dans /annulerventeligne/:iddetail, avant COMMIT
await comptabiliserVente(client, venteAnnul.idvente, false);

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Ligne vente annulée avec succès'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});








// ==========================================
// LISTE DETAILS VENTE
// ==========================================
router.get('/gventedetail/:idagence', async (req, res) => {

  const client = await pool.connect();

  try {

    const { idagence } = req.params;

    const result = await client.query(
      `
      SELECT 
          gad.iddetail,
          gad.idvente,
          gad.codevente,
          gad.idagence,
          gad.idarticle,
          gad.idlot,
          gad.idunite,
          gad.quantite,
          gad.poid_unitaire,
          gad.prixvente_brut,
          gad.montant_total,
          gad.remise,
          gad.prix_vente_unitaire,
          gad.transport_reparti,
          gad.taxe_repartie,
          gad.autres_frais,
          gad.prixachatactuel,
          gad.couttotalachat,
          gad.numerolot,
          gad.dateperemption,
          gad.datevalidation,
          gad.etat,
          gad.idjrnal,
          gad.idmois,
          gad.idannee,
          gad.idclients,
          gad.iduser,

          ga.designation,

          CONCAT(
              COALESCE(gcl.nom, ''),
              ' ',
              COALESCE(gcl.prenom, '')
          ) AS nomcomplet

      FROM gvente_detail gad

      INNER JOIN garticle ga
          ON ga.idarticle = gad.idarticle

      INNER JOIN gclients gcl
          ON gcl.idclients = gad.idclients

      WHERE gad.idagence = $1
      AND gad.etat = 'actif'

      ORDER BY gad.iddetail DESC
      `,
      [idagence]
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  } finally {

    client.release();

  }

});










///  PARTIE   MODIFICATION   DE FACTURE VENTE



router.get('/ventes/clientsm', async (req, res) => {
  const { date1, date2, idagence } = req.query;

  try {
    const result = await pool.query(
      `
      SELECT 
          v.idclients,
          CONCAT(
              COALESCE(c.nom, ''),
              ' ',
              COALESCE(c.prenom, '')
          )   as nomclient,
          COUNT(v.idvente) AS nb_factures,
          SUM(v.montant_brut - v.montant_remise + v.montant_frais) AS total
      FROM gvente v
      JOIN gclients c ON c.idclients = v.idclients
      WHERE v.datevente BETWEEN $1 AND $2
        AND v.idagence = $3
      GROUP BY v.idclients,  CONCAT(
              COALESCE(c.nom, ''),
              ' ',
              COALESCE(c.prenom, '')
          )   
      ORDER BY  CONCAT(
              COALESCE(c.nom, ''),
              ' ',
              COALESCE(c.prenom, '')
          )   
      `,
      [date1, date2, idagence]
    );

    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




router.get('/ventes/facturesm', async (req, res) => {
  const { idclients, date1, date2 } = req.query;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM gvente
      WHERE idclients = $1
        AND datevente BETWEEN $2 AND $3
      ORDER BY datevente DESC
      `,
      [idclients, date1, date2]
    );

    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




router.get('/ventes/detailm/:idvente', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT d.*, a.designation,u.designation as designationunite
      FROM gvente_detail d
      JOIN garticle a ON a.idarticle = d.idarticle
      JOIN gunite u on u.idunite=d.idunite
      WHERE d.idvente = $1
      `,
      [req.params.idvente]
    );

    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});









// Mettre à jour une facture avec recalcul automatique des montants globaux
router.put('/gvente/updatem/:idvente', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const idvente = req.params.idvente;
    const { iddepot, idagence, codevente, details } = req.body;

    if (!details || details.length === 0) {
      throw new Error("La facture doit contenir au moins un article.");
    }

    // =========================================================================
    // 0. RÉCUPÉRATION DES INFOS DE L'ANCIENNE FACTURE (Pour les champs obligatoires)
    // =========================================================================
    const venteRes = await client.query(
      `SELECT idclients, idtypecl, iduser, datevente FROM gvente WHERE idvente = $1`,
      [idvente]
    );

    if (venteRes.rows.length === 0) {
      throw new Error("Facture introuvable.");
    }

    const { idclients, idtypecl, iduser, datevente } = venteRes.rows[0];
    
    // Extraction des composants de la date pour gvente_detail (idjrnal, idmois, idannee)
    const dateObj = new Date(datevente);
    const idannee = dateObj.getFullYear();
    const idmois = dateObj.getMonth() + 1; // Les mois commencent à 0 en JS
    const idjrnal = dateObj.getDate(); 

    // =========================================================================
    // 1. Récupération et RESTOCKAGE des anciens détails
    // =========================================================================
    const oldDetails = await client.query(
      `SELECT * FROM gvente_detail WHERE idvente = $1`,
      [idvente]
    );

    for (const d of oldDetails.rows) {
      // Ajustement des paramètres selon la signature de ta fonction postgres
      await client.query(
        `SELECT public.entree_stock($1, $2, $3, $4, $5,$6)`,
        [Number(idagence), Number(iddepot), Number(d.idarticle), Number(d.quantite),d.prix, codevente]
      );
    }

    // Supprimer les anciens détails
    await client.query(`DELETE FROM gvente_detail WHERE idvente = $1`, [idvente]);

    // Variables pour le calcul des nouveaux montants globaux
    let totalBrut = 0;
    let totalRemise = 0;

    // =========================================================================
    // 2. Vérification du stock, Insertion et Sortie de stock
    // =========================================================================
    for (const item of details) {
      const qte = Number(item.quantite);
      const prix = Number(item.prixvente_brut);
      const remise = Number(item.remise || 0);
      const idarticle = Number(item.idarticle);

      // Récupération du prix d'achat actuel et de l'unité de l'article (Champs NOT NULL)
      const artRes = await client.query(
        `SELECT idunite, prixachat FROM garticle WHERE idarticle = $1`,
        [idarticle]
      );
      
      // Si non trouvé dans garticle, on utilise une valeur par défaut ou celle envoyée
      const idunite = artRes.rows.length > 0 ? artRes.rows[0].idunite : (item.idunite || 1);
      const prixachatactuel = artRes.rows.length > 0 ? Number(artRes.rows[0].prixachat || 0) : 0;

      // Calculs cumulés pour la facture globale
      totalBrut += qte * prix;
      totalRemise += remise;

      // Vérification du stock disponible
      const stockRes = await client.query(
        `SELECT stock_disponible FROM gstock_depot WHERE idarticle = $1 AND iddepot = $2`,
        [idarticle, iddepot]
      );

      const stockDispo = stockRes.rows.length > 0 ? Number(stockRes.rows[0].stock_disponible) : 0;
      if (stockDispo < qte) {
        throw new Error(`Stock insuffisant pour l'article ID ${idarticle} (Dispo: ${stockDispo}, Demandé: ${qte})`);
      }

      // Insertion du nouveau détail avec TOUS les champs obligatoires (NOT NULL)
      await client.query(
        `INSERT INTO gvente_detail (
          idvente, idagence, idarticle, idunite, quantite, 
          prixvente_brut, remise, datevente, idjrnal, idmois, 
          idannee, idtypecl, iduser, idclients, iddepot, prixachatactuel
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          idvente, idagence, idarticle, idunite, qte, 
          prix, remise, datevente, idjrnal, idmois, 
          idannee, idtypecl, iduser, idclients, iddepot, prixachatactuel
        ]
      );

      // Sortie du stock
      await client.query(
        `SELECT public.sortie_stock($1, $2, $3, $4, $5)`,
        [idagence, iddepot, idarticle, qte, codevente]
      );
    }

    // =========================================================================
    // 3. Mise à jour des montants dans la table gvente
    // =========================================================================
    // Note : Le champ date_modif n'existant pas dans ton CREATE TABLE gvente, 
    // il a été retiré pour éviter un plantage SQL.
    await client.query(
      `UPDATE gvente 
       SET iddepot = $1,
           montant_brut = $2, 
           montant_remise = $3
       WHERE idvente = $4`,
      [iddepot, totalBrut, totalRemise, idvente]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: "Facture mise à jour avec succès" });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

/*
// Mettre à jour une facture avec recalcul automatique des montants globaux
router.put('/gvente/updatem/:idvente', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const idvente = req.params.idvente;
    const { iddepot, idagence, codevente, details } = req.body;

    if (!details || details.length === 0) {
      throw new Error("La facture doit contenir au moins un article.");
    }

    // 1. Récupération et RESTOCKAGE des anciens détails
    const oldDetails = await client.query(
      `SELECT * FROM gvente_detail WHERE idvente = $1`,
      [idvente]
    );

    for (const d of oldDetails.rows) {
      await client.query(
        `SELECT public.entree_stock($1, $2, $3, $4, $5,$6)`,
        [idagence, iddepot, d.idarticle, d.quantite,d.prix, codevente]
      );
    }

    // Supprimer les anciens détails
    await client.query(`DELETE FROM gvente_detail WHERE idvente = $1`, [idvente]);

    // Variables pour le calcul des nouveaux montants globaux
    let totalBrut = 0;
    let totalRemise = 0;

    // 2. Vérification du stock, Insertion et Sortie de stock
    for (const item of details) {
      const qte = Number(item.quantite);
      const prix = Number(item.prixvente_brut);
      const remise = Number(item.remise || 0);

      // Calculs cumulés
      totalBrut += qte * prix;
      totalRemise += remise;

      // Vérification du stock disponible
      const stockRes = await client.query(
        `SELECT stock_disponible FROM gstock_depot WHERE idarticle = $1 AND iddepot = $2`,
        [item.idarticle, iddepot]
      );

      const stockDispo = stockRes.rows.length > 0 ? Number(stockRes.rows[0].stock_disponible) : 0;
      if (stockDispo < qte) {
        // Le Rollback annulera le restockage précédent automatiquement
        throw new Error(`Stock insuffisant pour l'article ID ${item.idarticle} (Dispo: ${stockDispo}, Demandé: ${qte})`);
      }

      // Insertion du nouveau détail
      await client.query(
        `INSERT INTO gvente_detail (
          idvente, idagence, idarticle, quantite, prixvente_brut, remise,iddepot,idunite
        ) VALUES ($1, $2, $3, $4, $5, $6,$7,$8)`,
        [idvente, idagence, item.idarticle, qte, prix, remise,iddepot,item.idunite]
      );

      // Sortie du stock
      await client.query(
        `SELECT public.sortie_stock($1, $2, $3, $4, $5)`,
        [idagence, iddepot, item.idarticle, qte,codevente]
      );
    }

    // 3. Mise à jour des montants dans la table gvente
    await client.query(
      `UPDATE gvente 
       SET montant_brut = $1, 
           montant_remise = $2, 
           date_modif = NOW() 
       WHERE idvente = $3`,
      [totalBrut, totalRemise, idvente]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: "Facture mise à jour avec succès" });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});
*/



///     DEVIS  VENTE





router.post('/gventedevis', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      idagence,
      idclients,
      iddepot,
      idtypecl,
      iduser,
      codevente,
      refoperation,
      datevente,
      details
    } = req.body;


    /*
    // 1. PHASE DE VÉRIFICATION : On vérifie les stocks pour TOUS les articles d'abord
    const stockErrors = [];

    for (const item of details) {
      const checkStock = await client.query(
        `SELECT 
           COALESCE(gs.quantite, 0) as stock_disponible,
           a.designation as nom_article
         FROM glot_stock gs
         JOIN garticle a ON gs.idarticle = a.idarticle
         WHERE gs.idarticle = $1 
           AND gs.iddepot = $2 
           AND gs.idagence = $3 
           AND gs.idlot = $4
         FOR UPDATE`,
        [item.idarticle, iddepot, idagence, item.idlot || 1]
      );

      const stockRow = checkStock.rows[0];

      if (!stockRow) {
        stockErrors.push({
          nom: `Article ID ${item.idarticle} (Lot ${item.idlot || 1})`,
          disponible: 0,
          demande: parseFloat(item.quantite),
          manquant: parseFloat(item.quantite),
          message: "Cet article n'existe pas dans le dépôt ou lot sélectionné."
        });
        continue;
      }

      const stockDisponible = parseFloat(stockRow.stock_disponible);
      const nomArticle = stockRow.nom_article;
      const quantiteDemandee = parseFloat(item.quantite);

      if (stockDisponible < quantiteDemandee) {
        stockErrors.push({
          nom: nomArticle,
          disponible: stockDisponible,
          demande: quantiteDemandee,
          manquant: (quantiteDemandee - stockDisponible)
        });
      }
    }

    // S'il y a au moins un problème de stock, on annule et on renvoie les détails
    if (stockErrors.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        code: 'STOCK_INSUFFISANT',
        message: 'Stock insuffisant pour certains articles.',
        details: stockErrors
      });
    }

*/






    // 2. PHASE D'INSERTION : Si tous les stocks sont corrects
    for (const item of details) {
      await client.query(
        `INSERT INTO gvente_detaildevis (
          idagence,
          idarticle,
          idlot,
          idunite,
          quantite,
          poid_unitaire,
          prixvente_brut,
          remise,
          numerolot,
          dateperemption,
          etat,
          datevente,
          idjrnal,
          idmois,
          idannee,
          idtypecl,
          iduser,
          idclients,
          iddepot,
          prixbase, 
          taux,
          prixassure,
          prixassurance,
          idassureur,
          codevente,
          refoperation,
          ref_piece
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
        [
          idagence,
          item.idarticle,
          item.idlot || null,
          item.idunite,
          item.quantite,
          item.poid_unitaire || 0,
          item.prixvente_brut,
          item.remise || 0,
          item.numerolot || null,
          item.dateperemption || null,
          item.etat || 'actif',
          datevente ,
          item.idjrnal,
          item.idmois,
          item.idannee,
          idtypecl,
          iduser,
          item.idclients,
          iddepot,
          item.prixbase, 
          item.taux,
          item.prixassure,
          item.prixassurance,
          item.idassureur,
          codevente,
          refoperation,
          codevente 
        ]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Devis Vente enregistrée .'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({
      error: err.message || 'Erreur lors de l’enregistrement de la vente'
    });
  } finally {
    client.release();
  }
});







///   FIN  MODIFICATION DE LA FACTURE



///  DEBUT  DEVIS   BROULLONS




// --- 1. ENREGISTREMENT OU MISE A JOUR AUTOMATIQUE (UPSERT / BROUILLON) ---
router.post('/gventedevisbrouillon', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      idagence,
      idclients,
      iddepot,
      idtypecl,
      iduser,
      codevente,
      refoperation,
      datevente,
      details
    } = req.body;

    if (!codevente) {
      return res.status(400).json({ error: 'Le codevente est obligatoire pour le brouillon' });
    }

    // Supprimer les anciennes lignes de ce codevente pour les recréer (mise à jour fluide)
    await client.query(`DELETE FROM gvente_detailbroullons WHERE codevente = $1 AND idagence = $2`, [codevente, idagence]);

    for (const item of details) {
      await client.query(
        `INSERT INTO gvente_detailbroullons (
          idagence, idarticle, idlot, idunite, quantite, poid_unitaire,
          prixvente_brut, remise, numerolot, dateperemption, etat,
          datevente, idjrnal, idmois, idannee, idtypecl, iduser,
          idclients, iddepot, prixbase, taux, prixassure, prixassurance,
          idassureur, codevente, refoperation, ref_piece, designation, designationunite
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
        [
          idagence,
          item.idarticle,
          item.idlot || null,
          item.idunite,
          item.quantite,
          item.poid_unitaire || 0,
          item.prixvente_brut,
          item.remise || 0,
          item.numerolot || null,
          item.dateperemption || null,
          item.etat || 'brouillon',
          datevente,
          item.idjrnal || null,
          item.idmois,
          item.idannee,
          idtypecl,
          iduser,
          idclients,
          iddepot,
          item.prixbase,
          item.taux || 0,
          item.prixassure || 0,
          item.prixassurance || 0,
          item.idassureur || 0,
          codevente,
          refoperation,
          codevente,
          item.designation || '',
          item.designationunite || ''
        ]
      );
    }

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Brouillon enregistré avec succès.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// --- 2. RECUPERER LES DEVIS BROUILLONS ENTRE DEUX DATES ---
router.get('/gventedevisbrouillon/liste', async (req, res) => {
  try {
    const { idagence, datedebut, datefin } = req.query;

    if (!idagence || !datedebut || !datefin) {
      return res.status(400).json({ success: false, error: 'Paramètres manquants (idagence, datedebut, datefin)' });
    }

    const query = `
      SELECT codevente, datevente, refoperation, idclients, iddepot, idtypecl,
             MIN(iduser) as iduser, SUM((prixvente_brut * quantite) - remise) as montant_total,
             json_agg(gvente_detailbroullons.*) as details
      FROM gvente_detailbroullons
      WHERE idagence = $1 AND datevente BETWEEN $2 AND $3
      GROUP BY codevente, datevente, refoperation, idclients, iddepot, idtypecl
      ORDER BY datevente DESC
    `;

    const { rows } = await pool.query(query, [idagence, datedebut, datefin]);
    res.json({ success: true, data: rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});





///  FIN DEVIS  BROULLONS



///   RAPPORT  VENTE

router.get('/rapportgvente_details', async (req, res) => {
  const { idagence, datedebut, datefin } = req.query;

  // Validation
  if (!idagence || !datedebut || !datefin) {
    return res.status(400).json({
      error: 'Les paramètres "idagence", "datedebut" et "datefin" sont obligatoires.'
    });
  }

  const values = [parseInt(idagence, 10), datedebut, datefin];

  const queryText = `
    SELECT
      gvd.iddetail,
      gvd.idvente,
      gvd.ref_piece,
      gvd.codevente,
      gvd.idagence,
      gvd.idarticle,
      gsc.designation AS souscategorie,
      concat_ws(' ', ut.nom, ut.prenom) AS utilisateur,
      gvd.idlot,
      ga.designation AS article_designation,
      gu.designation AS unite_designation,
      gvd.idunite,
      gvd.quantite,
      gvd.poid_unitaire,
      gvd.prixvente_brut,
      gvd.remise,
      gvd.transport_reparti,
      gvd.taxe_repartie,
      gvd.autres_frais,
      gvd.prix_vente_unitaire,
      gvd.montant_total,
      gvd.numerolot,
      gvd.dateperemption,
      gvd.datevalidation,
      gvd.etat,
      gvd.datevente,
      gvd.idjrnal,
      gvd.idmois,
      gvd.idannee,
      gvd.idtypecl,
      gvd.iduser,
      gvd.idclients,
      concat_ws(' ', gcl.nom, gcl.prenom) AS clients,
      gvd.prixachatactuel,
      gvd.couttotalachat,
      gvd.margebrut,
      gvd.iddetail_source,
      gvd.iddepot,
      gvd.prixbase,
      gvd.taux,
      gvd.prixassure,
      gvd.prixassurance,
      COALESCE(gvd.prixassure, 0) * COALESCE(gvd.quantite, 0) AS montant_assure,
      COALESCE(gvd.prixassurance, 0) * COALESCE(gvd.quantite, 0) AS montant_assurance,
      (COALESCE(gvd.prixassurance, 0) * COALESCE(gvd.quantite, 0)
       + COALESCE(gvd.prixassure, 0) * COALESCE(gvd.quantite, 0)
      ) AS montant_total,
      gvd.idassureur,
      ass.designation AS assurance,
      gvd.codevente
    FROM gvente_detail gvd
      INNER JOIN garticle ga ON ga.idarticle = gvd.idarticle
      INNER JOIN gunite gu   ON gu.idunite   = gvd.idunite
      INNER JOIN gsouscategorie gsc ON gsc.idsouscategorie = ga.idsouscategorie
      INNER JOIN gclients gcl   ON gcl.idclients   = gvd.idclients
      LEFT  JOIN utilisateur ut ON ut.iduser = gvd.iduser
      LEFT  JOIN s_assureur ass ON ass.idassureur = gvd.idassureur
    WHERE gvd.etat = 'actif'
  AND gvd.idagence = $1
  AND gvd.datevente BETWEEN TO_DATE($2,'DD/MM/YYYY')
                        AND TO_DATE($3,'DD/MM/YYYY')
    ORDER BY gvd.iddetail DESC
  `;

  try {
    const { rows } = await pool.query(queryText, values);
    res.json({
      meta: {
        count: rows.length
      },
      data: rows
    });
  } catch (err) {
    console.error('Erreur GET /rapportgvente_details:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});





router.get('/rapportgvente_details_gstock', async (req, res) => {
  const { idagence, datedebut, datefin } = req.query;

  // Validation
  if (!idagence || !datedebut || !datefin) {
    return res.status(400).json({
      error: 'Les paramètres "idagence", "datedebut" et "datefin" sont obligatoires.'
    });
  }

  const values = [parseInt(idagence, 10), datedebut, datefin];

  const queryText = `
    SELECT
      gvd.iddetail,
      gvd.idvente,
      gvd.ref_piece,
      gvd.codevente,
      gvd.idagence,
      gvd.idarticle,
      gsc.designation AS souscategorie,
      concat_ws(' ', ut.nom, ut.prenom) AS utilisateur,
      gvd.idlot,
      ga.designation AS article_designation,
      gu.designation AS unite_designation,
      gvd.idunite,
      gvd.quantite,
      gvd.poid_unitaire,
      gvd.prixvente_brut,
      gvd.remise,
      gvd.transport_reparti,
      gvd.taxe_repartie,
      gvd.autres_frais,
      gvd.prix_vente_unitaire,
      gvd.montant_total,
      gvd.numerolot,
      gvd.dateperemption,
      gvd.datevalidation,
      gvd.etat,
      gvd.datevente,
      gvd.idjrnal,
      gvd.idmois,
      gvd.idannee,
      gvd.idtypecl,
      gvd.iduser,
      gvd.idclients,
      concat_ws(' ', gcl.nom, gcl.prenom) AS clients,
      gvd.prixachatactuel,
      gvd.couttotalachat,
      gvd.margebrut,
      gvd.iddetail_source,
      gvd.iddepot,
      gvd.prixbase,
      gvd.taux,
      gvd.prixassure,
      gvd.prixassurance,
      gvd.codevente
    FROM gvente_detail gvd
      INNER JOIN garticle ga ON ga.idarticle = gvd.idarticle
      INNER JOIN gunite gu   ON gu.idunite   = gvd.idunite
      INNER JOIN gsouscategorie gsc ON gsc.idsouscategorie = ga.idsouscategorie
      INNER JOIN gclients gcl   ON gcl.idclients   = gvd.idclients
      LEFT  JOIN utilisateur ut ON ut.iduser = gvd.iduser
    WHERE gvd.etat = 'actif'
  AND gvd.idagence = $1
  AND gvd.datevente BETWEEN TO_DATE($2,'DD/MM/YYYY')
                        AND TO_DATE($3,'DD/MM/YYYY')
    ORDER BY gvd.iddetail DESC
  `;

  try {
    const { rows } = await pool.query(queryText, values);
    res.json({
      meta: {
        count: rows.length
      },
      data: rows
    });
  } catch (err) {
    console.error('Erreur GET /rapportgvente_details:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


/**
 * Route : GET /api/stats/top-10
 * Paramètres attendus : idagence, dateDebut (DD/MM/YYYY), dateFin (DD/MM/YYYY)
 */


router.get('/top-10', async (req, res) => {
  const { idagence, dateDebut, dateFin } = req.query;

  if (!idagence || !dateDebut || !dateFin) {
    return res.status(400).json({ success: false, message: "Paramètres manquants." });
  }

  try {
    // 1. Top 10 Articles
    const queryArticles = `
      SELECT 
        ga.designation AS nom,
        SUM(gvd.montant_total) AS total_ventes,
        SUM(gvd.margebrut) AS total_marge
      FROM gvente_detail gvd
      INNER JOIN garticle ga ON ga.idarticle = gvd.idarticle
      WHERE gvd.etat = 'actif'
        AND gvd.idagence = $1
        AND gvd.datevente BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY')
      GROUP BY ga.idarticle, ga.designation
      ORDER BY total_ventes DESC
      LIMIT 10;
    `;

    // 2. Top 10 Clients
    const queryClients = `
      SELECT 
        concat_ws(' ', gcl.nom, gcl.prenom) AS nom,
        SUM(gvd.montant_total) AS total_achats,
        SUM(gvd.margebrut) AS total_marge
      FROM gvente_detail gvd
      INNER JOIN gclients gcl ON gcl.idclients = gvd.idclients
      WHERE gvd.etat = 'actif'
        AND gvd.idagence = $1
        AND gvd.datevente BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY')
      GROUP BY gcl.idclients, gcl.nom, gcl.prenom
      ORDER BY total_achats DESC
      LIMIT 10;
    `;

    // Exécution en parallèle pour plus de rapidité
    const [resArticles, resClients] = await Promise.all([
      pool.query(queryArticles, [idagence, dateDebut, dateFin]),
      pool.query(queryClients, [idagence, dateDebut, dateFin])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        topArticles: resArticles.rows,
        topClients: resClients.rows
      }
    });

  } catch (err) {
    console.error('Erreur lors de la récupération des statistiques:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});





router.get('/statistiques-evolution', async (req, res) => {
  const { idagence, dateDebut, dateFin } = req.query;

  if (!idagence || !dateDebut || !dateFin) {
    return res.status(400).json({ success: false, message: "Paramètres manquants." });
  }

  try {
    // 1. Évolution par jour de la semaine (Lundi, Mardi...)
    const queryParJourSemaine = `
      SELECT 
        TO_CHAR(datevente, 'FMDay') AS jour_semaine,
        EXTRACT(ISODOW FROM datevente) AS jour_index, -- Pour trier: 1=Lundi, 7=Dimanche
        SUM(montant_total) AS total_ventes,
        SUM(margebrut) AS total_marge
      FROM gvente_detail
      WHERE etat = 'actif' AND idagence = $1
        AND datevente BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY')
      GROUP BY jour_semaine, jour_index
      ORDER BY jour_index;
    `;

    // 2. Évolution par mois
    const queryParMois = `
      SELECT 
        TO_CHAR(datevente, 'YYYY-MM') AS mois,
        SUM(montant_total) AS total_ventes,
        SUM(margebrut) AS total_marge
      FROM gvente_detail
      WHERE etat = 'actif' AND idagence = $1
        AND datevente BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY')
      GROUP BY mois
      ORDER BY mois;
    `;

    const [resSemaine, resMois] = await Promise.all([
      pool.query(queryParJourSemaine, [idagence, dateDebut, dateFin]),
      pool.query(queryParMois, [idagence, dateDebut, dateFin])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        evolutionSemaine: resSemaine.rows,
        evolutionMois: resMois.rows
      }
    });

  } catch (err) {
    console.error('Erreur:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});









/*
// 1. Point de terminaison pour le résumé financier regroupé
router.get('/summarysituation', async (req, res) => {
  const { idagence, start_date, end_date } = req.query;

  if (!idagence || !start_date || !end_date) {
    return res.status(400).json({ success: false, message: "Paramètres manquants (idagence, start_date, end_date)" });
  }

  const query = `
    WITH sales AS (
      SELECT
        gvd.datevente,
        gvd.ref_piece,
        SUM(gvd.montant_total) AS total_vente,
        SUM(gvd.remise) AS total_remise
      FROM gvente_detail gvd
      WHERE gvd.etat = 'actif' AND gvd.idagence = $1
        AND gvd.datevente BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY')
      GROUP BY gvd.datevente, gvd.ref_piece
    ),
    payments AS (
      SELECT
        gr.dateregle,
        gr.ref_piece_regle,
        SUM(gr.montant) AS total_paye
      FROM greglementclient gr
      WHERE gr.idagence = $1
        AND gr.dateregle BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY')
      GROUP BY gr.dateregle, gr.ref_piece_regle
    ),
    payment_details AS (
      SELECT
        p.dateregle,
        p.ref_piece_regle,
        p.total_paye,
        s.datevente AS sale_date,
        CASE
          WHEN s.datevente = p.dateregle THEN p.total_paye
          ELSE 0
        END AS montant_regle_meme_date,
        CASE
          WHEN s.datevente IS NULL OR p.dateregle > s.datevente THEN p.total_paye
          ELSE 0
        END AS montant_recouvrement
      FROM payments p
      LEFT JOIN (
        SELECT ref_piece, MIN(datevente) as datevente
        FROM gvente_detail
        WHERE etat = 'actif' AND idagence = $1
        GROUP BY ref_piece
      ) s ON s.ref_piece = p.ref_piece_regle
    ),
    all_dates_pieces AS (
      SELECT datevente AS date_ref, ref_piece FROM sales
      UNION
      SELECT dateregle AS date_ref, ref_piece_regle AS ref_piece FROM payments
    )
    SELECT
      EXTRACT(YEAR FROM adp.date_ref)::integer AS annee,
      EXTRACT(MONTH FROM adp.date_ref)::integer AS mois,
      TO_CHAR(adp.date_ref, 'YYYY-MM-DD') AS date_vente,
      adp.ref_piece,
      COALESCE(s.total_vente, 0)::double precision AS total_vente,
      COALESCE(s.total_remise, 0)::double precision AS total_remise,
      COALESCE(pd.montant_regle_meme_date, 0)::double precision AS montant_regler,
      GREATEST(0, COALESCE(s.total_vente, 0) - COALESCE(pd.montant_regle_meme_date, 0))::double precision AS montant_credit,
      COALESCE(pd.montant_recouvrement, 0)::double precision AS montant_recouvre,
      (COALESCE(pd.montant_regle_meme_date, 0) + COALESCE(pd.montant_recouvrement, 0))::double precision AS total_vente_encaisse
    FROM all_dates_pieces adp
    LEFT JOIN sales s ON s.datevente = adp.date_ref AND s.ref_piece = adp.ref_piece
    LEFT JOIN payment_details pd ON pd.dateregle = adp.date_ref AND pd.ref_piece_regle = adp.ref_piece
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

// 2. Détails d'une ou plusieurs ventes
router.get('/detailssituationvente', async (req, res) => {
  const { idagence, start_date, end_date, ref_piece } = req.query;

  let query = `
    SELECT
      gvd.iddetail,
      gvd.idvente,
      gvd.ref_piece,
      gvd.codevente,
      gvd.idagence,
      gvd.idarticle,
      gsc.designation AS souscategorie,
      concat_ws(' ', ut.nom, ut.prenom) AS utilisateur,
      gvd.idlot,
      ga.designation AS article_designation,
      gu.designation AS unite_designation,
      gvd.idunite,
      gvd.quantite,
      gvd.poid_unitaire,
      gvd.prixvente_brut,
      gvd.remise,
      gvd.transport_reparti,
      gvd.taxe_repartie,
      gvd.autres_frais,
      gvd.prix_vente_unitaire,
      gvd.montant_total,
      gvd.numerolot,
      gvd.dateperemption,
      gvd.datevalidation,
      gvd.etat,
      TO_CHAR(gvd.datevente, 'YYYY-MM-DD') AS datevente,
      gvd.idjrnal,
      gvd.idmois,
      gvd.idannee,
      gvd.idtypecl,
      gvd.iduser,
      gvd.idclients,
      concat_ws(' ', gcl.nom, gcl.prenom) AS clients,
      gvd.prixachatactuel,
      gvd.couttotalachat,
      gvd.margebrut,
      gvd.iddetail_source,
      gvd.iddepot,
      gvd.prixbase,
      gvd.taux,
      gvd.prixassure,
      gvd.prixassurance,
      gvd.codevente
    FROM gvente_detail gvd
      INNER JOIN garticle ga ON ga.idarticle = gvd.idarticle
      INNER JOIN gunite gu   ON gu.idunite   = gvd.idunite
      INNER JOIN gsouscategorie gsc ON gsc.idsouscategorie = ga.idsouscategorie
      INNER JOIN gclients gcl   ON gcl.idclients   = gvd.idclients
      LEFT JOIN utilisateur ut ON ut.iduser = gvd.iduser
    WHERE gvd.etat = 'actif'
      AND gvd.idagence = $1
  `;

  const params = [parseInt(idagence)];

  if (ref_piece) {
    query += ` AND gvd.ref_piece = $2 ORDER BY gvd.iddetail DESC`;
    params.push(ref_piece);
  } else {
    query += ` AND gvd.datevente BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY') ORDER BY gvd.iddetail DESC`;
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
*/

// 1. Point de terminaison pour le résumé financier regroupé (CORRIGÉ AVEC JOINTURE CLIENTS)
router.get('/summarysituation', async (req, res) => {
  const { idagence, start_date, end_date } = req.query;

  if (!idagence || !start_date || !end_date) {
    return res.status(400).json({ success: false, message: "Paramètres manquants (idagence, start_date, end_date)" });
  }

  const query = `
    WITH sales AS (
      SELECT
        gvd.datevente,
        gvd.ref_piece,
        SUM(gvd.montant_total) AS total_vente,
        SUM(gvd.remise) AS total_remise
      FROM gvente_detail gvd
      WHERE gvd.etat = 'actif' AND gvd.idagence = $1
        AND gvd.datevente BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY')
      GROUP BY gvd.datevente, gvd.ref_piece
    ),
    payments AS (
      SELECT
        gr.dateregle,
        gr.ref_piece_regle,
        SUM(gr.montant) AS total_paye
      FROM greglementclient gr
      WHERE gr.idagence = $1
        AND gr.dateregle BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY')
      GROUP BY gr.dateregle, gr.ref_piece_regle
    ),
    payment_details AS (
      SELECT
        p.dateregle,
        p.ref_piece_regle,
        p.total_paye,
        s.datevente AS sale_date,
        CASE
          WHEN s.datevente = p.dateregle THEN p.total_paye
          ELSE 0
        END AS montant_regle_meme_date,
        CASE
          WHEN s.datevente IS NULL OR p.dateregle > s.datevente THEN p.total_paye
          ELSE 0
        END AS montant_recouvrement
      FROM payments p
      LEFT JOIN (
        SELECT ref_piece, MIN(datevente) as datevente
        FROM gvente_detail
        WHERE etat = 'actif' AND idagence = $1
        GROUP BY ref_piece
      ) s ON s.ref_piece = p.ref_piece_regle
    ),
    all_dates_pieces AS (
      SELECT datevente AS date_ref, ref_piece FROM sales
      UNION
      SELECT dateregle AS date_ref, ref_piece_regle AS ref_piece FROM payments
    ),
    -- Résolution unique et optimisée du client pour chaque ref_piece
    client_resolver AS (
      SELECT DISTINCT ON (gvd.ref_piece)
        gvd.ref_piece,
        concat_ws(' ', gcl.nom, gcl.prenom) AS clients
      FROM gvente_detail gvd
      INNER JOIN gclients gcl ON gcl.idclients = gvd.idclients
      WHERE gvd.idagence = $1 AND gvd.etat = 'actif'
    )
    SELECT
      EXTRACT(YEAR FROM adp.date_ref)::integer AS annee,
      EXTRACT(MONTH FROM adp.date_ref)::integer AS mois,
      TO_CHAR(adp.date_ref, 'YYYY-MM-DD') AS date_vente,
      adp.ref_piece,
      COALESCE(cr.clients, 'Client Inconnu') AS clients, -- Récupération du nom du client
      COALESCE(s.total_vente, 0)::double precision AS total_vente,
      COALESCE(s.total_remise, 0)::double precision AS total_remise,
      COALESCE(pd.montant_regle_meme_date, 0)::double precision AS montant_regler,
      GREATEST(0, COALESCE(s.total_vente, 0) - COALESCE(pd.montant_regle_meme_date, 0))::double precision AS montant_credit,
      COALESCE(pd.montant_recouvrement, 0)::double precision AS montant_recouvre,
      (COALESCE(pd.montant_regle_meme_date, 0) + COALESCE(pd.montant_recouvrement, 0))::double precision AS total_vente_encaisse
    FROM all_dates_pieces adp
    LEFT JOIN sales s ON s.datevente = adp.date_ref AND s.ref_piece = adp.ref_piece
    LEFT JOIN payment_details pd ON pd.dateregle = adp.date_ref AND pd.ref_piece_regle = adp.ref_piece
    LEFT JOIN client_resolver cr ON cr.ref_piece = adp.ref_piece
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




// 2. Détails d'une ou plusieurs ventes
router.get('/detailssituationvente', async (req, res) => {
  // 1. Récupération sécurisée des paramètres
  const { idagence, idgagence, start_date, end_date, ref_piece } = req.query;
  
  // Correction : on utilise bien la variable issue du query
  const targetAgence = parseInt(idagence || idgagence);

  // Validation simple de l'agence
  if (isNaN(targetAgence)) {
    return res.status(400).json({ success: false, error: "ID agence invalide ou manquant." });
  }

  let query = `
    SELECT
      gvd.iddetail, gvd.idvente, gvd.ref_piece, gvd.codevente, gvd.idagence,
      gvd.idarticle, gsc.designation AS souscategorie,
      concat_ws(' ', ut.nom, ut.prenom) AS utilisateur,
      gvd.idlot, ga.designation AS article_designation,
      gu.designation AS unite_designation, gvd.idunite, gvd.quantite,
      gvd.poid_unitaire, gvd.prixvente_brut, gvd.remise,
      gvd.transport_reparti, gvd.taxe_repartie, gvd.autres_frais,
      gvd.prix_vente_unitaire, gvd.montant_total, gvd.numerolot,
      gvd.dateperemption, gvd.datevalidation, gvd.etat,
      TO_CHAR(gvd.datevente, 'YYYY-MM-DD') AS datevente,
      gvd.idjrnal, gvd.idmois, gvd.idannee, gvd.idtypecl,
      gvd.iduser, gvd.idclients,
      concat_ws(' ', gcl.nom, gcl.prenom) AS clients,
      gvd.prixachatactuel, gvd.couttotalachat, gvd.margebrut,
      gvd.iddetail_source, gvd.iddepot, gvd.prixbase, gvd.taux,
      gvd.prixassure, gvd.prixassurance
    FROM gvente_detail gvd
      INNER JOIN garticle ga ON ga.idarticle = gvd.idarticle
      INNER JOIN gunite gu   ON gu.idunite   = gvd.idunite
      INNER JOIN gsouscategorie gsc ON gsc.idsouscategorie = ga.idsouscategorie
      INNER JOIN gclients gcl   ON gcl.idclients   = gvd.idclients
      LEFT JOIN utilisateur ut ON ut.iduser = gvd.iduser
    WHERE gvd.etat = 'actif'
      AND gvd.idagence = $1
  `;

  const params = [targetAgence];

  // 2. Construction dynamique de la clause WHERE
  if (ref_piece) {
    query += ` AND gvd.ref_piece = $2`;
    params.push(ref_piece);
  } else if (start_date && end_date) {
    query += ` AND gvd.datevente BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY')`;
    params.push(start_date, end_date);
  }

  query += ` ORDER BY gvd.iddetail DESC`;

  try {
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Erreur lors de la récupération des ventes :", err);
    res.status(500).json({ success: false, error: "Erreur serveur lors de la récupération des données." });
  }
});



// 2. Détails d'une ou plusieurs ventes
router.get('/detailssituationventeOLDE', async (req, res) => {
  const { idgagence, start_date, end_date, ref_piece } = req.query;
  const targetAgence = idagence || idgagence; // Supporte les deux orthographes de paramètre

  let query = `
    SELECT
      gvd.iddetail,
      gvd.idvente,
      gvd.ref_piece,
      gvd.codevente,
      gvd.idagence,
      gvd.idarticle,
      gsc.designation AS souscategorie,
      concat_ws(' ', ut.nom, ut.prenom) AS utilisateur,
      gvd.idlot,
      ga.designation AS article_designation,
      gu.designation AS unite_designation,
      gvd.idunite,
      gvd.quantite,
      gvd.poid_unitaire,
      gvd.prixvente_brut,
      gvd.remise,
      gvd.transport_reparti,
      gvd.taxe_repartie,
      gvd.autres_frais,
      gvd.prix_vente_unitaire,
      gvd.montant_total,
      gvd.numerolot,
      gvd.dateperemption,
      gvd.datevalidation,
      gvd.etat,
      TO_CHAR(gvd.datevente, 'YYYY-MM-DD') AS datevente,
      gvd.idjrnal,
      gvd.idmois,
      gvd.idannee,
      gvd.idtypecl,
      gvd.iduser,
      gvd.idclients,
      concat_ws(' ', gcl.nom, gcl.prenom) AS clients,
      gvd.prixachatactuel,
      gvd.couttotalachat,
      gvd.margebrut,
      gvd.iddetail_source,
      gvd.iddepot,
      gvd.prixbase,
      gvd.taux,
      gvd.prixassure,
      gvd.prixassurance,
      gvd.codevente
    FROM gvente_detail gvd
      INNER JOIN garticle ga ON ga.idarticle = gvd.idarticle
      INNER JOIN gunite gu   ON gu.idunite   = gvd.idunite
      INNER JOIN gsouscategorie gsc ON gsc.idsouscategorie = ga.idsouscategorie
      INNER JOIN gclients gcl   ON gcl.idclients   = gvd.idclients
      LEFT JOIN utilisateur ut ON ut.iduser = gvd.iduser
    WHERE gvd.etat = 'actif'
      AND gvd.idagence = $1
  `;

  const params = [parseInt(targetAgence)];

  if (ref_piece) {
    query += ` AND gvd.ref_piece = $2 ORDER BY gvd.iddetail DESC`;
    params.push(ref_piece);
  } else {
    query += ` AND gvd.datevente BETWEEN TO_DATE($2, 'DD/MM/YYYY') AND TO_DATE($3, 'DD/MM/YYYY') ORDER BY gvd.iddetail DESC`;
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









// =========================================================================
// 1. ENDPOINT PRINCIPAL : RAPPORT DE STOCK
// =========================================================================

router.get('/situation-stock', async (req, res) => {
  try {
    const {
      idagence,
      start_date, // Ex: '01/08/2026'
      end_date,   // Ex: '12/08/2026'
      iddepot,
      type_rapport = 'SANS_VALEUR',
      mode_evaluation = 'CUMP',
      idtypecl,
      idtypefr,
      mode_vue = 'CUMULE'
    } = req.query;

    const targetAgence = parseInt(idagence);
    if (isNaN(targetAgence)) {
      return res.status(400).json({ success: false, error: "ID agence invalide." });
    }

    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, error: "Les dates début et fin sont requises." });
    }

    // 1. Choix du Prix d'Évaluation
    let subQueryPrix = '0';
    const params = [targetAgence, start_date, end_date];
    let paramIndex = 4;

    if (type_rapport === 'VALORISE') {
      switch (mode_evaluation) {
        case 'DERNIER_ACHAT':
          subQueryPrix = `
            COALESCE(
              (SELECT prixachat_brut FROM gachat_detail 
               WHERE idarticle = ga.idarticle AND idagence = $1 
               ORDER BY iddetail DESC LIMIT 1),
              ga.prixachat, 0
            )`;
          break;

        case 'DERNIER_VENTE':
          subQueryPrix = `
            COALESCE(
              (SELECT prixvente_brut FROM gvente_detail 
               WHERE idarticle = ga.idarticle AND idagence = $1 
               ORDER BY iddetail DESC LIMIT 1),
              ga.prixvente, 0
            )`;
          break;

        case 'TARIF_CLIENT':
          if (!idtypecl) {
            return res.status(400).json({ success: false, error: "Type Client requis pour cette évaluation." });
          }
          subQueryPrix = `
            COALESCE(
              (SELECT prix_vente_ttc FROM ttarifprixvente 
               WHERE idarticle = ga.idarticle AND idagence = $1 AND idtypecl = $${paramIndex} AND datefin IS NULL 
               ORDER BY idprixvente DESC LIMIT 1),
              ga.prixvente, 0
            )`;
          params.push(parseInt(idtypecl));
          paramIndex++;
          break;

        case 'TARIF_FOURNISSEUR':
          if (!idtypefr) {
            return res.status(400).json({ success: false, error: "Type Fournisseur requis pour cette évaluation." });
          }
          subQueryPrix = `
            COALESCE(
              (SELECT prix_achat_ttc FROM ttarifprixachat 
               WHERE idarticle = ga.idarticle AND idagence = $1 AND idtypefr = $${paramIndex} AND datefin IS NULL 
               ORDER BY idprixachat DESC LIMIT 1),
              ga.prixachat, 0
            )`;
          params.push(parseInt(idtypefr));
          paramIndex++;
          break;

        case 'CUMP':
        default:
          subQueryPrix = `COALESCE(ga.cump, 0)`;
          break;
      }
    }

    // Condition Dépôt
    let depotConditionMvt = '';
    if (iddepot) {
      depotConditionMvt = ` AND iddepot = ${parseInt(iddepot)}`;
    }

    // 2. REQUÊTE PRINCIPALE (Basée uniquement sur gmouvement_stock)
    let mainQuery = `
      WITH mvt_avant AS (
        -- A. Solde des mouvements STRICTEMENT AVANT la date de début (Stock Précédent)
        SELECT 
          idarticle,
          SUM(
            CASE 
              WHEN UPPER(type_mouvement) IN ('ENTREE', 'ACHAT', 'AJUSTEMENT_POS', 'STOCK_INITIAL', 'TRANSFERT_IN') THEN quantite
              WHEN UPPER(type_mouvement) IN ('SORTIE', 'VENTE', 'AJUSTEMENT_NEG', 'TRANSFERT_OUT', 'AVARIE') THEN -quantite
              ELSE 0 
            END
          ) AS solde_anterieur
        FROM gmouvement_stock
        WHERE idagence = $1
          AND dateoperation::date < TO_DATE($2, 'DD/MM/YYYY')
          ${depotConditionMvt}
        GROUP BY idarticle
      ),

      mvt_periode AS (
        -- B. Mouvements ENTRE date début ET date fin (incluses)
        SELECT 
          idarticle,
          SUM(
            CASE 
              WHEN UPPER(type_mouvement) IN ('ENTREE', 'ACHAT', 'AJUSTEMENT_POS', 'STOCK_INITIAL', 'TRANSFERT_IN') THEN quantite
              ELSE 0 
            END
          ) AS total_entree,
          SUM(
            CASE 
              WHEN UPPER(type_mouvement) IN ('SORTIE', 'VENTE', 'AJUSTEMENT_NEG', 'TRANSFERT_OUT', 'AVARIE') THEN quantite
              ELSE 0 
            END
          ) AS total_sortie
        FROM gmouvement_stock
        WHERE idagence = $1
          AND dateoperation::date >= TO_DATE($2, 'DD/MM/YYYY')
          AND dateoperation::date <= TO_DATE($3, 'DD/MM/YYYY')
          ${depotConditionMvt}
        GROUP BY idarticle
      )

      SELECT 
        ga.idarticle,
        ga.codearticle,
        ga.designation,
        COALESCE(gsc.designation, '') AS souscategorie,
        COALESCE(gu.designation, '') AS unite,

        -- 1. QUANTITÉS (Exclusivement basées sur l'historique des mouvements)
        COALESCE(ma.solde_anterieur, 0) AS stockprecedent,
        COALESCE(mp.total_entree, 0) AS totalentree,
        (COALESCE(ma.solde_anterieur, 0) + COALESCE(mp.total_entree, 0)) AS total_cumule,
        COALESCE(mp.total_sortie, 0) AS totalsortie,
        ((COALESCE(ma.solde_anterieur, 0) + COALESCE(mp.total_entree, 0)) - COALESCE(mp.total_sortie, 0)) AS stockactuel,

        -- 2. PRIX UNITAIRE
        (${subQueryPrix}) AS prix_unitaire,

        -- 3. MONTANTS VALORISÉS (Quantité * Prix)
        COALESCE(ma.solde_anterieur, 0) * (${subQueryPrix}) AS montantstockprecedent,
        COALESCE(mp.total_entree, 0) * (${subQueryPrix}) AS montanttotalentree,
        (COALESCE(ma.solde_anterieur, 0) + COALESCE(mp.total_entree, 0)) * (${subQueryPrix}) AS montanttotal_cumule,
        COALESCE(mp.total_sortie, 0) * (${subQueryPrix}) AS montanttotalsortie,
        ((COALESCE(ma.solde_anterieur, 0) + COALESCE(mp.total_entree, 0)) - COALESCE(mp.total_sortie, 0)) * (${subQueryPrix}) AS montantstockactuel

      FROM garticle ga
      LEFT JOIN mvt_avant ma ON ma.idarticle = ga.idarticle
      LEFT JOIN mvt_periode mp ON mp.idarticle = ga.idarticle
      LEFT JOIN gsouscategorie gsc ON gsc.idsouscategorie = ga.idsouscategorie
      LEFT JOIN gunite gu ON gu.idunite = ga.idunite
      WHERE ga.idagence = $1 AND ga.actif = true
      ORDER BY ga.designation ASC
    `;

    const result = await pool.query(mainQuery, params);
    
    res.json({
      success: true,
      type_rapport: type_rapport,
      mode_vue: mode_vue,
      data: result.rows
    });

  } catch (err) {
    console.error("Erreur génération rapport stock :", err);
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});






// =========================================================================
// 2. ENDPOINTS AUXILIAIRES POUR REMPLIR LES DROPDOWNS DU FORMULAIRE FLUTTER
// =========================================================================
// =========================================================================
// 2. ENDPOINTS AUXILIAIRES POUR REMPLIR LES DROPDOWNS DU FORMULAIRE FLUTTER
// =========================================================================

// Types Client
router.get('/typesclient', async (req, res) => {
  const { idagence } = req.query;
  const result = await pool.query("SELECT idtypecl, designation FROM ttypesclient WHERE idagence = $1", [idagence]);
  const formattedRows = result.rows.map(row => ({
    ...row,
    idtypecl: parseInt(row.idtypecl, 10)
  }));
  res.json(formattedRows);
});

// Types Fournisseur
router.get('/typesfournisseur', async (req, res) => {
  const { idagence } = req.query;
  const result = await pool.query("SELECT idtypefr, designation FROM ttypesfournisseur WHERE idagence = $1", [idagence]);
  const formattedRows = result.rows.map(row => ({
    ...row,
    idtypefr: parseInt(row.idtypefr, 10)
  }));
  res.json(formattedRows);
});

// Clients
router.get('/clients', async (req, res) => {
  const { idagence } = req.query;
  const result = await pool.query("SELECT idclients, concat_ws(' ', nom, prenom) AS nomcomplet FROM gclients WHERE idagence = $1", [idagence]);
  const formattedRows = result.rows.map(row => ({
    ...row,
    idclients: parseInt(row.idclients, 10)
  }));
  res.json(formattedRows);
});

// Fournisseurs
router.get('/fournisseurs', async (req, res) => {
  const { idagence } = req.query;
  const result = await pool.query("SELECT idfourn, nomcomplet FROM gfournisseur WHERE idagence = $1", [idagence]);
  const formattedRows = result.rows.map(row => ({
    ...row,
    idfourn: parseInt(row.idfourn, 10)
  }));
  res.json(formattedRows);
});

// Dépôts
router.get('/depots', async (req, res) => {
  const { idagence } = req.query;
  const result = await pool.query("SELECT iddepot, designation FROM gdepot WHERE idagence = $1 AND actif = true", [idagence]);
  const formattedRows = result.rows.map(row => ({
    ...row,
    iddepot: parseInt(row.iddepot, 10)
  }));
  res.json(formattedRows);
});


module.exports = router;

















