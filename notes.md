# NeoWatch Backend Interview Preparation Guide
**Master-Level Readiness for Backend Engineering Interviews**

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Technologies Deep Dive](#core-technologies-deep-dive)
3. [Design Patterns & Principles](#design-patterns--principles)
4. [Expert-Level Q&A](#expert-level-qa)
5. [Data Flow Walkthrough](#data-flow-walkthrough)
6. [Performance & Optimization](#performance--optimization)
7. [Security & Best Practices](#security--best-practices)

---

## Architecture Overview

### High-Level System Design
```
┌─────────────────┐         ┌──────────────────────┐
│   NASA NeoWS    │────────>│  nasaService.js      │
│   REST API      │         │  (Data Transform)    │
└─────────────────┘         └──────────┬───────────┘
                                       │
                            ┌──────────▼───────────┐
                            │ threatScoring.js     │
                            │ (Algorithmic Scoring)│
                            └──────────┬───────────┘
                                       │
           ┌───────────────────────────┼───────────────────────┐
           │                           │                       │
    ┌──────▼──────┐           ┌────────▼────────┐      ┌──────▼──────┐
    │ PostgreSQL  │           │    WebSocket    │      │  Nodemailer  │
    │  Database   │           │   (ws//)        │      │   (SMTP)     │
    └─────────────┘           └────────┬────────┘      └──────────────┘
           ▲                          │
           │                          │ (broadcast events)
    ┌──────┴──────────┐              │
    │ REST API Routes │<─────────────┤
    │ (Express)       │              │
    └─────────────────┘              │
           ▲                          │
           │                          │
      ┌────┴────────────┐    ┌───────▼────────┐
      │   Web Client    │    │  Browser/WS    │
      │   (React)       │    │   Client       │
      └─────────────────┘    └────────────────┘
```

### Data Pipeline
1. **Fetch Phase**: Every 6 hours, `syncJob.js` triggers `nasaService.js`
2. **Transform Phase**: Raw NASA JSON → Parsed asteroid objects with threat scores
3. **Persist Phase**: UPSERT into PostgreSQL (insert or update)
4. **Broadcast Phase**: Send WebSocket events & dispatch emails to subscribers
5. **Query Phase**: Frontend queries REST API or listens to WebSocket

---

## Core Technologies Deep Dive

### 1. **Node.js**
**What is it?**
- JavaScript runtime built on Chrome's V8 engine
- Event-driven, non-blocking I/O model — perfect for I/O-heavy apps (databases, APIs, file systems)
- Single-threaded event loop handles concurrent requests

**Why for NeoWatch?**
- Handles 100+ concurrent WebSocket connections efficiently without spawning threads
- Non-blocking I/O lets us fetch NASA API, query PostgreSQL, and send emails simultaneously
- JavaScript code in backend and frontend (code reuse potential)

**Key Concept: Event Loop**
```
┌─────────────────────┐
│   Single Thread     │
│  ┌───────────────┐  │
│  │  Call Stack   │  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │  Event Loop   │  │ Pulls events from queue when stack empty
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │  Task Queue   │  │ I/O callbacks, timers, promises
│  └───────────────┘  │
└─────────────────────┘
```

**NeoWatch Usage**: Our WebSocket server accepts connections without blocking HTTP requests.

---

### 2. **Express.js**
**What is it?**
- Minimalist HTTP web framework for Node.js
- Handles routing, middleware, request/response parsing
- Sits on top of Node's `http` module

**Core Concepts in NeoWatch:**

**Middleware Stack** (Layered processing)
```javascript
app.use(helmet());              // Security headers
app.use(cors());                // Cross-origin requests
app.use(express.json());        // Parse JSON bodies
app.use('/api', limiter);       // Rate limiting on /api/*
app.use('/api/asteroids', router); // Route handler
```
Each middleware transforms/validates `req` before passing to next via `next()`.

**Route Parameters & Query Strings**
```javascript
GET /api/asteroids?page=2&limit=20&threat_level=HIGH

// In handler:
const { page = 1, limit = 20, threat_level } = req.query;
// page=2, limit=20, threat_level='HIGH'
```

**Why for NeoWatch?**
- Lightweight, fast routing
- Extensive middleware ecosystem
- Perfect for building REST APIs without bloat

---

### 3. **PostgreSQL**
**What is it?**
- Advanced relational database (ACID compliant)
- Structured data in tables with typed columns
- Supports complex queries, indexing, transactions

**Core Concepts:**

**ACID Properties** (Why databases are reliable)
- **Atomicity**: All-or-nothing. If sync fails midway, entire transaction rolls back.
- **Consistency**: Data follows defined rules (foreign keys, constraints).
- **Isolation**: Concurrent queries don't interfere.
- **Durability**: Once committed, data persists even after crashes.

**NeoWatch Schema Example:**
```sql
CREATE TABLE asteroids (
  id VARCHAR(50) PRIMARY KEY,           -- Unique identifier from NASA
  name VARCHAR(255),                    -- "Apophis 2024"
  threat_score INTEGER,                 -- 0-100 calculated value
  threat_level VARCHAR(20),             -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  close_approach_date DATE,             -- When it passes Earth
  relative_velocity_kph DECIMAL(15,4),  -- Speed in km/h
  miss_distance_km DECIMAL(20,4),       -- Distance from Earth
  is_potentially_hazardous BOOLEAN,     -- NASA's classification
  last_updated_at TIMESTAMP             -- For detecting stale data
);
```

**Key Operations in NeoWatch:**

**Upsert (Insert or Update)**
```sql
INSERT INTO asteroids (id, name, threat_score, ...)
VALUES ($1, $2, $3, ...)
ON CONFLICT (id) DO UPDATE SET
  threat_score = EXCLUDED.threat_score,
  last_updated_at = NOW();
```
**Why?** If asteroid already exists (same NASA ID), update its threat score. If new, insert it.

**Window Functions** (Advanced SQL)
```sql
SELECT *, COUNT(*) OVER() AS total_count
FROM asteroids
WHERE close_approach_date >= CURRENT_DATE
ORDER BY threat_score DESC
LIMIT 20;
```
`COUNT(*) OVER()` = total rows matching WHERE (without LIMIT). Enables pagination with total row count in single query.

**Connection Pooling** (Resource Management)
```javascript
const pool = new Pool({
  max: 20,                    // Max 20 connections in pool
  idleTimeoutMillis: 30000,   // Close connection after 30sec idle
  connectionTimeoutMillis: 2000, // Fail if connection takes >2sec
});
```
**Why?** Creating new DB connections is expensive. Pool reuses them.

---

### 4. **WebSocket (ws)**
**What is it?**
- Protocol for persistent, bidirectional communication between server and client
- Unlike HTTP (request-response), WebSocket keeps connection open
- Server can **push** data to client without client asking

**HTTP vs WebSocket:**
```
HTTP:
Client: "GET /api/asteroids" ──────────> Server
Client: <────────── Response

Client: "GET /api/asteroids" ──────────> Server (polling again)
Client: <────────── Response

WebSocket:
Client ◄────── Persistent Connection ──────> Server
Client can receive data anytime without asking!
```

**NeoWatch Usage:**
```javascript
// Server broadcasts high-threat asteroids in real-time
broadcastHighThreat([asteroid1, asteroid2]);

// All connected clients receive immediately (no polling needed)
```

**Why for NeoWatch?**
- Real-time threats require instant delivery
- Polling every second wastes bandwidth & CPU
- WebSocket sends only when data changes

---

### 5. **node-cron**
**What is it?**
- Job scheduler for Node.js
- Runs tasks at specified intervals using cron syntax

**Cron Syntax:**
```
    ┌───────────── minute (0 - 59)
    │ ┌───────────── hour (0 - 23)
    │ │ ┌───────────── day of month (1 - 31)
    │ │ │ ┌───────────── month (1 - 12)
    │ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
    │ │ │ │ │
    │ │ │ │ │
    * * * * *
```

**NeoWatch Example:**
```javascript
cron.schedule('0 */6 * * *', async () => {
  // Runs at 0 min, every 6 hours: 00:00, 06:00, 12:00, 18:00
  await runSync();
});
```

**Why for NeoWatch?**
- NASA data updates every 6 hours, schedule auto-fetch
- Background job doesn't block API requests
- No manual triggering needed

---

### 6. **Nodemailer**
**What is it?**
- Sends emails from Node.js applications
- Supports multiple transports: SMTP, SendGrid, AWS SES, etc.

**NeoWatch Usage:**
```javascript
// When high-threat asteroid detected:
await sendThreatAlert(email, asteroid, threatScore);
```

**Why for NeoWatch?**
- Subscribers get immediate alerts about dangerous asteroids
- Gmail SMTP integration (free, easy setup)

---

## Design Patterns & Principles

### 1. **Separation of Concerns (SoC)**
Divide code into layers with distinct responsibilities:

```
├── routes/        → Handle HTTP requests (controllers)
├── services/      → Business logic (threat scoring, NASA fetch)
├── db/            → Database queries (queries layer)
├── jobs/          → Background task scheduling
└── websocket/     → Real-time communication
```

**NeoWatch Example:**
- **Route** (`asteroids.js`): Parse query params
- **Service** (`nasaService.js`): Fetch NASA API, validate data
- **Service** (`threatScoring.js`): Calculate threat score using algorithm
- **DB** (`index.js`): Execute UPSERT query
- **WebSocket** (`index.js`): Broadcast update to clients

**Benefit**: Change threat algorithm without touching route handlers.

---

### 2. **UPSERT Pattern (Idempotency)**
```sql
INSERT ... ON CONFLICT ... DO UPDATE
```

**Problem**: What if sync job runs twice? Should we duplicate asteroids?

**Solution**: UPSERT makes sync idempotent — running twice = same result as once.

**Real Example:**
```javascript
// Job runs at 18:00 and 18:00 (glitch makes it run twice)
// UPSERT ensures:
// - Run 1: Inserts 100 asteroids
// - Run 2: Updates same 100 asteroids (no duplicates)
```

---

### 3. **Database Connection Pooling**
```javascript
pool = new Pool({ max: 20 });
// Pool maintains 20 connections
// Each request borrows a connection, uses it, returns it
// Prevents: 1000 requests = 1000 connection attempts (expensive!)
```

---

### 4. **Middleware Pattern (Express)**
Chain of responsibility — each middleware passes control to next:
```
Request ──> helmet() ──> cors() ──> json() ──> limiter ──> routes ──> Response
```

Each can:
- Modify request (`req.body = parsed JSON`)
- Send response early (reject)
- Pass to next (`next()`)

---

### 5. **Broadcast Pattern (WebSocket)**
One-to-many messaging:
```javascript
// Server decides to broadcast
broadcastHighThreat(asteroidList);
// All connected clients receive without asking
```

---

## Expert-Level Q&A

### **Q1: Explain your system's architecture. How would you scale it to 1M concurrent users?**

**Answer Framework:**

**Current Architecture (for 100 users):**
- Single Node.js server + PostgreSQL
- WebSocket runs in-memory client set

**Bottlenecks at 1M users:**
1. **Single Node.js process**: Can't utilize multiple CPU cores
2. **Single WebSocket server**: Memory/file descriptor limits (~10K connections per process)
3. **Database connection pool**: Only 20 connections, 1M requests = queue
4. **In-memory broadcaster**: If server crashes, you lose all connections

**Scaling Strategy:**

**1. Horizontal Scaling (Multiple Processes)**
```
Load Balancer
  ├─ Node.js Server 1 (port 3001)
  ├─ Node.js Server 2 (port 3002)
  └─ Node.js Server 3 (port 3003)
```
Use **Redis Pub/Sub** for cross-server broadcasting:
```javascript
// Server 1 broadcasts
redis.publish('threats', JSON.stringify(asteroid));

// Server 2 subscribes
redis.subscribe('threats', (msg) => {
  // Broadcast to its connected clients
  broadcastToClients(msg);
});
```

**2. Database Optimization**
```javascript
// Increase pool size
const pool = new Pool({ max: 100 }); // Instead of 20

// Replicas for read-heavy queries
Primary DB (writes) ──> Replica 1 (reads)
                    ──> Replica 2 (reads)

// Queries like /api/asteroids go to replicas
```

**3. Caching Layer**
```javascript
// Redis cache frequently queried data
const asteroids = redis.get('asteroids:page:1');
if (!asteroids) {
  asteroids = await db.query(...);
  redis.set('asteroids:page:1', asteroids, 'EX', 600); // 10 min TTL
}
```

**4. Data Sharding** (for extremely large data)
```
Asteroid with ID: abc123
Shard Key = ID % 3
  → Shard 0: IDs ending in 0, 3, 6, 9...
  → Shard 1: IDs ending in 1, 4, 7...
  → Shard 2: IDs ending in 2, 5, 8...
```

---

### **Q2: How does your threat scoring algorithm work? Why those specific thresholds?**

**Answer:**

**Algorithm Overview:**
```javascript
function calculateThreatScore(asteroid) {
  let score = 0;

  // 1. Miss Distance (0-35 pts) — closest approaches = most dangerous
  const lunarDist = asteroid.miss_distance_lunar;
  if (lunarDist < 0.5 LD)      score += 35;  // Extremely close
  else if (lunarDist < 1 LD)   score += 30;  // Close
  else if (lunarDist < 3 LD)   score += 22;  // Moderate
  // ...

  // 2. Velocity (0-25 pts) — faster = more impact energy
  const vKph = asteroid.relative_velocity_kph;
  if (vKph > 150,000)          score += 25;  // Extreme speed
  // ...

  // 3. Size (0-25 pts) — larger = more damage
  const diameterKm = asteroid.estimated_diameter_max_km;
  if (diameterKm > 1 km)       score += 25;  // Extinction event
  // ...

  // 4. NASA PHA Flag (+10 pts) — expert classification
  if (asteroid.is_potentially_hazardous) score += 10;

  // 5. Days Until Approach (0-5 pts) — imminent = urgent
  const daysUntil = daysTo(asteroid.close_approach_date);
  if (daysUntil < 3)           score += 5;   // Urgent

  return score; // 0-100
}
```

**Why These Factors?**

| Factor | Impact | Example |
|--------|--------|---------|
| Miss Distance | >Distance = closer collision = more dangerous | LD = 240,900 km. 0.5 LD = 120,450 km close |
| Velocity | Energy = Mass × Velocity². Small fast object > large slow object | Dinosaur killer: 20km diameter, 20km/s |
| Size | Exponential impact damage (volume³) | 1km diameter can cause extinction |
| NASA PHA | Scientists already flagged it as hazardous | Peer review / institutional knowledge |
| Urgency | Imminent events need faster response | 3 days to impact = alert subscribers NOW |

**Weighting Rationale:**
- Miss distance = 35/100 (45%) — Most important, direct collision risk
- Velocity = 25/100 (25%) — Energy calculation
- Size = 25/100 (25%) — Damage scale
- NASA flag = 10/100 (10%) — External validation
- Urgency = 5/100 (5%) — Response time

**How Would You Validate This?**
"I'd compare NeoWatch scores with:
1. NASA's official PHA list (precision-recall)
2. Historical close approaches (calibrate against past near-misses)
3. Scientist feedback (domain expert review)"

---

### **Q3: Walk me through your NASA data sync process. How do you handle failures?**

**Answer:**

**Normal Flow:**
```
1. cron job triggers at 00:00, 06:00, 12:00, 18:00
2. runSync() called
3. nasaService fetches next 7 days of asteroid data
4. Transform each asteroid (calculate threat scores)
5. UPSERT into PostgreSQL
6. Log to fetch_logs table
7. Broadcast events: SYNC_COMPLETE, HIGH_THREAT_DETECTED, NEW_ASTEROIDS
8. Dispatch emails to subscribers
```

**Code:**
```javascript
async function runSync() {
  try {
    const result = await syncNEOData(); // ← Can fail here
    
    broadcastSyncComplete(result);
    if (highThreat.length > 0) {
      broadcastHighThreat(highThreat);
      await dispatchAlerts(highThreat);
    }
  } catch (err) {
    console.error('Sync failed:', err);
    // ❌ No retry logic — this is a gap!
  }
}
```

**Failure Scenarios & Handling:**

| Scenario | Cause | Current Handling | Better Approach |
|----------|-------|------------------|-----------------|
| NASA API timeout | Network latency | Timeout after 15s, catch error | Exponential backoff retry |
| NASA API rate limit | Too many requests | Catch error, log | Implement rate limit awareness |
| Database connection fails | Pool exhausted | Connection timeout | Queue writes when DB unavailable |
| Email service down | Gmail SMTP unavailable | Alert fails silently | Retry with exponential backoff |
| Server crashes | Process dies | All WebSocket clients disconnected | Persist state to Redis |

**Improved Error Handling:**
```javascript
async function syncWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await runSync();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      
      // Exponential backoff: 2^n seconds
      const delayMs = Math.pow(2, attempt) * 1000;
      console.log(`Retry ${attempt}/${maxRetries} after ${delayMs}ms`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
```

**Monitoring:**
```javascript
// Track success/failure rates
fetch_logs table:
  - fetched_at (timestamp)
  - asteroids_fetched (count)
  - status ('SUCCESS' | 'FAIL')
  - error_message (if FAIL)

// Dashboard query:
SELECT 
  COUNT(*) as total_syncs,
  COUNTIF(status = 'SUCCESS') as successful,
  COUNTIF(status = 'FAIL') as failed
FROM fetch_logs
WHERE fetched_at >= NOW() - INTERVAL '7 days';
```

---

### **Q4: How do you prevent WebSocket memory leaks? What happens with 10K concurrent clients?**

**Answer:**

**Current WebSocket Handler:**
```javascript
const clients = new Set();

function initWebSocket(server) {
  wss = new WebSocket.Server({ server });
  
  wss.on('connection', (ws) => {
    clients.add(ws);  // ← Client added
    
    ws.on('close', () => {
      clients.delete(ws);  // ← Client removed (cleanup)
    });
    
    ws.on('error', () => {
      clients.delete(ws);  // ← Also cleanup on error
    });
  });
}
```

**Potential Memory Leaks:**

1. **Client Never Closes Connection**
   ```javascript
   // If client crashes without closing, ws stays in Set
   // Memory grows indefinitely
   
   // Fix: Heartbeat + timeout
   wss.on('connection', (ws) => {
     ws.isAlive = true;
     ws.on('pong', () => { ws.isAlive = true; });
   });
   
   setInterval(() => {
     wss.clients.forEach(ws => {
       if (!ws.isAlive) return ws.terminate();
       ws.isAlive = false;
       ws.ping();
     });
   }, 30000); // Every 30 sec
   ```

2. **Message Event Listeners Not Removed**
   ```javascript
   // ❌ Bad
   ws.on('message', (data) => {
     // Listener never detached
   });
   
   // ✅ Good
   const messageHandler = (data) => { /* ... */ };
   ws.once('message', messageHandler); // Only listens once
   // or manually remove after use
   ```

3. **Broadcast Sends Old Data**
   ```javascript
   // ❌ If broadcast holds references to large objects
   const largeData = new Array(1000000);
   clients.forEach(ws => ws.send(largeData));
   
   // ✅ Send to all at once
   wss.broadcast(JSON.stringify(data)); // Built-in method
   ```

**Scaling to 10K Concurrent Clients:**

| Metric | 100 Clients | 10K Clients |
|--------|------------|-----------|
| Memory per client | ~100KB | 100KB × 10K = 1GB |
| CPU for broadcast | ~1ms | ~100ms (linear) |
| Node.js process limit | OK | ⚠️ Need clustering |
| File descriptors | ~200 | ~20K (OS ulimit < 64K) |

**Solution: Clustering + Redis**
```javascript
// index.js
const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster) {
  // Master process spawns workers
  for (let i = 0; i < os.cpus().length; i++) {
    cluster.fork();
  }
} else {
  // Each worker runs its own Node.js instance
  // Each can handle ~1K WebSocket clients
  server.listen(PORT);
}

// Redis broadcasts across all worker processes
const redis = require('redis');
const sub = redis.createClient();
sub.subscribe('threats', (msg) => {
  wss.broadcast(msg); // This worker's clients only
});
```

---

### **Q5: Explain your database schema design. Why these data types? How would you handle SQL injection?**

**Answer:**

**Schema Design Decisions:**

```sql
CREATE TABLE asteroids (
  id VARCHAR(50) PRIMARY KEY,
  -- ✅ Why VARCHAR? NASA provides string IDs like "2000433"
  
  name VARCHAR(255) NOT NULL,
  -- ✅ 255 chars covers all asteroid names historically
  
  threat_score INTEGER DEFAULT 0,
  -- ✅ 0-100 range, INTEGER sufficient (vs DECIMAL)
  
  close_approach_date DATE,
  -- ✅ DATE type (YYYY-MM-DD) because time irrelevant, saves space vs TIMESTAMP
  
  close_approach_date_full TIMESTAMP,
  -- ✅ TIMESTAMP for precision in analytics
  
  relative_velocity_kph DECIMAL(15,4),
  -- ✅ DECIMAL fixed precision (not FLOAT which loses digits)
  -- ✅ 15 total digits, 4 after decimal
  -- ✅ Max value: 999,999,999,999.9999 kph (enough for any asteroid)
  
  miss_distance_lunar DECIMAL(15,4),
  -- ✅ Lunar distance units = ~240,000 km = manageable with DECIMAL
  
  is_potentially_hazardous BOOLEAN DEFAULT false,
  -- ✅ Binary flag, BOOLEAN more efficient than VARCHAR('true'/'false')
  
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_updated_at TIMESTAMP DEFAULT NOW()
  -- ✅ Tracks data freshness (stale data detection)
);
```

**Why DECIMAL not FLOAT?**
```javascript
// FLOAT (64-bit IEEE 754)
console.log(0.1 + 0.2); // 0.30000000000000004 ❌ Rounding error

// DECIMAL (fixed precision)
DECIMAL(15,4) = 1234567890.1234 (exact, no rounding)
```
For financial/scientific data, precision matters.

**SQL Injection Prevention:**

**❌ Vulnerable Code:**
```javascript
const email = req.body.email; // User input: "'; DROP TABLE users; --"
const query = `SELECT * FROM alert_subscriptions WHERE email = '${email}'`;
// Query becomes: SELECT * FROM alert_subscriptions WHERE email = ''; DROP TABLE users; --'
// ❌ Deletes table!
```

**✅ Safe with Parameterized Queries:**
```javascript
const email = req.body.email;
const query = `SELECT * FROM alert_subscriptions WHERE email = $1`;
// $1 = placeholder
pool.query(query, [email]); // Parameters separate from SQL
// Driver escapes user input automatically
```

**Node.js Pattern (using pg library):**
```javascript
// ✅ Always use parameterized queries
await pool.query(
  'INSERT INTO asteroids (id, name, threat_score) VALUES ($1, $2, $3)',
  [id, name, threatScore]
);

// ❌ NEVER concatenate strings
const badQuery = `INSERT INTO asteroids VALUES ('${id}', '${name}', ${score})`;

// ✅ Prepared statements (pre-compiled by server)
// First call: Server parses & caches
// Second call: Server reuses, faster + safer
```

**Additional Defenses:**
```javascript
// 1. Input validation
const email = req.body.email;
if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
  return res.status(400).json({ error: 'Invalid email' });
}

// 2. least principle (database user)
// App connects as user with minimal permissions:
// - Can only INSERT/UPDATE/SELECT asteroids
// - Cannot DROP tables, DELETE users, etc.

// 3. Rate limiting (slow down brute force)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200  // Max 200 requests per 15 min
}));
```

---

### **Q6: How would you implement alert subscriptions? Walk through the flow.**

**Answer:**

**Database Schema:**
```sql
CREATE TABLE alert_subscriptions (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,      -- Per-user unique email
  min_threat_score INTEGER DEFAULT 70,     -- User's threshold (65-100)
  is_active BOOLEAN DEFAULT true,          -- Soft delete instead of hard delete
  created_at TIMESTAMP DEFAULT NOW(),
  last_alerted_at TIMESTAMP                -- Prevents alert spam
);

CREATE TABLE alert_history (
  id SERIAL PRIMARY KEY,
  asteroid_id VARCHAR(50),                 -- Which asteroid
  subscription_id INTEGER,                 -- Which subscriber
  threat_score INTEGER,                    -- Snapshot of score when sent
  sent_at TIMESTAMP DEFAULT NOW(),
  email_status VARCHAR(20) DEFAULT 'SENT'  -- 'SENT', 'FAILED', 'BOUNCED'
);
```

**Subscription Flow:**

**1. POST /api/alerts/subscribe**
```javascript
router.post('/subscribe', async (req, res) => {
  const { email, min_threat_score = 65 } = req.body;
  
  // Validate
  if (!email.includes('@')) return res.status(400).json({ error: 'Invalid email' });
  
  // Upsert (if exists, reactivate; if new, insert)
  const { rows } = await pool.query(
    `INSERT INTO alert_subscriptions (email, min_threat_score)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET
       is_active = true,
       min_threat_score = $2
     RETURNING *`,
    [email.toLowerCase(), Math.min(100, Math.max(0, parseInt(min_threat_score)))]
  );
  
  // Send confirmation email
  await sendConfirmationEmail(email, min_threat_score);
  
  res.json({ message: 'Subscribed!', subscription: rows[0] });
});
```

**Why UPSERT?**
- User subscribes → inserts row
- Same user subscribes again → updates row (no duplicate)
- User unsubscribes, then re-subscribes → reactivates row

**2. High-Threat Detected → Dispatch Alert**
```javascript
async function dispatchAlerts(highThreatAsteroids) {
  // Get all active subscribers
  const { rows: subscribers } = await pool.query(
    `SELECT * FROM alert_subscriptions WHERE is_active = true`
  );
  
  // For each asteroid, notify interested subscribers
  for (const asteroid of highThreatAsteroids) {
    for (const subscriber of subscribers) {
      // Check if asteroid meets subscriber's threshold
      if (asteroid.threat_score >= subscriber.min_threat_score) {
        try {
          // Send Email
          await sendThreatAlert(subscriber.email, asteroid);
          
          // Log success
          await pool.query(
            `INSERT INTO alert_history (asteroid_id, subscription_id, threat_score, email_status)
             VALUES ($1, $2, $3, 'SENT')`,
            [asteroid.id, subscriber.id, asteroid.threat_score]
          );
          
        } catch (err) {
          console.error(`Email failed for ${subscriber.email}:`, err);
          
          // Log failure
          await pool.query(
            `INSERT INTO alert_history (..., email_status) VALUES (..., 'FAILED')`
          );
        }
      }
    }
  }
}
```

**Email Content:**
```javascript
async function sendThreatAlert(email, asteroid) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
  
  const htmlContent = `
    <h2>⚠️ HIGH-THREAT ASTEROID ALERT</h2>
    <p>Asteroid: <strong>${asteroid.name}</strong></p>
    <p>Threat Score: <strong>${asteroid.threat_score}/100</strong></p>
    <p>Closest Approach: <strong>${asteroid.close_approach_date}</strong></p>
    <p>Miss Distance: <strong>${asteroid.miss_distance_lunar} Lunar Distances</strong></p>
    <p><a href="${process.env.FRONTEND_URL}">View Details</a></p>
  `;
  
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: email,
    subject: `🚨 ALERT: ${asteroid.name} threat score ${asteroid.threat_score}`,
    html: htmlContent
  });
}
```

**3. Unsubscribe Flow**
```javascript
router.delete('/unsubscribe', async (req, res) => {
  const { email } = req.body;
  
  // Soft delete — keep history, just mark inactive
  await pool.query(
    `UPDATE alert_subscriptions SET is_active = false WHERE email = $1`,
    [email.toLowerCase()]
  );
  
  res.json({ message: 'Unsubscribed' });
});
```

**Why soft delete?**
- Preserves alert history for audits
- User can resubscribe easily
- Don't lose data insights

**Spam Prevention:**
```javascript
// Only alert once per asteroid per subscriber
const { rows } = await pool.query(
  `SELECT * FROM alert_history 
   WHERE asteroid_id = $1 AND subscription_id = $2`,
  [asteroid.id, subscriber.id]
);

if (rows.length > 0) {
  // Already alerted for this asteroid, skip
  return;
}
```

---

### **Q7: How do you monitor and debug your backend? What metrics matter?**

**Answer:**

**Key Metrics:**

| Metric | Why | Good Value | Warning |
|--------|-----|-----------|---------|
| Response Time (p95) | User experience | <200ms | >1s = slow |
| Error Rate | System health | <0.1% | >1% = critical |
| WebSocket Active Connections | Scalability | 100-1K | >10K = overloaded |
| Database Query Time (p95) | Bottleneck detect | <50ms | >500ms = slow |
| Sync Success Rate | Data integrity | >99.9% | <99% = bad syncs |
| CPU Usage | Infrastructure cost | 30-60% | >85% = near capacity |
| Memory Usage | Resource leak detection | Stable | Growing = leak |

**Monitoring Stack:**

```javascript
// 1. Application Logging
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Usage
logger.info('Sync started', { asteroids: 100 });
logger.error('Database connection failed', { error: err.message });
```

**2. Performance Monitoring (Express Middleware)**
```javascript
// Track response times
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration_ms: duration
    });
    
    // Alert if slow
    if (duration > 1000) {
      logger.warn('Slow request', { path: req.path, duration_ms: duration });
    }
  });
  
  next();
});
```

**3. Database Query Monitoring**
```javascript
// Log slow queries
pool.on('query', (query) => {
  if (query.duration > 500) {
    logger.warn('Slow query', {
      sql: query.text,
      duration_ms: query.duration
    });
  }
});
```

**4. WebSocket Metrics**
```javascript
function getWebSocketMetrics() {
  return {
    connected_clients: clients.size,
    memory_per_client_kb: Math.round(process.memoryUsage().heapUsed / clients.size / 1024),
    uptime_seconds: process.uptime()
  };
}

// Expose via health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational',
    ...getWebSocketMetrics()
  });
});
```

**5. Infrastructure Monitoring (External Services)**
```
Recommended:
- Prometheus (metrics collection)
- Grafana (visualization)
- Sentry (error tracking)
- DataDog / New Relic (full stack APM)
```

**Debugging Strategies:**

```javascript
// Add request IDs for tracing
const uuid = require('uuid');

app.use((req, res, next) => {
  req.id = uuid.v4();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Log with context
logger.info('Asteroid fetched', {
  request_id: req.id,
  asteroid_id: asteroid.id,
  threat_score: asteroid.threat_score
});
```

**Common Issues & Debugging:**

| Issue | Debug Method | Solution |
|-------|--------------|----------|
| High memory usage | `process.memoryUsage()` | Check for memory leaks, increase GC frequency |
| Slow queries | `EXPLAIN ANALYZE [query]` | Add indexes, optimize SELECT |
| WebSocket crashes | Check error logs | Client connection handling |
| Sync failures | Examine fetch_logs table | Retry logic, fallback data source |

---

## Data Flow Walkthrough

**End-to-End Scenario: High-Threat Asteroid Detected**

```
1. CRON JOB TRIGGERS
   └─> 18:00 UTC → node-cron triggers runSync()

2. NASA API FETCH
   └─> nasaService.fetchAsteroidsFromNASA('2025-01-10', '2025-01-17')
   └─> Response: 50 asteroids with orbital data

3. TRANSFORM
   └─> For each asteroid:
       ├─> Parse NASA JSON
       ├─> Calculate threat score (0-100)
       ├─> Determine threat level (LOW/MEDIUM/HIGH/CRITICAL)
       └─> Create asteroid object

4. UPSERT INTO DATABASE
   └─> For each transformed asteroid:
       ├─> Check if exists (id as primary key)
       ├─> If exists: UPDATE threat_score, last_updated_at
       ├─> If new: INSERT all fields
       └─> Return INSERT/UPDATE flag

5. FILTER HIGH-THREAT
   └─> Filter asteroids where threat_score >= 65
   └─> Result: [asteroid_1: 78, asteroid_2: 92]

6. BROADCAST TO CLIENTS (WebSocket)
   └─> broadcastHighThreat([asteroid_1, asteroid_2])
   └─> All connected browsers receive:
       {
         type: 'HIGH_THREAT_DETECTED',
         data: [{ id, name, threat_score, close_approach_date }, ...],
         timestamp: '2025-01-10T18:00:00Z'
       }
   └─> Browser updates UI: red alert badge spins, threat ring shakes

7. DISPATCH EMAIL ALERTS
   └─> Query alert_subscriptions WHERE is_active = true
   └─> For each subscriber:
       ├─> If asteroid.threat_score >= subscriber.min_threat_score:
       │   ├─> Compose email
       │   ├─> Send via Nodemailer/Gmail SMTP
       │   └─> Log to alert_history (SENT | FAILED)
       └─> Else: skip

8. REST API QUERIES
   └─> Frontend makes: GET /api/asteroids?threat_level=HIGH
   └─> Backend queries:
       SELECT * FROM asteroids
       WHERE threat_level = 'HIGH'
       AND close_approach_date >= CURRENT_DATE
       ORDER BY threat_score DESC
   └─> Returns paginated results with total count

9. PERSIST TO DATABASE
   └─> fetch_logs INSERT:
       fetched_at: NOW(),
       asteroids_fetched: 50,
       high_threat_count: 2,
       status: 'SUCCESS'
   └─> Audit trail for troubleshooting
```

---

## Performance & Optimization

### Bottleneck Analysis

**Scenario: 100 requests/sec hitting /api/asteroids**

```
Request Flow:
┌──────────────────────────────┐
│ 100 req/sec                  │
│ GET /api/asteroids?page=1    │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Express Router (fast)        │
│ Parse query params: O(1)     │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Rate Limiter Check (fast)    │
│ O(1) token bucket lookup     │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ DATABASE QUERY (SLOW!) ⚠️    │
│ SELECT * FROM asteroids      │
│ WHERE threat_level = ...     │
│ ORDER BY threat_score DESC   │
│ LIMIT 20 OFFSET 0            │
│ ← Takes 100-500ms!           │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ JSON Serialization (medium)  │
│ O(n) where n = rows returned │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Send Response (fast)         │
└──────────────────────────────┘
```

**Optimization Techniques:**

### 1. **Database Indexing**
```sql
-- Without index: Full table scan O(n)
SELECT * FROM asteroids WHERE threat_level = 'HIGH';

-- With index: Binary search O(log n)
CREATE INDEX idx_threat_level ON asteroids(threat_level);

-- Composite index: Multiple columns
CREATE INDEX idx_approach_threat ON asteroids(close_approach_date, threat_level);
```

### 2. **Query Optimization**
```sql
-- ❌ Slow: Fetch all, filter in code
SELECT * FROM asteroids;  -- 100K rows

-- ✅ Fast: Filter in database
SELECT * FROM asteroids 
WHERE threat_level = 'HIGH' 
AND close_approach_date >= CURRENT_DATE
LIMIT 20;  -- 20 rows returned to server
```

### 3. **Connection Pooling** (Already implemented)
```javascript
// Max 20 reusable connections
// Without pool: Create new connection per request (expensive!)
// With pool: Borrow connection, execute, return
```

### 4. **Caching** (Client-side & Server-side)
```javascript
// Redis Cache Frequently Accessed Data
const redis = require('redis');
const client = redis.createClient();

app.get('/api/asteroids/stats', async (req, res) => {
  // Check cache first
  const cached = await client.get('asteroids:stats');
  if (cached) return res.json(JSON.parse(cached));
  
  // Cache miss: query database
  const stats = await pool.query('SELECT ...');
  
  // Cache result for 5 minutes
  await client.setex('asteroids:stats', 300, JSON.stringify(stats));
  
  res.json(stats);
});
```

### 5. **Query Result Pagination**
```sql
-- ❌ Returns all 100K rows every time
SELECT * FROM asteroids;

-- ✅ Returns only 20 rows
SELECT * FROM asteroids LIMIT 20 OFFSET 0;
SELECT * FROM asteroids LIMIT 20 OFFSET 20;  -- Page 2
```

### 6. **Database Query Plan Analysis**
```sql
EXPLAIN ANALYZE
SELECT * FROM asteroids
WHERE threat_level = 'HIGH'
ORDER BY threat_score DESC
LIMIT 20;

-- Output:
-- Seq Scan on asteroids  (← Bad! Full table scan)
-- Planning Time: 0.345 ms
-- Execution Time: 234.567 ms  (← 234ms is slow)
```

**Add Index:**
```sql
CREATE INDEX idx_threat_score ON asteroids(threat_score DESC);

-- Now:
-- Index Scan using idx_threat_score  (← Much better!)
-- Execution Time: 5.234 ms  (← 5ms vs 234ms!)
```

---

## Security & Best Practices

### 1. **Environment Variables**
```javascript
// ❌ Never hardcode secrets
const apiKey = '12345-secret-key-abcdef';

// ✅ Use environment variables
const apiKey = process.env.NASA_API_KEY;

// .env file (NOT in git):
NASA_API_KEY=12345-secret-key-abcdef
DATABASE_URL=postgresql://user:password@host:5432/db
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### 2. **Rate Limiting**
```javascript
// Prevent DDoS, brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,                  // Max 200 requests per window
  keyGenerator: (req) => req.ip,  // Per IP address
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests' });
  }
});

app.use('/api', limiter);
```

### 3. **CORS (Cross-Origin Resource Sharing)**
```javascript
// ✅ Whitelist only trusted origins
app.use(cors({
  origin: process.env.FRONTEND_URL,  // e.g., https://neowatch.com
  credentials: true,
  methods: ['GET', 'POST', 'DELETE']
}));

// ❌ Allow all origins (insecure)
app.use(cors());
```

### 4. **Security Headers** (Helmet)
```javascript
// Automatically adds:
// - Content-Security-Policy (prevents XSS)
// - X-Frame-Options: DENY (prevents clickjacking)
// - Strict-Transport-Security (forces HTTPS)
app.use(helmet());
```

### 5. **Input Validation**
```javascript
router.post('/subscribe', (req, res) => {
  const { email, min_threat_score } = req.body;
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  
  // Validate score range
  if (min_threat_score < 0 || min_threat_score > 100) {
    return res.status(400).json({ error: 'Score must be 0-100' });
  }
  
  // Safe to proceed
});
```

### 6. **Error Handling** (Don't leak stack traces)
```javascript
// ❌ Leaks internal details
app.get('/api/asteroids', async (req, res) => {
  try {
    await db.query(...);
  } catch (err) {
    res.status(500).json({ error: err.stack });  // Exposes file paths!
  }
});

// ✅ Generic error message
app.get('/api/asteroids', async (req, res) => {
  try {
    await db.query(...);
  } catch (err) {
    console.error(err);  // Log internally
    res.status(500).json({ error: 'Internal server error' });  // Generic response
  }
});
```

### 7. **HTTPS Only (in Production)**
```javascript
// For local dev
// http://localhost:3001

// For production
// https://api.neowatch.com (SSL certificate required)

// Force HTTPS
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
});
```

---

## Common Interview Follow-ups

**Q: "Tell me about a time you debugged a difficult issue."**
- Describe a real problem from your project
- Walk through systematic debugging approach
- Show technical depth

**Q: "How would you improve your current architecture?"**
- Identify bottlenecks (response time, throughput, cost)
- Propose solutions with tradeoffs
- Consider scaling, monitoring, resilience

**Q: "Explain your database migration strategy."**
```javascript
// Version-based migrations
migrations/
  ├── 001_create_asteroids_table.sql
  ├── 002_add_threat_level_column.sql
  └── 003_create_alert_subscriptions.sql

// On deployment: Run all unapplied migrations in order
// Prevents: Schema mismatch, data loss
```

**Q: "How do you handle concurrency?"**
- Database ACID guarantees prevent race conditions
- Connection pooling prevents thread exhaustion
- Node.js single-threaded prevents data races
- WebSocket broadcasts ensure consistency

**Q: "What would you do differently if rebuilding?"**
- Add comprehensive logging upfront
- Use TypeScript for type safety
- Implement GraphQL for flexible queries
- Add integration tests
- Use structured logging (JSON) for ELK stack

---

## Quick Reference Cheat Sheet

| Topic | Key Takeaway |
|-------|--------------|
| **Architecture** | Separate routes, services, database layers; enables independent scaling |
| **Threat Scoring** | Multi-factor algorithm: distance (35%) + velocity (25%) + size (25%) + NASA flag (10%) + urgency (5%) |
| **WebSocket** | Persistent bidirectional connection; ideal for real-time updates vs HTTP polling |
| **Database** | Upsert pattern for idempotency; indexes for query speed; connection pooling for scalability |
| **Error Handling** | Retry with exponential backoff; log for debugging; generic responses to clients |
| **Security** | Parameterized queries (SQL injection); rate limiting (DDoS); input validation |
| **Monitoring** | Track response times, error rates, active connections; use logging & external APM |
| **Scaling** | Clustering + Redis Pub/Sub for horizontal scaling; database replication for read scalability |

---

## Practice Questions

1. **Explain how the threat scoring algorithm works. Why those weights?**
2. **Walk through the NASA data sync process. What happens if sync fails?**
3. **How do you prevent WebSocket memory leaks with 10K concurrent clients?**
4. **Design a caching strategy to reduce database load by 80%.**
5. **Describe your approach to debugging a slow API endpoint (p95 > 1s).**
6. **How would you prevent SQL injection?**
7. **Explain ACID properties and how they apply to your alert subscription system.**
8. **What's a Windows function in SQL? Give a NeoWatch example.**
9. **How would you handle email delivery failures gracefully?**
10. **Design a notification system that works offline (user reconnects later).**

---

**Good Luck on Your Interview! 🚀**

Remember:
- Explain your reasoning, not just the answer
- Dig deeper than surface-level (follow-ups!)
- Relate everything back to NeoWatch if possible
- Ask clarifying questions if uncertain
- Show you understand tradeoffs (no perfect solutions)
