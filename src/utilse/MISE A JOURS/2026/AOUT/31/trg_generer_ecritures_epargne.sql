ALTER TABLE public.fina_operation_epargne 
    ADD COLUMN IF NOT EXISTS ref_piece VARCHAR(50),
    ADD COLUMN IF NOT EXISTS codjrnal VARCHAR(20),
    ------ADD COLUMN IF NOT EXISTS comptetontine VARCHAR(30), -- ou compteepargne selon votre nomenclature
    ADD COLUMN IF NOT EXISTS comptedestination VARCHAR(30);


	DROP TRIGGER IF EXISTS trg_generer_ecritures_epargne ON public.fina_operation_epargne;
DROP FUNCTION IF EXISTS public.generer_ecritures_operation_epargne();

CREATE OR REPLACE FUNCTION public.generer_ecritures_operation_epargne()
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
    
    v_codetiers_debit VARCHAR;
    v_idtiers_debit INTEGER;
    v_codetiers_credit VARCHAR;
    v_idtiers_credit INTEGER;
BEGIN
    -- 1. Gestion du nettoyage pour DELETE ou UPDATE
    IF TG_OP = 'DELETE' THEN
        v_ref_piece_cible := OLD.ref_piece;
        v_mouvement_id := OLD.idoperation::INTEGER;

        DELETE FROM public.tmvttheorique 
        WHERE (idmouvement = v_mouvement_id) OR (ref_piece IS NOT NULL AND ref_piece = v_ref_piece_cible);

        RETURN OLD;
    END IF;

    -- Pour INSERT ou UPDATE
    v_ref_piece_cible := NEW.ref_piece;
    v_mouvement_id := NEW.idoperation::INTEGER;

    IF TG_OP = 'UPDATE' THEN
        DELETE FROM public.tmvttheorique 
        WHERE (idmouvement = v_mouvement_id) OR (ref_piece IS NOT NULL AND ref_piece = v_ref_piece_cible);
    END IF;

    -- 2. Génération des écritures pour INSERT ou UPDATE
    v_mois := EXTRACT(MONTH FROM NEW.dateoperation);
    v_annee := EXTRACT(YEAR FROM NEW.dateoperation);

    -- Récupération de l'ID du journal
    SELECT id INTO v_idjrnal 
    FROM public.tjournal 
    WHERE codejrnl = NEW.codjrnal;

    -- Récupération du compte caisse de l'utilisateur si nécessaire
    IF NEW.typesoperation IN ('DEPOT', 'RETRAIT') THEN
        SELECT comptecaisse INTO v_compte_caisse 
        FROM public.caisse_utilisateur 
        WHERE iduser = NEW.iduser::INTEGER;
        
        IF v_compte_caisse IS NULL THEN
            RAISE EXCEPTION 'Configuration caisse introuvable pour l''utilisateur ID %', NEW.iduser;
        END IF;
    END IF;

    -- Détermination des comptes et libellés selon le type d'opération
    IF NEW.typesoperation = 'DEPOT' THEN
        v_cpt_debit := v_compte_caisse;
        v_cpt_credit := NEW.codecompte;
        v_libelle_debit := 'DEPOT CAISSE - ' || COALESCE(NEW.designation, '');
        v_libelle_credit := 'DEPOT EPARGNE - ' || COALESCE(NEW.designation, '');
    ELSIF NEW.typesoperation = 'RETRAIT' THEN
        v_cpt_debit := NEW.codecompte;
        v_cpt_credit := v_compte_caisse;
        v_libelle_debit := 'RETRAIT EPARGNE - ' || COALESCE(NEW.designation, '');
        v_libelle_credit := 'RETRAIT CAISSE - ' || COALESCE(NEW.designation, '');
    ELSIF NEW.typesoperation = 'INTERET' THEN
        v_cpt_debit := NEW.comptedestination; -- ou autre compte de charge selon votre logique
        v_cpt_credit := NEW.codecompte;
        v_libelle_debit := 'INTERET DEBIT - ' || COALESCE(NEW.designation, '');
        v_libelle_credit := 'INTERET CREDIT - ' || COALESCE(NEW.designation, '');
    END IF;

    -- Règle des tiers : Si le compte est un compte caisse, code tiers = '0' et idtiers = 0
    IF v_cpt_debit = v_compte_caisse THEN
        v_codetiers_debit := '0';
        v_idtiers_debit := 0;
    ELSE
        v_codetiers_debit := NEW.codeclient;
        v_idtiers_debit := NEW.idclient::INTEGER;
    END IF;

    IF v_cpt_credit = v_compte_caisse THEN
        v_codetiers_credit := '0';
        v_idtiers_credit := 0;
    ELSE
        v_codetiers_credit := NEW.codeclient;
        v_idtiers_credit := NEW.idclient::INTEGER;
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

ALTER FUNCTION public.generer_ecritures_operation_epargne() OWNER TO postgres;

-- Association du trigger à la table fina_operation_epargne
DROP TRIGGER IF EXISTS trg_generer_ecritures_epargne ON public.fina_operation_epargne;
CREATE TRIGGER trg_generer_ecritures_epargne
    AFTER INSERT OR UPDATE OR DELETE
    ON public.fina_operation_epargne
    FOR EACH ROW
    EXECUTE FUNCTION public.generer_ecritures_operation_epargne();
ALTER FUNCTION public.generer_ecritures_operation_epargne() OWNER TO postgres;

CREATE TRIGGER trg_generer_ecritures_epargne
    AFTER INSERT OR UPDATE OR DELETE
    ON public.fina_operation_epargne
    FOR EACH ROW
    EXECUTE FUNCTION public.generer_ecritures_operation_epargne();