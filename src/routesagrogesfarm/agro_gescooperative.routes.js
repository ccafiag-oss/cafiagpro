const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/* =========================================
   AJOUTER UNE COOPERATIVE
========================================= */

router.post('/agro_fina_cooperative', async (req, res) => {

    try {

        const {

            codecooperative,
            idagence,
            iduser,

            raisonsociale,
            sigle,

            adresse,
            siege,

            telephone,
            email,

            responsable,
            numeroregistre,

            etat

        } = req.body;

        //=====================================
        // VALIDATION
        //=====================================

        if (
            !codecooperative ||
            !idagence ||
            !raisonsociale
        ) {

            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants'
            });
        }

        //=====================================
        // INSERTION
        //=====================================

        const query = `
            INSERT INTO fina_cooperative
            (
                codecooperative,
                idagence,
                iduser,

                raisonsociale,
                sigle,

                adresse,
                siege,

                telephone,
                email,

                responsable,
                numeroregistre,

                etat
            )
            VALUES
            (
                $1,$2,$3,$4,$5,
                $6,$7,$8,$9,$10,$11,$12
            )
            RETURNING *;
        `;

        const values = [

            codecooperative,
            idagence,
            iduser,

            raisonsociale,
            sigle,

            adresse,
            siege,

            telephone,
            email,

            responsable,
            numeroregistre,

            etat ?? true
        ];

        const result = await pool.query(query, values);

        res.status(201).json({

            success: true,

            message: 'Coopérative ajoutée avec succès',

            data: result.rows[0]
        });

    } catch (error) {

        console.log(error);

        //=====================================
        // GESTION DOUBLON
        //=====================================

        if (error.code === '23505') {

            return res.status(400).json({
                success: false,
                message: 'Ce code coopérative existe déjà'
            });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* =========================================
   AFFICHER TOUTES LES COOPERATIVES
========================================= */


router.get('/agrofina_cooperative', async (req, res) => {
    try {
        // 1. EXTRACTION DES PARAMÈTRES DE LA REQUÊTE
        const { idagence, iduser } = req.query;

        // 2. VALIDATION DES PARAMÈTRES
        const idagenceInt = parseInt(idagence, 10);

        if (isNaN(idagenceInt)) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idagence est obligatoire et doit être un entier valide.'
            });
        }

        // Gestion de iduser (optionnel)
        let iduserInt = null;
        if (iduser !== undefined && iduser !== null && iduser !== '') {
            iduserInt = parseInt(iduser, 10);
            if (isNaN(iduserInt)) {
                return res.status(400).json({
                    success: false,
                    message: 'Le paramètre iduser doit être un entier valide.'
                });
            }
        }

        // 3. REQUÊTE SQL (Conditionnelle avec l'opérateur OR)
        const query = `
            SELECT
                idcooperative,
                codecooperative,
                idagence,
                iduser,
                raisonsociale,
                sigle,
                adresse,
                siege,
                telephone,
                email,
                responsable,
                numeroregistre,
                etat,
                datecreation,
                datemodification
            FROM fina_cooperative 
            WHERE idagence = $1 
              AND ($2::int IS NULL OR iduser = $2)
            ORDER BY idcooperative DESC;
        `;

        // Si iduserInt est null, on passe null à la requête
        const result = await pool.query(query, [idagenceInt, iduserInt]);

        // 4. RÉPONSE
        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur GET /agrofina_cooperative:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur : ' + error.message
        });
    }
});



