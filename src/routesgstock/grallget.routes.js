const express = require('express');
const router = express.Router();
const pool = require('../config/db');


// ======================================================
// GET INVENTAIRE STOCK ACTUEL
// URL:
// /api/inventaire-stock?idagence=1&iddepot=2
// ======================================================
router.get('/inventaire-stock', async (req, res) => {

    const { idagence, iddepot } = req.query;

    // ======================================================
    // VALIDATION
    // ======================================================
    if (!idagence || isNaN(idagence)) {
        return res.status(400).json({
            success: false,
            message: 'idagence obligatoire et numérique'
        });
    }

    if (!iddepot || isNaN(iddepot)) {
        return res.status(400).json({
            success: false,
            message: 'iddepot obligatoire et numérique'
        });
    }

    try {

        // ======================================================
        // REQUETE SQL
        // ======================================================
        const sql = `
            SELECT 
                gsd.idstock,
                gsd.idagence,
                gsd.iddepot,
                gsd.idarticle,
                gsd.quantite,
                gsd.quantite_reservee,
                gsd.stock_disponible,
                gsd.date_maj,

                ga.designation AS article_nom,
                gd.designation AS depot_nom

            FROM gstock_depot gsd

            INNER JOIN garticle ga 
                ON ga.idarticle = gsd.idarticle

            INNER JOIN gdepot gd 
                ON gd.iddepot = gsd.iddepot

            WHERE gsd.iddepot = $1
            AND gsd.idagence = $2

            ORDER BY ga.designation ASC
        `;

        // ======================================================
        // EXECUTION
        // ======================================================
        const result = await pool.query(sql, [
            iddepot,
            idagence
        ]);

        // ======================================================
        // RETOUR
        // ======================================================
        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {

        console.error('Erreur inventaire stock :', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});



// /api/journaux?idagence=1
// ======================================================
router.get('/journauxop', async (req, res) => {

    const { idagence } = req.query;

    // ======================================================
    // VALIDATION
    // ======================================================
    if (!idagence || isNaN(idagence)) {
        return res.status(400).json({
            success: false,
            message: 'idagence obligatoire et numérique'
        });
    }

    try {

        // ======================================================
        // REQUETE SQL
        // ======================================================
        const sql = `
            SELECT 
                id,
                codejrnl,
                designation,
                etat,
                idagence
            FROM tjournal
            WHERE idagence = $1
            ORDER BY designation ASC
        `;

        // ======================================================
        // EXECUTION
        // ======================================================
        const result = await pool.query(sql, [idagence]);

        // ======================================================
        // RETOUR JSON
        // ======================================================
        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {

        console.error('Erreur récupération journaux :', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});





router.get('/rapportgvente_resume', async (req, res) => {
  const client = await pool.connect();

  try {
    const { idagence, datedebut, datefin } = req.query;

    // Validation
    if (!idagence || !datedebut || !datefin) {
      return res.status(400).json({
        success: false,
        message: 'idagence, datedebut et datefin sont obligatoires'
      });
    }

    const queryText = `
      SELECT
          GV.idvente,
          GV.datevente,

          ROUND(SUM(GV.montant_total::numeric), 2) AS total_vente,

          CONCAT(GC.nom, ' ', GC.prenom) AS clients,

          GC.idclients,
          GV.idagence

      FROM gvente_detail GV

      INNER JOIN gclients GC
          ON GV.idclients = GC.idclients

      WHERE GV.idagence = $1
        AND GV.datevente BETWEEN $2 AND $3

      GROUP BY
          GV.idvente,
          GV.datevente,
          GC.nom,
          GC.prenom,
          GC.idclients,
          GV.idagence

      ORDER BY GV.datevente DESC;
    `;

    const values = [idagence, datedebut, datefin];

    console.log('=== PARAMETRES RECUS ===');
    console.log(values);

    const { rows } = await client.query(queryText, values);

    console.log('=== DONNEES RETOURNEES ===');
    console.log(rows);

    return res.json({
      success: true,
      total: rows.length,
      data: rows
    });

  } catch (err) {

    console.error('Erreur GET /rapportgvente_resume:', err);

    return res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: err.message
    });

  } finally {
    client.release();
  }
});




router.get('/rapportgachat_resume', async (req, res) => {
  const client = await pool.connect();

  try {

    const { idagence, datedebut, datefin } = req.query;

    // Validation
    if (!idagence || !datedebut || !datefin) {
      return res.status(400).json({
        success: false,
        message: 'idagence, datedebut et datefin sont obligatoires'
      });
    }

    const queryText = `
      SELECT
          GA.idachat,
          GA.dateachat,

          ROUND(SUM(GA.cout_total::numeric), 2) AS total_achat,

          GF.nomcomplet AS fournisseur,

          GF.idfourn,
          GA.idagence

      FROM gachat_detail GA

      INNER JOIN gfournisseur GF
          ON GA.idfourn = GF.idfourn

      WHERE GA.idagence = $1 AND GA.etat='actif'

        AND GA.dateachat >= $2
        AND GA.dateachat < ($3::date + interval '1 day')

      GROUP BY
          GA.idachat,
          GA.dateachat,
          GF.nomcomplet,
          GF.idfourn,
          GA.idagence

      ORDER BY GA.dateachat DESC;
    `;

    const values = [idagence, datedebut, datefin];

    console.log('=== PARAMETRES RECUS ===');
    console.log(values);

    const { rows } = await client.query(queryText, values);

    console.log('=== DONNEES ACHATS ===');
    console.log(rows);

    return res.json({
      success: true,
      total: rows.length,
      data: rows
    });

  } catch (err) {

    console.error('Erreur GET /rapportgachat_resume:', err);

    return res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: err.message
    });

  } finally {
    client.release();
  }
});






// GET VENTES DETAIL - idagence obligatoire
// ======================================================
router.get('/gvente_detailparagence', async (req, res) => {
  const client = await pool.connect();

  try {
    const { idagence } = req.query;

    // =========================
    // VALIDATION OBLIGATOIRE
    // =========================
    if (!idagence) {
      return res.status(400).json({
        success: false,
        message: 'idagence est obligatoire'
      });
    }

    const query = `
      SELECT
          GV.iddetail,
          GV.idvente,
           GV.idarticle,
	         GA.designation,
          GV.datevente,
          GV.quantite,
          GV.prixvente_brut,
          GV.montant_total,
          GV.prixachatactuel,
          GV.couttotalachat,
          GV.margebrut,
          CONCAT(GC.nom, ' ', GC.prenom) AS clients
      FROM gvente_detail GV
      INNER JOIN gclients GC
          ON GC.idclients = GV.idclients
          INNER JOIN garticle GA on GA.idarticle=GV.idarticle
      WHERE GV.idagence = $1
      ORDER BY GV.datevente DESC
    `;

    const { rows } = await client.query(query, [idagence]);

    return res.json({
      success: true,
      total: rows.length,
      data: rows
    });

  } catch (err) {

    console.error('Erreur API gvente_detail:', err);

    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: err.message
    });

  } finally {
    client.release();
  }
});



