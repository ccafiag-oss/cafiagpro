
select * from categorie_note
select * from note_pages
-- 1. Table des Catégories de Notes
CREATE TABLE IF NOT EXISTS categorie_note (
    id SERIAL PRIMARY KEY,
    idagence INT NOT NULL,
    iduser VARCHAR(50) NOT NULL,
    nom_categorie VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Clé unique par agence, utilisateur et nom de catégorie
    CONSTRAINT uq_cat_agence_user UNIQUE (idagence, iduser, nom_categorie)
);

-- 2. Table des Pages de Notes
CREATE TABLE IF NOT EXISTS note_pages (
    id SERIAL PRIMARY KEY,
    idagence INT NOT NULL,
    iduser VARCHAR(50) NOT NULL,
    category VARCHAR(255) NOT NULL,
    page_index INTEGER NOT NULL,
    title VARCHAR(255),
    path_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Clé unique par agence, utilisateur, cahier/catégorie et index de page
    CONSTRAINT uq_page_agence_user UNIQUE (idagence, iduser, category, page_index)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_note_pages_user ON note_pages(idagence, iduser, category);
CREATE INDEX IF NOT EXISTS idx_note_pages_sync ON note_pages(idagence, iduser, updated_at);