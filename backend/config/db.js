/**
 * MongoDB connection via Mongoose.
 * Never logs the connection string — only the host name on success.
 */

const mongoose = require('mongoose');

async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`[db] Connected to MongoDB (${conn.connection.host})`);
  } catch (err) {
    console.error('[db] Connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { connectDB };

