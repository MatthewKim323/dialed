# dialed.

**Autonomous AI agents that watch your social feed, classify manipulation in real time, and intervene before the brain rot lands.**

Built by Nathan Kim & Matthew Kim — March 2026 — Mental Health Track

---

## What is Dialed?

Dialed is a real-time social media defense system. It connects to your Instagram account through an autonomous browser agent, scrolls your feed, and runs every piece of content through a coordinated swarm of five Fetch.ai uAgents. When brain rot is detected — rage bait, FOMO hooks, outrage amplification, parasocial traps — the system intervenes directly: blocking accounts, flagging content, and generating a full session report of what the algorithm tried to do to you.

The entire pipeline happens in a single browser session. You watch it live.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React Frontend (Vite)                                      │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Live Feed │  │ Agent Comms  │  │ Agent Fleet + TTS      │ │
│  │ (iframe)  │  │ Ticker + Chat│  │ 5 cards w/ ElevenLabs  │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────┬───────────────────────────────┬───────────────┘
              │ WebSocket                     │ REST
              ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│  FastAPI Backend (Python)                                   │
│  ┌──────────────┐  ┌───────────────────────────────────────┐│
│  │ browser-use  │  │ Fetch.ai Bureau (port 8019)           ││
│  │ Cloud SDK    │──│ Boss → Classifier + Context           ││
│  │ (session)    │  │      → Strategist + Synthesis         ││
│  └──────────────┘  └───────────────────────────────────────┘│
│         │                        │                          │
│    browser-use API          Claude Sonnet                   │
│    (cloud browser)          (classification + letter)       │
└─────────────────────────────────────────────────────────────┘
```

### The Pipeline (per Reel)

1. **Extract** — Browser agent reads the current Reel (caption, creator, likes, comments, visual description). No interaction.
2. **Analyze** — Content payload is sent to the Boss Agent, which dispatches to the Classifier (Claude-powered brain rot detection) and Context Agent (session state machine) in parallel.
3. **Act** — If brain rot is confirmed above the session threshold, the browser agent blocks the account. If clear, it double-taps to like.
4. **Scroll** — Browser agent advances to the next Reel. Pipeline restarts.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Framer Motion, WebGL2 (planet shader loader) |
| Styling | Plain CSS with CSS variables, glassmorphism, Google Fonts (Fraunces, Bricolage Grotesque, JetBrains Mono, Cormorant Garamond) |
| Routing | react-router-dom |
| Auth & DB | Supabase (accounts, profiles, Instagram credentials) |
| Backend | FastAPI (Python) |
| Browser Automation | browser-use Cloud SDK (headless Chromium, mobile viewport 390x844) |
| Intelligence Layer | Fetch.ai uAgents v0.24 — 5-agent Bureau with typed Pydantic models |
| LLM | Anthropic Claude Sonnet (classification + letter generation) |
| Voice | ElevenLabs TTS — each agent has a distinct voice |
| Real-time | WebSockets (agent comms, stats, intervention overlays) |

---

## Agent Fleet

| Agent | Role | How It Works |
|-------|------|-------------|
| **Boss** | Dispatch & Coordination | Receives content from the browser agent, fans out to Classifier + Context in parallel, aggregates verdicts, forwards to Strategist + Synthesis |
| **Classifier** | Brain Rot Detection | Claude-powered analysis across 7 manipulation dimensions. Returns confidence score, detected tactics, and severity rating |
| **Context** | Session State Machine | Tracks brain rot density, manages NORMAL/ELEVATED/ALERT/COOLDOWN states, adjusts detection thresholds dynamically |
| **Strategist** | Intervention Planning | Decides action severity (overlay/block/pass) based on confidence, session state, and escalation matrix |
| **Synthesis** | Session Summary & Reports | Generates the "Letter From The Algorithm" — confessional paragraphs from the perspective of the recommendation engine. Produces session summary reports |

All agents implement the Fetch.ai Chat Protocol (`ChatMessage` / `ChatAcknowledgement`) for Agentverse compatibility and user-facing chat.

---

## Project Structure

```
dialed/
├── src/
│   ├── components/
│   │   ├── CloudBackground.jsx    # WebGL2 cloud shader (landing page bg)
│   │   ├── Nav.jsx                # Navigation bar
│   │   ├── ShaderLoader.jsx       # Planet shader loading screen
│   │   └── ShaderLoader.css
│   ├── pages/
│   │   ├── Landing.jsx            # Landing page with agent voice demos
│   │   ├── Login.jsx              # Auth (Supabase)
│   │   ├── Login.css
│   │   ├── Onboarding.jsx         # User intent profile questionnaire
│   │   ├── Onboarding.css
│   │   ├── Dashboard.jsx          # Trifold command center
│   │   ├── Dashboard.css
│   │   ├── Profile.jsx            # User profile page
│   │   └── Profile.css
│   ├── App.jsx                    # Router + auth state
│   ├── App.css                    # Global styles
│   ├── supabaseClient.js          # Supabase init
│   └── main.jsx                   # Entry point
├── backend/
│   ├── main.py                    # FastAPI server + browser-use session + scout loop
│   ├── agents.py                  # Fetch.ai Bureau — 5 uAgents with Chat Protocol
│   ├── models.py                  # Typed Pydantic models (uagents.Model)
│   ├── register_agents.py         # Agentverse registration script
│   └── requirements.txt           # Python dependencies
├── backend/agent-readmes/         # Individual agent READMEs for Agentverse
│   ├── boss.md
│   ├── classifier.md
│   ├── context.md
│   ├── strategist.md
│   └── synthesis.md
├── index.html
├── package.json
├── vite.config.js
└── .env                           # API keys (not committed)
```

---

## Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- A [browser-use](https://browser-use.com) Cloud API key
- An [Anthropic](https://console.anthropic.com) API key (Claude Sonnet)
- A [Supabase](https://supabase.com) project (with `profiles` table)
- An [ElevenLabs](https://elevenlabs.io) API key (for agent voices)
- A [Fetch.ai Agentverse](https://agentverse.ai) API key (optional, for agent registration)

### 1. Clone & install

```bash
git clone https://github.com/your-org/dialed.git
cd dialed

