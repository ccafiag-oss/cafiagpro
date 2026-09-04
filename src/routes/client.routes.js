// src/routes/clients.route.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const clientController = require('../controllers/client.controller');

// Dossiers d'uploads (chemin relatif au projet)
const uploadBase = path.join(__dirname, '..', 'uploads', 'clients');
const photoDir = path.join(uploadBase, 'photo');
const sigDir = path.join(uploadBase, 'signature');
fs.mkdirSync(photoDir, { recursive: true });
fs.mkdirSync(sigDir, { recursive: true });

// Multer storage pour clients (photo + signature)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'photo') cb(null, photoDir);
    else if (file.fieldname === 'signature') cb(null, sigDir);
    else cb(null, uploadBase);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const nom = (req.body.nom || '').trim().replace(/\s+/g, '_') || 'UNKNOWN';
    const prenom = (req.body.prenom || '').trim().replace(/\s+/g, '_') || 'UNKNOWN';
    const code = (req.body.codeclients || '').trim().replace(/\s+/g, '_') || Date.now().toString();

    let baseName = `${nom}_${prenom}_${code}`;
    if (file.fieldname === 'photo') baseName += '_photo';
    else if (file.fieldname === 'signature') baseName += '_signature';

    const finalName = `${baseName}${ext}`;
    console.log('Multer filename ->', finalName, 'dest ->', file.fieldname);
    cb(null, finalName);
  }
});

const upload = multer({ storage });

// Routes
// POST /api/clients/add  -> fields + files (photo, signature)
router.post('/add', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), clientController.addClient);

// PUT /api/clients/:id -> update client (files optional)
router.put('/:id', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), clientController.updateClient);

// GET /api/clients/listeclients?idag=...
router.get('/listeclients', clientController.listClients);

module.exports = router;
