// Lazily creates one shared PostgreSQL connection pool.
const { Pool } = require('pg');
const config = require('./config');

let pool;

function getPool() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
      max: 5,
    });
    pool.on('error', (err) => console.error('Unexpected database pool error:', err.message));
  }
  return pool;
}

module.exports = { getPool };
  
