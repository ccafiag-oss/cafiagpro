const fs = require('fs');
const csv = require('csv-parser');
const pool = require('./src/config/db'); // ton pool basé sur .env

async function runImport() {
  try {
    const rows = [];

    fs.createReadStream('D:/tcompte_clean.csv')
      .pipe(csv({ separator: ';' })) // lit les headers automatiquement
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', async () => {
        console.log(`📥 Lecture terminée : ${rows.length} lignes trouvées`);

        for (const row of rows) {
          try {
            await pool.query(
              `INSERT INTO public.tcompte 
               (code, designation, classe, designationclasse, niveaux1, designationniveaux1, nveaux2, designationniveaux2, nveaux3, designationniveaux3, sence_solde)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
              [
                parseInt(row.code, 10),
                row.designation,
                parseInt(row.classe, 10),
                row.designationclasse,
                parseInt(row.niveaux1, 10),
                row.designationniveaux1,
                parseInt(row.nveaux2, 10),
                row.designationniveaux2,
                parseInt(row.nveaux3, 10),
                row.designationniveaux3,
                row.sence_solde
              ]
            );
          } catch (err) {
            console.error(`❌ Erreur insertion ligne code=${row.code}:`, err.message);
          }
        }

        console.log('✅ Import terminé');
        await pool.end();
      });
  } catch (err) {
    console.error('❌ Erreur globale:', err.message);
    await pool.end();
  }
}

runImport();
