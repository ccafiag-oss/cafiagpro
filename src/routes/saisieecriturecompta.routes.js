const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/saisieecriscompta', async (req, res) => {
  const client = await pool.connect();

  try {
    const lignes = req.body; 

    if (!Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ error: "Aucune ligne reçue" });
    }

    await client.query('BEGIN');

    const insertMvtt = `
      INSERT INTO tmvttheorique(
        idtmvth, date, codjrl, idcptgn, idtiers, libelle,
        montantdebit, montantcredit, iduser, idmois, idannee,
        codfact, reftiers, idagence, idjrnal, idmouvement, idclient
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *;
    `;

    const results = [];
    for (const ligne of lignes) {
      // Destructuring incluant les nouveaux champs
      const {
        idtmvth, date, codjrl, idcptgn, idtiers, libelle,
        montantdebit, montantcredit, iduser, idmois, idannee,
        codfact, reftiers, idagence, idjrnal, idmouvement, idclient
      } = ligne;

      if (!idtmvth || !date || !codjrl || !libelle) {
        throw new Error("Champs obligatoires manquants dans l'une des lignes");
      }

      // Le tableau doit comporter exactement 17 éléments correspondant aux 17 colonnes
      const values = [
        idtmvth, 
        date, 
        codjrl, 
        idcptgn || null, 
        idtiers || null, 
        libelle,
        parseFloat(montantdebit) || 0, 
        parseFloat(montantcredit) || 0, 
        iduser || null,
        idmois || null, 
        idannee || null, 
        codfact || null,
        reftiers || null, 
        idagence || null,
        idjrnal || null,    // Corrigé: ajout paramètre 15
        idmouvement || null, // Corrigé: ajout paramètre 16
        idclient || null     // Corrigé: ajout paramètre 17
      ];

      const result = await client.query(insertMvtt, values);
      results.push(result.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: "Toutes les écritures enregistrées avec succès",
      mouvements: results
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur transaction:", err.message);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  } finally {
    client.release();
  }
});







