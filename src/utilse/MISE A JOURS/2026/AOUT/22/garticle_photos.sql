CREATE TABLE IF NOT EXISTS garticle_photos (
    idphoto SERIAL PRIMARY KEY,
    idagence INT NOT NULL,
    idarticle INT NOT NULL,
    idcategorie INT,
    prixvente NUMERIC(15,2) DEFAULT 0,
    description TEXT,
    photo TEXT,                   -- Photo principale de couverture
    galeries JSONB DEFAULT '[]',  -- Tableau JSON des photos secondaires : ["url1", "url2", ...]
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_article_photos_agence UNIQUE (idagence, idarticle)
);

CREATE INDEX IF NOT EXISTS idx_garticle_photos_cat ON garticle_photos(idagence, idcategorie);


-- Ajout de la colonne si la table existe déjà
ALTER TABLE garticle_photos 
ADD COLUMN IF NOT EXISTS idsouscategoriedetail INT;

-- Index pour accélérer le filtrage par sous-catégorie détail
CREATE INDEX IF NOT EXISTS idx_garticle_photos_souscatdetail 
ON garticle_photos(idagence, idcategorie, idsouscategoriedetail);