// GET compte client 419
router.get('/compte-client419', async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            codetiers,
            idagence
        } = req.query;

        // VALIDATION
        if (!codetiers || !idagence) {

            return res.status(400).json({
                success: false,
                message:
                    'codetiers et idagence sont obligatoires'
            });
        }

        const query = `
            SELECT idcptintern
            FROM tcomptegeninter
            WHERE codetiers = $1
              AND idagence = $2
              AND idcptgen LIKE '419%'
            LIMIT 1
        `;

        const values = [
            codetiers,
            parseInt(idagence, 10)
        ];

        const result = await client.query(
            query,
            values
        );

        return res.status(200).json({
            success: true,
            data: result.rows[0] || null
        });

    } catch (error) {

        console.error(
            'Erreur GET /compte-client419:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    } finally {

        client.release();
    }
});





// ==========================================
// RECUPERER REMISE ARTICLE
// ==========================================
// ==========================================
// RECUPERER REMISE ARTICLE
// ==========================================
// ==========================================
// RECUPERER REMISE + TYPE CLIENT
// ==========================================
// RECUPERER REMISES PAR ARTICLE
// ==========================================
router.get('/remises-article', async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            idarticle,
            idsouscategorie,
            idagence
        } = req.query;

        // VALIDATION
        if (
            !idarticle ||
            !idsouscategorie ||
            !idagence
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'idarticle, idsouscategorie et idagence sont obligatoires'
            });
        }

        const query = `
            SELECT tta.idarticle,tta.idsouscategorie,tta.idagence,tta.datefin,
                typcl.designation,
                tta.remise
            FROM ttarifprixvente tta
            INNER JOIN ttypesclient typcl
                ON typcl.idtypecl = tta.idtypecl
            WHERE tta.idarticle = $1
              AND tta.idsouscategorie = $2
              AND tta.idagence = $3
              AND tta.datefin IS NULL
            ORDER BY typcl.designation
        `;

        const values = [
            parseInt(idarticle, 10),
            parseInt(idsouscategorie, 10),
            parseInt(idagence, 10)
        ];

        const result = await client.query(
            query,
            values
        );

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {

        console.error(
            'Erreur GET /remises-article:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    } finally {

        client.release();
    }
});





