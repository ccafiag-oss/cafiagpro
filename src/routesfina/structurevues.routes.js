const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/tcomptegeneral', async (req, res) => {
  try {
    // paramètres
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 500;
    const idagence = parseInt(req.query.idagence);

    if (!idagence) {
      return res.status(400).json({
        error: "Le paramètre idagence est obligatoire"
      });
    }

    const offset = (page - 1) * pageSize;

    // nombre total
    const totalResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM tcomptegeneral
       WHERE idagence = $1`,
      [idagence]
    );

    const total = parseInt(totalResult.rows[0].total);

    // données paginées
    const result = await pool.query(
      `SELECT idcptgen,
              designationcptgen,
              idclasse,
              sencetat,
              idagence
       FROM tcomptegeneral
       WHERE idagence = $1
       ORDER BY idcptgen ASC
       LIMIT $2 OFFSET $3`,
      [idagence, pageSize, offset]
    );

    res.json({
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      },
      data: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Erreur récupération de compte'
    });
  }
});




router.get('/listeproduites', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({
      success: false,
      message: 'idagence obligatoire'
    });
  }

  try {
    let sql = `
      select * from fina_produitepargne
      WHERE idagence = $1
    `;

    const params = [idagence];

    if (search && search.trim() !== '') {
      sql += ` AND designation ILIKE $2 `;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY idprod DESC`;

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});



router.get('/listeutilisateurs', async (req, res) => {
  const { idagence, search } = req.query;

  if (!idagence) {
    return res.status(400).json({
      success: false,
      message: 'idagence obligatoire'
    });
  }

  try {
    let sql = `
      SELECT 
        iduser,
        nom || ' ' || prenom AS nomcomplet
      FROM utilisateur
      WHERE etat = true
        AND idagence = $1
    `;

    const params = [idagence];

    if (search && search.trim() !== '') {
      sql += ` AND (nom ILIKE $2 OR prenom ILIKE $2 OR (nom || ' ' || prenom) ILIKE $2) `;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY iduser DESC`;

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});






// =======================================================
// LISTE DES COMPTES CLIENTS tontine AVEC RECHERCHE DYNAMIQUE
// =======================================================
router.get('/listecomptestontine', async (req, res) => {
    const { idagence, search } = req.query;

    // Vérification obligatoire
    if (!idagence) {
        return res.status(400).json({
            success: false,
            message: 'Le paramètre idagence est obligatoire'
        });
    }

    try {
        // 1. Recuperer idprod depuis gstockparametre
        const paramQuery = `
            SELECT parametreentier
            FROM gstockparametre
            WHERE idagence = $1
            AND idpar = 9
            LIMIT 1
        `;

        const paramResult = await pool.query(paramQuery, [idagence]);

        if (paramResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Paramètre produit introuvable'
            });
        }

        const idprod = paramResult.rows[0].parametreentier;

        // 2. Requête principale
        let sql = `
            SELECT 
                fc.*,
                cl.nom,
                cl.prenom,
                (cl.nom || ' ' || cl.prenom) AS nomcomplet,
                cl.telephone
            FROM finaclient_comptes fc
            INNER JOIN finaclients cl 
                ON fc.idclient = cl.idclient
            WHERE fc.idprod = $1
            AND fc.idagence = $2
        `;

        let params = [idprod, idagence];

        // 3. Recherche dynamique
        if (search && search.trim() !== '') {
            sql += `
                AND (
                    cl.nom ILIKE $3
                    OR cl.prenom ILIKE $3
                    OR cl.telephone ILIKE $3
                    OR fc.codeclient ILIKE $3
                )
            `;
            params.push(`%${search}%`);
        }

        sql += ` ORDER BY fc.idcompte DESC`;

        const result = await pool.query(sql, params);

        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});


router.get('/liste-carnets-operationtontine', async (req, res) => {
    const { idagence, search } = req.query;

    if (!idagence) {
        return res.status(400).json({
            success: false,
            message: 'idagence obligatoire'
        });
    }

    try {
        let sql = `
            SELECT
                fc.idcarnet,
                fc.codecarnet,
                fc.idtypescarnet,
                fc.durree,
                fc.idclient,
                fc.codeclient,
                fc.designation,
                fc.codecompte,
                fc.idagence,
                fc.idprod,
                fc.idcycle,
                fc.iduser,
                fc.mise,
                fc.solde,
                fc.prixvente,
                fc.case_selectionne,
                fc.cycles,
                fc.position_case,
                fc.date_creation,
                fc.date_fermeture,
                fc.etat,
                fc.date,
                cl.photo
            FROM fina_carnet_tontine fc
            INNER JOIN finaclients cl
                ON fc.idclient = cl.idclient
            WHERE fc.idagence = $1
            AND fc.etat = TRUE
        `;

        const params = [idagence];

        if (search) {
            const searchValue = search.trim();

            if (!isNaN(searchValue)) {
                sql += `
                    AND (
                        fc.designation ILIKE $2
                        OR RIGHT(fc.codecarnet,6)::INTEGER = $3
                    )
                `;

                params.push(`%${searchValue}%`);
                params.push(parseInt(searchValue));
            } else {
                sql += `
                    AND fc.designation ILIKE $2
                `;

                params.push(`%${searchValue}%`);
            }
        }

        sql += `
            ORDER BY fc.idcarnet DESC
        `;

        const result = await pool.query(sql, params);

        res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur SQL:', error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});











// routes/carnets.js
router.get('/liste-carnets-operationtontine-par-user', async (req, res) => {
    const { idagence, iduser, search } = req.query;

    if (!idagence || !iduser) {
        return res.status(400).json({
            success: false,
            message: 'idagence et iduser obligatoires'
        });
    }

    try {
        let sql = `
            SELECT  DISTINCT
                fc.idcarnet,
                fc.codecarnet,
                fc.idtypescarnet,
                fc.durree,
                fc.idclient,
                fc.codeclient,
                fc.designation,
                fc.codecompte,
                fc.idagence,
                fc.idprod,
                fc.idcycle,
                fc.iduser,
                fc.mise,
                fc.solde,
                fc.prixvente,
                fc.case_selectionne,
                fc.cycles,
                fc.position_case,
                fc.date_creation,
                fc.date_fermeture,
                fc.etat,
                fc.date,
                cl.photo
            FROM fina_carnet_tontine fc
            INNER JOIN finaclients cl
                ON fc.idclient = cl.idclient
                INNER JOIN ges_agent_commercial ag ON
				ag.id=cl.idgest
            WHERE fc.idagence = $1
              AND ag.iduser = $2
              AND fc.etat = TRUE
        `;

        // ⚡️ params toujours dans le bon ordre
        const params = [idagence, iduser];

        if (search) {
            const searchValue = search.trim();

            if (!isNaN(searchValue)) {
                sql += `
                    AND (
                        fc.designation ILIKE $3
                        OR RIGHT(fc.codecarnet,6)::INTEGER = $4
                    )
                `;
                params.push(`%${searchValue}%`);
                params.push(parseInt(searchValue));
            } else {
                sql += `
                    AND fc.designation ILIKE $3
                `;
                params.push(`%${searchValue}%`);
            }
        }

        sql += ` ORDER BY fc.idcarnet DESC`;

        const result = await pool.query(sql, params);

        res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur SQL:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});








// Dans votre route, remplacez 'client' par 'pool'
router.get('/carnet-position/:idcarnet/:idcycle', async (req, res) => {
    const { idcarnet, idcycle } = req.params;
    try {
        const query = `
            SELECT 
                MAX(position_case) as max_pos,
                string_agg(case_selectionne, ',') as all_cases
            FROM fina_operation_tontine 
            WHERE idcarnet = $1 AND idcycle = $2 AND typesoperation = 'depot'
        `;
        
        // On utilise pool.query au lieu de client.query
        const result = await pool.query(query, [idcarnet, idcycle]);
        
        res.json({
            success: true,
            position: result.rows[0].max_pos || 0,
            cases: result.rows[0].all_cases || ""
        });
    } catch (err) {
        console.error(err); // Pour voir l'erreur précise dans votre console serveur
        res.status(500).json({ success: false, error: err.message });
    }
});





router.get('/liste-positions-disponibles', async (req, res) => {
    try {
        const idagence = parseInt(String(req.query.idagence || '').replace(/"/g, '').trim(), 10);
        const idcarnet = parseInt(String(req.query.idcarnet || '').replace(/"/g, '').trim(), 10);

        if (!idagence || !idcarnet) {
            return res.status(400).json({
                success: false,
                message: 'idagence et idcarnet sont obligatoires'
            });
        }

        const query = `
WITH depots AS (
    SELECT 
        idcarnet,
        idcycle,
        montant
    FROM fina_operation_tontine
    WHERE idagence = $1
      AND idcarnet = $2
      AND TRIM(typesoperation) = 'depot'
),

retraits AS (
    SELECT 
        idcarnet,
        idcycle,
        montant
    FROM fina_operation_tontine
    WHERE idagence = $1
      AND idcarnet = $2
      AND TRIM(typesoperation) = 'retrait'
),

transferts AS (
    SELECT 
        idcarnet,
        idcycle,
        montant
    FROM fina_operation_tontine
    WHERE idagence = $1
      AND idcarnet = $2
      AND TRIM(typesoperation) = 'transfert'
),

positions AS (
    SELECT 
        idcarnet,
        idcycle,
        unnest(string_to_array(case_selectionne, ','))::INT AS position_case,
        montant
    FROM fina_operation_tontine
    WHERE idagence = $1
      AND idcarnet = $2
      AND TRIM(typesoperation) = 'depot'
),

retraits_pos AS (
    SELECT 
        idcarnet,
        idcycle,
        unnest(string_to_array(case_selectionne, ','))::INT AS position_case
    FROM fina_operation_tontine
    WHERE idagence = $1
      AND idcarnet = $2
      AND TRIM(typesoperation) IN ('retrait','transfert')
),

positions_restantes AS (
    SELECT p.*
    FROM positions p
    LEFT JOIN retraits_pos r
      ON p.idcarnet = r.idcarnet
     AND p.idcycle = r.idcycle
     AND p.position_case = r.position_case
    WHERE r.position_case IS NULL
)

SELECT
    p.idcarnet,
    p.idcycle,
    COUNT(*) AS nombre_positions_disponibles,
    STRING_AGG(p.position_case::TEXT, ',' ORDER BY p.position_case) AS positions_disponibles,

    -- 🔥 SOLDE CORRECT
    (
        (SELECT COALESCE(SUM(montant),0)
         FROM depots d
         WHERE d.idcarnet = p.idcarnet AND d.idcycle = p.idcycle)

        -

        (SELECT COALESCE(SUM(montant),0)
         FROM retraits r
         WHERE r.idcarnet = p.idcarnet AND r.idcycle = p.idcycle)

        -

        (SELECT COALESCE(SUM(montant),0)
         FROM transferts t
         WHERE t.idcarnet = p.idcarnet AND t.idcycle = p.idcycle)
    ) AS solde_disponible

FROM positions_restantes p
GROUP BY p.idcarnet, p.idcycle
ORDER BY p.idcycle;
`;

        const result = await pool.query(query, [idagence, idcarnet]);

        return res.status(200).json({
            success: true,
            total_cycles: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});



router.get('/liste-types-comptes-produit', async (req, res) => {
    try {
        const query = `
            SELECT 
                idtypescomptes,
                codetypescomptes,
                designation,
                etat,
                date_creation
            FROM fina_typescomptesproduit
            ORDER BY idtypescomptes ASC;
        `;

        const result = await pool.query(query);

        return res.status(200).json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur affichage types comptes produit:', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});








///    EPARGNE









router.get('/liste-compte-epargne', async (req, res) => {
    const { idagence, search } = req.query;

    if (!idagence) {
        return res.status(400).json({
            success: false,
            message: 'idagence obligatoire'
        });
    }

    try {
        let sql = `
            SELECT 
                fc.idcompte,
                fc.idclient,
                fc.codeclient,
                CONCAT(cl.nom, ' ', cl.prenom) AS nomcomplet,
                fc.idprod,
                pe.designation,
                fc.idagence,
                fc.codecompte,
                fc.solde,
                fc.codetypescomptes,
                cl.photo
            FROM finaclient_comptes fc
            JOIN finaclients cl 
                ON fc.idclient = cl.idclient
            JOIN fina_produitepargne pe
                ON fc.idprod = pe.idprod
            WHERE fc.idagence = $1
              AND fc.etat = TRUE
              AND fc.codetypescomptes = 'EPG'
        `;

        const params = [idagence];

        // Recherche dynamique
        if (search && search.trim() !== '') {
            const searchValue = search.trim();

            if (!isNaN(searchValue)) {
                const param2 = params.length + 1;
                const param3 = params.length + 2;

                sql += `
                    AND (
                        CONCAT(cl.nom, ' ', cl.prenom) ILIKE $${param2}
                        OR RIGHT(fc.codeclient, 5)::INTEGER = $${param3}
                    )
                `;

                params.push(`%${searchValue}%`);
                params.push(parseInt(searchValue, 10));

            } else {
                const param2 = params.length + 1;

                sql += `
                    AND CONCAT(cl.nom, ' ', cl.prenom) ILIKE $${param2}
                `;

                params.push(`%${searchValue}%`);
            }
        }

        sql += `
            ORDER BY fc.idcompte DESC
        `;

        const result = await pool.query(sql, params);

        return res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur SQL:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});




router.get('/mode-calcul-amortissement', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM fina_modecalculeamortissement
            ORDER BY idmodecalcule
        `);

        res.json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});








router.get('/liste-compte-credit', async (req, res) => {
    const { idagence, search } = req.query;

    if (!idagence) {
        return res.status(400).json({
            success: false,
            message: 'idagence obligatoire'
        });
    }

    try {
        let sql = `
            SELECT 
                fc.idcompte,
                fc.idclient,
                fc.codeclient,
                CONCAT(cl.nom, ' ', cl.prenom) AS nomcomplet,
                fc.idprod,
                pe.designation,
                fc.idagence,
                fc.codecompte,
                pe.taux_interet_max,
                pe.duree_min,
                pe.compteinteret,
                pe.comptepenalite,
                pe.comptecreditdeclasse,
                fc.solde,
                fc.codetypescomptes,
                cl.photo
            FROM finaclient_comptes fc
            JOIN finaclients cl 
                ON fc.idclient = cl.idclient
            JOIN fina_produitepargne pe
                ON fc.idprod = pe.idprod
            WHERE fc.idagence = $1
              AND fc.etat = TRUE
              AND fc.codetypescomptes = 'CRED'
        `;

        const params = [idagence];

        // Recherche dynamique
        if (search && search.trim() !== '') {
            const searchValue = search.trim();

            if (!isNaN(searchValue)) {
                const param2 = params.length + 1;
                const param3 = params.length + 2;

                sql += `
                    AND (
                        CONCAT(cl.nom, ' ', cl.prenom) ILIKE $${param2}
                        OR RIGHT(fc.codeclient, 5)::INTEGER = $${param3}
                    )
                `;

                params.push(`%${searchValue}%`);
                params.push(parseInt(searchValue, 10));

            } else {
                const param2 = params.length + 1;

                sql += `
                    AND CONCAT(cl.nom, ' ', cl.prenom) ILIKE $${param2}
                `;

                params.push(`%${searchValue}%`);
            }
        }

        sql += `
            ORDER BY fc.idcompte DESC
        `;

        const result = await pool.query(sql, params);

        return res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur SQL:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});








router.get('/liste-demande-creditenatente', async (req, res) => {
    const { idagence, search } = req.query;

    if (!idagence) {
        return res.status(400).json({
            success: false,
            message: 'idagence obligatoire'
        });
    }

    try {
        let sql = `
           
SELECT 
    fdc.iddemande,
    fdc.code_demande,
    fdc.code_decaissement,
    fdc.date_demande,
    fdc.idclient,
    cl.codeclient,
    cl.nom || ' ' || cl.prenom AS nomcomplet,
    cl.telephone,
    fdc.idagence,
    fdc.iduser,
    fdc.idobjet,
    fdc.montant_demande,
    fdc.montant_accorde,
    fdc.montant_rembourse,
    fdc.duree_mois,
    fdc.duree_grace,
    fdc.frequence,
    fdc.taux_interet,
    fdc.objetdetail,
    fdc.photoclient
FROM fina_credit_demande fdc
INNER JOIN finaclients cl 
    ON cl.idclient = fdc.idclient
WHERE fdc.idagence=$1 and fdc.etat = TRUE
AND fdc.statut = 'EN_ATTENTE'

        `;

        const params = [idagence];

        // Recherche dynamique
        if (search && search.trim() !== '') {
            const searchValue = search.trim();

            if (!isNaN(searchValue)) {
                const param2 = params.length + 1;
                const param3 = params.length + 2;

                sql += `
                    AND (
                        CONCAT(cl.nom, ' ', cl.prenom) ILIKE $${param2}
                        OR RIGHT(cl.codeclient, 5)::INTEGER = $${param3}
                    )
                `;

                params.push(`%${searchValue}%`);
                params.push(parseInt(searchValue, 10));

            } else {
                const param2 = params.length + 1;

                sql += `
                    AND CONCAT(cl.nom, ' ', cl.prenom) ILIKE $${param2}
                `;

                params.push(`%${searchValue}%`);
            }
        }

        sql += `
            ORDER BY  fdc.iddemande DESC
        `;

        const result = await pool.query(sql, params);

        return res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur SQL:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});









router.get('/objet-visite', async (req, res) => {
    try {
        const query = `
            SELECT 
                idobjetvisite,
                designation,
                description,
                etat,
                date_creation
            FROM fina_credit_objetvisite
            WHERE etat = TRUE
            ORDER BY designation ASC;
        `;

        const result = await pool.query(query);

        res.status(200).json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});









// ==========================================
// LISTE DEMANDES CREDIT EN COURS
// ==========================================
router.get('/credit-demandesafficher', async (req, res) => {
    try {
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence obligatoire'
            });
        }

        const query = `
            SELECT
                fcd.*,
                CONCAT_WS(' ', fc.nom, fc.prenom) AS nomcomplet
            FROM fina_credit_demande fcd
            INNER JOIN finaclients fc
                ON fc.idclient = fcd.idclient
            WHERE fcd.idagence = $1
              AND fcd.statut = 'EN_ATTENTE' and idtypecomite is null
            ORDER BY fcd.iddemande DESC;
        `;

        const result = await pool.query(query, [idagence]);

        res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});





router.get('/credit-demandesafficherencours', async (req, res) => {
    try {
        const { idagence } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence obligatoire'
            });
        }

        const query = `
            SELECT
                fcd.*,
                CONCAT_WS(' ', fc.nom, fc.prenom) AS nomcomplet
            FROM fina_credit_demande fcd
            INNER JOIN finaclients fc
                ON fc.idclient = fcd.idclient
            WHERE fcd.idagence = $1
              AND fcd.statut = 'EN_COURS' and idtypecomite is not null
            ORDER BY fcd.iddemande DESC;
        `;

        const result = await pool.query(query, [idagence]);

        res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});









