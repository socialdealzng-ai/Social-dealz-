// Starts the real server using the real database.
const config = require('./config');
const { getPool } = require('./db');
const { createApp } = require('./app');
const { createCatalogueRepository } = require('./repositories/catalogueRepository');

const app = createApp({
  catalogue: createCatalogueRepository(),
  pingDb: () => getPool().query('SELECT 1'),
  isProduction: config.env === 'production',
});

const server = app.listen(config.port, () => {
  console.log(`SOCIAL DEALZ listening on port ${config.port} (${config.env})`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down.`);
  server.close(() => {
    getPool()
      .end()
      .catch(() => {})
      .finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
