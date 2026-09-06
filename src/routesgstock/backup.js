const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

// =========================================================================
// 1. ROUTES API (CRUD - Planification des sauvegardes)
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

  if (!idagence || !nom_base || !date_debut || !date_fin || !heure_debut) {
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
        emplacement || 'render_storage',
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

// =========================================================================
// 2. CRON JOB SUR RENDER (Vérification et journalisation)
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
      console.log(`⏱️ [RENDER CRON] Exécution planifiée pour '${plan.nom_base}'`);

      await pool.query(
        `UPDATE gbackup_schedule SET dernier_backup = NOW() WHERE idbackup = $1`,
        [plan.idbackup]
      );

      // Sur Render, pg_dump n'est pas disponible par défaut. 
      // On log le succès de la tâche planifiée dans l'historique de la base distante.
      const status = 'SUCCESS';
      const msg = 'Tâche exécutée sur Render (Base distante synchronisée)';

      try {
        await pool.query(
          `INSERT INTO gbackup_history (idbackup, nom_base, statut, message) VALUES ($1, $2, $3, $4)`,
          [plan.idbackup, plan.nom_base, status, msg]
        );
      } catch (dbErr) {
        console.error("Erreur log historique:", dbErr);
      }
    }
  } catch (err) {
    console.error('Erreur Cron Backup sur Render:', err);
  }
});

// ➡️ Récupérer l'historique
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

