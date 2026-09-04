const pool = require('../config/db');

async function createTinfos(data) {
  const query = `
    INSERT INTO tinfos (produit, urlphoto1, urlphoto2, urlphoto3)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;

  const values = [
    data.produit,
    data.urlphoto1,
    data.urlphoto2,
    data.urlphoto3
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
}

module.exports = { createTinfos };