router.get('/comite-membresafficher', async (req, res) => {
    try {
        const { idagence, idtypecomite } = req.query;

        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence obligatoire'
            });
        }

        let query = `
            SELECT
                mc.idmembrecomite,
                mc.idtypecomite,
                mc.idagence,
                mc.iduser,
                mc.fonction,
                mc.present,
                mc.signature,
                mc.etat,
                mc.date_creation,
                CONCAT_WS(' ', ut.nom, ut.prenom) AS nomcomplet
            FROM fina_comite_membre mc
            INNER JOIN utilisateur ut
                ON ut.iduser = mc.iduser
            WHERE mc.idagence = $1
              AND mc.etat = TRUE
        `;

        const values = [idagence];

        if (idtypecomite) {
            query += ` AND mc.idtypecomite = $2`;
            values.push(idtypecomite);
        }

        query += ` ORDER BY mc.idmembrecomite DESC`;

        const result = await pool.query(query, values);

        res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});













// ==========================================
// MODIFIER TYPE COMITE DEMANDE CREDIT
// ==========================================


router.put('/credit-demandemiseajour/typecomite', async (req, res) => {
    console.log("--- Requête reçue ---");
    console.log("Body:", req.body); // Vérifie ici si les données arrivent

    try {
        const { idtypecomite, iddemande, idagence } = req.body;

        // Conversion forcée en entier pour éviter les erreurs PostgreSQL
        const valIdComite = parseInt(idtypecomite);
        const valIdDemande = parseInt(iddemande);
        const valIdAgence = parseInt(idagence);

        const query = `
            UPDATE fina_credit_demande
            SET idtypecomite = $1
            WHERE iddemande = $2
            AND idagence = $3
            RETURNING *;
        `;

        const result = await pool.query(query, [valIdComite, valIdDemande, valIdAgence]);




          const updateStatusQuery = `
            UPDATE fina_credit_demande 
            SET statut = 'EN_COURS' 
            WHERE iddemande = $1
        `;
        
        await pool.query(updateStatusQuery, [iddemande]);



        if (result.rowCount === 0) {
            console.log("Aucune ligne modifiée dans la DB");
            return res.status(404).json({ success: false, message: 'Demande non trouvée' });
        }

        res.status(200).json({ success: true, data: result.rows[0] });

    } catch (error) {
        console.error('ERREUR DB:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
/*
router.put('/credit-demandemiseajour/typecomite', async (req, res) => {
    try {
        const { idtypecomite, iddemande, idagence } = req.body;

        // Vérification des champs obligatoires
        if (!idtypecomite || !iddemande || !idagence) {
            return res.status(400).json({
                success: false,
                message: 'idtypecomite, iddemande et idagence sont obligatoires'
            });
        }

        const query = `
            UPDATE fina_credit_demande
            SET idtypecomite = $1
            WHERE iddemande = $2
            AND idagence = $3
            RETURNING *;
        `;

        const values = [
            idtypecomite,
            iddemande,
            idagence
        ];

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucune demande trouvée'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Mise à jour effectuée avec succès',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Erreur update type comité:', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});
*/















// ==========================================
// AFFICHER DEMANDES CREDIT COMITE
// ==========================================
router.get('/credit-demandes-comite-encours', async (req, res) => {
    try {
        const { iduser, idagence } = req.query;

        // Validation
        if (!iduser || !idagence) {
            return res.status(400).json({
                success: false,
                message: 'iduser et idagence sont obligatoires'
            });
        }

        const query = `
            SELECT 
                fcs.idsession,
                fcd.iddemande,
                fcd.code_demande,
                fcd.code_decaissement,
                fcd.date_demande,
                fcd.idclient,
                fcd.idagence,
                fcd.iduser,
                fcd.idobjet,
                fcd.montant_demande,
                fcd.montant_accorde,
                fcd.montant_rembourse,
                fcd.duree_mois,
                fcd.duree_grace,
                fcd.frequence,
                fcd.taux_interet,
                fcd.objetdetail,
                fcd.telephone,
                fcd.adresse,
                fcd.idpiece_identite,
                fcd.numero_piece_identite,
                fcd.idquartier,
                fcd.revenu_mensuel,
                fcd.garantie,
                fcd.statut,
                fcd.date_validation,
                fcd.idvalidateur,
                fcd.reste_a_payer,
                fcd.photoclient,
                fcd.photocarterecto,
                fcd.photocarteverso,
                fcd.signature_client,
                fcd.signature_agence,
                fcd.commentaire,
                fcd.etat,
                fcd.created_at,
                fcd.updated_at,
                fcd.idtypecomite,
                fcs.codesession,
                ag.nomagence,
                ft.designation AS typescomite,
                CONCAT_WS(' ', fc.nom, fc.prenom) AS nomcomplet,
                fco.designation AS objetcredit,
                fc.datenaisse,
                fc.sexe

            FROM fina_credit_demande fcd

            INNER JOIN finaclients fc 
                ON fc.idclient = fcd.idclient
                AND fc.idagence = $2

            INNER JOIN fina_credit_objet fco 
                ON fco.idobjet = fcd.idobjet

            INNER JOIN agence ag 
                ON ag.idagence = fcd.idagence

            INNER JOIN fina_comite_session fcs 
                ON fcs.iddemande = fcd.iddemande
                AND fcs.etat = TRUE

            INNER JOIN fina_comite_membre fcm 
                ON fcm.idmembrecomite = fcs.idmembrecomite
                AND fcm.iduser = $1

            INNER JOIN fina_comite_type ft 
                ON ft.idtypecomite = fcs.idtypecomite

            ORDER BY fcd.created_at DESC
        `;

        const values = [iduser, idagence];

        const result = await pool.query(query, values);

        return res.status(200).json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur affichage demandes crédit comité:', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});
















// ==========================================
// DETAIL COMPLET D'UNE DEMANDE DE CREDIT
// ==========================================
router.get('/credit-demande-detail-encours', async (req, res) => {
    try {
        const { iduser, idagence, iddemande } = req.query;

        // Validation
        if (!iduser || !idagence || !iddemande) {
            return res.status(400).json({
                success: false,
                message: 'iduser, idagence et iddemande sont obligatoires'
            });
        }

        // ==========================================
        // 1. DEMANDE PRINCIPALE
        // ==========================================
        const queryDemande = `
            SELECT 
                fcs.idsession,
                fcd.iddemande,
                fcd.code_demande,
                fcd.code_decaissement,
                fcd.date_demande,
                fcd.idclient,
                fcd.idagence,
                fcd.iduser,
                fcd.idobjet,
                fcd.montant_demande,
                fcd.montant_accorde,
                fcd.montant_rembourse,
                fcd.duree_mois,
                fcd.duree_grace,
                fcd.frequence,
                fcd.taux_interet,
                fcd.objetdetail,
                fcd.telephone,
                fcd.adresse,
                fcd.idpiece_identite,
                fcd.numero_piece_identite,
                fcd.idquartier,
                fcd.revenu_mensuel,
                fcd.garantie,
                fcd.statut,
                fcd.date_validation,
                fcd.idvalidateur,
                fcd.reste_a_payer,
                fcd.photoclient,
                fcd.photocarterecto,
                fcd.photocarteverso,
                fcd.signature_client,
                fcd.signature_agence,
                fcd.commentaire,
                fcd.etat,
                fcd.created_at,
                fcd.updated_at,
                fcd.idtypecomite,
                fcs.codesession,
                ag.nomagence,
                ft.designation AS typescomite,
                CONCAT_WS(' ', fc.nom, fc.prenom) AS nomcomplet,
                fco.designation AS objetcredit,
                fc.datenaisse,
                fc.sexe
            FROM fina_credit_demande fcd
            INNER JOIN finaclients fc 
                ON fc.idclient = fcd.idclient
                AND fc.idagence = $2
            INNER JOIN fina_credit_objet fco 
                ON fco.idobjet = fcd.idobjet
            INNER JOIN agence ag 
                ON ag.idagence = fcd.idagence
            INNER JOIN fina_comite_session fcs 
                ON fcs.iddemande = fcd.iddemande
                AND fcs.etat = TRUE
            INNER JOIN fina_comite_membre fcm 
                ON fcm.idmembrecomite = fcs.idmembrecomite
                AND fcm.iduser = $1
            INNER JOIN fina_comite_type ft 
                ON ft.idtypecomite = fcs.idtypecomite
            WHERE fcd.iddemande = $3
            ORDER BY fcd.created_at DESC
            LIMIT 1
        `;

        // ==========================================
        // 2. CAUTIONS
        // ==========================================
        const queryCaution = `
            SELECT *
            FROM fina_caution_credit
            WHERE iddemande = $1
            ORDER BY date_creation DESC
        `;

        // ==========================================
        // 3. VISITES
        // ==========================================
        const queryVisite = `
            SELECT *
            FROM fina_credit_visite
            WHERE iddemande = $1
            ORDER BY date_creation DESC
        `;

        // ==========================================
        // 4. COMPTE EXPLOITATION
        // ==========================================
        const queryCompte = `
            SELECT *
            FROM fina_compteexploitation
            WHERE iddemande = $1
            ORDER BY date_creation DESC
        `;

        // Exécution parallèle
        const [
            demandeResult,
            cautionResult,
            visiteResult,
            compteResult
        ] = await Promise.all([
            pool.query(queryDemande, [iduser, idagence, iddemande]),
            pool.query(queryCaution, [iddemande]),
            pool.query(queryVisite, [iddemande]),
            pool.query(queryCompte, [iddemande])
        ]);

        if (demandeResult.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Demande introuvable'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                demande: demandeResult.rows[0],
                cautions: cautionResult.rows,
                visites: visiteResult.rows,
                compte_exploitation: compteResult.rows
            }
        });

    } catch (error) {
        console.error('Erreur détail demande crédit:', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});






/*
router.put('/comite-session-update', async (req, res) => {
    try {
        const {
            idsession,
            montant_accorde,
            score,
            observation,
            commentaire
        } = req.body;

        if (!idsession) {
            return res.status(400).json({
                success: false,
                message: 'idsession obligatoire'
            });
        }

        const query = `
            UPDATE fina_comite_session
            SET 
                montant_accorde = $1,
                score = $2,
                observation = $3,
                commentaire = $4
            WHERE idsession = $5
            RETURNING *;
        `;

        const values = [
            montant_accorde,
            score,
            observation,
            commentaire,
            idsession
        ];

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Session introuvable'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Mise à jour effectuée avec succès',
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});
*/




/*

router.put('/comite-session-update', async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            idsession,
            montant_accorde,
            score,
            observation,
            commentaire
        } = req.body;

        if (!idsession) {
            return res.status(400).json({
                success: false,
                message: 'idsession obligatoire'
            });
        }

        await client.query('BEGIN');

        // ==================================================
        // 1. UPDATE SESSION COMITÉ
        // ==================================================
        const updateQuery = `
            UPDATE fina_comite_session
            SET 
                montant_accorde = $1,
                score = $2,
                observation = $3,
                commentaire = $4
            WHERE idsession = $5
            RETURNING idsession, codesession, iddemande;
        `;

        const updateValues = [
            montant_accorde,
            score,
            observation,
            commentaire,
            idsession
        ];

        const updateResult = await client.query(updateQuery, updateValues);

        if (updateResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Session introuvable'
            });
        }

        const { codesession, iddemande } = updateResult.rows[0];

        // ==================================================
        // 2. VERIFIER SI TOUS LES MEMBRES ONT VOTE
        // ==================================================
        const checkQuery = `
            SELECT 
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE score > 0) AS votes,
                CASE 
                    WHEN COUNT(*) = COUNT(*) FILTER (WHERE score > 0)
                    THEN 1 ELSE 0
                END AS complet
            FROM fina_comite_session
            WHERE codesession = $1;
        `;

        const checkResult = await client.query(checkQuery, [codesession]);

        const isComplete = checkResult.rows[0].complet === 1;

        let decisionFinale = null;

        // ==================================================
        // 3. SI TOUS ONT VOTE → CALCUL VALIDATION
        // ==================================================
        if (isComplete) {

            const bestQuery = `
                SELECT DISTINCT ON (iddemande)
                    iddemande,
                    montant_accorde,
                    score
                FROM fina_comite_session
                WHERE codesession = $1
                  AND score >= 10
                ORDER BY iddemande, score DESC;
            `;

            const bestResult = await client.query(bestQuery, [codesession]);

            if (bestResult.rows.length > 0) {

                const best = bestResult.rows[0];

                // ==================================================
                // 4. UPDATE CREDIT DEMANDE
                // ==================================================
                const updateCredit = `
    UPDATE fina_credit_demande
    SET 
        montant_accorde = $1,
        statut = 'APPROUVE',
        date_fermeture = NOW()
    WHERE iddemande = $2 
    RETURNING *;
`;

                await client.query(updateCredit, [
                    best.montant_accorde,
                    best.iddemande
                ]);

                decisionFinale = 'FERME';
            }
        }




         const updateQuery = `
            UPDATE fina_comite_session
            SET 
                etat = false,
              
            WHERE codesession = $5
            RETURNING idsession, codesession, iddemande;
        `;


        await client.query('COMMIT');

        // ==================================================
        // 5. RESPONSE
        // ==================================================
        return res.status(200).json({
            success: true,
            message: 'Mise à jour effectuée avec succès',
            codesession,
            iddemande,
            validation_complete: isComplete,
            decision: decisionFinale,
            data: updateResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    } finally {
        client.release();
    }
});

*/





router.put('/comite-session-update', async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            idsession,
            montant_accorde,
            score,
            observation,
            commentaire
        } = req.body;

        if (!idsession) {
            return res.status(400).json({
                success: false,
                message: 'idsession obligatoire'
            });
        }

        await client.query('BEGIN');

        // ==================================================
        // 1. UPDATE SESSION COMITÉ
        // ==================================================
        const updateSessionQuery = `
            UPDATE fina_comite_session
            SET 
                montant_accorde = $1,
                score = $2,
                observation = $3,
                commentaire = $4
            WHERE idsession = $5
            RETURNING idsession, codesession, iddemande;
        `;

        const updateResult = await client.query(updateSessionQuery, [
            montant_accorde,
            score,
            observation,
            commentaire,
            idsession
        ]);

        if (updateResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Session introuvable'
            });
        }

        const { codesession } = updateResult.rows[0];

        // ==================================================
        // 2. VERIFIER SI TOUS ONT VOTE
        // ==================================================
        const checkQuery = `
            SELECT 
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE score > 0) AS votes,
                CASE 
                    WHEN COUNT(*) = COUNT(*) FILTER (WHERE score > 0)
                    THEN 1 ELSE 0
                END AS complet
            FROM fina_comite_session
            WHERE codesession = $1;
        `;

        const checkResult = await client.query(checkQuery, [codesession]);

        const isComplete = checkResult.rows[0].complet === 1;

        let decisionFinale = null;

        // ==================================================
        // 3. SI TOUS ONT VOTE → VALIDATION
        // ==================================================
        if (isComplete) {

            const bestQuery = `
                SELECT DISTINCT ON (iddemande)
                    iddemande,
                    montant_accorde,
                    score
                FROM fina_comite_session
                WHERE codesession = $1
                  AND score >= 10
                ORDER BY iddemande, score DESC;
            `;

            const bestResult = await client.query(bestQuery, [codesession]);

            if (bestResult.rows.length > 0) {

                const best = bestResult.rows[0];

                // ==================================================
                // 4. UPDATE CREDIT DEMANDE
                // ==================================================
                const updateCredit = `
                    UPDATE fina_credit_demande
                    SET 
                        montant_accorde = $1,
                        statut = 'VALIDE'
                       
                    WHERE iddemande = $2
                    RETURNING *;
                `;

                await client.query(updateCredit, [
                    best.montant_accorde,
                    best.iddemande
                ]);

                decisionFinale = 'APPROUVE';
            }

            // ==================================================
            // 5. FERMER LA SESSION COMITE
            // ==================================================
            const closeSessionQuery = `
                UPDATE fina_comite_session
                SET etat = FALSE,
                statut = 'FERME',
                date_fermeture = NOW()
                WHERE codesession = $1
                RETURNING idsession;
            `;

            await client.query(closeSessionQuery, [codesession]);
        }

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Mise à jour effectuée avec succès',
            codesession,
            validation_complete: isComplete,
            decision: decisionFinale
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    } finally {
        client.release();
    }
});











/*
// ==========================================
// DETAIL DEMANDE CREDIT + CAUTIONS + VISITES
// ==========================================
router.get('/credit-demande-detail-encours-tous', async (req, res) => {
    try {
        const { iduser, idagence, iddemande } = req.query;

        // Validation obligatoire
        if (!iduser || !idagence) {
            return res.status(400).json({
                success: false,
                message: 'iduser et idagence sont obligatoires'
            });
        }

        const query = `
            SELECT 
                fcs.idsession,
                fcd.iddemande,
                fcd.code_demande,
                fcd.code_decaissement,
                fcd.date_demande,
                fcd.idclient,
                fcd.idagence,
                fcd.iduser,
                fcd.idobjet,
                fcd.montant_demande,
                fcd.montant_accorde,
                fcd.montant_rembourse,
                fcd.duree_mois,
                fcd.duree_grace,
                fcd.frequence,
                fcd.taux_interet,
                fcd.objetdetail,
                fcd.telephone,
                fcd.adresse,
                fcd.idpiece_identite,
                fcd.numero_piece_identite,
                fcd.idquartier,
                fcd.revenu_mensuel,
                fcd.garantie,
                fcd.statut,
                fcd.date_validation,
                fcd.idvalidateur,
                fcd.reste_a_payer,
                fcd.photoclient,
                fcd.photocarterecto,
                fcd.photocarteverso,
                fcd.signature_client,
                fcd.signature_agence,
                fcd.commentaire,
                fcd.etat,
                fcd.created_at,
                fcd.updated_at,
                fcd.idtypecomite,
                fcs.codesession,

                ag.nomagence,
                ft.designation AS typescomite,
                CONCAT_WS(' ', fc.nom, fc.prenom) AS nomcomplet,
                fco.designation AS objetcredit,
                fc.datenaisse,
                fc.sexe,

                (
                    SELECT COALESCE(json_agg(cc), '[]'::json)
                    FROM fina_caution_credit cc
                    WHERE cc.iddemande = fcd.iddemande
                ) AS cautions,

                (
                    SELECT COALESCE(json_agg(cv), '[]'::json)
                    FROM fina_credit_visite cv
                    WHERE cv.iddemande = fcd.iddemande
                ) AS visites,

                (
                    SELECT COALESCE(json_agg(ce), '[]'::json)
                    FROM fina_compteexploitation ce
                    WHERE ce.iddemande = fcd.iddemande
                ) AS compte_exploitation

            FROM fina_credit_demande fcd

            INNER JOIN finaclients fc 
                ON fc.idclient = fcd.idclient
                AND fc.idagence = $2

            INNER JOIN fina_credit_objet fco 
                ON fco.idobjet = fcd.idobjet

            INNER JOIN agence ag 
                ON ag.idagence = fcd.idagence

            INNER JOIN fina_comite_session fcs 
                ON fcs.iddemande = fcd.iddemande
                AND fcs.etat = TRUE

            INNER JOIN fina_comite_membre fcm 
                ON fcm.idmembrecomite = fcs.idmembrecomite
                AND fcm.iduser = $1

            INNER JOIN fina_comite_type ft 
                ON ft.idtypecomite = fcs.idtypecomite








                    -- Calcul capacité de remboursement
            LEFT JOIN LATERAL (
                SELECT
                    SUM(fce.montant) FILTER (
                        WHERE fce.sensoperation = 'PRODUIT'
                    ) AS total_produits,

                    SUM(fce.montant) FILTER (
                        WHERE fce.sensoperation = 'CHARGE'
                    ) AS total_charges,

                    (
                        (
                            SUM(fce.montant) FILTER (
                                WHERE fce.sensoperation='PRODUIT'
                            )
                            -
                            SUM(fce.montant) FILTER (
                                WHERE fce.sensoperation='CHARGE'
                            )
                        ) * 0.40
                    ) AS capacite_supportable,

                    ROUND(
                        fcd.montant_demande / NULLIF(fcd.duree_mois, 0),
                        2
                    ) AS echeance_theorique,

                    CASE
                        WHEN (
                            (
                                SUM(fce.montant) FILTER (
                                    WHERE fce.sensoperation='PRODUIT'
                                )
                                -
                                SUM(fce.montant) FILTER (
                                    WHERE fce.sensoperation='CHARGE'
                                )
                            ) * 0.40
                        ) >= (
                            fcd.montant_demande / NULLIF(fcd.duree_mois,0)
                        )
                        THEN 'SUPPORTABLE'
                        ELSE 'NON SUPPORTABLE'
                    END AS decision

                FROM fina_compteexploitation fce
                WHERE fce.iddemande = fcd.iddemande
                AND fce.etat = TRUE
            ) cap ON TRUE








            WHERE ($3::bigint IS NULL OR fcd.iddemande = $3)

            ORDER BY fcd.created_at DESC
        `;

        const values = [
            iduser,
            idagence,
            iddemande || null
        ];

        const result = await pool.query(query, values);

        return res.status(200).json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur récupération détail crédit:', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});
*/



// ==========================================
// DETAIL DEMANDE CREDIT + ANALYSE COMPLETE
// ==========================================
router.get('/credit-demande-detail-encours-tous', async (req, res) => {
    try {
        const { iduser, idagence, iddemande } = req.query;

        if (!iduser || !idagence) {
            return res.status(400).json({
                success: false,
                message: 'iduser et idagence sont obligatoires'
            });
        }

        const query = `
        SELECT 
            fcs.idsession,
            fcd.iddemande,
            fcd.code_demande,
            fcd.code_decaissement,
            fcd.date_demande,
            fcd.idclient,
            fcd.idagence,
            fcd.iduser,
            fcd.idobjet,
            fcd.montant_demande,
            fcd.montant_accorde,
            fcd.montant_rembourse,
            fcd.duree_mois,
            fcd.duree_grace,
            fcd.frequence,
            fcd.taux_interet,
            fcd.objetdetail,
            fcd.telephone,
            fcd.adresse,
            fcd.revenu_mensuel,
            fcd.garantie,
            fcd.statut,
            fcd.reste_a_payer,
            fcd.created_at,
            fcd.idtypecomite,
            fcs.codesession,

            ag.nomagence,
            ft.designation AS typescomite,
            CONCAT_WS(' ', fc.nom, fc.prenom) AS nomcomplet,
            fco.designation AS objetcredit,
            fc.sexe,

            -- =========================
            -- ANALYSE FINANCIÈRE
            -- =========================
            cap.total_produits,
            cap.total_charges,
            cap.capacite_supportable,
            cap.echeance_theorique,

            -- SCORE CAPACITE (0 - 1000)
            cap.score_capacite,

            -- TAUX D'ENDETTEMENT
            cap.taux_endettement,

            -- ANALYSE RISQUE REVENU
            cap.analyse_revenu,

            -- =========================
            -- DECISION INTELLIGENTE
            -- =========================
            CASE
                WHEN cap.score_capacite >= 700 
                     AND cap.taux_endettement <= 40 THEN 'APPROUVE'

                WHEN cap.score_capacite >= 400 
                     AND cap.taux_endettement <= 60 THEN 'AJOURNE'

                ELSE 'REJETÉ'
            END AS decision_finale,

            -- =========================
            -- CAUTIONS
            -- =========================
            (
                SELECT COALESCE(json_agg(cc), '[]'::json)
                FROM fina_caution_credit cc
                WHERE cc.iddemande = fcd.iddemande
            ) AS cautions,

            -- =========================
            -- VISITES
            -- =========================
            (
                SELECT COALESCE(json_agg(cv), '[]'::json)
                FROM fina_credit_visite cv
                WHERE cv.iddemande = fcd.iddemande
            ) AS visites,

            -- =========================
            -- COMPTE EXPLOITATION
            -- =========================
            (
                SELECT COALESCE(json_agg(ce), '[]'::json)
                FROM fina_compteexploitation ce
                WHERE ce.iddemande = fcd.iddemande
            ) AS compte_exploitation

        FROM fina_credit_demande fcd

        INNER JOIN finaclients fc 
            ON fc.idclient = fcd.idclient
            AND fc.idagence = $2

        INNER JOIN fina_credit_objet fco 
            ON fco.idobjet = fcd.idobjet

        INNER JOIN agence ag 
            ON ag.idagence = fcd.idagence

        INNER JOIN fina_comite_session fcs 
            ON fcs.iddemande = fcd.iddemande
            AND fcs.etat = TRUE

        INNER JOIN fina_comite_membre fcm 
            ON fcm.idmembrecomite = fcs.idmembrecomite
            AND fcm.iduser = $1

        INNER JOIN fina_comite_type ft 
            ON ft.idtypecomite = fcs.idtypecomite

        -- =========================
        -- CALCUL FINANCIER COMPLET
        -- =========================
        LEFT JOIN LATERAL (
            SELECT

                COALESCE(SUM(fce.montant) FILTER (
                    WHERE fce.sensoperation = 'PRODUIT'
                ),0) AS total_produits,

                COALESCE(SUM(fce.montant) FILTER (
                    WHERE fce.sensoperation = 'CHARGE'
                ),0) AS total_charges,

                (
                    (
                        COALESCE(SUM(fce.montant) FILTER (
                            WHERE fce.sensoperation='PRODUIT'
                        ),0)
                        -
                        COALESCE(SUM(fce.montant) FILTER (
                            WHERE fce.sensoperation='CHARGE'
                        ),0)
                    ) * 0.40
                ) AS capacite_supportable,

                COALESCE(
                    ROUND(
                        fcd.montant_demande / NULLIF(fcd.duree_mois, 0),
                        2
                    ),
                0) AS echeance_theorique,

                -- SCORE 0 - 1000
                LEAST(
                    ROUND(
                        (
                            (
                                (
                                    COALESCE(SUM(fce.montant) FILTER (
                                        WHERE fce.sensoperation='PRODUIT'
                                    ),0)
                                    -
                                    COALESCE(SUM(fce.montant) FILTER (
                                        WHERE fce.sensoperation='CHARGE'
                                    ),0)
                                ) * 0.40
                            ) / NULLIF(
                                fcd.montant_demande / NULLIF(fcd.duree_mois,0),
                                0
                            )
                        ) * 100,
                    0),
                1000) AS score_capacite,

                -- TAUX ENDETTEMENT
                ROUND(
                    (fcd.montant_demande / NULLIF(fcd.revenu_mensuel,0)) * 100,
                0) AS taux_endettement,

                -- ANALYSE REVENU
                CASE
                    WHEN (fcd.montant_demande / NULLIF(fcd.revenu_mensuel,0)) > 0.6 
                        THEN 'RISQUE ELEVE'
                    WHEN (fcd.montant_demande / NULLIF(fcd.revenu_mensuel,0)) > 0.4 
                        THEN 'RISQUE MOYEN'
                    ELSE 'BON'
                END AS analyse_revenu

            FROM fina_compteexploitation fce
            WHERE fce.iddemande = fcd.iddemande
            AND fce.etat = TRUE
        ) cap ON TRUE

        WHERE ($3::bigint IS NULL OR fcd.iddemande = $3)

        ORDER BY fcd.created_at DESC
        `;

        const values = [iduser, idagence, iddemande || null];

        const result = await pool.query(query, values);

        return res.status(200).json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur API crédit:', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});















// ==========================================
// LISTE DES CREDITS VALIDES
// ==========================================
// ==========================================
// LISTE DES CREDITS VALIDES PAR AGENCE
// ==========================================
router.get('/credit-demandes-valides', async (req, res) => {
    try {
        const { idagence } = req.query;

        // Vérification obligatoire
        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: 'idagence est obligatoire'
            });
        }

        const query = `
            SELECT 
                fcd.iddemande,
                fcd.code_demande,
                fcd.code_decaissement,
                fcd.date_demande,
                fcd.idclient,
                fcd.idagence,
                fcd.iduser,
                fcd.idobjet,
                fcd.montant_demande,
                fcd.montant_accorde,
                fcd.montant_rembourse,
                fcd.duree_mois,
                fcd.duree_grace,
                fcd.frequence,
                fcd.taux_interet,
                fcd.objetdetail,
                fcd.telephone,
                fcd.adresse,
                fcd.idpiece_identite,
                fcd.numero_piece_identite,
                fcd.idquartier,
                fcd.revenu_mensuel,
                fcd.garantie,
                fcd.statut,
                fcd.date_validation,
                fcd.idvalidateur,
                fcd.reste_a_payer,
                fcd.photoclient,
                fcd.photocarterecto,
                fcd.photocarteverso,
                fcd.signature_client,
                fcd.signature_agence,
                fcd.commentaire,
                fcd.etat,
                fcd.created_at,
                fcd.updated_at,
                fcd.idtypecomite,
                fcd.idprod,
                fcd.comptecredit,
                CONCAT_WS(' ', fc.nom, fc.prenom) AS nomcomplet
            FROM fina_credit_demande fcd
            INNER JOIN finaclients fc 
                ON fc.idclient = fcd.idclient
            WHERE fcd.statut = $1
              AND fcd.idagence = $2
            ORDER BY fcd.iddemande DESC
        `;

        const values = ['VALIDE', idagence];

        const result = await pool.query(query, values);

        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur récupération crédits validés :', error);

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des crédits validés',
            error: error.message
        });
    }
});









