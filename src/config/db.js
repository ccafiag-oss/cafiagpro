// src/config/db.js
const { Pool } = require('pg');
require('dotenv').config();

console.log("--- DEBUG DATABASE ---");
console.log("DATABASE_URL présente ?", process.env.DATABASE_URL ? "OUI" : "NON");
console.log("Valeur brute :", process.env.DATABASE_URL);
console.log("------------------------");

// Configuration du Pool en fonction de l'environnement (Render ou Local)
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Indispensable pour PostgreSQL sur Render
      },
      connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT, 10) || 60000
    }
  : {
      user: process.env.PG_USER,
      host: process.env.PG_HOST,
      database: process.env.PG_DATABASE,
      password: String(process.env.PG_PASSWORD),
      port: parseInt(process.env.PG_PORT, 10) || 5432,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT, 10) || 60000
    };

const pool = new Pool(poolConfig);

pool.on('connect', () => console.log('✅ Connected to PostgreSQL'));
pool.on('error', (err) => console.error('❌ PostgreSQL error', err));

// 🔹 EXPORT DIRECT
module.exports = pool;