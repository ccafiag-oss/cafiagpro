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
    let subFolder = 'photo';

    if (file.fieldname === 'signature') {
      subFolder = 'signature';
    }

    const dir = path.join(__dirname, '../uploads/clients', subFolder);

    // créer le dossier si inexistant
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1e9);

    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  }
});

const upload = multer({ storage });


// ===============================
// GET CLIENTS
// ===============================
router.get('/gclients', async (req, res) => {
  const { idagence, recherche } = req.query;

  if (!idagence) {
    return res.status(400).json({
      error: 'Le paramètre idagence est obligatoire'
    });
  }

  let queryText =
    'SELECT * FROM gclients WHERE idagence = $1';

  const queryValues = [idagence];

  if (recherche && recherche.length >= 3) {
    queryText += `
      AND (
        nom ILIKE $2
        OR prenom ILIKE $2
        OR telephone ILIKE $2
        OR codeclients ILIKE $2
      )
    `;
    queryValues.push(`%${recherche}%`);
  }

  queryText += ' ORDER BY nom ASC';

  try {
    const { rows } = await pool.query(
      queryText,
      queryValues
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('Erreur GET /gclients:', err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


// ===============================
// AJOUT CLIENT
// ===============================
router.post(
  '/gclients',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
  ]),
  async (req, res) => {
    const data = req.body;

    const photoPath = req.files?.photo
      ? `uploads/clients/photo/${req.files.photo[0].filename}`
      : null;

    const signaturePath = req.files?.signature
      ? `uploads/clients/signature/${req.files.signature[0].filename}`
      : null;

    try {
      const query = `
        INSERT INTO gclients (
          idagence,
          idtypecl,
          nom,
          prenom,
          datenaisse,
          sexe,
          telephone,
          adresse,
          idgest,
          etat,
          photo,
          signature,
          codeagence,
          localisationdomicile,
          comptegeneral
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
        )
        RETURNING *
      `;

      const values = [
        data.idagence,
        data.idtypecl || null,
        data.nom,
        data.prenom,
        data.datenaisse,
        data.sexe,
        data.telephone,
        data.adresse,
        data.idgest,
        data.etat ?? true,
        photoPath,
        signaturePath,
        data.codeagence,
        data.localisationdomicile || null,
        data.comptegeneral || '41110'
      ];

      const { rows } = await pool.query(query, values);

      res.status(201).json({
        success: true,
        message: 'Client ajouté avec succès',
        data: rows[0]
      });
    } catch (err) {
      console.error('Erreur POST /gclients:', err);

      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
);


// ===============================
// MODIFIER CLIENT
// ===============================
router.put(
  '/gclients/:id',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
  ]),
  async (req, res) => {
    const { id } = req.params;
    const data = req.body;

    const fields = [];
    const values = [];
    let index = 1;

    // champs interdits car auto générés
    const forbiddenFields = [
      'idclients',
      'numeroclient',
      'codeclients',
      'compteauxiliaire'
    ];

    // ajout dynamique champs texte
    Object.keys(data).forEach((key) => {
      if (
        data[key] !== undefined &&
        !forbiddenFields.includes(key)
      ) {
        fields.push(`${key} = $${index++}`);
        values.push(data[key]);
      }
    });

    // photo
    if (req.files?.photo) {
      fields.push(`photo = $${index++}`);
      values.push(
        `uploads/clients/photo/${req.files.photo[0].filename}`
      );
    }

    // signature
    if (req.files?.signature) {
      fields.push(`signature = $${index++}`);
      values.push(
        `uploads/clients/signature/${req.files.signature[0].filename}`
      );
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucun champ à modifier'
      });
    }

    values.push(id);

    const query = `
      UPDATE gclients
      SET ${fields.join(', ')}
      WHERE idclients = $${index}
      RETURNING *
    `;

    try {
      const { rowCount, rows } = await pool.query(
        query,
        values
      );

      if (rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Client non trouvé'
        });
      }

      res.json({
        success: true,
        message: 'Client modifié avec succès',
        data: rows[0]
      });
    } catch (err) {
      console.error('Erreur PUT /gclients/:id:', err);

      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
);






router.delete('/gclients/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. récupérer les chemins fichiers avant suppression
    const clientResult = await pool.query(
      `SELECT photo, signature
       FROM gclients
       WHERE idclients = $1`,
      [id]
    );

    if (clientResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Client non trouvé'
      });
    }

    const client = clientResult.rows[0];

    // 2. supprimer en base
    const deleteResult = await pool.query(
      `DELETE FROM gclients
       WHERE idclients = $1
       RETURNING *`,
      [id]
    );

    // 3. supprimer photo
    if (client.photo) {
      const photoFile = path.join(
        __dirname,
        '../src',
        client.photo
      );

      if (fs.existsSync(photoFile)) {
        fs.unlinkSync(photoFile);
      }
    }

    // 4. supprimer signature
    if (client.signature) {
      const signatureFile = path.join(
        __dirname,
        '../src',
        client.signature
      );

      if (fs.existsSync(signatureFile)) {
        fs.unlinkSync(signatureFile);
      }
    }

    res.json({
      success: true,
      message: 'Client supprimé avec succès',
      data: deleteResult.rows[0]
    });

  } catch (err) {
    console.error('Erreur DELETE /gclients/:id:', err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});