router.get('/rapport/ecritures-comptables', async (req, res) => {
  const { idagence, datedebut, datefin, idjrnal } = req.query;

  if (!idagence || !datedebut || !datefin) {
    return res.status(400).json({ error: 'Paramètres manquants (idagence, datedebut, datefin requis)' });
  }

  try {
    let query = `
      SELECT 
        m.ref_piece,
        m.idcptgn AS compte,
        COALESCE(c.designationcptint, m.idcptgn) AS designation_compte,
        m.idjrnal,
         m.libelle,
        j.codejrnl,
        j.designation AS designation_journal,
        COALESCE(m.montantdebit, 0) AS montant_debit,
        COALESCE(m.montantcredit, 0) AS montant_credit,
        COALESCE(m.codetiers, 'N/A') AS code_tiers,
        COALESCE(c.nomtiers, 'N/A') AS designation_tiers,
        m.date
      FROM tmvttheorique m
      LEFT JOIN tcomptegeninter c ON m.idcptgn = c.idcptintern AND m.idagence = c.idagence
      LEFT JOIN tjournal j ON m.idjrnal = j.id
      WHERE m.idagence = $1 
        AND m.date BETWEEN $2 AND $3
    `;

    const params = [idagence, datedebut, datefin];

    // Filtrage optionnel par journal si spécifié et différent de "tous" (ex: idjrnal != 0 ou 'tous')
    if (idjrnal && idjrnal !== 'tous' && idjrnal !== '0') {
      query += ` AND m.idjrnal = $4`;
      params.push(idjrnal);
    }

    query += ` ORDER BY m.date ASC, m.ref_piece ASC`;

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Erreur génération rapport écritures :', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});




/*
router.post('/saisiegrilleecriscomptablecomplexe', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      idagence,    // string | number  — identifiant agence
      date,        // string ISO       — date de l'opération
      iduser,      // number           — identifiant utilisateur
      idtmvth,     // string           — code/numéro de pièce généré côté Flutter
      codjrl,      // string           — code journal choisi dans la liste (ex: "OPDVS")
      idjrnal,     // number           — id numérique du journal
      ecritures,   // array            — lignes de la grille de saisie
    } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (
      !idagence || !idtmvth || !codjrl ||
      !ecritures || !Array.isArray(ecritures) || ecritures.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Les paramètres idagence, idtmvth, codjrl et le tableau d'écritures sont obligatoires.",
      });
    }

    const d          = date ? new Date(date) : new Date();
    const finalMois  = d.getMonth() + 1;
    const finalAnnee = d.getFullYear();

    // ── Construction de la requête multi-lignes ──────────────────────────────
    const COLUMNS_COUNT = 17;
    const values        = [];

    const placeholders = ecritures.map((_, i) => {
      const o = i * COLUMNS_COUNT;
      return `(
        $${o+1},  $${o+2},  $${o+3},  $${o+4},  $${o+5},
        $${o+6},  $${o+7},  $${o+8},  $${o+9},  $${o+10},
        $${o+11}, $${o+12}, $${o+13}, $${o+14}, $${o+15},
        $${o+16}, $${o+17}
      )`;
    }).join(',');

    const insertQuery = `
      INSERT INTO tmvttheorique (
        idtmvth, date, CODJRL, IDCPTGN, IDTIERS, LIBELLE,
        MONTANTDEBIT, MONTANTCREDIT, IDUSER, IDMOIS, IDANNEE,
        CODFACT, REFTIERS, idagence, idjrnal, idmouvement, idclient
      )
      VALUES ${placeholders}
      RETURNING *
    `;

    // ── Remplissage des valeurs ──────────────────────────────────────────────
    ecritures.forEach((ecriture) => {
      const compte         = ecriture.compte    || '';
      const libelle        = (ecriture.libelle  || 'Saisie manuelle').substring(0, 100);
      const debit          = parseFloat(ecriture.debit)   || 0.0;
      const credit         = parseFloat(ecriture.credit)  || 0.0;
      const codeTiers      = ecriture.codetiers || '0';
      const idTiers        = ecriture.idtiers   ? parseInt(ecriture.idtiers) : null;

      values.push(
        idtmvth,             // $1  — N° pièce (commun à toutes les lignes du lot)
        d,                   // $2  — Date opération
        codjrl,              // $3  — Code journal (reçu directement depuis Flutter)
        compte,              // $4  — Compte général saisi
        codeTiers,           // $5  — Code tiers
        libelle,             // $6  — Libellé de la ligne
        debit,               // $7  — Montant débit
        credit,              // $8  — Montant crédit
        iduser || 0,         // $9  — Utilisateur
        finalMois,           // $10 — Mois
        finalAnnee,          // $11 — Année
        idtmvth,             // $12 — Référence facture (= N° pièce)
        codeTiers || null,   // $13 — Ref tiers
        parseInt(idagence),  // $14 — Agence
        idjrnal || 0,        // $15 — Id numérique du journal (reçu depuis Flutter)
        0,                   // $16 — idmouvement
        idTiers              // $17 — idclient
      );
    });

    // ── Exécution ────────────────────────────────────────────────────────────
    await client.query('BEGIN');
    const result = await client.query(insertQuery, values);
    await client.query('COMMIT');

    return res.status(201).json({
      success : true,
      message : "Grille d'écritures comptables enregistrée avec succès.",
      count   : result.rowCount,
      data    : result.rows,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERREUR INSERTION GRILLE COMPTABLE :', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

*/


router.post('/saisiegrilleecriscomptablecomplexe', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      idagence,    // identifiant agence
      date,        // date de l'opération
      iduser,      // utilisateur
      idtmvth,     // code pièce
      codjrl,      // code journal
      idjrnal,     // id journal
      ecritures,   // tableau des lignes
    } = req.body;

    if (
      !idagence || !idtmvth || !codjrl ||
      !ecritures || !Array.isArray(ecritures) || ecritures.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Les paramètres idagence, idtmvth, codjrl et le tableau d'écritures sont obligatoires.",
      });
    }

    const d = date ? new Date(date) : new Date();

    // ── Colonnes de compta_ecriscomptadetail ────────────────────────────────
    const COLUMNS_COUNT = 17;
    const values        = [];

    const placeholders = ecritures.map((_, i) => {
      const o = i * COLUMNS_COUNT;
      return `(
        $${o+1}, $${o+2}, $${o+3}, $${o+4}, $${o+5},
        $${o+6}, $${o+7}, $${o+8}, $${o+9}, $${o+10},
        $${o+11}, $${o+12}, $${o+13}, $${o+14}, $${o+15},
        $${o+16}, $${o+17}
      )`;
    }).join(',');

    const insertQuery = `
      INSERT INTO compta_ecriscomptadetail (
        codeop, codetypeop, idagence, iduser, idjrnal,
        idmodel, codemodel, datesaisie, idtiers, codetiers,
        montant, libelle, compte, sence, id_immo,
        datevalidation, ref_piece
      )
      VALUES ${placeholders}
      RETURNING *
    `;

    // ── Remplissage des valeurs ─────────────────────────────────────────────
    ecritures.forEach((ecriture) => {
      const compte    = ecriture.compte    || '';
      const libelle   = (ecriture.libelle  || 'Saisie manuelle').substring(0, 100);
      const montant   = parseFloat(ecriture.montant) || 0.0;
      const sence     = ecriture.sence === 'C' ? 'C' : 'D';
      const codeTiers = ecriture.codetiers || '';
      const idTiers   = ecriture.idtiers   ? parseInt(ecriture.idtiers) : 0;

      values.push(
        idtmvth,            // codeop
        codjrl,             // codetypeop
        parseInt(idagence), // idagence
        iduser || 0,        // iduser
        idjrnal || 0,       // idjrnal
        ecriture.idmodel || 0,     // idmodel
        ecriture.codemodel || '',  // codemodel
        d,                  // datesaisie
        idTiers,            // idtiers
        codeTiers,          // codetiers
        montant,            // montant
        libelle,            // libelle
        compte,             // compte
        sence,              // sence
        ecriture.id_immo || 0,      // id_immo
        d,                  // datevalidation
        ecriture.ref_piece || ''    // ref_piece
      );
    });

    await client.query('BEGIN');
    const result = await client.query(insertQuery, values);
    await client.query('COMMIT');

    return res.status(201).json({
      success : true,
      message : "Écritures comptables enregistrées dans compta_ecriscomptadetail.",
      count   : result.rowCount,
      data    : result.rows,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERREUR INSERTION COMPTA DETAIL :', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});







router.put('/saisiegrilleecriscomptablecomplexe/:id', async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;

  try {
    const {
      idagence,
      date,
      iduser,
      idtmvth,     // codeop
      codjrl,      // codetypeop
      idjrnal,
      ecriture,    // une seule ligne ici (objet, pas tableau)
    } = req.body;

    if (!id || !ecriture) {
      return res.status(400).json({
        success: false,
        message: "L'id de la ligne et les données de l'écriture sont obligatoires.",
      });
    }

    const d         = date ? new Date(date) : new Date();
    const compte    = ecriture.compte    || '';
    const libelle   = (ecriture.libelle  || 'Saisie manuelle').substring(0, 100);
    const montant   = parseFloat(ecriture.montant) || 0.0;
    const sence     = ecriture.sence === 'C' ? 'C' : 'D';
    const codeTiers = ecriture.codetiers || '';
    const idTiers   = ecriture.idtiers   ? parseInt(ecriture.idtiers) : 0;

    const updateQuery = `
      UPDATE compta_ecriscomptadetail
      SET
        codeop      = $1,
        codetypeop  = $2,
        idagence    = $3,
        iduser      = $4,
        idjrnal     = $5,
        idmodel     = $6,
        codemodel   = $7,
        datesaisie  = $8,
        idtiers     = $9,
        codetiers   = $10,
        montant     = $11,
        libelle     = $12,
        compte      = $13,
        sence       = $14,
        id_immo     = $15,
        ref_piece   = $16
      WHERE id = $17
      RETURNING *
    `;

    const values = [
      idtmvth,
      codjrl,
      parseInt(idagence),
      iduser || 0,
      idjrnal || 0,
      ecriture.idmodel || 0,
      ecriture.codemodel || '',
      d,
      idTiers,
      codeTiers,
      montant,
      libelle,
      compte,
      sence,
      ecriture.id_immo || 0,
      ecriture.ref_piece || '',
      id,
    ];

    await client.query('BEGIN');
    const result = await client.query(updateQuery, values);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Aucune écriture trouvée avec id=${id}.`,
      });
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success : true,
      message : "Écriture mise à jour, comptabilisation synchronisée par trigger.",
      data    : result.rows[0],
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERREUR UPDATE COMPTA DETAIL :', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});






router.delete('/saisiegrilleecriscomptablecomplexe/:id', async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;

  try {
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "L'id de la ligne à supprimer est obligatoire.",
      });
    }

    const deleteQuery = `
      DELETE FROM compta_ecriscomptadetail
      WHERE id = $1
      RETURNING *
    `;

    await client.query('BEGIN');
    const result = await client.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Aucune écriture trouvée avec id=${id}.`,
      });
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success : true,
      message : "Écriture supprimée, ligne théorique liée supprimée par trigger.",
      data    : result.rows[0],
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERREUR DELETE COMPTA DETAIL :', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});





////  PARTIE  MODIFICATION DE PIECE COMPTABLE



// GET /api/ecriture/parperiode?datedebut=2026-01-01&datefin=2026-06-30&idagence=1
router.get('/ecriture/parperiode', async (req, res) => {
  const client = await pool.connect();
  try {
    const { datedebut, datefin, idagence } = req.query;

    if (!datedebut || !datefin) {
      return res.status(400).json({
        success: false,
        message: "Les paramètres datedebut et datefin sont obligatoires.",
      });
    }

    const params = [datedebut, datefin];
    let agenceFilter = '';
    if (idagence) {
      params.push(idagence);
      agenceFilter = `AND idagence = $${params.length}`;
    }

    const query = `
      SELECT
        ref_piece,
        codeop,
        codetypeop,
        idjrnal,
        idagence,
        iduser,
        datesaisie,
        MAX(libelle)                AS libelle,
        COUNT(*)                    AS nombre_lignes,
        SUM(CASE WHEN sence='D' THEN montant ELSE 0 END) AS total_debit,
        SUM(CASE WHEN sence='C' THEN montant ELSE 0 END) AS total_credit
      FROM compta_ecriscomptadetail
      WHERE datesaisie BETWEEN $1 AND $2
      ${agenceFilter}
      GROUP BY ref_piece, codeop, codetypeop, idjrnal, idagence, iduser, datesaisie
      ORDER BY datesaisie DESC, ref_piece DESC
    `;

    const result = await client.query(query, params);

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });

  } catch (err) {
    console.error('❌ ERREUR LISTE ECRITURE PAR PERIODE :', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});





// GET /api/ecriture/parpiece/:refPiece — récupère toutes les lignes d'une pièce
router.get('/ecriture/parpiece/:refPiece', async (req, res) => {
  const client = await pool.connect();
  try {
    const { refPiece } = req.params;

    const query = `
      SELECT *
      FROM compta_ecriscomptadetail
      WHERE ref_piece = $1
      ORDER BY id ASC
    `;
    const result = await client.query(query, [refPiece]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Aucune ligne trouvée pour la pièce ${refPiece}.`,
      });
    }

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });

  } catch (err) {
    console.error('❌ ERREUR DETAIL PIECE :', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});







// PUT /api/saisiegrilleecriscomptablecomplexe/piece/:refPiece
router.put('/saisiegrilleecriscomptablecomplexe/piece/:refPiece', async (req, res) => {
  const client = await pool.connect();
  const { refPiece } = req.params;

  try {
    const {
      idagence,
      date,
      iduser,
      idtmvth,    // codeop
      codjrl,     // codetypeop
      idjrnal,
      ecritures,  // tableau des lignes
    } = req.body;

    // Validation des données entrantes
    if (
      !idagence || !idtmvth || !codjrl ||
      !ecritures || !Array.isArray(ecritures) || ecritures.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Les paramètres idagence, idtmvth, codjrl et le tableau d'écritures sont obligatoires.",
      });
    }

    const d = date ? new Date(date) : new Date();

    // Fonction utilitaire pour sécuriser les entiers
    const safeInt = (val) => parseInt(val) || 0;

    await client.query('BEGIN');

    // 1. Suppression des anciennes lignes
    await client.query(
      `DELETE FROM compta_ecriscomptadetail WHERE ref_piece = $1`,
      [refPiece]
    );

    // 2. Préparation des placeholders et des valeurs
    const COLUMNS_COUNT = 17;
    const values = [];
    const placeholders = ecritures.map((ecriture, i) => {
      const offset = i * COLUMNS_COUNT;
      
      // Ajout des valeurs pour cette ligne
      values.push(
        idtmvth,
        codjrl,
        safeInt(idagence),
        safeInt(iduser),
        safeInt(idjrnal),
        safeInt(ecriture.idmodel),
        ecriture.codemodel || '',
        d,
        safeInt(ecriture.idtiers),
        ecriture.codetiers || '',
        parseFloat(ecriture.montant) || 0,
        ecriture.libelle || '',
        ecriture.compte || '',
        ecriture.sence || '',
        safeInt(ecriture.id_immo),
        d,
        ecriture.ref_piece || refPiece
      );

      // Création des placeholders ($1, $2, ...)
      return `(${(Array.from({length: COLUMNS_COUNT}, (_, k) => `$${offset + k + 1}`).join(', '))})`;
    }).join(',');

    // 3. Insertion des nouvelles lignes
    const insertQuery = `
      INSERT INTO compta_ecriscomptadetail (
        codeop, codetypeop, idagence, iduser, idjrnal,
        idmodel, codemodel, datesaisie, idtiers, codetiers,
        montant, libelle, compte, sence, id_immo,
        datevalidation, ref_piece
      )
      VALUES ${placeholders}
      RETURNING *
    `;

    const result = await client.query(insertQuery, values);
    
    await client.query('COMMIT');

    return res.status(200).json({
      success : true,
      message : `Pièce ${refPiece} mise à jour (${result.rowCount} ligne(s)).`,
      data    : result.rows,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERREUR UPDATE PIECE :', err);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});







// Dans votre fichier de routes (ex: saisieecriturecompta.routes.js)
router.delete('/saisiegrilleecriscomptablecomplexe/piece/:refPiece', async (req, res) => {
    const { refPiece } = req.params;
    console.log(`[DEBUG] Tentative de suppression de la pièce : ${refPiece}`);
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('DELETE FROM compta_ecriscomptadetail WHERE ref_piece = $1', [refPiece]);
        await client.query('COMMIT');
        
        console.log(`[DEBUG] Suppression réussie. Lignes supprimées : ${result.rowCount}`);
        res.status(200).json({ success: true, message: 'Supprimé' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[ERREUR] Suppression échouée :', err.message); // <--- REGARDEZ ICI DANS LA CONSOLE
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});


module.exports = router;





















/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/saisieecriscompta', async (req, res) => {
  const client = await pool.connect();

  try {
    const lignes = req.body; // tableau envoyé par Flutter

    if (!Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ error: "Aucune ligne reçue" });
    }

    await client.query('BEGIN');

    const insertMvtt = `
      INSERT INTO tmvttheorique(
        idtmvth, date, codjrl, idcptgn, idtiers, libelle,
        montantdebit, montantcredit, iduser, idmois, idannee,
        codfact, reftiers, idagence,idjrnal,idmouvement,idclient
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *;
    `;

    const results = [];
    for (const ligne of lignes) {
      const {
        idtmvth, date, codjrl, idcptgn, idtiers, libelle,
        montantdebit, montantcredit, iduser, idmois, idannee,
        codfact, reftiers, idagence
      } = ligne;

      if (!idtmvth || !date || !codjrl || !libelle) {
        throw new Error("Champs obligatoires manquants");
      }

      const values = [
        idtmvth, date, codjrl, idcptgn || null, idtiers || null, libelle,
        montantdebit || null, montantcredit || null, iduser || null,
        idmois || null, idannee || null, codfact || null,
        reftiers || null, idagence || null
      ];

      const result = await client.query(insertMvtt, values);
      results.push(result.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: "Toutes les écritures enregistrées avec succès",
      mouvements: results
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur transaction:", err.message);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
*/




/*
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/saisieecriscompta', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      idtmvth,
      date,
      codjrl,
      idcptgn,
      idtiers,
      libelle,
      montantdebit,
      montantcredit,
      iduser,
      idmois,
      idannee,
      codfact,
      reftiers,
      idagence
    } = req.body;

    // Vérification des champs obligatoires
    if (!idtmvth || !date || !codjrl || !idtiers || !libelle) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    await client.query('BEGIN'); // 🔥 Début transaction

    const insertMvtt = `
      INSERT INTO tmvttheorique(
        idtmvth,
        date,
        codjrl,
        idcptgn,
        idtiers,
        libelle,
        montantdebit,
        montantcredit,
        iduser,
        idmois,
        idannee,
        codfact,
        reftiers,
        idagence
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *;
    `;

    const values = [
      idtmvth,
      date,
      codjrl,
      idcptgn || null,
      idtiers,
      libelle,
      montantdebit || null,
      montantcredit || null,
      iduser || null,
      idmois || null,
      idannee || null,
      codfact || null,
      reftiers || null,
      idagence || null
    ];

    const result = await client.query(insertMvtt, values);

    await client.query('COMMIT'); // ✅ Valide la transaction

    res.status(201).json({
      message: "Mouvement théorique enregistré avec succès",
      mouvement: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK'); // ❌ Annule tout si erreur
    console.error("Erreur transaction:", err.message);

    res.status(500).json({
      error: "Erreur serveur",
      details: err.message
    });

  } finally {
    client.release();
  }
});

module.exports = router;
*/