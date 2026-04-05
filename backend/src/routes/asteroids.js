// Setting up routes for asteroid data. I'm learning how to handle API requests!
const router = require('express').Router();
const { pool } = require('../db');
const { runSync } = require('../jobs/syncJob');

// GET /api/asteroids — get a list of asteroids with pagination and filters
router.get('/', async (req, res) => {
  try {
    // Get query parameters from the URL, with defaults
    const {
      page = 1,        // Which page of results
      limit = 20,      // How many results per page
      threat_level,    // Filter by threat level (HIGH, MEDIUM, etc.)
      hazardous,       // Only show potentially hazardous ones?
      sort = 'threat_score',  // What to sort by
      order = 'DESC',  // Sort direction
      days = 7,        // How many days ahead to look
    } = req.query;

    // Calculate where to start in the database (for pagination)
    const offset = (page - 1) * limit;

    // Build the WHERE conditions for filtering
    const conditions = [
      'close_approach_date >= CURRENT_DATE',  // Only future approaches
      `close_approach_date <= CURRENT_DATE + INTERVAL '${parseInt(days)} days'`  // Within the next X days
    ];
    const params = [];  // For safe SQL parameters

    // Add threat level filter if specified
    if (threat_level) {
      params.push(threat_level);
      conditions.push(`threat_level = $${params.length}`);
    }

    // Add hazardous filter if requested
    if (hazardous === 'true') conditions.push('is_potentially_hazardous = true');

    // Make sure the sort column is safe (prevent SQL injection)
    const validSorts = ['threat_score', 'close_approach_date', 'miss_distance_km', 'relative_velocity_kph', 'estimated_diameter_max_km'];
    const sortCol = validSorts.includes(sort) ? sort : 'threat_score';
    const sortDir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Build the WHERE clause
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Add pagination parameters
    params.push(parseInt(limit), offset);

    // The actual SQL query - I'm learning PostgreSQL!
    const query = `
      SELECT *, COUNT(*) OVER() AS total_count
      FROM asteroids
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    // Run the query
    const { rows } = await pool.query(query, params);
    const total = rows[0]?.total_count || 0;

    // Send the response back to the frontend
    res.json({
      data: rows.map(({ total_count, ...r }) => r),  // Remove the count from each row
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total),
        pages: Math.ceil(total / limit)
      },
    });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch asteroids' });
  }
});

// GET /api/asteroids/stats — get statistics for the dashboard
router.get('/stats', async (req, res) => {
  try {
    // Get various counts and stats about asteroids
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE close_approach_date >= CURRENT_DATE AND close_approach_date <= CURRENT_DATE + 7) AS total_this_week,
        COUNT(*) FILTER (WHERE threat_level = 'CRITICAL' AND close_approach_date >= CURRENT_DATE) AS critical_count,
        COUNT(*) FILTER (WHERE threat_level = 'HIGH' AND close_approach_date >= CURRENT_DATE) AS high_count,
        COUNT(*) FILTER (WHERE threat_level = 'MEDIUM' AND close_approach_date >= CURRENT_DATE) AS medium_count,
        COUNT(*) FILTER (WHERE threat_level = 'LOW' AND close_approach_date >= CURRENT_DATE) AS low_count,
        COUNT(*) FILTER (WHERE is_potentially_hazardous = true AND close_approach_date >= CURRENT_DATE) AS hazardous_count,
        MAX(threat_score) AS max_threat_score,
        MIN(miss_distance_lunar) FILTER (WHERE close_approach_date >= CURRENT_DATE) AS closest_lunar,
        MAX(relative_velocity_kph) FILTER (WHERE close_approach_date >= CURRENT_DATE) AS max_velocity
      FROM asteroids
    `);

    // Also get info about the last time I synced data from NASA
    const lastSync = await pool.query(
      `SELECT fetched_at, asteroids_fetched FROM fetch_logs ORDER BY fetched_at DESC LIMIT 1`
    );

    // Send all the stats back
    res.json({ ...rows[0], last_sync: lastSync.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/asteroids/critical — get the 5 most dangerous asteroids
router.get('/critical', async (req, res) => {
  try {
    // Get the top 5 highest threat scores for upcoming asteroids
    const { rows } = await pool.query(`
      SELECT * FROM asteroids
      WHERE close_approach_date >= CURRENT_DATE
      ORDER BY threat_score DESC
      LIMIT 5
    `);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch critical asteroids' });
  }
});

// GET /api/asteroids/:id — get details for a specific asteroid
router.get('/:id', async (req, res) => {
  try {
    // Find the asteroid by its NASA ID
    const { rows } = await pool.query('SELECT * FROM asteroids WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Asteroid not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch asteroid' });
  }
});

// POST /api/asteroids/sync — manually trigger a data sync from NASA
router.post('/sync', async (req, res) => {
  try {
    // Start the sync process in the background
    res.json({ message: 'Sync started', status: 'processing' });
    await runSync();
  } catch (err) {
    console.error('Manual sync failed:', err.message);
  }
});

// Export the router so the main app can use it
module.exports = router;
