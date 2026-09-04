const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Configuration environnement ---
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// --- Moteur IA et Canvas ---
const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-wasm');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
const { createCanvas, Image, ImageData, loadImage } = require('@napi-rs/canvas');

// Lier canvas à face-api
faceapi.env.monkeyPatch({
  Canvas: createCanvas,
  Image: Image,
  ImageData: ImageData,
  createCanvasElement: () => createCanvas(1, 1),
  createImageElement: () => new Image(),
});

// ==============================================================================
// 1. INITIALISATION DU MOTEUR IA
// ==============================================================================
let modelsLoaded = false;

async function initFaceApi() {
  if (modelsLoaded) return;
  try {
    await tf.setBackend('wasm');
    await tf.ready();

    let modelsPath = path.join(__dirname, '../../models');
    if (!fs.existsSync(modelsPath)) {
      modelsPath = path.join(process.cwd(), 'models');
    }

    console.log(`⏳ Chargement des modèles IA depuis : ${modelsPath}`);

    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);

    modelsLoaded = true;
    console.log('✅ [IA] Modèles de Reconnaissance Faciale initialisés avec succès !');
  } catch (err) {
    console.error('❌ [IA] Erreur initialisation face-api:', err.message);
  }
}

initFaceApi();

// ==============================================================================
// 2. EXTRACTION BIOMÉTRIQUE VIA TENSOR3D (100% FIABLE SUR SERVEUR)
// ==============================================================================
async function getFaceDescriptor(imagePath) {
  let tensor = null;
  try {
    if (!fs.existsSync(imagePath)) return null;

    const img = await loadImage(imagePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, img.width, img.height);

    // Convertir l'image en Tensor3D [Hauteur, Largeur, RGB]
    tensor = tf.tidy(() => {
      const t4d = tf.tensor3d(new Uint8Array(imgData.data.buffer), [img.height, img.width, 4], 'int32');
      return t4d.slice([0, 0, 0], [-1, -1, 3]); // On retire le canal alpha (RGBA -> RGB)
    });

    // Détection du visage avec le tenseur
    const detection = await faceapi
      .detectSingleFace(tensor)
      .withFaceLandmarks()
      .withFaceDescriptor();

    return detection ? detection.descriptor : null;
  } catch (e) {
    console.error('Erreur analyse biométrique:', e.message);
    return null;
  } finally {
    if (tensor) tensor.dispose(); // Libérer la mémoire GPU/RAM
  }
}

