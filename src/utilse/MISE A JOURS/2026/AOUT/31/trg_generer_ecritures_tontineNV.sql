ALTER TABLE public.fina_operation_tontine
    ADD COLUMN IF NOT EXISTS ref_piece character varying(50) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS codjrnal character varying(20) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS comptetontine character varying(30) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS comptedestination character varying(30) COLLATE pg_catalog."default";


ALTER TABLE public.fina_operation_tontine
ALTER COLUMN case_selectionne TYPE text
USING case_selectionne::text;



DROP TRIGGER IF EXISTS trg_generer_ecritures_tontine ON public.fina_operation_tontine;
DROP FUNCTION IF EXISTS public.generer_ecritures_operation_tontine();
CREATE OR REPLACE FUNCTION public.generer_ecritures_operation_tontine()
    RETURNS trigger
    LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
    v_mois INTEGER;
    v_annee INTEGER;
    v_idjrnal INTEGER;
    v_cpt_debit VARCHAR;
    v_cpt_credit VARCHAR;
    v_libelle_debit VARCHAR;
    v_libelle_credit VARCHAR;
    v_compte_caisse VARCHAR;
    v_ref_piece_cible VARCHAR;
    v_mouvement_id INTEGER;
    
    -- Variables pour gérer les tiers conditionnels
    v_codetiers_debit VARCHAR;
    v_idtiers_debit INTEGER;
    v_codetiers_credit VARCHAR;
    v_idtiers_credit INTEGER;
BEGIN
    -- 1. Gestion du nettoyage pour DELETE ou UPDATE (basé sur idmouvement ET ref_piece)
    IF TG_OP = 'DELETE' THEN
        v_ref_piece_cible := OLD.ref_piece;
        v_mouvement_id := OLD.idoperation::INTEGER;

        DELETE FROM public.tmvttheorique 
        WHERE idmouvement = v_mouvement_id OR (ref_piece IS NOT NULL AND ref_piece = v_ref_piece_cible);

        RETURN OLD;
    END IF;

    -- Pour INSERT ou UPDATE, on récupère les données de NEW
    v_ref_piece_cible := NEW.ref_piece;
    v_mouvement_id := NEW.idoperation::INTEGER;

    IF TG_OP = 'UPDATE' THEN
        -- Nettoyage des anciennes écritures avant de recréer les nouvelles
        DELETE FROM public.tmvttheorique 
        WHERE idmouvement = v_mouvement_id OR (ref_piece IS NOT NULL AND ref_piece = v_ref_piece_cible);
    END IF;

    -- 2. Génération des écritures pour INSERT ou UPDATE
    v_mois := EXTRACT(MONTH FROM NEW.dateoperation);
    v_annee := EXTRACT(YEAR FROM NEW.dateoperation);

    -- Récupération de l'ID du journal
    SELECT id INTO v_idjrnal 
    FROM public.tjournal 
    WHERE codejrnl = NEW.codjrnal;

    -- Récupération du compte caisse de l'utilisateur
    IF NEW.typesoperation IN ('depot', 'retrait') THEN
        SELECT comptecaisse INTO v_compte_caisse 
        FROM public.caisse_utilisateur 
        WHERE iduser = NEW.iduser::INTEGER;
        
        IF v_compte_caisse IS NULL THEN
            RAISE EXCEPTION 'Configuration caisse introuvable pour l''utilisateur ID %', NEW.iduser;
        END IF;
    END IF;

    -- Détermination des comptes selon le type d'opération
    IF NEW.typesoperation = 'depot' THEN
        v_cpt_debit := v_compte_caisse;
        v_cpt_credit := NEW.comptetontine;
        v_libelle_debit := 'DEPOT CAISSE - ' || COALESCE(NEW.designation, '');
        v_libelle_credit := 'DEPOT TONTINE - ' || COALESCE(NEW.designation, '');
    ELSIF NEW.typesoperation = 'retrait' THEN
        v_cpt_debit := NEW.comptetontine;
        v_cpt_credit := v_compte_caisse;
        v_libelle_debit := 'RETRAIT TONTINE - ' || COALESCE(NEW.designation, '');
        v_libelle_credit := 'RETRAIT CAISSE - ' || COALESCE(NEW.designation, '');
    END IF;

    -- Application de la règle : Si idcptgn = v_compte_caisse, code tiers et idtiers = 0
    IF v_cpt_debit = v_compte_caisse THEN
        v_codetiers_debit := '0';
        v_idtiers_debit := 0;
    ELSE
        v_codetiers_debit := NEW.codeclient;
        v_idtiers_debit := NEW.idclient;
    END IF;

    IF v_cpt_credit = v_compte_caisse THEN
        v_codetiers_credit := '0';
        v_idtiers_credit := 0;
    ELSE
        v_codetiers_credit := NEW.codeclient;
        v_idtiers_credit := NEW.idclient;
    END IF;

    -- Ligne 1 : Débit
    INSERT INTO public.tmvttheorique (
        idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, 
        iduser, idmois, idannee, codfact, reftiers, idagence, idjrnal, idmouvement, idtiers, ref_piece, numeroligne
    ) VALUES (
        NEW.codeoperation, NEW.dateoperation, NEW.codjrnal, v_cpt_debit, v_codetiers_debit, 
        v_libelle_debit, NEW.montant, 0.00, NEW.iduser::INTEGER, v_mois, v_annee, 
        NEW.codeoperation, v_codetiers_debit, NEW.idagence, v_idjrnal, v_mouvement_id, 
        v_idtiers_debit, v_ref_piece_cible, '1'
    );

    -- Ligne 2 : Crédit
    INSERT INTO public.tmvttheorique (
        idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, 
        iduser, idmois, idannee, codfact, reftiers, idagence, idjrnal, idmouvement, idtiers, ref_piece, numeroligne
    ) VALUES (
        NEW.codeoperation, NEW.dateoperation, NEW.codjrnal, v_cpt_credit, v_codetiers_credit, 
        v_libelle_credit, 0.00, NEW.montant, NEW.iduser::INTEGER, v_mois, v_annee, 
        NEW.codeoperation, v_codetiers_credit, NEW.idagence, v_idjrnal, v_mouvement_id, 
        v_idtiers_credit, v_ref_piece_cible, '2'
    );

    RETURN NEW;
