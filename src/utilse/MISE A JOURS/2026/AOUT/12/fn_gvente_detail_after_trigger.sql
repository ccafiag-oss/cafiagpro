-- FUNCTION: public.fn_gvente_detail_after_trigger()

-- DROP FUNCTION IF EXISTS public.fn_gvente_detail_after_trigger();

CREATE OR REPLACE FUNCTION public.fn_gvente_detail_after_trigger()
    RETURNS trigger
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE NOT LEAKPROOF
AS $BODY$
DECLARE
    v_idvente BIGINT;
    v_ref_piece VARCHAR;
    v_codevente VARCHAR;
BEGIN
    v_idvente := COALESCE(NEW.idvente, OLD.idvente);
    v_ref_piece := COALESCE(NEW.ref_piece, OLD.ref_piece);
    v_codevente := COALESCE(NEW.codevente, OLD.codevente);

    -- ==========================================================
    -- 1. GESTION DES STOCKS (MOUVEMENTS AUTOMATIQUES)
    -- ==========================================================
    IF TG_OP = 'INSERT' THEN
        PERFORM public.sortie_stock(
            NEW.idagence, NEW.iddepot, NEW.idarticle, NEW.quantite, NEW.codevente, NEW.idlot
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.entree_stock(
            OLD.idagence, OLD.iddepot, OLD.idarticle, OLD.quantite, OLD.prixvente_brut, OLD.codevente, OLD.idlot
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.idarticle <> NEW.idarticle 
           OR OLD.quantite <> NEW.quantite 
           OR OLD.iddepot <> NEW.iddepot 
           OR COALESCE(OLD.idlot, 0) <> COALESCE(NEW.idlot, 0) 
        THEN
            PERFORM public.entree_stock(
                OLD.idagence, OLD.iddepot, OLD.idarticle, OLD.quantite, OLD.prixvente_brut, OLD.codevente, OLD.idlot
            );
            PERFORM public.sortie_stock(
                NEW.idagence, NEW.iddepot, NEW.idarticle, NEW.quantite, NEW.codevente, NEW.idlot
            );
        END IF;
    END IF;

    -- ==========================================================
    -- 2. RECALCUL DES TOTAUX DE L'ENTÊTE (gvente)
    -- ==========================================================
    IF EXISTS (SELECT 1 FROM gvente_detail WHERE idvente = v_idvente) THEN
        UPDATE gvente
        SET 
            montant_brut = COALESCE((SELECT SUM(quantite * prixvente_brut) FROM gvente_detail WHERE idvente = v_idvente AND etat = 'actif'), 0),
            montant_remise = COALESCE((SELECT SUM(remise) FROM gvente_detail WHERE idvente = v_idvente AND etat = 'actif'), 0)
        WHERE idvente = v_idvente;
    ELSE
        DELETE FROM gvente WHERE idvente = v_idvente;
    END IF;

    -- ==========================================================
    -- 3. CUMUL DES OPÉRATIONS (t_operation_cumule) - UPSERT / DELETE
    -- ==========================================================
    IF NOT EXISTS (SELECT 1 FROM gvente_detail WHERE idvente = v_idvente) THEN
        DELETE FROM t_operation_cumule
        WHERE idop = v_idvente AND type_operation = 'VENTE';
   -- ... (début de la section 3)
    ELSE
       INSERT INTO t_operation_cumule (
            idop, date, idtiers, nomtiers, iduser,
            idmois, idannee, idjrnal, idagence,
            montant, remise, montant_ttc, montant_reglement, datevalidation, type_operation,
            montantassure, montantassurance, idassureur, ref_piece,refoperation
        )
        SELECT DISTINCT ON (GV.idvente, GV.idassureur) -- Force l'unicité par vente/assureur
            GV.idvente,
            GV.datevente,
            GCL.idclients,
            CONCAT(GCL.nom, ' ', GCL.prenom),
            GV.iduser,
            GV.idmois,
            GV.idannee,
            MIN(GC.idjrnalvente), -- On prend une valeur unique (ex: le premier journal trouvé)
            GV.idagence,
            SUM(GV.prixvente_brut * GV.quantite),
            SUM(GV.remise),
            SUM(COALESCE(GV.montant_total, (GV.prixvente_brut * GV.quantite) - GV.remise)),
            0,
            GV.datevalidation,
            'VENTE',
           SUM(GV.prixassure * GV.quantite) - SUM(COALESCE(GV.remise, 0)),
           SUM(GV.prixassurance * GV.quantite) - SUM(COALESCE(GV.remise, 0)),
            GV.idassureur,
            GV.ref_piece,GV.refoperation
        FROM gvente_detail GV
        JOIN garticle GP ON GV.idarticle = GP.idarticle
        JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
        JOIN gclients GCL ON GV.idclients = GCL.idclients
        WHERE GV.idvente = v_idvente
        GROUP BY 
            GV.idvente, GV.datevente, GV.datevalidation,
            GV.idmois, GV.idannee, GCL.idclients, GV.idagence, GV.iduser,
            GCL.nom, GCL.prenom, GV.idassureur, GV.ref_piece,GV.refoperation
        ON CONFLICT (idop, type_operation, idassureur) 
        DO UPDATE SET
            montant = EXCLUDED.montant,
            remise = EXCLUDED.remise,
            montant_ttc = EXCLUDED.montant_ttc,
            montantassure = EXCLUDED.montantassure,
            montantassurance = EXCLUDED.montantassurance,
            ref_piece = EXCLUDED.ref_piece,
			refoperation=EXCLUDED.refoperation
			;
    END IF;

    -- ==========================================================
    -- 4. COMPTABILISATION AUTOMATIQUE (public.tmvttheorique)
    -- ==========================================================
    -- Nettoyage des anciennes écritures liées à cette ref_piece
    DELETE FROM public.tmvttheorique WHERE ref_piece = v_ref_piece;

    -- Génération des écritures si des lignes valides existent
    IF EXISTS (SELECT 1 FROM gvente_detail WHERE idvente = v_idvente AND etat IN ('actif', 'ANNULATION')) THEN
        
        -- A. INSERT Débit (compte général vente) -> Ligne de comptabilité N°1
        INSERT INTO public.tmvttheorique (
            idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, iduser, 
            idmois, idannee, codfact, reftiers, idagence, idjrnal, idmouvement, idtiers, ref_piece, numeroligne
        )
        SELECT
            GV.codevente,
            GV.datevente,
            GC.idjrnalvente,
            GC.comptegenvente,
            '0' AS codetiers,
            CONCAT(CASE WHEN GV.etat = 'ANNULATION' THEN 'Annulation ' END, 'Vente Fact n° ', GV.codevente),
            CASE WHEN GV.etat = 'ANNULATION' THEN ROUND(SUM(COALESCE(GV.montant_total, (GV.prixvente_brut * GV.quantite) - GV.remise)), 2) ELSE 0 END,
            CASE WHEN GV.etat = 'actif' THEN ROUND(SUM(COALESCE(GV.montant_total, (GV.prixvente_brut * GV.quantite) - GV.remise)), 2) ELSE 0 END,
            GV.iduser,
            GV.idmois,
            GV.idannee,
            GV.idvente,
            GV.refoperation,
            GV.idagence,
            GC.idjrnalvente,
            NULL AS idmouvement,
            0 AS idtiers,
            GV.ref_piece,
            1 AS numeroligne -- Affectation ligne séquentielle 1 (NON NULLE)
        FROM gvente_detail GV
        JOIN garticle GP ON GV.idarticle = GP.idarticle
        JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
        WHERE GV.idvente = v_idvente AND GV.etat IN ('actif', 'ANNULATION')
        GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenvente,
                 GV.idmois, GV.idannee, GV.idagence, GV.iduser, GV.codevente, GV.refoperation, GV.ref_piece, GV.etat;

        -- B. INSERT Crédit (compte client) -> Ligne de comptabilité N°2
        INSERT INTO public.tmvttheorique (
            idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, iduser, 
            idmois, idannee, codfact, reftiers, idagence, idjrnal, idmouvement, idtiers, ref_piece, numeroligne
        )
        SELECT
            GV.codevente,
            GV.datevente,
            GC.idjrnalvente,
            GCL.compteauxiliaire,
            GCL.codeclients AS codetiers,
            CONCAT(CASE WHEN GV.etat = 'ANNULATION' THEN 'Annulation ' END, 'Vente Fact n° ', GV.codevente),
            CASE WHEN GV.etat = 'actif' THEN ROUND(SUM(COALESCE(GV.montant_total, (GV.prixvente_brut * GV.quantite) - GV.remise)), 2) ELSE 0 END,
            CASE WHEN GV.etat = 'ANNULATION' THEN ROUND(SUM(COALESCE(GV.montant_total, (GV.prixvente_brut * GV.quantite) - GV.remise)), 2) ELSE 0 END,
            GV.iduser,
            GV.idmois,
            GV.idannee,
            GV.idvente,
            GV.refoperation,
            GV.idagence,
            GC.idjrnalvente,
            NULL AS idmouvement,
            GCL.idclients AS idtiers,
            GV.ref_piece,
            2 AS numeroligne -- Affectation ligne séquentielle 2 (NON NULLE)
        FROM gvente_detail GV
        JOIN garticle GP ON GV.idarticle = GP.idarticle
        JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
        JOIN gclients GCL ON GV.idclients = GCL.idclients
        WHERE GV.idvente = v_idvente AND GV.etat IN ('actif', 'ANNULATION')
        GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GCL.compteauxiliaire, GCL.codeclients,
                 GV.idmois, GV.idannee, GCL.idclients, GV.idagence, GV.iduser, GV.codevente, GV.refoperation, GV.ref_piece, GV.etat;

        -- C. INSERT Débit variation de stock -> Ligne de comptabilité N°3
        INSERT INTO public.tmvttheorique (
            idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, iduser, 
            idmois, idannee, codfact, reftiers, idagence, idjrnal, idmouvement, idtiers, ref_piece, numeroligne
        )
        SELECT
            GV.codevente,
            GV.datevente,
            GC.idjrnalvente,
            GC.comptegenvrstock,
            '0' AS codetiers,
            CONCAT(CASE WHEN GV.etat = 'ANNULATION' THEN 'Annulation ' END, 'Vente Fact n° ', GV.codevente),
            CASE WHEN GV.etat = 'actif' THEN ROUND(SUM(COALESCE(GV.montant_total, (GV.prixvente_brut * GV.quantite) - GV.remise)), 2) ELSE 0 END,
            CASE WHEN GV.etat = 'ANNULATION' THEN ROUND(SUM(COALESCE(GV.montant_total, (GV.prixvente_brut * GV.quantite) - GV.remise)), 2) ELSE 0 END,
            GV.iduser,
            GV.idmois,
            GV.idannee,
            GV.idvente,
            GV.refoperation,
            GV.idagence,
            GC.idjrnalvente,
            NULL AS idmouvement,
            0 AS idtiers,
            GV.ref_piece,
            3 AS numeroligne -- Affectation ligne séquentielle 3 (NON NULLE)
        FROM gvente_detail GV
        JOIN garticle GP ON GV.idarticle = GP.idarticle
        JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
        WHERE GV.idvente = v_idvente AND GV.etat IN ('actif', 'ANNULATION')
        GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenvrstock,
                 GV.idmois, GV.idannee, GV.idagence, GV.iduser, GV.codevente, GV.refoperation, GV.ref_piece, GV.etat;

        -- D. INSERT Crédit variation de stock -> Ligne de comptabilité N°4
        INSERT INTO public.tmvttheorique (
            idtmvth, date, codjrl, idcptgn, codetiers, libelle, montantdebit, montantcredit, iduser, 
            idmois, idannee, codfact, reftiers, idagence, idjrnal, idmouvement, idtiers, ref_piece, numeroligne
        )
        SELECT
            GV.codevente,
            GV.datevente,
            GC.idjrnalvente,
            GC.comptegenstock,
            '0' AS codetiers,
            CONCAT(CASE WHEN GV.etat = 'ANNULATION' THEN 'Annulation ' END, 'Vente Fact n° ', GV.codevente),
            CASE WHEN GV.etat = 'ANNULATION' THEN ROUND(SUM(COALESCE(GV.montant_total, (GV.prixvente_brut * GV.quantite) - GV.remise)), 2) ELSE 0 END,
            CASE WHEN GV.etat = 'actif' THEN ROUND(SUM(COALESCE(GV.montant_total, (GV.prixvente_brut * GV.quantite) - GV.remise)), 2) ELSE 0 END,
            GV.iduser,
            GV.idmois,
            GV.idannee,
            GV.idvente,
            GV.refoperation,
            GV.idagence,
            GC.idjrnalvente,
            NULL AS idmouvement,
            0 AS idtiers,
            GV.ref_piece,
            4 AS numeroligne -- Affectation ligne séquentielle 4 (NON NULLE)
        FROM gvente_detail GV
        JOIN garticle GP ON GV.idarticle = GP.idarticle
        JOIN gsouscategorie GC ON GP.idsouscategorie = GC.idsouscategorie
        WHERE GV.idvente = v_idvente AND GV.etat IN ('actif', 'ANNULATION')
        GROUP BY GV.idvente, GV.datevente, GC.idjrnalvente, GC.comptegenstock,
                 GV.idmois, GV.idannee, GV.idagence, GV.iduser, GV.codevente, GV.refoperation, GV.ref_piece, GV.etat;

    END IF;

    -- Mise à jour automatique de la validation temporelle
    UPDATE gvente_detail 
    SET datevalidation = NOW() 
    WHERE idvente = v_idvente AND datevalidation IS NULL;

    RETURN NEW;
END;
$BODY$;

ALTER FUNCTION public.fn_gvente_detail_after_trigger()
    OWNER TO postgres;