// ==============================================================================
// 3. CONFIGURATION MULTER
// ==============================================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subFolder = 'photos';
    if (file.fieldname === 'photo') subFolder = 'photos';
    else if (file.fieldname === 'face_image') subFolder = 'faces';
    else if (file.fieldname === 'signature') subFolder = 'signatures';
    else if (file.fieldname === 'visage_capture') subFolder = 'temp_verif';

    const dir = path.join(__dirname, '../uploads/rh_employes', subFolder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}.jpg`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }
});

const cpUpload = upload.any();

// ==============================================================================
// 4. ROUTE DE VÉRIFICATION FACIALE
// ==============================================================================
router.post('/rh_verifier_visage', cpUpload, async (req, res) => {
  const { idagence, idemploye } = req.body;
  const files = req.files || [];
  const captureFile = files.find(f => f.fieldname === 'visage_capture') || files[0];

  const cleanup = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  };

  if (!idagence || !idemploye) {
    if (captureFile) cleanup(captureFile.path);
    return res.status(400).json({ error: 'idagence et idemploye sont obligatoires.' });
  }

  if (!captureFile) {
    return res.status(400).json({ error: 'Aucune image transmise pour la vérification.' });
  }

  try {
    // 1. Récupération de l'image de référence de l'employé
    const query = `
      SELECT 
        e.idemploye,
        e.nom_complet,
        e.actif,
        a.face_template,
        a.actif AS auth_actif
      FROM rh_employe e
      LEFT JOIN rh_employe_authentification a 
        ON e.idemploye = a.idemploye AND e.idagence = a.idagence
      WHERE e.idagence = $1 AND e.idemploye = $2
    `;

    const { rows } = await pool.query(query, [idagence, idemploye]);

    if (rows.length === 0) {
      cleanup(captureFile.path);
      return res.status(404).json({ error: 'Employé introuvable.' });
    }

    const employe = rows[0];

    if (!employe.actif || employe.auth_actif === false) {
      cleanup(captureFile.path);
      return res.status(403).json({ error: 'Compte employé ou accès désactivé.' });
    }

    if (!employe.face_template) {
      cleanup(captureFile.path);
      return res.status(404).json({ error: 'Aucun visage de référence enregistré.' });
    }

    const referenceImagePath = path.join(__dirname, '..', employe.face_template);

    if (!fs.existsSync(referenceImagePath)) {
      cleanup(captureFile.path);
      return res.status(404).json({ error: 'Image de référence introuvable sur le serveur.' });
    }

    // 2. Extraire et comparer les 128 descripteurs faciaux
    const captureDescriptor = await getFaceDescriptor(captureFile.path);
    if (!captureDescriptor) {
      cleanup(captureFile.path);
      return res.status(422).json({
        success: false,
        error: 'Aucun visage humain détecté. Veuillez bien centrer votre visage.'
      });
    }

    const referenceDescriptor = await getFaceDescriptor(referenceImagePath);
    if (!referenceDescriptor) {
      cleanup(captureFile.path);
      return res.status(422).json({
        success: false,
        error: 'Impossible d’analyser le visage de référence stocké en base.'
      });
    }

    // 3. Calcul de distance biométrique
    const distance = faceapi.euclideanDistance(captureDescriptor, referenceDescriptor);
    console.log(`[BIOMÉTRIE] ${employe.nom_complet} | Distance calculée : ${distance.toFixed(4)}`);

    cleanup(captureFile.path);

    // Seuil standard : <= 0.55 = même visage
    const SEUIL = 0.55;

    if (distance <= SEUIL) {
      return res.json({
        success: true,
        message: 'Visage authentifié avec succès.',
        distance: distance.toFixed(3),
        idemploye: employe.idemploye,
        nom_complet: employe.nom_complet
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'Visage non reconnu ! Vous ne correspondez pas au titulaire de ce badge.'
      });
    }

  } catch (err) {
    cleanup(captureFile.path);
    console.error('Erreur API /rh_verifier_visage:', err);
    return res.status(500).json({ error: 'Erreur lors de l’analyse faciale.' });
  }
});




/*
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subFolder = 'photos';

    if (file.fieldname === 'photo') {
      subFolder = 'photos';
    } else if (file.fieldname === 'face_image') {
      subFolder = 'faces';
    } else if (file.fieldname === 'signature') {
      subFolder = 'signatures';
    }

    const dir = path.join(__dirname, '../uploads/rh_employes', subFolder);

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
      else ext = '.jpg';
    }

    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 Mo
});

const cpUpload = upload.any();
*/
// ==============================================================================
// 1. AUTHENTIFICATION / SCAN BADGE QR DE L'EMPLOYÉ
// ==============================================================================

/*
router.post('/rh_auth_qr', async (req, res) => {
  const { idagence, qr_token } = req.body;

  if (!idagence || !qr_token) {
    return res.status(400).json({ error: 'idagence et qr_token sont obligatoires' });
  }

  try {
    const query = `
      SELECT 
        e.idemploye, e.idagence, e.code_employe, e.nom, e.prenom, e.nom_complet,
        e.fonction, e.montant_heure, e.salaire_mensuel,
        e.utiliser_visage, e.utiliser_qr, e.utiliser_signature, e.photo, e.actif,
        a.face_template
      FROM rh_employe e
      LEFT JOIN rh_employe_authentification a 
        ON e.idemploye = a.idemploye AND e.idagence = a.idagence
      WHERE e.idagence = $1 AND (e.qr_token = $2 OR a.qr_code = $2)
    `;

    const { rows } = await pool.query(query, [idagence, qr_token]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Badge QR invalide ou inconnu.' });
    }

    const employe = rows[0];

    if (!employe.actif) {
      return res.status(403).json({ error: 'Ce compte employé est désactivé.' });
    }

    res.json({
      success: true,
      message: 'Authentification réussie',
      employe
    });
  } catch (err) {
    console.error('Erreur POST /rh_auth_qr:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


*/
// ==============================================================================
// ROUTE AUTHENTIFICATION BADGE QR (CORRIGÉE & ULTRA-TOLÉRANTE)
// ==============================================================================
router.post('/rh_auth_qr', async (req, res) => {
  const { idagence, qr_token } = req.body;

  if (!idagence || !qr_token) {
    return res.status(400).json({ error: 'idagence et qr_token sont obligatoires' });
  }

  const cleanToken = qr_token.toString().trim();

  try {
    const query = `
      SELECT 
        e.idemploye,
        e.idagence,
        e.code_employe,
        e.matricule,
        e.nom,
        e.prenom,
        e.nom_complet,
        e.fonction,
        e.montant_heure,
        e.salaire_mensuel,
        e.utiliser_visage,
        e.utiliser_qr,
        e.utiliser_signature,
        e.qr_token,
        e.photo,
        e.actif,
        a.face_template
      FROM rh_employe e
      LEFT JOIN rh_employe_authentification a 
        ON e.idemploye = a.idemploye AND e.idagence = a.idagence
      WHERE e.idagence = $1 
        AND (
          TRIM(e.qr_token) = $2
          OR TRIM(e.code_employe) ILIKE $2
          OR TRIM(e.matricule) ILIKE $2
          OR TRIM(a.qr_code) = $2
          OR $2 = ('RH-' || e.idagence || '-' || e.code_employe || '-' || e.idemploye)
        )
    `;

    const { rows } = await pool.query(query, [idagence, cleanToken]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Badge QR invalide ou non reconnu.' });
    }

    const employe = rows[0];

    if (!employe.actif) {
      return res.status(403).json({ error: 'Ce compte employé est désactivé.' });
    }

    res.json({
      success: true,
      message: 'Badge reconnu avec succès',
      employe
    });
  } catch (err) {
    console.error('Erreur POST /rh_auth_qr:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


// ==============================================================================
// 2. ROUTE VÉRIFICATION FACIALE (rh_verifier_visage)
// ==============================================================================

router.post('/rh_verifier_visageOLDE', upload.single('visage_capture'), async (req, res) => {
  const { idagence, idemploye, qr_token } = req.body;
  const imageCapturee = req.file;

  if (!idagence || !idemploye || !imageCapturee) {
    return res.status(400).json({ error: 'Données ou image manquantes' });
  }

  try {
    // 1. Récupérer l'employé et son face_template de référence
    const query = `
      SELECT a.face_template, e.nom_complet, e.actif
      FROM rh_employe_authentification a
      JOIN rh_employe e ON e.idemploye = a.idemploye AND e.idagence = a.idagence
      WHERE a.idagence = $1 AND a.idemploye = $2 AND a.actif = true
    `;
    const { rows } = await pool.query(query, [idagence, idemploye]);

    if (rows.length === 0 || !rows[0].face_template) {
      return res.status(404).json({ error: 'Aucun visage de référence enregistré pour cet employé.' });
    }

    const faceReferencePath = rows[0].face_template;

    // TODO: Si vous utilisez une librairie de reconnaissance (ex: @vladmandic/face-api, AWS Rekognition, ou Python face_recognition),
    // effectuez la comparaison ici entre `imageCapturee.path` et `faceReferencePath`.
    
    // Exemple de validation :
    const match = true; // Remplacer par le résultat réel du comparateur biométrique

    if (match) {
      return res.json({
        success: true,
        message: 'Visage authentifié avec succès'
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'Le visage ne correspond pas au badge.'
      });
    }
  } catch (err) {
    console.error('Erreur vérification visage:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la vérification faciale' });
  }
});




// ==============================================================================
// 2. SYNTHÈSE MENSUELLE DE L'EMPLOYÉ (DASHBOARD)
// ==============================================================================
router.get('/rh_synthese_employe', async (req, res) => {
  const { idagence, idemploye, idmois, idannee } = req.query;

  if (!idagence || !idemploye || !idmois || !idannee) {
    return res.status(400).json({ error: 'Paramètres manquants (idagence, idemploye, idmois, idannee)' });
  }

  try {
    // 1. Informations employé
    const empRes = await pool.query(
      `SELECT idemploye, nom, prenom, nom_complet, code_employe, fonction, montant_heure, salaire_mensuel 
       FROM rh_employe WHERE idagence = $1 AND idemploye = $2`,
      [idagence, idemploye]
    );

    if (empRes.rows.length === 0) {
      return res.status(404).json({ error: 'Employé introuvable.' });
    }

    const emp = empRes.rows[0];

    // 2. Total heures effectuées & approuvées
    const presRes = await pool.query(
      `SELECT 
         COALESCE(SUM(heures_calculees), 0) AS total_effectuees,
         COALESCE(SUM(CASE WHEN calcul_approuve = true THEN heures_payables ELSE 0 END), 0) AS total_approuvees
       FROM rh_presence 
       WHERE idagence = $1 AND idemploye = $2 AND idmois = $3 AND idannee = $4`,
      [idagence, idemploye, idmois, idannee]
    );

    const total_effectuees = parseFloat(presRes.rows[0].total_effectuees);
    const total_approuvees = parseFloat(presRes.rows[0].total_approuvees);

    // 3. Total heures payées
    const paieRes = await pool.query(
      `SELECT COALESCE(SUM(heures_payees), 0) AS total_payees
       FROM rh_paiement 
       WHERE idagence = $1 AND idemploye = $2 AND idmois = $3 AND idannee = $4 AND paye = true`,
      [idagence, idemploye, idmois, idannee]
    );

    const total_payees = parseFloat(paieRes.rows[0].total_payees);

    // 4. Calculs restants
    const heures_a_payer = Math.max(0, total_approuvees - total_payees);
    const montant_a_payer = heures_a_payer * parseFloat(emp.montant_heure);

    res.json({
      success: true,
      data: {
        employe: emp,
        heures_effectuees: total_effectuees,
        heures_approuvees: total_approuvees,
        heures_payees: total_payees,
        heures_a_payer: heures_a_payer,
        taux_horaire: parseFloat(emp.montant_heure),
        montant_a_payer: montant_a_payer
      }
    });
  } catch (err) {
    console.error('Erreur GET /rh_synthese_employe:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ==============================================================================
// 3. POINTAGE ENTRÉE / SORTIE (ARRIVÉE & DÉPART)
// ==============================================================================
router.post('/rh_pointage', async (req, res) => {
  const {
    idagence,
    idemploye,
    type_pointage, // 'ARRIVEE' ou 'DEPART'
    methode,       // 'QR', 'VISAGE', 'QR+VISAGE'
    visage_valide,
    qr_valide
  } = req.body;

  if (!idagence || !idemploye || !type_pointage) {
    return res.status(400).json({ error: 'idagence, idemploye et type_pointage requis' });
  }

  const now = new Date();
  const dateJour = now.toISOString().split('T')[0];
  const idmois = now.getMonth() + 1;
  const idannee = now.getFullYear();

  try {
    // Vérification de la configuration de l'employé
    const empRes = await pool.query(
      `SELECT montant_heure, utiliser_visage, utiliser_qr FROM rh_employe WHERE idemploye = $1 AND idagence = $2`,
      [idemploye, idagence]
    );

    if (empRes.rows.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé.' });
    }

    const emp = empRes.rows[0];

    // Vérifier l'obligation de visage
    if (emp.utiliser_visage && !visage_valide) {
      return res.status(403).json({ error: 'Reconnaissance faciale requise et non validée.' });
    }

    // Récupérer la présence existante pour aujourd'hui
    const presCheck = await pool.query(
      `SELECT * FROM rh_presence WHERE idagence = $1 AND idemploye = $2 AND date = $3`,
      [idagence, idemploye, dateJour]
    );

    if (type_pointage === 'ARRIVEE') {
      if (presCheck.rows.length > 0 && presCheck.rows[0].heure_arrivee) {
        return res.status(400).json({ error: 'Heure d\'arrivée déjà enregistrée aujourd\'hui.' });
      }

      await pool.query(
        `INSERT INTO rh_presence (
          idagence, idemploye, date, idmois, idannee,
          heure_arrivee, methode_arrivee, qr_arrivee_valide, visage_arrivee_valide,
          taux_horaire_applique, statut
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, 'ARRIVEE')
        ON CONFLICT (idagence, idemploye, date) 
        DO UPDATE SET 
          heure_arrivee = NOW(),
          methode_arrivee = EXCLUDED.methode_arrivee,
          qr_arrivee_valide = EXCLUDED.qr_arrivee_valide,
          visage_arrivee_valide = EXCLUDED.visage_arrivee_valide,
          statut = 'ARRIVEE'`,
        [
          idagence, idemploye, dateJour, idmois, idannee,
          methode || 'QR', qr_valide !== undefined ? qr_valide : true,
          visage_valide || false, emp.montant_heure
        ]
      );

      return res.json({ success: true, message: 'Arrivée pointée avec succès. En attente de validation.' });
    }

    if (type_pointage === 'DEPART') {
      if (presCheck.rows.length === 0 || !presCheck.rows[0].heure_arrivee) {
        return res.status(400).json({ error: 'Impossible de pointer le départ sans pointage d\'arrivée préalable.' });
      }

      const arrivee = new Date(presCheck.rows[0].heure_arrivee);
      const dureeMs = now.getTime() - arrivee.getTime();
      const heuresCalculees = Math.max(0, (dureeMs / (1000 * 60 * 60))).toFixed(2);

      await pool.query(
        `UPDATE rh_presence SET 
          heure_depart = NOW(),
          methode_depart = $1,
          qr_depart_valide = $2,
          visage_depart_valide = $3,
          heures_calculees = $4,
          statut = 'DEPART',
          date_modification = NOW()
        WHERE idagence = $5 AND idemploye = $6 AND date = $7`,
        [
          methode || 'QR', qr_valide !== undefined ? qr_valide : true,
          visage_valide || false, heuresCalculees,
          idagence, idemploye, dateJour
        ]
      );

      return res.json({
        success: true,
        message: 'Départ pointé avec succès.',
        heures_effectuees: heuresCalculees
      });
    }

    res.status(400).json({ error: 'Type de pointage non valide.' });
  } catch (err) {
    console.error('Erreur POST /rh_pointage:', err);
    res.status(500).json({ error: 'Erreur lors du pointage', details: err.message });
  }
});

// ==============================================================================
// 4. APPROBATION DES HEURES PAR L'EMPLOYEUR (VALIDATION MANAGER)
// ==============================================================================
router.post('/rh_valider_presence', async (req, res) => {
  const {
    idpresence,
    idagence,
    approuve_arrivee,
    approuve_depart,
    heures_payables,
    valide_par,
    motif_rejet
  } = req.body;

  if (!idpresence || !idagence || valide_par === undefined) {
    return res.status(400).json({ error: 'idpresence, idagence et valide_par requis' });
  }

  try {
    const presRes = await pool.query(
      `SELECT * FROM rh_presence WHERE idpresence = $1 AND idagence = $2`,
      [idpresence, idagence]
    );

    if (presRes.rows.length === 0) {
      return res.status(404).json({ error: 'Fiche de présence introuvable.' });
    }

    const pres = presRes.rows[0];
    const okArrivee = approuve_arrivee === true;
    const okDepart = approuve_depart === true;
    const calculOk = okArrivee && okDepart;

    const finalHeuresPayables = calculOk ? (heures_payables || pres.heures_calculees) : 0;
    const montantCalcule = finalHeuresPayables * parseFloat(pres.taux_horaire_applique);
    const statut = calculOk ? 'APPROUVE' : 'REJETE';

    await pool.query(
      `UPDATE rh_presence SET
        heure_arrivee_approuvee = $1,
        arrivee_approuvee_par = $2,
        arrivee_date_approbation = NOW(),
        arrivee_motif_rejet = $3,
        heure_depart_approuvee = $4,
        depart_approuve_par = $2,
        depart_date_approbation = NOW(),
        depart_motif_rejet = $3,
        calcul_approuve = $5,
        calcul_approuve_par = $2,
        date_calcul_approbation = NOW(),
        heures_payables = $6,
        montant_calcule = $7,
        statut = $8,
        date_modification = NOW()
      WHERE idpresence = $9 AND idagence = $10`,
      [
        okArrivee, valide_par, motif_rejet || null,
        okDepart, calculOk, finalHeuresPayables,
        montantCalcule, statut, idpresence, idagence
      ]
    );

    res.json({ success: true, message: 'Présence mise à jour avec succès.', statut, heures_payables: finalHeuresPayables });
  } catch (err) {
    console.error('Erreur POST /rh_valider_presence:', err);
    res.status(500).json({ error: 'Erreur lors de la validation', details: err.message });
  }
});

// ==============================================================================
// 5. DEMANDE DE PAIEMENT / AVANCE D'HEURES (EMPLOYÉ)
// ==============================================================================
router.post('/rh_demande_paiement', async (req, res) => {
  const {
    idagence,
    idemploye,
    type_demande,          // 'PAIEMENT_HEURES' ou 'AVANCE_HEURES'
    heures_demandees,
    mode_paiement_souhaite,// 'ESPECES', 'TMONEY', 'COMPTE_BANCAIRE'
    numero_compte_ou_tel,
    motif
  } = req.body;

  if (!idagence || !idemploye || !type_demande || !heures_demandees) {
    return res.status(400).json({ error: 'Paramètres obligatoires manquants' });
  }

  const now = new Date();
  const dateJour = now.toISOString().split('T')[0];
  const idmois = now.getMonth() + 1;
  const idannee = now.getFullYear();

  try {
    const empRes = await pool.query(
      `SELECT montant_heure FROM rh_employe WHERE idemploye = $1 AND idagence = $2`,
      [idemploye, idagence]
    );

    if (empRes.rows.length === 0) {
      return res.status(404).json({ error: 'Employé introuvable.' });
    }

    const tauxHoraire = parseFloat(empRes.rows[0].montant_heure);
    const montantDemande = parseFloat(heures_demandees) * tauxHoraire;

    const result = await pool.query(
      `INSERT INTO rh_demande_paiement (
        idagence, idemploye, date, idmois, idannee,
        type_demande, heures_demandees, taux_horaire, montant_demande,
        mode_paiement_souhaite, numero_compte_ou_tel, motif, statut
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'EN_ATTENTE')
      RETURNING *`,
      [
        idagence, idemploye, dateJour, idmois, idannee,
        type_demande, heures_demandees, tauxHoraire, montantDemande,
        mode_paiement_souhaite || 'TMONEY', numero_compte_ou_tel || '', motif || ''
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Demande enregistrée avec succès.',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Erreur POST /rh_demande_paiement:', err);
    res.status(500).json({ error: 'Erreur enregistrement demande', details: err.message });
  }
});

// ==============================================================================
// 6. DÉCISION SUR DEMANDE (ACCORDER / REJETER) PAR LE SUPÉRIEUR
// ==============================================================================
router.post('/rh_decision_demande', async (req, res) => {
  const { iddemande, idagence, statut, approuve_par, raison_decision } = req.body;

  if (!iddemande || !idagence || !statut || !approuve_par) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  try {
    const demRes = await pool.query(
      `UPDATE rh_demande_paiement SET
        statut = $1,
        approuve_par = $2,
        date_approbation = NOW(),
        raison_decision = $3,
        date_modification = NOW()
      WHERE iddemande = $4 AND idagence = $5
      RETURNING *`,
      [statut, approuve_par, raison_decision || '', iddemande, idagence]
    );

    if (demRes.rows.length === 0) {
      return res.status(404).json({ error: 'Demande non trouvée.' });
    }

    const dem = demRes.rows[0];

    // Envoyer une notification à l'employé
    await pool.query(
      `INSERT INTO rh_message (idagence, idemploye, date, idmois, idannee, type_message, titre, message, iddemande)
       VALUES ($1, $2, $3, $4, $5, 'DEMANDE_STATUT', $6, $7, $8)`,
      [
        idagence, dem.idemploye, dem.date, dem.idmois, dem.idannee,
        `Demande de paiement : ${statut}`,
        `Votre demande de ${dem.heures_demandees}h (${dem.montant_demande} FCFA) a été ${statut}. Motif: ${raison_decision || 'N/A'}`,
        iddemande
      ]
    );

    res.json({ success: true, message: `Demande passée au statut ${statut}.` });
  } catch (err) {
    console.error('Erreur POST /rh_decision_demande:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ==============================================================================
// 7. EFFECTUER LE PAIEMENT (PAR L'EMPLOYEUR)
// ==============================================================================
router.post('/rh_effectuer_paiement', async (req, res) => {
  const {
    idagence,
    iddemande,
    mode_paiement,
    numero_transaction,
    banque,
    numero_compte,
    telephone_tmoney,
    paye_par,
    observation
  } = req.body;

  if (!idagence || !iddemande || !mode_paiement || !paye_par) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  try {
    await pool.query('BEGIN');

    const demRes = await pool.query(
      `SELECT * FROM rh_demande_paiement WHERE iddemande = $1 AND idagence = $2`,
      [iddemande, idagence]
    );

    if (demRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Demande introuvable.' });
    }

    const dem = demRes.rows[0];

    // Enregistrer le paiement
    const paieRes = await pool.query(
      `INSERT INTO rh_paiement (
        idagence, iddemande, idemploye, date, idmois, idannee,
        heures_payees, taux_horaire, montant, mode_paiement,
        numero_transaction, banque, numero_compte, telephone_tmoney,
        paye, paye_par, date_paiement, observation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, $15, NOW(), $16)
      RETURNING *`,
      [
        idagence, iddemande, dem.idemploye, dem.date, dem.idmois, dem.idannee,
        dem.heures_demandees, dem.taux_horaire, dem.montant_demande, mode_paiement,
        numero_transaction || null, banque || null, numero_compte || null, telephone_tmoney || null,
        paye_par, observation || ''
      ]
    );

    const newPaie = paieRes.rows[0];

    // Créer la ligne d'attente de confirmation pour l'employé
    await pool.query(
      `INSERT INTO rh_paiement_confirmation (idagence, idpaiement, idemploye, date, idmois, idannee, confirme)
       VALUES ($1, $2, $3, $4, $5, $6, false)`,
      [idagence, newPaie.idpaiement, dem.idemploye, dem.date, dem.idmois, dem.idannee]
    );

    // Notification à l'employé
    await pool.query(
      `INSERT INTO rh_message (idagence, idemploye, date, idmois, idannee, type_message, titre, message, idpaiement, iddemande)
       VALUES ($1, $2, $3, $4, $5, 'PAIEMENT_EFFECTUE', $6, $7, $8, $9)`,
      [
        idagence, dem.idemploye, dem.date, dem.idmois, dem.idannee,
        'Paiement effectué',
        `Un montant de ${dem.montant_demande} FCFA (${dem.heures_demandees}h) vous a été versé via ${mode_paiement}. Merci de confirmer sa réception.`,
        newPaie.idpaiement, iddemande
      ]
    );

    await pool.query('COMMIT');
    res.status(201).json({ success: true, message: 'Paiement effectué avec succès.', data: newPaie });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Erreur POST /rh_effectuer_paiement:', err);
    res.status(500).json({ error: 'Erreur lors du paiement', details: err.message });
  }
});

// ==============================================================================
// 8. CONFIRMATION DE RÉCEPTION DU PAIEMENT (PAR L'EMPLOYÉ)
// ==============================================================================
// ==============================================================================
// 8. CONFIRMATION DE RÉCEPTION DU PAIEMENT (PAR L'EMPLOYÉ) - CORRIGÉE
// ==============================================================================
router.post('/rh_confirmer_paiement', async (req, res) => {
  const { idagence, idpaiement, idemploye, commentaire, signature } = req.body;

  if (!idagence || !idpaiement || !idemploye) {
    return res.status(400).json({ error: 'idagence, idpaiement et idemploye sont requis.' });
  }

  try {
    const result = await pool.query(
      `UPDATE rh_paiement_confirmation SET
        confirme = true,
        date_confirmation = NOW(),
        commentaire = $1,
        signature_confirmation = $2
      WHERE idagence = $3::integer AND idpaiement = $4::bigint AND idemploye = $5::bigint
      RETURNING *`,
      [commentaire || 'Reçu et confirmé par l\'employé', signature || null, idagence, idpaiement, idemploye]
    );

    if (result.rowCount === 0) {
      // Si la ligne n'existait pas dans la table confirmation, on la crée directement
      await pool.query(
        `INSERT INTO rh_paiement_confirmation (
          idagence, idpaiement, idemploye, date, idmois, idannee, 
          confirme, date_confirmation, commentaire, signature_confirmation
        ) VALUES (
          $1::integer, $2::bigint, $3::bigint, CURRENT_DATE, 
          EXTRACT(MONTH FROM CURRENT_DATE)::integer, EXTRACT(YEAR FROM CURRENT_DATE)::integer,
          true, NOW(), $4, $5
        ) ON CONFLICT (idagence, idpaiement) DO UPDATE SET 
          confirme = true, date_confirmation = NOW(), commentaire = EXCLUDED.commentaire`,
        [idagence, idpaiement, idemploye, commentaire || 'Reçu et confirmé', signature || null]
      );
    }

    res.json({ success: true, message: 'Réception du paiement confirmée avec succès !' });
  } catch (err) {
    console.error('Erreur POST /rh_confirmer_paiement:', err);
    res.status(500).json({ error: 'Erreur lors de la confirmation du paiement', details: err.message });
  }
});
// ==============================================================================
// 9. LISTE DES PAIEMENTS & NOTIFICATIONS DE L'EMPLOYÉ
// ==============================================================================
router.get('/rh_employe_paiements', async (req, res) => {
  const { idagence, idemploye } = req.query;

  if (!idagence || !idemploye) {
    return res.status(400).json({ error: 'idagence et idemploye sont requis' });
  }

  try {
    const query = `
      SELECT 
        p.idpaiement, p.date, p.heures_payees, p.montant, p.mode_paiement,
        p.numero_transaction, p.date_paiement,
        c.confirme, c.date_confirmation
      FROM rh_paiement p
      LEFT JOIN rh_paiement_confirmation c ON p.idpaiement = c.idpaiement AND p.idagence = c.idagence
      WHERE p.idagence = $1 AND p.idemploye = $2
      ORDER BY p.date_paiement DESC LIMIT 10
    `;
    const { rows } = await pool.query(query, [idagence, idemploye]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erreur GET /rh_employe_paiements:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});




router.post('/rh_employe', cpUpload, async (req, res) => {
  const {
    idagence,
    code_employe,
    matricule,
    nom,
    prenom,
    sexe,
    telephone,
    email,
    adresse,
    pays,
    fonction,
    departement,
    type_contrat,
    statut_employe,
    salaire_mensuel,
    montant_heure,
    heures_mensuelles_theoriques,
    utiliser_qr,
    utiliser_codebarre,
    utiliser_visage,
    utiliser_signature,
    qr_token,
    observation,
    actif,
    cree_par
  } = req.body;

  if (!idagence || !code_employe || !nom) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (idagence, code_employe, nom).' });
  }

  // Traitement des fichiers reçus par Multer
  let photoPath = null;
  let facePath = null;
  let signaturePath = null;

  if (req.files && req.files.length > 0) {
    req.files.forEach(file => {
      const relativePath = 'uploads/rh_employes/' + 
        (file.fieldname === 'face_image' ? 'faces/' : file.fieldname === 'signature' ? 'signatures/' : 'photos/') + 
        file.filename;

      if (file.fieldname === 'photo') {
        photoPath = relativePath;
      } else if (file.fieldname === 'face_image') {
        facePath = relativePath;
      } else if (file.fieldname === 'signature') {
        signaturePath = relativePath;
      }
    });
  }

  const nom_complet = `${nom} ${prenom || ''}`.trim();

  try {
    await pool.query('BEGIN');

    const insertQuery = `
      INSERT INTO rh_employe (
        idagence, code_employe, matricule, nom, prenom, nom_complet,
        sexe, telephone, email, adresse, pays,
        fonction, departement, type_contrat, statut_employe,
        salaire_mensuel, montant_heure, heures_mensuelles_theoriques,
        utiliser_qr, utiliser_codebarre, utiliser_visage, utiliser_signature,
        qr_token, photo, signature, observation, actif, cree_par,
        date_creation, date_modification
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24, $25, $26, $27, $28,
        NOW(), NOW()
      ) RETURNING idemploye, code_employe, nom_complet;
    `;

    const values = [
      idagence,
      code_employe,
      matricule || null,
      nom,
      prenom || null,
      nom_complet,
      sexe || 'M',
      telephone || null,
      email || null,
      adresse || null,
      pays || 'Togo',
      fonction || null,
      departement || null,
      type_contrat || 'CDI',
      statut_employe || 'ACTIF',
      salaire_mensuel || 0,
      montant_heure || 0,
      heures_mensuelles_theoriques || 173.33,
      utiliser_qr === 'true' || utiliser_qr === true,
      utiliser_codebarre === 'true' || utiliser_codebarre === true,
      utiliser_visage === 'true' || utiliser_visage === true,
      utiliser_signature === 'true' || utiliser_signature === true,
      qr_token || null,
      photoPath,
      signaturePath,
      observation || null,
      actif !== undefined ? (actif === 'true' || actif === true) : true,
      cree_par || null
    ];

    const result = await pool.query(insertQuery, values);
    const newEmploye = result.rows[0];

    // Enregistrer le template visage et le QR dans rh_employe_authentification
    await pool.query(
      `INSERT INTO rh_employe_authentification (idagence, idemploye, qr_code, face_template, date_enregistrement_visage, date_enregistrement_qr)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (idagence, idemploye) 
       DO UPDATE SET qr_code = EXCLUDED.qr_code, face_template = EXCLUDED.face_template`,
      [idagence, newEmploye.idemploye, qr_token, facePath]
    );

    await pool.query('COMMIT');
    res.status(201).json({ success: true, message: 'Employé enregistré avec succès', data: newEmploye });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Erreur POST /rh_employe:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ce code employé existe déjà dans cette agence.' });
    }
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement', details: err.message });
  }
});

// ==============================================================================
// 3. ROUTE PUT : MODIFIER UN EMPLOYÉ AVEC NOUVELLES PHOTOS ÉVENTUELLES
// ==============================================================================
router.put('/rh_employe/:id', cpUpload, async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID employé manquant.' });
  }

  try {
    let photoPath = undefined;
    let facePath = undefined;

    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const relativePath = 'uploads/rh_employes/' + 
          (file.fieldname === 'face_image' ? 'faces/' : 'photos/') + 
          file.filename;

        if (file.fieldname === 'photo') photoPath = relativePath;
        if (file.fieldname === 'face_image') facePath = relativePath;
      });
    }

    if (data.nom !== undefined || data.prenom !== undefined) {
      data.nom_complet = `${data.nom || ''} ${data.prenom || ''}`.trim();
    }

    const fields = [];
    const values = [];
    let index = 1;

    const allowedFields = [
      'code_employe', 'matricule', 'nom', 'prenom', 'nom_complet',
      'sexe', 'telephone', 'email', 'adresse', 'pays', 'fonction', 'departement',
      'type_contrat', 'statut_employe', 'salaire_mensuel', 'montant_heure',
      'heures_mensuelles_theoriques', 'utiliser_qr', 'utiliser_codebarre',
      'utiliser_visage', 'utiliser_signature', 'qr_token', 'observation', 'actif'
    ];

    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${index++}`);
        values.push(data[key] === '' ? null : data[key]);
      }
    }

    if (photoPath) {
      fields.push(`photo = $${index++}`);
      values.push(photoPath);
    }

    fields.push(`date_modification = NOW()`);

    values.push(id);
    const query = `UPDATE rh_employe SET ${fields.join(', ')} WHERE idemploye = $${index} RETURNING *`;

    const { rows } = await pool.query(query, values);

    if (facePath) {
      await pool.query(
        `UPDATE rh_employe_authentification SET face_template = $1, date_enregistrement_visage = NOW() WHERE idemploye = $2`,
        [facePath, id]
      );
    }

    res.json({ success: true, message: 'Employé modifié avec succès', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /rh_employe/:id:', err);
    res.status(500).json({ error: 'Erreur mise à jour employé', details: err.message });
  }
});




