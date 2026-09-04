ALTER TABLE public.finaclient_comptes 
    ADD COLUMN IF NOT EXISTS ref_piece VARCHAR(50),
    ADD COLUMN IF NOT EXISTS codjrnal VARCHAR(30),
    ADD COLUMN IF NOT EXISTS nom_client TEXT;

ALTER TABLE public.finaclient_comptes 
    ADD COLUMN IF NOT EXISTS iduser integer

	
DROP TRIGGER IF EXISTS trg_comptabiliser_finaclient_comptes ON public.finaclient_comptes;
DROP FUNCTION IF EXISTS public.f_comptabiliser_finaclient_comptes();

CREATE OR REPLACE FUNCTION public.f_comptabiliser_finaclient_comptes()
    RETURNS trigger
    LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
    v_mois INTEGER;
    v_annee INTEGER;
    v_idjrnal INTEGER;
    v_compte_caisse VARCHAR;
    v_ref_piece_cible VARCHAR;
    v_f_ouv NUMERIC(19,4);
    v_f_adh NUMERIC(19,4);
    v_total_parts NUMERIC(19,4);
    v_cpt_frais_ouv VARCHAR;
    v_cpt_frais_adh VARCHAR;
    v_cpt_parts VARCHAR;
    v_idprod_val INTEGER;
    v_iduser_val INTEGER;
    v_idclient_val INTEGER;
    v_codeclient_val VARCHAR;
    v_idagence_val INTEGER;
    v_date_op DATE;
    v_code_op VARCHAR;
    v_code_jrl VARCHAR;
    v_code_cpt VARCHAR;
    v_nom_cli TEXT;
