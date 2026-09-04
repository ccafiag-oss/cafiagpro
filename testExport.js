// testExport.js
const { execExportProc } = require('./src/services/export.service');

(async () => {
  try {
    // Exemple : op=81, codeSociete='SOC001'
    const result = await execExportProc({ op: 81, codeSociete: 'SOC001' });
    console.log('Résultat :', result);
  } catch (err) {
    console.error('Erreur :', err.message);
  }
})();
