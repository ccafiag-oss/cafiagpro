const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


// ===================================================
// MULTER CONFIG (PHOTO + SIGNATURE)
// ===================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subFolder = 'photo';

    if (file.fieldname === 'signature') {
      subFolder = 'signature';
    }

    const dir = path.join(
      __dirname,
      '../uploads/finance/clients',
      subFolder
    );

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },

  filename: (req, file, cb) => {
    const unique =
      Date.now() + '-' + Math.floor(Math.random() * 999999);

    cb(
      null,
      `${file.fieldname}-${unique}${path.extname(file.originalname)}`
    );
  }
});

const upload = multer({ storage });


// ===================================================
// GENERER CODE CLIENT : TGS001A00100005
// ===================================================
async function generateCodeClient(idagence, clientId) {
  const agenceRes = await pool.query(
    `SELECT codeagence FROM agence WHERE idagence = $1`,
    [idagence]
  );

  const codeagence = agenceRes.rows[0]?.codeagence || 'AGC001';

  const num = String(clientId).padStart(5, '0');

  return `${codeagence}${num}`;
}


// ===================================================
// GET CLIENTS (avec recherche + agence)
// ===================================================
router.get('/finaclients', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({
      success: false,
      message: 'idagence obligatoire'
    });
  }

  try {
    let sql = `
      SELECT *
      FROM finaclients
      WHERE idagence = $1
    `;

    const params = [idagence];

    if (search && search.trim() !== '') {
      sql += `
        AND (
          nom ILIKE $2
          OR prenom ILIKE $2
          OR telephone ILIKE $2
          OR codeclient ILIKE $2
        )
      `;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY idclient DESC`;

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      total: result.rows.length,
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
// CREATE CLIENT
// ===================================================

/*
router.post(
  '/finaclients',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
  ]),
  async (req, res) => {

    const data = req.body;

    const photo = req.files?.photo
      ? `uploads/finance/clients/photo/${req.files.photo[0].filename}`
      : null;

    const signature = req.files?.signature
      ? `uploads/finance/clients/signature/${req.files.signature[0].filename}`
      : null;

    const client = await pool.query(
      `INSERT INTO finaclients (
        idagence,
        idgest,
        nom,
        prenom,
        datenaisse,
        sexe,
        codepays,
        telephone,
        adresse,
        idpiece_identite,
        numero_piece_identite,
        idquartier,
        photo,
        signature,
        localisationdomicile,
        etat
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
      )
      RETURNING *`,
      [
        data.idagence,
        data.idgest,
        data.nom,
        data.prenom,
        data.datenaisse,
        data.sexe,
        data.codepays,
        data.telephone,
        data.adresse,
        data.idpiece_identite,
        data.numero_piece_identite,
        data.idquartier,
        photo,
        signature,
        data.localisationdomicile,
        data.etat ?? true
      ]
    );

    const idclient = client.rows[0].idclient;

    const codeclient = await generateCodeClient(
      data.idagence,
      idclient
    );

    const update = await pool.query(
      `UPDATE finaclients
       SET codeclient = $1
       WHERE idclient = $2
       RETURNING *`,
      [codeclient, idclient]
    );

    res.status(201).json({
      success: true,
      message: 'Client créé avec succès',
      data: update.rows[0]
    });
  }
);
*/
router.post(
  '/finaclients',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
  ]),
  async (req, res) => {

    const data = req.body;

    const photo = req.files?.photo
      ? `uploads/finance/clients/photo/${req.files.photo[0].filename}`
      : null;

    const signature = req.files?.signature
      ? `uploads/finance/clients/signature/${req.files.signature[0].filename}`
      : null;

    try {

      // 🔥 1. INSERT CLIENT
      const client = await pool.query(
        `INSERT INTO finaclients (
          idagence,
          idgest,
          nom,
          prenom,
          datenaisse,
          sexe,
          codepays,
          telephone,
          adresse,
          idpiece_identite,
          numero_piece_identite,
          idquartier,
          photo,
          signature,
          localisationdomicile,
          etat
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
        )
        RETURNING *`,
        [
          data.idagence,
          data.idgest,
          data.nom,
          data.prenom,
          data.datenaisse,
          data.sexe,
          data.codepays,
          data.telephone,
          data.adresse,
          data.idpiece_identite,
          data.numero_piece_identite,
          data.idquartier,
          photo,
          signature,
          data.localisationdomicile,
          data.etat ?? true
        ]
      );

      const idclient = client.rows[0].idclient;

      // 🔥 2. Génération SIMPLE du code client (SANS COMPTEUR TABLE)
      const codeagence = await pool.query(
        `SELECT codeagence FROM agence WHERE idagence = $1`,
        [data.idagence]
      );

      const codePrefix = codeagence.rows[0]?.codeagence ?? 'AGC';

      const num = String(idclient).padStart(5, '0');

      const codeclient = `${codePrefix}${num}`;

      // 🔥 3. UPDATE SIMPLE DU CODE (OPTIONNEL mais propre)
      const update = await pool.query(
        `UPDATE finaclients
         SET codeclient = $1
         WHERE idclient = $2
         RETURNING *`,
        [codeclient, idclient]
      );

      return res.status(201).json({
        success: true,
        message: 'Client créé avec succès',
        data: update.rows[0]
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
// UPDATE CLIENT
// ===================================================
router.put(
  '/finaclients/:id',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
  ]),
  async (req, res) => {

    const { id } = req.params;
    const data = req.body;

    let fields = [];
    let values = [];
    let i = 1;

    const skip = [
      'idclient',
      'codeclient',
      'numeroclient'
    ];

    Object.keys(data).forEach((key) => {
      if (data[key] && !skip.includes(key)) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    });

    if (req.files?.photo) {
      fields.push(`photo = $${i++}`);
      values.push(
        `uploads/finance/clients/photo/${req.files.photo[0].filename}`
      );
    }

    if (req.files?.signature) {
      fields.push(`signature = $${i++}`);
      values.push(
        `uploads/finance/clients/signature/${req.files.signature[0].filename}`
      );
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée'
      });
    }

    values.push(id);

    const sql = `
      UPDATE finaclients
      SET ${fields.join(', ')}
      WHERE idclient = $${i}
      RETURNING *
    `;

    const result = await pool.query(sql, values);

    res.json({
      success: true,
      message: 'Client modifié',
      data: result.rows[0]
    });
  }
);


// ===================================================
// DELETE CLIENT
// ===================================================
router.delete('/finaclients/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const old = await pool.query(
      `SELECT photo, signature FROM finaclients WHERE idclient=$1`,
      [id]
    );

    if (old.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client introuvable'
      });
    }

    await pool.query(
      `DELETE FROM finaclients WHERE idclient=$1`,
      [id]
    );

    const file1 = old.rows[0].photo;
    const file2 = old.rows[0].signature;

    if (file1) fs.unlinkSync(path.join(__dirname, '..', file1));
    if (file2) fs.unlinkSync(path.join(__dirname, '..', file2));

    res.json({
      success: true,
      message: 'Client supprimé'
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


// ===================================================
module.exports = router;