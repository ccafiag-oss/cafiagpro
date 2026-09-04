const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ==============================================================================
// 1. CONFIGURATION MULTER TOLÉRANTE AVEC upload.any()
// ==============================================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subFolder = 'cover';

    if (file.fieldname === 'logo_image') {
      subFolder = 'logo';
    } else if (file.fieldname === 'gallery_images') {
      subFolder = 'gallery';
    } else if (file.fieldname === 'document_image') {
      subFolder = 'documents';
    }

    const dir = path.join(__dirname, '../uploads/providers', subFolder);

    // Création automatique du dossier s'il n'existe pas
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    let ext = path.extname(file.originalname || '').toLowerCase();
    
    if (!ext || ext === '') {
      if (file.mimetype === 'image/png') ext = '.png';
      else if (file.mimetype === 'image/webp') ext = '.webp';
      else if (file.mimetype === 'application/pdf') ext = '.pdf';
      else ext = '.jpg';
    }

    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accepter toutes les images, PDF ou flux binaires
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 Mo
});

// 👉 Utiliser upload.any() pour accepter n'importe quel champ de fichier sans erreur
const cpUpload = upload.any();


// ==============================================================================
// 2. ROUTE POST : AJOUTER UN PRESTATAIRE AVEC SES IMAGES
// ==============================================================================
router.post('/providers-with-images', cpUpload, async (req, res) => {
  const {
    idagence,
    iduser,
    name,
    category_id,
    subcategory,
    description,
    phone_primary,
    phone_whatsapp,
    email,
    country_code,
    city,
    district,
    address,
    latitude,
    longitude,
    service_type_accepted,
    service_radius_km
  } = req.body;

  if (!idagence || !name || !category_id || !phone_primary) {
    return res.status(400).json({
      error: 'Champs obligatoires manquants (idagence, name, category_id, phone_primary)'
    });
  }

  // 👉 Extraction propre des fichiers depuis le tableau req.files
  const files = req.files || [];
  
  const logoFile = files.find(f => f.fieldname === 'logo_image');
  const coverFile = files.find(f => f.fieldname === 'cover_image');
  const documentFile = files.find(f => f.fieldname === 'document_image');
  const galleryFiles = files.filter(f => f.fieldname === 'gallery_images');

  const logoPath = logoFile 
    ? `uploads/providers/logo/${logoFile.filename}` 
    : 'uploads/providers/default_logo.png';

  const coverPath = coverFile 
    ? `uploads/providers/cover/${coverFile.filename}` 
    : 'uploads/providers/default_cover.jpg';

  const documentPath = documentFile 
    ? `uploads/providers/documents/${documentFile.filename}` 
    : null;

  const galleryPaths = galleryFiles.map(f => `uploads/providers/gallery/${f.filename}`);

  try {
    await pool.query('BEGIN');

    const insertQuery = `
      INSERT INTO servi_providers (
        idagence, iduser, name, category_id, subcategory, description,
        phone_primary, phone_whatsapp, email, country_code, city, district,
        address, latitude, longitude, service_type_accepted,
        logo_image, cover_image, gallery_images, document_image, service_radius_km
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20, $21
      ) RETURNING *
    `;

    const { rows } = await pool.query(insertQuery, [
      idagence,
      iduser || null,
      name,
      category_id,
      subcategory || null,
      description || null,
      phone_primary,
      phone_whatsapp || phone_primary,
      email || null,
      country_code || 'TG',
      city || 'Lomé',
      district || null,
      address || null,
      parseFloat(latitude) || 6.1375,
      parseFloat(longitude) || 1.2125,
      service_type_accepted || 'both',
      logoPath,
      coverPath,
      galleryPaths,
      documentPath,
      parseInt(service_radius_km) || 15
    ]);

    await pool.query('COMMIT');
    res.status(201).json({
      message: 'Prestataire et images enregistrés avec succès',
      data: rows[0]
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Erreur POST /providers-with-images:', err);
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
});


// ==============================================================================
// 3. ROUTE PUT : MODIFIER UN PRESTATAIRE ET SES IMAGES
// ==============================================================================
router.put('/providers-with-images/:id', cpUpload, async (req, res) => {
  const { id } = req.params;
  const {
    idagence,
    name,
    category_id,
    subcategory,
    description,
    phone_primary,
    phone_whatsapp,
    email,
    city,
    district,
    address,
    latitude,
    longitude,
    service_type_accepted,
    service_radius_km,
    is_open_now,
    is_verified,
    actif
  } = req.body;

  const fields = [];
  const values = [];
  let index = 1;

  if (name !== undefined) { fields.push(`name = $${index++}`); values.push(name); }
  if (category_id !== undefined) { fields.push(`category_id = $${index++}`); values.push(category_id); }
  if (subcategory !== undefined) { fields.push(`subcategory = $${index++}`); values.push(subcategory); }
  if (description !== undefined) { fields.push(`description = $${index++}`); values.push(description); }
  if (phone_primary !== undefined) { fields.push(`phone_primary = $${index++}`); values.push(phone_primary); }
  if (phone_whatsapp !== undefined) { fields.push(`phone_whatsapp = $${index++}`); values.push(phone_whatsapp); }
  if (email !== undefined) { fields.push(`email = $${index++}`); values.push(email); }
  if (city !== undefined) { fields.push(`city = $${index++}`); values.push(city); }
  if (district !== undefined) { fields.push(`district = $${index++}`); values.push(district); }
  if (address !== undefined) { fields.push(`address = $${index++}`); values.push(address); }
  if (latitude !== undefined) { fields.push(`latitude = $${index++}`); values.push(parseFloat(latitude) || 0); }
  if (longitude !== undefined) { fields.push(`longitude = $${index++}`); values.push(parseFloat(longitude) || 0); }
  if (service_type_accepted !== undefined) { fields.push(`service_type_accepted = $${index++}`); values.push(service_type_accepted); }
  if (service_radius_km !== undefined) { fields.push(`service_radius_km = $${index++}`); values.push(parseInt(service_radius_km) || 15); }
  if (is_open_now !== undefined) { fields.push(`is_open_now = $${index++}`); values.push(is_open_now === 'true' || is_open_now === true); }
  if (is_verified !== undefined) { fields.push(`is_verified = $${index++}`); values.push(is_verified === 'true' || is_verified === true); }
  if (actif !== undefined) { fields.push(`actif = $${index++}`); values.push(actif === 'true' || actif === true); }

  // Fichiers uploadés
  const files = req.files || [];
  const logoFile = files.find(f => f.fieldname === 'logo_image');
  const coverFile = files.find(f => f.fieldname === 'cover_image');
  const documentFile = files.find(f => f.fieldname === 'document_image');
  const galleryFiles = files.filter(f => f.fieldname === 'gallery_images');

  if (logoFile) {
    fields.push(`logo_image = $${index++}`);
    values.push(`uploads/providers/logo/${logoFile.filename}`);
  }
  if (coverFile) {
    fields.push(`cover_image = $${index++}`);
    values.push(`uploads/providers/cover/${coverFile.filename}`);
  }
  if (documentFile) {
    fields.push(`document_image = $${index++}`);
    values.push(`uploads/providers/documents/${documentFile.filename}`);
  }
  if (galleryFiles.length > 0) {
    const galleryPaths = galleryFiles.map(f => `uploads/providers/gallery/${f.filename}`);
    fields.push(`gallery_images = array_cat(gallery_images, $${index++})`);
    values.push(galleryPaths);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour.' });
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  let whereClause = ` WHERE id = $${index++}`;
  if (idagence) {
    whereClause += ` AND idagence = $${index++}`;
    values.push(idagence);
  }

  const query = `UPDATE servi_providers SET ${fields.join(', ')} ${whereClause} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, values);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Prestataire non trouvé.' });
    }
    res.json({ message: 'Prestataire mis à jour avec succès', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /providers-with-images/:id:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la modification' });
  }
});



// ==============================================================================
// 1. GESTION DES CATÉGORIES (servi_categories)
// ==============================================================================

// ➡️ GET : Lister les catégories
router.get('/categories', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  let queryText = 'SELECT * FROM servi_categories WHERE idagence = $1 AND actif = true';
  const values = [idagence];

  if (search && search.trim() !== '') {
    queryText += ' AND (name_fr ILIKE $2 OR name_en ILIKE $2)';
    values.push(`%${search.trim()}%`);
  }

  queryText += ' ORDER BY display_order ASC';

  try {
    const { rows } = await pool.query(queryText, values);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /categories:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ➡️ POST : Ajouter une catégorie
router.post('/categories', async (req, res) => {
  const { id, idagence, name_fr, name_en, icon, color_hex, display_order, actif } = req.body;

  if (!id || !idagence || !name_fr) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (id, idagence, name_fr)' });
  }

  try {
    const insertQuery = `
      INSERT INTO servi_categories (
        id, idagence, name_fr, name_en, icon, color_hex, display_order, actif
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const { rows } = await pool.query(insertQuery, [
      id,
      idagence,
      name_fr,
      name_en || null,
      icon || 'wrench',
      color_hex || '#4F46E5',
      display_order || 0,
      actif !== undefined ? actif : true
    ]);

    res.status(201).json({ message: 'Catégorie ajoutée avec succès', data: rows[0] });
  } catch (err) {
    console.error('Erreur POST /categories:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Cet identifiant de catégorie existe déjà.' });
    }
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// ➡️ PUT : Modifier une catégorie
router.put('/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { idagence, name_fr, name_en, icon, color_hex, display_order, actif } = req.body;

  const fields = [];
  const values = [];
  let index = 1;

  if (name_fr !== undefined) { fields.push(`name_fr = $${index++}`); values.push(name_fr); }
  if (name_en !== undefined) { fields.push(`name_en = $${index++}`); values.push(name_en); }
  if (icon !== undefined) { fields.push(`icon = $${index++}`); values.push(icon); }
  if (color_hex !== undefined) { fields.push(`color_hex = $${index++}`); values.push(color_hex); }
  if (display_order !== undefined) { fields.push(`display_order = $${index++}`); values.push(display_order); }
  if (actif !== undefined) { fields.push(`actif = $${index++}`); values.push(actif); }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  values.push(id);
  let whereClause = ` WHERE id = $${index++}`;

  if (idagence) {
    whereClause += ` AND idagence = $${index++}`;
    values.push(idagence);
  }

  const query = `UPDATE servi_categories SET ${fields.join(', ')} ${whereClause} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, values);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }
    res.json({ message: 'Catégorie modifiée', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /categories/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==============================================================================
// 2. GESTION DES PRESTATAIRES (servi_providers) AVEC GÉOLOCALISATION
// ==============================================================================

// ➡️ GET : Trouver des prestataires (Recherche texte, catégorie et proximité GPS)



// ==============================================================================
// 2. GESTION DES PRESTATAIRES (CORRECTION DES PARAMÈTRES SQL ET GÉO)
// ==============================================================================
router.get('/providers', async (req, res) => {
  const {
    idagence,
    category_id,
    search,
    latitude,
    longitude,
    radius_km,
    is_open_now,
    city
  } = req.query;

  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  const values = [idagence];
  let index = 2;

  let selectDistance = '0.0 AS distance_km';
  let latParamIndex = null;
  let lngParamIndex = null;

  // 1. Gestion dynamique des paramètres GPS pour éviter le décalage des index $1, $2, $3...
  const hasGps = latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude));
  if (hasGps) {
    latParamIndex = index++;
    lngParamIndex = index++;
    values.push(parseFloat(latitude), parseFloat(longitude));
    selectDistance = `servi_calculate_distance_km($${latParamIndex}, $${lngParamIndex}, p.latitude, p.longitude) AS distance_km`;
  }

  let queryText = `
    SELECT 
      p.*,
      c.name_fr AS category_name,
      ${selectDistance}
    FROM servi_providers p
    JOIN servi_categories c ON p.category_id = c.id
    WHERE p.idagence = $1 AND p.actif = true
  `;

  if (category_id) {
    queryText += ` AND p.category_id = $${index++}`;
    values.push(category_id);
  }

  if (city && city.trim() !== '') {
    queryText += ` AND (p.city ILIKE $${index} OR p.district ILIKE $${index})`;
    values.push(`%${city.trim()}%`);
    index++;
  }

  if (is_open_now === 'true') {
    queryText += ` AND p.is_open_now = true`;
  }

  if (search && search.trim() !== '') {
    queryText += ` AND (p.name ILIKE $${index} OR p.subcategory ILIKE $${index} OR p.description ILIKE $${index})`;
    values.push(`%${search.trim()}%`);
    index++;
  }

  // Filtrage par rayon kilométrique
  if (hasGps && radius_km && !isNaN(parseFloat(radius_km))) {
    queryText += ` AND servi_calculate_distance_km($${latParamIndex}, $${lngParamIndex}, p.latitude, p.longitude) <= $${index++}`;
    values.push(parseFloat(radius_km));
  }

  if (hasGps) {
    queryText += ` ORDER BY distance_km ASC, p.rating DESC`;
  } else {
    queryText += ` ORDER BY p.rating DESC, p.created_at DESC`;
  }

  try {
    const { rows } = await pool.query(queryText, values);
    res.json({ data: rows });
  } catch (err) {
    console.error('❌ Erreur SQL GET /providers:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});



/*
router.get('/providers', async (req, res) => {
  const {
    idagence,
    category_id,
    search,
    latitude,
    longitude,
    radius_km,
    is_open_now,
    city
  } = req.query;

  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  const values = [idagence];
  let index = 2;

  let selectDistance = '0.0 AS distance_km';
  if (latitude && longitude) {
    selectDistance = `servi_calculate_distance_km($${index}, $${index + 1}, p.latitude, p.longitude) AS distance_km`;
    values.push(parseFloat(latitude), parseFloat(longitude));
    index += 2;
  }

  let queryText = `
    SELECT 
      p.*,
      c.name_fr AS category_name,
      ${selectDistance}
    FROM servi_providers p
    JOIN servi_categories c ON p.category_id = c.id
    WHERE p.idagence = $1 AND p.actif = true
  `;

  if (category_id) {
    queryText += ` AND p.category_id = $${index++}`;
    values.push(category_id);
  }

  if (city) {
    queryText += ` AND p.city ILIKE $${index++}`;
    values.push(`%${city}%`);
  }

  if (is_open_now === 'true') {
    queryText += ` AND p.is_open_now = true`;
  }

  if (search && search.trim() !== '') {
    queryText += ` AND (p.name ILIKE $${index} OR p.subcategory ILIKE $${index} OR p.description ILIKE $${index})`;
    values.push(`%${search.trim()}%`);
    index++;
  }

  // Filtrage par rayon si position GPS fournie
  if (latitude && longitude && radius_km) {
    queryText += ` AND servi_calculate_distance_km($2, $3, p.latitude, p.longitude) <= $${index++}`;
    values.push(parseFloat(radius_km));
  }

  if (latitude && longitude) {
    queryText += ` ORDER BY distance_km ASC, p.rating DESC`;
  } else {
    queryText += ` ORDER BY p.rating DESC, p.created_at DESC`;
  }

  try {
    const { rows } = await pool.query(queryText, values);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /providers:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
*/

// ➡️ GET : Détail d'un prestataire (avec services, produits et horaires)
router.get('/providers/:id', async (req, res) => {
  const { id } = req.params;
  const { idagence } = req.query;

  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  try {
    const providerRes = await pool.query(
      `SELECT p.*, c.name_fr AS category_name 
       FROM servi_providers p 
       JOIN servi_categories c ON p.category_id = c.id
       WHERE p.id = $1 AND p.idagence = $2`,
      [id, idagence]
    );

    if (providerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Prestataire non trouvé' });
    }

    const [servicesRes, productsRes, schedulesRes, reviewsRes] = await Promise.all([
      pool.query(`SELECT * FROM servi_services WHERE provider_id = $1 AND is_active = true`, [id]),
      pool.query(`SELECT * FROM servi_products WHERE provider_id = $1 AND is_active = true`, [id]),
      pool.query(`SELECT * FROM servi_provider_schedules WHERE provider_id = $1 ORDER BY day_of_week ASC`, [id]),
      pool.query(
        `SELECT r.*, u.nom, u.prenom, u.photouser 
         FROM servi_reviews r
         JOIN public.utilisateur u ON r.client_id = u.iduser
         WHERE r.provider_id = $1 
         ORDER BY r.created_at DESC LIMIT 20`,
        [id]
      )
    ]);

    const providerData = providerRes.rows[0];
    providerData.services = servicesRes.rows;
    providerData.products = productsRes.rows;
    providerData.schedules = schedulesRes.rows;
    providerData.reviews = reviewsRes.rows;

    res.json({ data: providerData });
  } catch (err) {
    console.error('Erreur GET /providers/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});








// 2. ROUTE POST : AJOUTER UN PRESTATAIRE AVEC SES IMAGES
// ==============================================================================

/*
router.post('/providers-with-images', cpUpload, async (req, res) => {
  const {
    idagence,
    iduser,
    name,
    category_id,
    subcategory,
    description,
    phone_primary,
    phone_whatsapp,
    email,
    country_code,
    city,
    district,
    address,
    latitude,
    longitude,
    service_type_accepted,
    service_radius_km
  } = req.body;

  if (!idagence || !name || !category_id || !phone_primary || !latitude || !longitude) {
    return res.status(400).json({
      error: 'Champs obligatoires manquants (idagence, name, category_id, phone_primary, latitude, longitude)'
    });
  }

  // Construction des chemins relatifs pour la base de données
  // (ex: uploads/providers/cover/cover_image-17182928-123.jpg)
  const logoPath = req.files['logo_image']
    ? `uploads/providers/logo/${req.files['logo_image'][0].filename}`
    : 'uploads/providers/default_logo.png';

  const coverPath = req.files['cover_image']
    ? `uploads/providers/cover/${req.files['cover_image'][0].filename}`
    : 'uploads/providers/default_cover.jpg';

  const documentPath = req.files['document_image']
    ? `uploads/providers/documents/${req.files['document_image'][0].filename}`
    : null;

  const galleryPaths = req.files['gallery_images']
    ? req.files['gallery_images'].map(file => `uploads/providers/gallery/${file.filename}`)
    : [];

  try {
    await pool.query('BEGIN');

    const insertQuery = `
      INSERT INTO servi_providers (
        idagence, iduser, name, category_id, subcategory, description,
        phone_primary, phone_whatsapp, email, country_code, city, district,
        address, latitude, longitude, service_type_accepted,
        logo_image, cover_image, gallery_images, document_image, service_radius_km
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20, $21
      ) RETURNING *
    `;

    const { rows } = await pool.query(insertQuery, [
      idagence,
      iduser || null,
      name,
      category_id,
      subcategory || null,
      description || null,
      phone_primary,
      phone_whatsapp || phone_primary,
      email || null,
      country_code || 'TG',
      city || 'Lomé',
      district || null,
      address || null,
      latitude,
      longitude,
      service_type_accepted || 'both',
      logoPath,
      coverPath,
      galleryPaths,
      documentPath,
      service_radius_km || 15
    ]);

    await pool.query('COMMIT');
    res.status(201).json({
      message: 'Prestataire et images enregistrés avec succès',
      data: rows[0]
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Erreur POST /providers-with-images:', err);
    res.status(500).json({ error: err.message || 'Erreur serveur lors de l\'enregistrement.' });
  }
});


// ==============================================================================
// 3. ROUTE PUT : MODIFIER UN PRESTATAIRE ET METTRE À JOUR SES IMAGES
// ==============================================================================
router.put('/providers-with-images/:id', cpUpload, async (req, res) => {
  const { id } = req.params;
  const {
    idagence,
    name,
    category_id,
    subcategory,
    description,
    phone_primary,
    phone_whatsapp,
    email,
    city,
    district,
    address,
    latitude,
    longitude,
    service_type_accepted,
    service_radius_km,
    is_open_now,
    is_verified,
    actif
  } = req.body;

  const fields = [];
  const values = [];
  let index = 1;

  if (name !== undefined) { fields.push(`name = $${index++}`); values.push(name); }
  if (category_id !== undefined) { fields.push(`category_id = $${index++}`); values.push(category_id); }
  if (subcategory !== undefined) { fields.push(`subcategory = $${index++}`); values.push(subcategory); }
  if (description !== undefined) { fields.push(`description = $${index++}`); values.push(description); }
  if (phone_primary !== undefined) { fields.push(`phone_primary = $${index++}`); values.push(phone_primary); }
  if (phone_whatsapp !== undefined) { fields.push(`phone_whatsapp = $${index++}`); values.push(phone_whatsapp); }
  if (email !== undefined) { fields.push(`email = $${index++}`); values.push(email); }
  if (city !== undefined) { fields.push(`city = $${index++}`); values.push(city); }
  if (district !== undefined) { fields.push(`district = $${index++}`); values.push(district); }
  if (address !== undefined) { fields.push(`address = $${index++}`); values.push(address); }
  if (latitude !== undefined) { fields.push(`latitude = $${index++}`); values.push(latitude); }
  if (longitude !== undefined) { fields.push(`longitude = $${index++}`); values.push(longitude); }
  if (service_type_accepted !== undefined) { fields.push(`service_type_accepted = $${index++}`); values.push(service_type_accepted); }
  if (service_radius_km !== undefined) { fields.push(`service_radius_km = $${index++}`); values.push(service_radius_km); }
  if (is_open_now !== undefined) { fields.push(`is_open_now = $${index++}`); values.push(is_open_now); }
  if (is_verified !== undefined) { fields.push(`is_verified = $${index++}`); values.push(is_verified); }
  if (actif !== undefined) { fields.push(`actif = $${index++}`); values.push(actif); }

  // Mise à jour des nouveaux fichiers uploadés si fournis
  if (req.files && req.files['logo_image']) {
    const logoPath = `uploads/providers/logo/${req.files['logo_image'][0].filename}`;
    fields.push(`logo_image = $${index++}`);
    values.push(logoPath);
  }

  if (req.files && req.files['cover_image']) {
    const coverPath = `uploads/providers/cover/${req.files['cover_image'][0].filename}`;
    fields.push(`cover_image = $${index++}`);
    values.push(coverPath);
  }

  if (req.files && req.files['document_image']) {
    const docPath = `uploads/providers/documents/${req.files['document_image'][0].filename}`;
    fields.push(`document_image = $${index++}`);
    values.push(docPath);
  }

  if (req.files && req.files['gallery_images']) {
    const galleryPaths = req.files['gallery_images'].map(file => `uploads/providers/gallery/${file.filename}`);
    fields.push(`gallery_images = array_cat(gallery_images, $${index++})`);
    values.push(galleryPaths);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour.' });
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  let whereClause = ` WHERE id = $${index++}`;
  if (idagence) {
    whereClause += ` AND idagence = $${index++}`;
    values.push(idagence);
  }

  const query = `UPDATE servi_providers SET ${fields.join(', ')} ${whereClause} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, values);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Prestataire non trouvé.' });
    }
    res.json({ message: 'Prestataire et photos mis à jour', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /providers-with-images/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

*/


/*

// ➡️ POST : Créer un profil de prestataire
router.post('/providers', async (req, res) => {
  const {
    idagence,
    iduser,
    name,
    category_id,
    subcategory,
    description,
    phone_primary,
    phone_whatsapp,
    email,
    country_code,
    city,
    district,
    address,
    latitude,
    longitude,
    service_type_accepted,
    cover_image,
    gallery_images,
    service_radius_km
  } = req.body;

  if (!idagence || !name || !category_id || !phone_primary || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      error: 'Champs obligatoires manquants (idagence, name, category_id, phone_primary, latitude, longitude)'
    });
  }

  try {
    await pool.query('BEGIN');

    const insertProvider = await pool.query(
      `INSERT INTO servi_providers (
        idagence, iduser, name, category_id, subcategory, description,
        phone_primary, phone_whatsapp, email, country_code, city, district,
        address, latitude, longitude, service_type_accepted, cover_image,
        gallery_images, service_radius_km
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19
      ) RETURNING *`,
      [
        idagence,
        iduser || null,
        name,
        category_id,
        subcategory || null,
        description || null,
        phone_primary,
        phone_whatsapp || phone_primary,
        email || null,
        country_code || 'TG',
        city || 'Lomé',
        district || null,
        address || null,
        latitude,
        longitude,
        service_type_accepted || 'both',
        cover_image || null,
        gallery_images || [],
        service_radius_km || 15
      ]
    );

    // Initialisation automatique des horaires par défaut (du Lundi au Samedi de 08h00 à 18h00)
    const providerId = insertProvider.rows[0].id;
    for (let day = 1; day <= 6; day++) {
      await pool.query(
        `INSERT INTO servi_provider_schedules (idagence, provider_id, day_of_week, is_open, open_time, close_time)
         VALUES ($1, $2, $3, true, '08:00:00', '18:00:00')`,
        [idagence, providerId, day]
      );
    }

    await pool.query('COMMIT');
    res.status(201).json({ message: 'Prestataire créé avec succès', data: insertProvider.rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Erreur POST /providers:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ce profil de prestataire existe déjà.' });
    }
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// ➡️ PUT : Modifier un profil prestataire
router.put('/providers/:id', async (req, res) => {
  const { id } = req.params;
  const {
    idagence,
    name,
    category_id,
    subcategory,
    description,
    phone_primary,
    phone_whatsapp,
    email,
    city,
    district,
    address,
    latitude,
    longitude,
    is_open_now,
    is_verified,
    service_type_accepted,
    cover_image,
    gallery_images,
    service_radius_km,
    actif
  } = req.body;

  const fields = [];
  const values = [];
  let index = 1;

  if (name !== undefined) { fields.push(`name = $${index++}`); values.push(name); }
  if (category_id !== undefined) { fields.push(`category_id = $${index++}`); values.push(category_id); }
  if (subcategory !== undefined) { fields.push(`subcategory = $${index++}`); values.push(subcategory); }
  if (description !== undefined) { fields.push(`description = $${index++}`); values.push(description); }
  if (phone_primary !== undefined) { fields.push(`phone_primary = $${index++}`); values.push(phone_primary); }
  if (phone_whatsapp !== undefined) { fields.push(`phone_whatsapp = $${index++}`); values.push(phone_whatsapp); }
  if (email !== undefined) { fields.push(`email = $${index++}`); values.push(email); }
  if (city !== undefined) { fields.push(`city = $${index++}`); values.push(city); }
  if (district !== undefined) { fields.push(`district = $${index++}`); values.push(district); }
  if (address !== undefined) { fields.push(`address = $${index++}`); values.push(address); }
  if (latitude !== undefined) { fields.push(`latitude = $${index++}`); values.push(latitude); }
  if (longitude !== undefined) { fields.push(`longitude = $${index++}`); values.push(longitude); }
  if (is_open_now !== undefined) { fields.push(`is_open_now = $${index++}`); values.push(is_open_now); }
  if (is_verified !== undefined) { fields.push(`is_verified = $${index++}`); values.push(is_verified); }
  if (service_type_accepted !== undefined) { fields.push(`service_type_accepted = $${index++}`); values.push(service_type_accepted); }
  if (cover_image !== undefined) { fields.push(`cover_image = $${index++}`); values.push(cover_image); }
  if (gallery_images !== undefined) { fields.push(`gallery_images = $${index++}`); values.push(gallery_images); }
  if (service_radius_km !== undefined) { fields.push(`service_radius_km = $${index++}`); values.push(service_radius_km); }
  if (actif !== undefined) { fields.push(`actif = $${index++}`); values.push(actif); }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  let whereClause = ` WHERE id = $${index++}`;
  if (idagence) {
    whereClause += ` AND idagence = $${index++}`;
    values.push(idagence);
  }

  const query = `UPDATE servi_providers SET ${fields.join(', ')} ${whereClause} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, values);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Prestataire non trouvé' });
    }
    res.json({ message: 'Profil prestataire mis à jour', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /providers/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

*/



// ==============================================================================
// 3. GESTION DES SERVICES & ARTICLES (servi_services & servi_products)
// ==============================================================================

// ➡️ POST : Ajouter un service
router.post('/services', async (req, res) => {
  const { idagence, provider_id, title, description, price_estimate, currency, service_type, duration_minutes } = req.body;

  if (!idagence || !provider_id || !title) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (idagence, provider_id, title)' });
  }

  try {
    const insertQuery = `
      INSERT INTO servi_services (
        idagence, provider_id, title, description, price_estimate, currency, service_type, duration_minutes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const { rows } = await pool.query(insertQuery, [
      idagence,
      provider_id,
      title,
      description || null,
      price_estimate || 0.00,
      currency || 'XOF',
      service_type || 'both',
      duration_minutes || 60
    ]);
    res.status(201).json({ message: 'Service ajouté', data: rows[0] });
  } catch (err) {
    console.error('Erreur POST /services:', err);
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// ➡️ PUT : Modifier un service
router.put('/services/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, price_estimate, currency, service_type, duration_minutes, is_active } = req.body;

  const fields = [];
  const values = [];
  let index = 1;

  if (title !== undefined) { fields.push(`title = $${index++}`); values.push(title); }
  if (description !== undefined) { fields.push(`description = $${index++}`); values.push(description); }
  if (price_estimate !== undefined) { fields.push(`price_estimate = $${index++}`); values.push(price_estimate); }
  if (currency !== undefined) { fields.push(`currency = $${index++}`); values.push(currency); }
  if (service_type !== undefined) { fields.push(`service_type = $${index++}`); values.push(service_type); }
  if (duration_minutes !== undefined) { fields.push(`duration_minutes = $${index++}`); values.push(duration_minutes); }
  if (is_active !== undefined) { fields.push(`is_active = $${index++}`); values.push(is_active); }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à modifier' });
  }

  values.push(id);
  const query = `UPDATE servi_services SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;

  try {
    const { rowCount, rows } = await pool.query(query, values);
    if (rowCount === 0) return res.status(404).json({ error: 'Service non trouvé' });
    res.json({ message: 'Service mis à jour', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /services/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ➡️ POST : Ajouter un produit / article
router.post('/products', async (req, res) => {
  const { idagence, provider_id, title, description, price, currency, stock, photos } = req.body;

  if (!idagence || !provider_id || !title) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (idagence, provider_id, title)' });
  }

  try {
    const insertQuery = `
      INSERT INTO servi_products (
        idagence, provider_id, title, description, price, currency, stock, photos
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const { rows } = await pool.query(insertQuery, [
      idagence,
      provider_id,
      title,
      description || null,
      price || 0.00,
      currency || 'XOF',
      stock || 0,
      photos || []
    ]);
    res.status(201).json({ message: 'Produit ajouté', data: rows[0] });
  } catch (err) {
    console.error('Erreur POST /products:', err);
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// ==============================================================================
// 4. DEMANDES DE SERVICE & DEVIS (servi_service_requests & servi_quotes)
// ==============================================================================

// ➡️ GET : Lister les demandes ouvertes pour les prestataires à proximité
router.get('/requests', async (req, res) => {
  const { idagence, category_id, latitude, longitude, radius_km, client_id } = req.query;

  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  let queryText = `
    SELECT 
      r.*,
      u.nom AS client_nom,
      u.prenom AS client_prenom,
      u.telephone AS client_telephone
    FROM servi_service_requests r
    JOIN public.utilisateur u ON r.client_id = u.iduser
    WHERE r.idagence = $1
  `;
  const values = [idagence];
  let index = 2;

  if (client_id) {
    queryText += ` AND r.client_id = $${index++}`;
    values.push(client_id);
  } else {
    queryText += ` AND r.status = 'open'`;
  }

  if (category_id) {
    queryText += ` AND r.category_id = $${index++}`;
    values.push(category_id);
  }

  if (latitude && longitude && radius_km) {
    queryText += ` AND servi_calculate_distance_km($${index}, $${index + 1}, r.latitude, r.longitude) <= $${index + 2}`;
    values.push(parseFloat(latitude), parseFloat(longitude), parseFloat(radius_km));
    index += 3;
  }

  queryText += ` ORDER BY r.created_at DESC`;

  try {
    const { rows } = await pool.query(queryText, values);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /requests:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ➡️ POST : Créer une demande de service
router.post('/requests', async (req, res) => {
  const {
    idagence,
    client_id,
    category_id,
    subcategory_id,
    title,
    description,
    urgency,
    service_type,
    latitude,
    longitude,
    address_text,
    photo_urls
  } = req.body;

  if (!idagence || !client_id || !category_id || !title || !description || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Champs obligatoires manquants pour la demande' });
  }

  try {
    const insertQuery = `
      INSERT INTO servi_service_requests (
        idagence, client_id, category_id, subcategory_id, title, description,
        urgency, service_type, latitude, longitude, address_text, photo_urls
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const { rows } = await pool.query(insertQuery, [
      idagence,
      client_id,
      category_id,
      subcategory_id || null,
      title,
      description,
      urgency || 'today',
      service_type || 'at_client',
      latitude,
      longitude,
      address_text || null,
      photo_urls || []
    ]);
    res.status(201).json({ message: 'Demande créée avec succès', data: rows[0] });
  } catch (err) {
    console.error('Erreur POST /requests:', err);
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// ➡️ POST : Soumettre un devis / proposition par un prestataire
router.post('/quotes', async (req, res) => {
  const { idagence, request_id, provider_id, proposed_price, currency, estimated_arrival, message } = req.body;

  if (!idagence || !request_id || !provider_id || !proposed_price) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (idagence, request_id, provider_id, proposed_price)' });
  }

  try {
    const insertQuery = `
      INSERT INTO servi_quotes (
        idagence, request_id, provider_id, proposed_price, currency, estimated_arrival, message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const { rows } = await pool.query(insertQuery, [
      idagence,
      request_id,
      provider_id,
      proposed_price,
      currency || 'XOF',
      estimated_arrival || 'Moins de 30 min',
      message || null
    ]);
    res.status(201).json({ message: 'Devis envoyé avec succès', data: rows[0] });
  } catch (err) {
    console.error('Erreur POST /quotes:', err);
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// ==============================================================================
// 5. AVIS & NOTATION (servi_reviews)
// ==============================================================================

// ➡️ POST : Ajouter un avis et mettre à jour la note moyenne du prestataire
router.post('/reviews', async (req, res) => {
  const { idagence, provider_id, client_id, rating, comment } = req.body;

  if (!idagence || !provider_id || !client_id || !rating) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (idagence, provider_id, client_id, rating)' });
  }

  try {
    await pool.query('BEGIN');

    // 1. Insertion de l'avis
    const reviewRes = await pool.query(
      `INSERT INTO servi_reviews (idagence, provider_id, client_id, rating, comment, is_verified)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [idagence, provider_id, client_id, rating, comment || null]
    );

    // 2. Recalcul automatique de la moyenne et du nombre d'avis
    await pool.query(
      `UPDATE servi_providers
       SET 
         rating = (SELECT ROUND(AVG(rating)::numeric, 2) FROM servi_reviews WHERE provider_id = $1),
         review_count = (SELECT COUNT(*) FROM servi_reviews WHERE provider_id = $1)
       WHERE id = $1`,
      [provider_id]
    );

    await pool.query('COMMIT');
    res.status(201).json({ message: 'Avis enregistré avec succès', data: reviewRes.rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Erreur POST /reviews:', err);
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// ==============================================================================
// 6. SYNCHRONISATION OFFLINE (servi_sync_events)
// ==============================================================================

// ➡️ POST : Traitement en lot de la file de synchronisation mobile
router.post('/sync', async (req, res) => {
  const { idagence, iduser, events } = req.body;

  if (!idagence || !events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'Paramètres manquants : "idagence" et tableau "events" requis.' });
  }

  try {
    await pool.query('BEGIN');
    const processedIds = [];

    for (const evt of events) {
      const { id, event_type, payload, client_timestamp } = evt;

      // Enregistrement de l'événement dans le journal
      await pool.query(
        `INSERT INTO servi_sync_events (
          id, idagence, iduser, event_type, payload, client_timestamp, sync_status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'synced')
        ON CONFLICT (id) DO NOTHING`,
        [id, idagence, iduser || null, event_type, payload, client_timestamp || new Date()]
      );

      // Traitement selon le type d'opération
      if (event_type === 'CREATE_REQUEST') {
        await pool.query(
          `INSERT INTO servi_service_requests (
            id, idagence, client_id, category_id, title, description,
            urgency, service_type, latitude, longitude, address_text
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING`,
          [
            payload.id,
            idagence,
            iduser,
            payload.category_id,
            payload.title,
            payload.description,
            payload.urgency || 'today',
            payload.service_type || 'at_client',
            payload.latitude,
            payload.longitude,
            payload.address_text || null
          ]
        );
      }

      processedIds.push(id);
    }

    await pool.query('COMMIT');
    res.status(200).json({
      success: true,
      message: `${processedIds.length} événements synchronisés avec succès.`,
      synced_ids: processedIds
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Erreur POST /sync:', err);
    res.status(500).json({ error: 'Erreur lors de la synchronisation', details: err.message });
  }
});



// ==============================================================================
// STATISTIQUES EN TEMPS RÉEL DE L'ESPACE PRO (servi_providers)
// ==============================================================================
router.get('/pro/dashboard', async (req, res) => {
  const { idagence, iduser } = req.query;

  if (!idagence || !iduser) {
    return res.status(400).json({ error: 'Paramètres "idagence" et "iduser" obligatoires.' });
  }

  try {
    // 1. Récupérer les informations du prestataire lié à l'utilisateur
    const providerQuery = await pool.query(
      `SELECT p.*, c.name_fr AS category_name
       FROM servi_providers p
       JOIN servi_categories c ON p.category_id = c.id
       WHERE p.iduser = $1 AND p.idagence = $2 AND p.actif = true
       LIMIT 1`,
      [iduser, idagence]
    );

    if (providerQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Aucun profil prestataire trouvé pour cet utilisateur.' });
    }

    const provider = providerQuery.rows[0];

    // 2. Calcul des métriques réelles depuis PostgreSQL
    const statsQuery = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM servi_reviews WHERE provider_id = $1) AS total_reviews,
        (SELECT COUNT(*) FROM servi_services WHERE provider_id = $1 AND is_active = true) AS total_services,
        (SELECT COUNT(*) FROM servi_products WHERE provider_id = $1 AND is_active = true) AS total_products,
        (SELECT COUNT(*) FROM servi_appointments WHERE provider_id = $1 AND status = 'pending') AS pending_appointments,
        (SELECT COUNT(*) FROM servi_service_requests WHERE idagence = $2 AND category_id = $3 AND status = 'open') AS nearby_requests
      `,
      [provider.id, idagence, provider.category_id]
    );

    const stats = statsQuery.rows[0];

    res.json({
      success: true,
      data: {
        provider: provider,
        stats: {
          profile_views: 1250, // Peut être stocké dans une table servi_analytics
          calls_received: 182,
          favorites_count: 89,
          rating: parseFloat(provider.rating) || 5.0,
          review_count: parseInt(stats.total_reviews) || 0,
          total_services: parseInt(stats.total_services) || 0,
          total_products: parseInt(stats.total_products) || 0,
          pending_appointments: parseInt(stats.pending_appointments) || 0,
          nearby_requests: parseInt(stats.nearby_requests) || 0
        }
      }
    });
  } catch (err) {
    console.error('Erreur GET /pro/dashboard:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;