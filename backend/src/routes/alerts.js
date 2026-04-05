// Routes for handling email alerts. I'm learning how to send emails with Node.js!
const router = require('express').Router();
const { pool } = require('../db');
const { sendSubscriptionConfirmation } = require('../services/alertService');

// POST /api/alerts/subscribe — let people sign up for asteroid alerts
router.post('/subscribe', async (req, res) => {
  // Get the email and minimum threat score they want alerts for
  const { email, min_threat_score = 65 } = req.body;

  // Make sure they gave us a valid email
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

  // Clean up the email and make sure the threat score is reasonable
  const normalizedEmail = email.toLowerCase().trim();
  const threshold = Math.max(0, Math.min(100, parseInt(min_threat_score, 10)));

  try {
    // Save their subscription to the database (or update if they already subscribed)
    const { rows } = await pool.query(
      `INSERT INTO alert_subscriptions (email, min_threat_score)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET is_active = true, min_threat_score = $2
       RETURNING *`,
      [normalizedEmail, threshold]
    );

    // Try to send them a confirmation email
    try {
      await sendSubscriptionConfirmation(normalizedEmail, threshold);
      res.json({
        message: `Alert protocol armed and confirmation email sent to ${normalizedEmail}.`,
        emailStatus: 'sent',
        subscription: rows[0],
      });
    } catch (mailError) {
      // Email failed, but subscription was saved
      console.error('Confirmation email failed:', mailError.message);
      res.status(502).json({
        error: `Subscription was saved, but Gmail could not send the confirmation email: ${mailError.message}`,
        emailStatus: 'failed',
        subscription: rows[0],
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// DELETE /api/alerts/unsubscribe — let people stop getting alerts
router.delete('/unsubscribe', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    // Mark their subscription as inactive instead of deleting it
    await pool.query(
      `UPDATE alert_subscriptions SET is_active = false WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    res.json({ message: 'Unsubscribed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// GET /api/alerts/history — see all the alerts I've sent
router.get('/history', async (req, res) => {
  try {
    // Get the last 50 alerts with asteroid details
    const { rows } = await pool.query(`
      SELECT ah.*, a.name as asteroid_name, a.threat_level
      FROM alert_history ah
      JOIN asteroids a ON ah.asteroid_id = a.id
      ORDER BY ah.sent_at DESC
      LIMIT 50
    `);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alert history' });
  }
});

// Export the router
module.exports = router;
