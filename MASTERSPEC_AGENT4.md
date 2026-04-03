# NeoAgri Voice — Full From-Scratch Agent Spec
**Hackathon:** ABV IIITM Hacksagon | **36 Hours** | **Model:** Gemini 3.1 Pro → fallback Claude Opus 4.6
> Everything is built from scratch. No prior code exists. Read every section before writing a single line.

---

## COMMIT RULES (Non-Negotiable for All Agents)

```
Format: [A{n}] type(scope): short description

Types: feat | fix | chore | refactor | test
Scope: area of change (e.g. audio, webrtc, tools, ui, db, backend)

Examples:
  [A1] feat(audio): setup expo-av recording with PCM16 format
  [A2] feat(tools): add scan_nearby_markers schema and handler
  [A3] feat(orb): VoiceOrb idle and listening state animations
  [A4] feat(backend): POST /voice/session ephemeral token route

Rules:
  - Commit after EVERY completed todo item — not in batches
  - Max 5 files per commit
  - Never commit broken/crashing code — test before commit
  - Write a one-line description in the commit body if the change is non-obvious
```

---

## MASTER SPEC — All Agents Read First

### What We're Building
NeoAgri Voice is a **voice-only agentic mobile app** for Indian soybean farmers. Built on Expo SDK 54 / React Native 0.81.5. The farmer speaks Hindi commands — the app detects crop diseases using an on-device TFLite model, navigates to GPS pins from drone scans, and works completely offline in the field.

### Two Separate Backends (Never Confuse)
| Backend | Repo | Role |
|---|---|---|
| `neo-backend` | Agent 4 builds | Node/Express API — farmer app talks to this |
| `website_station_backend` | **Pre-exists, do not touch** | Python drone server — out of scope |

### Project Structure (Both Repos — Create From Scratch)

```
neoagri-mobile/                     ← Expo app
├── app/
│   ├── index.jsx                   ← Main voice screen (Agent 3)
│   ├── live.jsx                    ← Camera + TFLite screen (Agent 3)
│   └── radar.jsx                   ← GPS navigation screen (Agent 3)
├── components/
│   └── voice/
│       ├── VoiceOrb.js             (Agent 3)
│       ├── TranscriptFeed.js       (Agent 3)
│       ├── DiseaseCard.js          (Agent 3)
│       └── StatusBanner.js         (Agent 3)
├── lib/
│   ├── useVoiceSession.js          (Agent 1)
│   ├── audioPlayer.js              (Agent 1)
│   ├── voiceKeywords.js            (Agent 1)
│   ├── VoiceAgentTools.js          (Agent 2)
│   ├── voiceEventEmitter.js        (Agent 2)
│   └── voiceStyles.js              (Agent 3)
├── db/
│   ├── schema.js                   (Agent 2)
│   └── offlineSync.js              (Agent 2)
├── constants/
│   └── voicePrompt.js              (Agent 2)
├── models/
│   ├── neoagri_app_model.tflite    ← Binary — download separately
│   └── disease_labels.json         (Agent 2)
├── agent_docs/
│   ├── progress.md                 ← Each agent updates after every phase
│   ├── architecture.md
│   ├── backend.md
│   └── native_setup.md
└── .env

neo-backend/                        ← Express API
├── src/
│   ├── app.js
│   ├── db.js
│   ├── routes/
│   │   ├── payload.js
│   │   ├── markers.js
│   │   ├── scans.js
│   │   └── voice.js                (Agent 4)
│   └── migrations/
│       ├── 001_init.sql
│       └── 002_voice_logs.sql
├── .env
└── package.json
```

### Absolute Rules
1. **JavaScript only** — never `.ts`, never `interface`, never `: string` type annotations
2. **react-native-fast-tflite** for ML — never TensorFlow.js
3. **expo-sqlite** for structured data — never AsyncStorage
4. **expo-speech** with `language: 'hi-IN'` for all Hindi TTS
5. **Offline always degrades gracefully** — check network before every API call
6. **VisionCamera worklets stay as worklets** — no async calls inside frame processors
7. **Never hardcode OpenAI API key in mobile app** — always use ephemeral token from `/voice/session`
8. **Update `agent_docs/progress.md` after every phase** — this is how agents stay in sync

### TFLite Model Output (Agent 2 must use this exactly)
```
Model: models/neoagri_app_model.tflite
Input: float32[1][224][224][3]  (normalized 0–1, RGB)
Output: float32[4]

Index → Disease mapping:
  0 → "Caterpillar and Semilooper Pest Attack"  severity: High
  1 → "Healthy Soyabean"                         severity: None
  2 → "Soyabean Frog Leaf Eye"                   severity: Medium
  3 → "Soyabean Spectoria Brown Spot"            severity: Medium
```

