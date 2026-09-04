const express = require('express');
const router = express.Router();
const pool = require('../config/db');



router.post('/greglementassurance', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      idclients, idop, coderegleassurance, idagence, idjrnal,
      montant, idmois, idannee, iduser, datevalidation, dateregle,
      idmodep, montantrecu, relicat, idassureur, ref_piece_regle
    } = req.body;

    if (!idop || !idagence || !idjrnal || !idmois || !idannee || !iduser ) {
      return res.status(400).json({
        success: false,
        message: 'Champs obligatoires manquants (idop, idagence, idjrnal, idmois, idannee, iduser, ref_piece_regle)'
      });
    }

    await client.query('BEGIN');



    // Remplacez votre insertion par celle-ci (plus propre)
const insertResult = await client.query(`
  INSERT INTO greglementassurance (
    idclients, coderegleassurance, idop, idagence, idjrnal,
    montant, idmois, idannee, iduser, datevalidation, dateregle,
    idmodep, montantrecu, relicat, idassureur, ref_piece_regle, ref_piece
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
  RETURNING *
`, [
  idclients, coderegleassurance || '', idop, idagence, idjrnal,
  montant, idmois, idannee, iduser, datevalidation, dateregle,
  idmodep, montantrecu, relicat, idassureur, ref_piece_regle || '', ref_piece_regle || ''
]);

    /*
    // Une seule insertion : le trigger gère tmvttheorique + t_operation_cumule
    const insertResult = await client.query(`
      INSERT INTO greglementassurance (
        idclients, coderegleassurance, idop, idagence, idjrnal,
        montant, idmois, idannee, iduser, datevalidation, dateregle,
        idmodep, montantrecu, relicat, idassureur, ref_piece_regle, ref_piece
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *
    `, [
      idclients || null, coderegleassurance, idop, idagence, idjrnal,
      montant || 0, idmois, idannee, iduser, datevalidation || null,
      dateregle || null, idmodep || null, montantrecu || 0, relicat || 0,
      idassureur || null, ref_piece_regle,coderegleassurance
    ]);

*/




    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Règlement assurance ajouté (synchronisation automatique via trigger)',
      data: insertResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  } finally {
    client.release();
  }
});

// ✏️ Mettre à jour un règlement assurance
router.put('/greglementassurance/:idreglement', async (req, res) => {
  const client = await pool.connect();
  try {
    const { idreglement } = req.params;
    const { montant, dateregle, idassureur, montantrecu, relicat } = req.body;

    await client.query('BEGIN');

    const updateResult = await client.query(`
      UPDATE greglementassurance
         SET montant = COALESCE($1, montant),
             dateregle = COALESCE($2, dateregle),
             idassureur = COALESCE($3, idassureur),
             montantrecu = COALESCE($4, montantrecu),
             relicat = COALESCE($5, relicat)
       WHERE idreglement = $6
       RETURNING *
    `, [montant, dateregle, idassureur, montantrecu, relicat, idreglement]);

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Règlement non trouvé' });
    }

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Règlement mis à jour (synchronisation automatique via trigger)',
      data: updateResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  } finally {
    client.release();
  }
});

// 🗑️ Supprimer un règlement assurance
router.delete('/greglementassurance/:idreglement', async (req, res) => {
  const client = await pool.connect();
  try {
    const { idreglement } = req.params;

    await client.query('BEGIN');

    const deleteResult = await client.query(`
      DELETE FROM greglementassurance WHERE idreglement = $1 RETURNING *
    `, [idreglement]);

    if (deleteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Règlement non trouvé' });
    }

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Règlement supprimé (synchronisation automatique via trigger)',
      data: deleteResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  } finally {
    client.release();
  }
});


module.exports = router;


