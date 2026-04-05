# NeoWatch 🛰️
### Near Earth Object Threat Intelligence Platform

Real-time asteroid proximity monitoring using NASA NeoWS data. Scores each asteroid 0–100 using a custom threat algorithm, delivers live updates via WebSocket, and dispatches email alerts when dangerous objects approach Earth.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js, Express, WebSocket (ws) |
| Database | PostgreSQL |
| Frontend | React, Vite, Recharts |
| Email | Nodemailer + Gmail SMTP |
| Jobs | node-cron |
| Data | NASA NeoWS API (free) |
| DevOps | Docker, docker-compose |

---

## Architecture

```
NASA NeoWS API
      │
      ▼ (every 6 hours via cron)
  nasaService.js ──► threatScoring.js (0–100 score)
      │
      ▼
  PostgreSQL (asteroids, subscriptions, alert_history)
      │
      ├──► REST API  (Express routes)
      │         └── /api/asteroids  (paginated, filtered)
      │         └── /api/asteroids/stats
      │         └── /api/asteroids/critical
      │         └── /api/alerts/subscribe
      │
      └──► WebSocket broadcast (ws://)
                └── SYNC_COMPLETE
                └── HIGH_THREAT_DETECTED
                └── NEW_ASTEROIDS
      │
      └──► Email alerts (Nodemailer → Gmail SMTP)
```

---

## Threat Scoring Algorithm

Each asteroid is scored 0–100 based on:

| Factor | Max Points | Logic |
|--------|-----------|-------|
| Miss distance | 35 | <0.5 lunar distances = 35pts |
| Velocity | 25 | >150,000 km/h = 25pts |
| Diameter | 25 | >1km = 25pts (extinction class) |
| NASA PHA flag | 10 | Hard bonus for confirmed hazardous |
| Days until approach | 5 | Imminent (<3 days) = 5pts |

**Levels:** LOW (0–39) · MEDIUM (40–64) · HIGH (65–84) · CRITICAL (85–100)

---

## Quick Start

### Option 1 — Docker (recommended)

```bash
git clone <repo>
cd neowatch

# Set your environment variables
cp backend/.env.example .env
# Edit .env with your NASA API key and Gmail credentials

docker-compose up --build
```

Open http://localhost:5173

### Option 2 — Manual

**Prerequisites:** Node.js 18+, PostgreSQL 14+

```bash
# 1. Setup backend
cd backend
cp .env.example .env        # Fill in your values
npm install
npm run migrate             # Creates all DB tables
npm run dev                 # Starts on :3001

# 2. Setup frontend (new terminal)
cd frontend
npm install
npm run dev                 # Starts on :5173
```

---

## Environment Variables

```env
NASA_API_KEY=          # From https://api.nasa.gov (free, instant)
DATABASE_URL=          # postgresql://user:pass@host:5432/neowatch
GMAIL_USER=            # your@gmail.com
GMAIL_APP_PASSWORD=    # 16-char app password (not your login password)
ALERT_THRESHOLD=65     # Min threat score to trigger email
PORT=3001
FRONTEND_URL=http://localhost:5173
```

**Getting a Gmail App Password:**
1. Enable 2FA on your Google account
2. Go to Google Account → Security → App Passwords
3. Generate one for "Mail" — use the 16-char code as GMAIL_APP_PASSWORD

---

## API Reference

```
GET  /api/asteroids              # List asteroids (paginated)
     ?page=1&limit=25
     ?threat_level=HIGH
     ?sort=threat_score&order=DESC
     ?days=7

GET  /api/asteroids/stats        # Dashboard statistics
GET  /api/asteroids/critical     # Top 5 highest threat score
GET  /api/asteroids/:id          # Single asteroid detail
POST /api/asteroids/sync         # Manual NASA sync trigger

POST   /api/alerts/subscribe     # { email, min_threat_score }
DELETE /api/alerts/unsubscribe   # { email }
GET    /api/alerts/history       # Recent email dispatch log

GET  /api/health                 # Service health + WS client count

WS   ws://localhost:3001/ws      # Live event stream
```

---

## WebSocket Events

```json
{ "type": "CONNECTED",            "timestamp": "..." }
{ "type": "SYNC_COMPLETE",        "data": { "total": 42, "inserted": 5, "highThreatCount": 2 } }
{ "type": "HIGH_THREAT_DETECTED", "data": { "count": 2, "asteroids": [...] } }
{ "type": "NEW_ASTEROIDS",        "data": { "count": 5, "asteroids": [...] } }
{ "type": "PONG",                 "timestamp": "..." }
```

---

## What I Learned / Talking Points

- **Custom scoring algorithm** — designed a multi-factor weighted scoring system combining physical properties (size, velocity) with orbital mechanics (miss distance) and temporal urgency (days until approach)
- **Real-time architecture** — WebSocket server shares the same HTTP server via `http.createServer()`, enabling efficient upgrade handling
- **Idempotent data sync** — PostgreSQL `ON CONFLICT DO UPDATE` ensures re-runs don't create duplicates; only recalculates threat scores
- **Alert deduplication** — 24-hour cooldown window per (asteroid, subscriber) pair prevents spam
- **Rate limiting** — 200 requests per 15 minutes on all API routes via express-rate-limit
- **Data normalization** — NASA returns nested JSON; transformAsteroid() flattens and validates before DB insertion
- **Free tier friendly** — NASA DEMO_KEY works for development, full key gets 1000 req/hr

---

Built with ❤️ using NASA's public NeoWS API.
Data source: [NASA Near Earth Object Web Service](https://api.nasa.gov/)
