-- ==============================================================================
-- SERVICGO - SCHEMA RELATIONNEL POSTGRESQL MULTI-AGENCES / MULTI-PAYS
-- Toutes les tables sont préfixées par 'servi_' sauf 'utilisateur'
-- Colonne 'idagence INTEGER' placée immédiatement après la clé primaire
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
 -- 33  OBLIGATOIR  ACTIVATION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Suppression propre si réinitialisation
DROP TABLE IF EXISTS servi_sync_events CASCADE;
DROP TABLE IF EXISTS servi_reviews CASCADE;
DROP TABLE IF EXISTS servi_appointments CASCADE;
DROP TABLE IF EXISTS servi_quotes CASCADE;
DROP TABLE IF EXISTS servi_service_requests CASCADE;
DROP TABLE IF EXISTS servi_provider_schedules CASCADE;
DROP TABLE IF EXISTS servi_products CASCADE;
DROP TABLE IF EXISTS servi_services CASCADE;
DROP TABLE IF EXISTS servi_providers CASCADE;
DROP TABLE IF EXISTS servi_categories CASCADE;

-- ==============================================================================
-- 1. TABLE : servi_categories (Catégories et Métiers)
-- ==============================================================================
CREATE TABLE servi_categories (
    id VARCHAR(50) NOT NULL,
    idagence INTEGER NOT NULL,
    name_fr VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    icon VARCHAR(50) NOT NULL DEFAULT 'wrench',
    color_hex VARCHAR(20) NOT NULL DEFAULT '#4F46E5',
    display_order INT DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    CONSTRAINT servi_categories_pkey PRIMARY KEY (id)
);

-- ==============================================================================
-- 2. TABLE : servi_providers (Profils professionnels, Artisans, Garages...)
-- ==============================================================================
CREATE TABLE servi_providers (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    idagence INTEGER NOT NULL,
    iduser INTEGER REFERENCES public.utilisateur(iduser) ON DELETE SET NULL,
    name VARCHAR(180) NOT NULL,
    category_id VARCHAR(50) NOT NULL REFERENCES servi_categories(id) ON DELETE RESTRICT,
    subcategory VARCHAR(100),
    description TEXT,
    phone_primary VARCHAR(35) NOT NULL,
    phone_whatsapp VARCHAR(35),
    email VARCHAR(150),
    country_code VARCHAR(10) NOT NULL DEFAULT 'TG',
    city VARCHAR(100) NOT NULL DEFAULT 'Lomé',
    district VARCHAR(120),
    address TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    rating NUMERIC(3, 2) DEFAULT 5.00 CHECK (rating >= 0 AND rating <= 5),
    review_count INT DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    is_open_now BOOLEAN DEFAULT TRUE,
    service_type_accepted VARCHAR(30) DEFAULT 'both' CHECK (service_type_accepted IN ('at_client', 'at_shop', 'both')),
    cover_image TEXT,
    gallery_images TEXT[] DEFAULT '{}',
    service_radius_km INT DEFAULT 15,
    badges TEXT[] DEFAULT '{"certifie_local"}',
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT servi_providers_pkey PRIMARY KEY (id)
);

