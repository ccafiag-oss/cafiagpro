
/*

// app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan'); // logger simple
require('dotenv').config();

const app = express();

// -----------------------------
// 1) CORS (avant les routes)
// -----------------------------
app.use(cors({
  origin: true, // pour dev ; en prod mettre l'origine exacte
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept'],
  credentials: true
}));

// -----------------------------
// 2) Logger (optionnel mais utile)
// -----------------------------
app.use(morgan('dev'));

// -----------------------------
// 3) Body parsers (avec limites)
// -----------------------------
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// -----------------------------
// 4) Fichiers statiques
//    Assure-toi que ces chemins correspondent
//    exactement à l'endroit où Multer écrit.
//    Si Multer écrit dans src/uploads, utilise 'src'.
// -----------------------------
const uploadsRoot = path.join(__dirname, 'src', 'uploads', 'clients'); // <-- ajuste si nécessaire
const photoDir = path.join(uploadsRoot, 'photo');
const signatureDir = path.join(uploadsRoot, 'signature');

// Expose les dossiers statiques via des routes claires
app.use('/uploads/clients/photo', express.static(photoDir));
app.use('/uploads/clients/signature', express.static(signatureDir));

// Exemple supplémentaire (TINFOS)
app.use('/uploads/TINFOS', express.static(path.join(__dirname, 'uploads', 'TINFOS')));

// Exemple dossier photo utilisateur (chemin absolu configurable via .env)
const photoUserDir = process.env.PHOTOUSER_DIR || path.join(__dirname, 'uploads', 'PHOTOUSER');
app.use('/PHOTOUSER', express.static(photoUserDir));

// -----------------------------
// 5) Routes API
//    Importer après la configuration statique
// -----------------------------
const utilisateurRoutes = require('./src/routes/utilisateur.routes');
const agenceRoutes = require('./src/routes/agence.routes');
const rolesRoutes = require('./src/routes/roles.routes');
const serviceRoutes = require('./src/routes/service.routes');
const listeutilisateurRoutes = require('./src/routes/listeuser.routes');
const tinfosRoutes = require('./src/routes/tinfos.routes');
const authroutes = require('./src/routes/auth.routes');

const operationRoutes = require('./src/routes/operationRoutes');
const clientRoutes = require('./src/routes/client.routes'); // attention au nom du fichier

// Déclaration des routes
app.use('/api/clients', clientRoutes);
app.use('/api/operation', operationRoutes);
app.use('/api/auth', authroutes);
app.use('/api/agences', agenceRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/listeutilisateur', listeutilisateurRoutes);
app.use('/api/tinfos', tinfosRoutes);
app.use('/api/utilisateurs', utilisateurRoutes);

// -----------------------------
// 6) Health check & 404
// -----------------------------
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Gestion simple des routes non trouvées
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Route non trouvée' });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message || err });
});

// -----------------------------
// 7) Démarrage du serveur
// -----------------------------
const PORT = process.env.PORT || 5265;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on http://${getLocalIp()}:${PORT}`);
});

// Helper pour afficher l'IP locale (utile pour debug réseau)
function getLocalIp() {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

module.exports = app;

*/













// app.js
const express = require('express');

const http = require('http'); // Obligatoire pour Socket.io
const { Server } = require('socket.io'); // Import de Socket.io


const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// 1. ACTIVER LE CORS (DOIT ÊTRE AVANT LES ROUTES)
app.use(cors({
  origin: true,            // autorise toutes origines (pour dev). En prod, remplacer par une origine précise.
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept'],
  credentials: true
}));

// 2. MIDDLEWARES DE PARSING
app.use(express.json());
app.use(express.urlencoded({ extended: true }));










// 1. Créer le serveur HTTP en utilisant l'instance Express
const server = http.createServer(app);

// 2. Initialiser Socket.io sur ce serveur
const io = new Server(server, {
  cors: {
    origin: "*", // Autorise les connexions de votre app Flutter
    methods: ["GET", "POST"]
  }
});

// --- Vos routes existantes ---
///const chatRoutes = require('./src/routes/chat.routes');
///app.use('/api/chat', chatRoutes);

