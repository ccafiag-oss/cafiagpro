Select * from  gbackup_schedule
-- Table des planifications
CREATE TABLE IF NOT EXISTS gbackup_schedule (
    idbackup SERIAL PRIMARY KEY,
    idagence INT NOT NULL,
    nom_base VARCHAR(150) NOT NULL,
    emplacement VARCHAR(255) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    heure_debut TIME NOT NULL DEFAULT '08:00:00',
    heure_fin TIME NOT NULL DEFAULT '18:00:00',
    frequence_minutes INT NOT NULL DEFAULT 5, -- Fréquence en minutes (ex: 2, 5, 10, 60, 1440)
    dernier_backup TIMESTAMP,                  -- Date/Heure de la dernière exécution
    description TEXT,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table de l'historique des sauvegardes
CREATE TABLE IF NOT EXISTS gbackup_history (
    idhistory SERIAL PRIMARY KEY,
    idbackup INT REFERENCES gbackup_schedule(idbackup) ON DELETE CASCADE,
    nom_base VARCHAR(150),
    date_execution TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    statut VARCHAR(20), -- 'SUCCESS' ou 'FAILED'
    message TEXT
);

-- Si votre table gbackup_schedule existe déjà, ajoutez simplement ces colonnes :
-- ALTER TABLE gbackup_schedule ADD COLUMN IF NOT EXISTS frequence_minutes INT DEFAULT 5;
-- ALTER TABLE gbackup_schedule ADD COLUMN IF NOT EXISTS dernier_backup TIMESTAMP;