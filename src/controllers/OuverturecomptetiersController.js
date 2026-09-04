const comptetiersService = require('../services/OuverturecomptetiersService');

exports.ouvrirCompteTiers = async (req, res) => {
  try {
    const dataArray = req.body;
    const result = await comptetiersService.execOuvertureComptetiers(dataArray);
    
    res.status(201).json(result);
  } catch (err) {
    // Affiche l'erreur en console pour le debug backend
    console.error("❌ Erreur API Ouverture Compte:", err);

    // 1. Détection des doublons (PostgreSQL code 23505 ou message personnalisé)
    const isDuplicate = 
        err.code === '23505' || 
        err.message.includes("unique constraint") || 
        err.message.includes("existe déjà") || 
        err.code === 'ALREADY_EXISTS';

    if (isDuplicate) {
      return res.status(409).json({ 
        success: false, 
        message: "Ce compte existe déjà (Code ou Numéro de compte dupliqué). Veuillez en saisir un autre." 
      });
    }

    // 2. Erreur générique pour les autres problèmes (500)
    res.status(500).json({ 
      success: false, 
      error: err.message || "Une erreur interne est survenue sur le serveur." 
    });
  }
};


/*
const comptetiersService = require('../services/OuverturecomptetiersService');

exports.ouvrirCompteTiers = async (req, res) => {
  try {
    const dataArray = req.body; // Flutter envoie un tableau JSON
    const result = await comptetiersService.execOuvertureComptetiers(dataArray);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

*/