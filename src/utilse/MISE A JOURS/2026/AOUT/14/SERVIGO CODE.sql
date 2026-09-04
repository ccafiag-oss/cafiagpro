

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