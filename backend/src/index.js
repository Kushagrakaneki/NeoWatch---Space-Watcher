// Okay, so this is the main server file for NeoWatch. I'm learning how to set up a Node.js backend.
// First, load up all the packages I need
require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initWebSocket } = require('./websocket');
const { startSyncJob, runSync } = require('./jobs/syncJob');
const asteroidsRouter = require('./routes/asteroids');
const alertsRouter = require('./routes/alerts');

const app = express();
const server = http.createServer(app);

// Alright, time to set up all the middleware. This is like the plumbing that handles requests before they get to my routes.
// Helmet helps secure the app by setting various HTTP headers
app.use(helmet());
// CORS allows the frontend to talk to this backend. I need to specify which origins are allowed
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true,
}));
// This lets me read JSON data from requests
app.use(express.json());

// Rate limiting to prevent someone from spamming my API too much
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, slow down.' },
});
app.use('/api', limiter);

// Now setting up the routes. These handle different API endpoints.
// Asteroids routes for getting asteroid data
app.use('/api/asteroids', asteroidsRouter);
// Alerts routes for email notifications
app.use('/api/alerts', alertsRouter);

// A simple health check endpoint to see if the server is running
app.get('/api/health', (req, res) => {
  const { getClientCount } = require('./websocket');
  res.json({
    status: 'operational',
    service: 'NeoWatch API',
    version: '1.0.0',
    ws_clients: getClientCount(),
    timestamp: new Date().toISOString(),
  });
  });
});

// Error handling middleware - catches any errors that slip through
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Setting up WebSocket connections for real-time updates
initWebSocket(server);

// Finally, starting the server! This is where everything comes together.
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`\n🚀 NeoWatch API running on port ${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`🌐 REST API:  http://localhost:${PORT}/api\n`);

  // Start the background job that syncs asteroid data every few hours
  startSyncJob();

  // Run an initial sync when the server starts up
  console.log('🔭 Running initial NASA data sync...');
  try {
    await runSync();
  } catch (err) {
    console.error('Initial sync failed (check NASA API key):', err.message);
  }
});
