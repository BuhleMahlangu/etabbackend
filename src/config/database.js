const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased from 2000ms to 10000ms (10 seconds)
  // Add keepalive to prevent connection drops
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('connect', (client) => {
  console.log('[DB] New client connected');
});

pool.on('acquire', (client) => {
  console.log('[DB] Client acquired from pool');
});

pool.on('remove', (client) => {
  console.log('[DB] Client removed from pool');
});

pool.on('error', (err, client) => {
  console.error('[DB] Unexpected database error:', err.message);
});

// Test connection on startup
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('[DB] Database connected successfully at:', result.rows[0].now);
    client.release();
  } catch (err) {
    console.error('[DB] Failed to connect to database:', err.message);
  }
};

testConnection();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  // Helper to get a client for transactions
  getClient: async () => {
    const client = await pool.connect();
    return client;
  }
};