// ==============================================================================
// 1. ROUTE GET : AFFICHER TOUS LES EMPLOYÉS (AVEC RECHERCHE ET FILTRES)
// ==============================================================================
router.get('/rh_employe', async (req, res) => {
  const { idagence, search, statut_employe, actif, departement } = req.query;

  if (!idagence) {
    return res.status(400).json({ error: 'Le paramètre "idagence" est obligatoire.' });
  }

  try {
    let queryText = `
      SELECT 
        e.idemploye,
        e.idagence,
        e.code_employe,
        e.matricule,
        e.nom,
        e.prenom,
        e.nom_complet,
        e.sexe,
        e.telephone,
        e.telephone2,
        e.email,
        e.adresse,
        e.ville,
        e.pays,
        e.date_naissance,
        e.date_embauche,
        e.date_sortie,
        e.fonction,
        e.service,
        e.departement,
        e.poste,
        e.idsuperieur,
        s.nom_complet AS superieur_nom,
        e.type_contrat,
        e.statut_employe,
        e.salaire_mensuel,
        e.montant_heure,
        e.heures_mensuelles_theoriques,
        e.utiliser_qr,
        e.utiliser_codebarre,
        e.utiliser_visage,
        e.utiliser_signature,
        e.qr_token,
        e.photo,
        e.signature,
        e.observation,
        e.actif,
        e.date_creation,
        e.date_modification,
        a.face_template
      FROM rh_employe e
      LEFT JOIN rh_employe s ON e.idsuperieur = s.idemploye
      LEFT JOIN rh_employe_authentification a ON e.idemploye = a.idemploye AND e.idagence = a.idagence
      WHERE e.idagence = $1
    `;

    const values = [idagence];
    let index = 2;

    // 🔍 Recherche dynamique multi-champs
    if (search && search.trim() !== '') {
      queryText += ` AND (
        e.nom ILIKE $${index} OR 
        e.prenom ILIKE $${index} OR 
        e.nom_complet ILIKE $${index} OR 
        e.code_employe ILIKE $${index} OR 
        e.matricule ILIKE $${index} OR 
        e.fonction ILIKE $${index} OR 
        e.telephone ILIKE $${index} OR 
        e.departement ILIKE $${index}
      )`;
      values.push(`%${search.trim()}%`);
      index++;
    }

    // 🏷️ Filtre par statut ('ACTIF', 'CONGE', etc.)
    if (statut_employe && statut_employe.trim() !== '') {
      queryText += ` AND e.statut_employe = $${index}`;
      values.push(statut_employe.trim());
      index++;
    }

    // 🏢 Filtre par département
    if (departement && departement.trim() !== '') {
      queryText += ` AND e.departement = $${index}`;
      values.push(departement.trim());
      index++;
    }

    // ⚡ Filtre Actif / Inactif
    if (actif !== undefined && actif !== '') {
      queryText += ` AND e.actif = $${index}`;
      values.push(actif === 'true' || actif === true);
      index++;
    }

    // Tri par nom et prénom
    queryText += ` ORDER BY e.nom ASC, e.prenom ASC`;

    const { rows } = await pool.query(queryText, values);

    res.json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('Erreur GET /rh_employe:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des employés', details: err.message });
  }
});

