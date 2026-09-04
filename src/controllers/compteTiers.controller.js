const compteTiersService = require('../services/compteTiers.service');

exports.insertCompteTiers = async (req, res) => {
  try {
    const dataArray = req.body;

    if (!Array.isArray(dataArray)) {
      return res.status(400).json({
        success: false,
        message: 'Le body doit être un tableau'
      });
    }

    const result = await compteTiersService.execInsertComptetiers(dataArray);

    res.status(201).json({
      success: true,
      message: 'Insertion réussie',
      totalLignes: result.totalLignes
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: err.message
    });
  }
};