// GET comptes épargne client
router.get('/comptes-epargneclient', async (req, res) => {
    const client = await pool.connect();

    try {
        const { idclient, idagence } = req.query;

        if (!idclient || !idagence) {
            return res.status(400).json({
                success: false,
                message: 'idclient et idagence sont obligatoires'
            });
        }

        const query = `
            SELECT 
                fc.codecompte AS compteepargne,
                fpe.designation
            FROM finaclient_comptes fc
            INNER JOIN fina_produitepargne fpe 
                ON fc.idprod = fpe.idprod
            WHERE fc.idclient = $1
              AND fc.idagence = $2
              AND fc.codetypescomptes = 'EPG'
        `;

        const result = await client.query(query, [idclient, idagence]);

        return res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur SQL:', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });

    } finally {
        client.release();
    }
});






// ===================================================
// AFFICHER NOM ET PRENOM UTILISATEUR PAR ID
// URL: /utilisateur/1
// ===================================================
router.get('/utilisateur/:iduser', async (req, res) => {
  try {
    const { iduser } = req.params;

    // Vérification
    if (!iduser) {
      return res.status(400).json({
        success: false,
        message: 'iduser est obligatoire'
      });
    }

    const result = await pool.query(
      `
      SELECT nom, prenom
      FROM utilisateur
      WHERE iduser = $1
      `,
      [iduser]
    );

    // Vérifier si utilisateur trouvé
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});





// ======================================================
// LISTE DES DECAISSEMENTS AVEC RECHERCHE DYNAMIQUE
// Recherche sur :
// - nom complet
// - code décaissement
// - compte crédit
// - compte épargne
// - téléphone client
// - code client
//
// URL EXEMPLE :
// /decaissements?idagence=1&datedebut=2026-01-01&datefin=2026-12-31&search=kodjo
// ======================================================

router.get('/listedecaissementsencoursentredate', async (req, res) => {
    const client = await pool.connect();

    try {

        const {
            idagence,
            datedebut,
            datefin,
            search = ''
        } = req.query;

        // =========================================
        // VALIDATION
        // =========================================
        if (!idagence || !datedebut || !datefin) {
            return res.status(400).json({
                success: false,
                message: 'idagence, datedebut et datefin sont obligatoires'
            });
        }

        // =========================================
        // REQUETE SQL
        // =========================================
       const query = `
    SELECT
        fcd.iddecaissement,
        fcd.code_decaissement,
        fcd.dateoperation,
        fcd.iddemande,
        fcd.iduser,
        fcd.idclient,
        fcd.montant_accorde,
        fcd.montant_decaisse,
        fcd.duree_mois,
        fcd.duree_grace,
        fcd.frequence,
        fcd.taux_interet,
        fcd.idprod,
        fcd.comptecredit,
        fcd.modepaiement,
        fcd.compteepargne,
        fcd.datesaisie,
        fcd.datevalider,
        fcd.statut,
        fcd.created_at,
        fcd.updated_at,
        fcd.codemodecalcule,
        fcd.signature_client,
        fcd.signature_agence,
        fcd.idagence,

        fc.codeclient,
        fc.telephone,

        TRIM(fc.nom || ' ' || fc.prenom) AS nomcomplet

    FROM fina_credit_decaissement fcd

    JOIN finaclients fc
        ON fc.idclient = fcd.idclient

    WHERE fcd.idagence = $1

    AND DATE(fcd.dateoperation)
        BETWEEN $2 AND $3

    AND (
        TRIM(fc.nom || ' ' || fc.prenom)
            ILIKE '%' || $4 || '%'

        OR fc.codeclient
            ILIKE '%' || $4 || '%'

        OR fc.telephone
            ILIKE '%' || $4 || '%'

        OR fcd.code_decaissement
            ILIKE '%' || $4 || '%'

        OR fcd.comptecredit
            ILIKE '%' || $4 || '%'

        OR fcd.compteepargne
            ILIKE '%' || $4 || '%'
    )

    ORDER BY fcd.dateoperation DESC
`;

        // =========================================
        // EXECUTION
        // =========================================
        const result = await client.query(
            query,
            [
                idagence,
                datedebut,
                datefin,
                search
            ]
        );

        // =========================================
        // RETOUR
        // =========================================
        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {
        client.release();
    }
});















// ======================================================
// AFFICHER TABLEAU AMORTISSEMENT PAR CODE DEC
// ======================================================
router.get('/amortissementclient/:codedec', async (req, res) => {
    const client = await pool.connect();

    try {
        const { codedec } = req.params;

        // =========================
        // VALIDATION
        // =========================
        if (!codedec) {
            return res.status(400).json({
                success: false,
                message: 'codedec est obligatoire'
            });
        }

        // =========================
        // REQUETE SQL OPTIMISEE
        // =========================
        const query = `
            SELECT
                id,
                period,
                date,
                capital,
                interet,
                echeancemes,
                soldecapital,
                dateremb,
                capitalremb,
                intremb,
                totalremb,
                idclients,
                codeclients,
                codedec,
                idagence,
                etat,
                etatr,
                comptecredit,
                compteclient,
                retard,
                interetretard,
                penaliteretard,
                totaldue,
                interetretardremb,
                penaliteretardremb
            FROM tableauamortissementgesecheancedetail
            WHERE codedec = $1
            ORDER BY period ASC
        `;

        // =========================
        // EXECUTION
        // =========================
        const result = await client.query(query, [codedec]);

        // =========================
        // REPONSE
        // =========================
        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur amortissement:', error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {
        client.release();
    }
});










// ======================================================
// LISTE OPERATIONS TONTINE
// idagence obligatoire
// iduser facultatif
// typesoperation facultatif
// ======================================================
// ======================================================
// LISTE OPERATIONS TONTINE
// idagence obligatoire
// iduser facultatif
// typesoperation facultatif
// ======================================================
// ======================================================
// RAPPORT OPERATIONS TONTINE
// idagence obligatoire
// date_debut obligatoire
// date_fin obligatoire
// iduser facultatif
// typesoperation facultatif
// ======================================================

router.get('/rapport-operations-tontine', async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            idagence,
            date_debut,
            date_fin,
            iduser,
            typesoperation
        } = req.query;

        // =========================================
        // VALIDATION
        // =========================================
        if (!idagence || !date_debut || !date_fin) {

            return res.status(400).json({
                success: false,
                message: 'idagence, date_debut et date_fin sont obligatoires'
            });
        }

        // =========================================
        // REQUETE SQL
        // =========================================
        let query = `
            SELECT
                fopt.idoperation,
                fopt.codeoperation,
                fopt.dateoperation,
                fopt.idcarnet,
                fopt.idclient,
                fopt.idprod,
                fopt.idcycle,
                fopt.iduser,
                fopt.idagence,
                fopt.codeclient,
                fopt.codecompte,
                fopt.designation,
                fopt.libelle,
                fopt.montant,
                fopt.typesoperation,
                fopt.solde,
                fopt.case_selectionne,
                fopt.position_case,
                fopt.date_creation,
                fopt.date_validation,
                fopt.etat,

                TRIM(u.nom || ' ' || u.prenom)
                    AS agentcollecte

            FROM fina_operation_tontine fopt

            JOIN utilisateur u
                ON u.iduser = fopt.iduser

            WHERE fopt.idagence = $1
            AND DATE(fopt.dateoperation)
                BETWEEN $2 AND $3
        `;

        // =========================================
        // PARAMETRES
        // =========================================
        const params = [
            idagence,
            date_debut,
            date_fin
        ];

        let index = 4;

        // =========================================
        // FILTRE UTILISATEUR
        // =========================================
        if (iduser) {

            query += `
                AND fopt.iduser = $${index}
            `;

            params.push(iduser);
            index++;
        }

        // =========================================
        // FILTRE TYPE OPERATION
        // =========================================
        if (typesoperation) {

            query += `
                AND fopt.typesoperation = $${index}
            `;

            params.push(typesoperation);
            index++;
        }

        // =========================================
        // TRI
        // =========================================
        query += `
            ORDER BY fopt.dateoperation DESC,
                     fopt.idoperation DESC
        `;

        // =========================================
        // EXECUTION
        // =========================================
        const result = await client.query(query, params);

        // =========================================
        // RETOUR
        // =========================================
        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {

        client.release();
    }
});






