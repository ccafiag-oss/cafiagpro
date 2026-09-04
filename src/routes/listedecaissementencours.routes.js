const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Décaissements en cours pour un client spécifique
router.get('/decencours/:codeclients', async (req, res) => {
  const { codeclients } = req.params;

  if (!codeclients) {
    return res.status(400).json({ error: "codeclients requis" });
  }

  try {
    const query = `
      SELECT codedec,
             codedemande,
             date,
             idclients,
             codeclients,
             nom,
             prenoms,
             adresse,
             contact,
             idarticle,
             article,
             (COALESCE(capital,0) 
              + COALESCE(interet,0) 
              + COALESCE(autrescommission,0) 
              + COALESCE(fraisoperateur,0)) AS montant_credit,
             (COALESCE(rembcapital,0) 
              + COALESCE(rembinteret,0)) AS total_remb,
             (COALESCE(rembcapital,0) 
              + COALESCE(rembinteret,0)) -
             (COALESCE(capital,0) 
              + COALESCE(interet,0) 
              + COALESCE(autrescommission,0) 
              + COALESCE(fraisoperateur,0)) AS soldeencourstotal
      FROM decaissement
      WHERE codeclients = $1
      AND datevalidation IS NULL;
    `;

    const { rows } = await pool.query(query, [codeclients]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Aucun décaissement en cours pour ce client" });
    }

    res.json(rows);

  } catch (err) {
    console.error("Erreur récupération décaissements :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});




// Décaissements en cours pour tous les clients
router.get('/decencours', async (req, res) => {
  try {
    const query = `
      SELECT codedec,
             codedemande,
             date,
             idclients,
             codeclients,
             nom,
             prenoms,
             adresse,
             contact,
             idarticle,
             article,
             (COALESCE(capital,0) 
              + COALESCE(interet,0) 
              + COALESCE(autrescommission,0) 
              + COALESCE(fraisoperateur,0)) AS montant_credit,
             (COALESCE(rembcapital,0) 
              + COALESCE(rembinteret,0)) AS total_remb,
             (COALESCE(rembcapital,0) 
              + COALESCE(rembinteret,0)) -
             (COALESCE(capital,0) 
              + COALESCE(interet,0) 
              + COALESCE(autrescommission,0) 
              + COALESCE(fraisoperateur,0)) AS soldeencourstotal
      FROM decaissement
      WHERE datevalidation IS NULL;
    `;

    const { rows } = await pool.query(query);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Aucun décaissement en cours" });
    }

    res.json(rows);

  } catch (err) {
    console.error("Erreur récupération décaissements :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});




// Remboursements pour un décaissement spécifique
router.get('/listeremb/:codedec', async (req, res) => {
  const { codedec } = req.params;

  if (!codedec) {
    return res.status(400).json({ error: "codedec requis" });
  }

  try {
    const query = `
      SELECT coderemb,
             date_remb,
             idclients,
             codeclients,
             codedec,
             period,
             montant,
             capital,
             interet,
             iduser,
             idagence
      FROM remboursement
      WHERE codedec = $1;
    `;

    const { rows } = await pool.query(query, [codedec]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Aucun remboursement trouvé pour ce décaissement" });
    }

    res.json(rows);

  } catch (err) {
    console.error("Erreur récupération remboursement :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});





router.get('/soldecaisse/:idcptgn', async (req, res) => {
  const idcptgn = req.params.idcptgn; // <-- garder comme string

  try {
    const query = `
      SELECT 
        COALESCE(SUM(montantdebit), 0) 
        - COALESCE(SUM(montantcredit), 0) AS solde
      FROM tmvttheorique
      WHERE idcptgn = $1;
    `;

    const { rows } = await pool.query(query, [idcptgn]);

    res.json(rows[0]);
  } catch (err) {
    console.error("Erreur récupération solde :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});











router.get('/listecompteauxiliaire/:idagence', async (req, res) => {
  const idagence = req.params.idagence; // on récupère l'id agence

  try {
    const query = `
      SELECT 
        idcptintern, 
        designationcptint, 
        idagence, 
        codeagence,
        idcptgen,codetiers,nomtiers,idtiers
      FROM tcomptegeninter
      WHERE idagence = $1
      ORDER BY designationcptint ASC;
    `;

    const { rows } = await pool.query(query, [idagence]);

    res.status(200).json(rows); // ✅ on renvoie toute la liste

  } catch (err) {
    console.error("Erreur récupération comptes auxiliaires :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});








router.put('/utilisateurs/caisse/:iduser', async (req, res) => {
  const { iduser } = req.params;
  const { comptecaisse, etatcaisse } = req.body;

  try {
    const query = `
      UPDATE utilisateur
      SET comptecaisse = $1,
          etatcaisse = $2
      WHERE iduser = $3
      RETURNING *;
    `;

    const { rows } = await pool.query(query, [
      comptecaisse,
      etatcaisse,
      iduser
    ]);

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("Erreur update caisse:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});










router.get('/etatcaisse/:idcptgn', async (req, res) => {
  const { idcptgn } = req.params;
  const { p1, p2 } = req.query; // Récupère les dates depuis l'URL (?p1=...&p2=...)

  try {
    const query = `
      SELECT 
        idmvts, 
        date, 
        codjrl, 
        idtiers, 
        libelle, 
        COALESCE(montantdebit, 0) AS entree, 
        COALESCE(montantcredit, 0) AS sortie,
        -- Le solde progressif se calcule sur l'ordre chronologique
        SUM(COALESCE(montantdebit, 0) - COALESCE(montantcredit, 0)) OVER (
          ORDER BY date ASC, idmvts ASC
        ) AS solde_progressif
      FROM tmvttheorique
      WHERE idcptgn = $1 
        AND date BETWEEN $2 AND $3
      ORDER BY date ASC, idmvts ASC;
    `;

    // Exécution de la requête avec les 3 paramètres
    const { rows } = await pool.query(query, [idcptgn, p1, p2]);

    res.json(rows);
  } catch (err) {
    console.error("Erreur état de caisse avec dates :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});







router.get('/listeutilisateurtrc', async (req, res) => {
  // On utilise req.query pour correspondre à l'appel Flutter : ?idag=...
  const idagence = req.query.idag; 

  if (!idagence) {
    return res.status(400).json({ error: "L'identifiant de l'agence (idag) est requis" });
  }

  try {
    const query = `
      SELECT 
        iduser as "IDUSER", 
        concat(nom, ' ', prenom) as "NOM", 
        idagence, 
        comptecaisse,
        etatcaisse
      FROM utilisateur 
      WHERE idagence = $1 
      ORDER BY nom ASC;
    `;

    const { rows } = await pool.query(query, [idagence]);

    // On renvoie tout le tableau (rows) et non juste rows[0]
    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error("Erreur récupération utilisateurs :", err);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des utilisateurs" });
  }
});





router.get('/listesociete', async (req, res) => {
  // On utilise req.query pour correspondre à l'appel Flutter : ?idag=...
 
  try {
    const query = `
      select idsociete,codesociete,raisonsocial from creationsociete
      ORDER BY raisonsocial ASC;
    `;

    const { rows } = await pool.query(query);
    // On renvoie tout le tableau (rows) et non juste rows[0]
    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error("Erreur récupération societe :", err);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des societe" });
  }
});







router.get('/ouvrireagence', async (req, res) => {
  const { societe, pays } = req.query;

  // Log des paramètres reçus
  console.log('GET /api/ouvrireagence - query:', { societe, pays });

  // Validation minimale
  if (!societe || !pays) {
    return res.status(400).json({ success: false, error: 'Paramètres societe et pays requis' });
  }

  const client = await pool.connect();
  try {
    // On accepte soit idsociete/idpays (numériques) soit codesociete/codepays (string)
    // Détecter si societe/pays sont numériques
    const societeIsInt = /^\d+$/.test(String(societe));
    const paysIsInt = /^\d+$/.test(String(pays));

    // Construire la requête et les valeurs dynamiquement
    let queryText = `
      SELECT
        idagence,
        radical,
        numeroagence,
        codeagence,
        nomagence,
        codesociete,
        codepays,
        idsociete,
        idpays
      FROM public.agence
      WHERE 1=1
    `;
    const values = [];
    let idx = 1;

    if (societeIsInt) {
      queryText += ` AND idsociete = $${idx++}`;
      values.push(parseInt(societe, 10));
    } else {
      queryText += ` AND codesociete = $${idx++}`;
      values.push(String(societe));
    }

    if (paysIsInt) {
      queryText += ` AND idpays = $${idx++}`;
      values.push(parseInt(pays, 10));
    } else {
      queryText += ` AND codepays = $${idx++}`;
      values.push(String(pays));
    }

    // Optionnel : tri par nomagence ou numeroagence
    queryText += ` ORDER BY nomagence NULLS LAST, numeroagence NULLS LAST;`;

    console.log('SQL Query:', queryText, 'Values:', values);

    const { rows } = await client.query(queryText, values);

    // Log du nombre de lignes retournées
    console.log(`Found ${rows.length} agences`);

    // Retour formaté compatible Flutter (body['data'])
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error GET /api/ouvrireagence:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur', details: err.message });
  } finally {
    client.release();
  }
});






router.get('/listedecaisentredate', async (req, res) => {
  const { dateDebut, dateFin, idagence } = req.query;

  // 1. Validation stricte
  if (!dateDebut || !dateFin || !idagence) {
    return res.status(400).json({ error: "Les paramètres dateDebut, dateFin et idagence sont obligatoires." });
  }

  try {
    // 2. Requête SQL
    const query = `
      SELECT * FROM public.decaissement 
      WHERE idagence = $1 
      AND date BETWEEN $2 AND $3
      ORDER BY date DESC`;
    
    const { rows } = await pool.query(query, [idagence, dateDebut, dateFin]);
    
    // 3. Retour standardisé
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erreur GET /listedecaisentredate:', err);
    res.status(500).json({ success: false, error: "Erreur lors de la récupération", details: err.message });
  }
});




// ==========================================
// 2️⃣ ANNULER UN DÉCAISSEMENT
// ==========================================
router.delete('/annuler/:ref_piece', async (req, res) => {
  const { ref_piece } = req.params;
  const { idagence } = req.query; // On demande l'idagence pour plus de sécurité

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // A. Vérifier si un remboursement existe pour ce décaissement
    const checkRemboursement = `
      SELECT 1 FROM public.remboursement 
      WHERE ref_piece = $1`;
    const rembResult = await client.query(checkRemboursement, [ref_piece]);

    if (rembResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        message: "Impossible d'annuler : ce décaissement a déjà fait l'objet d'un ou plusieurs remboursements." 
      });
    }

  
    // ... après avoir vérifié les remboursements

// 1. Récupérer le codedemande associé à la ref_piece avant de supprimer le décaissement
const getCodeDemande = `SELECT codedemande FROM public.decaissement WHERE ref_piece = $1 AND idagence = $2`;
const codeResult = await client.query(getCodeDemande, [ref_piece, idagence]);

if (codeResult.rows.length === 0) {
  throw new Error("Décaissement non trouvé.");
}
const codedemande = codeResult.rows[0].codedemande;

// 2. Supprimer l'échéancier détaillé
await client.query(
  `DELETE FROM public.tableauamortissementgesecheancedetail WHERE ref_piece = $1 AND idagence = $2`, 
  [ref_piece, idagence]
);

// 3. Mettre à jour la demande de crédit (datedecaissement = null)
// Note : utilisez $1 car on ne passe qu'un seul paramètre ici
const updateDemande = `
  UPDATE demandecredit
  SET datedecaissement = null
  WHERE codedemande = $1
  RETURNING *;
`;
await client.query(updateDemande, [codedemande]);

// 4. Supprimer le décaissement
const deleteDec = await client.query(
  `DELETE FROM public.decaissement WHERE ref_piece = $1 AND idagence = $2 RETURNING *`, 
  [ref_piece, idagence]
);
// ... reste du code (COMMIT, etc.)





    if (deleteDec.rowCount === 0) {
      throw new Error("Décaissement non trouvé ou déjà supprimé.");
    }

    


    await client.query('COMMIT');
    res.json({ message: "Décaissement annulé avec succès." });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: "Échec de l'annulation", details: err.message });
  } finally {
    client.release();
  }
});



module.exports = router;