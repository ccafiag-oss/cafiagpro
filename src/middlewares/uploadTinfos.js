const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadPath = 'C:/CAFIAG/PHOTOUSER/TINFOS/';

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadPath,
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + '_' + Math.round(Math.random() * 1E9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = upload;
