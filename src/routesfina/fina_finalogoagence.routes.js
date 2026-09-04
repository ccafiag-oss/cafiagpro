const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ===================================================
// MULTER CONFIG (LOGO + AUTRESLOGO + SIGNATURE + TAMPON)
// ===================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subFolder = 'logo';

    if (file.fieldname === 'autreslogo') {
      subFolder = 'autreslogo';
    }

    if (file.fieldname === 'signature') {
      subFolder = 'signature';
    }

    if (file.fieldname === 'tampon') {
      subFolder = 'tampon';
    }

    const dir = path.join(
      __dirname,
      '../uploads/finance/agence/logo',
      subFolder
    );

    // Créer le dossier s'il n'existe pas
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
// ENREGISTRER / MODIFIER LOGO AGENCE
// ===================================================
router.post(
  '/logoagence-ajouter',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'autreslogo', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
    { name: 'tampon', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        idagence,
        codeagence,
        raisonsocial,
        adresse,
        ville,
        infos,
        activite,
        responsable,
        telephone,
        sigle,
        ministere,
        republique,
        devise,
        agrement
      } = req.body;

      const logo = req.files?.logo?.[0]?.filename || null;
      const autreslogo = req.files?.autreslogo?.[0]?.filename || null;
      const signature = req.files?.signature?.[0]?.filename || null;
      const tampon = req.files?.tampon?.[0]?.filename || null;

      // Requête SQL mise à jour avec la colonne ville bien positionnée
      const query = `
        INSERT INTO finalogoagence (
          idagence, codeagence, raisonsocial, adresse, ville,infos,
          activite, responsable, telephone, 
          logo, autreslogo, signature, tampon,
          sigle, ministere, republique, devise, agrement
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,$18)
        ON CONFLICT (idagence) 
        DO UPDATE SET
          codeagence = EXCLUDED.codeagence,
          raisonsocial = EXCLUDED.raisonsocial,
          adresse = EXCLUDED.adresse,
          ville = EXCLUDED.ville,
          infos = EXCLUDED.infos,
          activite = EXCLUDED.activite,
          responsable = EXCLUDED.responsable,
          telephone = EXCLUDED.telephone,
          logo = COALESCE(EXCLUDED.logo, finalogoagence.logo),
          autreslogo = COALESCE(EXCLUDED.autreslogo, finalogoagence.autreslogo),
          signature = COALESCE(EXCLUDED.signature, finalogoagence.signature),
          tampon = COALESCE(EXCLUDED.tampon, finalogoagence.tampon),
          sigle = EXCLUDED.sigle,
          ministere = EXCLUDED.ministere,
          republique = EXCLUDED.republique,
          devise = EXCLUDED.devise,
          agrement = EXCLUDED.agrement
        RETURNING *
      `;

      // Ordre strict des variables correspondant aux index $1 à $17
      const values = [
        idagence, 
        codeagence, 
        raisonsocial, 
        adresse, 
        ville || null,
        infos || null,
        activite, 
        responsable, 
        telephone,
        logo, 
        autreslogo, 
        signature, 
        tampon,
        sigle, 
        ministere, 
        republique, 
        devise, 
        agrement
      ];

      const result = await pool.query(query, values);

      res.status(201).json({
        success: true,
        message: 'Données enregistrées/mises à jour avec succès',
        data: result.rows[0]
      });

    } catch (error) {
      console.error("Erreur API:", error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// ===================================================
// RÉCUPÉRER LES LOGOS D'UNE AGENCE (OBLIGATOIRE)
// URL: /api/logoagence?idagence=1
// ===================================================
router.get('/logoagence', async (req, res) => {
  try {
    const { idagence } = req.query;

    if (!idagence || idagence === 'null' || idagence === 'undefined') {
      return res.status(400).json({
        success: false,
        message: "L'identifiant de l'agence (idagence) est obligatoire pour cette opération."
      });
    }

    const query = `
      SELECT * 
      FROM finalogoagence 
      WHERE idagence = $1
    `;
    
    const result = await pool.query(query, [idagence]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Aucune configuration de logo trouvée pour cette agence.",
        data: null
      });
    }

    res.status(200).json({
      success: true,
      message: "Données récupérées avec succès",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Erreur GET API:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des données",
      error: error.message
    });
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

// ===================================================
// MULTER CONFIG (LOGO + AUTRESLOGO + SIGNATURE + TAMPON)
// ===================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subFolder = 'logo';

    if (file.fieldname === 'autreslogo') {
      subFolder = 'autreslogo';
    }

    if (file.fieldname === 'signature') {
      subFolder = 'signature';
    }

    if (file.fieldname === 'tampon') {
      subFolder = 'tampon';
    }

    const dir = path.join(
      __dirname,
      '../uploads/finance/agence/logo',
      subFolder
    );

    // Créer le dossier s'il n'existe pas
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
// ENREGISTRER / MODIFIER LOGO AGENCE
// ===================================================
router.post(
  '/logoagence-ajouter',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'autreslogo', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
    { name: 'tampon', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        idagence,
        codeagence,
        raisonsocial,
        adresse,
        activite,
        responsable,
        telephone,
        sigle,
        ministere,
        republique,
        devise,
        agrement,ville
      } = req.body;

      const logo = req.files?.logo?.[0]?.filename || null;
      const autreslogo = req.files?.autreslogo?.[0]?.filename || null;
      const signature = req.files?.signature?.[0]?.filename || null;
      const tampon = req.files?.tampon?.[0]?.filename || null;

      // Utilisation de ON CONFLICT pour insérer ou mettre à jour les informations de l'agence
      const query = `
  INSERT INTO finalogoagence (
    idagence, codeagence, raisonsocial, adresse, 
    activite, responsable, telephone, 
    logo, autreslogo, signature, tampon,
    sigle, ministere, republique, devise, agrement,ville
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,$17)
  ON CONFLICT (idagence) 
  DO UPDATE SET
    codeagence = EXCLUDED.codeagence,
    raisonsocial = EXCLUDED.raisonsocial,
    adresse = EXCLUDED.adresse,
    activite = EXCLUDED.activite,
    responsable = EXCLUDED.responsable,
    telephone = EXCLUDED.telephone,
    logo = COALESCE(EXCLUDED.logo, finalogoagence.logo),
    autreslogo = COALESCE(EXCLUDED.autreslogo, finalogoagence.autreslogo),
    signature = COALESCE(EXCLUDED.signature, finalogoagence.signature),
    tampon = COALESCE(EXCLUDED.tampon, finalogoagence.tampon),
    sigle = EXCLUDED.sigle,
    ministere = EXCLUDED.ministere,
    republique = EXCLUDED.republique,
    devise = EXCLUDED.devise,
    agrement = EXCLUDED.agrement,
    ville=EXCLUDED.ville
  RETURNING *
`;

      const values = [
        idagence, codeagence, raisonsocial, adresse,
        activite, responsable, telephone,
        logo, autreslogo, signature, tampon,
        sigle, ministere, republique, devise, agrement,ville
      ];

      const result = await pool.query(query, values);

      res.status(201).json({
        success: true,
        message: 'Données enregistrées/mises à jour avec succès',
        data: result.rows[0]
      });

    } catch (error) {
      console.error("Erreur API:", error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// ===================================================
// RÉCUPÉRER LES LOGOS D'UNE AGENCE (OBLIGATOIRE)
// URL: /api/logoagence?idagence=1
// ===================================================
router.get('/logoagence', async (req, res) => {
  try {
    const { idagence } = req.query;

    if (!idagence || idagence === 'null' || idagence === 'undefined') {
      return res.status(400).json({
        success: false,
        message: "L'identifiant de l'agence (idagence) est obligatoire pour cette opération."
      });
    }

    const query = `
      SELECT * 
      FROM finalogoagence 
      WHERE idagence = $1
    `;
    
    const result = await pool.query(query, [idagence]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Aucune configuration de logo trouvée pour cette agence.",
        data: null
      });
    }

    res.status(200).json({
      success: true,
      message: "Données récupérées avec succès",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Erreur GET API:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des données",
      error: error.message
    });
  }
});

module.exports = router;

*/



/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


// ===================================================
// MULTER CONFIG (LOGO + AUTRESLOGO + SIGNATURE + TAMPON)
// ===================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subFolder = 'logo';

    if (file.fieldname === 'autreslogo') {
      subFolder = 'autreslogo';
    }

    if (file.fieldname === 'signature') {
      subFolder = 'signature';
    }

    if (file.fieldname === 'tampon') {
      subFolder = 'tampon';
    }

    const dir = path.join(
      __dirname,
      '../uploads/finance/agence/logo',
      subFolder
    );

    // Créer le dossier s'il n'existe pas
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
// ENREGISTRER LOGO AGENCE
// ===================================================


// ===================================================
// ENREGISTRER / MODIFIER LOGO AGENCE (Sert pour les deux)
// ===================================================



router.post(
  '/logoagence-ajouter',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'autreslogo', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
    { name: 'tampon', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        idagence,
        codeagence,
        raisonsocial,
        adresse,
        activite,
        responsable,
        telephone
      } = req.body;

      const logo = req.files?.logo?.[0]?.filename || null;
      const autreslogo = req.files?.autreslogo?.[0]?.filename || null;
      const signature = req.files?.signature?.[0]?.filename || null;
      const tampon = req.files?.tampon?.[0]?.filename || null;

      // Utilisation de ON CONFLICT pour mettre à jour si l'idagence existe déjà
      const query = `
  INSERT INTO finalogoagence (
    idagence, codeagence, raisonsocial, adresse, 
    activite, responsable, telephone, 
    logo, autreslogo, signature, tampon
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  ON CONFLICT (idagence) 
  DO UPDATE SET
    codeagence = EXCLUDED.codeagence,
    raisonsocial = EXCLUDED.raisonsocial,
    adresse = EXCLUDED.adresse,
    activite = EXCLUDED.activite,
    responsable = EXCLUDED.responsable,
    telephone = EXCLUDED.telephone,
    logo = COALESCE(EXCLUDED.logo, finalogoagence.logo),
    autreslogo = COALESCE(EXCLUDED.autreslogo, finalogoagence.autreslogo),
    signature = COALESCE(EXCLUDED.signature, finalogoagence.signature),
    tampon = COALESCE(EXCLUDED.tampon, finalogoagence.tampon)
  RETURNING *
`;

      const values = [
        idagence, codeagence, raisonsocial, adresse,
        activite, responsable, telephone,
        logo, autreslogo, signature, tampon
      ];

      const result = await pool.query(query, values);

      res.status(201).json({
        success: true,
        message: 'Données enregistrées/mises à jour avec succès',
        data: result.rows[0]
      });

    } catch (error) {
      console.error("Erreur API:", error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);



// ===================================================
// AFFICHER TOUS LES LOGOS AGENCES
// ===================================================
// ===================================================
// AFFICHER TOUS LES LOGOS D'UNE AGENCE
// URL: /logoagence?idagence=1
// ===================================================



// ===================================================
// RÉCUPÉRER LES LOGOS D'UNE AGENCE (OBLIGATOIRE)
// URL: /api/logoagence?idagence=1
// ===================================================
router.get('/logoagence', async (req, res) => {
  try {
    // 1. Récupération de l'idagence depuis les paramètres de l'URL
    const { idagence } = req.query;

    // 2. Condition Obligatoire : Si idagence est absent ou vide
    if (!idagence || idagence === 'null' || idagence === 'undefined') {
      return res.status(400).json({
        success: false,
        message: "L'identifiant de l'agence (idagence) est obligatoire pour cette opération."
      });
    }

    // 3. Requête SQL
    const query = `
      SELECT * 
      FROM finalogoagence 
      WHERE idagence = $1
    `;
    
    const result = await pool.query(query, [idagence]);

    // 4. Réponse
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Aucune configuration de logo trouvée pour cette agence.",
        data: null
      });
    }

    res.status(200).json({
      success: true,
      message: "Données récupérées avec succès",
      data: result.rows[0] // On retourne le premier (et seul) résultat vu la contrainte UNIQUE
    });

  } catch (error) {
    console.error("Erreur GET API:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des données",
      error: error.message
    });
  }
});

module.exports = router;
*/