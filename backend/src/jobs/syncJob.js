// Learning about background jobs! This handles syncing asteroid data automatically.
const cron = require('node-cron');
const { syncNEOData } = require('../services/nasaService');
const { dispatchAlerts } = require('../services/alertService');
const { broadcastSyncComplete, broadcastHighThreat, broadcastNewAsteroids } = require('../websocket');

// Set up a cron job to run the sync every 6 hours
function startSyncJob() {
  // Cron syntax: run at minute 0 of every 6th hour (0, 6, 12, 18)
  cron.schedule('0 */6 * * *', async () => {
    console.log('⏰ Scheduled NEO sync starting...');
    await runSync();
  });

  console.log('✅ NEO sync cron job scheduled (every 6 hours)');
}

// The main sync function that gets called by the cron job
async function runSync() {
  try {
    // Fetch new data from NASA
    const result = await syncNEOData();

    // Filter for high-threat and new asteroids to broadcast to websockets
    const highThreat = result.asteroids.filter(a => a.threat_score >= 65);
    const newAsteroids = result.asteroids.filter(a => a.threat_level !== 'LOW');

    // Tell all connected clients that sync is complete
    broadcastSyncComplete({
      total: result.total,
      inserted: result.inserted,
      updated: result.updated,
      highThreatCount: highThreat.length,
    });

    // Broadcast new asteroids to the live feed
    if (newAsteroids.length > 0) broadcastNewAsteroids(newAsteroids);

    // If there are dangerous asteroids, broadcast them and send email alerts
    if (highThreat.length > 0) {
      broadcastHighThreat(highThreat);
      await dispatchAlerts(highThreat);
    }

    return result;
  } catch (err) {
    console.error('❌ Sync job failed:', err.message);
    throw err;
  }
}

// Export the functions
module.exports = { startSyncJob, runSync };
