/**
 * My threat scoring system for asteroids!
 *
 * I'm trying to figure out how dangerous each asteroid is on a scale of 0-100.
 * I look at:
 *   - How close it gets to Earth (closer = scarier)
 *   - How fast it's moving (faster = scarier)
 *   - How big it is (bigger = scarier)
 *   - NASA's "potentially hazardous" flag
 *   - How soon it's coming (sooner = more urgent)
 */

const THRESHOLDS = {
  CRITICAL: 85,  // Really bad, pay attention!
  HIGH: 65,      // Concerning
  MEDIUM: 40,    // Keep an eye on it
  LOW: 0,        // Probably fine
};

function calculateThreatScore(asteroid) {
  let score = 0;

  // First, check how close it gets to Earth. Closer = more dangerous!
  // I measure this in lunar distances (1 LD = distance to Moon)
  const lunarDist = parseFloat(asteroid.miss_distance_lunar);
  if (lunarDist < 0.5) score += 35;      // Super close!
  else if (lunarDist < 1) score += 30;   // Still very close
  else if (lunarDist < 3) score += 22;   // Pretty close
  else if (lunarDist < 5) score += 15;   // Moderately close
  else if (lunarDist < 10) score += 8;   // Not too close
  else if (lunarDist < 20) score += 3;   // Far away

  // Second, how fast is it moving? Faster asteroids are harder to track and deflect
  const velocityKph = parseFloat(asteroid.relative_velocity_kph);
  if (velocityKph > 150000) score += 25;     // Crazy fast!
  else if (velocityKph > 100000) score += 20; // Very fast
  else if (velocityKph > 70000) score += 14; // Fast
  else if (velocityKph > 50000) score += 10; // Pretty fast
  else if (velocityKph > 20000) score += 5;  // Moderate speed

  // Third, size matters! Bigger asteroids can cause more damage
  const diameterMax = parseFloat(asteroid.estimated_diameter_max_km);
  if (diameterMax > 1.0) score += 25;     // Huge! Could cause extinction-level damage
  else if (diameterMax > 0.5) score += 20; // Very large
  else if (diameterMax > 0.1) score += 14; // Large
  else if (diameterMax > 0.05) score += 9; // Medium
  else if (diameterMax > 0.01) score += 4; // Small

  // Fourth, NASA has a "potentially hazardous" flag - that's important!
  if (asteroid.is_potentially_hazardous) score += 10;

  // Fifth, how soon is this happening? More urgent if it's coming soon!
  const daysUntil = getDaysUntilApproach(asteroid.close_approach_date);
  if (daysUntil !== null) {
    if (daysUntil <= 3) score += 5;      // Coming very soon!
    else if (daysUntil <= 7) score += 3; // This week
    else if (daysUntil <= 30) score += 1; // This month
  }

  // Make sure the score doesn't go over 100, and round it to a whole number
  const finalScore = Math.min(100, Math.round(score));

  return {
    score: finalScore,
    level: getThreatLevel(finalScore),  // Convert score to a threat level
  };
}

// Helper function to turn a score into a threat level word
function getThreatLevel(score) {
  if (score >= THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (score >= THRESHOLDS.HIGH) return 'HIGH';
  if (score >= THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

// Calculate how many days until the asteroid's close approach
function getDaysUntilApproach(dateStr) {
  if (!dateStr) return null;
  const approachDate = new Date(dateStr);
  const now = new Date();
  const diff = approachDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));  // Convert milliseconds to days
}

// Export these functions so other files can use them
module.exports = { calculateThreatScore, getThreatLevel, THRESHOLDS };
