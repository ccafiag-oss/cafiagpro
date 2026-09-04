const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { exec } = require('child_process');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

// =========================================================================
// 🛠️ HELPER : Détection automatique de pg_dump / pg_restore sous Ubuntu
// =========================================================================
function getPgBin(toolName) {
  if (process.env.PG_BIN_PATH) {
    const customPath = path.join(process.env.PG_BIN_PATH, toolName);
    if (fs.existsSync(customPath)) return `"${customPath}"`;
  }
  return toolName; // Sur Ubuntu, pg_dump et pg_restore sont généralement dans le PATH global (/usr/bin/pg_dump)
}

// =========================================================================
// 🛠️ HELPER : Détection automatique de rclone sous Ubuntu
// =========================================================================
function getRcloneBin() {
  if (process.env.RCLONE_BIN_PATH && fs.existsSync(process.env.RCLONE_BIN_PATH)) {
    return `"${process.env.RCLONE_BIN_PATH}"`;
  }

  // Chemins d'installation classiques sous Linux / Ubuntu
  const commonPaths = [
    '/usr/bin/rclone',
    '/usr/local/bin/rclone',
    path.join(process.env.HOME || '', 'bin', 'rclone')
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return `"${p}"`;
    }
  }

  return 'rclone'; // Repli sur la commande globale si trouvée dans le PATH
}

// =========================================================================
// ☁️ HELPER : Transfert vers Google Drive avec Rclone
// =========================================================================
function uploadToGoogleDrive(localFilePath, customRemoteFolder = null) {
  return new Promise((resolve, reject) => {
    const remote = process.env.RCLONE_REMOTE_NAME || 'gdrive';
    const folder = customRemoteFolder || process.env.RCLONE_GDRIVE_DIR || 'Sauvegardes_Postgres';
    
    // Obtenir le chemin absolu vers rclone
    const rcloneBin = getRcloneBin();

    // Commande rclone sécurisée
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
// 1. ROUTES API (CRUD)
// =========================================================================

// ➡️ Créer une planification
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

// ➡️ Récupérer les planifications
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

// ➡️ Modifier une planification / Basculer l'état actif
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

// ➡️ Supprimer une planification
router.delete('/gbackup-schedule/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM gbackup_schedule WHERE idbackup = $1', [id]);
    res.json({ message: 'Planification supprimée' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ➡️ Restauration manuelle
router.post('/gbackup/execute-restore', async (req, res) => {
  const { nom_base, filePath } = req.body;

  if (!nom_base || !filePath) {
    return res.status(400).json({ error: 'Nom de base et chemin de fichier requis.' });
  }

  const dbUser = process.env.PG_USER;
  const dbHost = process.env.PG_HOST || 'localhost';
  const dbPass = process.env.PG_PASSWORD;
  const dbPort = process.env.PG_PORT || '5432';

  const pgRestore = getPgBin('pg_restore');
  const cmd = `${pgRestore} -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${nom_base} -v --clean "${filePath}"`;

  exec(cmd, { env: { ...process.env, PGPASSWORD: dbPass } }, (error, stdout, stderr) => {
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

      // Mettre à jour le timestamp pour éviter les exécutions en boucle
      await pool.query(
        `UPDATE gbackup_schedule SET dernier_backup = NOW() WHERE idbackup = $1`,
        [plan.idbackup]
      );

      const backupDir = plan.emplacement && (plan.emplacement.startsWith('/') || plan.emplacement.includes(':')) 
        ? plan.emplacement 
        : path.join(__dirname, '../backups');

      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

      // Horodatage
      const now = new Date();
      const timeStamp = now.getFullYear() + "-" + 
        String(now.getMonth() + 1).padStart(2, '0') + "-" + 
        String(now.getDate()).padStart(2, '0') + "_" + 
        String(now.getHours()).padStart(2, '0') + "-" + 
        String(now.getMinutes()).padStart(2, '0') + "-" + 
        String(now.getSeconds()).padStart(2, '0');

      const filePath = path.join(backupDir, `${plan.nom_base}_${timeStamp}.backup`);

      const dbUser = process.env.PG_USER;
      const dbHost = process.env.PG_HOST || 'localhost';
      const dbPass = process.env.PG_PASSWORD;
      const dbPort = process.env.PG_PORT || '5432';

      const pgDump = getPgBin('pg_dump');
      const cmd = `${pgDump} -h ${dbHost} -p ${dbPort} -U ${dbUser} -F c -b -f "${filePath}" ${plan.nom_base}`;

      exec(cmd, { env: { ...process.env, PGPASSWORD: dbPass } }, async (err, stdout, stderr) => {
        const isFileEmpty = fs.existsSync(filePath) && fs.statSync(filePath).size === 0;
        let status = (err || isFileEmpty) ? 'FAILED' : 'SUCCESS';
        let msg = err ? (stderr || err.message) : (isFileEmpty ? 'Fichier vide (0 octet)' : 'Sauvegarde locale réussie');

        if (status === 'SUCCESS') {
          console.log(`✅ [SUCCÈS] Sauvegarde locale créée : ${filePath}`);

          // 🚀 ENVOI VERS GOOGLE DRIVE VIA RCLONE
          try {
            await uploadToGoogleDrive(filePath, `${plan.nom_base}_backups`);
            msg += ' + Synchronisé sur Google Drive';
          } catch (rcloneErr) {
            msg += ` (Avertissement: Échec upload Google Drive: ${rcloneErr.message})`;
          }
        } else {
          console.error(`❌ [ÉCHEC] Sauvegarde : ${msg}`);
        }

        // Historique
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

// ➡️ Récupérer l'historique des sauvegardes avec filtre par dates
router.get('/gbackup-history', async (req, res) => {
  const { date_debut, date_fin, idagence } = req.query;

  // Par défaut: date du jour si non spécifiée
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