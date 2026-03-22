import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import CloudBackground from '../components/CloudBackground'
import Nav from '../components/Nav'

const EASE_OUT = [0.22, 1, 0.36, 1]

function Reveal({ children, delay = 0, className, style }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-70px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 1.0, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  )
}

function ScrollHint() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const fn = () => setVisible(window.scrollY < 60)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <motion.div
      className="scroll-hint"
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.5 }}
    >
      <span>scroll</span>
      <div className="scroll-line" />
    </motion.div>
  )
}

function ScoutVisual() {
  return (
    <div className="vis-scout">
      <div className="vis-scout-line" />
      {['@viral.acct — Reel #14', '@rage.bait — Story #7', '@fomo.page — Post #22'].map((t, i) => (
        <div className="vis-scout-item" key={i} style={{ animationDelay: `${i * 0.3}s` }}>
          <span className="vis-scout-dot" />
          <span>{t}</span>
        </div>
      ))}
    </div>
  )
}

function ClassifyVisual() {
  return (
    <div className="vis-classify">
      {[
        { label: 'Rage bait', conf: 91 },
        { label: 'FOMO hook', conf: 74 },
        { label: 'Parasocial', conf: 45 },
        { label: 'Outrage amp', conf: 88 },
      ].map((t, i) => (
        <div className="vis-classify-row" key={i}>
          <span className="vis-classify-label">{t.label}</span>
          <div className="vis-classify-track">
            <div className="vis-classify-fill" style={{ '--fill': `${t.conf}%`, animationDelay: `${i * 0.15}s` }} />
          </div>
          <span className="vis-classify-conf">{t.conf}%</span>
        </div>
      ))}
    </div>
  )
}

function InterveneVisual() {
  return (
    <div className="vis-intervene">
      <div className="vis-intervene-content">
        <div className="vis-intervene-line" />
        <div className="vis-intervene-line vis-intervene-line--short" />
        <div className="vis-intervene-line" />
      </div>
      <div className="vis-intervene-shield">
        <span>Blocked</span>
      </div>
    </div>
  )
}

const FEATURES = [
  {
    num: '01',
    title: 'Scout',
    desc: 'An autonomous browser agent logs into your account, navigates your live feed, and extracts every piece of content as a structured payload — captions, creator handles, engagement metrics, and visual descriptions.',
    detail: 'browser-use Cloud · live_url iframe · Pydantic structured output',
  },
  {
    num: '02',
    title: 'Classify',
    desc: 'Five coordinated Fetch.ai agents evaluate each payload for rage bait, parasocial traps, FOMO hooks, and outrage amplification — scored by confidence against your personal intent profile.',
    detail: 'Fetch.ai uAgents · Claude Sonnet · <5 s latency',
  },
  {
    num: '03',
    title: 'Intervene',
    desc: 'The defense fires directly on the same feed — warning overlays, content replacement, hard redirects, or a full scroll lock. One browser, one session. The Algorithm\'s letter writes itself as each tactic is caught.',
    detail: 'single session · DOM injection · 4 intervention types · session report',
  },
]

const TICKER = [
  { from: 'Scout', to: 'Boss', msg: 'New content payload — Reel #14, @viral.account — captured at scroll depth 47%' },
  { from: 'Boss', to: 'Classifier', msg: 'Dispatching with intent profile — trigger watchlist: outrage content, social comparison' },
  { from: 'Classifier', to: 'Boss', flag: 'BRAIN ROT DETECTED', msg: '— rage bait · outrage amplification — confidence ', conf: '0.91' },
  { from: 'Context', to: 'Boss', msg: 'Session depth: 23 min. Third high-confidence detection this session. Concur — escalate.' },
  { from: 'Strategist', to: 'Intervention', msg: 'Full overlay + content replacement. Severity: HIGH. Redirect → user-defined destination.' },
  { from: 'Synthesis', to: 'Letter', msg: 'Appending paragraph 3 — tactic: outrage amplification · intended emotion: moral outrage — blocked.' },
]

