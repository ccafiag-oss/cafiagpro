// routes/tmvttheorique.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');




















/*
router.post('/comptaachat/:idachat', async (req, res) => {
  const { idachat } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Premier INSERT (débit)
    const insertDebit = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence,idjrnal,idmouvement,idclient
      )
      SELECT
        GA.idachat,
        GA.dateachat,
        GC.idjrnalachat,
        GC.comptegenachat,
        '' AS idtiers,
        concat('Achat chez ','',' Fact n° '),
        ROUND(SUM(GA.cout_total), 2),
        0,
       GA.iduser,
        GA.idmois,
        GA.idannee,
        GA.idachat,
        '' AS reftiers,
        GA.idagence,
        GC.idjrnalachat as idjournalach,
	     '' as idmouvement,
        '' AS idtiers
      FROM gachat_detail GA
      JOIN garticle GP ON GA.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      WHERE GA.datevalidation IS NULL AND GA.idachat=$1 AND GA.etat='actif'
      GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenachat,
               GA.idmois, GA.idannee, GA.idagence,GA.iduser
    `;

    await client.query(insertDebit, [idachat]);



    // Deuxième INSERT (crédit)
    const insertCredit = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence,idjrnal,idmouvement,idclient
      )
      SELECT
        GA.idachat,
        GA.dateachat,
        GC.idjrnalachat,
        GF.compteauxiliaire,
        GF.idfourn,
        concat('Achat chez ','',' Fact n° '),
        0,
        ROUND(SUM(GA.cout_total), 2),
        GA.iduser,
        GA.idmois,
        GA.idannee,
        GA.idachat,
        GA.idachat::text AS reftiers,
        GA.idagence,
        GC.idjrnalachat,
        '' as idmouvement,
        GF.idfourn
      FROM gachat_detail GA
      JOIN garticle GP ON GA.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      JOIN gfournisseur GF ON GA.idfourn=GF.idfourn
      WHERE GA.datevalidation IS NULL AND GA.idachat=$1 AND GA.etat='actif'
      GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GF.compteauxiliaire,
               GA.idmois, GA.idannee, GF.idfourn, GA.idagence,GA.iduser
    `;

     await client.query(insertCredit, [idachat]);




    // Deuxieme INSERT  variation de stock (débit)
    const insertDebitvar = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence,idjrnal,idmouvement,idclient
      )
      SELECT
        GA.idachat,
        GA.dateachat,
        GC.idjrnalachat,
        GC.comptegenstock,
        '' AS idtiers,
        concat('Achat chez ','',' Fact n° '),
        ROUND(SUM(GP.cump*GA.quantite), 2),
        0,
       GA.iduser,
        GA.idmois,
        GA.idannee,
        GA.idachat,
        '' AS reftiers,
        GA.idagence,
        GC.idjrnalachat,
	      '' as idmouvement,
        '' AS idtiers
      FROM gachat_detail GA
      JOIN garticle GP ON GA.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      WHERE GA.datevalidation IS NULL AND GA.idachat=$1 AND GA.etat='actif'
      GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenstock,
               GA.idmois, GA.idannee, GA.idagence,GA.iduser

    `;



    await client.query(insertDebitvar, [idachat]);

    

    // Deuxième INSERT variation de stock (crédit)
    const insertCreditvar = `
     INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence,idjrnal,idmouvement,idclient
      )
      SELECT
        GA.idachat,
        GA.dateachat,
        GC.idjrnalachat,
        GC.comptegenvrstock,
        GF.idfourn,
        concat('Achat chez ','',' Fact n° '),
        0,
        ROUND(SUM(GP.cump*GA.quantite), 2),
        GA.iduser,
        GA.idmois,
        GA.idannee,
        GA.idachat,
        GA.idachat::text AS reftiers,
        GA.idagence,
        GC.idjrnalachat,
	      '' as idmouvement,
        '' AS idtiers
      FROM gachat_detail GA
      JOIN garticle GP ON GA.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      JOIN gfournisseur GF ON GA.idfourn=GF.idfourn
      WHERE GA.datevalidation IS NULL AND GA.idachat=$1 AND GA.etat='actif'
      GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenvrstock,
               GA.idmois, GA.idannee, GF.idfourn, GA.idagence,GA.iduser
    `;



    await client.query(insertCreditvar, [idachat]);

    // UPDATE gachat_detail
    const updateDetail = `
      UPDATE gachat_detail
      SET datevalidation = NOW()
      WHERE idachat = $1
    `;
    await client.query(updateDetail, [idachat]);

    await client.query('COMMIT');
    res.status(200).json({ message: 'Écritures théoriques générées et détail validé.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l’insertion des écritures.' });
  } finally {
    client.release();
  }
});
*/

