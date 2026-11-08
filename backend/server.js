/**
 * Server entry point.
 * Loads environment, connects to the database, then starts listening.
 */

require('dotenv').config();

const { validateEnv } = require('./config/env');
validateEnv();

const { connectDB } = require('./config/db');
const createApp = require('./app');

async function start() {
  await connectDB();

  const app = createApp();
  const PORT = parseInt(process.env.PORT, 10) || 5000;

  app.listen(PORT, () => {
    console.log(`[server] TaskFlow running on port ${PORT} (${process.env.NODE_ENV})`);
  });
}

start();

