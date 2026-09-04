const pool = require('../config/db');

/**
 * Insert ou update client (UPSERT) basé sur codeclients.
 * Retourne la ligne insérée / mise à jour.
 */

const createClient = async (clientData) => {
  const {
    date,
    nom,
    prenom,
    datenaisse,
    sexe,
    telephone,
    adresse,
    idgest,
    etat,
    photo,
    signature,
    idagence,
    codeagence,
    localisationdomicile
  } = clientData;

  const dateCreation =
      date || new Date().toISOString().substring(0, 10);

  const nomUpper =
      nom ? String(nom).toUpperCase() : null;

  const parsedIdgest =
      idgest !== undefined &&
      idgest !== null &&
      idgest !== ''
          ? parseInt(idgest, 10)
          : null;

  const parsedIdagence =
      idagence !== undefined &&
      idagence !== null &&
      idagence !== ''
          ? parseInt(idagence, 10)
          : null;

  const boolEtat =
      (etat === true ||
          etat === 'true' ||
          etat === '1' ||
          etat === 1);

  const query = `
    INSERT INTO clients (
      date_creation,
      nom,
      prenom,
      datenaisse,
      sexe,
      telephone,
      adresse,
      idgest,
      etat,
      photo,
      signature,
      idagence,
      codeagence,
      localisationdomicile
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
    )

    ON CONFLICT (codeclients)

    DO UPDATE SET
      date_creation = EXCLUDED.date_creation,
      nom = EXCLUDED.nom,
      prenom = EXCLUDED.prenom,
      datenaisse = EXCLUDED.datenaisse,
      sexe = EXCLUDED.sexe,
      telephone = EXCLUDED.telephone,
      adresse = EXCLUDED.adresse,
      idgest = EXCLUDED.idgest,
      etat = EXCLUDED.etat,
      photo = COALESCE(EXCLUDED.photo, clients.photo),
      signature = COALESCE(EXCLUDED.signature, clients.signature),
      idagence = EXCLUDED.idagence,
      codeagence = EXCLUDED.codeagence,
      localisationdomicile = EXCLUDED.localisationdomicile

    RETURNING *;
  `;

  const values = [
    dateCreation,
    nomUpper,
    prenom || null,
    datenaisse || null,
    sexe || null,
    telephone || null,
    adresse || null,
    parsedIdgest,
    boolEtat,
    photo || null,
    signature || null,
    parsedIdagence,
    codeagence,
    localisationdomicile || null
  ];

  try {

    // INSERT CLIENT
    const { rows } = await pool.query(query, values);

    const client = rows[0];

    // INSERT COMPTE INTERNE SI INEXISTANT
    await pool.query(`
      INSERT INTO public.tcomptegeninter(
        idcptintern,
        date,
        idcptgen,
        designationcptint,
        idclasse,
        codetiers,
        nomtiers,
        idcptinternsage,
        idag,
        idagence,
        codeagence,
        source,
        idprod,
        idtiers
      )
      SELECT
        concat(c.comptegeneral, c.codeclients),
        c.date_creation,
        c.comptegeneral,
        concat(c.nom, ' ', c.prenom),
        left(c.comptegeneral, 1),
        c.codeclients,
        concat(c.nom, ' ', c.prenom),
        concat(c.comptegeneral, c.codeclients),
        c.codeagence,
        c.idagence,
        c.codeagence,
        'CLIENT',
        null,
        idclients
      FROM clients c
      WHERE c.idclients = $1

      ON CONFLICT (idcptintern)
      DO NOTHING
    `, [client.idclients]);

    return client;

  } catch (err) {

    console.error(
      'Erreur SQL createClient (UPSERT):',
      err
    );

    throw err;
  }
};







/**
 * Met à jour un client existant par idclients.
 * Retourne la ligne mise à jour.
 */

const updateClient = async (idclients, clientData) => {

  const {
    nom,
    prenom,
    datenaisse,
    sexe,
    telephone,
    adresse,
    idgest,
    etat,
    photo,
    signature,
    idagence,
    codeagence,
    localisationdomicile
  } = clientData;

  const nomUpper =
      nom ? String(nom).toUpperCase() : null;

  const parsedIdgest =
      idgest !== undefined &&
      idgest !== null &&
      idgest !== ''
          ? parseInt(idgest, 10)
          : null;

  const parsedIdagence =
      idagence !== undefined &&
      idagence !== null &&
      idagence !== ''
          ? parseInt(idagence, 10)
          : null;

  const boolEtat =
      (etat === true ||
          etat === 'true' ||
          etat === '1' ||
          etat === 1);

  const query = `
    UPDATE clients SET

      nom = COALESCE($1, nom),
      prenom = COALESCE($2, prenom),
      datenaisse = COALESCE($3, datenaisse),
      sexe = COALESCE($4, sexe),
      telephone = COALESCE($5, telephone),
      adresse = COALESCE($6, adresse),
      idgest = COALESCE($7, idgest),
      etat = COALESCE($8, etat),
      photo = COALESCE($9, photo),
      signature = COALESCE($10, signature),
      idagence = COALESCE($11, idagence),
      codeagence = COALESCE($12, codeagence),
      localisationdomicile = COALESCE($13, localisationdomicile)

    WHERE idclients = $14

    RETURNING
      idclients,
      codeclients,
      comptegeneral,
      date_creation,
      nom,
      prenom,
      datenaisse,
      sexe,
      telephone,
      adresse,
      idgest,
      etat,
      photo,
      signature,
      idagence,
      codeagence,
      localisationdomicile;
  `;

  const values = [
    nomUpper,
    prenom || null,
    datenaisse || null,
    sexe || null,
    telephone || null,
    adresse || null,
    parsedIdgest,
    boolEtat,
    photo || null,
    signature || null,
    parsedIdagence,
    codeagence,
    localisationdomicile || null,
    parseInt(idclients, 10)
  ];

  try {

    // UPDATE CLIENT
    const { rows } = await pool.query(query, values);

    const client = rows[0];

    // UPDATE COMPTE INTERNE
   await pool.query(`
  UPDATE public.tcomptegeninter
  SET
    designationcptint =
        ($1::text || ' ' || $2::text),

    nomtiers =
        ($1::text || ' ' || $2::text)

  WHERE codetiers = $3::text
`, [
  client.nom || '',
  client.prenom || '',
  client.codeclients
]);

    return client || null;

  } catch (err) {

    console.error(
      'Erreur SQL updateClient:',
      err
    );

    throw err;
  }
};


const getAllClients = async (filters = {}) => {
  try {
    const { idag } = filters;
    const params = [];
    let where = '';

    if (typeof idag !== 'undefined' && idag !== null && String(idag).trim() !== '') {
      params.push(parseInt(idag, 10));
      where = `WHERE idagence = $1`;
    }

    const query = `
      SELECT
        idclients,
        codeclients,
        date_creation,
        nom,
        prenom,
        datenaisse,
        sexe,
        telephone,
        adresse,
        idgest,
        etat,
        photo,
        signature,
        idagence,
        codeagence,
        localisationdomicile,
        compteauxiliaire
      FROM clients
      ${where}
      ORDER BY idclients DESC
      LIMIT 1000
    `;

    const { rows } = await pool.query(query, params);
    return rows;
  } catch (err) {
    console.error('Erreur SQL getAllClients:', err);
    throw err;
  }
};

module.exports = {
  createClient,
  updateClient,
  getAllClients
};
