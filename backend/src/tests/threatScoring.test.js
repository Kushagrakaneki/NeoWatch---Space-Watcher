/**
 * NeoWatch — Threat Scoring Unit Tests
 * Run: node src/tests/threatScoring.test.js
 */

const { calculateThreatScore, getThreatLevel } = require('../services/threatScoring');

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} ${extra}`);
    failed++;
  }
}

function makeAsteroid(overrides = {}) {
  return {
    miss_distance_lunar: '15',
    relative_velocity_kph: '30000',
    estimated_diameter_max_km: '0.05',
    is_potentially_hazardous: false,
    close_approach_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    ...overrides,
  };
}

console.log('\n🔬 NeoWatch Threat Scoring Tests\n');

// ── Baseline ─────────────────────────────────────────────────────────
console.log('Baseline:');
{
  const ast = makeAsteroid();
  const { score, level } = calculateThreatScore(ast);
  assert('Score is a number', typeof score === 'number');
  assert('Score is 0–100', score >= 0 && score <= 100);
  assert('Level is a string', typeof level === 'string');
  assert('Distant, slow, small = LOW', level === 'LOW', `(got ${level}, score ${score})`);
}

// ── Miss distance ─────────────────────────────────────────────────────
console.log('\nMiss distance scoring:');
{
  const close = makeAsteroid({ miss_distance_lunar: '0.3' });
  const far = makeAsteroid({ miss_distance_lunar: '30' });
  const { score: closeScore } = calculateThreatScore(close);
  const { score: farScore } = calculateThreatScore(far);
  assert('Very close approach scores higher than distant', closeScore > farScore, `(${closeScore} vs ${farScore})`);
  assert('Miss distance <0.5 LD gives max distance points', closeScore >= 35);
  assert('Miss distance >20 LD gives very low points', farScore < 15);
}

// ── Velocity ──────────────────────────────────────────────────────────
console.log('\nVelocity scoring:');
{
  const fast = makeAsteroid({ relative_velocity_kph: '200000' });
  const slow = makeAsteroid({ relative_velocity_kph: '5000' });
  const { score: fastScore } = calculateThreatScore(fast);
  const { score: slowScore } = calculateThreatScore(slow);
  assert('High velocity scores more than slow', fastScore > slowScore);
  assert('>150k km/h gives max velocity points', fastScore >= 25);
}

// ── Size ──────────────────────────────────────────────────────────────
console.log('\nSize scoring:');
{
  const huge = makeAsteroid({ estimated_diameter_max_km: '1.5' });
  const tiny = makeAsteroid({ estimated_diameter_max_km: '0.001' });
  const { score: hugeScore } = calculateThreatScore(huge);
  const { score: tinyScore } = calculateThreatScore(tiny);
  assert('Extinction-class object scores higher than tiny', hugeScore > tinyScore);
  assert('>1km diameter gives max size points (25)', hugeScore >= 25);
}

// ── PHA flag ──────────────────────────────────────────────────────────
console.log('\nPotentially Hazardous Asteroid flag:');
{
  const pha = makeAsteroid({ is_potentially_hazardous: true });
  const normal = makeAsteroid({ is_potentially_hazardous: false });
  const { score: phaScore } = calculateThreatScore(pha);
  const { score: normalScore } = calculateThreatScore(normal);
  assert('PHA flag adds 10 points', phaScore === normalScore + 10, `(${phaScore} vs ${normalScore})`);
}

// ── Imminence ─────────────────────────────────────────────────────────
console.log('\nImminence bonus:');
{
  const imminent = makeAsteroid({ close_approach_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0] });
  const distant = makeAsteroid({ close_approach_date: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0] });
  const { score: imminentScore } = calculateThreatScore(imminent);
  const { score: distantScore } = calculateThreatScore(distant);
  assert('Approach within 3 days scores higher', imminentScore > distantScore);
}

// ── Threat levels ────────────────────────────────────────────────────
console.log('\nThreat level thresholds:');
{
  assert('Score 85+ = CRITICAL', getThreatLevel(85) === 'CRITICAL');
  assert('Score 65 = HIGH', getThreatLevel(65) === 'HIGH');
  assert('Score 40 = MEDIUM', getThreatLevel(40) === 'MEDIUM');
  assert('Score 39 = LOW', getThreatLevel(39) === 'LOW');
  assert('Score 0 = LOW', getThreatLevel(0) === 'LOW');
  assert('Score 100 = CRITICAL', getThreatLevel(100) === 'CRITICAL');
}

// ── Cap at 100 ────────────────────────────────────────────────────────
console.log('\nScore cap:');
{
  const worst = makeAsteroid({
    miss_distance_lunar: '0.1',
    relative_velocity_kph: '999999',
    estimated_diameter_max_km: '5.0',
    is_potentially_hazardous: true,
    close_approach_date: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
  });
  const { score } = calculateThreatScore(worst);
  assert('Score never exceeds 100 even for worst-case object', score <= 100, `(got ${score})`);
  assert('Worst-case object is CRITICAL', getThreatLevel(score) === 'CRITICAL');
}

// ── Results ───────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) console.log('🎉 All tests passed!\n');
else { console.error(`⚠  ${failed} test(s) failed\n`); process.exit(1); }