/*
router.post('/comptaachat/:idachat', async (req, res) => {
  const { idachat } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // INSERT Débit (compte général achat)
    const insertDebit = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      SELECT
        GA.idachat,
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
        NULL AS reftiers,
        GA.idagence,
        GC.idjrnalachat,
        NULL AS idmouvement,
        0 AS idclient
      FROM gachat_detail GA
      JOIN garticle GP ON GA.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = 'actif'
      GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenachat,
               GA.idmois, GA.idannee, GA.idagence, GA.iduser,GA.codeachat
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
        GA.idachat,
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
        GA.idachat::text AS reftiers,
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
               GA.idmois, GA.idannee, GF.idfourn, GA.idagence, GA.iduser,GA.codeachat
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
        GA.idachat,
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
        NULL AS reftiers,
        GA.idagence,
        GC.idjrnalachat,
        NULL AS idmouvement,
        0 AS idclient
      FROM gachat_detail GA
      JOIN garticle GP ON GA.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      WHERE GA.datevalidation IS NULL AND GA.idachat = $1 AND GA.etat = 'actif'
      GROUP BY GA.idachat, GA.dateachat, GC.idjrnalachat, GC.comptegenstock,
               GA.idmois, GA.idannee, GA.idagence, GA.iduser,GA.codeachat
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
        GA.idachat,
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
        GA.idachat::text AS reftiers,
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
               GA.idmois, GA.idannee, GF.idfourn, GA.idagence, GA.iduser,GA.codeachat
    `;
    await client.query(insertCreditVar, [idachat]);

    // UPDATE validation
    const updateDetail = `
      UPDATE gachat_detail
      SET datevalidation = NOW()
      WHERE idachat = $1
    `;
    await client.query(updateDetail, [idachat]);

    await client.query('COMMIT');
    res.status(200).json({ message: 'Écritures théoriques générées et détail validé.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l’insertion des écritures.' });
  } finally {
    client.release();
  }
});

*/





// COMPTABILISATION   VENTE


