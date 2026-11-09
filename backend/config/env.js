/**
 * Environment variable validation.
 * Loaded once at startup; crashes early with a clear message if anything is missing.
 */

const required = ['PORT', 'MONGO_URI', 'JWT_SECRET', 'NODE_ENV'];

function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`[env] Missing required environment variables: ${missing.join(', ')}`);
    console.error('[env] In local development: copy backend/.env.example to backend/.env and populate values.');
    console.error('[env] In production (e.g. Render): ensure the following are defined under the Environment tab:');
    if (missing.includes('MONGO_URI')) console.error('[env]   - MONGO_URI: MongoDB Atlas connection string');
    if (missing.includes('JWT_SECRET')) console.error('[env]   - JWT_SECRET: secure secret string');
    if (missing.includes('NODE_ENV')) console.error('[env]   - NODE_ENV: production');
    if (missing.includes('PORT')) console.error('[env]   - PORT: usually assigned automatically by Render');
    process.exit(1);
  }
  const nodeEnv = process.env.NODE_ENV;
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    console.error(`[env] NODE_ENV must be development, production or test (got "${nodeEnv}").`);
    process.exit(1);
  }
}

module.exports = { validateEnv };