// Route API
router.get('/remisesurquantite', async (req, res) => {

    const client = await pool.connect();

    try {

        // Paramètres reçus
        const {
            quantite,
            idarticle,
            idagence,
            idtypecl
        } = req.query;

        // VALIDATION
        if (
            !quantite ||
            !idarticle ||
            !idagence ||
            !idtypecl
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'quantite, idarticle, idagence et idtypecl sont obligatoires'
            });
        }

        const query = `
            SELECT idarticle,idagence,idtypecl,types_remise,plage_qte, montant_remise_par_unite
            FROM ttarifproduitprixremise
            WHERE idarticle = $2
              AND cumul_par_categorie='false'
              AND idagence = $3
              AND idtypecl = $4
              AND types_remise = 'montant'
              AND plage_qte @> $1::numeric
            LIMIT 1
        `;

        const values = [
            parseFloat(quantite),
            parseInt(idarticle, 10),
            parseInt(idagence, 10),
            parseInt(idtypecl, 10)
        ];

        const result = await client.query(
            query,
            values
        );





        // Vérifier si remise trouvée
if (result.rows.length > 0) {

    return res.status(200).json({
        success: true,
        data: result.rows[0]
    });

} else {

    return res.status(200).json({
        success: false,
        message: 'Aucune remise trouvée',
        montant_remise_par_unite: 0
    });

}

        /*
        // Vérifier si remise trouvée
        if (result.rows.length > 0) {

            return res.status(200).json({
                success: true,
                montant_remise_par_unite:
                    result.rows[0].montant_remise_par_unite
            });

        } else {

            return res.status(200).json({
                success: false,
                message: 'Aucune remise trouvée',
                montant_remise_par_unite: 0
            });

        }
            */





    } catch (error) {

        console.error(
            'Erreur GET /remisesurquantite:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    } finally {

        client.release();
    }

});






///  LISTE



router.get('/listeremises-article', async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            idagence
        } = req.query;

        // VALIDATION
        if (
            !idagence
        ) {

            return res.status(400).json({
                success: false,
                message:
                    ' idagence sont obligatoires'
            });
        }

        const query = `
            SELECT tta.idprixvente,tta.idarticle,tta.idsouscategorie,tta.idagence,tta.datefin,
                typcl.designation,
                tta.remise,tta.idtypecl
            FROM ttarifprixvente tta
            INNER JOIN ttypesclient typcl
                ON typcl.idtypecl = tta.idtypecl
            WHERE 
              tta.idagence = $1
              AND tta.datefin IS NULL
            ORDER BY typcl.designation
        `;

        const values = [
            ///parseInt(idarticle, 10),
           /// parseInt(idsouscategorie, 10),
            parseInt(idagence, 10)
        ];

        const result = await client.query(
            query,
            values
        );

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {

        console.error(
            'Erreur GET /remises-article:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    } finally {

        client.release();
    }
});





