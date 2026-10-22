// Inserts the labelled placeholder catalogue.
// Runs only when SEED_PLACEHOLDERS=true AND the products table is empty,
// unless you pass --force.
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { getPool } = require('../src/db');

async function main() {
  const force = process.argv.includes('--force');
  if (!force && !config.seedPlaceholders) {
    console.log('Seed skipped: SEED_PLACEHOLDERS is not "true".');
    return;
  }

  const pool = getPool();
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM products');
    if (!force && rows[0].n > 0) {
      console.log('Seed skipped: products table is not empty.');
      return;
    }
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'seeds', '001_placeholder_catalogue.sql'), 'utf8');
    await pool.query(sql);
    console.log('Placeholder catalogue inserted.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
