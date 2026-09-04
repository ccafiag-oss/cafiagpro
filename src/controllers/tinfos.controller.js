const { createTinfos } = require('../services/tinfos.service');

exports.create = async (req, res) => {
  try {
    const { produit } = req.body;

    // Validation de base
    if (!produit) {
      return res.status(400).json({ error: "Le nom du produit est obligatoire" });
    }

    // req.files est un tableau grâce à upload.array("photos", 3)
    const files = req.files || [];

    // On prépare les données pour le service
    // Note : On utilise /uploads/TINFOS/ car c'est ce qui est configuré dans server.js
    const data = {
      produit,
      urlphoto1: files[0] ? `/uploads/TINFOS/${files[0].filename}` : null,
      urlphoto2: files[1] ? `/uploads/TINFOS/${files[1].filename}` : null,
      urlphoto3: files[2] ? `/uploads/TINFOS/${files[2].filename}` : null
    };

    const result = await createTinfos(data);
    
    res.status(201).json({
      message: "Produit créé avec succès",
      data: result
    });

  } catch (err) {
    console.error("Erreur Controller Create:", err);
    res.status(500).json({ error: "Une erreur est survenue lors de la création." });
  }
};