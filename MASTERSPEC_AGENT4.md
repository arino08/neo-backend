# NeoAgri Voice — Multi-Agent Spec Sheet
**Hackathon:** ABV IIITM Hacksagon | **Duration:** 36 Hours | **Model:** Gemini 3.1 Pro (fallback: Claude Opus 4.6)

---

## MASTER SPEC — Read Before Every Task (All Agents)

### Project Mission
Convert NeoAgri (drone-assisted crop disease detection app) into a **voice-first, fully offline-capable agentic app** for Indian farmers. The farmer must be able to complete every core action — finding drone markers, navigating to GPS pins, running live scans, and getting disease cures — **entirely through spoken Hindi commands, zero touch required.**

---

### Absolute Rules (Violations = Blocked PR)

| # | Rule | Reason |
|---|------|---------|
| 1 | **Never use TypeScript** — `.js` only | Project-wide contract |
| 2 | **Never import from `@tensorflow/*`** | App model uses `react-native-fast-tflite` only |
| 3 | **Never merge drone model and app model logic** | Drone model is Python/ONNX on server, app model is TFLite on-device |
| 4 | **Offline always works** — every feature degrades gracefully | Field conditions have no internet |
| 5 | **All farmer-facing text must support Hindi** — `expo-speech` with `language: 'hi-IN'` | Primary user is Hindi-speaking farmer |
| 6 | **Frame processor worklets must stay in worklets** — no async in VisionCamera worklet context | RN-VisionCamera v4 requirement |
| 7 | **Never use `AsyncStorage` for structured data** — use `expo-sqlite` | Offline DB contract |
| 8 | **Never hardcode OpenAI API key in the app** — always fetch ephemeral token from `/voice/session` | Security |
| 9 | **After any task, update `agent_docs/progress.md`** | Shared awareness between agents |
| 10 | **Never add a new npm dependency without checking if existing SDK covers it** | Expo SDK 54 is large; duplicates bloat build |

---

### Tech Stack Reference

| Layer | Package | Version | Notes |
|---|---|---|---|
| Framework | `expo` | SDK 54 | Run `npx expo run:android` after native changes |
| React Native | `react-native` | 0.81.5 | JS only, no TypeScript |
| Navigation | `expo-router` | v4 | File-based routing in `app/` |
| Camera | `react-native-vision-camera` | v4 | Frame processors must use worklets |
| ML Inference | `react-native-fast-tflite` | latest | Model at `models/neoagri_app_model.tflite` |
| Resize plugin | `vision-camera-resize-plugin` | latest | Required before TFLite input |
| Offline DB | `expo-sqlite` | latest | All structured data goes here |
| Location | `expo-location` | latest | GPS for radar + navigation |
| TTS (offline) | `expo-speech` | latest | Hindi via `language: 'hi-IN'` |
| Audio I/O | `expo-av` | latest | PCM16 recording + playback |
| WebRTC | `react-native-webrtc` | latest | Realtime API peer connection |
| Network | `@react-native-community/netinfo` | latest | Online/offline detection |
| Backend | Node.js + Express + Postgres | — | `neo-backend` repo |

---

### Existing Assets — Do Not Modify or Recreate

| Asset | Path | Status |
|---|---|---|
| App TFLite model | `models/neoagri_app_model.tflite` | ✅ Done |
| Disease labels + cures | `models/disease_labels.json` | ✅ Done |
| Offline sync engine | `app/db/offlineSync.js` | ✅ Done |
| SQLite schema + queries | `app/db/` | ✅ Done |
| Frame processor (inference) | `app/components/LiveModeCamera.js` | ✅ Done |
| GPS radar screen | `app/radar.jsx` | ✅ Done |
| Drone backend | `website_station_backend/` | ✅ Done |
| Node backend (base routes) | `neo-backend/` | ✅ Done, 2 new routes only |

---

### Model Output Reference (Agent 2 must know this)

```
TFLite output: float32[4] — index order is critical:
  [0] → Caterpillar and Semilooper Pest Attack  (severity: High)
  [1] → Healthy_Soyabean                         (severity: None)
  [2] → Soyabean_Frog_Leaf_Eye                   (severity: Medium)
  [3] → Soyabean_Spectoria_Brown_Spot             (severity: Medium)

Confidence: argMax of output array
Labels + cure strings: models/disease_labels.json (keyed by disease name)
```

