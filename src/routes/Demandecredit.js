const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assure-toi que pool est un pg.Pool configuré

// GET modepaiements
router.get('/modepaiements', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, modes, paiementsduree FROM Modepaiements ORDER BY id');
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /modepaiements error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// GET optionsalerte
router.get('/optionsalerte', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, options, alerteduree FROM Optionsalerte ORDER BY id');
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /optionsalerte error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// POST batch insert Demandecredit (accepte un objet ou un tableau d'objets)
router.post('/demandecredit', async (req, res) => {
  const payload = req.body;
  // Accept either a single object or an array
  const demandes = Array.isArray(payload) ? payload : [payload];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inserted = [];
    for (const d of demandes) {
      // Validation minimale par enregistrement
      const {
        codedemande,
        date,
        idclients,
        codeclients,
        compteclients,
        nom,
        prenoms,
        adresse,
        contact,
        idarticle,
        article,
        idmodepaiements,
        paiementsduree,
        capital,
        taux,
        autrescommission,
        fraisoperateur,
        idoptionsalerte,
        alerteduree,
        dureetotal,
        iduser,
        idagence,
        datevalidation,
        coutachat,
        commission,
        avoircaution
      } = d;

      if (!codedemande || !date || !idclients || !nom || !prenoms || !idarticle || !idmodepaiements || capital == null || taux == null || compteclients == null) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Champs obligatoires manquants pour au moins une demande' });
      }

      const insertQuery = `
        INSERT INTO Demandecredit (
          codedemande, date, idclients,codeclients,compteclients, nom, prenoms,
          adresse, contact, idarticle, article,
          idmodepaiements, paiementsduree, capital, taux,
          autrescommission, fraisoperateur,
          idoptionsalerte, alerteduree,dureetotal,
          iduser, idagence, datevalidation,coutachat,commission,avoircaution
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
        )
        RETURNING *;
      `;

      const values = [
        codedemande,
        date,
        idclients,
        codeclients,
        compteclients,
        nom,
        prenoms,
        adresse || null,
        contact || null,
        idarticle,
        article || null,
        idmodepaiements,
        paiementsduree || null,
        capital,
        taux,
        autrescommission || 0,
        fraisoperateur || 0,
        idoptionsalerte || null,
        alerteduree || null,
        dureetotal  || null,
        iduser || null,
        idagence || null,
        datevalidation || null,
        coutachat,
        commission,
        avoircaution
      ];

      const { rows } = await client.query(insertQuery, values);
      inserted.push(rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Demandes insérées avec succès', data: inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /demandecredit error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;




/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Insert ou update Demandecredit
router.post('/demandecredit', async (req, res) => {
  try {
    const {
      id,
      codedemande,
      date,
      idclients,
      nom,
      prenoms,
      adresse,
      contact,
      idarticle,
      article,
      idmodepaiements,
      paiementsduree,
      capital,
      taux,
      autrescommission,
      fraisoperateur,
      idoptionsalerte,
      alerteduree,
      iduser,
      idagence,
      datevalidation
    } = req.body;

    // Vérification minimale
    if (!codedemande || !date || !idclients || !nom || !prenoms || !idarticle || !idmodepaiements || !capital || !taux) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    let query, values;

    if (id) {
      // UPDATE si id fourni
      query = `
        UPDATE Demandecredit
        SET codedemande = $1, date = $2, idclients = $3, nom = $4, prenoms = $5,
            adresse = $6, contact = $7, idarticle = $8, article = $9,
            idmodepaiements = $10, paiementsduree = $11, capital = $12, taux = $13,
            autrescommission = $14, fraisoperateur = $15,
            idoptionsalerte = $16, alerteduree = $17,
            iduser = $18, idagence = $19, datevalidation = $20
        WHERE id = $21
        RETURNING *;
      `;
      values = [
        codedemande, date, idclients, nom, prenoms,
        adresse || null, contact || null, idarticle, article || null,
        idmodepaiements, paiementsduree || null, capital, taux,
        autrescommission || null, fraisoperateur || null,
        idoptionsalerte || null, alerteduree || null,
        iduser || null, idagence || null, datevalidation || null, id
      ];
    } else {
      // INSERT sinon
      query = `
        INSERT INTO Demandecredit (
          codedemande, date, idclients, nom, prenoms,
          adresse, contact, idarticle, article,
          idmodepaiements, paiementsduree, capital, taux,
          autrescommission, fraisoperateur,
          idoptionsalerte, alerteduree,
          iduser, idagence, datevalidation
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        RETURNING *;
      `;
      values = [
        codedemande, date, idclients, nom, prenoms,
        adresse || null, contact || null, idarticle, article || null,
        idmodepaiements, paiementsduree || null, capital, taux,
        autrescommission || null, fraisoperateur || null,
        idoptionsalerte || null, alerteduree || null,
        iduser || null, idagence || null, datevalidation || null
      ];
    }

    const { rows } = await pool.query(query, values);

    res.status(201).json({
      message: id ? 'Demande de crédit mise à jour avec succès' : 'Demande de crédit insérée avec succès',
      data: rows[0]
    });

  } catch (err) {
    console.error('Erreur Demandecredit:', err.message);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
*/