END;
$BODY$;

ALTER FUNCTION public.generer_ecritures_operation_tontine() OWNER TO postgres;

-- Association du trigger à la table fina_operation_tontine
DROP TRIGGER IF EXISTS trg_generer_ecritures_tontine ON public.fina_operation_tontine;
CREATE TRIGGER trg_generer_ecritures_tontine
    AFTER INSERT OR UPDATE OR DELETE
    ON public.fina_operation_tontine
    FOR EACH ROW
    EXECUTE FUNCTION public.generer_ecritures_operation_tontine();

ALTER FUNCTION public.generer_ecritures_operation_tontine() OWNER TO postgres;

-- Association du trigger à la table fina_operation_tontine
DROP TRIGGER IF EXISTS trg_generer_ecritures_tontine ON public.fina_operation_tontine;
CREATE TRIGGER trg_generer_ecritures_tontine
    AFTER INSERT OR UPDATE OR DELETE
    ON public.fina_operation_tontine
    FOR EACH ROW
    EXECUTE FUNCTION public.generer_ecritures_operation_tontine();
ALTER FUNCTION public.generer_ecritures_operation_tontine() OWNER TO postgres;

-- Association du trigger à la table fina_operation_tontine
DROP TRIGGER IF EXISTS trg_generer_ecritures_tontine ON public.fina_operation_tontine;
CREATE TRIGGER trg_generer_ecritures_tontine
    AFTER INSERT OR UPDATE OR DELETE
    ON public.fina_operation_tontine
    FOR EACH ROW
    EXECUTE FUNCTION public.generer_ecritures_operation_tontine();
ALTER FUNCTION public.generer_ecritures_operation_tontine() OWNER TO postgres;

CREATE TRIGGER trg_generer_ecritures_tontine
    AFTER INSERT OR UPDATE OR DELETE
    ON public.fina_operation_tontine
    FOR EACH ROW
    EXECUTE FUNCTION public.generer_ecritures_operation_tontine();