// Route API
router.get('/listeremisesurquantite', async (req, res) => {

    const client = await pool.connect();

    try {

        // Paramètres reçus
        const {
           
            idagence,
           
        } = req.query;

        // VALIDATION
        if (
          
            !idagence 
           
        ) {

            return res.status(400).json({
                success: false,
                message:
                    ' idagence sont obligatoires'
            });
        }

        const query = `
            SELECT idtarpro, idarticle,idagence,idtypecl,types_remise,plage_qte, montant_remise_par_unite
            FROM ttarifproduitprixremise
            WHERE 
               idagence = $1
              AND types_remise = 'montant'
           
        `;

        const values = [
           /// parseFloat(quantite),
           /// parseInt(idarticle, 10),
            parseInt(idagence, 10)
           /// parseInt(idtypecl, 10)
        ];

        const result = await client.query(
            query,
            values
        );





        // Vérifier si remise trouvée
if (result.rows.length > 0) {

    return res.status(200).json({
        success: true,
        data: result.rows
    });

} else {

    return res.status(200).json({
        success: false,
        message: 'Aucune remise trouvée',
        montant_remise_par_unite: 0
    });

}

        /*
        // Vérifier si remise trouvée
        if (result.rows.length > 0) {

            return res.status(200).json({
                success: true,
                montant_remise_par_unite:
                    result.rows[0].montant_remise_par_unite
            });

        } else {

            return res.status(200).json({
                success: false,
                message: 'Aucune remise trouvée',
                montant_remise_par_unite: 0
            });

        }
            */





    } catch (error) {

        console.error(
            'Erreur GET /remisesurquantite:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    } finally {

        client.release();
    }

});











router.get('/stockagence', async (req, res) => {

    const client = await pool.connect();

    try {

        // Paramètres reçus
        const {
            idagence,
            iddepot
        } = req.query;

        // VALIDATION
        if (!idagence || !iddepot) {
            return res.status(400).json({
                success: false,
                message: 'idagence et iddepot sont obligatoires'
            });
        }

        const query = `
            SELECT
                gd.idstock,
                gd.idarticle,
                gd.iddepot,
                gd.idagence,
                gd.quantite,
                ga.idcategorie,
                ga.idsouscategorie,
                ga.idsouscategoriedetail,
                ga.idunite,
                ga.designation,
                ga.idarticlelier,
				ga.nombreunite,
                ga.idarticlelier_agence
            FROM gstock_depot AS gd
            INNER JOIN garticle AS ga
                ON gd.idarticle = ga.idarticle
            WHERE gd.idagence = $1
              AND gd.iddepot = $2
        `;

        const values = [
            parseInt(idagence, 10),
            parseInt(iddepot, 10)
        ];

        const result = await client.query(query, values);

        // Réponse
        if (result.rows.length > 0) {

            return res.status(200).json({
                success: true,
                count: result.rowCount,
                data: result.rows
            });

        } else {

            return res.status(200).json({
                success: false,
                message: 'Aucun stock trouvé pour ce dépôt',
                data: []
            });
        }

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });

    } finally {
        client.release();
    }
});








router.get('/stockagencelot', async (req, res) => {

    const client = await pool.connect();

    try {

        // Paramètres reçus
        const {
            idagence,
            iddepot
        } = req.query;

        // VALIDATION
        if (!idagence || !iddepot) {
            return res.status(400).json({
                success: false,
                message: 'idagence et iddepot sont obligatoires'
            });
        }

        const query = `
           SELECT
                gd.idlot_stock,
				 gd.idlot,
				 gd.codelot,
				 gd.dateexpiration,
                gd.idarticle,
                gd.iddepot,
                gd.idagence,
                gd.quantite,
                ga.idcategorie,
                ga.idsouscategorie,
                ga.idsouscategoriedetail,
                ga.idunite,
                ga.designation,
                ga.idarticlelier,
				ga.nombreunite,
                ga.idarticlelier_agence
            FROM glot_stock AS gd
            INNER JOIN garticle AS ga
                ON gd.idarticle = ga.idarticle
            WHERE gd.idagence = $1
              AND gd.iddepot = $2 AND etat='true'
        `;

        const values = [
            parseInt(idagence, 10),
            parseInt(iddepot, 10)
        ];

        const result = await client.query(query, values);

        // Réponse
        if (result.rows.length > 0) {

            return res.status(200).json({
                success: true,
                count: result.rowCount,
                data: result.rows
            });

        } else {

            return res.status(200).json({
                success: false,
                message: 'Aucun stock trouvé pour ce dépôt',
                data: []
            });
        }

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });

    } finally {
        client.release();
    }
});





// =========================
// HISTORIQUE FICHE INVENTAIRE
// =========================
router.get('/listehistoriqueficheinventaire', async (req, res) => {
  try {
    const { idagence, datedebut, datefin } = req.query;

    // =========================
    // VALIDATION MINIMALE
    // =========================
    if (!idagence) {
      return res.status(400).json({
        success: false,
        message: "idagence est obligatoire"
      });
    }

    // =========================
    // CONSTRUCTION DYNAMIQUE DE LA REQUÊTE
    // =========================
    let query = `
      SELECT
        idficheinventaire,
        dateinventaire,
        designation,
        etat,
        idagence
      FROM g_fiche_inventaire
      WHERE idagence = $1
    `;
    const values = [idagence];

    // Si les dates sont fournies, on ajoute le filtre
    if (datedebut && datefin) {
      query += ` AND dateinventaire BETWEEN $2 AND $3 `;
      values.push(datedebut, datefin);
    }

    query += ` ORDER BY dateinventaire DESC `;

    const result = await pool.query(query, values);

    // =========================
    // SUCCESS RESPONSE
    // =========================
    return res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });

  } catch (error) {
    console.error("❌ ERREUR SERVEUR:", error);

    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des fiches inventaire",
      error: error.message
    });
  }
});