// --- LA LOGIQUE PRIVÉE (Ligne 126) ---
// Maintenant 'io' est défini et ne causera plus d'erreur
io.on('connection', (socket) => {
  console.log('Un utilisateur connecté:', socket.id);

  socket.on('register', (phone) => {
    socket.join(phone); // L'utilisateur rejoint sa chambre privée
    console.log(`Numéro ${phone} enregistré dans sa room.`);
  });

  socket.on('sendMessage', (data) => {
    // Envoi ciblé au destinataire uniquement
    io.to(data.receiver).emit('receiveMessage', data);
  });

  socket.on('disconnect', () => {
    console.log('Utilisateur déconnecté');
  });
});











// 3. SERVIR LES FICHIERS STATIQUES (PHOTOS)
// Utiliser path.join pour construire les chemins de façon portable
// Exemple : dossier uploads/TINFOS dans le projet
app.use('/uploads/TINFOS', express.static(path.join(__dirname, 'uploads', 'TINFOS')));

// Exemple : dossier photo utilisateur sur disque (chemin absolu Windows)
const photoUserDir = process.env.PHOTOUSER_DIR || 'C:/CAFIAG/CAFIAG_CREDIVENTE/PHOTOUSER';
app.use('/PHOTOUSER', express.static(photoUserDir));

// 4. ROUTES API (après activation CORS)
const utilisateurRoutes = require('./src/routes/utilisateur.routes');
const agenceRoutes = require('./src/routes/agence.routes');
const rolesRoutes = require('./src/routes/roles.routes');
const serviceRoutes = require('./src/routes/service.routes');
const listeutilisateurRoutes = require('./src/routes/listeuser.routes');
const tinfosRoutes = require('./src/routes/tinfos.routes');
const authroutes = require('./src/routes/auth.routes');

const operationRoutes = require('./src/routes/operationRoutes');

const Listecomptegenroutes = require('./src/routes/Listecomptegen.routes');
const compteTiersroutes = require('./src/routes/compteTiers.routes');
///const clientRoutes = require('./src/routes/client.routes');

///const listeclientsRoutes = require('./src/routes/listeclients.route');
const listetypesoperationroutes = require('./src/routes/listetypesoperation.routes');

const listeparametregstockroutes = require('./src/routes/listeparametregstock.routes');

const OPenregistrerDepotavanceroutes = require('./src/routes/OPenregistrerDepotavance.routes');





const articleRoutes = require('./src/routes/article.routes');

const OuverturecomptetiersRoutes = require('./src/routes/OuverturecomptetiersRoutes');



const Modepaiements = require('./src/routes/Modepaiements');
const Optionsalerte = require('./src/routes/Optionsalerte');
const Demandecredit = require('./src/routes/Demandecredit');


const Listemodepaiementroute = require('./src/routes/Listemodepaiement.route');
const Listeoptionalerteroute = require('./src/routes/Listeoptionalerte.route');

const ListeDemandecreditroutes = require('./src/routes/ListeDemandecredit.routes');


const  Decaissementcreditroutes= require('./src/routes/Decaissementcredit.routes');
const  remboursementroutes= require('./src/routes/remboursement.routes');






const  listedecaissementencoursroutes= require('./src/routes/listedecaissementencours.routes');

app.use('/api',listedecaissementencoursroutes);




const  miseajourserembmobilmoneyroutes= require('./src/routes/miseajourserembmobilmoney.routes');

app.use('/api',miseajourserembmobilmoneyroutes);



const  listejournalroutes= require('./src/routes/listejournal.routes');

app.use('/api',listejournalroutes);


const  listeoperateurmobileroute= require('./src/routes/listeoperateurmobile.route');

app.use('/api',listeoperateurmobileroute);


const  fraisoperationmobileroutes= require('./src/routes/fraisoperationmobile.routes');

app.use('/api',fraisoperationmobileroutes);





const  saisieecriturecomptaroutes= require('./src/routes/saisieecriturecompta.routes');

app.use('/api',saisieecriturecomptaroutes);



const  listefraismobileroutes= require('./src/routes/listefraismobile.routes');

app.use('/api',listefraismobileroutes);





const  echeanceencoursroutes= require('./src/routes/echeanceencours.routes');

app.use('/api',echeanceencoursroutes);




const  transfertentrecaisseroutes= require('./src/routes/transfertentrecaisse.routes');

