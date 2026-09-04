const express = require('express');
const router = express.Router();
const pool = require('../config/db');

//////////////////////////////////////////////////////
// 1. AFFICHER LES TARIFS DE VENTE
//////////////////////////////////////////////////////
router.get('/ttarifprixvente', async (req, res) => {
    const { idagence, search } = req.query;

    if (!idagence) {
        return res.status(400).json({
            error: 'Le paramètre idagence est obligatoire'
        });
    }

    let query = `
        SELECT 
            t.idprixvente,
            t.idagence,
            ag.nomagence AS designation_agence,

            t.idarticle,
            a.designation AS designation_article,

            t.idsouscategorie,
            sc.designation AS designation_souscategorie,

            t.idtypecl,
            tc.designation AS designation_type_client,

            t.prix_vente_ht,
            t.taxe1,
            t.taxe2,
            t.taxe3,
            t.taxe4,
            t.prix_vente_ttc,
            t.datedebut,
            t.datefin,
            t.prix_base,
            t.remise
        FROM ttarifprixvente t
        LEFT JOIN agence ag 
            ON ag.idagence = t.idagence
        LEFT JOIN garticle a 
            ON a.idarticle = t.idarticle
        LEFT JOIN gsouscategorie sc 
            ON sc.idsouscategorie = t.idsouscategorie
        LEFT JOIN ttypesclient tc 
            ON tc.idtypecl = t.idtypecl
        WHERE t.idagence = $1 AND datefin IS NULL
    `;

    let values = [idagence];

    if (search && search.length >= 2) {
        query += ` AND a.designation ILIKE $2`;
        values.push(`%${search}%`);
    }

    query += ` ORDER BY t.idprixvente DESC`;

    try {
        const { rows } = await pool.query(query, values);

        res.json({
            data: rows
        });

    } catch (error) {
        console.error('Erreur GET tarif vente:', error);
        res.status(500).json({
            error: 'Erreur serveur'
        });
    }
});

//////////////////////////////////////////////////////
// 2. AJOUTER
//////////////////////////////////////////////////////



router.post('/ttarifprixvente', async (req, res) => {
  const {
    idagence,
    idarticle,
    idsouscategorie,
    idtypecl,
    prix_vente_ht,
    taxe1,
    taxe2,
    taxe3,
    taxe4,
    prix_vente_ttc,
    datedebut,
    prix_base,
    remise
  } = req.body;

  if (!idagence || !idarticle) {
    return res.status(400).json({
      error: 'idagence et idarticle sont obligatoires'
    });
  }

  try {
    // 1. Fermer l’ancien tarif si existe avec datefin = NULL
    await pool.query(
      `
      UPDATE ttarifprixvente
      SET datefin = NOW()
      WHERE idagence = $1
        AND idarticle = $2
       
        AND (idtypecl = $3 OR ($3 IS NULL AND idtypecl IS NULL))
        AND datefin IS NULL
      `,
      [idagence, idarticle || null, idtypecl || null]
    );

    // AND (idsouscategorie = $3 OR ($3 IS NULL AND idsouscategorie IS NULL))
    // 2. Insérer le nouveau tarif
    const { rows } = await pool.query(
      `
      INSERT INTO ttarifprixvente (
        idagence,
        idarticle,
        idsouscategorie,
        idtypecl,
        prix_vente_ht,
        taxe1,
        taxe2,
        taxe3,
        taxe4,
        prix_vente_ttc,
        datedebut,
       
        prix_base,
        remise
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
      )
      RETURNING *
      `,
      [
        idagence,
        idarticle,
        idsouscategorie || null,
        idtypecl || null,
        prix_vente_ht || 0,
        taxe1 || 0,
        taxe2 || 0,
        taxe3 || 0,
        taxe4 || 0,
        prix_vente_ttc || 0,
        datedebut || new Date(),
        prix_base || 0,
        remise || 0
      ]
    );

    res.status(201).json({
      message: 'Tarif vente ajouté avec succès',
      data: rows[0]
    });

  } catch (error) {
    console.error('Erreur POST tarif vente:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


/*
router.post('/ttarifprixvente', async (req, res) => {
    const {
        idagence,
        idarticle,
        idsouscategorie,
        idtypecl,
        prix_vente_ht,
        taxe1,
        taxe2,
        taxe3,
        taxe4,
        prix_vente_ttc,
        datedebut,
        datefin,
        prix_base
    } = req.body;

    if (!idagence || !idarticle) {
        return res.status(400).json({
            error: 'idagence et idarticle sont obligatoires'
        });
    }

    try {
        const { rows } = await pool.query(
            `
            INSERT INTO ttarifprixvente (
                idagence,
                idarticle,
                idsouscategorie,
                idtypecl,
                prix_vente_ht,
                taxe1,
                taxe2,
                taxe3,
                taxe4,
                prix_vente_ttc,
                datedebut,
                datefin,
                prix_base
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,
                $8,$9,$10,$11,$12,$13
            )
            RETURNING *
            `,
            [
                idagence,
                idarticle,
                idsouscategorie || null,
                idtypecl || null,
                prix_vente_ht || 0,
                taxe1 || 0,
                taxe2 || 0,
                taxe3 || 0,
                taxe4 || 0,
                prix_vente_ttc || 0,
                datedebut || null,
                datefin || null,
                prix_base || 0
            ]
        );

        res.status(201).json({
            message: 'Tarif vente ajouté avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error('Erreur POST tarif vente:', error);

        res.status(500).json({
            error: 'Erreur serveur'
        });
    }
});
*/

//////////////////////////////////////////////////////
// 3. MODIFIER
//////////////////////////////////////////////////////
router.put('/ttarifprixvente/:id', async (req, res) => {
    const { id } = req.params;
    const data = req.body;

    const fields = [];
    const values = [];
    let index = 1;

    for (const key in data) {
        if (data[key] !== undefined) {
            fields.push(`${key} = $${index++}`);
            values.push(data[key]);
        }
    }

    if (fields.length === 0) {
        return res.status(400).json({
            error: 'Aucun champ à modifier'
        });
    }

    values.push(id);

    const query = `
        UPDATE ttarifprixvente
        SET ${fields.join(', ')}
        WHERE idprixvente = $${index}
        RETURNING *
    `;

    try {
        const { rowCount, rows } =
            await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({
                error: 'Tarif vente non trouvé'
            });
        }

        res.json({
            message: 'Tarif vente modifié avec succès',
            data: rows[0]
        });

    } catch (error) {
        console.error('Erreur PUT tarif vente:', error);

        res.status(500).json({
            error: 'Erreur serveur'
        });
    }
});

module.exports = router;