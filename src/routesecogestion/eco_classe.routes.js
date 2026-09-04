const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ===================================================
// CONFIGURATION DE MULTER POUR LA SIGNATURE CLASSE
// ===================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/eco/classes/signature');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.floor(Math.random() * 999999);
    cb(null, `signature-${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

// ===================================================
// 🔵 1. GET CLASSES (avec jointures + recherche)
// ===================================================
router.get('/classe', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({ success: false, message: 'idagence obligatoire' });
  }

  try {
    let sql = `
      SELECT 
        c.*,
        next_c.libelleclasse AS nom_classe_suivante,
        linked_c.libelleclasse AS nom_classe_liee,
        e.nomcomplet AS nom_enseignant_titulaire
      FROM eco_classe c
      LEFT JOIN eco_classe next_c ON c.idclassesuivant = next_c.idclasse
      LEFT JOIN eco_classe linked_c ON c.idclasseliee = linked_c.idclasse
      LEFT JOIN eco_enseignant e ON c.idenseignanttitulaire = e.idenseignant
      WHERE c.idagence = $1
    `;
    const params = [idagence];

    if (search && search.trim() !== '') {
      sql += ` AND (c.libelleclasse ILIKE $2 OR c.abreviationclasse ILIKE $2)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY c.idclasse DESC`;

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===================================================
// 🟢 2. ENREGISTRER UNE CLASSE
// ===================================================
router.post('/classe', upload.single('signature'), async (req, res) => {
  try {
    const data = req.body;
    const signature = req.file 
      ? `uploads/eco/classes/signature/${req.file.filename}` 
      : null;

    // Note : totalfraisformation est GENERATED ALWAYS AS, on ne l'insère pas
    const result = await pool.query(
      `INSERT INTO eco_classe (
        idagence, libelleclasse, fraisinscription, fraisformation,
        decisionmoyenne, abreviationclasse, idclassesuivant,
        idenseignanttitulaire, signature, idclasseliee,
        dureetotalcredit, frequencecredit, commissioncredit, etat
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        data.idagence,
        data.libelleclasse,
        data.fraisinscription ? parseFloat(data.fraisinscription) : 0.00,
        data.fraisformation ? parseFloat(data.fraisformation) : 0.00,
        data.decisionmoyenne ? parseFloat(data.decisionmoyenne) : 0.00,
        data.abreviationclasse || null,
        data.idclassesuivant ? parseInt(data.idclassesuivant) : null,
        data.idenseignanttitulaire ? parseInt(data.idenseignanttitulaire) : null,
        signature,
        data.idclasseliee ? parseInt(data.idclasseliee) : null,
        data.dureetotalcredit ? parseFloat(data.dureetotalcredit) : 0.00,
        data.frequencecredit ? parseFloat(data.frequencecredit) : 0.00,
        data.commissioncredit ? parseFloat(data.commissioncredit) : 0.00,
        data.etat === 'false' ? false : true
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Classe créée avec succès',
      data: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===================================================
// 🟡 3. MODIFIER UNE CLASSE
// ===================================================
router.put('/classe/:id', upload.single('signature'), async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    let fields = [];
    let values = [];
    let i = 1;

    // totalfraisformation est généré automatiquement par PostgreSQL, on l'exclut de la modif
    const skip = ['idclasse', 'idagence', 'totalfraisformation'];

    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && !skip.includes(key)) {
        fields.push(`${key} = $${i++}`);
        if (['idclassesuivant', 'idenseignanttitulaire', 'idclasseliee'].includes(key)) {
          values.push(data[key] ? parseInt(data[key]) : null);
        } else if (['fraisinscription', 'fraisformation', 'decisionmoyenne', 'dureetotalcredit', 'frequencecredit', 'commissioncredit'].includes(key)) {
          values.push(data[key] ? parseFloat(data[key]) : 0.00);
        } else if (key === 'etat') {
          values.push(data[key] === 'true' || data[key] === true);
        } else {
          values.push(data[key]);
        }
      }
    });

    if (req.file) {
      fields.push(`signature = $${i++}`);
      values.push(`uploads/eco/classes/signature/${req.file.filename}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucune donnée modifiée' });
    }

    values.push(id);

    const sql = `
      UPDATE eco_classe
      SET ${fields.join(', ')}
      WHERE idclasse = $${i}
      RETURNING *
    `;

    const result = await pool.query(sql, values);

    res.json({
      success: true,
      message: 'Classe modifiée avec succès',
      data: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===================================================
// 🔴 4. SUPPRIMER UNE CLASSE
// ===================================================
router.delete('/classe/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const old = await pool.query(`SELECT signature FROM eco_classe WHERE idclasse=$1`, [id]);
    if (old.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Classe introuvable' });
    }

    await pool.query(`DELETE FROM eco_classe WHERE idclasse=$1`, [id]);

    const signatureFile = old.rows[0].signature;
    if (signatureFile) {
      const fullPath = path.join(__dirname, '..', signatureFile);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    res.json({ success: true, message: 'Classe supprimée' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;