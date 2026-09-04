const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ===============================
// CONFIGURATION MULTER
// ===============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/fournisseurs/photo');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

// ===============================
// GET FOURNISSEURS
// ===============================
router.get('/gfournisseur', async (req, res) => {
  const { idagence, recherche } = req.query;

  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre idagence est obligatoire' });
  }

  let queryText = 'SELECT * FROM gfournisseur WHERE idagence = $1';
  const queryValues = [idagence];

  if (recherche && recherche.length >= 3) {
    queryText += `
      AND (
        nomcomplet ILIKE $2
        OR telephone ILIKE $2
        OR codefournisseurs ILIKE $2
      )
    `;
    queryValues.push(`%${recherche}%`);
  }

  queryText += ' ORDER BY nomcomplet ASC';

  try {
    const { rows } = await pool.query(queryText, queryValues);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erreur GET /gfournisseur:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===============================
// AJOUT FOURNISSEUR
// ===============================
router.post(
  '/gfournisseur',
  upload.single('photo'),
  async (req, res) => {
    const data = req.body;

    const photoPath = req.file
      ? `uploads/fournisseurs/photo/${req.file.filename}`
      : null;

    try {
      const query = `
        INSERT INTO gfournisseur (
          idagence,
          nomcomplet,
          adresse,
          telephone,
          idcpt,
          solde,
          photo,
          idtypefr,
          comptegeneral,
          idcooperative,
          sexe,
          datenaissance
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        )
        RETURNING *
      `;

      // Gestion de la date de naissance optionnelle
      const dateNaissanceVal = data.datenaissance && data.datenaissance.trim() !== '' 
        ? data.datenaissance 
        : null;

      const values = [
        data.idagence,
        data.nomcomplet,
        data.adresse,
        data.telephone,
        data.idcpt,
        data.solde || 0,
        photoPath,
        data.idtypefr || null,
        data.comptegeneral || '40100',
        data.idcooperative ? parseInt(data.idcooperative, 10) : null,
        data.sexe || null,
        dateNaissanceVal
      ];

      const { rows } = await pool.query(query, values);

      res.status(201).json({
        success: true,
        message: 'Fournisseur ajouté avec succès',
        data: rows[0]
      });
    } catch (err) {
      console.error('Erreur POST /gfournisseur:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ===============================
// MODIFIER FOURNISSEUR
// ===============================
router.put(
  '/gfournisseur/:id',
  upload.single('photo'),
  async (req, res) => {
    const { id } = req.params;
    const data = req.body;

    const fields = [];
    const values = [];
    let index = 1;

    const forbiddenFields = ['idfourn', 'numerofournisseur', 'codefournisseurs', 'compteauxiliaire'];

    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && !forbiddenFields.includes(key)) {
        fields.push(`${key} = $${index++}`);
        // Normalisation de la date de naissance vide en NULL
        if (key === 'datenaissance' && (!data[key] || data[key].trim() === '')) {
          values.push(null);
        } else {
          values.push(data[key]);
        }
      }
    });

    if (req.file) {
      fields.push(`photo = $${index++}`);
      values.push(`uploads/fournisseurs/photo/${req.file.filename}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun champ à modifier' });
    }

    values.push(id);

    const query = `
      UPDATE gfournisseur
      SET ${fields.join(', ')}
      WHERE idfourn = $${index}
      RETURNING *
    `;

    try {
      const { rowCount, rows } = await pool.query(query, values);

      if (rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Fournisseur non trouvé' });
      }

      res.json({ success: true, message: 'Fournisseur modifié avec succès', data: rows[0] });
    } catch (err) {
      console.error('Erreur PUT /gfournisseur/:id:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ===============================
// SUPPRIMER FOURNISSEUR
// ===============================
router.delete('/gfournisseur/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const fournisseurResult = await pool.query(
      `SELECT photo FROM gfournisseur WHERE idfourn = $1`,
      [id]
    );

    if (fournisseurResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Fournisseur non trouvé' });
    }

    const fournisseur = fournisseurResult.rows[0];

    const deleteResult = await pool.query(
      `DELETE FROM gfournisseur WHERE idfourn = $1 RETURNING *`,
      [id]
    );

    if (fournisseur.photo) {
      const photoFile = path.join(__dirname, '../src', fournisseur.photo);
      if (fs.existsSync(photoFile)) {
        fs.unlinkSync(photoFile);
      }
    }

    res.json({ success: true, message: 'Fournisseur supprimé avec succès', data: deleteResult.rows[0] });
  } catch (err) {
    console.error('Erreur DELETE /gfournisseur/:id:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;




/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ===============================
// CONFIGURATION MULTER
// ===============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/fournisseurs/photo');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

// ===============================
// GET FOURNISSEURS
// ===============================
router.get('/gfournisseur', async (req, res) => {
  const { idagence, recherche } = req.query;

  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre idagence est obligatoire' });
  }

  let queryText = 'SELECT * FROM gfournisseur WHERE idagence = $1';
  const queryValues = [idagence];

  if (recherche && recherche.length >= 3) {
    queryText += `
      AND (
        nomcomplet ILIKE $2
        OR telephone ILIKE $2
        OR codefournisseurs ILIKE $2
      )
    `;
    queryValues.push(`%${recherche}%`);
  }

  queryText += ' ORDER BY nomcomplet ASC';

  try {
    const { rows } = await pool.query(queryText, queryValues);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erreur GET /gfournisseur:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===============================
// AJOUT FOURNISSEUR
// ===============================
router.post(
  '/gfournisseur',
  upload.single('photo'),
  async (req, res) => {
    const data = req.body;

    const photoPath = req.file
      ? `uploads/fournisseurs/photo/${req.file.filename}`
      : null;

    try {
      const query = `
        INSERT INTO gfournisseur (
          idagence,
          nomcomplet,
          adresse,
          telephone,
          idcpt,
          solde,
          photo,
          idtypefr,
          comptegeneral,
          idcooperative
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )
        RETURNING *
      `;

      const values = [
        data.idagence,
        data.nomcomplet,
        data.adresse,
        data.telephone,
        data.idcpt,
        data.solde || 0,
        photoPath,
        data.idtypefr || null,
        data.comptegeneral || '40100',
        data.idcooperative ? parseInt(data.idcooperative, 10) : null

      ];

      const { rows } = await pool.query(query, values);

      res.status(201).json({
        success: true,
        message: 'Fournisseur ajouté avec succès',
        data: rows[0]
      });
    } catch (err) {
      console.error('Erreur POST /gfournisseur:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ===============================
// MODIFIER FOURNISSEUR
// ===============================
router.put(
  '/gfournisseur/:id',
  upload.single('photo'),
  async (req, res) => {
    const { id } = req.params;
    const data = req.body;

    const fields = [];
    const values = [];
    let index = 1;

    const forbiddenFields = ['idfourn', 'numerofournisseur', 'codefournisseurs', 'compteauxiliaire'];

    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && !forbiddenFields.includes(key)) {
        fields.push(`${key} = $${index++}`);
        values.push(data[key]);
      }
    });

    if (req.file) {
      fields.push(`photo = $${index++}`);
      values.push(`uploads/fournisseurs/photo/${req.file.filename}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun champ à modifier' });
    }

    values.push(id);

    const query = `
      UPDATE gfournisseur
      SET ${fields.join(', ')}
      WHERE idfourn = $${index}
      RETURNING *
    `;

    try {
      const { rowCount, rows } = await pool.query(query, values);

      if (rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Fournisseur non trouvé' });
      }

      res.json({ success: true, message: 'Fournisseur modifié avec succès', data: rows[0] });
    } catch (err) {
      console.error('Erreur PUT /gfournisseur/:id:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ===============================
// SUPPRIMER FOURNISSEUR
// ===============================
router.delete('/gfournisseur/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const fournisseurResult = await pool.query(
      `SELECT photo FROM gfournisseur WHERE idfourn = $1`,
      [id]
    );

    if (fournisseurResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Fournisseur non trouvé' });
    }

    const fournisseur = fournisseurResult.rows[0];

    const deleteResult = await pool.query(
      `DELETE FROM gfournisseur WHERE idfourn = $1 RETURNING *`,
      [id]
    );

    if (fournisseur.photo) {
      const photoFile = path.join(__dirname, '../src', fournisseur.photo);
      if (fs.existsSync(photoFile)) {
        fs.unlinkSync(photoFile);
      }
    }

    res.json({ success: true, message: 'Fournisseur supprimé avec succès', data: deleteResult.rows[0] });
  } catch (err) {
    console.error('Erreur DELETE /gfournisseur/:id:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===============================
// EXPORT
// ===============================
module.exports = router;
*/