// ==============================================================================
// 2. ROUTE GET : AFFICHER LE DÉTAIL D'UN SEUL EMPLOYÉ PAR SON ID
// ==============================================================================
router.get('/rh_employe/:id', async (req, res) => {
  const { id } = req.params;
  const { idagence } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID employé requis.' });
  }

  try {
    let queryText = `
      SELECT 
        e.*,
        s.nom_complet AS superieur_nom,
        a.face_template,
        a.qr_code AS auth_qr_code,
        a.date_enregistrement_visage,
        a.date_enregistrement_qr
      FROM rh_employe e
      LEFT JOIN rh_employe s ON e.idsuperieur = s.idemploye
      LEFT JOIN rh_employe_authentification a ON e.idemploye = a.idemploye AND e.idagence = a.idagence
      WHERE e.idemploye = $1
    `;
    const values = [id];

    if (idagence) {
      queryText += ` AND e.idagence = $2`;
      values.push(idagence);
    }

    const { rows } = await pool.query(queryText, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Employé introuvable.' });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    console.error('Erreur GET /rh_employe/:id:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération de la fiche employé', details: err.message });
  }
});





///  EMPLOYEUR



// ==============================================================================
// 1. LISTE DES PRÉSENCES DU JOUR / DATE SÉLECTIONNÉE (ESPACE EMPLOYEUR)
// ==============================================================================
router.get('/rh_manager_presences', async (req, res) => {
  const { idagence, date } = req.query;

  if (!idagence) {
    return res.status(400).json({ error: 'idagence est obligatoire.' });
  }

  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const query = `
      SELECT 
        e.idemploye,
        e.code_employe,
        e.nom,
        e.prenom,
        e.nom_complet,
        e.fonction,
        e.departement,
        e.montant_heure,
        e.photo,
        p.idpresence,
        p.date,
        p.heure_arrivee,
        p.heure_depart,
        p.heure_arrivee_approuvee,
        p.heure_depart_approuvee,
        p.calcul_approuve,
        p.heures_calculees,
        p.heures_payables,
        p.montant_calcule,
        p.statut,
        p.methode_arrivee,
        p.methode_depart
      FROM rh_employe e
      LEFT JOIN rh_presence p 
        ON e.idemploye = p.idemploye 
        AND e.idagence = p.idagence 
        AND p.date = $2
      WHERE e.idagence = $1 AND e.actif = true
      ORDER BY e.nom ASC, e.prenom ASC
    `;

    const { rows } = await pool.query(query, [idagence, targetDate]);

    res.json({
      success: true,
      date: targetDate,
      total: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('Erreur GET /rh_manager_presences:', err);
    res.status(500).json({ error: 'Erreur récupération des présences', details: err.message });
  }
});

// ==============================================================================
// 2. TOUT VALIDER D'UN COUP POUR UNE DATE (BATCH APPROVE)
// ==============================================================================
router.post('/rh_valider_toutes_presences', async (req, res) => {
  const { idagence, date, valide_par } = req.body;

  if (!idagence || !date || !valide_par) {
    return res.status(400).json({ error: 'idagence, date et valide_par sont requis.' });
  }

  try {
    const query = `
      UPDATE rh_presence p
      SET 
        heure_arrivee_approuvee = true,
        heure_depart_approuvee = true,
        calcul_approuve = true,
        arrivee_approuvee_par = $1,
        depart_approuve_par = $1,
        calcul_approuve_par = $1,
        arrivee_date_approbation = NOW(),
        depart_date_approbation = NOW(),
        date_calcul_approbation = NOW(),
        heures_payables = p.heures_calculees,
        montant_calcule = (p.heures_calculees * p.taux_horaire_applique),
        statut = 'APPROUVE',
        date_modification = NOW()
      WHERE p.idagence = $2 
        AND p.date = $3 
        AND p.heure_arrivee IS NOT NULL 
        AND p.calcul_approuve = false
      RETURNING p.idpresence;
    `;

    const { rowCount } = await pool.query(query, [valide_par, idagence, date]);

    res.json({
      success: true,
      message: `${rowCount} fiche(s) de présence validée(s) avec succès.`,
      nb_valides: rowCount
    });
  } catch (err) {
    console.error('Erreur POST /rh_valider_toutes_presences:', err);
    res.status(500).json({ error: 'Erreur lors de la validation globale', details: err.message });
  }
});

// ==============================================================================
// 3. LISTE DES DEMANDES DE PAIEMENT & AVANCES EN COURS
// ==============================================================================
router.get('/rh_manager_demandes', async (req, res) => {
  const { idagence, statut } = req.query;

  if (!idagence) {
    return res.status(400).json({ error: 'idagence requis.' });
  }

  try {
    let query = `
      SELECT 
        d.*,
        e.nom,
        e.prenom,
        e.nom_complet,
        e.code_employe,
        e.fonction,
        e.telephone,
        e.photo
      FROM rh_demande_paiement d
      JOIN rh_employe e ON d.idemploye = e.idemploye AND d.idagence = e.idagence
      WHERE d.idagence = $1
    `;
    const values = [idagence];

    if (statut && statut.trim() !== '') {
      query += ` AND d.statut = $2`;
      values.push(statut.trim());
    }

    query += ` ORDER BY d.date_creation DESC`;

    const { rows } = await pool.query(query, values);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erreur GET /rh_manager_demandes:', err);
    res.status(500).json({ error: 'Erreur récupération des demandes', details: err.message });
  }
});

// ==============================================================================
// 4. RAPPORT FINANCIER & RAPPORT DES AVANCES EN HEURES
// ==============================================================================
router.get('/rh_manager_rapport_financier', async (req, res) => {
  const { idagence, idmois, idannee } = req.query;

  if (!idagence || !idmois || !idannee) {
    return res.status(400).json({ error: 'idagence, idmois et idannee sont requis.' });
  }

  try {
    const query = `
      SELECT 
        e.idemploye,
        e.code_employe,
        e.nom_complet,
        e.fonction,
        e.montant_heure,
        
        -- Heures et montants approuvés
        COALESCE(SUM(CASE WHEN p.calcul_approuve = true THEN p.heures_payables ELSE 0 END), 0) AS heures_approuvees,
        COALESCE(SUM(CASE WHEN p.calcul_approuve = true THEN p.montant_calcule ELSE 0 END), 0) AS montant_total_gagne,
        
        -- Heures et montants déjà payés
        COALESCE((
          SELECT SUM(pa.heures_payees) 
          FROM rh_paiement pa 
          WHERE pa.idemploye = e.idemploye AND pa.idagence = e.idagence AND pa.idmois = $2 AND pa.idannee = $3 AND pa.paye = true
        ), 0) AS heures_payees,

        COALESCE((
          SELECT SUM(pa.montant) 
          FROM rh_paiement pa 
          WHERE pa.idemploye = e.idemploye AND pa.idagence = e.idagence AND pa.idmois = $2 AND pa.idannee = $3 AND pa.paye = true
        ), 0) AS montant_paye,

        -- Total des avances d'heures accordées
        COALESCE((
          SELECT SUM(d.heures_demandees)
          FROM rh_demande_paiement d
          WHERE d.idemploye = e.idemploye AND d.idagence = e.idagence AND d.idmois = $2 AND d.idannee = $3 
            AND d.type_demande = 'AVANCE_HEURES' AND d.statut IN ('ACCORDEE', 'APPROUVEE')
        ), 0) AS heures_avance_accordees,

        COALESCE((
          SELECT SUM(d.montant_demande)
          FROM rh_demande_paiement d
          WHERE d.idemploye = e.idemploye AND d.idagence = e.idagence AND d.idmois = $2 AND d.idannee = $3 
            AND d.type_demande = 'AVANCE_HEURES' AND d.statut IN ('ACCORDEE', 'APPROUVEE')
        ), 0) AS montant_avance_accorde

      FROM rh_employe e
      LEFT JOIN rh_presence p 
        ON e.idemploye = p.idemploye AND e.idagence = p.idagence AND p.idmois = $2 AND p.idannee = $3
      WHERE e.idagence = $1 AND e.actif = true
      GROUP BY e.idemploye, e.code_employe, e.nom_complet, e.fonction, e.montant_heure
      ORDER BY e.nom_complet ASC
    `;

    const { rows } = await pool.query(query, [idagence, idmois, idannee]);

    // Calculs globaux entreprise
    let totalGeneralAPayer = 0;
    let totalGeneralPaye = 0;
    let totalGeneralAvances = 0;

    const formattedData = rows.map(r => {
      const hApprouvees = parseFloat(r.heures_approuvees);
      const hPayees = parseFloat(r.heures_payees);
      const taux = parseFloat(r.montant_heure);
      const resteHeures = Math.max(0, hApprouvees - hPayees);
      const resteMontant = resteHeures * taux;

      totalGeneralAPayer += resteMontant;
      totalGeneralPaye += parseFloat(r.montant_paye);
      totalGeneralAvances += parseFloat(r.montant_avance_accorde);

      return {
        ...r,
        heures_restantes: resteHeures,
        montant_restant_a_payer: resteMontant
      };
    });

    res.json({
      success: true,
      data: formattedData,
      totaux_entreprise: {
        total_a_payer_restant: totalGeneralAPayer,
        total_deja_paye: totalGeneralPaye,
        total_avances_accordees: totalGeneralAvances
      }
    });
  } catch (err) {
    console.error('Erreur GET /rh_manager_rapport_financier:', err);
    res.status(500).json({ error: 'Erreur rapport financier', details: err.message });
  }
});


module.exports = router;