# Frontend
npm install

# Backend
cd backend
pip install -r requirements.txt
cd ..
```

### 2. Environment variables

Create a `.env` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://localhost:8000

BROWSER_USE_API_KEY=your-browser-use-key
ANTHROPIC_API_KEY=your-anthropic-key

AGENTVERSE_API_KEY=your-agentverse-key
ELEVENLABS_API_KEY=your-elevenlabs-key
```

### 3. Supabase setup

Create a `profiles` table:

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  ig_username TEXT,
  ig_password TEXT,
  intent_profile JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
```

### 4. Run

```bash
# Terminal 1 — Backend (FastAPI + Fetch.ai Bureau)
cd backend
uvicorn main:app --reload

# Terminal 2 — Frontend
npm run dev
```

The Bureau starts automatically on port 8019 when the FastAPI server boots. The frontend runs on `http://localhost:5173`.

---

## How to Use

1. **Create an account** — Sign up on the login page. Confirm your email if required.
2. **Complete onboarding** — Answer the intent profile questionnaire so the agents know what to watch for.
3. **Enter Instagram credentials** — On the dashboard lobby, provide your IG username and password.
4. **Start a session** — Click "Start Session." The browser agent logs into your Instagram, and the pipeline begins.
5. **2FA** — If Instagram requires verification, enter the code in the dashboard overlay. The agent will input it autonomously.
6. **Watch it work** — The left panel shows the live browser feed. The middle panel shows agent communication in real time. The right panel shows each agent's status and lets you hear them speak.
7. **Talk to your agents** — Use the chat to command the swarm. `@classifier why did you flag that?` or `@boss go more aggressive.`
8. **End session** — Click "End Session" for a full summary report: content scanned, brain rot detected, interventions fired, time reclaimed.

---

## License

MIT