/// ===============================================
/// GET AGENCES PAR SOCIETE
/// ===============================================

router.get('/agenceparsociete', async (req, res) => {

    try {

        // =========================================
        // RECUPERATION PARAMETRE
        // =========================================

        const idsociete = req.query.idsociete;

        console.log("====================================");
        console.log("🚀 API AGENCES");
        console.log("====================================");
        console.log("🏢 IDSOCIETE =>", idsociete);

        // =========================================
        // VALIDATION
        // =========================================

        if (!idsociete) {

            return res.status(400).json({

                success: false,
                message: "idsociete obligatoire"

            });
        }

        // =========================================
        // REQUETE SQL
        // =========================================

        const sql = `
            SELECT
                idagence,
                nomagence
            FROM agence
            WHERE idsociete = $1
            ORDER BY nomagence
        `;

        const result = await pool.query(sql, [
            Number(idsociete)
        ]);

        // =========================================
        // RESPONSE
        // =========================================

        return res.status(200).json({

            success: true,

            count: result.rows.length,

            data: result.rows

        });

    } catch (error) {

        console.log("====================================");
        console.log("❌ ERREUR API AGENCE");
        console.log("====================================");

        console.log(error);

        return res.status(500).json({

            success: false,

            message: "Erreur serveur",

            error: error.message

        });
    }
});











 
router.get('/rapport-transferts/:idagence', async (req, res) => {
    const { idagence } = req.params;
    const flux = req.query.flux || 'emetteur'; // 'emetteur' ou 'destinataire'
    
    // S'adapte au paramètre envoyé par Flutter (document_filter ou type_doc)
    const typeDoc = req.query.document_filter || req.query.type_doc || 'TRAGENCE'; 
    
    // Récupération des dates (avec valeurs par défaut si vides)
    const dateDebut = req.query.datedebut || '2000-01-01';
    const dateFin = req.query.datefin || new Date().toISOString().split('T')[0]; // Date du jour (YYYY-MM-DD)

    if (!idagence) {
        return res.status(400).json({
            success: false,
            message: "L'identifiant de l'agence (idagence) est requis."
        });
    }

    let sqlQuery = '';

    // Sélection de la requête selon le besoin du rapport
    if (flux === 'destinataire') {
        // 1. Flux ENTRANT : Tout ce qui concerne l'agence destinataire
        sqlQuery = `
            SELECT 
                trs.idtransfertstock, 
                trs.idagence_emetteur, 
                trs.iddepot_emetteur, 
                trs.idarticle_emetteur, 
                trs.idagence_destinataire, 
                trs.iddepot_destinataire, 
                trs.idarticle_destinataire, 
                trs.iduser, 
                trs.quantite, 
                trs.type_mouvement, 
                trs.datesaisie, 
                trs.datevalidation, 
                trs.etat,
                trs.observation, 
                trs.quantite_envoye, 
                trs.quantite_recue, 
                trs.documents,
                ga.designation AS designation_article,
                gd.designation AS designation_depot,
                ag.nomagence AS nom_agence
            FROM g_transfert_stock trs
            JOIN agence ag ON trs.idagence_destinataire = ag.idagence
            JOIN gdepot gd ON trs.iddepot_destinataire = gd.iddepot
            JOIN garticle ga ON trs.idarticle_destinataire = ga.idarticle
           
           
           WHERE trs.idagence_destinataire = $1 
  AND trs.documents = $2 
  AND trs.datesaisie >= $3
  AND trs.datesaisie < ($4::date + INTERVAL '1 day')
ORDER BY trs.datesaisie DESC;
           
           

        `;
    } else {
        // 2. Flux SORTANT (Défaut) : Tout ce qui concerne l'agence émettrice
        sqlQuery = `
            SELECT 
                trs.idtransfertstock, 
                trs.idagence_emetteur, 
                trs.iddepot_emetteur, 
                trs.idarticle_emetteur, 
                trs.idagence_destinataire, 
                trs.iddepot_destinataire, 
                trs.idarticle_destinataire, 
                trs.iduser, 
                trs.quantite, 
                trs.type_mouvement, 
                trs.datesaisie, 
                trs.datevalidation, 
                trs.etat,
                trs.observation, 
                trs.quantite_envoye, 
                trs.quantite_recue, 
                trs.documents,
                ga.designation AS designation_article,
                gd.designation AS designation_depot,
                ag.nomagence AS nom_agence
            FROM g_transfert_stock trs
            JOIN agence ag ON trs.idagence_emetteur = ag.idagence
            JOIN gdepot gd ON trs.iddepot_emetteur = gd.iddepot
            JOIN garticle ga ON trs.idarticle_emetteur = ga.idarticle
           
           
            WHERE trs.idagence_emetteur = $1 
  AND trs.documents = $2 
  AND trs.datesaisie >= $3
  AND trs.datesaisie < ($4::date + INTERVAL '1 day')
ORDER BY trs.datesaisie DESC;
           
        
        `;
    }

    try {
        // CORRECTION ICI : Ajout de dateDebut ($3) et dateFin ($4) dans le tableau des paramètres
        const { rows, rowCount } = await pool.query(sqlQuery, [idagence, typeDoc, dateDebut, dateFin]);

        return res.status(200).json({
            success: true,
            flux: flux,
            document_filter: typeDoc,
            count: rowCount,
            data: rows
        });

    } catch (error) {
        console.error(`❌ ERREUR RAPPORT TRANSFERT (${flux.toUpperCase()}) =>`, error);
        return res.status(500).json({
            success: false,
            message: "Une erreur interne est survenue lors de la génération du rapport."
        });
    }
});