function AgentFeed({ messages }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!inView || count >= messages.length) return
    const delay = count === 0 ? 500 : 600 + Math.random() * 500
    const id = setTimeout(() => setCount(c => c + 1), delay)
    return () => clearTimeout(id)
  }, [inView, count, messages.length])

  return (
    <div ref={ref} className="ticker-card">
      <div className="ticker-header">
        <div className="ticker-dot">
          {count > 0 && <span key={count} className="ticker-pulse" />}
        </div>
        <span className="ticker-label">Agent communication layer</span>
        <span className="ticker-live">● Live</span>
      </div>
      <div className="ticker-msgs">
        {messages.slice(0, count).map((row, i) => (
          <motion.div
            key={i}
            className="ticker-line"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
          >
            <span className="t-agent">{row.from}</span>
            <span className="t-arrow">→</span>
            <span className="t-agent">{row.to}</span>
            &nbsp;
            {row.flag && <span className="t-flag">{row.flag}</span>}
            {row.msg}
            {row.conf && <span className="t-conf">{row.conf}</span>}
          </motion.div>
        ))}
        {inView && count < messages.length && (
          <div className="ticker-typing">
            <span /><span /><span />
          </div>
        )}
      </div>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()

  return (
    <>
      <CloudBackground />
      <Nav />

      <div className="page">
        <section className="hero">
          <div className="hero-particles" aria-hidden>
            {[
              { x: '8%',  size: '2px', alpha: 0.4, dur: '9s',  delay: '0s'   },
              { x: '18%', size: '3px', alpha: 0.55, dur: '11s', delay: '2s'   },
              { x: '32%', size: '2px', alpha: 0.35, dur: '13s', delay: '4s'   },
              { x: '45%', size: '4px', alpha: 0.5, dur: '10s', delay: '1s'   },
              { x: '58%', size: '2px', alpha: 0.3, dur: '14s', delay: '6s'   },
              { x: '70%', size: '3px', alpha: 0.45, dur: '12s', delay: '3s'   },
              { x: '82%', size: '2px', alpha: 0.4, dur: '11s', delay: '5s'   },
              { x: '93%', size: '3px', alpha: 0.5, dur: '9s',  delay: '7s'   },
              { x: '25%', size: '2px', alpha: 0.3, dur: '15s', delay: '8s'   },
              { x: '55%', size: '3px', alpha: 0.45, dur: '10s', delay: '0.5s' },
              { x: '75%', size: '2px', alpha: 0.35, dur: '13s', delay: '3.5s' },
              { x: '40%', size: '4px', alpha: 0.5, dur: '11s', delay: '9s'   },
            ].map((p, i) => (
              <span key={i} style={{ '--x': p.x, '--size': p.size, '--alpha': p.alpha, '--dur': p.dur, '--delay': p.delay }} />
            ))}
          </div>

          <motion.p
            className="hero-eyebrow"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, ease: EASE_OUT, delay: 0.3 }}
          >
            Mental health · AI agents · Real-time defense
          </motion.p>

          <motion.h1
            className="hero-title"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.3, ease: EASE_OUT, delay: 0.48 }}
          >
            dialed
          </motion.h1>

          <motion.p
            className="hero-tagline"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, ease: EASE_OUT, delay: 0.76 }}
          >
            Above the noise.
          </motion.p>

          <motion.p
            className="hero-desc"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, ease: EASE_OUT, delay: 0.95 }}
          >
            Autonomous AI agents that watch your social feed, classify
            manipulation in real time, and intervene before the brain rot lands.
          </motion.p>

          <motion.div
            className="hero-ctas"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: EASE_OUT, delay: 1.12 }}
          >
            <button className="btn-primary" onClick={() => navigate('/login')}>
              Start a session
            </button>
            <button className="btn-ghost" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
              See the architecture
            </button>
          </motion.div>

          <ScrollHint />
        </section>

        <div className="marquee" aria-hidden>
          <div className="marquee-track">
            {[...Array(2)].map((_, copy) => (
              <div className="marquee-content" key={copy}>
                {['Scout', 'Classify', 'Intervene', 'Real-time defense', 'AI agents', 'Mental health', 'Brain rot detection', 'Feed analysis'].map(t => (
                  <span key={t}>{t}<span className="marquee-dot">·</span></span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section className="features" id="how-it-works">
          <Reveal className="features-header">
            <p className="section-label">System architecture</p>
            <h2 className="section-heading">
              How dialed<br />defends your attention.
            </h2>
          </Reveal>

          <Reveal>
            <div className="pipeline">
              {['Content', 'Scout', 'Classify', 'Intervene', 'Safe'].map((step, i, arr) => (
                <div className="pipeline-step" key={step}>
                  <span className="pipeline-node">{step}</span>
                  {i < arr.length - 1 && (
                    <span className="pipeline-connector">
                      <span className="pipeline-line" />
                      <span className="pipeline-dot" style={{ animationDelay: `${i * 0.6}s` }} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Reveal>

          <div className="features-stack">
            {FEATURES.map((f, i) => (
              <Reveal key={f.num} delay={i * 0.11}>
                <div className="feature-card">
                  <div className="feature-text">
                    <span className="feature-num">{f.num}</span>
                    <h3 className="feature-title">{f.title}</h3>
                    <p className="feature-desc">{f.desc}</p>
                    <span className="feature-detail">{f.detail}</span>
                  </div>
                  <div className="feature-visual">
                    {f.num === '01' && <ScoutVisual />}
                    {f.num === '02' && <ClassifyVisual />}
                    {f.num === '03' && <InterveneVisual />}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="stats">
          {[
            { value: '5',        label: 'Coordinated agents' },
            { value: '5',        label: 'Distinct agent voices' },
            { value: '<5s',      label: 'Classification latency' },
            { value: '4',        label: 'Intervention types' },
            { value: 'Real-time', label: 'Feed defense' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08} className="stat">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </Reveal>
          ))}
        </section>

        <section className="journey">
          <Reveal>
            <p className="section-label">Your experience</p>
            <h2 className="section-heading">
              Your feed,<br />defended.
            </h2>
          </Reveal>

          <div className="journey-layout">
            <div className="journey-steps">
              {[
                {
                  num: 'I',
                  title: 'Connect',
                  desc: 'Link your social accounts. The agents need access to see what the algorithm shows you.',
                },
                {
                  num: 'II',
                  title: 'Browse',
                  desc: 'Use your feed like normal. Scout watches silently in the background, classifying every piece of content in real time.',
                },
                {
                  num: 'III',
                  title: 'Stay safe',
                  desc: 'When brain rot is detected, Dialed intervenes automatically — overlays, redirects, or full scroll locks. A session report writes itself as each tactic is caught.',
                },
              ].map((s, i) => (
                <Reveal key={s.num} delay={i * 0.12}>
                  <div className="journey-step">
                    <span className="journey-num">{s.num}</span>
                    <div>
                      <h3 className="journey-title">{s.title}</h3>
                      <p className="journey-desc">{s.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.15}>
              <div className="journey-visual">
                <div className="journey-phone">
                  <div className="journey-screen">
                    <div className="journey-screen-bar">
                      <span className="journey-screen-dot" />
                      <span className="journey-screen-title">Feed</span>
                    </div>
                    <div className="journey-screen-item" />
                    <div className="journey-screen-item journey-screen-item--flagged">
                      <span className="journey-screen-flag">Blocked</span>
                    </div>
                    <div className="journey-screen-item" />
                    <div className="journey-screen-status">
                      <span className="journey-screen-dot journey-screen-dot--live" />
                      <span>Dialed active</span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="dashboard-preview">
          <Reveal>
            <p className="section-label">The command center</p>
            <h2 className="section-heading">
              Three panels.<br />Total visibility.
            </h2>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="dash-tri">
              <div className="dash-panel dash-panel--feed">
                <span className="dash-panel-label">Live feed</span>
                <div className="dash-panel-mock">
                  <div className="dash-mock-row" />
                  <div className="dash-mock-row dash-mock-row--flagged" />
                  <div className="dash-mock-row" />
                </div>
                <span className="dash-panel-desc">Single browser session — overlays fire directly on flagged content</span>
              </div>
              <div className="dash-panel dash-panel--comms">
                <span className="dash-panel-label">Agent comms + Letter</span>
                <div className="dash-panel-mock">
                  <div className="dash-mock-line" /><div className="dash-mock-line dash-mock-line--short" /><div className="dash-mock-line" />
                  <div className="dash-mock-sep" />
                  <div className="dash-mock-line dash-mock-line--italic" /><div className="dash-mock-line dash-mock-line--italic dash-mock-line--short" />
                </div>
                <span className="dash-panel-desc">Real-time agent deliberation log and the Algorithm's letter</span>
              </div>
              <div className="dash-panel dash-panel--cmd">
                <span className="dash-panel-label">Command center</span>
                <div className="dash-panel-mock">
                  <div className="dash-mock-avatar-row">
                    {['B', 'C', 'X', 'S', 'A'].map(l => (
                      <span className="dash-mock-avatar" key={l}>{l}</span>
                    ))}
                  </div>
                  <div className="dash-mock-chat">
                    <div className="dash-mock-bubble dash-mock-bubble--user" />
                    <div className="dash-mock-bubble dash-mock-bubble--agent" />
                  </div>
                </div>
                <span className="dash-panel-desc">Agent cards with voice + user chat to command the swarm</span>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="agents" id="agents">
          <Reveal>
            <p className="section-label">Live agent feed</p>
            <h2 className="section-heading">
              The intelligence layer,<br />thinking aloud.
            </h2>
          </Reveal>

          <Reveal delay={0.15}>
            <AgentFeed messages={TICKER} />
          </Reveal>
        </section>

        <section className="voice-layer">
          <Reveal>
            <p className="section-label">Voice layer</p>
            <h2 className="section-heading">
              Five agents.<br />Five voices.
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="voice-intro">
              Every agent in the swarm has a distinct ElevenLabs voice. Hover over an agent card and hear it think aloud — the Boss dispatching, the Classifier analyzing, the Strategist escalating. The Letter narrates itself in the algorithm's own cold, corporate voice.
            </p>
          </Reveal>

          <div className="voice-agents">
            {[
              { initial: 'B', name: 'Boss',       tone: 'Authoritative · steady cadence' },
              { initial: 'C', name: 'Classifier',  tone: 'Clinical · flat affect' },
              { initial: 'X', name: 'Context',     tone: 'Cautious · measured pace' },
              { initial: 'S', name: 'Strategist',  tone: 'Decisive · crisp delivery' },
              { initial: 'A', name: 'Synthesis',   tone: 'Cold · confessional calm' },
            ].map((a, i) => (
              <Reveal key={a.name} delay={i * 0.08}>
                <div className="voice-card">
                  <span className="voice-avatar">{a.initial}</span>
                  <div className="voice-wave">
                    {[...Array(5)].map((_, j) => (
                      <span key={j} className="voice-bar" style={{ animationDelay: `${j * 0.12}s` }} />
                    ))}
                  </div>
                  <span className="voice-name">{a.name}</span>
                  <span className="voice-tone">{a.tone}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="confession">
          <div className="confession-layout">
            <div className="confession-text">
              <Reveal>
                <p className="section-label">Summary</p>
                <h2 className="section-heading">
                  The confession.
                </h2>
              </Reveal>

              <Reveal delay={0.1}>
                <p className="confession-intro">
                  After each session, Dialed generates a plain-language summary of everything it caught and every action it took — so you know exactly what happened while you were scrolling.
                </p>
              </Reveal>
            </div>

            <Reveal delay={0.15}>
              <div className="confession-quote">
                <blockquote>
                  "Session lasted 14 minutes. 23 Reels scanned. 9 pieces of brain rot detected — 4 rage bait, 3 outrage amplification, 2 parasocial traps. 6 interventions fired: 3 warning overlays, 2 content replacements, 1 hard redirect. Creators @drama_daily_tea and @viral.rage.clips flagged multiple times. 4 minutes and 12 seconds of attention reclaimed. Session state reached Elevated at the 8-minute mark."
                </blockquote>
                <cite className="confession-cite">
                  — Session report generated automatically by the Synthesis agent
                </cite>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="command-center">
          <div className="cmd-layout">
            <div className="cmd-text">
              <Reveal>
                <p className="section-label">User control</p>
                <h2 className="section-heading">
                  You command<br />the swarm.
                </h2>
              </Reveal>

              <Reveal delay={0.1}>
                <p className="cmd-intro">
                  This isn't a passive demo. Talk to your agents mid-session — adjust aggressiveness, whitelist creators, ask for explanations. They respond in their own voice.
                </p>
              </Reveal>
            </div>

            <Reveal delay={0.15}>
              <div className="cmd-chat-demo">
                {[
                  { role: 'user',  text: 'Go more aggressive.' },
                  { role: 'agent', agent: 'Context', text: 'Shifting to Elevated state. Thresholds tightened — near-zero tolerance active.' },
                  { role: 'user',  text: 'Why did you flag that last one?' },
                  { role: 'agent', agent: 'Classifier', text: 'Rage bait detected. Outrage amplification pattern with 0.91 confidence. Creator @drama_daily_tea flagged twice this session.' },
                  { role: 'user',  text: 'How much time have you saved me?' },
                  { role: 'agent', agent: 'Boss', text: '23 Reels scanned. 9 brain rot detections. 6 interventions. 4 min 12 sec reclaimed.' },
                ].map((m, i) => (
                  <Reveal key={i} delay={i * 0.08}>
                    <div className={`cmd-bubble cmd-bubble--${m.role}`}>
                      {m.agent && <span className="cmd-agent">{m.agent}</span>}
                      <span>{m.text}</span>
                    </div>
                  </Reveal>
                ))}
                <div className="cmd-input-mock">
                  <span>Talk to your agents...</span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <div className="marquee marquee--reverse" aria-hidden>
          <div className="marquee-track marquee-track--reverse">
            {[...Array(2)].map((_, copy) => (
              <div className="marquee-content" key={copy}>
                {['Fetch.ai', 'Claude Sonnet', 'ElevenLabs', 'browser-use', 'Chromium', 'Supabase', 'React', 'Vite', 'DOM injection'].map(t => (
                  <span key={t}>{t}<span className="marquee-dot">·</span></span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section className="cta-section" id="get-started">
          <Reveal>
            <h2 className="cta-heading">Stay dialed in.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="cta-sub">
              The algorithm never sleeps.<br />Now, neither do we.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <button
              className="btn-primary"
              style={{ fontSize: '0.82rem', padding: '1rem 2.5rem' }}
              onClick={() => navigate('/login')}
            >
              Launch the demo
            </button>
          </Reveal>
        </section>

        <footer className="footer">
          <span className="footer-logo">dialed.</span>
          <span className="footer-meta">Nathan Kim &amp; Matthew Kim · March 2026 · Mental Health Track</span>
        </footer>
      </div>
    </>
  )
}