/*

router.post('/comptavente/:idvente', async (req, res) => {
  const { idvente } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // INSERT Débit (compte général vente)
    const insertDebit = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      SELECT
        GV.idvente,
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
        NULL AS reftiers,
        GV.idagence,
        GC.idjrnalvente,
        NULL AS idmouvement,
        0 AS idclient
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat = 'actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenvente,
               GV.idmois, GV.idannee, GV.idagence, GV.iduser,GV.codevente
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
        GV.idvente,
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
        GV.idvente::text AS reftiers,
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
               GV.idmois, GV.idannee, GCL.idclients, GV.idagence, GV.iduser,GV.codevente
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
        GV.idvente,
        GV.datevente,
        GC.idjrnalvente,
        GC.comptegenvrstock,
        0 AS idtiers,
        CONCAT('Vente ', '', ' Fact n° ','' ,GV.codevente),
        ROUND(SUM(GP.cump * GV.quantite), 2),
        0,
        GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        NULL AS reftiers,
        GV.idagence,
        GC.idjrnalvente,
        NULL AS idmouvement,
        0 AS idclient
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      WHERE GV.datevalidation IS NULL AND GV.idvente = $1 AND GV.etat = 'actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenvrstock,
               GV.idmois, GV.idannee, GV.idagence, GV.iduser,GV.codevente
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
        GV.idvente,
        GV.datevente,
        GC.idjrnalvente,
        GC.comptegenstock,
        0 AS idtiers,
        CONCAT('Vente ', '', ' Fact n° ','' ,GV.codevente),
        0,
        ROUND(SUM(GP.cump * GV.quantite), 2),
        GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        GV.idvente::text AS reftiers,
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
               GV.idmois, GV.idannee, GCL.idclients, GV.idagence, GV.iduser,GV.codevente
    `;
    await client.query(insertCreditVar, [idvente]);

    // UPDATE validation
    const updateDetail = `
      UPDATE gvente_detail
      SET datevalidation = NOW()
      WHERE idvente = $1
    `;
    await client.query(updateDetail, [idvente]);

    await client.query('COMMIT');
    res.status(200).json({ message: 'Écritures théoriques générées et détail validé.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l’insertion des écritures.' });
  } finally {
    client.release();
  }
});

*/
/*
router.post('/comptavente/:idvente', async (req, res) => {
  const { idvente } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Premier INSERT (débit)
    const insertDebit = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence,idjrnal,idmouvement,idclient
      )
      SELECT
        GV.idvente,
        GV.datevente,
        GC.idjrnalvente,
        GC.comptegenvente,
        '' AS idtiers,
        concat('vente à ','',' Fact n° '),
        0,
        ROUND(SUM(GV.montant_total), 2),
       GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        '' AS reftiers,
        GV.idagence,
         GC.idjrnalvente,
         '' AS idmouvement,
         '' AS idtiers
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      WHERE GV.datevalidation IS NULL AND GV.idvente=$1 AND GV.etat='actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenvente,
               GV.idmois, GV.idannee, GV.idagence,GV.iduser

    `;

 await client.query(insertDebit, [idvente]);


 // Deuxième INSERT (crédit)
    const insertCredit = `
      INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence,idjrnal,idmouvement,idclient
      )
       SELECT
        GV.idvente,
        GV.datevente,
        GC.idjrnalvente,
        GCL.compteauxiliaire,
        GCL.idclients,
        concat('Vente chez ','',' Fact n° '),
        ROUND(SUM(GV.montant_total), 2),
        0,
        GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        GV.idvente::text AS reftiers,
        GV.idagence,
        GC.idjrnalvente,
        '' AS idmouvement,
        GCL.idclients
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      JOIN gclients GCL ON GV.idclients=GCL.idclients
      WHERE GV.datevalidation IS NULL AND GV.idvente=$1 AND GV.etat='actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GCL.compteauxiliaire,
               GV.idmois, GV.idannee, GCL.idclients, GV.idagence,GV.iduser

    `;

    await client.query(insertCredit, [idvente]);

 // quatrieme INSERT (débit)  variation de stock

 const insertDebitvarvt = `
     INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence,idjrnal,idmouvement,idclient
      )
      SELECT
        GV.idvente,
        GV.datevente,
        GC.idjrnalvente,
        GC.comptegenvrstock,
        '' AS idtiers,
        concat('vente à ','',' Fact n° '),
        ROUND(SUM(GP.cump*GV.quantite), 2),
        0,
       GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        '' AS reftiers,
        GV.idagence,
         GC.idjrnalvente,
         '' AS idmouvement,
         '' AS idtiers
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      WHERE GV.datevalidation IS NULL AND GV.idvente=$1 AND GV.etat='actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenvrstock,
               GV.idmois, GV.idannee, GV.idagence,GV.iduser


    `;








    await client.query(insertDebitvarvt, [idvente]);

    

 // Troisieme INSERT (crédit)


 const insertCreditvarvt = `
      
INSERT INTO TMVTTHEORIQUE (
        IDTMVTH, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence,idjrnal,idmouvement,idclient
      )
       SELECT
        GV.idvente,
        GV.datevente,
        GC.idjrnalvente,
        GC.comptegenstock,
        '' AS reftiers,
        concat('Vente chez ','',' Fact n° '),
        0,
        ROUND(SUM(GP.cump*GV.quantite), 2),
        GV.iduser,
        GV.idmois,
        GV.idannee,
        GV.idvente,
        GV.idvente::text AS reftiers,
        GV.idagence,
         GC.idjrnalvente,
         '' AS idmouvement,
         '' AS idtiers
      FROM gvente_detail GV
      JOIN garticle GP ON GV.idarticle = GP.idarticle
      JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
      JOIN gclients GCL ON GV.idclients=GCL.idclients
      WHERE GV.datevalidation IS NULL AND GV.idvente=$1 AND GV.etat='actif'
      GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenstock,
               GV.idmois, GV.idannee, GCL.idclients, GV.idagence,GV.iduser


    `;




    await client.query(insertCreditvarvt, [idvente]);

    // UPDATE gachat_detail
    const updateDetail = `
      UPDATE gvente_detail
      SET datevalidation = NOW()
      WHERE idvente = $1
    `;
    await client.query(updateDetail, [idvente]);

    await client.query('COMMIT');
    res.status(200).json({ message: 'Écritures théoriques générées et détail validé.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l’insertion des écritures.' });
  } finally {
    client.release();
  }
});
*/





module.exports = router;
