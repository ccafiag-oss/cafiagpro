// src/controllers/client.controller.js
const clientService = require('../services/client.service');

/**
 * POST /api/clients/add
 * Reçoit fields + fichiers (photo, signature) via Multer (upload.fields).
 * Stocke uniquement le nom du fichier (filename) en base.
 */
const addClient = async (req, res) => {
  try {
    console.log('=== REQ.BODY ===', req.body);
    console.log('=== REQ.FILES ===', req.files);

    const photoFilename = (req.files && req.files['photo']) ? req.files['photo'][0].filename : null;
    const signatureFilename = (req.files && req.files['signature']) ? req.files['signature'][0].filename : null;

    const clientData = {
      ...req.body,
      photo: photoFilename,
      signature: signatureFilename
    };

    const newClient = await clientService.createClient(clientData);

    return res.status(201).json({
      success: true,
      message: "Client enregistré avec succès",
      data: newClient
    });
  } catch (error) {
    console.error('Erreur controller addClient:', error);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de l'enregistrement du client",
      error: error.message || error
    });
  }
};

/**
 * PUT /api/clients/:id
 * Met à jour un client existant. Accepte fichiers optionnels (photo, signature).
 */
const updateClient = async (req, res) => {
  try {
    // Récupère l'id depuis l'URL : /api/clients/:id
    const idParam = req.params.id;
    if (!idParam) {
      return res.status(400).json({ success: false, message: 'Identifiant client manquant dans l\'URL' });
    }

    // Convertir en entier si nécessaire
    const idclients = Number.isInteger(Number(idParam)) ? parseInt(idParam, 10) : idParam;

    console.log('=== REQ.PARAMS ===', req.params);
    console.log('=== REQ.BODY ===', req.body);
    console.log('=== REQ.FILES ===', req.files);

    const photoFilename = (req.files && req.files['photo']) ? req.files['photo'][0].filename : null;
    const signatureFilename = (req.files && req.files['signature']) ? req.files['signature'][0].filename : null;

    const clientData = {
      ...req.body,
      photo: photoFilename,       // null => service doit garder l'ancienne valeur via COALESCE
      signature: signatureFilename
    };

    const updated = await clientService.updateClient(idclients, clientData);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Client non trouvé' });
    }

    return res.status(200).json({ success: true, message: 'Client mis à jour', data: updated });
  } catch (error) {
    console.error('Erreur controller updateClient:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message || error });
  }
};

/**
 * GET /api/clients/listeclients
 * Optionnel query param: idag
 */
const listClients = async (req, res) => {
  try {
    const filters = {};
    if (req.query.idag) filters.idag = req.query.idag;

    const clients = await clientService.getAllClients(filters);
    return res.status(200).json({ success: true, data: clients });
  } catch (error) {
    console.error('Erreur controller listClients:', error);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des clients",
      error: error.message || error
    });
  }
};

module.exports = {
  addClient,
  updateClient,
  listClients
};



/*

const clientService = require('../services/client.service');


const addClient = async (req, res) => {
  try {
    console.log('=== REQ.BODY ===', req.body);
    console.log('=== REQ.FILES ===', req.files);

    // Récupère uniquement le filename généré par Multer
    const photoFilename = (req.files && req.files['photo']) ? req.files['photo'][0].filename : null;
    const signatureFilename = (req.files && req.files['signature']) ? req.files['signature'][0].filename : null;

 
    const clientData = {
      ...req.body,
      photo: photoFilename,        // ex: "AZE_ASED_TGCSAG1CL000042_photo.jpg"
      signature: signatureFilename // ex: "AZE_ASED_TGCSAG1CL000042_signature.png"
    };

    const newClient = await clientService.createClient(clientData);

    return res.status(201).json({
      success: true,
      message: "Client enregistré avec succès",
      data: newClient
    });
  } catch (error) {
    console.error('Erreur controller addClient:', error);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de l'enregistrement du client",
      error: error.message || error
    });
  }
};


const updateClient = async (req, res) => {
  try {
    const codeclients = req.params.idclients;
    console.log('=== REQ.BODY ===', req.body);
    console.log('=== REQ.FILES ===', req.files);

    const photoFilename = (req.files && req.files['photo']) ? req.files['photo'][0].filename : null;
    const signatureFilename = (req.files && req.files['signature']) ? req.files['signature'][0].filename : null;

    const clientData = {
      ...req.body,
      // si null, le service utilise COALESCE pour garder l'ancienne valeur
      photo: photoFilename,
      signature: signatureFilename
    };

    const updated = await clientService.updateClient(idclients, clientData);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Client non trouvé' });
    }

    return res.status(200).json({ success: true, message: 'Client mis à jour', data: updated });
  } catch (error) {
    console.error('Erreur controller updateClient:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message || error });
  }
};





const listClients = async (req, res) => {
  try {
    const filters = {};
    if (req.query.idag) filters.idag = req.query.idag;

    const clients = await clientService.getAllClients(filters);
    return res.status(200).json({ success: true, data: clients });
  } catch (error) {
    console.error('Erreur controller listClients:', error);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des clients",
      error: error.message || error
    });
  }
};

module.exports = {
  addClient,
  updateClient,
  listClients
};


*/







