// Learning about databases! This file sets up the connection to PostgreSQL.
// I need dotenv to load the database URL from environment variables
require('dotenv').config();
const { Pool } = require('pg');

// Creating a connection pool so I can reuse database connections instead of opening new ones each time
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Timeout for getting a connection
});

// If something goes wrong with the database, log it
pool.on('error', (err) => {
  console.error('Unexpected DB client error:', err);
});

// Export the pool so other files can use it
module.exports = { pool };