/*
// Route pour insérer un règlement assurance
router.post('/greglementassurance', async (req, res) => {
  const client = await pool.connect();
  try {
    let {
      idclients,
      idop,
      codeoperation,
      idagence,
      idjrnal,
      montant,
      idmois,
      idannee,
      iduser,
      datevalidation,
      dateregle,
      idmodep,
      montantrecu,
      relicat,
      idassureur,
      ref_piece_regle
    } = req.body;

    // Validation minimale
    if (!idop || !idagence || !idjrnal || !idmois || !idannee || !iduser) {
      return res.status(400).json({
        success: false,
        message: 'Champs obligatoires manquants (idop, idagence, idjrnal, idmois, idannee, iduser)'
      });
    }

    // Récupérer compte caisse utilisateur
    const caisseResult = await client.query(
      `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`,
      [iduser]
    );
    if (caisseResult.rows.length === 0) {
      throw new Error('Configuration comptable manquante (Caisse utilisateur)');
    }
    const compteCaisseEffective = caisseResult.rows[0].comptecaisse;

    // Récupérer compte auxiliaire client
    const compteauxiResult = await client.query(
      `SELECT compteauxiliaire FROM gclients WHERE idclients = $1`,
      [idclients]
    );
    if (compteauxiResult.rows.length === 0) {
      throw new Error('Configuration comptable manquante (Compte auxiliaire client)');
    }
    const compteauxiliaireEffective = compteauxiResult.rows[0].compteauxiliaire;

    await client.query('BEGIN');

    // 1️⃣ Insertion dans greglementassurance
    const insertResult = await client.query(`
      INSERT INTO greglementassurance (
        idclients,
        coderegleassurance,
        idop,
        idagence,
        idjrnal,
        montant,
        idmois,
        idannee,
        iduser,
        datevalidation,
        dateregle,
        idmodep,
        montantrecu,
        relicat,
        idassureur,compteauxiliaire,ref_piece,ref_piece_regle
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
    `,
    [
      idclients || null,
      codeoperation,
      idop,
      idagence,
      idjrnal,
      montant || 0,
      idmois,
      idannee,
      iduser,
      datevalidation || null,
      dateregle || null,
      idmodep || null,
      montantrecu || 0,
      relicat || 0,
      idassureur || null,
      compteauxiliaireEffective,
       coderegleassurance,
       ref_piece_regle
    ]);

    const newReglement = insertResult.rows[0];
    const montantreglerNum = parseFloat(newReglement.montant ?? 0);

    // 2️⃣ Mise à jour de t_operation_cumule
    await client.query(`
      UPDATE t_operation_cumule tcu
      SET regleassurance = sub.montant
      FROM (
        SELECT
          gop.idop,
          gop.idagence,
          gop.idassureur,
          ROUND(COALESCE(SUM(gop.montant), 0), 2) AS montant
        FROM greglementassurance gop
        WHERE gop.idop = $1 AND gop.idagence = $2 AND gop.idassureur = $3
        GROUP BY gop.idop, gop.idagence, gop.idassureur
      ) sub
      WHERE tcu.idop = sub.idop
        AND tcu.idagence = sub.idagence
        AND tcu.idassureur = sub.idassureur
    `, [idop, idagence, idassureur]);

    // Fonction utilitaire pour insérer UNE écriture
    async function insertLigneEcriture(libelle, compte, montantDebit, montantCredit, idtiersValue) {
      await client.query(`
        INSERT INTO TMVTTHEORIQUE (
          idtmvth, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
          MONTANTDEBIT, MONTANTCREDIT,
          IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
        ) VALUES (
           $1, $2, $3, $4, $5,
          $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        )
      `, [
        codeoperation, dateregle, idjrnal, compte, idtiersValue, libelle,
        montantDebit, montantCredit,
        iduser, idmois, idannee, codeoperation, idclients,
        idagence, idjrnal, idop, idtiersValue
      ]);
    }

    // Règlement assuré (2 écritures)
    if (montantreglerNum > 0) {
      await insertLigneEcriture('Règlement assureur', compteCaisseEffective, montantreglerNum, 0, null);
      await insertLigneEcriture('Règlement assureur', compteauxiliaireEffective, 0, montantreglerNum, idclients ?? null);
    }

    // ✅ Mise à jour de la datevalidation
    await client.query(`
      UPDATE public.greglementassurance
      SET datevalidation = $1
      WHERE idop = $2
    `, [dateregle, idop]);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Règlement assurance ajouté et opération mise à jour avec succès',
      data: newReglement
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  } finally {
    client.release();
  }
});


*/






