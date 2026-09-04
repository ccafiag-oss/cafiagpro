const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Récupérer toutes les sous catégories d'une agence
router.get('/gsouscategorie', async (req, res) => {
  try {
    const { idagence } = req.query; // correction ici
    if (!idagence) {
      return res.status(400).json({ message: 'Agence non spécifiée' });
    }
    const { rows } = await pool.query(
      'SELECT * FROM gsouscategorie WHERE idagence=$1 ORDER BY idsouscategorie',
      [idagence]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /gsouscategorie error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});
// Ajouter une nouvelle sous-catégorie
router.post('/gsouscategorie', async (req, res) => {
  const {
    idagence,
    idcategorie,
    designation,
    comptegenachat,
    comptegenvente,
    comptegenstock,
    comptegenvrstock,
    taxe1,
    taxe2,
    taxe3,
    taxe4,
    comptetaxe1,
    comptetaxe2,
    comptetaxe3,
    comptetaxe4,
    comptetaxe5,
    comptetaxe6,
    comptetaxe7,
    compte_vente_embalage,
    compte_achat_embalage,
    comptaembalage_taxe1,
    comptegen_ecar_invent_surplus,
    comptegen_ecar_invent_manquant,
    idjrnalachat,
    idjrnalvente
  } = req.body;

  // Vérification obligatoire
  if (!idagence || !idcategorie || !designation) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO gsouscategorie (
        idagence, idcategorie, designation, comptegenachat, comptegenvente, comptegenstock, comptegenvrstock,
        taxe1, taxe2, taxe3, taxe4,
        comptetaxe1, comptetaxe2, comptetaxe3, comptetaxe4, comptetaxe5, comptetaxe6, comptetaxe7,
        compte_vente_embalage, compte_achat_embalage, comptaembalage_taxe1,
        comptegen_ecar_invent_surplus, comptegen_ecar_invent_manquant,idjrnalachat,idjrnalvente
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21,
        $22, $23,$24,$25
      ) RETURNING *`,
      [
        idagence, idcategorie, designation, comptegenachat, comptegenvente, comptegenstock, comptegenvrstock,
        taxe1, taxe2, taxe3, taxe4,
        comptetaxe1, comptetaxe2, comptetaxe3, comptetaxe4, comptetaxe5, comptetaxe6, comptetaxe7,
        compte_vente_embalage, compte_achat_embalage, comptaembalage_taxe1,
        comptegen_ecar_invent_surplus, comptegen_ecar_invent_manquant,idjrnalachat,idjrnalvente
      ]
    );
    res.status(201).json({ message: 'Sous-catégorie ajoutée', data: rows[0] });
  } catch (err) {
    console.error('POST /gsouscategorie error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Modifier une sous-catégorie
// Modifier une sous-catégorie
router.put('/gsouscategorie/:idsouscategorie', async (req, res) => {
  const { idsouscategorie } = req.params;
  const {
    idagence,
    idcategorie,
    designation,
    comptegenachat,
    comptegenvente,
    comptegenstock,
    comptegenvrstock,
    taxe1,
    taxe2,
    taxe3,
    taxe4,
    comptetaxe1,
    comptetaxe2,
    comptetaxe3,
    comptetaxe4,
    comptetaxe5,
    comptetaxe6,
    comptetaxe7,
    compte_vente_embalage,
    compte_achat_embalage,
    comptaembalage_taxe1,
    comptegen_ecar_invent_surplus,
    comptegen_ecar_invent_manquant,
    idjrnalachat,
    idjrnalvente
  } = req.body;

  try {
    const query = `
      UPDATE gsouscategorie 
      SET 
        idagence = $1, 
        idcategorie = $2, 
        designation = $3, 
        comptegenachat = $4, 
        comptegenvente = $5, 
        comptegenstock = $6, 
        comptegenvrstock = $7,
        taxe1 = $8, 
        taxe2 = $9, 
        taxe3 = $10, 
        taxe4 = $11,
        comptetaxe1 = $12, 
        comptetaxe2 = $13, 
        comptetaxe3 = $14, 
        comptetaxe4 = $15, 
        comptetaxe5 = $16, 
        comptetaxe6 = $17, 
        comptetaxe7 = $18,
        compte_vente_embalage = $19, 
        compte_achat_embalage = $20, 
        comptaembalage_taxe1 = $21,
        comptegen_ecar_invent_surplus = $22, 
        comptegen_ecar_invent_manquant = $23,
        idjrnalachat = $24, 
        idjrnalvente = $25

      WHERE idsouscategorie = $26
      RETURNING *`;

    const values = [
      idagence, idcategorie, designation, comptegenachat, comptegenvente, comptegenstock, comptegenvrstock,
      taxe1, taxe2, taxe3, taxe4,
      comptetaxe1, comptetaxe2, comptetaxe3, comptetaxe4, comptetaxe5, comptetaxe6, comptetaxe7,
      compte_vente_embalage, compte_achat_embalage, comptaembalage_taxe1,
      comptegen_ecar_invent_surplus, comptegen_ecar_invent_manquant,idjrnalachat,idjrnalvente,
      idsouscategorie // Le 24ème paramètre pour le WHERE
    ];

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Sous-catégorie non trouvée" });
    }

    res.json({ message: 'Sous-catégorie mise à jour avec succès', data: rows[0] });
  } catch (err) {
    console.error('PUT /gsouscategorie error:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour', details: err.message });
  }
});

// Supprimer une sous-catégorie
router.delete('/gsouscategorie/:idsouscategorie', async (req, res) => {
  const { idsouscategorie } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM gsouscategorie WHERE idsouscategorie=$1', [idsouscategorie]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Sous-catégorie non trouvée' });
    }
    res.json({ message: 'Sous-catégorie supprimée' });
  } catch (err) {
    console.error('DELETE /gsouscategorie/:idsouscategorie error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;