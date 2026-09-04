const pool = require('../config/db');

const getNextOperationCode = async (params) => {
    const {
        idAgence,
        typeOp,
        useYear,
        useMonth,
        useDay,
        idUser,
        includeTypeOp
    } = params;

    try {
        // L'ordre des paramètres doit correspondre exactement à votre procédure PostgreSQL
        const query = `CALL gen_code_operation($1, $2, $3, $4, $5, $6, $7, $8)`;
        
        const values = [
            parseInt(idAgence),
            typeOp,
            useYear === 'true' || useYear === true,
            useMonth === 'true' || useMonth === true,
            useDay === 'true' || useDay === true,
            parseInt(idUser) || 0,
            includeTypeOp === 'true' || includeTypeOp === true,
            null // pour le paramètre INOUT p_new_code
        ];

        const res = await pool.query(query, values);

        if (res.rows && res.rows[0]) {
            return res.rows[0].p_new_code;
        }
        throw new Error("Aucun code généré par la base de données.");
    } catch (error) {
        console.error("Erreur Service CodeOp:", error);
        throw error;
    }
};

module.exports = { getNextOperationCode };