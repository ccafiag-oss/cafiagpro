const express = require('express');
const router = express.Router();
const operationController = require('../controllers/operationController');

// Route avec paramètres d'URL : /api/operation/generate/1/VENTE/true/true/false/105/true
router.get('/generate/:idAgence/:typeOp/:useYear/:useMonth/:useDay/:idUser/:includeTypeOp', 
    operationController.generateCode
);

module.exports = router;