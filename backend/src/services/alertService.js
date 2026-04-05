// Learning how to send emails! This service handles asteroid alert emails.
require('dotenv').config();
const nodemailer = require('nodemailer');
const { pool } = require('../db');

// Set up the email transporter using Gmail
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Helper function to get the color for each threat level
function getThreatColor(level) {
  const colors = {
    CRITICAL: '#ff2d2d',  // Red for critical
    HIGH: '#ff6b00',      // Orange for high
    MEDIUM: '#ffc107',   // Yellow for medium
    LOW: '#00e5ff',      // Blue for low
  };
  return colors[level] || '#00e5ff';  // Default to blue
}

// Build the HTML for the alert email - I'm learning HTML email templates!
function buildEmailHTML(asteroid) {
  const color = getThreatColor(asteroid.threat_level);
  // Calculate how many days until the asteroid approaches
  const daysUntil = Math.ceil(
    (new Date(asteroid.close_approach_date) - new Date()) / (1000 * 60 * 60 * 24)
  );

  // This is the HTML template for the email. It's pretty complex!
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050a14;font-family:'Courier New',monospace;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:${color}22;border:1px solid ${color};border-radius:4px;padding:6px 16px;margin-bottom:16px;">
        <span style="color:${color};font-size:11px;letter-spacing:3px;font-weight:700;">ALERT DISPATCH</span>
      </div>
      <h1 style="color:#fff;font-size:28px;margin:0;letter-spacing:-1px;">NEOWATCH</h1>
      <p style="color:#4a6fa5;font-size:12px;letter-spacing:4px;margin:4px 0 0;">NEAR EARTH OBJECT INTELLIGENCE</p>
    </div>

    <div style="background:#0a1628;border:1px solid ${color}44;border-radius:12px;padding:28px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div>
          <p style="color:#4a6fa5;font-size:11px;letter-spacing:2px;margin:0 0 6px;">OBJECT DESIGNATION</p>
          <h2 style="color:#fff;font-size:22px;margin:0;">${asteroid.name}</h2>
          <p style="color:#4a6fa5;font-size:12px;margin:4px 0 0;">ID: ${asteroid.id}</p>
        </div>
        <div style="text-align:right;">
          <div style="background:${color}22;border:1px solid ${color};border-radius:8px;padding:12px 16px;">
            <p style="color:${color};font-size:32px;font-weight:700;margin:0;line-height:1;">${asteroid.threat_score}</p>
            <p style="color:${color};font-size:10px;letter-spacing:2px;margin:4px 0 0;">${asteroid.threat_level}</p>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div style="background:#050a14;border-radius:8px;padding:14px;">
          <p style="color:#4a6fa5;font-size:10px;letter-spacing:2px;margin:0 0 4px;">CLOSE APPROACH</p>
          <p style="color:#fff;font-size:16px;font-weight:700;margin:0;">${asteroid.close_approach_date}</p>
          <p style="color:#4a6fa5;font-size:11px;margin:2px 0 0;">T-${daysUntil} days</p>
        </div>
        <div style="background:#050a14;border-radius:8px;padding:14px;">
          <p style="color:#4a6fa5;font-size:10px;letter-spacing:2px;margin:0 0 4px;">MISS DISTANCE</p>
          <p style="color:#fff;font-size:16px;font-weight:700;margin:0;">${parseFloat(asteroid.miss_distance_lunar).toFixed(2)} LD</p>
          <p style="color:#4a6fa5;font-size:11px;margin:2px 0 0;">${(parseFloat(asteroid.miss_distance_km) / 1000000).toFixed(2)}M km</p>
        </div>
        <div style="background:#050a14;border-radius:8px;padding:14px;">
          <p style="color:#4a6fa5;font-size:10px;letter-spacing:2px;margin:0 0 4px;">VELOCITY</p>
          <p style="color:#fff;font-size:16px;font-weight:700;margin:0;">${Math.round(asteroid.relative_velocity_kph).toLocaleString()}</p>
          <p style="color:#4a6fa5;font-size:11px;margin:2px 0 0;">km/h</p>
        </div>
        <div style="background:#050a14;border-radius:8px;padding:14px;">
          <p style="color:#4a6fa5;font-size:10px;letter-spacing:2px;margin:0 0 4px;">EST. DIAMETER</p>
          <p style="color:#fff;font-size:16px;font-weight:700;margin:0;">${parseFloat(asteroid.estimated_diameter_max_km).toFixed(3)} km</p>
          <p style="color:#4a6fa5;font-size:11px;margin:2px 0 0;">max estimate</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildSubscriptionHTML(email, threshold) {
  const tone = threshold >= 85 ? '#ff7a45' : threshold >= 65 ? '#ffb347' : threshold >= 40 ? '#7ce9ff' : '#3ddcff';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050a14;font-family:Arial,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:40px 20px;color:#ecf7ff;">
    <div style="padding:28px;border-radius:18px;background:#091626;border:1px solid rgba(124,233,255,0.18);">
      <p style="margin:0 0 12px;font-size:11px;letter-spacing:4px;color:#6ea2c5;text-transform:uppercase;">NeoWatch confirmation</p>
      <h1 style="margin:0 0 12px;font-size:28px;">Alert protocol armed</h1>
      <p style="margin:0 0 22px;line-height:1.7;color:#a2bfd2;">This is your live confirmation that NeoWatch can reach <strong>${email}</strong>. Future threat dispatches will trigger when a tracked object crosses your chosen score threshold.</p>
      <div style="display:inline-block;padding:12px 16px;border-radius:999px;background:${tone}22;border:1px solid ${tone};color:${tone};font-weight:700;">
        Threshold set to ${threshold}
      </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Build the HTML for subscription confirmation emails
function buildSubscriptionHTML(email, threshold) {
  // Choose a color based on the threat threshold
  const tone = threshold >= 85 ? '#ff7a45' : threshold >= 65 ? '#ffb347' : threshold >= 40 ? '#7ce9ff' : '#3ddcff';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050a14;font-family:Arial,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:40px 20px;color:#ecf7ff;">
    <div style="padding:28px;border-radius:18px;background:#091626;border:1px solid rgba(124,233,255,0.18);">
      <p style="margin:0 0 12px;font-size:11px;letter-spacing:4px;color:#6ea2c5;text-transform:uppercase;">NeoWatch confirmation</p>
      <h1 style="margin:0 0 12px;font-size:28px;">Alert protocol armed</h1>
      <p style="margin:0 0 22px;line-height:1.7;color:#a2bfd2;">This is your live confirmation that NeoWatch can reach <strong>${email}</strong>. Future threat dispatches will trigger when a tracked object crosses your chosen score threshold.</p>
      <div style="display:inline-block;padding:12px 16px;border-radius:999px;background:${tone}22;border:1px solid ${tone};color:${tone};font-weight:700;">
        Threshold set to ${threshold}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Send an alert email about a dangerous asteroid
async function sendThreatAlert(asteroid, subscriberEmail) {
  await transporter.sendMail({
    from: `"NeoWatch Alerts" <${process.env.GMAIL_USER}>`,
    to: subscriberEmail,
    subject: `[${asteroid.threat_level}] ${asteroid.name} - Threat Score ${asteroid.threat_score}/100`,
    html: buildEmailHTML(asteroid),
  });
}

// Send a confirmation email when someone subscribes
async function sendSubscriptionConfirmation(subscriberEmail, threshold) {
  await transporter.sendMail({
    from: `"NeoWatch Alerts" <${process.env.GMAIL_USER}>`,
    to: subscriberEmail,
    subject: `NeoWatch confirmation - alerts armed at score ${threshold}`,
    html: buildSubscriptionHTML(subscriberEmail, threshold),
  });
}

// Main function to send alerts to all subscribers about high-threat asteroids
async function dispatchAlerts(highThreatAsteroids) {
  if (!highThreatAsteroids.length) return;  // Nothing to alert about

  // Get all active subscribers
  const { rows: subscribers } = await pool.query(
    `SELECT * FROM alert_subscriptions WHERE is_active = true`
  );

  if (!subscribers.length) return;  // No one to alert

  // For each dangerous asteroid...
  for (const asteroid of highThreatAsteroids) {
    // Send to each subscriber who wants alerts at this threat level
    for (const sub of subscribers) {
      if (asteroid.threat_score < sub.min_threat_score) continue;  // Skip if below their threshold

      // Check if we already sent an alert for this asteroid to this person in the last 24 hours
      const { rows: existing } = await pool.query(
        `SELECT id FROM alert_history
         WHERE asteroid_id = $1 AND subscription_id = $2
         AND sent_at > NOW() - INTERVAL '24 hours'`,
        [asteroid.id, sub.id]
      );
      if (existing.length > 0) continue;  // Don't spam them with the same alert

      try {
        // Send the email
        await sendThreatAlert(asteroid, sub.email);
        // Record that we sent this alert
        await pool.query(
          `INSERT INTO alert_history (asteroid_id, subscription_id, threat_score)
           VALUES ($1, $2, $3)`,
          [asteroid.id, sub.id, asteroid.threat_score]
        );
        // Update when we last alerted this person
        await pool.query(
          `UPDATE alert_subscriptions SET last_alerted_at = NOW() WHERE id = $1`,
          [sub.id]
        );
        console.log(`Alert sent to ${sub.email} for ${asteroid.name}`);
      } catch (err) {
        console.error(`Failed to send alert to ${sub.email}:`, err.message);
      }
    }
  }
}

// Export the functions so other files can use them
module.exports = { dispatchAlerts, sendThreatAlert, sendSubscriptionConfirmation };
