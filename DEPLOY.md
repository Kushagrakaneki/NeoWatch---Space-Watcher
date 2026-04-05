# NeoWatch — Deployment Guide
## Go live in 15 minutes, completely free

---

## Option A — Railway (Recommended, Free Tier)

Railway gives you a free PostgreSQL database + backend hosting in one place.

### Step 1 — Get your NASA API key
1. Go to https://api.nasa.gov
2. Fill in your name and email → click "Sign Up"
3. You'll receive an API key by email instantly (free, 1000 req/hour)

### Step 2 — Get your Gmail App Password
1. Enable 2-Factor Authentication on your Google account
2. Go to: https://myaccount.google.com/apppasswords
3. Select "Mail" → Generate
4. Copy the 16-character password (this is your `GMAIL_APP_PASSWORD`)

### Step 3 — Deploy backend to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# From the neowatch/ root folder:
cd backend
railway init          # creates a new project
railway add           # add a PostgreSQL plugin

# Set environment variables
railway variables set NASA_API_KEY=your_key_here
railway variables set GMAIL_USER=your@gmail.com
railway variables set GMAIL_APP_PASSWORD=your_16_char_password
railway variables set ALERT_THRESHOLD=65
railway variables set NODE_ENV=production

# Deploy
railway up
```

Railway auto-sets `DATABASE_URL` when you add the PostgreSQL plugin.

After deploy, Railway gives you a URL like:
`https://neowatch-api-production.up.railway.app`

### Step 4 — Run migrations
```bash
railway run npm run migrate
railway run npm run seed    # optional: demo data without NASA key
```

### Step 5 — Deploy frontend to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

cd ../frontend

# Update vite.config.js — replace proxy with your Railway URL:
# proxy: {
#   '/api': { target: 'https://your-railway-url.up.railway.app', ... }
#   '/ws': { target: 'wss://your-railway-url.up.railway.app', ... }
# }

vercel          # follow prompts
vercel --prod   # deploy to production
```

Vercel gives you a URL like: `https://neowatch.vercel.app`

### Step 6 — Update CORS
```bash
railway variables set FRONTEND_URL=https://neowatch.vercel.app
railway up   # redeploy
```

**Total cost: $0** ✅

---

## Option B — Render (Alternative Free Tier)

### Backend
1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables in the Render dashboard
6. Add a free PostgreSQL database from Render dashboard

### Frontend
1. New → Static Site on Render
2. Build command: `npm run build`
3. Publish directory: `dist`

---

## Option C — Local Network (Share with 10–20 people)

If everyone is on the same WiFi (hackathon, college demo):

```bash
# 1. Find your local IP
ipconfig    # Windows
ifconfig    # Mac/Linux
# Look for something like 192.168.1.x

# 2. Start backend (binds to all interfaces)
cd backend && npm run dev

# 3. Start frontend with host flag
cd frontend && npm run dev -- --host

# 4. Share: http://192.168.1.YOUR_IP:5173
# Anyone on the same WiFi can now access NeoWatch!
```

---

## After Deployment — Resume Bullet

```
NeoWatch | Node.js · PostgreSQL · React · WebSocket · NASA API

Built a real-time asteroid threat intelligence platform using NASA's
Near Earth Object Web Service. Designed a custom 5-factor threat
scoring algorithm (0–100) combining orbital mechanics (miss distance,
velocity) with physical properties (diameter, PHA classification) and
temporal urgency. Features WebSocket live feed, automated email alerts
via cron-driven NASA data sync, animated proximity radar, and orbital
visualization. Deployed on Railway + Vercel.
```

---

## Interview Talking Points

**"Walk me through your threat scoring algorithm"**
> "I score each asteroid 0–100 across five weighted factors: miss distance in lunar units (max 35 points), relative velocity in km/h (max 25), estimated diameter (max 25), NASA's own hazardous flag (+10), and days until closest approach (+5 urgency bonus). The weights reflect real astronomical risk — a large slow object far away is less dangerous than a tiny fast one at half a lunar distance."

**"How does the real-time update work?"**
> "A cron job fires every 6 hours and calls NASA's NeoWS API for the next 7 days of close approaches. After transforming and upserting to PostgreSQL, it broadcasts a SYNC_COMPLETE event over WebSocket to all connected clients. If any object scores above the HIGH threshold, it also dispatches email alerts with a 24-hour per-subscriber deduplication check to avoid spam."

**"What would you change at 10x scale?"**
> "Right now the cron job runs in-process. At scale I'd move it to a dedicated worker with a message queue — Kafka or BullMQ. The threat scoring is pure computation so it could become a separate microservice. I'd also add Redis for caching the stats endpoint, which gets hit on every dashboard load."

**"Why PostgreSQL over MongoDB for this?"**
> "The data is highly structured and relational — asteroids have relationships to alert history, subscriptions, and fetch logs. I also wanted to use PostgreSQL's window functions and CTEs for the stats queries. The threat score sorting and filtering maps naturally to SQL indexes. MongoDB would be overkill here."
