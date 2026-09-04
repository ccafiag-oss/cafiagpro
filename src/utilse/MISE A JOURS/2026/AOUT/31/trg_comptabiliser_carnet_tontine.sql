ALTER TABLE public.fina_carnet_tontine 
    ADD COLUMN IF NOT EXISTS ref_piece VARCHAR(50),
    ADD COLUMN IF NOT EXISTS codjrnal VARCHAR(30),
    ADD COLUMN IF NOT EXISTS dateoperation DATE,
    ADD COLUMN IF NOT EXISTS idmois INTEGER,
    ADD COLUMN IF NOT EXISTS idannee INTEGER,
    ADD COLUMN IF NOT EXISTS nom_client TEXT;


	DROP TRIGGER IF EXISTS trg_comptabiliser_carnet_tontine ON public.fina_carnet_tontine;
DROP FUNCTION IF EXISTS public.f_comptabiliser_carnet_tontine();

CREATE OR REPLACE FUNCTION public.f_comptabiliser_carnet_tontine()
    RETURNS trigger
    LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
    v_mois INTEGER;
    v_annee INTEGER;
    v_idjrnal INTEGER;
    v_compte_caisse VARCHAR;
    v_compte_produit VARCHAR;
    v_ref_piece_cible VARCHAR;
    v_prix_vente NUMERIC(19,4);
    v_iduser_val INTEGER;
    v_idclient_val INTEGER;
    v_codeclient_val VARCHAR;
    v_idagence_val INTEGER;
    v_date_op DATE;
    v_code_op VARCHAR;
    v_code_jrl VARCHAR;
    v_designation TEXT;
    v_nom_cli TEXT;
BEGIN
    -- 1. Identification de la ref_piece cible
    IF TG_OP = 'DELETE' THEN
        v_ref_piece_cible := OLD.ref_piece;
    ELSE
        v_ref_piece_cible := NEW.ref_piece;
    END IF;

    -- 2. Nettoyage préalable pour UPDATE ou DELETE dans tmvttheorique
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        DELETE FROM public.tmvttheorique WHERE ref_piece = v_ref_piece_cible;
    END IF;

    -- 3. Traitement pour INSERT ou UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        v_prix_vente := COALESCE(NEW.prixvente, 0);

        IF v_prix_vente > 0 THEN
            v_date_op := COALESCE(NEW.dateoperation, CURRENT_DATE);
            v_mois := COALESCE(NEW.idmois, EXTRACT(MONTH FROM v_date_op));
            v_annee := COALESCE(NEW.idannee, EXTRACT(YEAR FROM v_date_op));
            v_iduser_val := COALESCE(NEW.iduser, 1);
            v_idclient_val := NEW.idclient;
            v_codeclient_val := NEW.codeclient;
            v_idagence_val := NEW.idagence;
            v_code_op := NEW.codecarnet;
            v_code_jrl := NEW.codjrnal;
            v_designation := COALESCE(NEW.designation, 'VENTE CARNET');
            v_nom_cli := COALESCE(NEW.nom_client, 'CLIENT TONTINE');

            -- Récupération du journal
            SELECT id INTO v_idjrnal FROM public.tjournal WHERE codejrnl = v_code_jrl;

            -- Récupération du compte caisse de l'utilisateur
            SELECT comptecaisse INTO v_compte_caisse FROM public.caisse_utilisateur WHERE iduser = v_iduser_val;

            -- Récupération du compte de vente de carnet du produit
            SELECT compte_vente_carnet INTO v_compte_produit 
            FROM public.fina_produitepargne 
            WHERE idprod = NEW.idprod;

            IF v_compte_caisse IS NOT NULL AND v_compte_produit IS NOT NULL THEN
                -- Ligne 1 : Débit Caisse (numeroligne = 1)
                INSERT INTO public.tmvttheorique (
                    idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, 
                    iduser, idmois, idannee, codfact, reftiers, idagence, idjrnal, idtiers, ref_piece, numeroligne
                ) VALUES (
                    v_code_op, v_date_op, v_code_jrl, v_compte_caisse, v_codeclient_val, 
                    'DEBIT CAISSE - ' || v_designation || ' - ' || v_nom_cli, v_prix_vente, 0.00, 
                    v_iduser_val, v_mois, v_annee, v_code_op, v_codeclient_val, v_idagence_val, v_idjrnal, v_idclient_val, v_ref_piece_cible, '1'
                );

                -- Ligne 2 : Crédit Produit Vente Carnet (numeroligne = 2)
                INSERT INTO public.tmvttheorique (
                    idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, 
                    iduser, idmois, idannee, codfact, reftiers, idagence, idjrnal, idtiers, ref_piece, numeroligne
                ) VALUES (
                    v_code_op, v_date_op, v_code_jrl, v_compte_produit, v_codeclient_val, 
                    'CREDIT VENTE CARNET - ' || v_designation || ' - ' || v_nom_cli, 0.00, v_prix_vente, 
                    v_iduser_val, v_mois, v_annee, v_code_op, v_codeclient_val, v_idagence_val, v_idjrnal, v_idclient_val, v_ref_piece_cible, '2'
                );
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$BODY$;

ALTER FUNCTION public.f_comptabiliser_carnet_tontine()
    OWNER TO postgres;

-- Association du trigger à la table fina_carnet_tontine
CREATE TRIGGER trg_comptabiliser_carnet_tontine
    AFTER INSERT OR UPDATE OR DELETE
    ON public.fina_carnet_tontine
    FOR EACH ROW
    EXECUTE FUNCTION public.f_comptabiliser_carnet_tontine();