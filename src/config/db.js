// src/config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: String(process.env.PG_PASSWORD),
  port: parseInt(process.env.PG_PORT, 10),
  ssl: process.env.PG_SSL === 'true',
  connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT, 10)
});

pool.on('connect', () => console.log('✅ Connected to PostgreSQL'));
pool.on('error', (err) => console.error('❌ PostgreSQL error', err));

// 🔹 EXPORT DIRECT
module.exports = pool;
