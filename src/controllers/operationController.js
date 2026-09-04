const operationService = require('../services/operationService');

const generateCode = async (req, res) => {
    try {
        // On récupère tout depuis req.params (car vous avez demandé dans la route)
        const code = await operationService.getNextOperationCode(req.params);
        
        res.status(200).json({
            success: true,
            code: code
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Erreur lors de la génération du code",
            error: error.message
        });
    }
};

module.exports = { generateCode };