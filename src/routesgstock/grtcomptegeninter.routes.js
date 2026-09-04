const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ==========================================
// 1️⃣ RÉCUPÉRER LES COMPTES INTERNES PAR IDAGENCE
// GET: /api/tcomptegeninter?idagence=1
// ==========================================
router.get('/tcomptegeninter', async (req, res) => {
  const { idagence } = req.query;

  if (!idagence) {
    return res.status(400).json({ success: false, error: 'Le paramètre "idagence" est obligatoire.' });
  }

  try {
    const query = `
      SELECT * FROM tcomptegeninter 
      WHERE idagence = $1 
      ORDER BY id DESC
    `;
    const { rows } = await pool.query(query, [idagence]);
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Erreur GET /tcomptegeninter:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur lors de la récupération.' });
  }
});

// ==========================================
// 2️⃣ ENREGISTRER UN COMPTE AVEC GÉNÉRATION DU CODE INTERNE (POST)
// POST: /api/tcomptegeninter
// ==========================================
router.post('/tcomptegeninter', async (req, res) => {
  const data = req.body;

  if (!data.COMPTEGENERAL || !data.IDAGENCE || !data.CODEAGENCE) {
    return res.status(400).json({ success: false, error: 'Champs obligatoires manquants (COMPTEGENERAL, IDAGENCE, CODEAGENCE).' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1️⃣ Dernier suffixe
    const lastCodeRes = await client.query(
      `
      SELECT COALESCE(RIGHT(idcptintern, 2)::INT, 0) AS lastcode
      FROM tcomptegeninter
      WHERE idcptgen = $1
        AND COALESCE(codetiers, '') = ''
        AND idag = $2
      ORDER BY idcptintern DESC
      LIMIT 1
      `,
      [
        data.COMPTEGENERAL, // $1 => TEXT
        data.IDAG           // $2 => TEXT (ou CODEAGENCE selon votre configuration)
      ]
    );

    let lastCode = lastCodeRes.rows[0]?.lastcode || 0;
    lastCode++;

    // 2️⃣ Calcul idclasse côté JS (premier chiffre de COMPTEGENERAL)
    const idclasse = parseInt(data.COMPTEGENERAL.charAt(0), 10);

    // 3️⃣ Génération du code interne
    const formattedCompte = (data.COMPTEGENERAL + '00000').substring(0, 5);
    const newCodeInterne =
      formattedCompte +
      data.CODEAGENCE +
      '000' +
      String(lastCode).padStart(2, '0');

    // 4️⃣ Insertion
    const insertQuery = `
      INSERT INTO tcomptegeninter (
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
        source
      )
      VALUES ($1, NOW(), $2, $3, $4, '', '', $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const { rows } = await client.query(insertQuery, [
      newCodeInterne,             // $1
      data.COMPTEGENERAL,         // $2
      data.DESIGNATION || '',     // $3
      idclasse,                   // $4
      data.COMPTEGENLIEE || '',   // $5
      data.IDAG,                  // $6
      data.IDAGENCE,              // $7
      data.CODEAGENCE,            // $8
      data.source || 'COMM'       // $9
    ]);

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Compte enregistré avec succès ✨', data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur POST /tcomptegeninter:', err);
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Ce numéro de compte interne existe déjà.' });
    }
    res.status(500).json({ success: false, error: 'Erreur serveur lors de l\'enregistrement.' });
  } finally {
    client.release();
  }
});

// ==========================================
// 3️⃣ MODIFIER UN COMPTE (PUT)
// PUT: /api/tcomptegeninter/:idcptintern
// ==========================================
// ==========================================
// 3️⃣ MODIFIER UN COMPTE (PUT)
// PUT: /api/tcomptegeninter/:idcptintern
// ==========================================
router.put('/tcomptegeninter/:idcptintern', async (req, res) => {
  const { idcptintern } = req.params;
  const { DESIGNATION, designationcptint, idcptgen } = req.body;
  const finalDesignation = designationcptint || DESIGNATION;

  try {
    const query = `
      UPDATE tcomptegeninter 
      SET designationcptint = COALESCE(NULLIF($1, ''), designationcptint),
          idcptgen = COALESCE(NULLIF($2, ''), idcptgen)
      WHERE idcptintern = $3 
      RETURNING *;
    `;
    const { rowCount, rows } = await pool.query(query, [finalDesignation, idcptgen, idcptintern]);
    
    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Compte introuvable.' });
    }
    res.status(200).json({ success: true, message: 'Compte mis à jour avec succès 📝', data: rows[0] });
  } catch (err) {
    console.error('Erreur PUT /tcomptegeninter/:idcptintern:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur lors de la modification.' });
  }
});
// ==========================================
// 4️⃣ DUPLIQUER DES COMPTES VERS UNE AUTRE AGENCE (POST)
// POST: /api/tcomptegeninter/dupliquer
// ==========================================


// ==========================================
// 4️⃣ DUPLIQUER DES COMPTES VERS UNE AGENCE (POST)
// POST: /api/tcomptegeninter/dupliquer
// ==========================================
router.post('/tcomptegeninter/dupliquer', async (req, res) => {
  const { idagence_source, idagence_destination, ids_comptes } = req.body;

  if (!idagence_source || !idagence_destination || !ids_comptes || !Array.isArray(ids_comptes) || ids_comptes.length === 0) {
    return res.status(400).json({ success: false, error: 'Paramètres manquants ou invalides.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1️⃣ Récupérer les informations de l'agence de destination avec votre requête exacte
    const agenceDestQuery = `SELECT codeagence, nomagence FROM agence WHERE idagence = $1`; 
    const { rows: agenceDestRows } = await client.query(agenceDestQuery, [idagence_destination]);

    if (agenceDestRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: "Agence de destination introuvable." });
    }

    const newCodeAgence = agenceDestRows[0].codeagence; 

    // 2️⃣ Récupérer les comptes source à dupliquer
    const selectQuery = `
      SELECT idcptintern, idcptgen, designationcptint, idclasse, codetiers, nomtiers, idcptinternsage, idag, codeagence, source, idprod, idtiers
      FROM tcomptegeninter 
      WHERE idagence = $1 AND idcptintern = ANY($2::text[])
    `;
    const { rows: comptesToDuplicate } = await client.query(selectQuery, [idagence_source, ids_comptes]);

    if (comptesToDuplicate.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Aucun compte trouvé à dupliquer.' });
    }

    let duplicatedCount = 0;
    for (const c of comptesToDuplicate) {
      const prefixCompte = c.idcptgen ? (c.idcptgen + '00000').substring(0, 5) : c.idcptintern.substring(0, 5);
      
      // Chercher le dernier suffixe utilisé dans l'agence de destination pour ce compte général
      const lastCodeRes = await client.query(
        `
        SELECT COALESCE(RIGHT(idcptintern, 2)::INT, 0) AS lastcode
        FROM tcomptegeninter
        WHERE idcptgen = $1
          AND COALESCE(codetiers, '') = ''
          AND codeagence = $2
          AND idagence = $3
        ORDER BY idcptintern DESC
        LIMIT 1
        `,
        [c.idcptgen, newCodeAgence, idagence_destination]
      );

      let lastCode = lastCodeRes.rows[0]?.lastcode || 0;
      lastCode++;

      // Reconstruction du nouveau code interne avec le nouveau codeagence de destination
      const newCodeInterne =
        prefixCompte +
        newCodeAgence.trim() +
        '000' +
        String(lastCode).padStart(2, '0');

      // Vérification absolue d'unicité
      const check = await client.query('SELECT id FROM tcomptegeninter WHERE idagence = $1 AND idcptintern = $2', [idagence_destination, newCodeInterne]);
      if (check.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, error: `Le compte généré "${newCodeInterne}" existe déjà dans l'agence de destination.` });
      }

      // 3️⃣ Insertion dans l'agence de destination
      const insertQuery = `
        INSERT INTO tcomptegeninter (
          idcptintern, date, idcptgen, designationcptint, idclasse, 
          codetiers, nomtiers, idcptinternsage, idag, idagence, 
          codeagence, source, idprod, idtiers
        ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `;

      await client.query(insertQuery, [
        newCodeInterne,
        c.idcptgen,
        c.designationcptint,
        c.idclasse,
        c.codetiers,
        c.nomtiers,
        c.idcptinternsage,
        newCodeAgence,
        idagence_destination,
        newCodeAgence,
        c.source,
        c.idprod,
        c.idtiers
      ]);
      duplicatedCount++;
    }

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: `${duplicatedCount} compte(s) dupliqué(s) avec succès vers la nouvelle agence ✨` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur POST /tcomptegeninter/dupliquer:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur lors de la duplication.' });
  } finally {
    client.release();
  }
});

module.exports = router;