router.get('/rapport-operations-epargne', async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            idagence,
            date_debut,
            date_fin,
            iduser,
            typesoperation
        } = req.query;

        // =========================================
        // VALIDATION
        // =========================================
        if (!idagence || !date_debut || !date_fin) {

            return res.status(400).json({
                success: false,
                message: 'idagence, date_debut et date_fin sont obligatoires'
            });
        }

        // =========================================
        // REQUETE SQL
        // =========================================
        let query = `
            SELECT
                fopt.idoperation,
                fopt.codeoperation,
                fopt.dateoperation,
               
                fopt.idclient,
                fopt.idprod,
            
                fopt.iduser,
                fopt.idagence,
                fopt.codeclient,
                fopt.codecompte,
                fopt.designation,
                fopt.libelle,
                fopt.montant,
                fopt.typesoperation,
                fopt.solde,
                
                fopt.date_creation,
                fopt.date_validation,
                fopt.etat,

                TRIM(u.nom || ' ' || u.prenom)
                    AS agentcollecte,
                    TRIM(fc.nom || ' ' || fc.prenom)
                    AS nomcomplet

            FROM fina_operation_epargne fopt

            JOIN utilisateur u
                ON u.iduser = fopt.iduser
             JOIN finaclients fc
             ON fc.idclient = fopt.idclient
            WHERE fopt.idagence = $1
            AND DATE(fopt.dateoperation)
                BETWEEN $2 AND $3
        `;

        // =========================================
        // PARAMETRES
        // =========================================
        const params = [
            idagence,
            date_debut,
            date_fin
        ];

        let index = 4;

        // =========================================
        // FILTRE UTILISATEUR
        // =========================================
        if (iduser) {

            query += `
                AND fopt.iduser = $${index}
            `;

            params.push(iduser);
            index++;
        }

        // =========================================
        // FILTRE TYPE OPERATION
        // =========================================
        if (typesoperation) {

            query += `
                AND fopt.typesoperation = $${index}
            `;

            params.push(typesoperation);
            index++;
        }

        // =========================================
        // TRI
        // =========================================
        query += `
            ORDER BY fopt.dateoperation DESC,
                     fopt.idoperation DESC
        `;

        // =========================================
        // EXECUTION
        // =========================================
        const result = await client.query(query, params);

        // =========================================
        // RETOUR
        // =========================================
        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {

        client.release();
    }
});














