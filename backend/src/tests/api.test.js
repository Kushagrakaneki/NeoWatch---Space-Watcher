/**
 * Testing my NeoWatch API! I'm learning how to write integration tests.
 * This checks that all the endpoints work correctly.
 * Make sure the server is running on port 3001 first.
 * Run: node src/tests/api.test.js
 */

const http = require('http');

// The base URL for my API
const BASE = `http://localhost:${process.env.PORT || 3001}`;
let passed = 0, failed = 0;  // Keep track of test results

// Helper function to check if a test passed or failed
function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} ${extra}`); failed++; }
}

// Helper function to make GET requests
function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    }).on('error', reject);
  });
}

// Run all the tests
async function run() {
  console.log(`\n🔌 NeoWatch API Integration Tests\n   Target: ${BASE}\n`);

  // Test the health endpoint first
  console.log('Health endpoint:');
  try {
    const { status, body } = await get('/api/health');
    assert('GET /api/health returns 200', status === 200, `(got ${status})`);
    assert('Returns service name', body.service === 'NeoWatch API');
    assert('Returns status: operational', body.status === 'operational');
    assert('Returns ws_clients count', typeof body.ws_clients === 'number');
    assert('Returns timestamp', !!body.timestamp);
  } catch (e) {
    assert('Health check reachable', false, `(${e.message})`);
  }

  // Test the asteroids list endpoint
  console.log('\nAsteroids list endpoint:');
  try {
    const { status, body } = await get('/api/asteroids');
    assert('GET /api/asteroids returns 200', status === 200);
    assert('Returns data array', Array.isArray(body.data));
    assert('Returns pagination object', !!body.pagination);
    assert('Pagination has total field', typeof body.pagination.total === 'number');
    assert('Pagination has pages field', typeof body.pagination.pages === 'number');
  } catch (e) {
    assert('Asteroids endpoint reachable', false, `(${e.message})`);
  }

  // Test the stats endpoint
  console.log('\nStats endpoint:');
  try {
    const { status, body } = await get('/api/asteroids/stats');
    assert('GET /api/asteroids/stats returns 200', status === 200);
    assert('Has total_this_week', body.total_this_week !== undefined);
    assert('Has critical_count', body.critical_count !== undefined);
    assert('Has high_count', body.high_count !== undefined);
    assert('Has hazardous_count', body.hazardous_count !== undefined);
  } catch (e) {
    assert('Stats endpoint reachable', false, `(${e.message})`);
  }

  // Test the critical asteroids endpoint
  console.log('\nCritical objects endpoint:');
  try {
    const { status, body } = await get('/api/asteroids/critical');
    assert('GET /api/asteroids/critical returns 200', status === 200);
    assert('Returns data array', Array.isArray(body.data));
    assert('Returns at most 5 objects', body.data.length <= 5);
    if (body.data.length > 1) {
      assert('Results sorted by threat_score DESC',
        body.data[0].threat_score >= body.data[1].threat_score);
    }
  } catch (e) {
    assert('Critical endpoint reachable', false, `(${e.message})`);
  }

  // Test pagination
  console.log('\nPagination:');
  try {
    const { body: p1 } = await get('/api/asteroids?page=1&limit=5');
    const { body: p2 } = await get('/api/asteroids?page=2&limit=5');
    assert('Page 1 returns up to 5 results', p1.data.length <= 5);
    if (p1.data.length === 5 && p2.data.length > 0) {
      assert('Page 2 has different results than page 1',
        p1.data[0].id !== p2.data[0].id);
    }
  } catch (e) {
    assert('Pagination works', false, `(${e.message})`);
  }

  // Test filtering
  console.log('\nFiltering:');
  try {
    const { body } = await get('/api/asteroids?threat_level=HIGH');
    assert('Threat level filter returns correct level',
      body.data.every(a => a.threat_level === 'HIGH') || body.data.length === 0);
  } catch (e) {
    assert('Filtering works', false, `(${e.message})`);
  }

  // Test 404 errors
  console.log('\nError handling:');
  try {
    const { status } = await get('/api/asteroids/nonexistent_id_xyz_999');
    assert('Unknown asteroid ID returns 404', status === 404);
  } catch (e) {
    assert('404 handling works', false, `(${e.message})`);
  }

  // Test subscription validation
  console.log('\nAlert subscription validation:');
  const postData = JSON.stringify({ email: 'notanemail' });
  await new Promise(resolve => {
    const req = http.request(`${BASE}/api/alerts/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        assert('Invalid email returns 400', res.statusCode === 400);
        resolve();
      });
    });
    req.on('error', () => { assert('Subscribe validation reachable', false); resolve(); });
    req.write(postData);
    req.end();
  });

  // Print the final results
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) console.log('🎉 All tests passed!\n');
  else { console.error(`⚠  ${failed} test(s) failed\n`); process.exit(1); }
}

run().catch(console.error);
