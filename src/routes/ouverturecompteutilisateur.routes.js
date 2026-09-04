const bcrypt = require('bcrypt');
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/enregistrercmptclient', async (req, res) => {
  const client = await pool.connect();
  try {
    const { telephone } = req.body;
    const telephoneStr = telephone.toString(); // ✅ conversion en chaîne

    let telephoneToStore = null;
    if (telephoneStr && telephoneStr.trim() !== "") {
      if (!telephoneStr.startsWith('$2b$')) {
        telephoneToStore = await bcrypt.hash(telephoneStr, 10);
      } else {
        telephoneToStore = telephoneStr;
      }
    }

    await client.query('BEGIN');

    // 1. Utilisateur
    const queryUtilisateur = `
      INSERT INTO utilisateur(
        logineuser, passworduser, nom, prenom, telephone, roles, solde, soldereglvente,
        idrole, etat, idag, heuredebutactivite, heurfinactivite, premiere_connexion,
        idservice, designation_service, id_societe, photouser, codeclient, idagence,
        agence, comptecaisse
      )
      SELECT
        c.telephone AS logineuser,
        $2 AS passworduser,
        c.nom,
        c.prenom,
        c.telephone,
        'Partenaire' AS roles,
        0 AS solde,
        0 AS soldereglvente,
        5 AS idrole,
        'true' AS etat,
        c.idagence AS idag,
        '00:00:00' AS heuredebutactivite,
        '23:59:00' AS heurfinactivite,
        'true' AS premiere_connexion,
        5 AS idservice,
        'Partenaire' AS designation_service,
        c.idagence AS id_societe,
        c.photo AS photouser,
        c.codeclients AS codeclient,
        c.idagence,
        c.codeagence AS agence,
        '4111' AS comptecaisse
      FROM clients c
      WHERE c.telephone = $1 LIMIT 1
      ON CONFLICT (telephone) DO UPDATE
      SET nom        = EXCLUDED.nom,
          prenom     = EXCLUDED.prenom,
          photouser  = EXCLUDED.photouser,
          codeclient = EXCLUDED.codeclient,
          agence     = EXCLUDED.agence,
          idagence   = EXCLUDED.idagence
      RETURNING *;
    `;
    const resultUtilisateur = await client.query(queryUtilisateur, [telephoneStr, telephoneToStore]);



// 1. Récupérer l'id de l'utilisateur inséré/mis à jour

// --- AJOUT DE LA VÉRIFICATION ---
if (resultUtilisateur.rows.length === 0) {
    throw new Error("Client introuvable pour ce numéro de téléphone.");
}
// --------------------------------

const utilisateur = resultUtilisateur.rows[0]; 
const idUser = utilisateur.iduser;
const idAgence = utilisateur.idagence;

// 2. Maintenant vous pouvez procéder en toute sécurité
const queryutilisateur_agence = `
  INSERT INTO utilisateur_agence(iduser, idagence, etat)
  VALUES ($1, $2, 'true')
  ON CONFLICT (iduser, idagence) 
  DO UPDATE SET etat = 'true';
`;

await client.query(queryutilisateur_agence, [idUser, idAgence]);



    // 2. Contacts
    const queryContacts = `
      INSERT INTO contacts(user_phone, contact_phone, contact_name)
      SELECT $1 AS user_phone,
             c.telephone AS contact_phone,
             c.raisonsocial AS contact_name
      FROM creationsociete c
      ON CONFLICT (user_phone, contact_phone) DO UPDATE
      SET contact_name = EXCLUDED.contact_name;
    `;
    await client.query(queryContacts, [telephoneStr]);

    // 3. Conversation
    const queryConversation = `
      INSERT INTO conversations(chat_id, created_at)
      SELECT c.telephone || '_' || $1, NOW()
      FROM creationsociete c
      LIMIT 1
      ON CONFLICT (chat_id) DO UPDATE 
      SET created_at = EXCLUDED.created_at
      RETURNING id, chat_id;
    `;
    const resultConversation = await client.query(queryConversation, [telephoneStr]);
    const conversationId = resultConversation.rows[0].id;

    // 4. Message automatique enrichi
const queryMessage = `
  INSERT INTO messages(conversation_id, sender_phone, receiver_phone, message_text, message_type, file_url, "timestamp")
  SELECT $1,
         c.telephone AS sender_phone,
         CAST($2 AS text) AS receiver_phone,
         'Chère client, notre société vous remercie pour la confiance. 
Nous sommes là pour vous aider à réaliser vos projets, veuillez nous écrire.
Par ailleurs, voici vos identifiants de connexion (à changer immédiatement) :
login = ' || CAST($2 AS text) || ', mot de passe = ' || CAST($2 AS text) AS message_text,
         'text' AS message_type,
         NULL AS file_url,
         NOW() AS "timestamp"
  FROM creationsociete c
  LIMIT 1;
`;
await client.query(queryMessage, [conversationId, telephoneStr]);


    await client.query('COMMIT');
    res.status(200).json({ 
      message: "Utilisateur inséré/mis à jour, contact créé, conversation ouverte et message envoyé", 
      data: {
        utilisateur: resultUtilisateur.rows[0],
        conversation: resultConversation.rows[0]
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur:", err.message);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;


/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/enregistrercmptclient', async (req, res) => {
  const client = await pool.connect();
  try {
    const { telephone } = req.body;

    await client.query('BEGIN');

    const query = `
      INSERT INTO utilisateur(
        logineuser, passworduser, nom, prenom, telephone, roles, solde, soldereglvente,
        idrole, etat, idag, heuredebutactivite, heurfinactivite, premiere_connexion,
        idservice, designation_service, id_societe, photouser, codeclient, idagence,
        agence, comptecaisse
      )
      SELECT
        telephone AS logineuser,
        'CAFIAG' AS passworduser,
        nom,
        prenom,
        telephone,
        'Partenaire' AS roles,
        0 AS solde,
        0 AS soldereglvente,
        5 AS idrole,
        'true' AS etat,
        idagence AS idag,
        '00:00:00' AS heuredebutactivite,
        '23:59:00' AS heurfinactivite,
        'true' AS premiere_connexion,
        5 AS idservice,
        'Partenaire' AS designation_service,
        idagence AS id_societe,
        photo AS photouser,
        codeclients AS codeclient,
        idagence,
        codeagence AS agence,
        '57110TGS001A00100001' AS comptecaisse
      FROM clients
      WHERE telephone = $1
      ON CONFLICT (telephone) DO UPDATE
      SET nom        = EXCLUDED.nom,
          prenom     = EXCLUDED.prenom,
          photouser  = EXCLUDED.photouser,
          codeclient = EXCLUDED.codeclient,
          agence     = EXCLUDED.agence,
          idagence   = EXCLUDED.idagence
      RETURNING *;
    `;

    const result = await client.query(query, [telephone]);

    await client.query('COMMIT');
    res.status(200).json({ message: "Utilisateur inséré/mis à jour", data: result.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur:", err.message);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  } finally {
    client.release();
  }
});
module.exports = router;
*/
