const express = require('express');
const router = express.Router();
const pool = require('../config/db');


// ======================================================
// AJOUTER MODELE + OPERATIONS
// ======================================================
router.post('/model-operation-ajouter', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            codemodel,
            idagence,
            designation,
            libelle,
            codejrnl,
            idjournal,
            operations,
            comptegeneral,
            typesoperation,
            prixpublic,
            prixbase,
            statut_assurance
        } = req.body;

        if (!codemodel || !idagence || !designation || !codejrnl || !idjournal) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants'
            });
        }

        const insertModel = `
            INSERT INTO fina_model
            (
                codemodel,
                idagence,
                designation,
                libelle,
                codejrnl,
                idjournal,
                nombreligne,
                typesoperation,
                prixpublic,
                prixbase,
                statut_assurance
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING idmodel
        `;

        const resultModel = await client.query(insertModel, [
            codemodel,
            idagence,
            designation,
            libelle,
            codejrnl,
            idjournal,
            operations.length,
            typesoperation,
            prixpublic,
            prixbase,
            statut_assurance
        ]);

        const idmodel = resultModel.rows[0].idmodel;

        for (let i = 0; i < operations.length; i++) {
            const op = operations[i];

            await client.query(`
                INSERT INTO fina_modeloperation
                (
                    idmodel,
                    numeroligne,
                    compte,
                    idtiers,
                    idclient,
                    montant,
                    sensoperation,
                    comptegeneral
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            `, [
                idmodel,
                i + 1,
                op.compte,
                op.idtiers || null,
                op.idclient || null,
                op.montant || 0,
                op.sensoperation,
                op.comptegeneral
            ]);
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Modèle ajouté avec succès',
            idmodel
        });

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});


// ======================================================
// AFFICHER TOUS LES MODELES
 // ======================================================
// ==========================================
// GET : Liste des modèles
// URL : /api/model-operation-liste?idagence=1
// ==========================================




router.get('/model-operation-liste', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({
      success: false,
      message: 'idagence obligatoire'
    });
  }

  try {
    let sql = `
      SELECT
                idmodel,
                codemodel,
                designation,
                libelle,
                codejrnl,
                idjournal,
                nombreligne,
                etat,
                datecreation,
                typesoperation,
                prixpublic,
                prixbase,
                statut_assurance

            FROM fina_model
            WHERE idagence = $1
           
    `;

    const params = [idagence];

    if (search && search.trim() !== '') {
      sql += ` AND designation ILIKE $2 `;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY idmodel DESC`;

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});







router.get('/model-operation/:idmodel', async (req, res) => {
  const idmodelRaw = req.params.idmodel;

  // Validation simple : idmodel doit être un entier
  const idmodel = Number.parseInt(idmodelRaw, 10);
  if (Number.isNaN(idmodel)) {
    return res.status(400).json({ success: false, message: 'idmodel invalide' });
  }

  try {
    // Requêtes paramétrées : on sélectionne explicitement les colonnes utiles
    const modelSql = `
      SELECT idmodel, codemodel, designation, libelle, codejrnl, idjournal, nombreligne, etat, datecreation, idagence,typesoperation,prixpublic,prixbase,statut_assurance
      FROM fina_model
      WHERE idmodel = $1
      LIMIT 1
    `;

    const opsSql = `
      SELECT idoperation, idmodel, numeroligne, compte, idtiers, idclient, montant, sensoperation, etat, datecreation,comptegeneral
      FROM fina_modeloperation
      WHERE idmodel = $1
      ORDER BY numeroligne
    `;

    // Exécuter les deux requêtes en parallèle (gain si latence DB non négligeable)
    const [modelRes, opsRes] = await Promise.all([
      pool.query(modelSql, [idmodel]),
      pool.query(opsSql, [idmodel])
    ]);

    if (!modelRes.rows || modelRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Modèle introuvable' });
    }

    const model = modelRes.rows[0];
    const operations = opsRes.rows || [];

    return res.json({ success: true, model, operations });
  } catch (error) {
    console.error('GET /model-operation/:idmodel error', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});




// ======================================================
// MODIFIER MODELE + OPERATIONS
// ======================================================
router.put('/model-operation-modifier/:idmodel', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { idmodel } = req.params;

        const {
            codemodel,
            idagence,
            designation,
            libelle,
            codejrnl,
            idjournal,
            operations,
            typesoperation,
            prixpublic,
            prixbase,
            statut_assurance
        } = req.body;

        await client.query(`
            UPDATE fina_model
            SET codemodel = $1,
                idagence = $2,
                designation = $3,
                libelle = $4,
                codejrnl = $5,
                idjournal = $6,
                nombreligne = $7,
                typesoperation=$8,
                prixpublic=$9,
                prixbase=$10,
                statut_assurance=$11
            WHERE idmodel = $12
        `, [
            codemodel,
            idagence,
            designation,
            libelle,
            codejrnl,
            idjournal,
            operations.length,
            typesoperation,
            prixpublic,
            prixbase,
            statut_assurance,
            idmodel
        ]);

        // supprimer anciennes lignes
        await client.query(`
            DELETE FROM fina_modeloperation
            WHERE idmodel = $1
        `, [idmodel]);

        // réinsertion nouvelles lignes
        for (let i = 0; i < operations.length; i++) {
            const op = operations[i];

            await client.query(`
                INSERT INTO fina_modeloperation
                (
                    idmodel,
                    numeroligne,
                    compte,
                    idtiers,
                    idclient,
                    montant,
                    sensoperation,
                    comptegeneral
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            `, [
                idmodel,
                i + 1,
                op.compte,
                op.idtiers || null,
                op.idclient || null,
                op.montant || 0,
                op.sensoperation,
                op.comptegeneral
            ]);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Modèle modifié avec succès'
        });

    } catch (error) {
        await client.query('ROLLBACK');

        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});



///   RAPPORT



// Route pour récupérer le rapport par agence et par période
router.get('/rapportmodeloperation', async (req, res) => {
  const { idagence, dateDebut, dateFin } = req.query;

  // Validation des paramètres obligatoires
  if (!idagence || !dateDebut || !dateFin) {
    return res.status(400).json({ 
      error: 'Les paramètres "idagence", "dateDebut" et "dateFin" sont obligatoires.' 
    });
  }

  const query = `
    SELECT 
        god.idagence,
        god.idmodel,
        fm.designation,
        COUNT(*) AS nombreoperation,
        SUM(god.montantassure) AS montantassure,
        SUM(god.montantassurance) AS montantassurance,
        SUM(god.montantpayeassure) AS montantpayeassure,
        SUM(god.montantpayeassurance) AS montantpayeassurance,
        COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT god.dateoperation), 0) AS moyenne_operation_par_jour
    FROM public.goperation_detail god
    JOIN public.fina_model fm ON fm.idmodel = god.idmodel
    WHERE god.idagence = $1 
      AND god.dateoperation BETWEEN $2 AND $3
    GROUP BY god.idmodel, fm.designation, god.idagence;
  `;

  try {
    const { rows } = await pool.query(query, [idagence, dateDebut, dateFin]);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('Erreur dans /rapport-model:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des données du rapport.' });
  }
});





module.exports = router;