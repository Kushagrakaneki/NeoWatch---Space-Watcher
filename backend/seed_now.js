/**
 * NeoWatch — Standalone Seed (no NASA API, no .env needed)
 * Run: node seed_now.js
 */

const { Pool } = require('pg');

// ── Change these if your DB is different ──────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/neowatch';

const pool = new Pool({ connectionString: DATABASE_URL });

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function dateFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function calcScore(lunarDist, velocityKph, diameterKm, hazardous, daysUntil) {
  let score = 0;
  if (lunarDist < 0.5) score += 35;
  else if (lunarDist < 1) score += 30;
  else if (lunarDist < 3) score += 22;
  else if (lunarDist < 5) score += 15;
  else if (lunarDist < 10) score += 8;
  else if (lunarDist < 20) score += 3;

  if (velocityKph > 150000) score += 25;
  else if (velocityKph > 100000) score += 20;
  else if (velocityKph > 70000) score += 14;
  else if (velocityKph > 50000) score += 10;
  else if (velocityKph > 20000) score += 5;

  if (diameterKm > 1.0) score += 25;
  else if (diameterKm > 0.5) score += 20;
  else if (diameterKm > 0.1) score += 14;
  else if (diameterKm > 0.05) score += 9;
  else if (diameterKm > 0.01) score += 4;

  if (hazardous) score += 10;
  if (daysUntil <= 3) score += 5;
  else if (daysUntil <= 7) score += 3;
  else if (daysUntil <= 30) score += 1;

  return Math.min(100, Math.round(score));
}

function getLevel(score) {
  if (score >= 85) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

const ASTEROID_DATA = [
  // CRITICAL threats
  { name: '99942 Apophis',   lunar: 0.25, vel: 160000, diam: 0.37, pha: true,  days: 2  },
  { name: '2024 YR4',        lunar: 0.45, vel: 140000, diam: 0.55, pha: true,  days: 1  },
  { name: '2011 AG5',        lunar: 0.30, vel: 175000, diam: 0.14, pha: true,  days: 3  },
  // HIGH threats
  { name: '2023 DW',         lunar: 1.2,  vel: 95000,  diam: 0.18, pha: true,  days: 5  },
  { name: '1997 XF11',       lunar: 2.1,  vel: 88000,  diam: 0.22, pha: true,  days: 4  },
  { name: '2004 MN4',        lunar: 1.8,  vel: 105000, diam: 0.35, pha: false, days: 6  },
  { name: '2019 SU3',        lunar: 3.2,  vel: 72000,  diam: 0.09, pha: true,  days: 7  },
  { name: '2024 AZ5',        lunar: 2.8,  vel: 85000,  diam: 0.15, pha: false, days: 3  },
  // MEDIUM threats
  { name: '2007 VK184',      lunar: 5.5,  vel: 55000,  diam: 0.13, pha: false, days: 8  },
  { name: '2018 VP1',        lunar: 7.2,  vel: 48000,  diam: 0.005,pha: false, days: 9  },
  { name: '2023 QA5',        lunar: 6.8,  vel: 62000,  diam: 0.08, pha: false, days: 11 },
  { name: '2021 PH27',       lunar: 8.1,  vel: 44000,  diam: 0.06, pha: false, days: 10 },
  { name: '2024 MK',         lunar: 4.9,  vel: 58000,  diam: 0.09, pha: false, days: 12 },
  { name: '1998 OR2',        lunar: 9.5,  vel: 35000,  diam: 1.8,  pha: true,  days: 14 },
  // LOW threats
  { name: '2020 NK1',        lunar: 14.2, vel: 28000,  diam: 0.03, pha: false, days: 5  },
  { name: '2027 TF19',       lunar: 18.5, vel: 22000,  diam: 0.02, pha: false, days: 7  },
  { name: '2020 SW',         lunar: 12.8, vel: 31000,  diam: 0.007,pha: false, days: 9  },
  { name: '2025 XT7',        lunar: 22.0, vel: 18000,  diam: 0.015,pha: false, days: 6  },
  { name: '2022 YO1',        lunar: 16.3, vel: 25000,  diam: 0.04, pha: false, days: 11 },
  { name: '2015 TB145',      lunar: 25.1, vel: 35000,  diam: 0.6,  pha: false, days: 13 },
  { name: '2003 QQ47',       lunar: 19.8, vel: 20000,  diam: 0.01, pha: false, days: 8  },
  { name: '2024 BX1',        lunar: 28.0, vel: 12000,  diam: 0.003,pha: false, days: 4  },
  { name: '2009 FD',         lunar: 11.4, vel: 33000,  diam: 0.16, pha: false, days: 10 },
  { name: '2010 NY65',       lunar: 17.9, vel: 27000,  diam: 0.05, pha: false, days: 3  },
  { name: '2014 JO25',       lunar: 21.5, vel: 23000,  diam: 0.65, pha: false, days: 12 },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('\n🌱 Seeding NeoWatch with demo asteroid data...\n');

    await client.query(`DELETE FROM asteroids WHERE id LIKE 'DEMO%'`);

    let counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

    for (let i = 0; i < ASTEROID_DATA.length; i++) {
      const a = ASTEROID_DATA[i];
      const score = calcScore(a.lunar, a.vel, a.diam, a.pha, a.days);
      const level = getLevel(score);
      const missKm = a.lunar * 384400;
      const date = dateFromNow(a.days);
      const id = `DEMO${String(i + 1).padStart(4, '0')}`;

      await client.query(
        `INSERT INTO asteroids (
          id, name, nasa_jpl_url, absolute_magnitude,
          estimated_diameter_min_km, estimated_diameter_max_km,
          is_potentially_hazardous, close_approach_date,
          close_approach_date_full, relative_velocity_kph,
          miss_distance_km, miss_distance_lunar, orbiting_body,
          threat_score, threat_level
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO UPDATE SET
          threat_score = EXCLUDED.threat_score,
          threat_level = EXCLUDED.threat_level,
          last_updated_at = NOW()`,
        [
          id, a.name,
          `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(a.name)}`,
          (randomBetween(18, 28)).toFixed(2),
          (a.diam * 0.7).toFixed(6), a.diam.toFixed(6),
          a.pha, date,
          new Date(date).toISOString(),
          a.vel.toFixed(4), missKm.toFixed(4),
          a.lunar.toFixed(4), 'Earth',
          score, level,
        ]
      );

      counts[level]++;
      const bar = '█'.repeat(Math.floor(score / 5)) + '░'.repeat(20 - Math.floor(score / 5));
      console.log(`  [${level.padEnd(8)}] ${score.toString().padStart(3)}/100  ${bar}  ${a.name}`);
    }

    await client.query(
      `INSERT INTO fetch_logs (asteroids_fetched, new_asteroids, high_threat_count)
       VALUES ($1, $2, $3)`,
      [ASTEROID_DATA.length, ASTEROID_DATA.length, counts.CRITICAL + counts.HIGH]
    );

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`✅ Seeded ${ASTEROID_DATA.length} asteroids`);
    console.log(`   🔴 CRITICAL : ${counts.CRITICAL}`);
    console.log(`   🟠 HIGH     : ${counts.HIGH}`);
    console.log(`   🟡 MEDIUM   : ${counts.MEDIUM}`);
    console.log(`   🔵 LOW      : ${counts.LOW}`);
    console.log(`\n🚀 Backend:  http://localhost:3001/api/asteroids`);
    console.log(`🌐 Frontend: http://localhost:5173\n`);

  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    console.error('   Make sure PostgreSQL is running and DATABASE_URL is correct in .env\n');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();