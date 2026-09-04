const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const pool = require("../config/db");
const controller = require("../controllers/tinfos.controller");

// Répertoire de stockage physique (Absolu pour éviter les erreurs)
const uploadDir = path.join(__dirname, "../../uploads/TINFOS");

/* =======================
    FONCTION UTILITAIRE : SUPPRESSION DISQUE
======================= */
const deleteFile = (relativeContextPath) => {
    if (!relativeContextPath) return;
    // On nettoie le chemin (enlever le slash au début si présent)
    const cleanPath = relativeContextPath.startsWith('/') ? relativeContextPath.substring(1) : relativeContextPath;
    const absolutePath = path.join(__dirname, "../../", cleanPath);
    
    if (fs.existsSync(absolutePath)) {
        try {
            fs.unlinkSync(absolutePath);
        } catch (err) {
            console.error(`Erreur suppression fichier: ${absolutePath}`, err);
        }
    }
};

/* =======================
    MULTER CONFIGURATION
======================= */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
        // On force l'extension à .jpg si le fichier n'en a pas (cas Flutter Web)
        let ext = path.extname(file.originalname).toLowerCase();
        if (!ext) ext = '.jpg'; 
        cb(null, uniqueSuffix + ext);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedExtensions = /jpeg|jpg|png|webp/;
    const extension = path.extname(file.originalname).toLowerCase();
    
    // On accepte si l'extension est vide (sera géré par filename) ou valide
    const isExtValid = extension === "" || allowedExtensions.test(extension);
    const isMimeValid = allowedExtensions.test(file.mimetype) || file.mimetype === 'application/octet-stream';

    if (isExtValid || isMimeValid) {
        return cb(null, true);
    }
    cb(new Error("Seules les images (jpg, png, webp) sont autorisées !"));
};

const upload = multer({ 
    storage, 
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } 
});

/* =======================
    ROUTES (CRUD)
======================= */

// CREATE : Utilise le contrôleur (Assurez-vous que le contrôleur utilise /uploads/TINFOS)
router.post("/", upload.array("photos", 3), controller.create);

// READ
router.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM tinfos ORDER BY id DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erreur lecture TINFOS" });
    }
});

// UPDATE
router.put("/:id", upload.array("photos", 3), async (req, res) => {
    try {
        const { id } = req.params;
        const { produit } = req.body;
        const files = req.files || [];

        const check = await pool.query("SELECT * FROM tinfos WHERE id=$1", [id]);
        if (check.rowCount === 0) {
            files.forEach(f => deleteFile(`uploads/TINFOS/${f.filename}`));
            return res.status(404).json({ message: "Produit introuvable" });
        }

        const oldData = check.rows[0];
        // On garde les anciens chemins par défaut
        let newPhotos = [oldData.urlphoto1, oldData.urlphoto2, oldData.urlphoto3];

        // Remplacement des photos envoyées
        for (let i = 0; i < files.length; i++) {
            if (newPhotos[i]) deleteFile(newPhotos[i]); // Supprime l'ancien
            newPhotos[i] = `/uploads/TINFOS/${files[i].filename}`; // Nouveau chemin DB
        }

        const result = await pool.query(
            `UPDATE tinfos SET produit=$1, urlphoto1=$2, urlphoto2=$3, urlphoto3=$4 WHERE id=$5 RETURNING *`,
            [produit || oldData.produit, newPhotos[0], newPhotos[1], newPhotos[2], id]
        );

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Erreur UPDATE TINFOS" });
    }
});

// DELETE
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT * FROM tinfos WHERE id=$1", [id]);
        
        if (result.rowCount === 0) return res.status(404).json({ message: "Produit introuvable" });

        const item = result.rows[0];
        deleteFile(item.urlphoto1);
        deleteFile(item.urlphoto2);
        deleteFile(item.urlphoto3);

        await pool.query("DELETE FROM tinfos WHERE id=$1", [id]);
        res.json({ message: "Produit et images supprimés" });
    } catch (err) {
        res.status(500).json({ error: "Erreur DELETE TINFOS" });
    }
});

module.exports = router;