const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ===================================================
// CONFIGURATION DE MULTER POUR ÉLÈVE (PHOTO + SIGNATURE)
// ===================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subFolder = 'photo';
    if (file.fieldname === 'signature') {
      subFolder = 'signature';
    }

    const dir = path.join(
      __dirname,
      '../uploads/eco/eleves',
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
// 🔵 1. GET ÉLÈVES (avec jointures + recherche)
// ===================================================
router.get('/eleve', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({ success: false, message: 'idagence obligatoire' });
  }

  try {
    let sql = `
      SELECT 
        e.*,
        n.libellenationalite AS nom_nationalite,
        v.libelleville AS nom_ville,
        q.libellequartier AS nom_quartier
      FROM eco_eleve e
      LEFT JOIN eco_nationalite n ON e.idnationalite = n.idnationalite
      LEFT JOIN eco_ville v ON e.idville = v.idville
      LEFT JOIN eco_quartier q ON e.idquartier = q.idquartier
      WHERE e.idagence = $1
    `;

    const params = [idagence];

    if (search && search.trim() !== '') {
      sql += ` AND (e.nom ILIKE $2 OR e.prenom ILIKE $2 OR e.codeeleve ILIKE $2 OR e.matricule ILIKE $2)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY e.ideleve DESC`;

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===================================================
// 🟢 2. ENREGISTRER UN ÉLÈVE (Génération Code Unique)
// ===================================================
router.post(
  '/eleve',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
  ]),
  async (req, res) => {
    const data = req.body;

    const photo = req.files?.photo
      ? `uploads/eco/eleves/photo/${req.files.photo[0].filename}`
      : null;

    const signature = req.files?.signature
      ? `uploads/eco/eleves/signature/${req.files.signature[0].filename}`
      : null;

    try {
      // 1. Insertion primaire de l'élève (génération de l'ID primaire d'abord)
      const result = await pool.query(
        `INSERT INTO eco_eleve (
          codeeleve, idagence, matricule, nom, prenom, datenaissance, lieunaissance,
          idsexe, idnationalite, idville, idquartier, adresse, telephone,
          tuteurnom, tuteuradresse, etablissementprovenance, photo, signature
        )
        VALUES ('TEMP_CODE', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *`,
        [
          data.idagence,
          data.matricule || null,
          data.nom.trim().toUpperCase(),
          data.prenom.trim(),
          data.datenaissance || null,
          data.lieunaissance || null,
          data.idsexe ? parseInt(data.idsexe) : null,
          data.idnationalite ? parseInt(data.idnationalite) : null,
          data.idville ? parseInt(data.idville) : null,
          data.idquartier ? parseInt(data.idquartier) : null,
          data.adresse || null,
          data.telephone || null,
          data.tuteurnom || null,
          data.tuteuradresse || null,
          data.etablissementprovenance || null,
          photo,
          signature
        ]
      );

      const ideleve = result.rows[0].ideleve;

      // 2. Récupération du préfixe d'agence pour générer un code unique (ex: AGC00021)
      const agenceRes = await pool.query(
        `SELECT codeagence FROM agence WHERE idagence = $1`,
        [data.idagence]
      );
      const prefix = agenceRes.rows[0]?.codeagence ?? 'ELV';
      const codeeleve = `${prefix}${String(ideleve).padStart(5, '0')}`;

      // 3. Mise à jour de l'élève avec son code définitif
      const finalResult = await pool.query(
        `UPDATE eco_eleve SET codeeleve = $1 WHERE ideleve = $2 RETURNING *`,
        [codeeleve, ideleve]
      );

      res.status(201).json({
        success: true,
        message: 'Élève enregistré avec succès',
        data: finalResult.rows[0]
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ===================================================
// 🟡 3. MODIFIER UN ÉLÈVE
// ===================================================
router.put(
  '/eleve/:id',
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

      const skip = ['ideleve', 'idagence', 'codeeleve'];

      Object.keys(data).forEach((key) => {
        if (data[key] !== undefined && !skip.includes(key)) {
          fields.push(`${key} = $${i++}`);
          if (['idsexe', 'idnationalite', 'idville', 'idquartier'].includes(key)) {
            values.push(data[key] ? parseInt(data[key]) : null);
          } else {
            values.push(data[key]);
          }
        }
      });

      if (req.files?.photo) {
        fields.push(`photo = $${i++}`);
        values.push(`uploads/eco/eleves/photo/${req.files.photo[0].filename}`);
      }

      if (req.files?.signature) {
        fields.push(`signature = $${i++}`);
        values.push(`uploads/eco/eleves/signature/${req.files.signature[0].filename}`);
      }

      if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'Aucune donnée modifiée' });
      }

      values.push(id);

      const sql = `
        UPDATE eco_eleve
        SET ${fields.join(', ')}
        WHERE ideleve = $${i}
        RETURNING *
      `;

      const result = await pool.query(sql, values);

      res.json({
        success: true,
        message: 'Fiche élève modifiée avec succès',
        data: result.rows[0]
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ===================================================
// 🔴 4. SUPPRIMER UN ÉLÈVE
// ===================================================
router.delete('/eleve/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const old = await pool.query(
      `SELECT photo, signature FROM eco_eleve WHERE ideleve=$1`,
      [id]
    );

    if (old.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Élève introuvable' });
    }

    await pool.query(`DELETE FROM eco_eleve WHERE ideleve=$1`, [id]);

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

    res.json({ success: true, message: 'Fiche élève supprimée définitivement' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;