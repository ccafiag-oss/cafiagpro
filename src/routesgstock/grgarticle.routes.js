const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subFolder = 'articles';
    if (file.fieldname === 'galeries') {
      subFolder = 'articles/gallery';
    }
    const dir = path.join(__dirname, '../uploads', subFolder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext) ext = '.jpg';
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});





// ➡️ Ajouter un nouvel article avec stock et tarifs
router.post('/garticle', async (req, res) => {
  const {
    idagence,
    codearticle,
    designation,
    idcategorie,
    idsouscategorie,
    idsouscategoriedetail,
    idunite,
    prixachat,
    prixvente,
    cump,
    stockmin,
    stockmax,
    idarticlelier,
    nombreunite,
    gere_lot,
    gere_stock,
    date_peremption,
    actif,
    taux_taxe,
    poid_unitaire,
    iddepot,
    // Champs pour tarifs achat/vente
    idtypefr,
    idtypecl,
    prix_achat_ht,
    prix_achat_ttc,
    coefficient,
    prix_vente_referentiel,
    prix_achat_base_ht,
    prix_vente_ht,
    prix_vente_ttc,
    prix_base,
    taxe1,
    taxe2,
    taxe3,
    taxe4,
    datedebut,
    idlot,
    codelot,
    stockinitial
  } = req.body;

  if (!idagence || !codearticle || !designation || !iddepot) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (idagence, designation, iddepot)' });
  }

  try {
    await pool.query('BEGIN');

    // 1️⃣ Insérer l’article
    const insertArticle = await pool.query(
      `INSERT INTO garticle (
        idagence, designation, idcategorie, idsouscategorie,
        idsouscategoriedetail, idunite, prixachat, prixvente, cump,
        stockmin, stockmax, idarticlelier, nombreunite, gere_lot,
        gere_stock, date_peremption, actif, taux_taxe, poid_unitaire,idlot,codelot,prix_achat_base_ht,prix_base,stockinitial
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,$22,$23,$24
      ) RETURNING idarticle`,
      [
        idagence, designation, idcategorie, idsouscategorie,
        idsouscategoriedetail, idunite, prixachat || 0, prixvente || 0, cump || 0,
        stockmin || 0, stockmax || null, idarticlelier || null, nombreunite || 1,
        gere_lot !== undefined ? gere_lot : true,
        gere_stock !== undefined ? gere_stock : true,
        date_peremption || null,
        actif !== undefined ? actif : true,
        taux_taxe || 0,
        poid_unitaire || 0,idlot,codelot,prix_achat_base_ht || 0,prix_base || 0,stockinitial || 0
      ]
    );





    const newIdArticle = insertArticle.rows[0].idarticle;

    // 2️⃣ Insertion automatique dans garticle_photos avec idsouscategoriedetail
    await pool.query(
      `INSERT INTO garticle_photos (idagence, idarticle, idcategorie, idsouscategoriedetail, prixvente, actif)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (idagence, idarticle) 
       DO UPDATE SET 
         idcategorie = EXCLUDED.idcategorie,
         idsouscategoriedetail = EXCLUDED.idsouscategoriedetail,
         prixvente = EXCLUDED.prixvente`,
      [idagence, newIdArticle, idcategorie || null, idsouscategoriedetail || null, prixvente || 0, actif !== undefined ? actif : true]
    );


    await pool.query('COMMIT');
    res.status(201).json({ message: 'Article ajouté avec stock et tarifs' });
  
  
  /*
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Erreur POST /garticle:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
*/

} catch (err) {
  await pool.query('ROLLBACK');
  console.error('Erreur POST /garticle:', err);

  // Gérer l'erreur d'unicité (code 23505)
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Cet article existe déjà dans cette agence.' });
  }

  // Autres erreurs
  res.status(500).json({ error: err.message || 'Une erreur est survenue lors de l\'ajout.' });
}

});