-- ==============================================================================
-- 3. TABLE : servi_services (Prestations & Tarifs)
-- ==============================================================================
CREATE TABLE servi_services (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    idagence INTEGER NOT NULL,
    provider_id UUID NOT NULL REFERENCES servi_providers(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    description TEXT,
    price_estimate NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'XOF',
    service_type VARCHAR(30) NOT NULL DEFAULT 'both' CHECK (service_type IN ('at_client', 'at_shop', 'both')),
    duration_minutes INT DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT servi_services_pkey PRIMARY KEY (id)
);

-- ==============================================================================
-- 4. TABLE : servi_products (Articles / Produits en vente par le prestataire)
-- ==============================================================================
CREATE TABLE servi_products (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    idagence INTEGER NOT NULL,
    provider_id UUID NOT NULL REFERENCES servi_providers(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    description TEXT,
    price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'XOF',
    stock INT DEFAULT 0,
    photos TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT servi_products_pkey PRIMARY KEY (id)
);

-- ==============================================================================
-- 5. TABLE : servi_provider_schedules (Horaires d'ouverture hebdomadaires)
-- ==============================================================================
CREATE TABLE servi_provider_schedules (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    idagence INTEGER NOT NULL,
    provider_id UUID NOT NULL REFERENCES servi_providers(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dimanche, 1=Lundi...
    is_open BOOLEAN DEFAULT TRUE,
    open_time TIME DEFAULT '08:00:00',
    close_time TIME DEFAULT '19:00:00',
    CONSTRAINT servi_provider_schedules_pkey PRIMARY KEY (id),
    CONSTRAINT unq_provider_day UNIQUE (provider_id, day_of_week)
);

-- ==============================================================================
-- 6. TABLE : servi_service_requests (Demandes de services lancées par les clients)
-- ==============================================================================
CREATE TABLE servi_service_requests (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    idagence INTEGER NOT NULL,
    client_id INTEGER NOT NULL REFERENCES public.utilisateur(iduser) ON DELETE CASCADE,
    category_id VARCHAR(50) NOT NULL REFERENCES servi_categories(id),
    subcategory_id VARCHAR(100),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    urgency VARCHAR(30) NOT NULL DEFAULT 'today' CHECK (urgency IN ('urgent', 'today', 'this_week', 'planned')),
    service_type VARCHAR(30) NOT NULL DEFAULT 'at_client' CHECK (service_type IN ('at_client', 'at_shop')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address_text TEXT,
    target_radius_km INT DEFAULT 10,
    photo_urls TEXT[] DEFAULT '{}',
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT servi_service_requests_pkey PRIMARY KEY (id)
);

-- ==============================================================================
-- 7. TABLE : servi_quotes (Devis & Réponses des prestataires aux demandes)
-- ==============================================================================
CREATE TABLE servi_quotes (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    idagence INTEGER NOT NULL,
    request_id UUID NOT NULL REFERENCES servi_service_requests(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES servi_providers(id) ON DELETE CASCADE,
    proposed_price NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XOF',
    estimated_arrival VARCHAR(100),
    message TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT servi_quotes_pkey PRIMARY KEY (id)
);

-- ==============================================================================
-- 8. TABLE : servi_appointments (Rendez-vous et Réservations)
-- ==============================================================================
CREATE TABLE servi_appointments (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    idagence INTEGER NOT NULL,
    client_id INTEGER NOT NULL REFERENCES public.utilisateur(iduser) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES servi_providers(id) ON DELETE CASCADE,
    service_id UUID REFERENCES servi_services(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    location_type VARCHAR(30) NOT NULL DEFAULT 'at_client' CHECK (location_type IN ('at_client', 'at_shop')),
    address TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT servi_appointments_pkey PRIMARY KEY (id)
);

-- ==============================================================================
-- 9. TABLE : servi_reviews (Avis & Notations certifiés)
-- ==============================================================================
CREATE TABLE servi_reviews (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    idagence INTEGER NOT NULL,
    provider_id UUID NOT NULL REFERENCES servi_providers(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES public.utilisateur(iduser) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT servi_reviews_pkey PRIMARY KEY (id)
);

-- ==============================================================================
-- 10. TABLE : servi_sync_events (File de synchronisation hors-ligne)
-- ==============================================================================
CREATE TABLE servi_sync_events (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    idagence INTEGER NOT NULL,
    iduser INTEGER REFERENCES public.utilisateur(iduser) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    client_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    sync_status VARCHAR(20) DEFAULT 'synced',
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT servi_sync_events_pkey PRIMARY KEY (id)
);

-- ==============================================================================
-- INDEX D'OPTIMISATION & RECHERCHE GÉOGRAPHIQUE
-- ==============================================================================
CREATE INDEX idx_servi_providers_agency_coords ON servi_providers (idagence, latitude, longitude);
CREATE INDEX idx_servi_providers_category ON servi_providers (category_id);
CREATE INDEX idx_servi_services_provider ON servi_services (provider_id);
CREATE INDEX idx_servi_products_provider ON servi_products (provider_id);
CREATE INDEX idx_servi_requests_status ON servi_service_requests (idagence, status, created_at DESC);
CREATE INDEX idx_servi_appointments_client ON servi_appointments (client_id);
CREATE INDEX idx_servi_appointments_provider ON servi_appointments (provider_id);

-- ==============================================================================
-- FONCTION : Calcul de distance GPS (Formule Haversine en KM)
-- ==============================================================================
CREATE OR REPLACE FUNCTION servi_calculate_distance_km(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    r DOUBLE PRECISION := 6371; -- Rayon de la Terre en km
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat / 2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2)^2;
    c := 2 * atan2(sqrt(a), sqrt(1 - a));
    RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==============================================================================
-- DONNÉES DE TEST INITIALES (SEED DATA)
-- ==============================================================================
INSERT INTO servi_categories (id, idagence, name_fr, name_en, icon, color_hex, display_order) VALUES
('auto', 1, 'Mécanique & Auto', 'Auto & Mechanics', 'wrench', '#2563EB', 1),
('resto', 1, 'Restauration & Traiteur', 'Food & Catering', 'utensils', '#F97316', 2),
('home', 1, 'Maison & Bâtiment', 'Home & Building', 'home', '#10B981', 3),
('beauty', 1, 'Beauté & Coiffure', 'Beauty & Hair', 'scissors', '#EC4899', 4),
('tech', 1, 'Électronique & Informatique', 'Tech & Electronics', 'smartphone', '#8B5CF6', 5),
('fashion', 1, 'Mode & Couture', 'Fashion & Tailoring', 'shirt', '#F43F5E', 6),
('shop', 1, 'Commerce & Supérettes', 'Shops & Markets', 'shopping-bag', '#D97706', 7),
('health', 1, 'Santé & Bien-être', 'Health & Wellness', 'heart-pulse', '#0D9488', 8),
('transport', 1, 'Transport & Livraison', 'Transport & Delivery', 'truck', '#0284C7', 9)
ON CONFLICT (id) DO NOTHING;














-- ==============================================================================
-- AJOUT DES COLONNES DE CHEMINS D'IMAGES DANS servi_providers
-- ==============================================================================

-- 1. Logo ou Photo de profil du prestataire
ALTER TABLE public.servi_providers 
ADD COLUMN IF NOT EXISTS logo_image TEXT DEFAULT 'uploads/providers/default_logo.png';

-- 2. Image principale / Bannière de couverture
ALTER TABLE public.servi_providers 
ADD COLUMN IF NOT EXISTS cover_image TEXT DEFAULT 'uploads/providers/default_cover.jpg';

-- 3. Galerie de photos (tableau de chemins pour les locaux, produits et réalisations)
ALTER TABLE public.servi_providers 
ADD COLUMN IF NOT EXISTS gallery_images TEXT[] DEFAULT '{}';

-- 4. Document de vérification (Registre de commerce, CNI pour badge vérifié)
ALTER TABLE public.servi_providers 
ADD COLUMN IF NOT EXISTS document_image TEXT;

-- ==============================================================================
-- MISE A JOUR DES DONNÉES DE TEST AVEC DES CHEMINS ET URLS VALIDES
-- ==============================================================================
UPDATE public.servi_providers 
SET 
  logo_image = 'uploads/providers/garage_kossi_logo.png',
  cover_image = 'https://images.unsplash.com/photo-1613214149922-f1809c99b414?w=600&auto=format&fit=crop&q=80',
  gallery_images = ARRAY[
    'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600',
    'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=600'
  ]
WHERE name ILIKE '%Kossi%';

UPDATE public.servi_providers 
SET 
  logo_image = 'uploads/providers/pharmacie_soleil_logo.png',
  cover_image = 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=600&auto=format&fit=crop&q=80',
  gallery_images = ARRAY[
    'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=600'
  ]
WHERE name ILIKE '%Pharmacie%';