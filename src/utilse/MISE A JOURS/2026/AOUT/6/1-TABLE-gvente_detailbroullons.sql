CREATE TABLE IF NOT EXISTS gvente_detailbroullons (
    id SERIAL PRIMARY KEY,
    idagence INT NOT NULL,
    idarticle INT NOT NULL,
    idlot INT,
    idunite INT,
    quantite NUMERIC(15, 4) DEFAULT 0,
    poid_unitaire NUMERIC(15, 4) DEFAULT 0,
    prixvente_brut NUMERIC(15, 2) DEFAULT 0,
    remise NUMERIC(15, 2) DEFAULT 0,
    numerolot VARCHAR(100),
    dateperemption DATE,
    etat VARCHAR(50) DEFAULT 'brouillon',
    datevente DATE NOT NULL,
    idjrnal INT,
    idmois INT,
    idannee INT,
    idtypecl INT,
    iduser INT,
    idclients INT,
    iddepot INT,
    prixbase NUMERIC(15, 2) DEFAULT 0,
    taux NUMERIC(15, 2) DEFAULT 0,
    prixassure NUMERIC(15, 2) DEFAULT 0,
    prixassurance NUMERIC(15, 2) DEFAULT 0,
    idassureur INT,
    codevente VARCHAR(100) NOT NULL,
    refoperation TEXT,
    ref_piece TEXT,
    designation TEXT,             -- Désignation de l'article
    designationunite VARCHAR(50)  -- Libellé de l'unité
);

-- Index pour optimiser les recherches par date et agence
CREATE INDEX IF NOT EXISTS idx_brouillons_date_agence ON gvente_detailbroullons(idagence, datevente);
CREATE INDEX IF NOT EXISTS idx_brouillons_codevente ON gvente_detailbroullons(codevente);




select * from gvente_detailbroullons