

DO $$
DECLARE 
    r RECORD;
    -- LISTE DES TABLES À ÉPARGNER (en minuscules, séparées par des virgules)
    tables_a_garder text[] := ARRAY['creationsociete',
	'fraisoperationmobile',
	'g_service',
	'langues',
	'operateurtelephone',
	'tcompte',
	'modepaiements',
	'optionsalerte',
	'roles',
	'tjournal',
	'tpays',
	'traductions',
	'agence',
	'habilitationprofile',
	'gstockparametre',
	'gtype_frais',
	'gdepot',
	'ttypesclient',
	'ttypesfournisseur',
	'typesoperation',
	'tcomptegeneral',
	'fina_typescomptesproduit',
	'fina_typescarnet',
	'fina_rubriquecompteexploitation',
	'fina_produitepargne',
	'fina_modecalculeamortissement',
	'fina_credit_objetvisite',
	'fina_credit_objet',
	'fina_comite_type',
	'creationsociete',
	'cabmodepaiement',
	'cabagence',
	'agence',
	'fina_credit_objet',
	'fina_modecalculeamortissement',
	'fina_rubriquecompteexploitation',
	'fina_typescarnet',
	'fina_typescomptesproduit',
	'g_service',
	'glot',
	'gpiece_identite',
	'gquartier',
	'gstockparametre',
	'gsupportvideo',
	'gtype_frais',
	'logiciel',
	'operateurtelephone',
	'optionsalerte',
	'societe_logiciel',
	'typesoperation',
	'types_compte',
	'ges_agent_commercial',
	'gtype_mesure',
	'gunite',
	'gcategorie',
	'gsouscategorie',
	'gsouscategoriedetail',
	'utilisateur',
	'utilisateur_agence',
	's_assureur',
	's_taux',
	'caisse_utilisateur',
	----'ttarifprixachat',
	---'ttarifprixvente',
	'fina_model',
	'fina_modeloperation',
	----'garticle',
	'',
	'',
	'',
	'',
	''
	
	
	]; 
BEGIN
    -- On boucle sur toutes les tables du schéma 'public'
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename != ALL (tables_a_garder)
    ) LOOP
        -- RESTART IDENTITY : remet les compteurs (ID) à zéro
        -- CASCADE : gère les dépendances de clés étrangères
       ----- EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';

		 EXECUTE format(
            'TRUNCATE TABLE %I RESTART IDENTITY CASCADE',
            r.tablename
        );

		
    END LOOP;
END $$;






----delete from utilisateur where iduser not in(17,111)

select * from public.utilisateur

select * from public.gsouscategoriedetail

select * from public.glot_stock ORDER by idlot_stock asc

select * from public.gclients
select * from public.gfournisseur
select * from public.tcomptegeninter

SELECT pg_get_serial_sequence('public.gfournisseur', 'idfourn');
suprimer une table et reinstar identite
TRUNCATE TABLE gfournisseur RESTART IDENTITY CASCADE;

SELECT setval('gfournisseur_idfourn_seq', 1, false);
	SELECT last_value
FROM gfournisseur_idfourn_seq;

------  verifier le numero de la sequence
SELECT last_value
FROM tcomptegeninter_id_seq;


SELECT nextval('tcomptegeninter_id_seq');


----- attribuer un numero de la sequence

SELECT setval('tcomptegeninter_id_seq', 1, true);



SELECT setval('tcomptegeninter_id_seq', 1, false);
	SELECT last_value
FROM tcomptegeninter_id_seq;

SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gfournisseur'
  AND column_default IS NOT NULL;


  select * from public.utilisateur_agence

select * from  caisse_utilisateur

SELECT nextval('tcomptegeninter_id_seq');

TRUNCATE TABLE gfournisseur RESTART IDENTITY CASCADE;
TRUNCATE TABLE tcomptegeninter RESTART IDENTITY CASCADE;

SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gfournisseur'
  AND column_name = 'idfourn';

TRUNCATE TABLE public.gfournisseur RESTART IDENTITY CASCADE;
SELECT last_value, is_called
FROM gfournisseur_idfourn_seq;

SELECT pg_get_serial_sequence('public.gfournisseur', 'idfourn');

SELECT
    s.relname AS sequence_name,
    t.relname AS table_name,
    a.attname AS column_name
FROM pg_class s
JOIN pg_depend d ON d.objid = s.oid
JOIN pg_class t ON d.refobjid = t.oid
JOIN pg_attribute a
    ON a.attrelid = t.oid
   AND a.attnum = d.refobjsubid
WHERE s.relkind = 'S'
  AND s.relname = 'gfournisseur_idfourn_seq';


ALTER SEQUENCE public.gfournisseur_idfourn_seq
OWNED BY public.gfournisseur.idfourn;

TRUNCATE TABLE public.gfournisseur RESTART IDENTITY CASCADE;

SELECT last_value, is_called
FROM public.gfournisseur_idfourn_seq;


SELECT pg_get_serial_sequence('public.tcomptegeninter', 'id');

TRUNCATE TABLE public.tcomptegeninter RESTART IDENTITY CASCADE;

SELECT last_value, is_called
FROM public.tcomptegeninter_id_seq;


Select * from   public.gfournisseur
select *  from   public.tcomptegeninter



SELECT last_value, is_called
FROM public.gfournisseur_idfourn_seq;

delete from   public.gfournisseur
delete  from   public.tcomptegeninter

ALTER TABLE public.gfournisseur
ALTER COLUMN idfourn TYPE BIGINT;




