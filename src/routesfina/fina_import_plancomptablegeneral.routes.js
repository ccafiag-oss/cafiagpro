const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');

const pool = require('../config/db'); // pg Pool

const upload = multer({ dest: 'uploads/' });

// ======================================================

function clean(v) {
  return (v || '')
    .toString()
    .replace(/\uFEFF/g, '')
    .trim();
}

// ======================================================

router.post('/import-plan-comptable', upload.single('file'), async (req, res) => {

  try {

    const filePath = req.file.path;
    const idagence = parseInt(req.body.idagence);

    if (!idagence) {
      return res.status(400).json({
        success: false,
        message: 'idagence obligatoire'
      });
    }

    const results = [];
    let ok = 0;
    let err = 0;

    fs.createReadStream(filePath)
      .pipe(csv({
        separator: ';',
        mapHeaders: ({ header }) =>
          header.replace(/\uFEFF/g, '').trim().toUpperCase()
      }))
      .on('data', row => results.push(row))
      .on('end', async () => {

        console.log("IMPORT:", results.length);

        for (const item of results) {

          const idcptgen = clean(item.IDCPTGEN);
          const designationcptgen = clean(item.DESIGNATIONCPTGEN);
          const idclasse = parseInt(clean(item.IDCLASSE)) || 0;
          const sencetat = clean(item.SENCETAT) || 'AC';

          if (!idcptgen || !designationcptgen) {
            err++;
            continue;
          }

          try {

            await pool.query(
              `
              INSERT INTO tcomptegeneral
              (idcptgen, designationcptgen, idclasse, sencetat, idagence)
              VALUES ($1, $2, $3, $4, $5)
              `,
              [
                idcptgen,
                designationcptgen,
                idclasse,
                sencetat,
                idagence
              ]
            );

            ok++;

          } catch (e) {
            console.log("SQL ERROR:", e.message);
            err++;
          }
        }

        fs.unlinkSync(filePath);

        return res.json({
          success: true,
          total: results.length,
          imported: ok,
          errors: err
        });
      });

  } catch (e) {

    return res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

module.exports = router;