router.get('/agrofina_cooperativeOLDE', async (req, res) => {
    try {
        // 1. EXTRACTION DES PARAMÈTRES DE LA REQUÊTE
        const { idagence, iduser } = req.query;

        // 2. VALIDATION DES PARAMÈTRES
        const idagenceInt = parseInt(idagence, 10);
        const iduserInt = parseInt(iduser, 10);

        if (isNaN(idagenceInt) || isNaN(iduserInt)) {
            return res.status(400).json({
                success: false,
                message: 'Les paramètres idagence et iduser doivent être des entiers valides.'
            });
        }

        // 3. REQUÊTE SQL
        const query = `
            SELECT
                idcooperative,
                codecooperative,
                idagence,
                iduser,
                raisonsociale,
                sigle,
                adresse,
                siege,
                telephone,
                email,
                responsable,
                numeroregistre,
                etat,
                datecreation,
                datemodification
            FROM fina_cooperative 
            WHERE idagence = $1 AND iduser = $2
            ORDER BY idcooperative DESC;
        `;

        const result = await pool.query(query, [idagenceInt, iduserInt]);

        // 4. RÉPONSE
        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur GET /agrofina_cooperative:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur : ' + error.message
        });
    }
});


/* =========================================
   AFFICHER UNE COOPERATIVE PAR ID
========================================= */

router.get('/agro_fina_cooperative/:idcooperative', async (req, res) => {

    try {

        const { idcooperative } = req.params;

        const query = `
            SELECT *
            FROM fina_cooperative
            WHERE idcooperative = $1;
        `;

        const result = await pool.query(
            query,
            [idcooperative]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: 'Coopérative introuvable'
            });
        }

        res.status(200).json({

            success: true,

            data: result.rows[0]
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message: error.message
        });
    }
});

/* =========================================
   MODIFIER UNE COOPERATIVE
========================================= */

/* =========================================
   MODIFIER UNE COOPERATIVE
========================================= */



router.put('/agro_fina_cooperative/:idcooperative', async (req, res) => {

    try {

        const { idcooperative } = req.params;

        const {

            codecooperative,
            idagence,
            iduser,

            raisonsociale,
            sigle,

            adresse,
            siege,

            telephone,
            email,

            responsable,
            numeroregistre,

            etat

        } = req.body;

        //=====================================
        // UPDATE
        //=====================================

        const query = `
            UPDATE fina_cooperative
            SET

                codecooperative = $1,
                idagence = $2,
                iduser=$3,
                raisonsociale = $4,
                sigle = $5,

                adresse = $6,
                siege = $7,

                telephone = $8,
                email = $9,

                responsable = $10,
                numeroregistre = $11,

                etat = $12,

                datemodification = CURRENT_TIMESTAMP

            WHERE idcooperative = $13

            RETURNING *;
        `;

        const values = [

            codecooperative,
            idagence,
            iduser,
            raisonsociale,
            sigle,

            adresse,
            siege,

            telephone,
            email,

            responsable,
            numeroregistre,

            etat,

            idcooperative
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: 'Coopérative introuvable'
            });
        }

        res.status(200).json({

            success: true,

            message: 'Modification effectuée avec succès',

            data: result.rows[0]
        });

    } catch (error) {

        console.log(error);

        if (error.code === '23505') {

            return res.status(400).json({

                success: false,

                message: 'Ce code coopérative existe déjà'
            });
        }

        res.status(500).json({

            success: false,

            message: error.message
        });
    }
});










/* =========================================
   AFFICHER LES COOPERATIVES
   PAR AGENCE ET UTILISATEUR
========================================= */

