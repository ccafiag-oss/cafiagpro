
// src/config/db.js
const { Pool } = require('pg');
require('dotenv').config();

// Si DATABASE_URL existe (sur Render), on l'utilise en priorité avec SSL obligatoire.
// Sinon, on se replie sur les variables du fichier .env local.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Indispensable pour PostgreSQL sur Render
      },
      connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT, 10) || 60000
    })
  : new Pool({
      user: process.env.PG_USER,
      host: process.env.PG_HOST,
      database: process.env.PG_DATABASE,
      password: String(process.env.PG_PASSWORD),
      port: parseInt(process.env.PG_PORT, 10) || 5432,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT, 10) || 60000
    });

pool.on('connect', () => console.log('✅ Connected to PostgreSQL'));
pool.on('error', (err) => console.error('❌ PostgreSQL error', err));

// 🔹 EXPORT DIRECT
module.exports = pool;