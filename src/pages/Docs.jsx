import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import './Docs.css'

const EASE = [0.22, 1, 0.36, 1]

const SIDEBAR = [
  {
    group: 'Getting Started',
    items: [
      { id: 'overview',      label: 'Overview' },
      { id: 'quickstart',    label: 'Quickstart' },
      { id: 'architecture',  label: 'Architecture' },
    ],
  },
  {
    group: 'The Pipeline',
    items: [
      { id: 'pipeline',      label: 'How It Works' },
      { id: 'extract',       label: 'Extract' },
      { id: 'analyze',       label: 'Analyze' },
      { id: 'act',           label: 'Act' },
      { id: 'scroll',        label: 'Scroll' },
    ],
  },
  {
    group: 'Agent Fleet',
    items: [
      { id: 'agents',        label: 'Overview' },
      { id: 'boss',          label: 'Boss Agent' },
      { id: 'classifier',    label: 'Classifier' },
      { id: 'context',       label: 'Context Agent' },
      { id: 'strategist',    label: 'Strategist' },
      { id: 'synthesis',     label: 'Synthesis' },
    ],
  },
  {
    group: 'API Reference',
    items: [
      { id: 'endpoints',     label: 'REST Endpoints' },
      { id: 'websocket',     label: 'WebSocket Events' },
      { id: 'models',        label: 'Data Models' },
    ],
  },
  {
    group: 'Integrations',
    items: [
      { id: 'supabase',      label: 'Supabase' },
      { id: 'browser-use',   label: 'browser-use' },
      { id: 'elevenlabs',    label: 'ElevenLabs TTS' },
      { id: 'agentverse',    label: 'Agentverse' },
    ],
  },
]

function CodeBlock({ lang, children }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="dc-code">
      <div className="dc-code-header">
        <span className="dc-code-lang">{lang}</span>
        <button className="dc-code-copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <pre><code>{children}</code></pre>
    </div>
  )
}

function Callout({ type = 'info', children }) {
  const icons = {
    info: 'i',
    warning: '!',
    tip: '✓',
  }
  return (
    <div className={`dc-callout dc-callout--${type}`}>
      <span className="dc-callout-icon">{icons[type]}</span>
      <div className="dc-callout-body">{children}</div>
    </div>
  )
}

function ParamRow({ name, type, required, children }) {
  return (
    <div className="dc-param">
      <div className="dc-param-head">
        <code className="dc-param-name">{name}</code>
        <span className="dc-param-type">{type}</span>
        {required && <span className="dc-param-req">required</span>}
      </div>
      <p className="dc-param-desc">{children}</p>
    </div>
  )
}