// ======================================================
// AFFICHER COMPTE CAISSE PAR UTILISATEUR
// idagence obligatoire
// ======================================================

router.get('/compte-caisse/:iduser', async (req, res) => {

    const client = await pool.connect();

    try {

        const { iduser } = req.params;
        const { idagence } = req.query;

        // =========================================
        // VALIDATION
        // =========================================
        if (!iduser || !idagence) {

            return res.status(400).json({
                success: false,
                message: 'iduser et idagence sont obligatoires'
            });
        }

        // =========================================
        // REQUETE
        // =========================================
        const query = `
            SELECT
                comptecaisse
            FROM caisse_utilisateur
            WHERE iduser = $1
            AND idagence = $2
            LIMIT 1
        `;

        const result = await client.query(query, [
            iduser,
            idagence
        ]);

        // =========================================
        // AUCUN RESULTAT
        // =========================================
        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Compte caisse introuvable'
            });
        }

        // =========================================
        // RETOUR
        // =========================================
        res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {

        client.release();
    }
});
















// ======================================================
// RECHERCHE DYNAMIQUE CLIENT + RECHERCHE CODE CLIENT
// ======================================================


// ======================================================
// RECHERCHE DYNAMIQUE CLIENT + RECHERCHE CODE CLIENT
// ======================================================

router.get('/recherche-client-epargne', async (req, res) => {
    const client = await pool.connect();

    try {

        const {
            idagence,
            datedebut,
            datefin,
            recherche
        } = req.query;

        // =========================================
        // VALIDATION
        // =========================================
        if (!idagence || !datedebut || !datefin) {
            return res.status(400).json({
                success: false,
                message: 'idagence, datedebut et datefin sont obligatoires'
            });
        }

        // =========================================
        // SQL DE BASE
        // =========================================
        let sql = `
            SELECT
                tmvt.idmvts,
                tmvt.idtmvth,
                tmvt.date,
                tmvt.codjrl,
                tmvt.idcptgn,
                tmvt.idtiers,
                tmvt.libelle,
                tmvt.montantdebit,
                tmvt.montantcredit,
                tmvt.iduser,
                tmvt.idmois,
                tmvt.idannee,
                tmvt.codfact,
                tmvt.reftiers,
                tmvt.idagence,
                tmvt.idjrnal,
                tmvt.idmouvement,

                pe.designation,

                fc.idprod,
                fc.idclient,

                fcl.codeclient,
                fcl.telephone,
                fcl.adresse,
                fcl.photo,
                fcl.signature,
                fcl.sexe,

                TRIM(fcl.nom || ' ' || fcl.prenom) AS nomcomplet

            FROM tmvttheorique tmvt

            INNER JOIN finaclient_comptes fc
                ON fc.codecompte = tmvt.idcptgn

            INNER JOIN finaclients fcl
                ON fcl.idclient = fc.idclient

            INNER JOIN fina_produitepargne pe
                ON pe.idprod = fc.idprod

            WHERE tmvt.idagence = $1
              AND DATE(tmvt.date) BETWEEN $2 AND $3
        `;

        // =========================================
        // PARAMETRES
        // =========================================
        const params = [
            idagence,
            datedebut,
            datefin
        ];

        // =========================================
        // RECHERCHE DYNAMIQUE
        // =========================================
        if (recherche && recherche.trim() !== '') {

            const valeurRecherche = recherche.trim();

            // Position dynamique des paramètres
            const paramNom = params.length + 1;
            const paramCode = params.length + 2;

            sql += `
                AND (
                    TRIM(fcl.nom || ' ' || fcl.prenom) ILIKE $${paramNom}
                    OR RIGHT(fcl.codeclient, 5)::INTEGER = $${paramCode}
                )
            `;

            params.push(`%${valeurRecherche}%`);

            // Vérifie si numérique
            const codeRecherche = isNaN(valeurRecherche)
                ? 0
                : parseInt(valeurRecherche);

            params.push(codeRecherche);
        }

        // =========================================
        // TRI
        // =========================================
        sql += `
            ORDER BY nomcomplet ASC
            LIMIT 100
        `;

        // =========================================
        // EXECUTION
        // =========================================
        const result = await client.query(sql, params);

        // =========================================
        // REPONSE
        // =========================================
        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    } finally {
        client.release();
    }
});







// ===================================================
// GET COMPTES CLIENTS PAR AGENCE + GESTIONNAIRE
// ===================================================
router.get('/comptes-clientsextration', async (req, res) => {
    const client = await pool.connect();

    try {
        const { idagence, idgest } = req.query;

        // =========================================
        // VALIDATION
        // =========================================
        if (!idagence || !idgest) {
            return res.status(400).json({
                success: false,
                message: 'idagence et idgest sont obligatoires'
            });
        }

        // =========================================
        // QUERY OPTIMISÉE
        // =========================================
        const query = `
            SELECT 
                cc.idcompte,
                cc.idclient,
                cc.codeclient,
                cc.idprod,
                cc.idagence,
                cc.codecompte,
                cc.frais_ouverture,
                cc.frais_adhesion,
                cc.nombre_part_social,
                cc.frais_part_social,
                cc.solde,
                cc.date_ouverture,
                cc.date_modification,
                cc.etat,
                cc.codeoperation,
                cc.dateoperation,
                cc.codetypescomptes,
                c.idgest
            FROM finaclient_comptes cc
            INNER JOIN finaclients c 
                ON c.idclient = cc.idclient
            WHERE cc.idagence = $1
            AND c.idgest = $2
        `;

        const result = await client.query(query, [idagence, idgest]);

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    } finally {
        client.release();
    }
});