app.use('/api/transferer',transfertentrecaisseroutes);








const  listeremboursementencoursroutes= require('./src/routes/listeremboursementencours.routes');

app.use('/api/remboursementencours',listeremboursementencoursroutes);




const  listelangueroutes= require('./src/routes/listelangue.routes');

app.use('/api/langues',listelangueroutes);




const annulationmobilemoneyroutes = require('./src/routes/annulationmobilemoney.routes');
app.use('/api', annulationmobilemoneyroutes);



const ouvrireagenceroutes = require('./src/routes/ouvrireagence.routes');
app.use('/api', ouvrireagenceroutes);






const miseajoursdecaissementroutes = require('./src/routes/miseajoursdecaissement.routes');
app.use('/api', miseajoursdecaissementroutes);


const miseajoursecheanceroutes = require('./src/routes/miseajoursecheance.routes');
app.use('/api', miseajoursecheanceroutes);





const tradutionlanguesroutes = require('./src/routes/tradutionlangues.routes');
app.use('/api', tradutionlanguesroutes);





const chatRoutes = require('./src/routes/chat.routes');
app.use('/api/chat', chatRoutes);



const  ouverturecompteutilisateurroutes= require('./src/routes/ouverturecompteutilisateur.routes');

app.use('/api',ouverturecompteutilisateurroutes);






const  listepaysroutes= require('./src/routes/listepays.routes');

app.use('/api/pays',listepaysroutes);




const  remboursementmobilmoneyroutes= require('./src/routes/remboursementmobilmoney.routes');

app.use('/api',remboursementmobilmoneyroutes);







const  dasbordindicateurroutes= require('./src/routes/dasbordindicateur.routes');

app.use('/api',dasbordindicateurroutes);









const  listeecheancerembRoutes= require('./src/routes/listeecheanceremb.routes');

app.use('/api/echeance',listeecheancerembRoutes);



app.use('/api/decaissementcredit',Decaissementcreditroutes);





app.use('/api',remboursementroutes);





app.use('/api/modepaiements', Listemodepaiementroute);
app.use('/api/optionsalerte', Listeoptionalerteroute);

app.use('/api/listedemandecredit', ListeDemandecreditroutes);




app.use('/api', Modepaiements);
app.use('/api', Optionsalerte);
app.use('/api', Demandecredit);




app.use('/api/toperation', OPenregistrerDepotavanceroutes);

app.use('/api/idparm', listeparametregstockroutes);
app.use('/api/typesop', listetypesoperationroutes);

app.use('/api/ouvrircomptetiers', OuverturecomptetiersRoutes);


app.use('/api/articles', articleRoutes);



app.use('/api/compte-tiers', compteTiersroutes);
app.use('/api/compte', Listecomptegenroutes);





app.use('/uploads/clients/photo', express.static(path.join(__dirname, 'src', 'uploads', 'clients', 'photo')));
app.use('/uploads/clients/signature', express.static(path.join(__dirname, 'src', 'uploads', 'clients', 'signature')));

const clientRoutes = require('./src/routes/client.routes');
app.use('/api/clients', clientRoutes);







const Habillitationroutes = require('./src/routes/Habillitation.routes');
app.use('/api', Habillitationroutes);


const logicielroutes = require('./src/routes/logiciel.routes');
app.use('/api', logicielroutes);


const societe_logicielroutes = require('./src/routes/societe_logiciel.routes');
app.use('/api', societe_logicielroutes);

const utilisateur_agenceroutes = require('./src/routes/utilisateur_agence.routes');
app.use('/api', utilisateur_agenceroutes);




// Servir dossiers statiques (assure-toi que ces chemins existent)
///app.use('/uploads/clients/photo', express.static(path.join(__dirname, 'uploads', 'clients', 'photo')));
///app.use('/uploads/clients/signature', express.static(path.join(__dirname, 'uploads', 'clients', 'signature')));

// Déclaration des routes (assure-toi d'importer clientRoutes)
///const clientRoutes = require('./src/routes/clients.route');
///app.use('/api/clients', clientRoutes);

// ... autres routes et démarrage du serveur





