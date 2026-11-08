/**
 * Environment variable validation.
 * Loaded once at startup; crashes early with a clear message if anything is missing.
 */

const required = ['PORT', 'MONGO_URI', 'JWT_SECRET', 'NODE_ENV'];

function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`[env] Missing required environment variables: ${missing.join(', ')}`);
    console.error('[env] Copy .env.example to .env and fill in the values.');
    process.exit(1);
  }
  const nodeEnv = process.env.NODE_ENV;
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    console.error(`[env] NODE_ENV must be development, production or test (got "${nodeEnv}").`);
    process.exit(1);
  }
}

module.exports = { validateEnv };