router.get('/etatcaisse_par_iduser/:idcptgn', async (req, res) => {
  const { idcptgn } = req.params;
  const { p1, p2, iduser, idagence } = req.query; 

  // Validation des paramètres obligatoires
  if (!p1 || !p2 || !iduser || !idagence) {
    return res.status(400).json({ 
      error: "Paramètres manquants : p1 (date début), p2 (date fin), iduser et idagence sont obligatoires." 
    });
  }

  try {
    // 1. Calcul du solde précédent (Report à nouveau)
    const soldeInitialQuery = `
      SELECT 
        SUM(COALESCE(montantdebit, 0) - COALESCE(montantcredit, 0)) AS solde_initial
      FROM tmvttheorique
      WHERE idcptgn = $1 
        AND iduser = $2 
        AND idagence = $3
        AND date < $4;
    `;

    const resInitial = await pool.query(soldeInitialQuery, [idcptgn, iduser, idagence, p1]);
    const soldePrecedent = parseFloat(resInitial.rows[0].solde_initial || 0);

    // 2. Récupération des mouvements de la période
    const query = `
      SELECT 
        idmvts, 
        date, 
        codjrl, 
        idtiers, 
        libelle, 
        COALESCE(montantdebit, 0) AS entree, 
        COALESCE(montantcredit, 0) AS sortie,
        -- Calcul du solde progressif incluant le solde précédent
        $5 + SUM(COALESCE(montantdebit, 0) - COALESCE(montantcredit, 0)) OVER (
          ORDER BY date ASC, idmvts ASC
        ) AS solde_progressif
      FROM tmvttheorique
      WHERE idcptgn = $1 
        AND iduser = $2 
        AND idagence = $3
        AND date BETWEEN $4 AND $6
      ORDER BY date ASC, idmvts ASC;
    `;

    const { rows } = await pool.query(query, [
      idcptgn,    // $1
      iduser,     // $2
      idagence,   // $3
      p1,         // $4
      soldePrecedent, // $5 (utilisé pour le calcul progressif)
      p2          // $6
    ]);

    // On renvoie les données et le solde initial pour l'affichage en front-end
    res.json({
      solde_initial: soldePrecedent,
      mouvements: rows
    });

  } catch (err) {
    console.error("Erreur état de caisse détaillé :", err);
    res.status(500).json({ error: "Erreur lors de la récupération de l'état de caisse" });
  }
});






// ======================================================
// AFFICHER LES MOUVEMENTS D'UN COMPTE AVEC SOLDE PROGRESSIF
// ======================================================

router.get('/mouvements-compte', async (req, res) => {
    const client = await pool.connect();

    try {
        // On récupère idcptgn OU idclasse depuis la requête
        const { idcptgn, idclasse, idagence } = req.query;

        // 1. Validation de l'agence (toujours obligatoire)
        if (!idagence) {
            return res.status(400).json({
                success: false,
                message: "idagence est obligatoire"
            });
        }

        // 2. Validation : Il faut au moins un compte OU une classe
        if (!idcptgn && !idclasse) {
            return res.status(400).json({
                success: false,
                message: "Veuillez fournir idcptgn ou idclasse"
            });
        }

        // 3. Construction dynamique de la clause WHERE
        let whereClause = "WHERE tmvt.idagence = $1";
        let queryParams = [idagence];

        if (idcptgn) {
            whereClause += " AND tmvt.idcptgn = $2";
            queryParams.push(idcptgn);
        } else if (idclasse) {
            whereClause += " AND tci.idclasse = $2";
            queryParams.push(idclasse);
        }

        const query = `
            SELECT 
                tmvt.idmvts,
                tmvt.idtmvth,
                tmvt.idcptgn,
                tmvt.date,
                tmvt.codjrl,
                tmvt.idtiers,
                tmvt.libelle,
                tci.designationcptint,
                tci.idclasse,
                tci.idcptgen,
                COALESCE(tmvt.montantdebit, 0) AS debit,
                COALESCE(tmvt.montantcredit, 0) AS credit,
                CASE 
                    WHEN tci.idclasse = '1' 
                        THEN COALESCE(tmvt.montantdebit,0) - COALESCE(tmvt.montantcredit,0)
                    ELSE 
                        COALESCE(tmvt.montantcredit,0) - COALESCE(tmvt.montantdebit,0)
                END AS soldecompte,
                SUM(
                    CASE 
                        WHEN tci.idclasse = '1'
                            THEN COALESCE(tmvt.montantdebit,0) - COALESCE(tmvt.montantcredit,0)
                        ELSE 
                            COALESCE(tmvt.montantcredit,0) - COALESCE(tmvt.montantdebit,0)
                    END
                ) OVER (
                    PARTITION BY tmvt.idcptgn -- Important : Reset le solde par compte si on cherche par classe
                    ORDER BY tmvt.date, tmvt.idmvts
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) AS solde_progressif
            FROM tmvttheorique tmvt
            INNER JOIN tcomptegeninter tci 
                ON tci.idcptintern = tmvt.idcptgn
            ${whereClause}
            ORDER BY tmvt.date, tmvt.idmvts
        `;

        const result = await client.query(query, queryParams);

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error("Erreur mouvements compte :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur",
            error: error.message
        });
    } finally {
        client.release();
    }
});










/*
router.get('/balance-comptes', async (req, res) => {
    const client = await pool.connect();

    try {
        // 1. Récupération des paramètres (ex: idannee=2026, idmois=5, idagence=1)
        const { idannee, idmois, idagence } = req.query;

        if (!idannee || !idmois || !idagence) {
            return res.status(400).json({ message: "idannee, idmois et idagence sont requis" });
        }

        // 2. --- LOGIQUE DE CALCUL DES DATES COMPTABLES ---
        const debutAnnee = `${idannee}-01-01`;
        const finAnnee = `${idannee}-12-31`;
        
        // Calcul du premier et dernier jour du mois spécifique
        const moisStr = idmois.toString().padStart(2, '0');
        const debutMois = `${idannee}-${moisStr}-01`;
        const dernierJour = new Date(idannee, idmois, 0).getDate(); // jour 0 du mois suivant = dernier jour mois actuel
        const finMois = `${idannee}-${moisStr}-${dernierJour}`;

        const query = `
            SELECT 
                tmvt.idcptgn,
                tci.designationcptint,
                
                -- 1. SOLDE PRÉCÉDENT (Tout ce qui est avant le 1er Janvier de l'année : Reports à nouveau)
                SUM(CAST(tmvt.montantdebit AS NUMERIC)) FILTER (WHERE tmvt.date < $1) AS debit_solde_prec,
                SUM(CAST(tmvt.montantcredit AS NUMERIC)) FILTER (WHERE tmvt.date < $1) AS credit_solde_prec,
                
                -- 2. MOUVEMENTS DE L'ANNÉE (Du 1er Janvier au 31 Décembre de l'année choisie)
                SUM(CAST(tmvt.montantdebit AS NUMERIC)) FILTER (WHERE tmvt.date >= $1 AND tmvt.date <= $2) AS debit_mvt_annee_act,
                SUM(CAST(tmvt.montantcredit AS NUMERIC)) FILTER (WHERE tmvt.date >= $1 AND tmvt.date <= $2) AS credit_mvt_annee_act,
                
                -- 3. MOUVEMENTS DU MOIS SPÉCIFIQUE (Du 1er au dernier jour du mois choisi)
                SUM(CAST(tmvt.montantdebit AS NUMERIC)) FILTER (WHERE tmvt.date >= $3 AND tmvt.date <= $4) AS debit_mvt_mois_act,
                SUM(CAST(tmvt.montantcredit AS NUMERIC)) FILTER (WHERE tmvt.date >= $3 AND tmvt.date <= $4) AS credit_mvt_mois_act,
                
                -- 4. SOLDE FINAL (Cumul total historique)
                SUM(CAST(tmvt.montantdebit AS NUMERIC)) AS debit_solde_final,
                SUM(CAST(tmvt.montantcredit AS NUMERIC)) AS credit_solde_final

            FROM tmvttheorique tmvt
            INNER JOIN tcomptegeninter tci ON tci.idcptintern = tmvt.idcptgn
            WHERE tmvt.idagence = $5 
            GROUP BY tmvt.idcptgn, tci.designationcptint
            HAVING SUM(CAST(tmvt.montantdebit AS NUMERIC)) <> 0 OR SUM(CAST(tmvt.montantcredit AS NUMERIC)) <> 0
        `;

        // Correspondance des paramètres :
        // $1: debutAnnee, $2: finAnnee, $3: debutMois, $4: finMois, $5: idagence
        const values = [debutAnnee, finAnnee, debutMois, finMois, idagence];

        const result = await client.query(query, values);

        res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error("Erreur Balance:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});

*/


/*
router.get('/balance-comptes', async (req, res) => {
    const client = await pool.connect();
    try {
        const { idannee, idmois, idagence } = req.query;

        if (!idannee || !idmois || !idagence) {
            return res.status(400).json({ message: "Paramètres idannee, idmois et idagence requis" });
        }

        const debutAnnee = `${idannee}-01-01`;
        const finAnnee = `${idannee}-12-31`;
        const moisStr = idmois.toString().padStart(2, '0');
        const debutMois = `${idannee}-${moisStr}-01`;
        const dernierJour = new Date(idannee, idmois, 0).getDate();
        const finMois = `${idannee}-${moisStr}-${dernierJour}`;

        const query = `
            SELECT 
    tmvt.idcptgn,
    tci.designationcptint,

    -- 1. SOLDE PRÉCÉDENT : Tout ce qui s'est passé AVANT le 1er janvier de l'année choisie
    COALESCE(SUM(CAST(tmvt.montantdebit AS NUMERIC)) 
        FILTER (WHERE tmvt.date < $1), 0) AS debit_solde_prec,

    COALESCE(SUM(CAST(tmvt.montantcredit AS NUMERIC)) 
        FILTER (WHERE tmvt.date < $1), 0) AS credit_solde_prec,

    -- 2. MOUVEMENTS ANNÉE : Du 01/01 au 31/12 de l'année choisie
    COALESCE(SUM(CAST(tmvt.montantdebit AS NUMERIC)) 
        FILTER (WHERE tmvt.date >= $1 AND tmvt.date <= $2), 0) AS debit_mvt_annee_act,

    COALESCE(SUM(CAST(tmvt.montantcredit AS NUMERIC)) 
        FILTER (WHERE tmvt.date >= $1 AND tmvt.date <= $2), 0) AS credit_mvt_annee_act,

    -- 3. MOUVEMENTS MOIS : Du 01 au dernier jour du mois choisi
    COALESCE(SUM(CAST(tmvt.montantdebit AS NUMERIC)) 
        FILTER (WHERE tmvt.date >= $3 AND tmvt.date <= $4), 0) AS debit_mvt_mois_act,

    COALESCE(SUM(CAST(tmvt.montantcredit AS NUMERIC)) 
        FILTER (WHERE tmvt.date >= $3 AND tmvt.date <= $4), 0) AS credit_mvt_mois_act,

    -- 4. SOLDE FINAL : Somme de tout jusqu'à la fin du mois choisi (très important !)
    COALESCE(SUM(CAST(tmvt.montantdebit AS NUMERIC)) 
        FILTER (WHERE tmvt.date <= $4), 0) AS debit_solde_final,
    
    COALESCE(SUM(CAST(tmvt.montantcredit AS NUMERIC)) 
        FILTER (WHERE tmvt.date <= $4), 0) AS credit_solde_final

FROM tmvttheorique tmvt
INNER JOIN tcomptegeninter tci ON tci.idcptintern = tmvt.idcptgn
WHERE tmvt.idagence = $5
GROUP BY tmvt.idcptgn, tci.designationcptint
HAVING SUM(CAST(tmvt.montantdebit AS NUMERIC)) <> 0 OR SUM(CAST(tmvt.montantcredit AS NUMERIC)) <> 0
ORDER BY tmvt.idcptgn ASC;
        `;

        const values = [debutAnnee, finAnnee, debutMois, finMois, idagence];
        const result = await client.query(query, values);

        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});
*/


