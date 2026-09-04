// services/comptetiersService.js
const pool = require('../config/db');

exports.execOuvertureComptetiers = async (dataArray) => {
  const client = await pool.connect();
  let totalLignes = 0;

  try {
    await client.query('BEGIN');

    for (const data of dataArray) {
      if (!data.COMPTEGENERAL || !data.CODETIERS) continue;

      // Calcul idclasse
      const idclasse = parseInt(data.COMPTEGENERAL.charAt(0), 10);

      // Génération du code interne
      const formattedCompte = (data.COMPTEGENERAL + '00000').substring(0, 5);
      const newCodeInterne = formattedCompte + data.CODETIERS;

      // Insertion
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
          codeagence,source,idprod,idtiers
        )
        VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8,$9,$10,$11,$12,$13)
        `,
        [
          newCodeInterne,          // $1
          data.COMPTEGENERAL,      // $2
          data.DESIGNATION || '',  // $3
          idclasse,                // $4
          data.CODETIERS,          // $5
          data.NOMTIERS || '',     // $6
          data.COMPTEGENLIEE || '',// $7
          data.IDAG          ,// $8
          data.IDAGENCE        , // $9
          data.CODEAGENCE ,         // $10
           data.SOURCE,
            data.IDPROD,
             data.IDTIERS


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
