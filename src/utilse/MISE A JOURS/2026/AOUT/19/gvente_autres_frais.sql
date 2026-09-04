
select * from  gvente_autres_frais



CREATE TABLE IF NOT EXISTS gvente_autres_frais (
    id SERIAL PRIMARY KEY,
    ref_piece VARCHAR(50) NOT NULL,
    frais_transport NUMERIC(18,2) DEFAULT 0.00,
    autres_frais NUMERIC(18,2) DEFAULT 0.00,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour accélérer la recherche par ref_piece (codevente)
CREATE INDEX IF NOT EXISTS idx_gvente_autres_frais_ref_piece ON gvente_autres_frais(ref_piece);