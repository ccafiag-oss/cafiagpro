const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { exec } = require('child_process');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

// =========================================================================
// 🛠️ HELPER : Détection automatique de pg_dump / pg_restore
// =========================================================================
function getPgBin(toolName) {
  if (process.env.PG_BIN_PATH) {
    const customPath = path.join(process.env.PG_BIN_PATH, `${toolName}.exe`);
    if (fs.existsSync(customPath)) return `"${customPath}"`;
  }

  if (process.platform === 'win32') {
    const basePgDir = 'C:\\Program Files\\PostgreSQL';
    if (fs.existsSync(basePgDir)) {
      try {
        const versions = fs.readdirSync(basePgDir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
        for (const ver of versions) {
          const exePath = path.join(basePgDir, ver, 'bin', `${toolName}.exe`);
          if (fs.existsSync(exePath)) return `"${exePath}"`;
        }
      } catch (err) {
        console.error("Erreur détection PostgreSQL:", err);
      }
    }
  }
  return toolName;
}

// =========================================================================
// 🛠️ HELPER : Détection automatique de rclone.exe sous Windows
// =========================================================================
function getRcloneBin() {
  if (process.env.RCLONE_BIN_PATH && fs.existsSync(process.env.RCLONE_BIN_PATH)) {
    return `"${process.env.RCLONE_BIN_PATH}"`;
  }

  const commonPaths = [
    'C:\\rclone\\rclone.exe',
    'C:\\Program Files\\rclone\\rclone.exe',
    path.join(process.env.USERPROFILE || '', 'rclone', 'rclone.exe'),
    path.join(process.env.USERPROFILE || '', 'Downloads', 'rclone', 'rclone.exe')
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return `"${p}"`;
    }
  }

  return 'rclone';
}

