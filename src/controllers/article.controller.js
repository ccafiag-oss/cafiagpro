const service = require('../services/article.service');

// GET
exports.getAll = async (req, res) => {
  try {
    const { idagence } = req.params;
    const { rows } = await service.getArticles(idagence);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST
exports.create = async (req, res) => {
  try {
    const { designation, idagence } = req.body;

    // Validation des champs nécessaires à la création
    if (!designation || !idagence) {
      return res.status(400).json({ message: 'Désignation et ID agence obligatoires' });
    }

    // Le code est généré par le Trigger SQL, pas besoin de le passer ici
    const { rows } = await service.createArticle(req.body);
    res.status(201).json(rows[0]);

  } catch (err) {
    // Gestion de l'erreur unique_designation_par_agence (Code SQL: 23505)
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Cet article existe déjà pour cette agence.' });
    }
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// PUT
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { designation } = req.body;

    if (!designation) {
        return res.status(400).json({ message: 'La désignation est obligatoire' });
    }

    // Lors de la modification, on ne change que la désignation. 
    // Le code article reste inchangé ou est recalculé selon votre logique Trigger.
    const { rows } = await service.updateArticle(id, req.body);
    
    if (rows.length === 0) {
        return res.status(404).json({ message: 'Article non trouvé' });
    }
    
    res.json(rows[0]);

  } catch (err) {
    // Gestion du conflit si on modifie une désignation déjà existante
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Ce nom d\'article est déjà pris dans cette agence.' });
    }
    res.status(500).json({ message: 'Erreur serveur' });
  }
};



/*
const service = require('../services/article.service');

// GET
exports.getAll = async (req, res) => {
  try {
     const { idagence } = req.params;
    const { rows } = await service.getArticles(idagence);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST
exports.create = async (req, res) => {
  try {
    const { codearticle, designation } = req.body;

    if (!codearticle || !designation) {
      return res.status(400).json({
        message: 'Champs obligatoires manquants'
      });
    }

    const exists = await service.codeArticleExists(codearticle);
    if (exists) {
      return res.status(409).json({
        message:
          'Ce code est déjà utilisé, veuillez utiliser un autre'
      });
    }

    const { rows } = await service.createArticle(req.body);
    res.status(201).json(rows[0]);

  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// PUT
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { codearticle, designation } = req.body;

    const exists = await service.codeArticleExists(codearticle, id);
    if (exists) {
      return res.status(409).json({
        message:
          'Ce code est déjà utilisé, veuillez utiliser un autre'
      });
    }

    const { rows } = await service.updateArticle(id, req.body);
    res.json(rows[0]);

  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
*/
