/**
 * Server entry point.
 * Loads environment, connects to the database, initializes Socket.IO, then starts listening.
 */

require('dotenv').config();

const http = require('http');
const { validateEnv } = require('./config/env');
validateEnv();

const { connectDB } = require('./config/db');
const createApp = require('./app');
const { initSocket } = require('./socket');

async function start() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);
  const io = initSocket(server);
  app.set('io', io);

  const PORT = parseInt(process.env.PORT, 10) || 5000;

  server.listen(PORT, () => {
    console.log(`[server] TaskFlow running with WebSockets on port ${PORT} (${process.env.NODE_ENV})`);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[server] Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[server] Uncaught Exception:', err);
  });

  function gracefulShutdown(signal) {
    console.log(`[server] ${signal} received, closing HTTP server`);
    server.close(() => {
      console.log('[server] HTTP server closed cleanly');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

start();
