const multer = require('multer');
const path = require('path');
const fs = require('fs');

// dossier pour stocker les photos
const uploadPath = "C:/CAFIAG/CAFIAG_CREDIVENTE/photouser";

// créer le dossier si inexistant
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// configuration multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}_${file.fieldname}${ext}`;
    cb(null, filename);
  }
});

module.exports = multer({ storage });