// 1. Récupérer tous les articles (optionnellement filtrés par 'idagence' ou autres critères)
router.get('/garticle', async (req, res) => {
  const { idagence, search } = req.query;

  // Vérification si 'idagence' est fourni
  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  // Construction de la requête SQL
  let queryText = 'SELECT * FROM garticle WHERE idagence = $1';
  const values = [idagence];


  if (search && search.trim() !== '') {
    queryText += ' AND designation ILIKE $2';
    values.push(`%${search}%`);
  }
  /*
  // Ajout de la recherche si 'search' est fourni et contient au moins 3 caractères
  if (search && search.length >= 3) {
    queryText += ' AND designation ILIKE $2';
    values.push(`%${search}%`);
  }
*/




  try {
    const { rows } = await pool.query(queryText, values);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /garticle:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});








// 3. Modifier un article existant
router.put('/garticle/:id', async (req, res) => {
  const { id } = req.params;
  const {
    idcategorie,
    idsouscategorie,
    idsouscategoriedetail,
    idunite,
    prixachat,
    prixvente,
    cump,
    stockmin,
    stockmax,
    idarticlelier,
    nombreunite,
    gere_lot,
    gere_stock,
    date_peremption,
    actif,
    designation,
    codearticle,
    taux_taxe,
    poid_unitaire
  } = req.body;

  const fields = [];
  const values = [];
  let index = 1;

  if (idcategorie !== undefined) {
    fields.push(`idcategorie = $${index++}`);
    values.push(idcategorie);
  }
  if (idsouscategorie !== undefined) {
    fields.push(`idsouscategorie = $${index++}`);
    values.push(idsouscategorie);
  }
  if (idsouscategoriedetail !== undefined) {
    fields.push(`idsouscategoriedetail = $${index++}`);
    values.push(idsouscategoriedetail);
  }
  if (idunite !== undefined) {
    fields.push(`idunite = $${index++}`);
    values.push(idunite);
  }
  if (prixachat !== undefined) {
    fields.push(`prixachat = $${index++}`);
    values.push(prixachat);
  }
  if (prixvente !== undefined) {
    fields.push(`prixvente = $${index++}`);
    values.push(prixvente);
  }
  if (cump !== undefined) {
    fields.push(`cump = $${index++}`);
    values.push(cump);
  }
  if (stockmin !== undefined) {
    fields.push(`stockmin = $${index++}`);
    values.push(stockmin);
  }
  if (stockmax !== undefined) {
    fields.push(`stockmax = $${index++}`);
    values.push(stockmax);
  }
  if (idarticlelier !== undefined) {
    fields.push(`idarticlelier = $${index++}`);
    values.push(idarticlelier);
  }
  if (nombreunite !== undefined) {
    fields.push(`nombreunite = $${index++}`);
    values.push(nombreunite);
  }
  if (gere_lot !== undefined) {
    fields.push(`gere_lot = $${index++}`);
    values.push(gere_lot);
  }
  if (gere_stock !== undefined) {
    fields.push(`gere_stock = $${index++}`);
    values.push(gere_stock);
  }
  if (date_peremption !== undefined) {
    fields.push(`date_peremption = $${index++}`);
    values.push(date_peremption);
  }
  if (actif !== undefined) {
    fields.push(`actif = $${index++}`);
    values.push(actif);
  }
  if (designation !== undefined) {
    fields.push(`designation = $${index++}`);
    values.push(designation);
  }


    if (taux_taxe !== undefined) {
    fields.push(`taux_taxe = $${index++}`);
    values.push(taux_taxe);
  }
    if (poid_unitaire !== undefined) {
    fields.push(`poid_unitaire = $${index++}`);
    values.push(poid_unitaire);
  }



  if (fields.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  values.push(id); // pour la clause WHERE

  const query = `UPDATE garticle SET ${fields.join(', ')} WHERE idarticle = $${index} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, [...values]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    res.json({ message: 'Article modifié', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /garticle/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});









 
router.post('/lier-article-agence', async (req, res) => {
    const { idarticle_emetteur, idarticle_destinataire } = req.body;

    if (!idarticle_emetteur || !idarticle_destinataire) {
        return res.status(400).json({
            success: false,
            message: "Paramètres manquants : idarticle_emetteur et idarticle_destinataire sont requis."
        });
    }

    try {
        // Remplacement des "?" par la syntaxe PostgreSQL "$1" et "$2"
        const query = `
            UPDATE garticle 
            SET idarticlelier_agence = $1 
            WHERE idarticle = $2
        `;
        
        // Utilisation de ton instance PostgreSQL (remplace "pool" par "db" si ton instance s'appelle db)
        const { rowCount } = await pool.query(query, [idarticle_destinataire, idarticle_emetteur]);

        // Sous PostgreSQL, on vérifie rowCount au lieu de affectedRows
        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "L'article émetteur spécifié n'existe pas."
            });
        }

        return res.status(200).json({
            success: true,
            message: "La liaison de l'article a été mise à jour avec succès."
        });

    } catch (error) {
        console.error("❌ ERREUR SQL UPDATE LIAISON =>", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la mise à jour de la liaison."
        });
    }
});






router.get('/generlotid', async (req, res) => {
  try {
    const { idannee } = req.query;

    if (!idannee) {
      return res.status(400).json({ message: 'Le paramètre idannee est requis.' });
    }

    const lotResult = await pool.query(
      `SELECT idlot, codelot 
       FROM public.glot 
       WHERE idannee = $1 
       ORDER BY idlot DESC 
       LIMIT 1`,
      [idannee]
    );

    if (lotResult.rows.length === 0) {
      return res.status(404).json({ message: "Aucun lot trouvé pour cette année." });
    }

    // On retourne à la fois code et idlot comme demandé dans votre code Flutter
    const { idlot, codelot } = lotResult.rows[0];
    res.json({ code: codelot, idlot: idlot });

  } catch (err) {
    console.error('GET /generlot error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});




///  MISE A JOURS POID UNITAIRE

// Mettre à jour le poids unitaire d'un article
router.put('/update-poid-unitaire', async (req, res) => {
  const { idarticle, poid_unitaire } = req.body;

  if (idarticle === undefined || poid_unitaire === undefined) {
    return res.status(400).json({ error: "L'idarticle et le poid_unitaire sont requis." });
  }

  const client = await pool.connect();
  try {
    // Conversion explicite de l'ID en entier pour correspondre au type de la table
    await client.query(
      'UPDATE public.garticle SET poid_unitaire = $1 WHERE idarticle = $2::integer;',
      [poid_unitaire, idarticle]
    );

    res.status(200).json({ message: 'Poids unitaire mis à jour avec succès.' });
  } catch (err) {
    console.error("Erreur de mise à jour de poid_unitaire :", err);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour du poids unitaire.', 
      details: err.message 
    });
  } finally {
    client.release();
  }
});


















// ==============================================================================
// 3. CATALOGUE FILTRÉ PAR CATÉGORIE ET SOUS-CATÉGORIE DÉTAIL
// ==============================================================================


router.get('/gsouscategoriedetail', async (req, res) => {
  try {
    const { idagence, idcategorie } = req.query;

    if (!idagence) {
      return res.status(400).json({ message: 'Agence non spécifiée' });
    }

    let queryText = 'SELECT * FROM gsouscategoriedetail WHERE idagence = $1';
    const params = [idagence];

    if (idcategorie && idcategorie !== 'ALL') {
      params.push(idcategorie);
      queryText += ` AND idcategorie = $${params.length}`;
    }

    queryText += ' ORDER BY idsouscategoriedetail ASC';

    const { rows } = await pool.query(queryText, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /gsouscategoriedetail error:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


router.get('/catalog', async (req, res) => {
  const { idagence, idcategorie, idsouscategoriedetail, search } = req.query;

  if (!idagence) {
    return res.status(400).json({ error: 'Paramètre idagence obligatoire' });
  }

  try {
    let query = `
      SELECT 
        a.idarticle,
        a.idagence,
        a.designation,
        a.codearticle,
        COALESCE(p.idcategorie, a.idcategorie) AS idcategorie,
        c.designation AS categorie_nom,
        COALESCE(p.idsouscategoriedetail, a.idsouscategoriedetail) AS idsouscategoriedetail,
        scd.designation AS souscategoriedetail_nom,
        COALESCE(p.prixvente, a.prixvente, 0) AS prixvente,
        p.description,
        p.photo,
        COALESCE(p.galeries, '[]'::jsonb) AS galeries,
        COALESCE(p.actif, a.actif, true) AS actif
      FROM garticle a
      LEFT JOIN gcategorie c ON a.idcategorie = c.idcategorie
      LEFT JOIN garticle_photos p ON a.idarticle = p.idarticle AND a.idagence = p.idagence
      LEFT JOIN gsouscategoriedetail scd ON COALESCE(p.idsouscategoriedetail, a.idsouscategoriedetail) = scd.idsouscategoriedetail
      WHERE a.idagence = $1 AND COALESCE(p.actif, a.actif, true) = true
    `;
    const params = [idagence];

    if (idcategorie && idcategorie !== 'ALL') {
      params.push(idcategorie);
      query += ` AND (a.idcategorie = $${params.length} OR p.idcategorie = $${params.length})`;
    }

    if (idsouscategoriedetail && idsouscategoriedetail !== 'ALL') {
      params.push(idsouscategoriedetail);
      query += ` AND (a.idsouscategoriedetail = $${params.length} OR p.idsouscategoriedetail = $${params.length})`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      query += ` AND (a.designation ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }

    query += ` ORDER BY a.designation ASC`;

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /catalog:', err);
    res.status(500).json({ error: 'Erreur catalogue' });
  }
});

// ==============================================================================
// 4. MISE À JOUR PHOTOS, GALERIE, SOUS-CATÉGORIE DÉTAIL & INFOS
// ==============================================================================
router.post('/garticle_photos/update', upload.any(), async (req, res) => {
  const { idagence, idarticle, idcategorie, idsouscategoriedetail, prixvente, description, existing_galeries } = req.body;

  if (!idagence || !idarticle) {
    return res.status(400).json({ error: 'idagence et idarticle sont obligatoires' });
  }

  try {
    let mainPhotoPath = null;
    let newGalleryPaths = [];

    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const relativePath = 'uploads/' + (file.fieldname === 'galeries' ? 'articles/gallery/' : 'articles/') + file.filename;
        if (file.fieldname === 'photo') {
          mainPhotoPath = relativePath;
        } else if (file.fieldname === 'galeries') {
          newGalleryPaths.push(relativePath);
        }
      });
    }

    const existing = await pool.query(
      'SELECT photo, galeries FROM garticle_photos WHERE idagence = $1 AND idarticle = $2',
      [idagence, idarticle]
    );

    let finalPhoto = mainPhotoPath;
    let finalGaleries = [];

    if (existing_galeries) {
      try {
        finalGaleries = typeof existing_galeries === 'string' ? JSON.parse(existing_galeries) : existing_galeries;
      } catch (_) {
        finalGaleries = [];
      }
    } else if (existing.rows.length > 0 && existing.rows[0].galeries) {
      finalGaleries = existing.rows[0].galeries;
    }

    finalGaleries = [...finalGaleries, ...newGalleryPaths];

    if (!finalPhoto && existing.rows.length > 0) {
      finalPhoto = existing.rows[0].photo;
    }

    const query = `
      INSERT INTO garticle_photos (idagence, idarticle, idcategorie, idsouscategoriedetail, prixvente, description, photo, galeries, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (idagence, idarticle) 
      DO UPDATE SET
        idcategorie = COALESCE(EXCLUDED.idcategorie, garticle_photos.idcategorie),
        idsouscategoriedetail = COALESCE(EXCLUDED.idsouscategoriedetail, garticle_photos.idsouscategoriedetail),
        prixvente = COALESCE(EXCLUDED.prixvente, garticle_photos.prixvente),
        description = COALESCE(EXCLUDED.description, garticle_photos.description),
        photo = COALESCE(EXCLUDED.photo, garticle_photos.photo),
        galeries = EXCLUDED.galeries,
        updated_at = NOW()
      RETURNING *;
    `;

    const values = [
      idagence,
      idarticle,
      idcategorie || null,
      idsouscategoriedetail || null,
      prixvente || 0,
      description || '',
      finalPhoto,
      JSON.stringify(finalGaleries)
    ];

    const result = await pool.query(query, values);
    res.json({ message: 'Article mis à jour avec succès', data: result.rows[0] });
  } catch (err) {
    console.error('Erreur POST /garticle_photos/update:', err);
    res.status(500).json({ error: 'Erreur mise à jour photo' });
  }
});