BEGIN
    -- 1. Identification de la ref_piece cible
    IF TG_OP = 'DELETE' THEN
        v_ref_piece_cible := OLD.ref_piece;
    ELSE
        v_ref_piece_cible := NEW.ref_piece;
    END IF;

    -- 2. Nettoyage préalable pour UPDATE ou DELETE
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        DELETE FROM public.tmvttheorique WHERE ref_piece = v_ref_piece_cible;
        DELETE FROM public.tcomptegeninter WHERE idcptintern = OLD.codecompte;
    END IF;

    -- 3. Traitement pour INSERT ou UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        v_mois := EXTRACT(MONTH FROM NEW.dateoperation);
        v_annee := EXTRACT(YEAR FROM NEW.dateoperation);
        v_idprod_val := NEW.idprod;
        v_iduser_val := COALESCE(NEW.iduser, 1);
        v_idclient_val := NEW.idclient;
        v_codeclient_val := NEW.codeclient;
        v_idagence_val := NEW.idagence;
        v_date_op := NEW.dateoperation;
        v_code_op := NEW.codeoperation;
        v_code_jrl := NEW.codjrnal;
        v_code_cpt := NEW.codecompte;
        v_nom_cli := COALESCE(NEW.nom_client, 'CLIENT EPARGNE');

        -- Récupération du journal
        SELECT id INTO v_idjrnal FROM public.tjournal WHERE codejrnl = v_code_jrl;

        -- Récupération du compte caisse de l'utilisateur
        SELECT comptecaisse INTO v_compte_caisse FROM public.caisse_utilisateur WHERE iduser = v_iduser_val;

        -- Récupération des comptes produits associés
        SELECT compte_frais_ouverture, compte_frais_adhesion, compte_part_social 
        INTO v_cpt_frais_ouv, v_cpt_frais_adh, v_cpt_parts 
        FROM public.fina_produitepargne 
        WHERE idprod = v_idprod_val;

        v_f_ouv := COALESCE(NEW.frais_ouverture, 0);
        v_f_adh := COALESCE(NEW.frais_adhesion, 0);
        v_total_parts := COALESCE(NEW.nombre_part_social, 0) * COALESCE(NEW.frais_part_social, 0);

        -- A. Insertion dans tcomptegeninter (Référentiel)
        INSERT INTO public.tcomptegeninter(
            idcptintern, date, idcptgen, designationcptint, idclasse, 
            codetiers, nomtiers, idcptinternsage, idag, idagence, 
            codeagence, source, idprod, idtiers
        ) VALUES (
            v_code_cpt, v_date_op, SUBSTRING(v_code_cpt FROM 1 FOR 5), 
            v_nom_cli, SUBSTRING(v_code_cpt FROM 1 FOR 1), 
            v_codeclient_val, v_nom_cli, v_code_cpt, 
            v_idagence_val::TEXT, v_idagence_val, 'AGENCE', 'EPARGNE', v_idprod_val, v_idclient_val
        );

        -- B. Génération des écritures comptables dans tmvttheorique (avec concaténation du nom du client)
        
        -- 1. Frais d'ouverture
        IF v_f_ouv > 0 AND v_compte_caisse IS NOT NULL AND v_cpt_frais_ouv IS NOT NULL THEN
            INSERT INTO public.tmvttheorique (idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, iduser, idmois, idannee, codfact, reftiers, idagence, idjrnal, idtiers, ref_piece, numeroligne)
            VALUES (v_code_op, v_date_op, v_code_jrl, v_compte_caisse, v_codeclient_val, 'DEBIT CAISSE - FRAIS OUVERTURE - ' || v_nom_cli, v_f_ouv, 0.00, v_iduser_val, v_mois, v_annee, v_code_op, v_codeclient_val, v_idagence_val, v_idjrnal, v_idclient_val, v_ref_piece_cible, '1');

            INSERT INTO public.tmvttheorique (idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, iduser, idmois, idannee, codfact, reftiers, idagence, idjrnal, idtiers, ref_piece, numeroligne)
            VALUES (v_code_op, v_date_op, v_code_jrl, v_cpt_frais_ouv, v_codeclient_val, 'CREDIT FRAIS OUVERTURE - ' || v_nom_cli, 0.00, v_f_ouv, v_iduser_val, v_mois, v_annee, v_code_op, v_codeclient_val, v_idagence_val, v_idjrnal, v_idclient_val, v_ref_piece_cible, '2');
        END IF;

        -- 2. Frais d'adhésion
        IF v_f_adh > 0 AND v_compte_caisse IS NOT NULL AND v_cpt_frais_adh IS NOT NULL THEN
            INSERT INTO public.tmvttheorique (idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, iduser, idmois, idannee, codfact, reftiers, idagence, idjrnal, idtiers, ref_piece, numeroligne)
            VALUES (v_code_op, v_date_op, v_code_jrl, v_compte_caisse, v_codeclient_val, 'DEBIT CAISSE - FRAIS ADHESION - ' || v_nom_cli, v_f_adh, 0.00, v_iduser_val, v_mois, v_annee, v_code_op, v_codeclient_val, v_idagence_val, v_idjrnal, v_idclient_val, v_ref_piece_cible, '3');

            INSERT INTO public.tmvttheorique (idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, iduser, idmois, idannee, codfact, reftiers, idagence, idjrnal, idtiers, ref_piece, numeroligne)
            VALUES (v_code_op, v_date_op, v_code_jrl, v_cpt_frais_adh, v_codeclient_val, 'CREDIT FRAIS ADHESION - ' || v_nom_cli, 0.00, v_f_adh, v_iduser_val, v_mois, v_annee, v_code_op, v_codeclient_val, v_idagence_val, v_idjrnal, v_idclient_val, v_ref_piece_cible, '4');
        END IF;

        -- 3. Parts sociales
        IF v_total_parts > 0 AND v_compte_caisse IS NOT NULL AND v_cpt_parts IS NOT NULL THEN
            INSERT INTO public.tmvttheorique (idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, iduser, idmois, idannee, codfact, reftiers, idagence, idjrnal, idtiers, ref_piece, numeroligne)
            VALUES (v_code_op, v_date_op, v_code_jrl, v_compte_caisse, v_codeclient_val, 'DEBIT CAISSE - PARTS SOCIALES - ' || v_nom_cli, v_total_parts, 0.00, v_iduser_val, v_mois, v_annee, v_code_op, v_codeclient_val, v_idagence_val, v_idjrnal, v_idclient_val, v_ref_piece_cible, '5');

            INSERT INTO public.tmvttheorique (idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, iduser, idmois, idannee, codfact, reftiers, idagence, idjrnal, idtiers, ref_piece, numeroligne)
            VALUES (v_code_op, v_date_op, v_code_jrl, v_cpt_parts, v_codeclient_val, 'CREDIT PARTS SOCIALES - ' || v_nom_cli, 0.00, v_total_parts, v_iduser_val, v_mois, v_annee, v_code_op, v_codeclient_val, v_idagence_val, v_idjrnal, v_idclient_val, v_ref_piece_cible, '6');
        END IF;

    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$BODY$;

ALTER FUNCTION public.f_comptabiliser_finaclient_comptes()
    OWNER TO postgres;

-- Association du trigger à la table finaclient_comptes
CREATE TRIGGER trg_comptabiliser_finaclient_comptes
    AFTER INSERT OR UPDATE OR DELETE
    ON public.finaclient_comptes
    FOR EACH ROW
    EXECUTE FUNCTION public.f_comptabiliser_finaclient_comptes();