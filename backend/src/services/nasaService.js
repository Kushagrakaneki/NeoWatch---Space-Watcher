// Learning how to work with NASA's asteroid API!
// This service handles fetching data from NASA's NeoWS (Near Earth Object Web Service)
require('dotenv').config();
const axios = require('axios');
const { pool } = require('../db');
const { calculateThreatScore } = require('./threatScoring');

const NASA_BASE = 'https://api.nasa.gov/neo/rest/v1';

// Function to get asteroid data from NASA for a specific date range
async function fetchAsteroidsFromNASA(startDate, endDate) {
  const params = {
    start_date: startDate,
    end_date: endDate,
    api_key: process.env.NASA_API_KEY || 'DEMO_KEY',  // Use my API key or NASA's demo key
  };

  // Make the HTTP request to NASA's API with a 15 second timeout
  const response = await axios.get(`${NASA_BASE}/feed`, { params, timeout: 15000 });
  return response.data;
}

// Convert NASA's raw asteroid data into the format my database expects
function transformAsteroid(neo, approachData) {
  const approach = approachData[0];  // NASA gives multiple close approaches, I take the first one
  const diamMin = neo.estimated_diameter.kilometers.estimated_diameter_min;
  const diamMax = neo.estimated_diameter.kilometers.estimated_diameter_max;

  // Extract the important data from NASA's format
  const partial = {
    id: neo.id,
    name: neo.name.replace(/[()]/g, '').trim(),  // Clean up the name
    nasa_jpl_url: neo.nasa_jpl_url,
    absolute_magnitude: neo.absolute_magnitude_h,
    estimated_diameter_min_km: diamMin,
    estimated_diameter_max_km: diamMax,
    is_potentially_hazardous: neo.is_potentially_hazardous_asteroid,
    close_approach_date: approach.close_approach_date,
    close_approach_date_full: new Date(approach.close_approach_date_full),
    relative_velocity_kph: parseFloat(approach.relative_velocity.kilometers_per_hour),
    miss_distance_km: parseFloat(approach.miss_distance.kilometers),
    miss_distance_lunar: parseFloat(approach.miss_distance.lunar),
    orbiting_body: approach.orbiting_body,
  };

  // Calculate how dangerous this asteroid is
  const { score, level } = calculateThreatScore(partial);
  return { ...partial, threat_score: score, threat_level: level };
}

// Add or update a bunch of asteroids in the database
// Returns counts of how many were inserted, updated, and how many are high threat
async function upsertAsteroids(asteroids) {
  const client = await pool.connect();
  let inserted = 0, updated = 0, highThreat = 0;

  try {
    for (const ast of asteroids) {
      // Use PostgreSQL's upsert feature - insert if new, update if exists
      const result = await client.query(
        `INSERT INTO asteroids (
          id, name, nasa_jpl_url, absolute_magnitude,
          estimated_diameter_min_km, estimated_diameter_max_km,
          is_potentially_hazardous, close_approach_date,
          close_approach_date_full, relative_velocity_kph,
          miss_distance_km, miss_distance_lunar, orbiting_body,
          threat_score, threat_level, last_updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
        ON CONFLICT (id) DO UPDATE SET
          threat_score = EXCLUDED.threat_score,
          threat_level = EXCLUDED.threat_level,
          relative_velocity_kph = EXCLUDED.relative_velocity_kph,
          miss_distance_km = EXCLUDED.miss_distance_km,
          miss_distance_lunar = EXCLUDED.miss_distance_lunar,
          last_updated_at = NOW()
        RETURNING (xmax = 0) AS is_insert`,  // This tells me if it was an insert or update
        [
          ast.id, ast.name, ast.nasa_jpl_url, ast.absolute_magnitude,
          ast.estimated_diameter_min_km, ast.estimated_diameter_max_km,
          ast.is_potentially_hazardous, ast.close_approach_date,
          ast.close_approach_date_full, ast.relative_velocity_kph,
          ast.miss_distance_km, ast.miss_distance_lunar, ast.orbiting_body,
          ast.threat_score, ast.threat_level,
        ]
      );
      // Count inserts vs updates
      if (result.rows[0].is_insert) inserted++;
      else updated++;
      // Count high threat asteroids
      if (ast.threat_score >= 65) highThreat++;
    }
  } finally {
    client.release();  // Always return the connection to the pool
  }

  return { inserted, updated, highThreat };
}

// The main function that syncs asteroid data from NASA
// Gets the next 7 days of close approaches
async function syncNEOData() {
  // Get today's date and 7 days from now
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const startDate = today.toISOString().split('T')[0];
  const endDate = nextWeek.toISOString().split('T')[0];

  console.log(`🔭 Fetching NEO data: ${startDate} → ${endDate}`);

  // Get the raw data from NASA
  const raw = await fetchAsteroidsFromNASA(startDate, endDate);
  const allAsteroids = [];

  // NASA groups asteroids by date, so I need to flatten them into one list
  for (const [date, neos] of Object.entries(raw.near_earth_objects)) {
    for (const neo of neos) {
      // Only include asteroids that have close approach data
      if (neo.close_approach_data?.length > 0) {
        allAsteroids.push(transformAsteroid(neo, neo.close_approach_data));
      }
    }
  }

  // Save all the asteroids to the database
  const stats = await upsertAsteroids(allAsteroids);

  // Log this fetch in the database
  await pool.query(
    `INSERT INTO fetch_logs (asteroids_fetched, new_asteroids, high_threat_count)
     VALUES ($1, $2, $3)`,
    [allAsteroids.length, stats.inserted, stats.highThreat]
  );

  console.log(`✅ Sync complete: ${allAsteroids.length} total, ${stats.inserted} new, ${stats.highThreat} high threat`);
  return { total: allAsteroids.length, ...stats, asteroids: allAsteroids };
}

// Export the functions so other files can use them
module.exports = { syncNEOData, fetchAsteroidsFromNASA };