///   OUVERTURE  COMPTES  TIERS








router.post('/crercomptetierscompta', async (req, res) => {
  const dataArray = Array.isArray(req.body) ? req.body : [req.body];
  let totalLignes = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const data of dataArray) {
      if (!data.COMPTEGENERAL || !data.CODETIERS) continue;

      // Calcul idclasse
      const idclasse = parseInt(data.COMPTEGENERAL.charAt(0), 10);

      // Génération du code interne
      const formattedCompte = (data.COMPTEGENERAL + '00000').substring(0, 5);
      const newCodeInterne = formattedCompte + data.CODETIERS;

      const query = `
        INSERT INTO tcomptegeninter (
          idcptintern,
          date,
          idcptgen,
          designationcptint,
          idclasse,
          codetiers,
          nomtiers,
          idcptinternsage,
          idag,
          idagence,
          codeagence,
          source,
          idprod,
          idtiers
        )
        VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const values = [
        newCodeInterne,               // $1
        data.COMPTEGENERAL,           // $2
        data.NOMTIERS || '',          // $3
        idclasse,                     // $4
        data.CODETIERS,               // $5
        data.NOMTIERS || '',          // $6
        data.COMPTEGENLIEE || '',     // $7
        data.IDAG,                    // $8
        data.IDAGENCE,                // $9
        data.CODEAGENCE,              // $10
        data.source || null,          // $11
        data.IDPROD || null,          // $12
        data.IDTIERS || null          // $13
      ];

      await client.query(query, values);
      totalLignes++;
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Comptes tiers ajoutés avec succès',
      totalLignes
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur POST /comptetiers:', err);

    // Détection du doublon PostgreSQL (Code 23505 = Unique Violation)
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: "Un ou plusieurs comptes tiers de cette sélection existent déjà."
      });
    }

    res.status(500).json({
      success: false,
      error: err.message
    });
  } finally {
    client.release();
  }
});


/*
router.post('/crercomptetierscompta', async (req, res) => {
  const dataArray = Array.isArray(req.body) ? req.body : [req.body];
  let totalLignes = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const data of dataArray) {
      if (!data.COMPTEGENERAL || !data.CODETIERS) continue;

      // Calcul idclasse
      const idclasse = parseInt(data.COMPTEGENERAL.charAt(0), 10);

      // Génération du code interne
      const formattedCompte = (data.COMPTEGENERAL + '00000').substring(0, 5);
      const newCodeInterne = formattedCompte + data.CODETIERS;

      const query = `
        INSERT INTO tcomptegeninter (
          idcptintern,
          date,
          idcptgen,
          designationcptint,
          idclasse,
          codetiers,
          nomtiers,
          idcptinternsage,
          idag,
          idagence,
          codeagence,
          source,
          idprod,
          idtiers
        )
        VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const values = [
        newCodeInterne,               // $1
        data.COMPTEGENERAL,           // $2
        data.NOMTIERS || '',       // $3
        idclasse,                     // $4
        data.CODETIERS,               // $5
        data.NOMTIERS || '',          // $6
        data.COMPTEGENLIEE || '',     // $7
        data.IDAG,                    // $8
        data.IDAGENCE,                // $9
        data.CODEAGENCE,              // $10
        data.source || null,          // $11
        data.IDPROD || null,          // $12
        data.IDTIERS || null          // $13
      ];

      await client.query(query, values);
      totalLignes++;
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Comptes tiers ajoutés avec succès',
      totalLignes
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur POST /comptetiers:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  } finally {
    client.release();
  }
});

*/









// ===============================
// EXPORT
// ===============================
module.exports = router;