router.get('/mouvement-stock', async (req, res) => {

    const client = await pool.connect();

    try {

        // ======================================
        // PARAMETRES
        // ======================================
        const { idarticle, iddepot } = req.query;

        // ======================================
        // VALIDATION
        // ======================================
        if (!idarticle || !iddepot) {
            return res.status(400).json({
                success: false,
                message: 'idarticle et iddepot sont obligatoires'
            });
        }

        // ======================================
        // REQUETE SQL
        // ======================================
        const query = `
            SELECT 
                gmst.idmouvement,

                gmst.idagence,
                ag.nomagence,

                gmst.idarticle,
                ga.designation AS designation_article,

                gmst.iddepot,
                gd.designation AS designation_depot,

                gmst.idlot,

                gmst.type_mouvement,

                -- Quantité signée
                CASE
                    WHEN LOWER(gmst.type_mouvement) = 'sortie'
                    THEN -gmst.quantite
                    ELSE gmst.quantite
                END AS quantite_mouvement,

                gmst.prix_unitaire,
                gmst.montant,
                gmst.dateoperation,
                gmst.reference_piece,
                gmst.observation,

                -- Stock cumulé progressif
                SUM(
                    CASE
                        WHEN LOWER(gmst.type_mouvement) = 'sortie'
                        THEN -gmst.quantite
                        ELSE gmst.quantite
                    END
                ) OVER (
                    ORDER BY gmst.dateoperation, gmst.idmouvement
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) AS stock_cumule

            FROM gmouvement_stock gmst

            INNER JOIN garticle ga 
                ON ga.idarticle = gmst.idarticle

            INNER JOIN gdepot gd 
                ON gd.iddepot = gmst.iddepot

            INNER JOIN agence ag 
                ON ag.idagence = gmst.idagence

            WHERE gmst.idarticle = $1
              AND gmst.iddepot = $2

            ORDER BY gmst.dateoperation, gmst.idmouvement
        `;

        // ======================================
        // EXECUTION
        // ======================================
        const result = await client.query(query, [
            parseInt(idarticle, 10),
            parseInt(iddepot, 10)
        ]);

        // ======================================
        // REPONSE
        // ======================================
        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {

        console.error('Erreur mouvement stock:', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    } finally {
        client.release();
    }
});












router.get('/inventaire-stockdatechoisie', async (req, res) => {

    const client = await pool.connect();

    try {

        // =========================
        // PARAMÈTRES
        // =========================
        const { iddepot, date } = req.query;

        // =========================
        // VALIDATION
        // =========================
        if (!iddepot || !date) {

            return res.status(400).json({
                success: false,
                message: 'iddepot et date sont obligatoires'
            });
        }

        // =========================
        // CONVERSION DATE
        // FORMAT REÇU : 24/05/2026
        // FORMAT SQL : 2026-05-24
        // =========================
        const [jour, mois, annee] = date.split('/');

        const dateSql = `${annee}-${mois}-${jour}`;

        console.log("=================================");
        console.log("📦 INVENTAIRE STOCK");
        console.log("=================================");
        console.log("🏪 ID DEPOT =>", iddepot);
        console.log("📅 DATE RECUE =>", date);
        console.log("📅 DATE SQL =>", dateSql);

        // =========================
        // REQUÊTE SQL
        // =========================
        const query = `
            SELECT 
                gmst.idarticle,

                ga.designation,

                gmst.iddepot,

                gd.designation AS depot,

                -- STOCK
                SUM(
                    CASE 
                        WHEN gmst.type_mouvement = 'SORTIE'
                        THEN -gmst.quantite
                        ELSE gmst.quantite
                    END
                ) AS stock,

                -- VALEUR STOCK
                SUM(gmst.montant) AS valeur_stock,

                -- PRIX MOYEN
                CASE 
                    WHEN SUM(gmst.quantite) = 0 THEN 0
                    ELSE SUM(gmst.montant) / SUM(gmst.quantite)
                END AS prix_moyen

            FROM gmouvement_stock gmst

            INNER JOIN garticle ga 
                ON ga.idarticle = gmst.idarticle

            INNER JOIN gdepot gd 
                ON gd.iddepot = gmst.iddepot

            WHERE 
                gmst.iddepot = $1

                -- JUSQU'A FIN DE JOURNEE
                AND gmst.dateoperation < ($2::date + INTERVAL '1 day')

            GROUP BY 
                gmst.idarticle,
                ga.designation,
                gmst.iddepot,
                gd.designation

            HAVING 
                SUM(
                    CASE 
                        WHEN gmst.type_mouvement = 'SORTIE'
                        THEN -gmst.quantite
                        ELSE gmst.quantite
                    END
                ) <> 0

            ORDER BY ga.designation
        `;

        // =========================
        // EXECUTION SQL
        // =========================
        const result = await client.query(query, [
            parseInt(iddepot, 10),
            dateSql
        ]);

        console.log("=================================");
        console.log("✅ NOMBRE ARTICLES =>", result.rows.length);

        if (result.rows.length > 0) {

            console.log("=================================");
            console.log("📦 PREMIER ARTICLE");
            console.log("=================================");

            console.log(result.rows[0]);
        }

        // =========================
        // FORMATAGE DATE RETOUR
        // =========================
        const dataFormatee = result.rows.map(item => ({

            ...item,

            date_situation: date
        }));

        // =========================
        // REPONSE API
        // =========================
        return res.status(200).json({

            success: true,

            total: dataFormatee.length,

            date_situation: date,

            data: dataFormatee
        });

    } catch (error) {

        console.error('❌ ERREUR INVENTAIRE STOCK =>', error);

        return res.status(500).json({

            success: false,

            message: 'Erreur serveur',

            error: error.message
        });

    } finally {

        client.release();
    }
});







router.get('/generer-inventaire', async (req, res) => {

    const {
        idagence,
        iddepot,
        dateinventaire,
        idtypecl,
        idtypefr
    } = req.query;

    // ======================================================
    // VALIDATION
    // ======================================================

    if (!idagence || isNaN(idagence)) {
        return res.status(400).json({
            success: false,
            message: 'idagence obligatoire et numérique'
        });
    }

    if (!iddepot || isNaN(iddepot)) {
        return res.status(400).json({
            success: false,
            message: 'iddepot obligatoire et numérique'
        });
    }

    if (!dateinventaire) {
        return res.status(400).json({
            success: false,
            message: 'dateinventaire obligatoire'
        });
    }

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        // ======================================================
        // SUPPRESSION ANCIEN INVENTAIRE
        // ======================================================

        const deleteSql = `

            DELETE FROM g_impr_inventaire

            WHERE 
                idagence = $1
                AND iddepot = $2
                AND dateinventaire = $3
        `;

        await client.query(deleteSql, [
            idagence,
            iddepot,
            dateinventaire
        ]);

        // ======================================================
        // INSERT INVENTAIRE
        // ======================================================

        const insertSql = `

            WITH stock_calc AS (

                SELECT 
                    idarticle,
                    iddepot,

                    SUM(
                        CASE 
                            WHEN type_mouvement = 'SORTIE'
                                THEN -quantite
                            ELSE quantite
                        END
                    ) AS stock

                FROM gmouvement_stock

                WHERE 
                    idagence = $1
                    AND iddepot = $2
                    AND dateoperation < $3

                GROUP BY 
                    idarticle,
                    iddepot
            )

            INSERT INTO g_impr_inventaire (

                idagence,
                iddepot,
                idarticle,

                designation,
                depot,

                idsouscategorie,
                souscategorie,

                idunite,
                unite_nom,

                stock,
                prixachat,
                prixvente,

                dateinventaire
            )

            SELECT 

                $1 AS idagence,

                sc.iddepot,

                sc.idarticle,

                ga.designation,

                gd.designation AS depot,

                ga.idsouscategorie,

                gsc.designation AS souscategorie,

                ga.idunite,

                gu.designation AS unite_nom,

                sc.stock,

                0::numeric AS prixachat,

                0::numeric AS prixvente,

                $3 AS dateinventaire

            FROM stock_calc sc

            INNER JOIN garticle ga
                ON ga.idarticle = sc.idarticle

            INNER JOIN gdepot gd
                ON gd.iddepot = sc.iddepot

            LEFT JOIN gsouscategorie gsc
                ON gsc.idsouscategorie = ga.idsouscategorie

            LEFT JOIN gunite gu
                ON gu.idunite = ga.idunite

            WHERE sc.stock <> 0;
        `;

        await client.query(insertSql, [
            idagence,
            iddepot,
            dateinventaire
        ]);

        // ======================================================
        // UPDATE PRIX
        // ======================================================

        const updateSql = `

            UPDATE g_impr_inventaire gimp

            SET
                prixvente = COALESCE(tpv.prix_vente_ttc, 0),
                prixachat = COALESCE(tpa.prix_achat_ttc, 0)

            FROM (

                SELECT DISTINCT ON (idarticle)
                    idarticle,
                    prix_vente_ttc

                FROM ttarifprixvente

                WHERE 
                    datefin IS NULL
                    AND idtypecl = $1

            ) tpv

            LEFT JOIN (

                SELECT DISTINCT ON (idarticle)
                    idarticle,
                    prix_achat_ttc

                FROM ttarifprixachat

                WHERE 
                    datefin IS NULL
                    AND idtypefr = $2

            ) tpa

            ON tpa.idarticle = tpv.idarticle

            WHERE 
                gimp.idarticle = tpv.idarticle
                AND gimp.idagence = $3
                AND gimp.iddepot = $4
                AND gimp.dateinventaire = $5;
        `;

        await client.query(updateSql, [
            idtypecl,
            idtypefr,
            idagence,
            iddepot,
            dateinventaire
        ]);

        // ======================================================
        // RECUPERATION DONNEES
        // ======================================================

        const selectSql = `

            SELECT *
            FROM g_impr_inventaire

            WHERE 
                idagence = $1
                AND iddepot = $2
                AND dateinventaire = $3

            ORDER BY designation ASC
        `;

        const result = await client.query(selectSql, [
            idagence,
            iddepot,
            dateinventaire
        ]);

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {

        await client.query('ROLLBACK');

        console.error('Erreur génération inventaire :', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });

    } finally {

        client.release();
    }
});





// GET /glot-stock
router.get('/glotstockdispot', async (req, res) => {
  try {
    const { idarticle, idagence } = req.query;

    const result = await pool.query(
      `SELECT idlot, codelot, quantite
       FROM glot_stock
       WHERE idarticle = $1
         AND idagence = $2
         AND quantite > 0`,
      [idarticle, idagence]
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Erreur récupération stock lot"
    });
  }
});




router.get('/utilisateurssig', async (req, res) => {
  const { idagence } = req.query;

  // Vérification
  if (!idagence || isNaN(idagence)) {
    return res.status(400).json({ error: 'Le paramètre "idagence" doit être un entier valide.' });
  }

  const queryText = `
    SELECT 
      iduser,
      logineuser,
      nom,
      prenom,
      idagence,
      concat_ws(' ', nom, prenom) AS nomcomplet
    FROM utilisateur
    WHERE idagence = $1 and etat='true'
    ORDER BY iduser;
  `;

  try {
    const { rows } = await pool.query(queryText, [parseInt(idagence, 10)]);
    res.json({ data: rows });
  } catch (err) {
    console.error('Erreur GET /utilisateurssig:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});



module.exports = router;