function EndpointCard({ method, path, desc, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="dc-endpoint">
      <div className="dc-endpoint-head" onClick={() => setOpen(o => !o)}>
        <span className={`dc-method dc-method--${method.toLowerCase()}`}>{method}</span>
        <code className="dc-endpoint-path">{path}</code>
        <span className="dc-endpoint-desc">{desc}</span>
        <svg className={`dc-endpoint-chevron ${open ? 'dc-endpoint-chevron--open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      {open && <div className="dc-endpoint-body">{children}</div>}
    </div>
  )
}

export default function Docs() {
  const [active, setActive] = useState('overview')
  const location = useLocation()
  const contentRef = useRef(null)

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (hash) setActive(hash)
  }, [location.hash])

  useEffect(() => {
    if (!contentRef.current) return
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
            break
          }
        }
      },
      { root: contentRef.current, rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )
    contentRef.current.querySelectorAll('section[id]').forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id) => {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="docs">
      {/* Top bar */}
      <header className="docs-header">
        <div className="docs-header-left">
          <Link to="/" className="docs-logo">dialed.</Link>
          <span className="docs-header-sep" />
          <span className="docs-header-label">Documentation</span>
        </div>
        <div className="docs-header-right">
          <Link to="/" className="docs-header-link">Home</Link>
          <Link to="/dashboard" className="docs-header-link">Dashboard</Link>
          <a href="https://github.com/MatthewKim323/dialed" target="_blank" rel="noreferrer" className="docs-header-link">
            GitHub
          </a>
        </div>
      </header>

      <div className="docs-layout">
        {/* Sidebar */}
        <motion.aside
          className="docs-sidebar"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {SIDEBAR.map(group => (
            <div className="docs-group" key={group.group}>
              <span className="docs-group-title">{group.group}</span>
              {group.items.map(item => (
                <button
                  key={item.id}
                  className={`docs-nav-item ${active === item.id ? 'docs-nav-item--active' : ''}`}
                  onClick={() => scrollTo(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </motion.aside>

        {/* Content */}
        <motion.main
          className="docs-content"
          ref={contentRef}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
        >

          {/* ── GETTING STARTED ─────────────────────────────── */}

          <section id="overview">
            <span className="dc-badge">Getting Started</span>
            <h1>Overview</h1>
            <p className="dc-lead">
              Dialed is an autonomous social media defense system. Five coordinated Fetch.ai uAgents watch your Instagram feed in real time, classify manipulative content using Claude Sonnet, and intervene before brain rot lands.
            </p>

            <div className="dc-cards">
              <div className="dc-card" onClick={() => scrollTo('quickstart')}>
                <span className="dc-card-icon">→</span>
                <span className="dc-card-title">Quickstart</span>
                <span className="dc-card-desc">Get up and running in 5 minutes</span>
              </div>
              <div className="dc-card" onClick={() => scrollTo('pipeline')}>
                <span className="dc-card-icon">⚡</span>
                <span className="dc-card-title">The Pipeline</span>
                <span className="dc-card-desc">How content flows through the swarm</span>
              </div>
              <div className="dc-card" onClick={() => scrollTo('agents')}>
                <span className="dc-card-icon">◈</span>
                <span className="dc-card-title">Agent Fleet</span>
                <span className="dc-card-desc">Meet the five agents protecting you</span>
              </div>
              <div className="dc-card" onClick={() => scrollTo('endpoints')}>
                <span className="dc-card-icon">{ }</span>
                <span className="dc-card-title">API Reference</span>
                <span className="dc-card-desc">REST endpoints and WebSocket events</span>
              </div>
            </div>
          </section>

          <section id="quickstart">
            <h2>Quickstart</h2>
            <p>Get the full stack running locally in under 5 minutes.</p>

            <h3>Prerequisites</h3>
            <ul>
              <li>Node.js 18+</li>
              <li>Python 3.11+</li>
              <li>API keys for: <strong>browser-use</strong>, <strong>Anthropic</strong>, <strong>Supabase</strong>, <strong>ElevenLabs</strong></li>
            </ul>

            <h3>1. Install dependencies</h3>
            <CodeBlock lang="bash">{`# Frontend
npm install

# Backend
cd backend
pip install -r requirements.txt`}</CodeBlock>

            <h3>2. Configure environment</h3>
            <p>Create a <code>.env</code> in the project root:</p>
            <CodeBlock lang="env">{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://localhost:8000

BROWSER_USE_API_KEY=your-browser-use-key
ANTHROPIC_API_KEY=your-anthropic-key
ELEVENLABS_API_KEY=your-elevenlabs-key
AGENTVERSE_API_KEY=your-agentverse-key`}</CodeBlock>

            <h3>3. Run</h3>
            <CodeBlock lang="bash">{`# Terminal 1 — Backend + Agent Bureau
cd backend && uvicorn main:app --reload

# Terminal 2 — Frontend
npm run dev`}</CodeBlock>

            <Callout type="info">
              The Fetch.ai Bureau starts automatically on port 8019 when the backend boots. You don't need to run it separately.
            </Callout>
          </section>

          <section id="architecture">
            <h2>Architecture</h2>
            <p>Dialed runs as three co-located services sharing a single Python process:</p>

            <div className="dc-arch">
              <div className="dc-arch-layer">
                <span className="dc-arch-label">Frontend</span>
                <span className="dc-arch-tech">React 18 + Vite + Framer Motion</span>
                <span className="dc-arch-port">:5173</span>
              </div>
              <div className="dc-arch-arrow">↕ WebSocket + REST</div>
              <div className="dc-arch-layer">
                <span className="dc-arch-label">Backend</span>
                <span className="dc-arch-tech">FastAPI + browser-use Cloud SDK</span>
                <span className="dc-arch-port">:8000</span>
              </div>
              <div className="dc-arch-arrow">↕ ctx.send_and_receive</div>
              <div className="dc-arch-layer">
                <span className="dc-arch-label">Intelligence Layer</span>
                <span className="dc-arch-tech">Fetch.ai Bureau — 5 uAgents</span>
                <span className="dc-arch-port">:8019</span>
              </div>
            </div>

            <Callout type="tip">
              All five agents run in-process with FastAPI. Agent-to-agent communication is in-memory with zero network latency.
            </Callout>
          </section>

          {/* ── THE PIPELINE ────────────────────────────────── */}

          <section id="pipeline">
            <span className="dc-badge">The Pipeline</span>
            <h1>How It Works</h1>
            <p className="dc-lead">
              Every Instagram Reel passes through a strict 4-step sequential pipeline. The browser agent does nothing until the intelligence layer decides.
            </p>
            <div className="dc-pipeline-flow">
              {['Extract', 'Analyze', 'Act', 'Scroll'].map((s, i) => (
                <div className="dc-pipeline-step" key={s}>
                  <span className="dc-pipeline-num">{i + 1}</span>
                  <span className="dc-pipeline-label">{s}</span>
                  {i < 3 && <span className="dc-pipeline-connector" />}
                </div>
              ))}
            </div>
          </section>

          <section id="extract">
            <h2>Step 1: Extract</h2>
            <p>
              The browser agent reads the current Reel and extracts structured data: caption text, creator handle, like count, comment count, and a visual description. It is explicitly instructed not to interact in any way.
            </p>
            <CodeBlock lang="python">{`result = await client.run(
    "You are looking at an Instagram Reel. "
    "Your ONLY job is to READ what is on screen. "
    "DO NOT scroll. DO NOT tap. DO NOT like. "
    "Extract: caption, creator, likes, comments, visual description. "
    "Report the data and STOP.",
    session_id=session_id,
    output_schema=ReelContent,
)`}</CodeBlock>
          </section>

          <section id="analyze">
            <h2>Step 2: Analyze</h2>
            <p>
              The extracted content is sent to the Boss Agent via REST. The Boss fans out to the Classifier (Claude-powered brain rot detection) and Context Agent (session state machine) in parallel. Both return their verdicts, which the Boss aggregates into a final decision.
            </p>
            <CodeBlock lang="python">{`# Boss fans out in parallel
classification, context = await asyncio.gather(
    ctx.send_and_receive(classifier.address, payload, ClassificationVerdict),
    ctx.send_and_receive(context.address, payload, ContextAssessment),
)

# Aggregate
is_brain_rot = (
    classification.is_brain_rot
    and classification.confidence >= context.adjusted_threshold
    and context.concur
)`}</CodeBlock>
            <Callout type="info">
              The browser agent is completely idle during analysis. It doesn't scroll, tap, or interact until the pipeline returns a verdict.
            </Callout>
          </section>

          <section id="act">
            <h2>Step 3: Act</h2>
            <p>Based on the pipeline verdict:</p>
            <ul>
              <li><strong>Brain rot confirmed</strong> → Browser agent blocks the account (three dots → Block → Confirm)</li>
              <li><strong>Content is clean</strong> → Browser agent double-taps to like</li>
            </ul>
            <p>Only one action per Reel. After acting, the agent stops.</p>
          </section>

          <section id="scroll">
            <h2>Step 4: Scroll</h2>
            <p>
              The browser agent swipes up once to advance to the next Reel, waits for it to fully load, then stops. The pipeline restarts from Step 1.
            </p>
          </section>

          {/* ── AGENT FLEET ─────────────────────────────────── */}

          <section id="agents">
            <span className="dc-badge">Agent Fleet</span>
            <h1>The Five Agents</h1>
            <p className="dc-lead">
              All agents are Fetch.ai uAgents (v0.24) running in a shared Bureau. They communicate via typed Pydantic models and implement the Chat Protocol for Agentverse compatibility.
            </p>

            <div className="dc-agent-grid">
              {[
                { id: 'boss', icon: 'B', name: 'Boss', color: '#4a6fa5', role: 'Central orchestrator. Dispatches, aggregates, decides.' },
                { id: 'classifier', icon: 'C', name: 'Classifier', color: '#C0502A', role: 'Claude-powered brain rot detection across 7 dimensions.' },
                { id: 'context', icon: 'X', name: 'Context', color: '#7c4dbd', role: 'Session state machine. Adjusts thresholds dynamically.' },
                { id: 'strategist', icon: 'S', name: 'Strategist', color: '#9a6f15', role: 'Intervention planning. Decides severity and action.' },
                { id: 'synthesis', icon: 'A', name: 'Synthesis', color: '#1e8449', role: 'Letter From The Algorithm. Session reports.' },
              ].map(a => (
                <div className="dc-agent-card" key={a.id} onClick={() => scrollTo(a.id)}>
                  <span className="dc-agent-icon" style={{ background: `${a.color}14`, color: a.color }}>{a.icon}</span>
                  <div>
                    <span className="dc-agent-name">{a.name}</span>
                    <span className="dc-agent-role">{a.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="boss">
            <h2>Boss Agent</h2>
            <p>Central orchestrator. Every content payload passes through the Boss first.</p>
            <div className="dc-props">
              <ParamRow name="address" type="string">agent1qvpy6y...tnj8rk</ParamRow>
              <ParamRow name="seed" type="string">dialed-boss-seed-v1</ParamRow>
              <ParamRow name="REST endpoint" type="POST">/content on port 8019</ParamRow>
            </div>
            <h3>Pipeline flow</h3>
            <ol>
              <li>Receives <code>ContentRequest</code> via REST from FastAPI</li>
              <li>Sends <code>ContentPayload</code> to Classifier + Context in parallel</li>
              <li>Aggregates <code>ClassificationVerdict</code> + <code>ContextAssessment</code></li>
              <li>Sends <code>BossVerdict</code> to Strategist + Synthesis in parallel</li>
              <li>Returns <code>PipelineResult</code> to FastAPI</li>
            </ol>
          </section>

          <section id="classifier">
            <h2>Classifier Agent</h2>
            <p>Real-time brain rot detection powered by Claude Sonnet. Evaluates 7 manipulation dimensions:</p>
            <ol>
              <li>Rage bait</li>
              <li>FOMO hooks</li>
              <li>Social comparison traps</li>
              <li>Outrage amplification</li>
              <li>Parasocial exploitation</li>
              <li>Engagement bait</li>
              <li>Cliffhanger hooks</li>
            </ol>
            <p>Returns a <code>ClassificationVerdict</code> with confidence score (0.0–1.0), detected tactics, rationale, and severity.</p>
          </section>

          <section id="context">
            <h2>Context Agent</h2>
            <p>Adaptive session state machine with four states:</p>
            <div className="dc-state-table">
              <div className="dc-state-row dc-state-row--header">
                <span>State</span><span>Threshold</span><span>Trigger</span>
              </div>
              <div className="dc-state-row"><span>NORMAL</span><span>0.70</span><span>Default</span></div>
              <div className="dc-state-row"><span>ELEVATED</span><span>0.50</span><span>Brain rot density {'>'} 30%</span></div>
              <div className="dc-state-row"><span>ALERT</span><span>0.30</span><span>Brain rot density {'>'} 50%</span></div>
              <div className="dc-state-row"><span>COOLDOWN</span><span>0.90</span><span>{'>'} 5 interventions in 60s</span></div>
            </div>
          </section>

          <section id="strategist">
            <h2>Strategist Agent</h2>
            <p>Decides intervention severity based on confidence and session state. Escalation matrix:</p>
            <ul>
              <li><strong>Critical</strong> — ALERT state or confidence ≥ 0.9</li>
              <li><strong>High</strong> — ELEVATED state or confidence ≥ 0.7</li>
              <li><strong>Medium</strong> — Confidence ≥ 0.5</li>
              <li><strong>Pass</strong> — Below session threshold</li>
            </ul>
          </section>

          <section id="synthesis">
            <h2>Synthesis Agent</h2>
            <p>
              Generates the "Letter From The Algorithm" — confessional paragraphs written from the perspective of the recommendation engine. Powered by Claude Sonnet. Also produces the session summary report with stats on content scanned, brain rot detected, and time reclaimed.
            </p>
          </section>

          {/* ── API REFERENCE ───────────────────────────────── */}

          <section id="endpoints">
            <span className="dc-badge">API Reference</span>
            <h1>REST Endpoints</h1>
            <p className="dc-lead">All endpoints are served by FastAPI on port 8000.</p>

            <EndpointCard method="POST" path="/api/session/start" desc="Start a browser-use session and begin the pipeline">
              <h4>Request body</h4>
              <div className="dc-props">
                <ParamRow name="platform" type="string">Social media platform. Default: <code>"instagram"</code></ParamRow>
                <ParamRow name="username" type="string" required>Instagram username</ParamRow>
                <ParamRow name="password" type="string" required>Instagram password</ParamRow>
              </div>
              <h4>Response</h4>
              <CodeBlock lang="json">{`{ "live_url": "https://session.browser-use.com/..." }`}</CodeBlock>
            </EndpointCard>

            <EndpointCard method="POST" path="/api/session/stop" desc="Stop the current session and kill the browser">
              <p>Cancels the scout loop, stops the browser-use session, and broadcasts <code>session_ended</code> via WebSocket.</p>
            </EndpointCard>

            <EndpointCard method="POST" path="/api/session/2fa-complete" desc="Submit a 2FA verification code">
              <div className="dc-props">
                <ParamRow name="code" type="string" required>The 2FA code from email/SMS</ParamRow>
              </div>
            </EndpointCard>

            <EndpointCard method="POST" path="/api/session/chat" desc="Send a message to an agent">
              <div className="dc-props">
                <ParamRow name="message" type="string" required>Message text. Use <code>@agent_name</code> to route to a specific agent. Defaults to Boss.</ParamRow>
              </div>
              <CodeBlock lang="json">{`{ "response": "...", "agent": "classifier", "address": "agent1q..." }`}</CodeBlock>
            </EndpointCard>

            <EndpointCard method="POST" path="/api/tts" desc="Generate speech audio for an agent">
              <div className="dc-props">
                <ParamRow name="agent_id" type="string" required>One of: boss, classifier, context, strategist, synthesis</ParamRow>
                <ParamRow name="text" type="string" required>Text to synthesize (max 500 chars)</ParamRow>
              </div>
              <p>Returns <code>audio/mpeg</code> binary.</p>
            </EndpointCard>

            <EndpointCard method="GET" path="/api/agents" desc="Get agent metadata and bureau info">
              <p>Returns addresses, roles, protocols for all 5 agents, plus Bureau status.</p>
            </EndpointCard>

            <EndpointCard method="GET" path="/api/session/status" desc="Current session state">
              <CodeBlock lang="json">{`{ "active": true, "stats": { "scanned": 12, "detected": 3, "interventions": 2, "reclaimed": 45 }, "state": "ELEVATED" }`}</CodeBlock>
            </EndpointCard>
          </section>

          <section id="websocket">
            <h2>WebSocket Events</h2>
            <p>Connect to <code>ws://localhost:8000/ws</code> to receive real-time events.</p>

            <div className="dc-state-table">
              <div className="dc-state-row dc-state-row--header">
                <span>Event</span><span>Description</span>
              </div>
              <div className="dc-state-row"><span><code>ticker</code></span><span>Agent communication log entry</span></div>
              <div className="dc-state-row"><span><code>stats</code></span><span>Updated scan/detect/intervention counters</span></div>
              <div className="dc-state-row"><span><code>2fa_required</code></span><span>Prompts the 2FA input overlay</span></div>
              <div className="dc-state-row"><span><code>2fa_resolved</code></span><span>Dismisses the 2FA overlay</span></div>
              <div className="dc-state-row"><span><code>state_change</code></span><span>Session state changed</span></div>
              <div className="dc-state-row"><span><code>agent_status</code></span><span>Agent active/inactive toggle</span></div>
              <div className="dc-state-row"><span><code>chat</code></span><span>Chat message (user or agent)</span></div>
              <div className="dc-state-row"><span><code>intervention_overlay</code></span><span>Warning overlay on the live feed</span></div>
              <div className="dc-state-row"><span><code>session_ended</code></span><span>Session terminated</span></div>
            </div>
          </section>

          <section id="models">
            <h2>Data Models</h2>
            <p>All agent-to-agent communication uses typed Pydantic models (<code>uagents.Model</code>).</p>

            <h3>ContentPayload</h3>
            <p>Browser → Boss. Raw extracted content from a Reel.</p>
            <CodeBlock lang="python">{`class ContentPayload(Model):
    content_index: int
    extracted_text: str
    creator_handle: str
    engagement_likes: str
    engagement_comments: str
    visual_description: str
    scroll_depth: int
    session_duration_s: int`}</CodeBlock>

            <h3>ClassificationVerdict</h3>
            <p>Classifier → Boss. Brain rot analysis result.</p>
            <CodeBlock lang="python">{`class ClassificationVerdict(Model):
    is_brain_rot: bool
    confidence: float         # 0.0 - 1.0
    detected_tactics: List[str]
    intent_alignment: float
    rationale: str
    recommended_severity: str # "low" | "medium" | "high" | "critical"`}</CodeBlock>

            <h3>BossVerdict</h3>
            <p>Boss → Strategist + Synthesis. Aggregated decision.</p>
            <CodeBlock lang="python">{`class BossVerdict(Model):
    content_index: int
    is_brain_rot: bool
    final_confidence: float
    detected_tactics: List[str]
    session_state: str
    rationale: str`}</CodeBlock>
          </section>

          {/* ── INTEGRATIONS ────────────────────────────────── */}

          <section id="supabase">
            <span className="dc-badge">Integrations</span>
            <h1>Supabase</h1>
            <p>Handles authentication and profile storage. The <code>profiles</code> table stores the user's intent profile and Instagram credentials.</p>
            <CodeBlock lang="sql">{`CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  ig_username TEXT,
  ig_password TEXT,
  purpose TEXT[],
  triggers TEXT[],
  aggressiveness TEXT DEFAULT 'moderate',
  duration TEXT DEFAULT '30',
  redirect TEXT DEFAULT 'close',
  intent_profile JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;`}</CodeBlock>
          </section>

          <section id="browser-use">
            <h2>browser-use Cloud SDK</h2>
            <p>
              Provides a headless Chromium browser in the cloud with a mobile viewport (390×844). The <code>live_url</code> is embedded as an iframe in the dashboard for real-time viewing.
            </p>
            <CodeBlock lang="python">{`session = await client.sessions.create(
    proxy_country_code="us",
    browser_screen_width=390,
    browser_screen_height=844,
)

# Run natural language instructions
result = await client.run(
    "Navigate to instagram.com and log in...",
    session_id=session.id,
    output_schema=ReelContent,
)`}</CodeBlock>
          </section>

          <section id="elevenlabs">
            <h2>ElevenLabs TTS</h2>
            <p>Each agent has a unique ElevenLabs voice. The backend proxies TTS requests through <code>/api/tts</code>.</p>
            <div className="dc-state-table">
              <div className="dc-state-row dc-state-row--header">
                <span>Agent</span><span>Voice ID</span>
              </div>
              <div className="dc-state-row"><span>Boss</span><span><code>1hR2qVedP7lrOxD8z7OH</code></span></div>
              <div className="dc-state-row"><span>Classifier</span><span><code>g2W4HAjKvdW93AmsjsOx</code></span></div>
              <div className="dc-state-row"><span>Context</span><span><code>EWx0RRDmpbbmVRmQfzC0</code></span></div>
              <div className="dc-state-row"><span>Strategist</span><span><code>Te3lE8ImQx0Z8EfP7o5b</code></span></div>
              <div className="dc-state-row"><span>Synthesis</span><span><code>sIak7pFapfSLCfctxdOu</code></span></div>
            </div>
          </section>

          <section id="agentverse">
            <h2>Agentverse</h2>
            <p>
              All five agents are registered on Fetch.ai Agentverse with <code>mailbox=True</code> and the Chat Protocol. They can be discovered and messaged by external agents on the testnet.
            </p>
            <Callout type="warning">
              Pipeline interactions happen locally within the Bureau for performance. Agentverse registration is for discoverability and external communication — not for internal pipeline routing.
            </Callout>
            <p>To register agents programmatically:</p>
            <CodeBlock lang="bash">{`cd backend
python register_agents.py`}</CodeBlock>
          </section>

          <div className="dc-footer">
            <span>dialed. — Nathan Kim & Matthew Kim — BeachHacks 9.0</span>
          </div>
        </motion.main>
      </div>
    </div>
  )
}