/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Route pour insérer un règlement assurance
router.post('/greglementassurance', async (req, res) => {
  const client = await pool.connect();
  try {
    let {
      idclients,
      idop,
      codeoperation,
      idagence,
      idjrnal,
      montant,
      idmois,
      idannee,
      iduser,
      datevalidation,
      dateregle,
      idmodep,
      montantrecu,
      relicat,
      idassureur
    } = req.body;

    if (!idop || !idagence || !idjrnal || !idmois || !idannee || !iduser) {
      return res.status(400).json({
        success: false,
        message: 'Champs obligatoires manquants (idop, idagence, idjrnal, idmois, idannee, iduser)'
      });
    }


// Récupérer compte caisse utilisateur (existant dans ton code)
    const caisseResult = await client.query(
      `SELECT comptecaisse FROM caisse_utilisateur WHERE iduser = $1`,
      [iduser]
    );

    if (caisseResult.rows.length === 0) {
      throw new Error('Configuration comptable manquante (Caisse utilisateur)');
    }

    const compteCaisseEffective = caisseResult.rows[0]?.comptecaisse || null;


     // Récupérer compte auxiliaire client
    const compteauxiResult = await client.query(
      `SELECT compteauxiliaire FROM gclients WHERE idclients = $1`,
      [idclients]
    );
    if (compteauxiResult.rows.length === 0) {
      throw new Error('Configuration comptable manquante (Compte auxiliaire client)');
    }
    const compteauxiliaireEffective = compteauxiResult.rows[0].compteauxiliaire;


    await client.query('BEGIN');

    // 1️⃣ Insertion dans greglementassurance
    const insertResult = await client.query(`
      INSERT INTO greglementassurance (
        idclients,
        coderegleassurance,
        idop,
        idagence,
        idjrnal,
        montant,
        idmois,
        idannee,
        iduser,
        datevalidation,
        dateregle,
        idmodep,
        montantrecu,
        relicat,
        idassureur
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `,
    [
      idclients || null,
      codeoperation,
      idop,
      idagence,
      idjrnal,
      montant || 0,
      idmois,
      idannee,
      iduser,
      datevalidation || null,
      dateregle || null,
      idmodep || null,
      montantrecu || 0,
      relicat || 0,
      idassureur || null
    ]);

    const newReglement = insertResult.rows[0];

    // 2️⃣ Mise à jour de t_operation_cumule avec la somme des montants
    await client.query(`
      UPDATE t_operation_cumule tcu
      SET regleassurance = sub.montant
      FROM (
        SELECT
          gop.idop,
          gop.idagence,
          gop.idassureur,
          ROUND(COALESCE(SUM(gop.montant), 0), 2) AS montant
        FROM greglementassurance gop
        WHERE gop.idop = $1 AND gop.idagence = $2 AND gop.idassureur = $3
        GROUP BY gop.idop, gop.idagence, gop.idassureur
      ) sub
      WHERE tcu.idop = sub.idop
        AND tcu.idagence = sub.idagence
        AND tcu.idassureur = sub.idassureur
    `, [idop, idagence, idassureur]);



         const montantreglerNum = parseFloat(insertedRow.montant ?? 0);


     // Fonction utilitaire pour insérer UNE écriture
    async function insertLigneEcriture(libelle, compte, montantDebit, montantCredit, idtiersValue) {
      await client.query(`
        INSERT INTO TMVTTHEORIQUE (
          idtmvth, DATE, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
          MONTANTDEBIT, MONTANTCREDIT,
          IDUSER, IDMOIS, IDANNEE, CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
        ) VALUES (
           $1, $2, $3, $4, $5,
          $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15, $16,$17
        )
      `, [
        codeoperation,dateregle, idjrnal, compte, idtiersValue, libelle,
        montantDebit, montantCredit,
        iduser, idmois, idannee, codeoperation, idclients,
        idagence, idjrnal, idop, idtiersValue
      ]);
    }



// Règlement assuré (2 écritures)
if (insertedRow.montantreglerNum > 0) {
  await insertLigneEcriture('Règlement assuré', compteCaisseEffective, insertedRow.montantreglerNum, 0, null);
  await insertLigneEcriture('Règlement assuré', compteauxiliaireEffective, 0, insertedRow.montantreglerNum, idclients ?? null);
}



    // ✅ Mise à jour de la datevalidation
    await client.query(`
      UPDATE public.greglementassurance
      SET datevalidation = $1
      WHERE idop = $2
    `, [dateregle, idop]);


    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Règlement assurance ajouté et opération mise à jour avec succès',
      data: newReglement
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;

*/