app.use('/api/operation', operationRoutes);
app.use('/api/auth', authroutes);
app.use('/api/agences', agenceRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/listeutilisateur', listeutilisateurRoutes);
app.use('/api/tinfos', tinfosRoutes);
app.use('/api/utilisateurs', utilisateurRoutes);




///     PARTIE   SERVICE GO

const servicgoroutes = require('./src/routesservicego/servicgo.routes');
app.use('/api', servicgoroutes);








///  FIN PARTIE  SERVICE  GO



///  DEBUT PARTIE  NOTES


const Notespageroutes = require('./src/routesnoteplus/Notespage.routes');
app.use('/api', Notespageroutes);


///  FIN PARTIE  NOTES




///  DEBUT PARTIE  RH
const rh_serviceroutes = require('./src/routesrh/rh_service.routes');
app.use('/api', rh_serviceroutes);


///const Notespageroutes = require('./src/routesnoteplus/Notespage.routes');
///app.use('/api', Notespageroutes);


///  FIN PARTIE  RH

///     PARTIE   GSTOCK

///////////////////////////////////////////////////////////////////////



const grgachatmiseajoursroutes = require('./src/routesgstock/grgachatmiseajours.routes');
app.use('/api', grgachatmiseajoursroutes);

const grgventemiseajoursroutes = require('./src/routesgstock/grgventemiseajours.routes');
app.use('/api', grgventemiseajoursroutes);

const gtypescomptesroutes = require('./src/routesgstock/gtypescomptes.routes');
app.use('/api', gtypescomptesroutes);

const gsaisieoperationdiverscomptaroutes = require('./src/routesgstock/gsaisieoperationdiverscompta.routes');
app.use('/api', gsaisieoperationdiverscomptaroutes);

const gtjournalroutes = require('./src/routesgstock/gtjournal.routes');
app.use('/api', gtjournalroutes);


const grsupportvideoroutes = require('./src/routesgstock/grsupportvideo.routes');
app.use('/api', grsupportvideoroutes);


const grrubrique_tresoreroutes = require('./src/routesgstock/grrubrique_tresore.routes');
app.use('/api', grrubrique_tresoreroutes);


const grcabmodepaiementroutes = require('./src/routesgstock/grcabmodepaiement.routes');
app.use('/api', grcabmodepaiementroutes);


const grtcomptegeninterroutes = require('./src/routesgstock/grtcomptegeninter.routes');
app.use('/api', grtcomptegeninterroutes);


const gruserSessionsroutes = require('./src/routesgstock/gruserSessions.routes');
app.use('/api', gruserSessionsroutes);

const backup = require('./src/routesgstock/backup');
app.use('/api', backup);


const  grgcategorieroutes= require('./src/routesgstock/grgcategorie.routes');

app.use('/api',grgcategorieroutes);

const  grgsouscategorieroutes= require('./src/routesgstock/grgsouscategorie.routes');

app.use('/api',grgsouscategorieroutes);

const  grgsouscategoriedetailroutes= require('./src/routesgstock/grgsouscategoriedetail.routes');

app.use('/api',grgsouscategoriedetailroutes);



const  grgtypesmesureroutes= require('./src/routesgstock/grgtypesmesure.routes');

app.use('/api',grgtypesmesureroutes);


const  grguniteroutes= require('./src/routesgstock/grgunite.routes');

app.use('/api',grguniteroutes);



const  grgdepotroutes= require('./src/routesgstock/grgdepot.routes');

app.use('/api',grgdepotroutes);


const  grgarticleroutes= require('./src/routesgstock/grgarticle.routes');

app.use('/api',grgarticleroutes);

const  grttypesclientroutes= require('./src/routesgstock/grttypesclient.routes');

app.use('/api',grttypesclientroutes);


const  grttypescligrttypesfournisseurroutes= require('./src/routesgstock/grttypesfournisseur.routes');

app.use('/api',grttypescligrttypesfournisseurroutes);



const  grgclientsroutes= require('./src/routesgstock/grgclients.routes');

app.use('/api',grgclientsroutes);

const  grges_agent_commercialroutes= require('./src/routesgstock/grges_agent_commercial.routes');

app.use('/api',grges_agent_commercialroutes);

const  grgfournisseurroutes= require('./src/routesgstock/grgfournisseur.routes');

app.use('/api',grgfournisseurroutes);

const grgachatroutes = require('./src/routesgstock/grgachat.routes');
app.use('/api', grgachatroutes);


const ttarifprixachatroutes = require('./src/routesgstock/ttarifprixachat.routes');
app.use('/api', ttarifprixachatroutes);


const ttarifprixventeroutes = require('./src/routesgstock/ttarifprixvente.routes');
app.use('/api', ttarifprixventeroutes);

const grcomptabilisationroutes = require('./src/routesgstock/grcomptabilisation.routes');
app.use('/api', grcomptabilisationroutes);

const grgventeroutes = require('./src/routesgstock/grgvente.routes');
app.use('/api', grgventeroutes);


const grgreglementroutes = require('./src/routesgstock/grgreglement.routes');
app.use('/api', grgreglementroutes);


const tarifproduitprixremiseroutes = require('./src/routesgstock/tarifproduitprixremise.routes');
app.use('/api', tarifproduitprixremiseroutes);


const grallgetroutes = require('./src/routesgstock/grallget.routes');
app.use('/api', grallgetroutes);


const grficheinventaireroutes = require('./src/routesgstock/grficheinventaire.routes');
app.use('/api', grficheinventaireroutes);


const grinventairestockroutes = require('./src/routesgstock/grinventairestock.routes');
app.use('/api', grinventairestockroutes);


const gtransfertstockroutes = require('./src/routesgstock/gtransfertstock.routes');
app.use('/api', gtransfertstockroutes);

const gtransfertstocklotroutes = require('./src/routesgstock/gtransfertstocklot.routes');
app.use('/api', gtransfertstocklotroutes);








// Dans app.js ou index.js
app.use('/uploads', express.static(path.join(__dirname, 'src/uploads')));




///    FIN  PARTIE   GSTOCK  ///////////////////////////////////////////////////////////


///   DEBUT  PARTIE  ECO GESTION //////////////////////////////////////////////////////



const eco_annee_scolaireroutes = require('./src/routesecogestion/eco_annee_scolaire.routes');
app.use('/api', eco_annee_scolaireroutes);


const eco_trimestreroutes = require('./src/routesecogestion/eco_trimestre.routes');
app.use('/api', eco_trimestreroutes);

const eco_periodetrimestreroutes = require('./src/routesecogestion/eco_periodetrimestre.routes');
app.use('/api', eco_periodetrimestreroutes);

const eco_quartierroutes = require('./src/routesecogestion/eco_quartier.routes');
app.use('/api', eco_quartierroutes);

const eco_villeroutes = require('./src/routesecogestion/eco_ville.routes');
app.use('/api', eco_villeroutes);

const eco_nationaliteroutes = require('./src/routesecogestion/eco_nationalite.routes');
app.use('/api', eco_nationaliteroutes);

const eco_statusroutes = require('./src/routesecogestion/eco_status.routes');
app.use('/api', eco_statusroutes);


const eco_typenoteroutes = require('./src/routesecogestion/eco_typenote.routes');
app.use('/api', eco_typenoteroutes);

const eco_typeepreuveroutes = require('./src/routesecogestion/eco_typeepreuve.routes');
app.use('/api', eco_typeepreuveroutes);

const eco_serieroutes = require('./src/routesecogestion/eco_serie.routes');
app.use('/api', eco_serieroutes);

const eco_parcoursroutes = require('./src/routesecogestion/eco_parcours.routes');
app.use('/api', eco_parcoursroutes);

const eco_matiereroutes = require('./src/routesecogestion/eco_matiere.routes');
app.use('/api', eco_matiereroutes);


const eco_enseignantroutes = require('./src/routesecogestion/eco_enseignant.routes');
app.use('/api', eco_enseignantroutes);


const eco_classeroutes = require('./src/routesecogestion/eco_classe.routes');
app.use('/api', eco_classeroutes);

const eco_joursemaineroutes = require('./src/routesecogestion/eco_joursemaine.routes');
app.use('/api', eco_joursemaineroutes);

const eco_matiereparclasseroutes = require('./src/routesecogestion/eco_matiereparclasse.routes');
app.use('/api', eco_matiereparclasseroutes);

const eco_eleveroutes = require('./src/routesecogestion/eco_eleve.routes');
app.use('/api', eco_eleveroutes);

const eco_inscriptioneleveroutes = require('./src/routesecogestion/eco_inscriptioneleve.routes');
app.use('/api', eco_inscriptioneleveroutes);

const eco_noteroutes = require('./src/routesecogestion/eco_note.routes');
app.use('/api', eco_noteroutes);

const eco_bulletinroutes = require('./src/routesecogestion/eco_bulletin.routes');
app.use('/api', eco_bulletinroutes);




////  FIN  PARTIE  ECO GESTION ///////////////////////////////////////////////////////////

///    DEBUT   PARTIE    SANTE





const saoperationdiversMiseajourroutes = require('./src/routessante/saoperationdiversMiseajour.routes');
app.use('/api', saoperationdiversMiseajourroutes);

const slotroutes = require('./src/routessante/slot.routes');
app.use('/api', slotroutes);

const s_tauxroutes = require('./src/routessante/s_taux.routes');
app.use('/api', s_tauxroutes);

const sassureurroutes = require('./src/routessante/sassureur.routes');
app.use('/api', sassureurroutes);

const saoperationdiversroutes = require('./src/routessante/saoperationdivers.routes');
app.use('/api', saoperationdiversroutes);

const santeallgetroutes = require('./src/routessante/santeallget.routes');
app.use('/api', santeallgetroutes);

const sgreglementassuranceroutes = require('./src/routessante/sgreglementassurance.routes');
app.use('/api', sgreglementassuranceroutes);

const grinventairestocklotroutes = require('./src/routesgstock/grinventairestocklot.routes');
app.use('/api', grinventairestocklotroutes);

////////////// FIN   PARTIE   SANTE //////////////////////////////









///  DEBUT  PARTIE  agrogesfarm ///////////////////////////////////////////////////////


const agro_utilisateur_depotroutes= require('./src/routesagrogesfarm/agro_utilisateur_depot.routes');
app.use('/api', agro_utilisateur_depotroutes);

const agro_remboursementroutes= require('./src/routesagrogesfarm/agro_remboursement.routes');
app.use('/api', agro_remboursementroutes);

const agro_decaissement_financementroutes= require('./src/routesagrogesfarm/agro_decaissement_financement.routes');
app.use('/api', agro_decaissement_financementroutes);

const agro_demande_financementroutes= require('./src/routesagrogesfarm/agro_demande_financement.routes');
app.use('/api', agro_demande_financementroutes);

const agro_campagne_visiteroutes= require('./src/routesagrogesfarm/agro_campagne_visite.routes');
app.use('/api', agro_campagne_visiteroutes);

const agro_gestion_campagneroutes= require('./src/routesagrogesfarm/agro_gestion_campagne.routes');
app.use('/api', agro_gestion_campagneroutes);


const agro_gescooperativeroutes= require('./src/routesagrogesfarm/agro_gescooperative.routes');
app.use('/api', agro_gescooperativeroutes);


const agro_campagneroutes= require('./src/routesagrogesfarm/agro_campagne.routes');
app.use('/api', agro_campagneroutes);


const agro_produit_financeroutes= require('./src/routesagrogesfarm/agro_produit_finance.routes');
app.use('/api', agro_produit_financeroutes);

const agro_categorie_bienroutes= require('./src/routesagrogesfarm/agro_categorie_bien.routes');
app.use('/api', agro_categorie_bienroutes);

const agro_statut_bienroutes= require('./src/routesagrogesfarm/agro_statut_bien.routes');
app.use('/api', agro_statut_bienroutes);

const agro_bienroutes= require('./src/routesagrogesfarm/agro_bien.routes');
app.use('/api', agro_bienroutes);

const agro_types_operationroutes= require('./src/routesagrogesfarm/agro_types_operation.routes');
app.use('/api', agro_types_operationroutes);

const agro_bon_caisseroutes= require('./src/routesagrogesfarm/agro_bon_caisse.routes');
app.use('/api', agro_bon_caisseroutes);

















///    FIN  PARTIE   agrogesfarm  ///////////////////////////////////////////////////////////
























///  DEBUT  PARTIE  FINANCE ///////////////////////////////////////////////////////

const produitepargneroutes = require('./src/routesfina/produitepargne.routes');
app.use('/api/produitepargne', produitepargneroutes);


const pieceidentiteroutes= require('./src/routesfina/pieceidentite.routes');
app.use('/api', pieceidentiteroutes);


const finaclientsroutes = require('./src/routesfina/finaclients.routes');
app.use('/api', finaclientsroutes);



const fina_objetcreditroutes = require('./src/routesfina/fina_objetcredit.routes');
app.use('/api', fina_objetcreditroutes);

const fina_credit_demanderoutes = require('./src/routesfina/fina_credit_demande.routes');
app.use('/api', fina_credit_demanderoutes);

const cautioncreditroutes = require('./src/routesfina/cautioncredit.routes');
app.use('/api', cautioncreditroutes);

const fina_demande_credit_visiteroutes = require('./src/routesfina/fina_demande_credit_visite.routes');
app.use('/api', fina_demande_credit_visiteroutes);


const finarubriquecompteexploitationroutes = require('./src/routesfina/finarubriquecompteexploitation.routes');
app.use('/api', finarubriquecompteexploitationroutes);

const fina_compteexploitationroutes = require('./src/routesfina/fina_compteexploitation.routes');
app.use('/api', fina_compteexploitationroutes);

const fina_comiteTyperoutes = require('./src/routesfina/fina_comiteType.routes');
app.use('/api', fina_comiteTyperoutes);


const fina_comiteMembreroutes = require('./src/routesfina/fina_comiteMembre.routes');
app.use('/api', fina_comiteMembreroutes);

const fina_comiteSessionroutes = require('./src/routesfina/fina_comiteSession.routes');
app.use('/api', fina_comiteSessionroutes);


const fina_credit_decaissementroutes = require('./src/routesfina/fina_credit_decaissement.routes');
app.use('/api', fina_credit_decaissementroutes);

const fina_remboursementroutes = require('./src/routesfina/fina_remboursement.routes');
app.use('/api', fina_remboursementroutes);

const fina_finalogoagenceroutes = require('./src/routesfina/fina_finalogoagence.routes');
app.use('/api', fina_finalogoagenceroutes);

const fina_modelOperationroutes = require('./src/routesfina/fina_modelOperation.routes');
app.use('/api', fina_modelOperationroutes);

const fina_saisie_operationdiversroutes = require('./src/routesfina/fina_saisie_operationdivers.routes');
app.use('/api', fina_saisie_operationdiversroutes);

const fina_transfertcaisseroutes = require('./src/routesfina/fina_transfertcaisse.routes');
app.use('/api', fina_transfertcaisseroutes);


const fina_import_plancomptablegeneralroutes = require('./src/routesfina/fina_import_plancomptablegeneral.routes');
app.use('/api', fina_import_plancomptablegeneralroutes);



const fina_cooperativeroutes = require('./src/routesfina/fina_cooperative.routes');
app.use('/api', fina_cooperativeroutes);







const structurevuesroutes = require('./src/routesfina/structurevues.routes');
app.use('/api', structurevuesroutes);


const caisseUtilisateurroutes = require('./src/routesfina/caisseUtilisateur.routes');
app.use('/api', caisseUtilisateurroutes);


const finaclientcomptesroutes = require('./src/routesfina/finaclientcomptes.routes');
app.use('/api', finaclientcomptesroutes);

const fina_carnet_tontineroutes = require('./src/routesfina/fina_carnet_tontine.routes');
app.use('/api', fina_carnet_tontineroutes);

const fina_typescarnetroutes = require('./src/routesfina/fina_typescarnet.routes');
app.use('/api', fina_typescarnetroutes);


const operationTontineroutes = require('./src/routesfina/operationTontine.routes');
app.use('/api', operationTontineroutes);

const fina_operation_epargneroutes = require('./src/routesfina/fina_operation_epargne.routes');
app.use('/api', fina_operation_epargneroutes);






















///  FIN  PARTIE   FINANCE  ////////////////////////////////////////////////////////













///app.use('/api/listeclients', listeclientsRoutes);


// 5. HEALTH CHECK
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 6. DEMARRAGE DU SERVEUR
const PORT = process.env.PORT || 5265;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on http://${getLocalIp()}:${PORT}`);
});

// Helper pour afficher l'IP locale (utile pour debug réseau)
function getLocalIp() {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

