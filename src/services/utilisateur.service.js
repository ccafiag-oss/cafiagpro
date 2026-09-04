const pool = require('../config/db'); // Import de votre connexion pg
const bcrypt = require('bcrypt');
async function createUtilisateur(data) {


  // 1. Gestion du mot de passe (Hachage si nécessaire)
    let passwordToStore = null;
    if (data.passworduser && data.passworduser.trim() !== "") {
      // On ne hache que si ce n'est pas déjà un hash bcrypt
      if (!data.passworduser.startsWith('$2b$')) {
        passwordToStore = await bcrypt.hash(data.passworduser, 10);
      } else {
        passwordToStore = data.passworduser;
      }
    }



    const query = `
        INSERT INTO utilisateur (
            logineuser, passworduser, nom, prenom, telephone, 
            roles, solde, soldereglvente, idrole, etat, 
            idag, heuredebutactivite, heurfinactivite, 
            premiere_connexion, idservice, designation_service, 
            id_societe, photouser,codeclient,idagence,agence
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,$19,$20,$21)
        RETURNING *;
    `;

    const values = [
        data.logineuser, passwordToStore, data.nom, data.prenom, data.telephone,
        data.roles, data.solde || 0, data.soldereglvente || 0, data.idrole, data.etat || 'true',
        data.idag, data.heuredebutactivite, data.heurfinactivite,
        data.premiere_connexion || true, data.idservice, data.designation_service,
        data.id_societe, data.photouser,data.codeclient,data.idagence,data.agence // Le chemin de l'image
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
}




async function updateUtilisateur(id, data) {


  
  // 1. Gestion du mot de passe (Hachage si nécessaire)
    let passwordToStore = null;
    if (data.passworduser && data.passworduser.trim() !== "") {
      // On ne hache que si ce n'est pas déjà un hash bcrypt
      if (!data.passworduser.startsWith('$2b$')) {
        passwordToStore = await bcrypt.hash(data.passworduser, 10);
      } else {
        passwordToStore = data.passworduser;
      }
    }
 //passworduser = $2,

  const query = `
    UPDATE utilisateur SET
      logineuser = $1,
      passworduser = COALESCE($2, passworduser),
      nom = $3,
      prenom = $4,
      telephone = $5,
      roles = $6,
      solde = $7,
      soldereglvente = $8,
      idrole = $9,
      etat = $10,
      idag = $11,
      heuredebutactivite = $12,
      heurfinactivite = $13,
      premiere_connexion = $14,
      idservice = $15,
      designation_service = $16,
      id_societe = $17,
      photouser = COALESCE($18, photouser) ,
      codeclient=$20,
      idagence=$21,
      agence=$22
    WHERE iduser = $19
    RETURNING *;
  `;

  const values = [
    data.logineuser, passwordToStore, data.nom, data.prenom, data.telephone,
    data.roles, data.solde, data.soldereglvente, data.idrole, data.etat,
    data.idag, data.heuredebutactivite, data.heurfinactivite,
    data.premiere_connexion, data.idservice, data.designation_service,
    data.id_societe, data.photouser, id,data.codeclient,data.idagence,data.agence
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
}


module.exports = { createUtilisateur, updateUtilisateur };
