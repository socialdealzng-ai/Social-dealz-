// Reads settings from environment variables. No secrets live in this file.
require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  seedPlaceholders: process.env.SEED_PLACEHOLDERS === 'true',
};
