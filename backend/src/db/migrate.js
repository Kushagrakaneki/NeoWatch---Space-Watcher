// Database migrations! This is how I set up the tables in PostgreSQL.
// I'm learning that migrations create the database structure.
const { pool } = require('./index');

async function migrate() {
  // Get a database connection
  const client = await pool.connect();
  try {
    // Start a transaction - if anything fails, it all gets rolled back
    await client.query('BEGIN');

    // Main asteroids table - stores all the asteroid data from NASA
    await client.query(`
      CREATE TABLE IF NOT EXISTS asteroids (
        id VARCHAR(50) PRIMARY KEY,  -- NASA's unique ID for each asteroid
        name VARCHAR(255) NOT NULL,  -- The asteroid's name
        nasa_jpl_url TEXT,  -- Link to NASA's detailed page
        absolute_magnitude DECIMAL(8,4),  -- How bright the asteroid is
        estimated_diameter_min_km DECIMAL(12,6),  -- Smallest size estimate
        estimated_diameter_max_km DECIMAL(12,6),  -- Largest size estimate
        is_potentially_hazardous BOOLEAN DEFAULT false,  -- NASA's PHA flag
        close_approach_date DATE,  -- When it passes closest to Earth
        close_approach_date_full TIMESTAMP,  -- More precise timestamp
        relative_velocity_kph DECIMAL(15,4),  -- How fast it's moving towards us
        miss_distance_km DECIMAL(20,4),  -- How close it gets in kilometers
        miss_distance_lunar DECIMAL(15,4),  -- Distance in lunar distances
        orbiting_body VARCHAR(50),  -- Usually "Earth"
        threat_score INTEGER DEFAULT 0,  -- My calculated threat level (0-100)
        threat_level VARCHAR(20) DEFAULT 'LOW',  -- LOW, MEDIUM, HIGH, CRITICAL
        first_seen_at TIMESTAMP DEFAULT NOW(),  -- When I first added this asteroid
        last_updated_at TIMESTAMP DEFAULT NOW()  -- Last time I updated the data
      )
    `);

    // Table for people who want email alerts about dangerous asteroids
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_subscriptions (
        id SERIAL PRIMARY KEY,  -- Auto-incrementing ID
        email VARCHAR(255) UNIQUE NOT NULL,  -- Their email address
        min_threat_level VARCHAR(20) DEFAULT 'HIGH',  -- Minimum threat level to alert on
        min_threat_score INTEGER DEFAULT 70,  -- Minimum score to alert on
        is_active BOOLEAN DEFAULT true,  -- Whether they still want alerts
        created_at TIMESTAMP DEFAULT NOW(),  -- When they subscribed
        last_alerted_at TIMESTAMP  -- Last time I sent them an alert
      )
    `);

    // Keep track of all the alerts I've sent
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_history (
        id SERIAL PRIMARY KEY,
        asteroid_id VARCHAR(50) REFERENCES asteroids(id),  -- Which asteroid
        subscription_id INTEGER REFERENCES alert_subscriptions(id),  -- Which subscriber
        threat_score INTEGER,  -- The threat score at the time
        sent_at TIMESTAMP DEFAULT NOW(),  -- When I sent the email
        email_status VARCHAR(20) DEFAULT 'SENT'  -- Whether it was delivered
      )
      )
    `);

    // Log every time I fetch data from NASA, so I can track what's happening
    await client.query(`
      CREATE TABLE IF NOT EXISTS fetch_logs (
        id SERIAL PRIMARY KEY,
        fetched_at TIMESTAMP DEFAULT NOW(),  -- When I ran the fetch
        asteroids_fetched INTEGER,  -- How many asteroids NASA gave me
        new_asteroids INTEGER,  -- How many were new to my database
        high_threat_count INTEGER,  -- How many were high threat
        status VARCHAR(20) DEFAULT 'SUCCESS',  -- Did it work?
        error_message TEXT  -- If it failed, what went wrong
      )
    `);

    // Add some indexes to make queries faster. I'm learning that indexes speed up searches.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_asteroids_threat_score ON asteroids(threat_score DESC);
      CREATE INDEX IF NOT EXISTS idx_asteroids_close_approach ON asteroids(close_approach_date);
      CREATE INDEX IF NOT EXISTS idx_asteroids_hazardous ON asteroids(is_potentially_hazardous);
    `);

    // If everything worked, save the changes
    await client.query('COMMIT');
    console.log('✅ Database migration completed successfully');
  } catch (err) {
    // If something went wrong, undo everything
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    // Always clean up the database connection
    client.release();
    await pool.end();
  }
}

// Run the migration when this script is executed
migrate();
