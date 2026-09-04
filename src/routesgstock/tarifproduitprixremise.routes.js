const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // ⚡ Connexion PostgreSQL

// ➡️ Afficher toutes les remises d'une agence
// ➡️ Afficher les remises d'une agence avec recherche dynamique
router.get('/tarifproduitprixremise/:idagence', async (req, res) => {
  const { idagence } = req.params;
  const { search } = req.query; // ⚡ paramètre de recherche

  try {
    let query = 'SELECT * FROM ttarifproduitprixremise WHERE idagence = $1';
    const values = [idagence];

    // ⚡ Si search fourni et >= 3 caractères, ajouter filtre sur designation
    if (search && search.length >= 3) {
      query += ` AND designation ILIKE $2`;
      values.push(`%${search}%`);
    }

    const { rows } = await pool.query(query, values);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /tarifproduitprixremise:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// ➡️ Ajouter une remise pour une agence
router.post('/tarifproduitprixremise/:idagence', async (req, res) => {
  const { idagence } = req.params;
  const {
    idarticle,designation, idsouscategorie, idunite, libelle,
    qtemin_remise, qtemax_remise, montant_remise_par_unite,
    taux_remise, idtypecl, types_remise, cumul_par_categorie,
    actif, datedebut, datefin
  } = req.body;

  if (!idunite) {
    return res.status(400).json({ error: 'Champ obligatoire manquant (idunite)' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO ttarifproduitprixremise (
        idagence, idarticle,designation, idsouscategorie, idunite, libelle,
        qtemin_remise, qtemax_remise, montant_remise_par_unite,
        taux_remise, idtypecl, types_remise, cumul_par_categorie,
        actif, datedebut, datefin
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
      ) RETURNING *`,
      [
        idagence, idarticle || null,designation|| null, idsouscategorie || null, idunite,
        libelle || null, qtemin_remise || 0, qtemax_remise || null,
        montant_remise_par_unite || 0, taux_remise || 0, idtypecl || null,
        types_remise || 'montant', cumul_par_categorie ?? false,
        actif ?? true, datedebut || new Date(), datefin || null
      ]
    );
    res.status(201).json({ message: 'Remise ajoutée', data: result.rows[0] });
  } catch (err) {
    console.error('Erreur POST /tarifproduitprixremise:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ➡️ Modifier une remise d’une agence
router.put('/tarifproduitprixremise/:idagence/:id', async (req, res) => {
  const { idagence, id } = req.params;
  const fields = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(req.body)) {
    fields.push(`${key} = $${index++}`);
    values.push(value);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  values.push(idagence);
  values.push(id);

  const query = `UPDATE ttarifproduitprixremise 
                 SET ${fields.join(', ')} 
                 WHERE idagence = $${index++} AND idtarpro = $${index} 
                 RETURNING *`;

  try {
    const { rows, rowCount } = await pool.query(query, values);
    if (rowCount === 0) return res.status(404).json({ error: 'Remise non trouvée' });
    res.json({ message: 'Remise modifiée', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /tarifproduitprixremise:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ➡️ Supprimer une remise d’une agence
router.delete('/tarifproduitprixremise/:idagence/:id', async (req, res) => {
  const { idagence, id } = req.params;
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM ttarifproduitprixremise WHERE idagence = $1 AND idtarpro = $2',
      [idagence, id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Remise non trouvée' });
    res.json({ message: 'Remise supprimée' });
  } catch (err) {
    console.error('Erreur DELETE /tarifproduitprixremise:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
