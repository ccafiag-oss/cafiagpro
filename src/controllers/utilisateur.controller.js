const utilisateurService = require('../services/utilisateur.service');

exports.create = async (req, res) => {
    try {
        // req.file contient les infos du fichier uploadé
        // req.body contient les autres champs texte
        
        let photoPath = null;
        if (req.file) {
            // On stocke le chemin relatif pour pouvoir y accéder via le serveur static
            photoPath = `/photouser/${req.file.filename}`;
        }

        const userData = {
            ...req.body,
            photouser: photoPath
        };

        const nouveauUser = await utilisateurService.createUtilisateur(userData);

        res.status(201).json({
            message: "Utilisateur créé avec succès",
            data: nouveauUser
        });
    } catch (error) {
        console.error("Erreur création utilisateur:", error);
        res.status(500).json({ error: "Erreur lors de la création de l'utilisateur" });
    }
};



exports.update = async (req, res) => {
  try {
    const id = req.params.id;

    let photoPath = null;
    if (req.file) {
      photoPath = `/photouser/${req.file.filename}`;
    }

    const userData = {
      ...req.body,
      photouser: photoPath // peut être null → on garde l’ancienne
    };

    const updatedUser = await utilisateurService.updateUtilisateur(id, userData);

    if (!updatedUser) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    res.status(200).json({
      message: "Utilisateur mis à jour avec succès",
      data: updatedUser
    });
  } catch (error) {
    console.error("Erreur mise à jour utilisateur:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'utilisateur" });
  }
};