### Inter-Agent Contracts (Do Not Change Signatures Without Notifying All Agents)
```js
// Agent 1 exports from lib/useVoiceSession.js
export function useVoiceSession(toolHandlers)
→ { status, transcript, history, isListening, amplitude, startSession, stopSession, speak }
// status: 'idle'|'connecting'|'listening'|'speaking'|'offline'
// amplitude: number 0.0–1.0 (mic level, used by VoiceOrb)

// Agent 2 exports from lib/VoiceAgentTools.js
export const TOOL_SCHEMAS   // Array — OpenAI function_call schemas
export const TOOL_HANDLERS  // Object — { toolName: async (args) => string }
export const SYSTEM_PROMPT  // String
export async function dispatchTool(name, args) → string

// Agent 2 exports from lib/voiceEventEmitter.js
export const voiceEventEmitter  // EventEmitter instance
// Events: 'NAVIGATE' | 'DISEASE_RESULT' | 'SCAN_COMPLETE'

// Agent 2 exports from db/offlineSync.js
export async function getOfflineMarkers() → Array<Marker>
export async function saveScan(scanData) → void
export async function getPendingScans() → Array<Scan>
export async function syncPendingScans() → { synced: number }
export async function initDB() → void

// Agent 4 backend contracts
POST /voice/session → { client_secret, session_id, expires_at }
POST /voice/log     → { ok: true }
POST /payload/receive → { ok: true }       (drone backend — NOT voice related)
GET  /markers       → Array<Marker>
POST /scan/sync     → { synced: number }
```

### Git Worktree Setup (Run Once — All Agents)
```bash
# In neoagri-mobile root:
git init && git add . && git commit -m "chore: initial project scaffold"
git branch voice/pipeline && git branch voice/tools
git branch voice/ui && git branch voice/backend

git worktree add ../neoagri-pipeline  voice/pipeline   # Agent 1
git worktree add ../neoagri-tools     voice/tools      # Agent 2
git worktree add ../neoagri-ui        voice/ui         # Agent 3
# Agent 4 works in neo-backend repo, separate from mobile

# Merge order when done: tools → pipeline → ui → main
```

### Environment Files
```env
# neoagri-mobile/.env
EXPO_PUBLIC_API_URL=https://your-neo-backend.railway.app
EXPO_PUBLIC_OPENAI_MODEL=gpt-4o-realtime-preview-2025-12-17

# neo-backend/.env
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:pass@host:5432/neoagri
PORT=3001
NODE_ENV=production
```

---
---

---
---

## AGENT 4 — Backend + Integration
**Branch:** `voice/backend` (separate `neo-backend` repo) | **Unblocks:** All agents (needs deployed URL)
**HIGHEST PRIORITY:** Deploy `/voice/session` in first 3 hours.

---

### Day-0 Setup

- [ ] **S4.1** Init Node.js project
  ```bash
  mkdir neo-backend && cd neo-backend
  npm init -y
  npm install express pg dotenv cors helmet morgan
  npm install -D nodemon
  ```
  `[A4] chore(init): init express project with pg, cors, helmet`

- [ ] **S4.2** Create `src/app.js` — Express app skeleton
  ```js
  const express = require('express')
  const cors = require('cors')
  const helmet = require('helmet')
  const morgan = require('morgan')
  
  const app = express()
  app.use(helmet())
  app.use(cors())
  app.use(morgan('tiny'))
  app.use(express.json({ limit: '10mb' }))  // drone images are large
  
  app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }))
  
  module.exports = app
  ```
  `[A4] feat(app): create Express app with middleware`

- [ ] **S4.3** Create `src/db.js` — Postgres connection pool
  ```js
  const { Pool } = require('pg')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  module.exports = { query: (text, params) => pool.query(text, params) }
  ```
  `[A4] feat(db): create Postgres connection pool`

- [ ] **S4.4** Create `src/server.js` — entry point
  ```js
  require('dotenv').config()
  const app = require('./app')
  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => console.log(`neo-backend running on ${PORT}`))
  ```
  `[A4] feat(server): create server entry point`

---

### Phase 1 — Database Migrations (Run These First)