router.get(
    '/agro_fina_cooperative/:idagence/:iduser',
    async (req, res) => {

    try {

        const { idagence, iduser } =
            req.params;

        const query = `
            SELECT

                idcooperative,
                codecooperative,
                idagence,
                iduser,

                raisonsociale,
                sigle,

                adresse,
                siege,

                telephone,
                email,

                responsable,
                numeroregistre,

                etat,

                datecreation,
                datemodification

            FROM fina_cooperative

            WHERE idagence = $1
            AND iduser = $2

            ORDER BY raisonsociale ASC;
        `;

        const result = await pool.query(
            query,
            [idagence, iduser]
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

/* =========================================
   LIER UN CLIENT A UNE COOPERATIVE
========================================= */

router.put(
    '/finaclients/agrocooperative/:idfourn',
    async (req, res) => {

    try {

        const { idfourn } = req.params;

        const { idcooperative } = req.body;

        //=====================================
        // UPDATE
        //=====================================

        const query = `
            UPDATE gfournisseur
            SET

                idcooperative = $1

            WHERE idfourn = $2

            RETURNING *;
        `;

        const values = [
            idcooperative || null,
            idfourn
        ];

        const result = await pool.query(
            query,
            values
        );

        //=====================================
        // VERIFICATION
        //=====================================

        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    'Fournisseur introuvable'
            });
        }

        res.status(200).json({

            success: true,

            message:
                'Coopérative liée avec succès',

            data: result.rows[0]
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message: error.message
        });
    }
});

/* =========================================
   RETIRER UNE COOPERATIVE D'UN CLIENT
========================================= */

router.put(
    '/finaclients/remove/agrocooperative/:idfourn',
    async (req, res) => {

    try {

        const { idfourn } = req.params;

        const query = `
            UPDATE gfournisseur
            SET

                idcooperative = NULL

            WHERE idfourn = $1

            RETURNING *;
        `;

        const result = await pool.query(
            query,
            [idfourn]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    'Fournisseur introuvable'
            });
        }

        res.status(200).json({

            success: true,

            message:
                'Coopérative retirée avec succès',

            data: result.rows[0]
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message: error.message
        });
    }
});




router.get('/agrofinaclientsliaison', async (req, res) => {

  const {
    idagence,
   
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

  

  try {

    //========================================
    // REQUETE DE BASE
    //========================================

    let sql = `
      SELECT
        *
      FROM gfournisseur
      WHERE idagence = $1
      
    `;

    //========================================
    // PARAMETRES
    //========================================

    const params = [
      idagence
      
    ];

    //========================================
    // RECHERCHE
    //========================================

    if (search && search.trim() !== '') {

      sql += `
        AND (
          
          nomcomplet ILIKE $3
          OR telephone ILIKE $3
          OR codefournisseurs ILIKE $3
        )
      `;

      params.push(`%${search}%`);
    }

    //========================================
    // TRI
    //========================================

    sql += `
      ORDER BY idfourn DESC
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
  '/agrofina_cooperativemembre/:idcooperative',
  async (req, res) => {

    try {

      const { idcooperative } = req.params;

      const query = `

       SELECT

          idfourn,
          codefournisseurs,

          nomcomplet,
         

          telephone,
          adresse,

          photo,

          idcooperative

        FROM gfournisseur

        WHERE idcooperative = $1

        ORDER BY nomcomplet ASC;

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






// Route GET pour récupérer les fournisseurs par coopérative
router.get('/gfournisseurcooperative', async (req, res) => {
    try {
        // 1. EXTRACTION DU PARAMÈTRE
        const { idcooperative } = req.query;

        // 2. VALIDATION DU PARAMÈTRE
        const idcoopInt = parseInt(idcooperative, 10);
        if (isNaN(idcoopInt)) {
            return res.status(400).json({
                success: false,
                message: 'Le paramètre idcooperative doit être un entier valide.'
            });
        }

        // 3. REQUÊTE SQL
        const query = `
            SELECT
                idfourn,
                numerofournisseur,
                codefournisseurs,
                idagence,
                nomcomplet,
                adresse,
                telephone,
                idcpt,
                solde,
                photo,
                idtypefr,
                comptegeneral,
                compteauxiliaire,
                codeagence,
                idcooperative
            FROM gfournisseur
            WHERE idcooperative = $1
            ORDER BY idfourn DESC;
        `;

        const result = await pool.query(query, [idcoopInt]);

        // 4. RÉPONSE JSON
        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error('Erreur GET /gfournisseur:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur : ' + error.message
        });
    }
});










module.exports = router;