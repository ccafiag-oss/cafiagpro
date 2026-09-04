// src/middlewares/uploadClients.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// dossier racine pour stocker les fichiers clients (photo et signature)
const uploadRoot = "C:/CAFIAG/CAFIAG_CREDIVENTE/client";

// créer les sous-dossiers si inexistants
const photoDir = path.join(uploadRoot, 'photo');
const signatureDir = path.join(uploadRoot, 'signature');
if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true });
if (!fs.existsSync(signatureDir)) fs.mkdirSync(signatureDir, { recursive: true });

// configuration multer (même style que pour photouser)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // choisir le sous-dossier selon le champ
    if (file.fieldname === 'photo') return cb(null, photoDir);
    if (file.fieldname === 'signature') return cb(null, signatureDir);
    return cb(null, uploadRoot);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}_${file.fieldname}${ext}`;
    cb(null, filename);
  }
});

module.exports = multer({ storage });
