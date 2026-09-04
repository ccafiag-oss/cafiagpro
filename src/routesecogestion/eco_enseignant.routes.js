const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ===================================================
// CONFIGURATION DE MULTER POUR ENSEIGNANT
// ===================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subFolder = 'photo';
    if (file.fieldname === 'signature') {
      subFolder = 'signature';
    }

    const dir = path.join(
      __dirname,
      '../uploads/eco/enseignants',
      subFolder
    );

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },

  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.floor(Math.random() * 999999);
    cb(
      null,
      `${file.fieldname}-${unique}${path.extname(file.originalname)}`
    );
  }
});

const upload = multer({ storage });

// ===================================================
// 🔵 1. GET ENSEIGNANTS (avec recherche + agence)
// ===================================================
router.get('/enseignant', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({
      success: false,
      message: 'idagence obligatoire'
    });
  }

  try {
    let sql = `
SELECT e.*, CONCAT(u.nom, ' ', u.prenom) AS nom_utilisateur_lie
FROM eco_enseignant e
INNER JOIN utilisateur u ON e.iduser = u.iduser
WHERE e.idagence  = $1
    `;

    const params = [idagence];

    if (search && search.trim() !== '') {
      sql += ` AND (e.nomcomplet ILIKE $2 OR e.telephone ILIKE $2)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY e.idenseignant DESC`;

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ===================================================
// 🟢 2. ENREGISTRER UN ENSEIGNANT
// ===================================================
router.post(
  '/enseignant',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const data = req.body;

      const photo = req.files?.photo
        ? `uploads/eco/enseignants/photo/${req.files.photo[0].filename}`
        : null;

      const signature = req.files?.signature
        ? `uploads/eco/enseignants/signature/${req.files.signature[0].filename}`
        : null;

      const result = await pool.query(
        `INSERT INTO eco_enseignant (
          idagence,
          nomcomplet,
          adresse,
          telephone,
          iduser,
          photo,
          signature,
          honoraire,
          duree,
          etat
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          data.idagence,
          data.nomcomplet,
          data.adresse || null,
          data.telephone || null,
          data.iduser ? parseInt(data.iduser) : null,
          photo,
          signature,
          data.honoraire ? parseFloat(data.honoraire) : 0.00,
          data.duree ? parseFloat(data.duree) : 0.00,
          data.etat === 'false' ? false : true
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Enseignant créé avec succès',
        data: result.rows[0]
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// ===================================================
// 🟡 3. MODIFIER UN ENSEIGNANT
// ===================================================
router.put(
  '/enseignant/:id',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
  ]),
  async (req, res) => {
    const { id } = req.params;
    const data = req.body;

    try {
      let fields = [];
      let values = [];
      let i = 1;

      const skip = ['idenseignant', 'idagence'];

      Object.keys(data).forEach((key) => {
        if (data[key] !== undefined && !skip.includes(key)) {
          fields.push(`${key} = $${i++}`);
          if (key === 'iduser') {
            values.push(data[key] ? parseInt(data[key]) : null);
          } else if (key === 'honoraire' || key === 'duree') {
            values.push(parseFloat(data[key]));
          } else if (key === 'etat') {
            values.push(data[key] === 'true' || data[key] === true);
          } else {
            values.push(data[key]);
          }
        }
      });

      if (req.files?.photo) {
        fields.push(`photo = $${i++}`);
        values.push(`uploads/eco/enseignants/photo/${req.files.photo[0].filename}`);
      }

      if (req.files?.signature) {
        fields.push(`signature = $${i++}`);
        values.push(`uploads/eco/enseignants/signature/${req.files.signature[0].filename}`);
      }

      if (fields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Aucune donnée modifiée'
        });
      }

      values.push(id);

      const sql = `
        UPDATE eco_enseignant
        SET ${fields.join(', ')}
        WHERE idenseignant = $${i}
        RETURNING *
      `;

      const result = await pool.query(sql, values);

      res.json({
        success: true,
        message: 'Enseignant modifié',
        data: result.rows[0]
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// ===================================================
// 🔴 4. SUPPRIMER UN ENSEIGNANT
// ===================================================
router.delete('/enseignant/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const old = await pool.query(
      `SELECT photo, signature FROM eco_enseignant WHERE idenseignant=$1`,
      [id]
    );

    if (old.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Enseignant introuvable'
      });
    }

    await pool.query(
      `DELETE FROM eco_enseignant WHERE idenseignant=$1`,
      [id]
    );

    const filePhoto = old.rows[0].photo;
    const fileSig = old.rows[0].signature;

    if (filePhoto) {
      const fullPath = path.join(__dirname, '..', filePhoto);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    if (fileSig) {
      const fullPath = path.join(__dirname, '..', fileSig);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    res.json({
      success: true,
      message: 'Enseignant supprimé avec succès'
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;