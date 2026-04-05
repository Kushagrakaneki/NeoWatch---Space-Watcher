/**
 * NeoWatch — Dev Seed Script
 * I'm learning how to populate the database with fake asteroid data for testing.
 * This is useful when I don't have a NASA API key yet or want predictable data.
 *
 * Run: node src/db/seed.js
 */

require('dotenv').config();
const { pool } = require('./index');
const { calculateThreatScore } = require('../services/threatScoring');

// Some realistic asteroid names I found online
const NAMES = [
  '2024 BX1', '2024 YR4', '99942 Apophis', '2023 DW', '2011 AG5',
  '1997 XF11', '2007 VK184', '2004 MN4', '2019 SU3', '2020 NK1',
  '2024 AZ5', '2022 YO1', '2018 VP1', '2023 QA5', '2021 PH27',
  '2024 MK', '1998 OR2', '2027 TF19', '2020 SW', '2025 XT7',
];

// Helper function to get a random number between min and max
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// Get a date that's X days from now (for close approach dates)
function dateFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Generate fake asteroid data with different threat levels
function generateAsteroid(index) {
  // I want a mix of threat levels: 10% critical, 20% high, 30% medium, 40% low
  const roll = Math.random();
  let lunarDist, velocity, diameter, hazardous;

  if (roll < 0.10) {
    // Super dangerous - critical threat!
    lunarDist = randomBetween(0.1, 0.9);  // Very close to Earth
    velocity = randomBetween(90000, 180000);  // Moving really fast
    diameter = randomBetween(0.3, 2.0);  // Pretty big
    hazardous = true;
  } else if (roll < 0.30) {
    // High threat - keep an eye on this one
    lunarDist = randomBetween(1, 4);
    velocity = randomBetween(60000, 110000);
    diameter = randomBetween(0.08, 0.5);
    hazardous = Math.random() > 0.5;  // Sometimes hazardous
  } else if (roll < 0.60) {
    // Medium threat - not too worried but monitoring
    lunarDist = randomBetween(4, 12);
    velocity = randomBetween(25000, 70000);
    diameter = randomBetween(0.02, 0.1);
    hazardous = false;
  } else {
    // Low threat - probably nothing to worry about
    lunarDist = randomBetween(12, 30);
    velocity = randomBetween(5000, 30000);
    diameter = randomBetween(0.001, 0.025);
    hazardous = false;
  }

  // Convert lunar distance to kilometers (Moon is about 384,400 km away)
  const missKm = lunarDist * 384400;
  // Random close approach date within next 2 weeks
  const daysUntil = Math.floor(randomBetween(1, 14));
  // Use asteroid names, add numbers if I need more than the list
  const name = NAMES[index % NAMES.length] + (index >= NAMES.length ? ` ${index}` : '');

  // Create the data structure that my threat scoring function expects
  const partial = {
    miss_distance_lunar: lunarDist.toString(),
    relative_velocity_kph: velocity.toString(),
    estimated_diameter_max_km: diameter.toString(),
    is_potentially_hazardous: hazardous,
    close_approach_date: dateFromNow(daysUntil),
  };

  // Calculate how dangerous this asteroid is
  const { score, level } = calculateThreatScore(partial);

  // Return the complete asteroid object
  return {
    id: `SEED${String(index + 1).padStart(6, '0')}`,  // Unique ID starting with SEED
    name,
    nasa_jpl_url: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(name)}`,
    absolute_magnitude: randomBetween(18, 30).toFixed(2),
    estimated_diameter_min_km: (diameter * 0.7).toFixed(6),  // Estimate smaller size
    estimated_diameter_max_km: diameter.toFixed(6),
    is_potentially_hazardous: hazardous,
    close_approach_date: dateFromNow(daysUntil),
    close_approach_date_full: new Date(dateFromNow(daysUntil)).toISOString(),
    relative_velocity_kph: velocity.toFixed(4),
    miss_distance_km: missKm.toFixed(4),
    miss_distance_lunar: lunarDist.toFixed(4),
    orbiting_body: 'Earth',
    threat_score: score,
    threat_level: level,
  };
}

// Main seeding function
async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding NeoWatch database with demo data...\n');

    // Remove any existing seed data first
    await client.query(`DELETE FROM asteroids WHERE id LIKE 'SEED%'`);

    // Generate 40 fake asteroids
    const asteroids = Array.from({ length: 40 }, (_, i) => generateAsteroid(i));

    // Count how many of each threat level I created
    let critical = 0, high = 0, medium = 0, low = 0;

    // Insert each asteroid into the database
    for (const a of asteroids) {
      await client.query(
        `INSERT INTO asteroids (
          id, name, nasa_jpl_url, absolute_magnitude,
          estimated_diameter_min_km, estimated_diameter_max_km,
          is_potentially_hazardous, close_approach_date,
          close_approach_date_full, relative_velocity_kph,
          miss_distance_km, miss_distance_lunar, orbiting_body,
          threat_score, threat_level
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO NOTHING`,  // Don't insert if it already exists
        [
          a.id, a.name, a.nasa_jpl_url, a.absolute_magnitude,
          a.estimated_diameter_min_km, a.estimated_diameter_max_km,
          a.is_potentially_hazardous, a.close_approach_date,
          a.close_approach_date_full, a.relative_velocity_kph,
          a.miss_distance_km, a.miss_distance_lunar, a.orbiting_body,
          a.threat_score, a.threat_level,
        ]
      );
      // Count the threat levels
      if (a.threat_level === 'CRITICAL') critical++;
      else if (a.threat_level === 'HIGH') high++;
      else if (a.threat_level === 'MEDIUM') medium++;
      else low++;
    }

    // Add a fake log entry to show I "fetched" this data
    await client.query(
      `INSERT INTO fetch_logs (asteroids_fetched, new_asteroids, high_threat_count)
       VALUES ($1, $2, $3)`,
      [asteroids.length, asteroids.length, critical + high]
    );

    console.log(`✅ Seeded ${asteroids.length} asteroids:`);
    console.log(`   🔴 CRITICAL: ${critical}`);
    console.log(`   🟠 HIGH:     ${high}`);
    console.log(`   🟡 MEDIUM:   ${medium}`);
    console.log(`   🔵 LOW:      ${low}`);
    console.log('\n🚀 Start the server and open http://localhost:5173\n');

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    // Always clean up the database connection
    client.release();
    await pool.end();
  }
}

// Run the seeding when this script is executed
seed();
