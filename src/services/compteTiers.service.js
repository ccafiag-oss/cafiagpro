const pool = require('../config/db');

exports.execInsertComptetiers = async (dataArray) => {
  const client = await pool.connect();
  let totalLignes = 0;

  try {
    await client.query('BEGIN');

    for (const data of dataArray) {
      if (!data.COMPTEGENERAL) continue;

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
          data.CODEAGENCE     // $2 => TEXT
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
        String(lastCode).padStart(2, 0);

      // 4️⃣ Insertion
      await client.query(
        `
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
        VALUES ($1, NOW(), $2, $3, $4, '', '', $5, $6, $7, $8,$9)
        `,
        [
          newCodeInterne,          // $1
          data.COMPTEGENERAL,      // $2
          data.DESIGNATION || '',  // $3
          idclasse,                // $4
          data.COMPTEGENLIEE || '',// $5
          data.IDAG  ,
          data.IDAGENCE        , // $9
          data.CODEAGENCE,
          data.source          // $10        // $6
        ]
      );

      totalLignes++;
    }

    await client.query('COMMIT');
    return { success: true, totalLignes };

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur transaction:', err.message);
    throw err;
  } finally {
    client.release();
  }
};