---

### Inter-Agent Interfaces (Contracts)

These are the exact function signatures each agent must export. Any change to a signature requires ALL dependent agents to be notified immediately.

```js
// ── Agent 1 exports (lib/useVoiceSession.js) ──────────────────────────
export function useVoiceSession(toolHandlers)
// Returns: { status, transcript, isListening, startSession, stopSession, speak }
// status: 'idle' | 'connecting' | 'listening' | 'speaking' | 'offline'
// toolHandlers: object mapping toolName → async function(args) → result string

// ── Agent 2 exports (lib/VoiceAgentTools.js) ─────────────────────────
export const TOOL_SCHEMAS     // Array of OpenAI function_call tool schema objects
export const TOOL_HANDLERS    // Object: { toolName: async (args) => string }
export const SYSTEM_PROMPT    // String: OpenAI system prompt with Hindi instruction
export async function dispatchTool(toolName, args)  // Routes call to correct handler

// ── Agent 3 exports (components/voice/) ──────────────────────────────
export default VoiceOrb        // components/voice/VoiceOrb.js — animated mic button
export default TranscriptFeed  // components/voice/TranscriptFeed.js — scrolling transcript
export default DiseaseCard     // components/voice/DiseaseCard.js — disease result display
export default StatusBanner    // components/voice/StatusBanner.js — connection state

// ── Agent 4 exports (neo-backend new routes) ─────────────────────────
POST /voice/session  → { client_secret: string, session_id: string, expires_at: number }
POST /voice/log      → { ok: true }
```

---

### Git Worktree Strategy (Run These Commands Before Starting)

```bash
# Each agent runs these in the neoagri-mobile root:
git worktree add ../neoagri-voice-pipeline  voice/pipeline   # Agent 1
git worktree add ../neoagri-voice-tools     voice/tools      # Agent 2
git worktree add ../neoagri-voice-ui        voice/ui         # Agent 3
git worktree add ../neoagri-voice-backend   voice/backend    # Agent 4

# Merge order at end: tools → pipeline → ui → backend → main
```

---

### Environment Variables

```env
# .env (neoagri-mobile)
EXPO_PUBLIC_API_URL=https://your-neo-backend.railway.app
EXPO_PUBLIC_OPENAI_MODEL=gpt-4o-realtime-preview-2025-12-17

# .env (neo-backend)
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
PORT=3001
```

---
---


## AGENT 4 — Backend + Integration QA
**Branch:** `voice/backend` | **Owner:** Agent 4
**Dependency:** Needs OpenAI API key access. Must deploy before Agent 1 can test against real token endpoint.
**Timeline:** Hours 0–6 (backend routes, deploy), Hours 18–26 (integration QA), Hours 30–36 (demo prep)

### Mission
Add 2 routes to `neo-backend`, deploy it live (Railway/Render), and own **end-to-end integration** — making sure Agent 1's session hook, Agent 2's tools, Agent 3's UI, and the backend all work together without breaking offline mode or the existing drone payload flow.

---

### File Deliverables

#### `neo-backend/routes/voice.js` (New File)

