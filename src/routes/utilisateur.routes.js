const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const controller = require('../controllers/utilisateur.controller');

// Configuration du stockage Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'C:/CAFIAG/CAFIAG_CREDIVENTE/photouser'; // Chemin absolu demandé
        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Nom de fichier unique : timestamp + extension d'origine
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'user-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Création
router.post('/', upload.single('photouser'), controller.create);

// Mise à jour (⚠️ ajouter multer ici aussi)
router.put('/:id', upload.single('photouser'), controller.update);

module.exports = router;


/*
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const controller = require('../controllers/utilisateur.controller');

// Configuration du stockage Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'C:/CAFIAG/CAFIAG_CREDIVENTE/photouser'; // Chemin absolu demandé
        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Nom de fichier unique : timestamp + extension d'origine
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'user-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Route POST : 'photouser' doit être le nom du champ dans votre formulaire (ou Flutter)
router.post('/', upload.single('photouser'), controller.create);

// Mise à jour 
router.put('/:id', controller.update);
module.exports = router;
*/