module.exports = router;






/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assure-toi que ta connection DB est bien configurée

// 1. Récupérer tous les articles (optionnellement filtrés par 'idagence' ou autres critères)
router.get('/garticle', async (req, res) => {
  const { idagence, search } = req.query;

  // Vérification si 'idagence' est fourni
  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  // Construction de la requête SQL
  let queryText = 'SELECT * FROM garticle WHERE idagence = $1';
  const values = [idagence];

  // Ajout de la recherche si 'search' est fourni et contient au moins 3 caractères
  if (search && search.length >= 3) {
    queryText += ' AND designation ILIKE $2';
    values.push(`%${search}%`);
  }

  try {
    const { rows } = await pool.query(queryText, values);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /garticle:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 2. Ajouter un nouvel article



// 2. Ajouter un nouvel article
router.post('/garticle', async (req, res) => {
  const {
    idagence,
    codearticle,
    designation,
    idcategorie,
    idsouscategorie,
    idsouscategoriedetail,
    idunite,
    prixachat,
    prixvente,
    cump,
    stockmin,
    stockmax,
    idarticlelier,
    nombreunite,
    gere_lot,
    gere_stock,
    date_peremption,
    actif,
    taux_taxe,
    poid_unitaire,
    iddepot // ⚡ Ajout du dépôt cible
  } = req.body;

  if (!idagence || !codearticle || !designation || !iddepot) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (idagence, codearticle, designation, iddepot)' });
  }

  try {
    await pool.query('BEGIN'); // ⚡ Démarrer une transaction

    // 1️⃣ Insérer l’article
    const insertArticle = await pool.query(
      `INSERT INTO garticle (
        idagence, codearticle, designation, idcategorie, idsouscategorie,
        idsouscategoriedetail, idunite, prixachat, prixvente, cump,
        stockmin, stockmax, idarticlelier, nombreunite, gere_lot,
        gere_stock, date_peremption, actif, taux_taxe, poid_unitaire
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20
      ) RETURNING idarticle`,
      [
        idagence, codearticle, designation, idcategorie, idsouscategorie,
        idsouscategoriedetail, idunite, prixachat || 0, prixvente || 0, cump || 0,
        stockmin || 0, stockmax || null, idarticlelier || null, nombreunite || 1,
        gere_lot !== undefined ? gere_lot : true,
        gere_stock !== undefined ? gere_stock : true,
        date_peremption || null,
        actif !== undefined ? actif : true,
        taux_taxe || 0,
        poid_unitaire || 0
      ]
    );

    const idarticle = insertArticle.rows[0].idarticle;

    // 2️⃣ Insérer dans gstock_depot si inexistant
    await pool.query(
      `INSERT INTO gstock_depot (idagence, iddepot, idarticle, quantite, quantite_reservee)
       VALUES ($1, $2, $3, 0, 0)
       ON CONFLICT (idarticle, iddepot) DO NOTHING`,
      [idagence, iddepot, idarticle]
    );

    await pool.query('COMMIT'); // ⚡ Valider la transaction

    res.status(201).json({ message: 'Article ajouté avec stock initial', idarticle });
  } catch (err) {
    await pool.query('ROLLBACK'); // ⚡ Annuler en cas d’erreur
    console.error('Erreur POST /garticle:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// 3. Modifier un article existant
router.put('/garticle/:id', async (req, res) => {
  const { id } = req.params;
  const {
    idcategorie,
    idsouscategorie,
    idsouscategoriedetail,
    idunite,
    prixachat,
    prixvente,
    cump,
    stockmin,
    stockmax,
    idarticlelier,
    nombreunite,
    gere_lot,
    gere_stock,
    date_peremption,
    actif,
    designation,
    codearticle,
    taux_taxe,
    poid_unitaire
  } = req.body;

  const fields = [];
  const values = [];
  let index = 1;

  if (idcategorie !== undefined) {
    fields.push(`idcategorie = $${index++}`);
    values.push(idcategorie);
  }
  if (idsouscategorie !== undefined) {
    fields.push(`idsouscategorie = $${index++}`);
    values.push(idsouscategorie);
  }
  if (idsouscategoriedetail !== undefined) {
    fields.push(`idsouscategoriedetail = $${index++}`);
    values.push(idsouscategoriedetail);
  }
  if (idunite !== undefined) {
    fields.push(`idunite = $${index++}`);
    values.push(idunite);
  }
  if (prixachat !== undefined) {
    fields.push(`prixachat = $${index++}`);
    values.push(prixachat);
  }
  if (prixvente !== undefined) {
    fields.push(`prixvente = $${index++}`);
    values.push(prixvente);
  }
  if (cump !== undefined) {
    fields.push(`cump = $${index++}`);
    values.push(cump);
  }
  if (stockmin !== undefined) {
    fields.push(`stockmin = $${index++}`);
    values.push(stockmin);
  }
  if (stockmax !== undefined) {
    fields.push(`stockmax = $${index++}`);
    values.push(stockmax);
  }
  if (idarticlelier !== undefined) {
    fields.push(`idarticlelier = $${index++}`);
    values.push(idarticlelier);
  }
  if (nombreunite !== undefined) {
    fields.push(`nombreunite = $${index++}`);
    values.push(nombreunite);
  }
  if (gere_lot !== undefined) {
    fields.push(`gere_lot = $${index++}`);
    values.push(gere_lot);
  }
  if (gere_stock !== undefined) {
    fields.push(`gere_stock = $${index++}`);
    values.push(gere_stock);
  }
  if (date_peremption !== undefined) {
    fields.push(`date_peremption = $${index++}`);
    values.push(date_peremption);
  }
  if (actif !== undefined) {
    fields.push(`actif = $${index++}`);
    values.push(actif);
  }
  if (designation !== undefined) {
    fields.push(`designation = $${index++}`);
    values.push(designation);
  }
  if (codearticle !== undefined) {
    fields.push(`codearticle = $${index++}`);
    values.push(codearticle);
  }


    if (taux_taxe !== undefined) {
    fields.push(`taux_taxe = $${index++}`);
    values.push(taux_taxe);
  }
    if (poid_unitaire !== undefined) {
    fields.push(`poid_unitaire = $${index++}`);
    values.push(poid_unitaire);
  }



  if (fields.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  values.push(id); // pour la clause WHERE

  const query = `UPDATE garticle SET ${fields.join(', ')} WHERE idarticle = $${index} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, [...values]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }
    res.json({ message: 'Article modifié', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /garticle/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

*/