// =========================================================================
// ☁️ HELPER : Transfert vers Google Drive avec Rclone
// =========================================================================
function uploadToGoogleDrive(localFilePath, customRemoteFolder = null) {
  return new Promise((resolve, reject) => {
    const remote = process.env.RCLONE_REMOTE_NAME || 'gdrive';
    const folder = customRemoteFolder || process.env.RCLONE_GDRIVE_DIR || 'Sauvegardes_Postgres';
    
    const rcloneBin = getRcloneBin();
    const cmd = `${rcloneBin} copy "${localFilePath}" "${remote}:${folder}"`;

    console.log(`☁️ [RCLONE] Transfert en cours vers Google Drive (${remote}:${folder})...`);

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ [RCLONE] Erreur lors du transfert :`, stderr || error.message);
        return reject(error);
      }
      console.log(`✅ [RCLONE] Sauvegarde synchronisée sur Google Drive : ${path.basename(localFilePath)}`);
      resolve(stdout);
    });
  });
}

// =========================================================================
// ⚙️ HELPER : Analyse de DATABASE_URL ou utilisation des variables séparées
// =========================================================================
function getDbConnectionConfig() {
  if (process.env.DATABASE_URL) {
    try {
      const parsedUrl = new URL(process.env.DATABASE_URL);
      return {
        host: parsedUrl.hostname,
        port: parsedUrl.port || '5432',
        user: decodeURIComponent(parsedUrl.username),
        password: decodeURIComponent(parsedUrl.password),
        database: parsedUrl.pathname.replace(/^\//, '')
      };
    } catch (e) {
      console.error("Erreur lors du parsing de DATABASE_URL:", e.message);
    }
  }

  return {
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || '5432',
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE
  };
}

// =========================================================================
// 1. ROUTES API (CRUD)
// =========================================================================

router.post('/gbackup-schedule', async (req, res) => {
  const {
    idagence,
    nom_base,
    emplacement,
    date_debut,
    date_fin,
    heure_debut,
    heure_fin,
    frequence_minutes,
    description,
    actif
  } = req.body;

  if (!idagence || !nom_base || !emplacement || !date_debut || !date_fin || !heure_debut) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO gbackup_schedule (
        idagence, nom_base, emplacement, date_debut, date_fin, 
        heure_debut, heure_fin, frequence_minutes, description, actif
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        idagence,
        nom_base,
        emplacement,
        date_debut,
        date_fin,
        heure_debut,
        heure_fin || '23:59',
        parseInt(frequence_minutes) || 5,
        description || '',
        actif !== undefined ? actif : true
      ]
    );

    res.status(201).json({ message: 'Planification créée avec succès', data: result.rows[0] });
  } catch (err) {
    console.error('Erreur POST /gbackup-schedule:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/gbackup-schedule', async (req, res) => {
  const { idagence } = req.query;
  if (!idagence) return res.status(400).json({ error: 'Le paramètre idagence est requis.' });

  try {
    const { rows } = await pool.query(
      'SELECT * FROM gbackup_schedule WHERE idagence = $1 ORDER BY idbackup DESC',
      [idagence]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /gbackup-schedule:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/gbackup-schedule/:id', async (req, res) => {
  const { id } = req.params;
  const { nom_base, emplacement, date_debut, date_fin, heure_debut, heure_fin, frequence_minutes, description, actif } = req.body;

  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE gbackup_schedule SET 
        nom_base = COALESCE($1, nom_base),
        emplacement = COALESCE($2, emplacement),
        date_debut = COALESCE($3, date_debut),
        date_fin = COALESCE($4, date_fin),
        heure_debut = COALESCE($5, heure_debut),
        heure_fin = COALESCE($6, heure_fin),
        frequence_minutes = COALESCE($7, frequence_minutes),
        description = COALESCE($8, description),
        actif = COALESCE($9, actif)
      WHERE idbackup = $10 RETURNING *`,
      [nom_base, emplacement, date_debut, date_fin, heure_debut, heure_fin, frequence_minutes ? parseInt(frequence_minutes) : null, description, actif, id]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Planification introuvable' });
    res.json({ message: 'Mise à jour réussie', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /gbackup-schedule:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/gbackup-schedule/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM gbackup_schedule WHERE idbackup = $1', [id]);
    res.json({ message: 'Planification supprimée' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/gbackup/execute-restore', async (req, res) => {
  const { nom_base, filePath } = req.body;

  if (!nom_base || !filePath) {
    return res.status(400).json({ error: 'Nom de base et chemin de fichier requis.' });
  }

  const dbConfig = getDbConnectionConfig();
  const pgRestore = getPgBin('pg_restore');
  const cmd = `${pgRestore} -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${nom_base} -v --clean "${filePath}"`;

  exec(cmd, { env: { ...process.env, PGPASSWORD: dbConfig.password } }, (error, stdout, stderr) => {
    if (error) {
      console.error('Erreur Restauration:', stderr || error.message);
      return res.status(500).json({ error: 'Échec de la restauration', details: stderr || error.message });
    }
    res.json({ message: 'Restauration effectuée avec succès !' });
  });
});

// =========================================================================
// 2. CRON JOB : PLANIFICATEUR AUTOMATIQUE + UPLOAD GOOGLE DRIVE
// =========================================================================
cron.schedule('* * * * *', async () => {
  try {
    const query = `
      SELECT * FROM gbackup_schedule 
      WHERE actif = true 
      AND CURRENT_DATE BETWEEN date_debut AND date_fin
      AND (
        heure_debut = heure_fin 
        OR CURRENT_TIME::time BETWEEN heure_debut AND heure_fin
      )
      AND (
        dernier_backup IS NULL 
        OR EXTRACT(EPOCH FROM (NOW() - dernier_backup)) / 60 >= frequence_minutes
      )
    `;

    const { rows } = await pool.query(query);

    for (const plan of rows) {
      console.log(`⏱️ [LANCEMENT] Backup pour '${plan.nom_base}' (Fréquence : chaque ${plan.frequence_minutes} min)`);

      await pool.query(
        `UPDATE gbackup_schedule SET dernier_backup = NOW() WHERE idbackup = $1`,
        [plan.idbackup]
      );

      const backupDir = plan.emplacement && (plan.emplacement.startsWith('/') || plan.emplacement.includes(':')) 
        ? plan.emplacement 
        : path.join(__dirname, '../backups');

      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

      const now = new Date();
      const timeStamp = now.getFullYear() + "-" + 
        String(now.getMonth() + 1).padStart(2, '0') + "-" + 
        String(now.getDate()).padStart(2, '0') + "_" + 
        String(now.getHours()).padStart(2, '0') + "-" + 
        String(now.getMinutes()).padStart(2, '0') + "-" + 
        String(now.getSeconds()).padStart(2, '0');

      const filePath = path.join(backupDir, `${plan.nom_base}_${timeStamp}.backup`);

      const dbConfig = getDbConnectionConfig();
      const pgDump = getPgBin('pg_dump');
      const cmd = `${pgDump} -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -F c -b -f "${filePath}" ${plan.nom_base}`;

      exec(cmd, { env: { ...process.env, PGPASSWORD: dbConfig.password } }, async (err, stdout, stderr) => {
        const isFileEmpty = fs.existsSync(filePath) && fs.statSync(filePath).size === 0;
        let status = (err || isFileEmpty) ? 'FAILED' : 'SUCCESS';
        let msg = err ? (stderr || err.message) : (isFileEmpty ? 'Fichier vide (0 octet)' : 'Sauvegarde locale réussie');

        if (status === 'SUCCESS') {
          console.log(`✅ [SUCCÈS] Sauvegarde locale créée : ${filePath}`);

          try {
            await uploadToGoogleDrive(filePath, `${plan.nom_base}_backups`);
            msg += ' + Synchronisé sur Google Drive';
          } catch (rcloneErr) {
            msg += ` (Avertissement: Échec upload Google Drive: ${rcloneErr.message})`;
          }
        } else {
          console.error(`❌ [ÉCHEC] Sauvegarde : ${msg}`);
        }

        try {
          await pool.query(
            `INSERT INTO gbackup_history (idbackup, nom_base, statut, message) VALUES ($1, $2, $3, $4)`,
            [plan.idbackup, plan.nom_base, status, msg]
          );
        } catch (dbErr) {
          console.error("Erreur log historique:", dbErr);
        }
      });
    }
  } catch (err) {
    console.error('Erreur Cron Backup:', err);
  }
});

router.get('/gbackup-history', async (req, res) => {
  const { date_debut, date_fin, idagence } = req.query;

  const today = new Date().toISOString().split('T')[0];
  const debut = date_debut || today;
  const fin = date_fin || today;

  try {
    const query = `
      SELECT 
        h.idbackup,
        h.nom_base,
        h.statut,
        h.message,
        h.date_execution
      FROM gbackup_history h
      LEFT JOIN gbackup_schedule s ON h.idbackup = s.idbackup
      WHERE h.date_execution::date BETWEEN $1 AND $2
      ${idagence ? 'AND s.idagence = $3' : ''}
      ORDER BY h.date_execution DESC
    `;

    const params = idagence ? [debut, fin, idagence] : [debut, fin];
    const { rows } = await pool.query(query, params);

    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /gbackup-history:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;