const express = require('express');
const router = express.Router();
const controller = require('../controllers/compteTiers.controller');

router.post('/insert', controller.insertCompteTiers);

module.exports = router;