```js
// Route 1: Create ephemeral Realtime API session
router.post('/voice/session', async (req, res) => {
  try {
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2025-12-17',
        voice: 'alloy',
      }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data })
    res.json({
      client_secret: data.client_secret.value,
      session_id: data.id,
      expires_at: data.client_secret.expires_at,
    })
  } catch (err) {
    res.status(500).json({ error: 'Session creation failed', detail: err.message })
  }
})

// Route 2: Log voice interactions (for demo analytics + debugging)
router.post('/voice/log', async (req, res) => {
  const { session_id, command, tool_called, result_preview, timestamp } = req.body
  try {
    await db.query(
      `INSERT INTO voice_logs (session_id, command, tool_called, result_preview, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [session_id, command, tool_called, result_preview, timestamp || new Date()]
    )
    res.json({ ok: true })
  } catch (err) {
    // Non-critical — don't fail if logging fails
    console.error('Voice log error:', err.message)
    res.json({ ok: true })
  }
})
```

#### `neo-backend/migrations/voice_logs.sql` (New File)

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

#### `neo-backend/app.js` (Modify — add route)

```js
// Add after existing route registrations:
const voiceRoutes = require('./routes/voice')
app.use('/voice', voiceRoutes)
```

---

### Deployment Checklist (Hours 0–4)

1. Push `neo-backend` with new routes to GitHub
2. Deploy to Railway (fastest for Node+Postgres):
   - `railway login && railway up`
   - Set env var: `OPENAI_API_KEY=sk-...`
   - Get deployed URL → add to neoagri-mobile `.env` as `EXPO_PUBLIC_API_URL`
3. Test both routes with `curl`:
   ```bash
   curl -X POST https://your-app.railway.app/voice/session
   # Should return: { client_secret, session_id, expires_at }

   curl -X POST https://your-app.railway.app/voice/log \
     -H "Content-Type: application/json" \
     -d '{"session_id":"test","command":"hello","tool_called":"none"}'
   # Should return: { ok: true }
   ```
4. Share the deployed URL with all agents immediately

---

### Integration QA Checklist (Hours 18–26)

Run these full end-to-end tests after all 4 agents have merged to `main`:

**Online Voice Flow:**
- [ ] App cold start → tap orb → session connects in < 4 seconds
- [ ] Say "नज़दीक के मार्कर दिखाओ" → `scan_nearby_markers` tool fires → AI responds in Hindi
- [ ] Say "कैमरा चालू करो" → `start_live_mode` fires → navigates to live.jsx
- [ ] Say "पहले वाले पर जाओ" → `navigate_to_pin` fires → navigates to radar.jsx
- [ ] Live scan detects disease → DiseaseCard appears → AI speaks cure in Hindi

**Offline Flow:**
- [ ] Turn on airplane mode → status banner shows "ऑफलाइन"
- [ ] Say "स्कैन" → keyword match → `start_live_mode` fires → `expo-speech` speaks Hindi confirmation
- [ ] Scan result saves to SQLite
- [ ] Turn airplane mode off → `sync_pending_scans` auto-triggers → SQLite clears

**No Regressions:**
- [ ] Existing drone payload flow still works (POST to `/payload/receive` unaffected)
- [ ] Existing marker fetch still works (GET `/markers` unaffected)
- [ ] `offlineSync.js` background sync still works independently of voice

---

### Demo Script (Prepare This — Hours 30–36)

Rehearse this exact flow for judges. Speaks directly to the problem statement.

```
[Scene: Show judge the app in idle state]
"यह NeoAgri है — बिना किसी button के, सिर्फ आवाज़ से।"

[Tap orb to start]
Say: "खेत में क्या बीमारी है?"
→ AI: "आपके खेत में 3 संक्रमित स्थान मिले — Frog Eye 92%, Brown Spot 87%..."

Say: "सबसे खतरनाक वाले पर ले चलो"
→ AI: "ठीक है, नेविगेशन शुरू। 2.3 किलोमीटर दूर।"
→ [Radar screen opens automatically]

Say: "ठीक है, कैमरा चालू करो"
→ [Live camera opens — show leaf to camera]
→ [Disease detected — DiseaseCard slides up]
→ AI: "सोयाबीन में Frog Eye बीमारी मिली — मध्यम। मैन्कोज़ेब 2.5g प्रति लीटर पानी में डालें।"

[Turn on airplane mode]
Say: "स्कैन करो"
→ [expo-speech in Hindi: "कैमरा चालू हो गया — ऑफलाइन मोड"]
→ [Camera works offline — result saves to SQLite]
"यह बिना internet के भी काम करता है।"
```

---

### Acceptance Criteria

- [ ] `/voice/session` returns valid ephemeral token (test with actual OpenAI call)
- [ ] `/voice/log` inserts to Postgres without error
- [ ] Backend deployed and publicly accessible (not localhost)
- [ ] All integration QA checks pass
- [ ] Demo script rehearsed — full flow completes in under 3 minutes
- [ ] Existing `/payload/receive` and `/markers` routes untouched and functional

---