router.get('/balance-comptes', async (req, res) => {
    const client = await pool.connect();
    try {
        const { idannee, idmois, idagence } = req.query;

        if (!idannee || !idmois || !idagence) {
            return res.status(400).json({ message: "Paramètres idannee, idmois et idagence requis" });
        }

        const debutAnnee = `${idannee}-01-01`;
        const finAnnee = `${idannee}-12-31`;
        const moisStr = idmois.toString().padStart(2, '0');
        const debutMois = `${idannee}-${moisStr}-01`;
        const dernierJour = new Date(idannee, idmois, 0).getDate();
        const finMois = `${idannee}-${moisStr}-${dernierJour}`;

        const query = `
            WITH cumuls_bruts AS (
                SELECT 
                    tmvt.idcptgn,
                    tci.designationcptint,

                    -- 1. CUMULS BRUTS PRÉCÉDENTS (Tout ce qui est strictement avant le 01/01/Année)
                    COALESCE(SUM(CAST(tmvt.montantdebit AS NUMERIC)) FILTER (WHERE tmvt.date < $1), 0) AS raw_debit_prec,
                    COALESCE(SUM(CAST(tmvt.montantcredit AS NUMERIC)) FILTER (WHERE tmvt.date < $1), 0) AS raw_credit_prec,

                    -- 2. MOUVEMENTS ANNÉE : Du 01/01 au 31/12 de l'année choisie
                    COALESCE(SUM(CAST(tmvt.montantdebit AS NUMERIC)) FILTER (WHERE tmvt.date >= $1 AND tmvt.date <= $2), 0) AS debit_mvt_annee_act,
                    COALESCE(SUM(CAST(tmvt.montantcredit AS NUMERIC)) FILTER (WHERE tmvt.date >= $1 AND tmvt.date <= $2), 0) AS credit_mvt_annee_act,

                    -- 3. MOUVEMENTS MOIS : Du 01 au dernier jour du mois choisi
                    COALESCE(SUM(CAST(tmvt.montantdebit AS NUMERIC)) FILTER (WHERE tmvt.date >= $3 AND tmvt.date <= $4), 0) AS debit_mvt_mois_act,
                    COALESCE(SUM(CAST(tmvt.montantcredit AS NUMERIC)) FILTER (WHERE tmvt.date >= $3 AND tmvt.date <= $4), 0) AS credit_mvt_mois_act,

                    -- 4. CUMULS BRUTS FINAUX (De l'origine des temps jusqu'à la fin du mois choisi)
                    COALESCE(SUM(CAST(tmvt.montantdebit AS NUMERIC)) FILTER (WHERE tmvt.date <= $4), 0) AS raw_debit_final,
                    COALESCE(SUM(CAST(tmvt.montantcredit AS NUMERIC)) FILTER (WHERE tmvt.date <= $4), 0) AS raw_credit_final
                FROM tmvttheorique tmvt
                INNER JOIN tcomptegeninter tci ON tci.idcptintern = tmvt.idcptgn
                WHERE tmvt.idagence = $5
                GROUP BY tmvt.idcptgn, tci.designationcptint
            )
            SELECT 
                idcptgn,
                designationcptint,

                -- ✨ CORRECTION 1 : SOLDE PRÉCÉDENT NET (Report à nouveau de l'année précédente)
                CASE 
                    WHEN raw_debit_prec >= raw_credit_prec THEN (raw_debit_prec - raw_credit_prec)
                    ELSE 0 
                END AS debit_solde_prec,

                CASE 
                    WHEN raw_credit_prec > raw_debit_prec THEN (raw_credit_prec - raw_debit_prec)
                    ELSE 0 
                END AS credit_solde_prec,

                -- MOUVEMENTS PÉRIODES ACTUELLES
                debit_mvt_annee_act,
                credit_mvt_annee_act,
                debit_mvt_mois_act,
                credit_mvt_mois_act,

                -- ✨ CORRECTION 2 : SOLDE FINAL NET COMPTÈMENT EXACT
                CASE 
                    WHEN raw_debit_final >= raw_credit_final THEN (raw_debit_final - raw_credit_final)
                    ELSE 0 
                END AS debit_solde_final,

                CASE 
                    WHEN raw_credit_final > raw_debit_final THEN (raw_credit_final - raw_debit_final)
                    ELSE 0 
                END AS credit_solde_final
            FROM cumuls_bruts
            WHERE raw_debit_final <> 0 OR raw_credit_final <> 0 
               OR debit_mvt_annee_act <> 0 OR credit_mvt_annee_act <> 0
            ORDER BY idcptgn ASC;
        `;

        const values = [debutAnnee, finAnnee, debutMois, finMois, idagence];
        const result = await client.query(query, values);

        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});



// ======================================================
// LISTE UTILISATEUR CAISSE PAR AGENCE
// GET /finalisteutilisateurtrc?idag=1&iduser=2
// ======================================================
// LISTE UTILISATEURS CAISSE PAR AGENCE
// GET /finalisteutilisateurtrc?idag=1
// ======================================================
router.get('/finalisteutilisateurtrc', async (req, res) => {
    try {
        const { idag } = req.query;

        // =========================================
        // VALIDATION
        // =========================================
        if (!idag) {
            return res.status(400).json({
                success: false,
                message: "Le paramètre idag est obligatoire"
            });
        }

        // =========================================
        // REQUETE OPTIMISEE
        // =========================================
        const sql = `
            SELECT
                cu.iduser AS "IDUSER",
                (u.nom || ' ' || u.prenom) AS "NOM",
                cu.comptecaisse,
                cu.etat AS etatcaisse
            FROM caisse_utilisateur cu
            INNER JOIN utilisateur u
                ON u.iduser = cu.iduser
            WHERE u.idagence = $1
              AND cu.etat = TRUE
            ORDER BY u.nom ASC, u.prenom ASC
        `;

        const { rows } = await pool.query(sql, [idag]);

        return res.status(200).json({
            success: true,
            total: rows.length,
            data: rows
        });

    } catch (error) {
        console.error('Erreur récupération utilisateurs :', error);

        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la récupération des utilisateurs"
        });
    }
});