-----  AFFICHER LES TABLES DONT LA SEQUENCE N'EST PAS LIEE

SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    a.attname AS column_name,
    pg_get_expr(ad.adbin, ad.adrelid) AS default_value
FROM pg_attribute a
JOIN pg_class c
    ON c.oid = a.attrelid
JOIN pg_namespace n
    ON n.oid = c.relnamespace
JOIN pg_attrdef ad
    ON ad.adrelid = a.attrelid
   AND ad.adnum = a.attnum
WHERE c.relkind = 'r'
  AND pg_get_expr(ad.adbin, ad.adrelid) LIKE 'nextval(%'
  AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      JOIN pg_class s
        ON s.oid = d.objid
      WHERE d.classid = 'pg_class'::regclass
        AND d.refobjid = c.oid
        AND d.refobjsubid = a.attnum
        AND s.relkind = 'S'
  )
ORDER BY schema_name, table_name, column_name;



-----------------------------------------------------------------------
------  code pour attribuer une sequence
---ALTER SEQUENCE public.ttarifproduitprix_idtarpro_seq
---OWNED BY public.ttarifproduitprixremise.idtarpro;

---ALTER SEQUENCE public.ttarifproduitprix_idtarpro_seq
---OWNED BY public.ttarifproduitprixremise.idtarpro;

ALTER SEQUENCE public.ttarifproduitprix_idtarpro_seq
OWNED BY public.ttarifproduitprix.idtarpro;

CREATE SEQUENCE public.ttarifproduitprixremise_idtarpro_seq;

ALTER TABLE public.ttarifproduitprixremise
ALTER COLUMN idtarpro SET DEFAULT nextval('public.ttarifproduitprixremise_idtarpro_seq');

ALTER SEQUENCE public.ttarifproduitprixremise_idtarpro_seq
OWNED BY public.ttarifproduitprixremise.idtarpro;


SELECT pg_get_serial_sequence('public.ttarifproduitprixremise', 'idtarpro');

------  correction de nom de sequence
SELECT
    'ALTER SEQUENCE '
    || quote_ident(n.nspname) || '.'
    || quote_ident(
        regexp_replace(
            pg_get_expr(ad.adbin, ad.adrelid),
            '^nextval\(''([^'']+)''::regclass\)$',
            '\1'
        )
    )
    || ' OWNED BY '
    || quote_ident(n.nspname) || '.'
    || quote_ident(c.relname) || '.'
    || quote_ident(a.attname)
    || ';' AS sql_to_execute
FROM pg_attribute a
JOIN pg_class c
    ON c.oid = a.attrelid
JOIN pg_namespace n
    ON n.oid = c.relnamespace
JOIN pg_attrdef ad
    ON ad.adrelid = a.attrelid
   AND ad.adnum = a.attnum
WHERE c.relkind = 'r'
  AND pg_get_expr(ad.adbin, ad.adrelid) LIKE 'nextval(%'
  AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      JOIN pg_class s
        ON s.oid = d.objid
      WHERE d.classid = 'pg_class'::regclass
        AND d.refobjid = c.oid
        AND d.refobjsubid = a.attnum
        AND s.relkind = 'S'
  );



-----  applique pour tous les tables

DO $$
DECLARE
    r RECORD;
    seq_name text;
BEGIN
    FOR r IN
        SELECT
            table_schema,
            table_name,
            column_name,
            regexp_replace(
                column_default,
                '^nextval\(''([^'']+)''::regclass\)$',
                '\1'
            ) AS seq_name
        FROM information_schema.columns
        WHERE column_default LIKE 'nextval(%'
    LOOP
        seq_name := r.seq_name;

        IF seq_name IS NOT NULL AND seq_name <> '' THEN
            EXECUTE format(
                'ALTER SEQUENCE %s OWNED BY %I.%I.%I',
                seq_name,
                r.table_schema,
                r.table_name,
                r.column_name
            );
        END IF;
    END LOOP;
END $$;


select * from public.g_archive_saisieinventairelot






-----code pour trouver les doublon et supprimer





SELECT 
    idagence, 
    designation, 
    COUNT(*) as nombre_occurrences
FROM public.garticle
GROUP BY idagence, designation
HAVING COUNT(*) > 1;




SELECT 
    a.idarticle, 
    a.idagence, 
    a.designation
FROM public.garticle a
WHERE (a.idagence, a.designation) IN (
    SELECT idagence, designation 
    FROM public.garticle 
    GROUP BY idagence, designation 
    HAVING COUNT(*) > 1
)
ORDER BY a.idagence, a.designation;






DELETE FROM public.garticle
WHERE idarticle IN (
    SELECT idarticle
    FROM (
        SELECT idarticle,
               ROW_NUMBER() OVER (PARTITION BY idagence, designation ORDER BY idarticle ASC) as row_num
        FROM public.garticle
    ) t
    WHERE t.row_num > 1
);


delete from gstock_depot 



COPY garticle(idagence, codearticle, designation, idcategorie, idsouscategorie, idsouscategoriedetail, idunite, prixachat, prixvente, cump, stockmin, stockmax, idarticlelier, nombreunite, gere_lot, gere_stock, date_peremption, actif, datecreation, taux_taxe, poid_unitaire, idarticlelier_agence, idlot, codelot, prix_achat_base_ht, prix_base)
FROM 'C:\CAFIAG\Import\garticle.csv'
DELIMITER ';'
CSV HEADER
ENCODING 'UTF8';

select * from public.garticle
select * from public.glot_stock