- [ ] **1.1** Create `src/migrations/001_init.sql`
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  
  CREATE TABLE IF NOT EXISTS drone_markers (
    id SERIAL PRIMARY KEY,
    capture_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    disease TEXT,
    confidence DOUBLE PRECISION,
    leaf_image_b64 TEXT,
    schema_version TEXT DEFAULT '1.0',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE TABLE IF NOT EXISTS manual_scans (
    id SERIAL PRIMARY KEY,
    capture_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    disease TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    timestamp_utc TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
  `[A4] feat(db): create 001_init migration for drone_markers and manual_scans`

- [ ] **1.2** Create `src/migrations/002_voice_logs.sql`
  ```sql
  CREATE TABLE IF NOT EXISTS voice_logs (
    id SERIAL PRIMARY KEY,
    session_id TEXT,
    command TEXT,
    tool_called TEXT,
    result_preview TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
  `[A4] feat(db): create 002 migration for voice_logs`

- [ ] **1.3** Create `src/migrate.js` runner and run both migrations
  ```js
  async function migrate() {
    const fs = require('fs')
    const db = require('./db')
    const files = ['001_init.sql', '002_voice_logs.sql']
    for (const f of files) {
      const sql = fs.readFileSync(`./src/migrations/${f}`, 'utf8')
      await db.query(sql)
      console.log(`✓ ${f}`)
    }
    process.exit(0)
  }
  migrate().catch(e => { console.error(e); process.exit(1) })
  ```
  `[A4] feat(db): create migration runner and run all migrations`

---

### Phase 2 — Core API Routes

- [ ] **2.1** Create `src/routes/payload.js` — drone scan receiver
  ```js
  router.post('/payload/receive', async (req, res) => {
    const { payload } = req.body
    // Validate schema_version === '1.0' and type === 'leaf_capture'
    await db.query(
      `INSERT INTO drone_markers (capture_id, latitude, longitude, disease, confidence, leaf_image_b64)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (capture_id) DO NOTHING`,
      [payload.capture_id, payload.latitude, payload.longitude,
       payload.model_result.disease, payload.model_result.confidence, payload.leaf_image_b64]
    )
    res.json({ ok: true })
  })
  ```
  `[A4] feat(routes): create POST /payload/receive for drone scan ingestion`

- [ ] **2.2** Create `src/routes/markers.js` — marker fetcher
  ```js
  router.get('/markers', async (req, res) => {
    const result = await db.query(
      `SELECT capture_id, latitude, longitude, disease, confidence, created_at
       FROM drone_markers ORDER BY created_at DESC LIMIT 100`
    )
    res.json(result.rows)
  })
  ```
  `[A4] feat(routes): create GET /markers for offline sync`

- [ ] **2.3** Create `src/routes/scans.js` — manual scan sync
  ```js
  router.post('/scan/sync', async (req, res) => {
    const { scans } = req.body  // Array of scan objects
    let synced = 0
    for (const scan of scans) {
      await db.query(
        `INSERT INTO manual_scans (capture_id, latitude, longitude, disease, confidence, timestamp_utc)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (capture_id) DO NOTHING`,
        [scan.capture_id, scan.latitude, scan.longitude, scan.disease, scan.confidence, scan.timestamp]
      )
      synced++
    }
    res.json({ synced })
  })
  ```
  `[A4] feat(routes): create POST /scan/sync for manual scan bulk upload`

---

### Phase 3 — Voice Routes (HIGHEST PRIORITY — Deploy ASAP)

- [ ] **3.1** Create `src/routes/voice.js` — ephemeral token route
  ```js
  router.post('/voice/session', async (req, res) => {
    try {
      const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'gpt-4o-realtime-preview-2025-12-17', voice: 'alloy' }),
      })
      const data = await response.json()
      if (!response.ok) return res.status(500).json({ error: data })
      res.json({
        client_secret: data.client_secret.value,
        session_id: data.id,
        expires_at: data.client_secret.expires_at,
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
  ```
  `[A4] feat(voice): create POST /voice/session ephemeral token endpoint`

- [ ] **3.2** Create `/voice/log` route
  ```js
  router.post('/voice/log', async (req, res) => {
    const { session_id, command, tool_called, result_preview } = req.body
    try {
      await db.query(
        `INSERT INTO voice_logs (session_id, command, tool_called, result_preview) VALUES ($1,$2,$3,$4)`,
        [session_id, command, tool_called, result_preview]
      )
    } catch (_) { /* non-critical */ }
    res.json({ ok: true })
  })
  ```
  `[A4] feat(voice): create POST /voice/log for interaction analytics`

- [ ] **3.3** Register all routes in `src/app.js`
  ```js
  app.use('/', require('./routes/payload'))
  app.use('/', require('./routes/markers'))
  app.use('/', require('./routes/scans'))
  app.use('/voice', require('./routes/voice'))
  ```
  `[A4] feat(app): register all route modules`

---

### Phase 4 — Deployment

- [ ] **4.1** Create `Procfile` and `railway.json`
  ```
  # Procfile
  web: node src/server.js
  ```
  `[A4] chore(deploy): add Procfile for Railway deployment`

- [ ] **4.2** Push to GitHub + deploy on Railway
  ```bash
  railway login
  railway init
  railway up
  railway variables set OPENAI_API_KEY=sk-... DATABASE_URL=postgresql://...
  ```
  `[A4] chore(deploy): deploy to Railway and set environment variables`

- [ ] **4.3** Run migrations on production DB
  ```bash
  railway run node src/migrate.js
  ```
  `[A4] chore(deploy): run database migrations on production`

- [ ] **4.4** Test all endpoints live with curl
  ```bash
  BASE=https://your-app.up.railway.app
  curl $BASE/health
  curl -X POST $BASE/voice/session
  curl -X POST $BASE/voice/log -H "Content-Type: application/json" -d '{"session_id":"test"}'
  curl $BASE/markers
  ```
  Share the deployed `BASE` URL with all agents immediately.
  `[A4] test(deploy): verify all endpoints return correct responses on production`

---

### Phase 5 — Integration QA (Hours 22–30)

- [ ] **5.1** End-to-end test: online voice flow
  - Cold start → tap orb → session token fetched → WebRTC connected
  - Say "नज़दीक के marker दिखाओ" → `scan_nearby_markers` fires → Hindi response plays
  `[A4] test(integration): verify online voice flow end-to-end`

- [ ] **5.2** End-to-end test: tool routing
  - Say "कैमरा चालू करो" → navigates to `live.jsx`
  - Say "पहले वाले पर जाओ" → navigates to `radar.jsx`
  `[A4] test(integration): verify all navigation tool calls route correctly`

- [ ] **5.3** End-to-end test: offline fallback
  - Airplane mode ON → `status = 'offline'`
  - Say "scan" → keyword matches → expo-speech plays Hindi
  - Scan result saved to SQLite
  - Airplane mode OFF → `syncPendingScans` auto-triggers → SQLite clears
  `[A4] test(integration): verify offline fallback and auto-sync`

- [ ] **5.4** Regression test: existing drone payload
  - POST mock payload to `/payload/receive`
  - GET `/markers` → confirms marker exists
  `[A4] test(regression): verify drone payload ingestion unaffected by voice changes`

---

### Phase 6 — Demo Preparation (Hours 30–36)

- [ ] **6.1** Seed database with 3 mock drone markers near the venue GPS coordinates
  ```bash
  railway run node src/seed.js  # create seed.js with INSERT statements for demo markers
  ```
  `[A4] chore(demo): seed production DB with 3 demo markers near venue`

- [ ] **6.2** Write and rehearse demo script (exact Hindi commands + expected responses):
  ```
  1. "खेत में क्या बीमारी है?"
     → "[N] संक्रमित स्थान मिले..."
  2. "सबसे खतरनाक वाले पर ले चलो"
     → Radar opens
  3. "कैमरा चालू करो"
     → Camera opens → scan → DiseaseCard appears
  4. [Airplane mode ON] "scan करो"
     → Offline Hindi TTS responds
  ```
  `[A4] docs(demo): write and commit demo script with exact Hindi commands`

- [ ] **6.3** Final build test — `npx expo run:android` from clean state
  `[A4] chore(final): verify clean Android build before demo`

---

## Phase Completion Tracker

| Phase | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
|---|---|---|---|---|
| Day-0 Setup | S1.1–S1.6 | S2.1–S2.3 | S3.1–S3.4 | S4.1–S4.4 |
| Phase 1 | Audio Recording | SQLite DB | VoiceOrb | DB Migrations |
| Phase 2 | WebRTC | Tool Schemas ⚡ | StatusBanner | Core Routes |
| Phase 3 | Data Channel | Disease Labels | TranscriptFeed | Voice Routes ⚡ |
| Phase 4 | Hook Assembly | Tool Handlers | DiseaseCard | Deployment ⚡ |
| Phase 5 | Offline Fallback | dispatchTool | Main Screen | Integration QA |
| Phase 6 | — | — | Camera Screen | Demo Prep |
| Phase 7 | — | — | GPS Radar | — |

> ⚡ = Critical path item. Prioritize above all else.

---

*NeoAgri Voice — ABV IIITM Hacksagon 2026 | Built in 36 hours*