router.get('/finaclientsliaison', async (req, res) => {

  const {
    idagence,
    idgest,
    search
  } = req.query;

  //========================================
  // VALIDATION
  //========================================

  if (!idagence) {

    return res.status(400).json({
      success: false,
      message: 'idagence obligatoire'
    });
  }

  if (!idgest) {

    return res.status(400).json({
      success: false,
      message: 'idgest obligatoire'
    });
  }

  try {

    //========================================
    // REQUETE DE BASE
    //========================================

    let sql = `
      SELECT
        *
      FROM finaclients
      WHERE idagence = $1
      AND idgest = $2
    `;

    //========================================
    // PARAMETRES
    //========================================

    const params = [
      idagence,
      idgest
    ];

    //========================================
    // RECHERCHE
    //========================================

    if (search && search.trim() !== '') {

      sql += `
        AND (
          nom ILIKE $3
          OR prenom ILIKE $3
          OR telephone ILIKE $3
          OR codeclient ILIKE $3
        )
      `;

      params.push(`%${search}%`);
    }

    //========================================
    // TRI
    //========================================

    sql += `
      ORDER BY idclient DESC
    `;

    //========================================
    // EXECUTION
    //========================================

    const result = await pool.query(
      sql,
      params
    );

    //========================================
    // REPONSE
    //========================================

    res.status(200).json({

      success: true,

      total: result.rows.length,

      data: result.rows
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({

      success: false,

      message: err.message
    });
  }
});









router.get(
  '/fina_cooperativemembre/:idcooperative',
  async (req, res) => {

    try {

      const { idcooperative } = req.params;

      const query = `

        SELECT

          idclient,
          codeclient,

          nom,
          prenom,

          telephone,
          adresse,

          photo,

          idcooperative

        FROM finaclients

        WHERE idcooperative = $1

        ORDER BY nom ASC;

      `;

      const result = await pool.query(
        query,
        [idcooperative]
      );

      res.status(200).json({

        success: true,

        total: result.rows.length,

        data: result.rows
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message: error.message
      });
    }
});











router.get('/soldecompte/:idcptgn/:idagence', async (req, res) => {
    try {

        const { idcptgn, idagence } = req.params;

        const query = `
            SELECT
                COALESCE(SUM(montantcredit), 0) -
                COALESCE(SUM(montantdebit), 0) AS soldecompte
            FROM tmvttheorique
            WHERE idcptgn = $1
            AND idagence = $2
        `;

        const result = await pool.query(query, [idcptgn, idagence]);

        res.status(200).json({
            success: true,
            idcptgn: idcptgn,
            idagence: idagence,
            soldecompte: result.rows[0].soldecompte
        });

    } catch (error) {

        console.error('Erreur récupération solde compte :', error);

        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});




router.get('/soldecomptemix/:idcptgn/:idagence', async (req, res) => {
    try {
        const { idcptgn, idagence } = req.params;

        const query = `
            SELECT
                COALESCE(SUM(montantdebit), 0) AS totaldebit,
                COALESCE(SUM(montantcredit), 0) AS totalcredit,
                COALESCE(SUM(montantdebit), 0) - COALESCE(SUM(montantcredit), 0) AS soldedebiteur,
                COALESCE(SUM(montantcredit), 0) - COALESCE(SUM(montantdebit), 0) AS soldecrediteur
            FROM tmvttheorique
            WHERE idcptgn = $1
            AND idagence = $2
        `;

        const result = await pool.query(query, [idcptgn, idagence]);
        const row = result.rows[0];

        res.status(200).json({
            success: true,
            idcptgn: idcptgn,
            idagence: idagence,
            totaldebit: row.totaldebit,
            totalcredit: row.totalcredit,
            soldedebiteur: row.soldedebiteur,
            soldecrediteur: row.soldecrediteur
        });

    } catch (error) {
        console.error('Erreur récupération solde compte :', error);

        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});


///   RAPPORT  COMPTA






router.get('/rapports/situation-clients', async (req, res) => {
  const { idagence, date_debut, date_fin } = req.query;

  //  CONTRAINTES STRICTES : L'agence et la période de dates sont obligatoires
  if (!idagence) {
    return res.status(400).json({ success: false, error: 'Le paramètre "idagence" est obligatoire.' });
  }
  if (!date_debut || !date_fin) {
    return res.status(400).json({ success: false, error: 'Les paramètres "date_debut" et "date_fin" sont obligatoires pour générer le rapport.' });
  }

  try {
    const queryText = `
      SELECT
        -- 1. Informations du mouvement comptable
        tmvt.idmvts,
        tmvt.idtmvth,
        tmvt.date,
        tmvt.codjrl,
        tmvt.idcptgn,
        tmvt.idtiers,
        tmvt.libelle,
        CAST(tmvt.montantdebit AS NUMERIC) AS montantdebit,
        CAST(tmvt.montantcredit AS NUMERIC) AS montantcredit,
        tmvt.iduser,
        tmvt.idmois,
        tmvt.idannee,
        tmvt.codfact,
        tmvt.reftiers,
        tmvt.idagence,
        tmvt.idjrnal,
        tmvt.idmouvement,

        -- 2. Informations du Compte Interne Sage/Comm
        fc.designationcptint,

        -- 3. Informations détaillées du Client
        fcl.codeclients,
        fcl.telephone,
        fcl.adresse,
        fcl.photo,
        fcl.signature,
        fcl.sexe,
        TRIM(COALESCE(fcl.nom, '') || ' ' || COALESCE(fcl.prenom, '')) AS nomcomplet,

        -- 4. Calcul du solde progressif instantané (Débit - Crédit)
        (CAST(tmvt.montantdebit AS NUMERIC) - CAST(tmvt.montantcredit AS NUMERIC)) AS solde_mouvement

      FROM public.tmvttheorique tmvt

      -- 🔑 Jointure sur le compte interne unique
      INNER JOIN public.tcomptegeninter fc
        ON fc.idcptintern = tmvt.idcptgn

      -- 🔑 Jointure sur le client unique
      INNER JOIN public.gclients fcl
        ON fcl.idclients = tmvt.idclient

      WHERE tmvt.idagence = $1
        AND DATE(tmvt.date) BETWEEN $2 AND $3

      -- 📊 Tri chronologique strict pour l'état de compte
      ORDER BY 
        tmvt.date ASC, 
        tmvt.idmvts ASC;
    `;

    const values = [
      idagence, 
      date_debut, // Format attendu YYYY-MM-DD
      date_fin    // Format attendu YYYY-MM-DD
    ];

    const { rows, rowCount } = await pool.query(queryText, values);

    // 💡 OPTIMISATION COMPTABLE BONUS : Calcul du cumul débit, crédit et solde final du rapport
    let totalDebit = 0;
    let totalCredit = 0;

    rows.forEach(row => {
      totalDebit += parseFloat(row.montantdebit || 0);
      totalCredit += parseFloat(row.montantcredit || 0);
    });

    const soldeGeneral = totalDebit - totalCredit;

    res.status(200).json({
      success: true,
      totalLignes: rowCount,
      recapitulatif: {
        total_debit: totalDebit.toFixed(2),
        total_credit: totalCredit.toFixed(2),
        solde_global: soldeGeneral.toFixed(2),
        type_solde: soldeGeneral >= 0 ? 'DEBITEUR' : 'CREDITEUR'
      },
      data: rows
    });

  } catch (err) {
    console.error('Erreur GET /rapports/situation-clients:', err);
    res.status(500).json({ success: false, error: 'Erreur lors de la génération du rapport de situation.' });
  }
});









router.get('/rapports/situation-fournisseur', async (req, res) => {
  const { idagence, date_debut, date_fin } = req.query;

  //  CONTRAINTES STRICTES : L'agence et la période de dates sont obligatoires
  if (!idagence) {
    return res.status(400).json({ success: false, error: 'Le paramètre "idagence" est obligatoire.' });
  }
  if (!date_debut || !date_fin) {
    return res.status(400).json({ success: false, error: 'Les paramètres "date_debut" et "date_fin" sont obligatoires pour générer le rapport.' });
  }

  try {
    const queryText = `
      SELECT
    tmvt.idmvts,
    tmvt.idtmvth,
    tmvt.date,
    tmvt.codjrl,
    tmvt.idcptgn,
    tmvt.idtiers,
    tmvt.libelle,
    tmvt.montantdebit::NUMERIC AS montantdebit,
    tmvt.montantcredit::NUMERIC AS montantcredit,
    tmvt.iduser,
    tmvt.idmois,
    tmvt.idannee,
    tmvt.codfact,
    tmvt.reftiers,
    tmvt.idagence,
    tmvt.idjrnal,
    tmvt.idmouvement,

    fc.designationcptint,

    fcl.codefournisseurs,
    fcl.telephone,
    fcl.adresse,
    fcl.photo,
    fcl.nomcomplet,

    (tmvt.montantdebit::NUMERIC - tmvt.montantcredit::NUMERIC) AS solde_mouvement

FROM public.tmvttheorique AS tmvt
JOIN public.tcomptegeninter AS fc
  ON fc.idcptintern = tmvt.idcptgn
JOIN public.gfournisseur AS fcl
  ON fcl.idfourn = tmvt.idclient
      WHERE tmvt.idagence = $1
        AND DATE(tmvt.date) BETWEEN $2 AND $3

      -- 📊 Tri chronologique strict pour l'état de compte
      ORDER BY 
        tmvt.date ASC, 
        tmvt.idmvts ASC;
    `;

    const values = [
      idagence, 
      date_debut, // Format attendu YYYY-MM-DD
      date_fin    // Format attendu YYYY-MM-DD
    ];

    const { rows, rowCount } = await pool.query(queryText, values);

    // 💡 OPTIMISATION COMPTABLE BONUS : Calcul du cumul débit, crédit et solde final du rapport
    let totalDebit = 0;
    let totalCredit = 0;

    rows.forEach(row => {
      totalDebit += parseFloat(row.montantdebit || 0);
      totalCredit += parseFloat(row.montantcredit || 0);
    });

    const soldeGeneral = totalDebit - totalCredit;

    res.status(200).json({
      success: true,
      totalLignes: rowCount,
      recapitulatif: {
        total_debit: totalDebit.toFixed(2),
        total_credit: totalCredit.toFixed(2),
        solde_global: soldeGeneral.toFixed(2),
        type_solde: soldeGeneral >= 0 ? 'DEBITEUR' : 'CREDITEUR'
      },
      data: rows
    });

  } catch (err) {
    console.error('Erreur GET /rapports/situation-clients:', err);
    res.status(500).json({ success: false, error: 'Erreur lors de la génération du rapport de situation.' });
  }
});









/*
// 📌 Route pour afficher les mouvements avec filtres
router.get('/mouvementsgeneraldescomptes', async (req, res) => {
    try {
        const { 
            idagence, 
            datedebut, 
            datefin, 
            compteauxiliaire, 
            comptegeneral, 
            identifiantclient 
        } = req.query;

        // Construction dynamique des conditions
        let conditions = [`tmvt.idagence = $1`, `DATE(tmvt.date) BETWEEN $2 AND $3`];
        let values = [idagence, datedebut, datefin];
        let index = values.length;

        if (compteauxiliaire) {
            index++;
            conditions.push(`tmvt.idcptgn = $${index}`);
            values.push(compteauxiliaire);
        }

        if (comptegeneral) {
            index++;
            conditions.push(`fc.idcptgen = $${index}`);
            values.push(comptegeneral);
        }

        if (identifiantclient) {
            index++;
            conditions.push(`fc.idtiers = $${index}`);
            values.push(identifiantclient);
        }

        const query = `
            SELECT
                tmvt.idmvts,
                tmvt.idtmvth,
                tmvt.date,
                tmvt.codjrl,
                tmvt.idcptgn AS compteauxiliaire,
                fc.idcptintern,
                fc.idcptgen AS comptegeneral,
                tmvt.idtiers,
                fc.idtiers AS identifiantclient,
                tmvt.libelle,
                CAST(tmvt.montantdebit AS NUMERIC) AS montantdebit,
                CAST(tmvt.montantcredit AS NUMERIC) AS montantcredit,
                tmvt.iduser,
                tmvt.idmois,
                tmvt.idannee,
                tmvt.codfact,
                tmvt.reftiers,
                tmvt.idagence,
                tmvt.idjrnal,
                tmvt.idmouvement,
                fc.designationcptint,
                fc.codetiers,
                fc.nomtiers,
                (CAST(tmvt.montantdebit AS NUMERIC) - CAST(tmvt.montantcredit AS NUMERIC)) AS solde_mouvement
            FROM public.tmvttheorique tmvt
            INNER JOIN public.tcomptegeninter fc
                ON fc.idcptintern = tmvt.idcptgn
            WHERE ${conditions.join(' AND ')}
            ORDER BY tmvt.date,tmvt.idmvts ASC;
        `;

        const result = await pool.query(query, values);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur récupération mouvements :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});

*/

// 📌 Route pour afficher les mouvements avec filtres et calcul du solde précédent
router.get('/mouvementsgeneraldescomptes', async (req, res) => {
    try {
        const { 
            idagence, 
            datedebut, 
            datefin, 
            compteauxiliaire, 
            comptegeneral, 
            identifiantclient 
        } = req.query;

        if (!idagence || !datedebut || !datefin) {
            return res.status(400).json({
                success: false,
                message: "Les paramètres idagence, datedebut et datefin sont requis."
            });
        }

        // =========================================================================
        // 1. CALCUL DU SOLDE PRÉCÉDENT (Avant la date de début)
        // =========================================================================
        let prevConditions = [`tmvt.idagence = $1`, `DATE(tmvt.date) < $2`];
        let prevValues = [idagence, datedebut];
        let prevIndex = prevValues.length;

        if (compteauxiliaire) {
            prevIndex++;
            prevConditions.push(`tmvt.idcptgn = $${prevIndex}`);
            prevValues.push(compteauxiliaire);
        }

        if (comptegeneral) {
            prevIndex++;
            prevConditions.push(`fc.idcptgen = $${prevIndex}`);
            prevValues.push(comptegeneral);
        }

        if (identifiantclient) {
            prevIndex++;
            prevConditions.push(`fc.idtiers = $${prevIndex}`);
            prevValues.push(identifiantclient);
        }

        const prevQuery = `
            SELECT
                COALESCE(SUM(CAST(tmvt.montantdebit AS NUMERIC)), 0) AS total_debit,
                COALESCE(SUM(CAST(tmvt.montantcredit AS NUMERIC)), 0) AS total_credit
            FROM public.tmvttheorique tmvt
            INNER JOIN public.tcomptegeninter fc
                ON fc.idcptintern = tmvt.idcptgn
            WHERE ${prevConditions.join(' AND ')};
        `;

        const prevResult = await pool.query(prevQuery, prevValues);
        const totalDebitPrev = parseFloat(prevResult.rows[0].total_debit) || 0;
        const totalCreditPrev = parseFloat(prevResult.rows[0].total_credit) || 0;
        const soldePrecedent = totalDebitPrev - totalCreditPrev;

        // =========================================================================
        // 2. RÉCUPÉRATION DES MOUVEMENTS DE LA PÉRIODE
        // =========================================================================
        let conditions = [`tmvt.idagence = $1`, `DATE(tmvt.date) BETWEEN $2 AND $3`];
        let values = [idagence, datedebut, datefin];
        let index = values.length;

        if (compteauxiliaire) {
            index++;
            conditions.push(`tmvt.idcptgn = $${index}`);
            values.push(compteauxiliaire);
        }

        if (comptegeneral) {
            index++;
            conditions.push(`fc.idcptgen = $${index}`);
            values.push(comptegeneral);
        }

        if (identifiantclient) {
            index++;
            conditions.push(`fc.idtiers = $${index}`);
            values.push(identifiantclient);
        }

        const query = `
            SELECT
                tmvt.idmvts,
                tmvt.idtmvth,
                tmvt.date,
                tmvt.codjrl,
                tmvt.idcptgn AS compteauxiliaire,
                fc.idcptintern,
                fc.idcptgen AS comptegeneral,
                tmvt.idtiers,
                fc.idtiers AS identifiantclient,
                tmvt.libelle,
                CAST(tmvt.montantdebit AS NUMERIC) AS montantdebit,
                CAST(tmvt.montantcredit AS NUMERIC) AS montantcredit,
                tmvt.iduser,
                tmvt.idmois,
                tmvt.idannee,
                tmvt.codfact,
                tmvt.reftiers,
                tmvt.idagence,
                tmvt.idjrnal,
                tmvt.idmouvement,
                fc.designationcptint,
                fc.codetiers,
                fc.nomtiers,
                (CAST(tmvt.montantdebit AS NUMERIC) - CAST(tmvt.montantcredit AS NUMERIC)) AS solde_mouvement
            FROM public.tmvttheorique tmvt
            INNER JOIN public.tcomptegeninter fc
                ON fc.idcptintern = tmvt.idcptgn
            WHERE ${conditions.join(' AND ')}
            ORDER BY tmvt.date, tmvt.idmvts ASC;
        `;

        const result = await pool.query(query, values);

        res.status(200).json({
            success: true,
            soldePrecedent: soldePrecedent,
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur récupération mouvements :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});








router.get('/balance-comptesgeneral', async (req, res) => {
    const client = await pool.connect();
    try {
        const { idannee, idmois, idagence } = req.query;

        if (!idannee || !idmois || !idagence) {
            return res.status(400).json({ message: "Paramètres idannee, idmois et idagence requis" });
        }

        const debutAnnee = `${idannee}-01-01`;
        const finAnnee = `${idannee}-12-31`;
        const moisStr = idmois.toString().padStart(2, '0');
        const debutMois = `${idannee}-${moisStr}-01`;
        const dernierJour = new Date(idannee, idmois, 0).getDate();
        const finMois = `${idannee}-${moisStr}-${dernierJour}`;

        const query = `
            WITH cumuls_bruts AS (
                SELECT 
                    tmvt.idcptgn,
                    tci.designationcptint,
                    tc.designation,

                    -- 1. CUMULS BRUTS PRÉCÉDENTS (Tout ce qui est strictement avant le 01/01/Année)
                    COALESCE(SUM(CAST(tmvt.montantdebit AS NUMERIC)) FILTER (WHERE tmvt.date < $1), 0) AS raw_debit_prec,
                    COALESCE(SUM(CAST(tmvt.montantcredit AS NUMERIC)) FILTER (WHERE tmvt.date < $1), 0) AS raw_credit_prec,

                    -- 2. MOUVEMENTS ANNÉE : Du 01/01 au 31/12 de l'année choisie
                    COALESCE(SUM(CAST(tmvt.montantdebit AS NUMERIC)) FILTER (WHERE tmvt.date >= $1 AND tmvt.date <= $2), 0) AS debit_mvt_annee_act,
                    COALESCE(SUM(CAST(tmvt.montantcredit AS NUMERIC)) FILTER (WHERE tmvt.date >= $1 AND tmvt.date <= $2), 0) AS credit_mvt_annee_act,

                    -- 3. MOUVEMENTS MOIS : Du 01 au dernier jour du mois choisi
                    COALESCE(SUM(CAST(tmvt.montantdebit AS NUMERIC)) FILTER (WHERE tmvt.date >= $3 AND tmvt.date <= $4), 0) AS debit_mvt_mois_act,
                    COALESCE(SUM(CAST(tmvt.montantcredit AS NUMERIC)) FILTER (WHERE tmvt.date >= $3 AND tmvt.date <= $4), 0) AS credit_mvt_mois_act,

                    -- 4. CUMULS BRUTS FINAUX (De l'origine des temps jusqu'à la fin du mois choisi)
                    COALESCE(SUM(CAST(tmvt.montantdebit AS NUMERIC)) FILTER (WHERE tmvt.date <= $4), 0) AS raw_debit_final,
                    COALESCE(SUM(CAST(tmvt.montantcredit AS NUMERIC)) FILTER (WHERE tmvt.date <= $4), 0) AS raw_credit_final
                FROM tmvttheorique tmvt
                INNER JOIN tcomptegeninter tci ON tci.idcptintern = tmvt.idcptgn
                 INNER JOIN tcompte tc ON tc.comptegeneral = LEFT(tmvt.idcptgn::text, 5)
                WHERE tmvt.idagence = $5
                GROUP BY tmvt.idcptgn, tci.designationcptint,tc.designation
            )
            SELECT 
                idcptgn,
                designationcptint,
                designation,

                -- ✨ CORRECTION 1 : SOLDE PRÉCÉDENT NET (Report à nouveau de l'année précédente)
                CASE 
                    WHEN raw_debit_prec >= raw_credit_prec THEN (raw_debit_prec - raw_credit_prec)
                    ELSE 0 
                END AS debit_solde_prec,

                CASE 
                    WHEN raw_credit_prec > raw_debit_prec THEN (raw_credit_prec - raw_debit_prec)
                    ELSE 0 
                END AS credit_solde_prec,

                -- MOUVEMENTS PÉRIODES ACTUELLES
                debit_mvt_annee_act,
                credit_mvt_annee_act,
                debit_mvt_mois_act,
                credit_mvt_mois_act,

                -- ✨ CORRECTION 2 : SOLDE FINAL NET COMPTÈMENT EXACT
                CASE 
                    WHEN raw_debit_final >= raw_credit_final THEN (raw_debit_final - raw_credit_final)
                    ELSE 0 
                END AS debit_solde_final,

                CASE 
                    WHEN raw_credit_final > raw_debit_final THEN (raw_credit_final - raw_debit_final)
                    ELSE 0 
                END AS credit_solde_final
            FROM cumuls_bruts
            WHERE raw_debit_final <> 0 OR raw_credit_final <> 0 
               OR debit_mvt_annee_act <> 0 OR credit_mvt_annee_act <> 0
            ORDER BY idcptgn ASC;
        `;

        const values = [debutAnnee, finAnnee, debutMois, finMois, idagence];
        const result = await client.query(query, values);

        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});


module.exports = router;