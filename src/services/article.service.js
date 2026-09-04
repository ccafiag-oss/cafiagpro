const pool = require('../config/db');

// vérifier existence code article
async function codeArticleExists(codearticle, idarticle = null) {
  let query = `
    SELECT 1 
    FROM article 
    WHERE codearticle = $1
  `;
  const params = [codearticle];

  // cas modification (exclure l'article courant)
  if (idarticle) {
    query += ` AND idarticle <> $2`;
    params.push(idarticle);
  }

  const { rowCount } = await pool.query(query, params);
  return rowCount > 0;
}

// créer article
async function createArticle(data) {
  const {designation,idagence } = data;

  return pool.query(
    `INSERT INTO article (designation, idagence, codearticle)
     VALUES ($1, $2, 'TEMP')
     RETURNING *`,
    [designation, idagence]
  );
}

// modifier article
async function updateArticle(idarticle, data) {
  const { codearticle, designation } = data;

  return pool.query(
    `UPDATE article
     SET codearticle = $1,
         designation = $2
     WHERE idarticle = $3
     RETURNING *`,
    [codearticle, designation, idarticle]
  );
}

// liste articles
async function getArticles(idagence)  {
  return pool.query(
    `SELECT idarticle, codearticle, designation,idagence
     FROM article where idagence=$1
     ORDER BY designation`,
      [idagence]
  );
}

module.exports = {
  codeArticleExists,
  createArticle,
  updateArticle,
  getArticles,
};
