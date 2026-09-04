const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ➡️ 1. Insertion / Mise à jour Catégorie (avec idagence et iduser)

/*
router.post('/categories/insertCategory', async (req, res) => {
  const { idagence, iduser, nomCategorie, is_active } = req.body;

  if (!idagence || !iduser || !nomCategorie) {
    return res.status(400).json({ error: 'idagence, iduser et nomCategorie sont requis' });
  }

  try {
    const query = `
      INSERT INTO categorie_note (idagence, iduser, nom_categorie, is_active, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (idagence, iduser, nom_categorie) 
      DO UPDATE SET 
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING id;
    `;

    const result = await pool.query(query, [
      idagence,
      iduser,
      nomCategorie,
      is_active !== false
    ]);

    res.status(200).json({ message: 'Catégorie synchronisée', serverId: result.rows[0].id });
  } catch (err) {
    console.error('Erreur Sync Categorie:', err);
    res.status(500).json({ error: err.message });
  }
});
*/
router.post('/categories/insertCategory', async (req, res) => {
  const { id, idagence, iduser, nomCategorie, is_active } = req.body;

  if (!idagence || !iduser || !nomCategorie) {
    return res.status(400).json({ error: 'idagence, iduser et nomCategorie sont requis' });
  }

  try {
    let result;
    // Si un ID serveur existe déjà, on met à jour par ID (utile en cas de renommage)
    if (id) {
      const updateQuery = `
        UPDATE categorie_note 
        SET nom_categorie = $1, is_active = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING id;
      `;
      result = await pool.query(updateQuery, [nomCategorie, is_active !== false, id]);
      
      // Si l'ID n'existe pas en base (ex: suppression distante), on l'insère
      if (result.rowCount === 0) {
        const insertQuery = `
          INSERT INTO categorie_note (idagence, iduser, nom_categorie, is_active, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          RETURNING id;
        `;
        result = await pool.query(insertQuery, [idagence, iduser, nomCategorie, is_active !== false]);
      }
    } else {
      // Sinon, on utilise la logique par contrainte d'unicité (création)
      const query = `
        INSERT INTO categorie_note (idagence, iduser, nom_categorie, is_active, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (idagence, iduser, nom_categorie) 
        DO UPDATE SET 
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING id;
      `;
      result = await pool.query(query, [idagence, iduser, nomCategorie, is_active !== false]);
    }

    res.status(200).json({ message: 'Catégorie synchronisée', serverId: result.rows[0].id });
  } catch (err) {
    console.error('Erreur Sync Categorie:', err);
    res.status(500).json({ error: err.message });
  }
});


// ➡️ 2. Insertion / Mise à jour Page de Note (avec idagence et iduser)
router.post('/Notebook/insertPage', async (req, res) => {
  const { idagence, iduser, category, page_index, title, path_data } = req.body;

  if (!idagence || !iduser || !category || page_index === undefined) {
    return res.status(400).json({ error: 'idagence, iduser, category et page_index sont requis' });
  }

  try {
    const query = `
      INSERT INTO note_pages (idagence, iduser, category, page_index, title, path_data, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (idagence, iduser, category, page_index)
      DO UPDATE SET 
        title = EXCLUDED.title,
        path_data = EXCLUDED.path_data,
        updated_at = NOW()
      RETURNING id;
    `;

    const result = await pool.query(query, [
      idagence,
      iduser,
      category,
      page_index,
      title || '',
      path_data || ''
    ]);

    res.status(200).json({ message: 'Page synchronisée avec succès', serverId: result.rows[0].id });
  } catch (err) {
    console.error('Erreur Sync Page:', err);
    res.status(500).json({ error: err.message });
  }
});


// ➡️ 3. Télécharger toutes les catégories et pages d'un utilisateur et d'une agence
router.get(['/Notebook/downloadData', '/api/Notebook/downloadData'], async (req, res) => {
  const { idagence, iduser } = req.query;

  if (!idagence || !iduser) {
    return res.status(400).json({ error: 'idagence et iduser sont requis' });
  }

  try {
    const catQuery = `SELECT * FROM categorie_note WHERE idagence = $1 AND iduser = $2 ORDER BY nom_categorie ASC`;
    const pagesQuery = `SELECT * FROM note_pages WHERE idagence = $1 AND iduser = $2 ORDER BY page_index ASC`;

    const [catRes, pagesRes] = await Promise.all([
      pool.query(catQuery, [parseInt(idagence), iduser.toString()]),
      pool.query(pagesQuery, [parseInt(idagence), iduser.toString()])
    ]);

    console.log(`📥 [DOWNLOAD] ${catRes.rowCount} catégorie(s) et ${pagesRes.rowCount} page(s) envoyées au mobile`);

    res.json({
      categories: catRes.rows,
      pages: pagesRes.rows
    });
  } catch (err) {
    console.error('❌ Erreur Download Data :', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ➡️ 4. Vérifier l'état d'une page sur le serveur pour comparaison
router.get(['/Notebook/checkPage', '/api/Notebook/checkPage'], async (req, res) => {
  const { idagence, iduser, category, page_index } = req.query;

  if (!idagence || !iduser || !category || page_index === undefined) {
    return res.status(400).json({ error: 'idagence, iduser, category et page_index sont requis' });
  }

  try {
    const query = `
      SELECT id, title, path_data, updated_at 
      FROM note_pages 
      WHERE idagence = $1 AND iduser = $2 AND category = $3 AND page_index = $4
    `;

    const result = await pool.query(query, [
      parseInt(idagence),
      iduser.toString(),
      category.trim(),
      parseInt(page_index)
    ]);

    if (result.rows.length > 0) {
      res.json({ exists: true, page: result.rows[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error('❌ Erreur Check Page :', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;