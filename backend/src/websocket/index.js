// Learning about WebSockets! This enables real-time communication with the frontend.
const WebSocket = require('ws');

let wss = null;  // The WebSocket server instance
const clients = new Set();  // Keep track of connected clients

// Initialize the WebSocket server
function initWebSocket(server) {
  // Create WebSocket server on the same HTTP server, at /ws path
  wss = new WebSocket.Server({ server, path: '/ws' });

  // Handle new connections
  wss.on('connection', (ws, req) => {
    clients.add(ws);  // Add to our set of clients
    console.log(`🔌 WS client connected. Total: ${clients.size}`);

    // Send a welcome message
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'NeoWatch live feed connected', timestamp: new Date().toISOString() }));

    // Handle messages from clients (like ping/pong for keepalive)
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        }
      } catch {}  // Ignore invalid messages
    });

    // Handle disconnections
    ws.on('close', () => {
      clients.delete(ws);
      console.log(`🔌 WS client disconnected. Total: ${clients.size}`);
    });

    // Handle errors
    ws.on('error', () => clients.delete(ws));
  });

  return wss;
}

// Send a message to all connected clients
function broadcast(type, data) {
  if (!wss) return;  // Don't broadcast if server isn't initialized
  const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Specific broadcast functions for different events
function broadcastSyncComplete(stats) {
  broadcast('SYNC_COMPLETE', stats);
}

function broadcastHighThreat(asteroids) {
    broadcast('HIGH_THREAT_DETECTED', { count: asteroids.length, asteroids });
  }
}

function broadcastNewAsteroids(asteroids) {
  broadcast('NEW_ASTEROIDS', { count: asteroids.length, asteroids });
}

// Get the number of connected clients (used in health check)
function getClientCount() {
  return clients.size;
}

// Export all the functions
module.exports = { initWebSocket, broadcast, broadcastSyncComplete, broadcastHighThreat, broadcastNewAsteroids, getClientCount };
