import './App.css'
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import CloudBackground from './components/CloudBackground'
import Nav from './components/Nav'

// ── Shared easing ─────────────────────────────────────────────────────────
const EASE_OUT = [0.22, 1, 0.36, 1]

// ── Scroll-reveal wrapper ─────────────────────────────────────────────────
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

const FEATURES = [
  {
    num: '01',
    title: 'Scout',
    desc: 'An autonomous browser agent logs into your account, navigates your live feed, and captures every piece of content as a structured payload — screenshot, metadata, and engagement signals.',
    detail: 'browser-use · headless Chromium · 2–4 fps stream',
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
    desc: 'A second browser agent fires the defense in real time: warning overlays, content replacement, hard redirects, or a full scroll lock. The Algorithm\'s letter writes itself as each tactic is caught.',
    detail: 'DOM injection · 4 intervention types · session report',
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

export default function App() {
  return (
    <>
      <CloudBackground />

      {/* ── Nav ── */}
      <Nav />

      <div className="page">
        {/* ── Hero ── */}
        <section className="hero">
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
            <button className="btn-primary">Start a session</button>
            <button className="btn-ghost">See the architecture</button>
          </motion.div>

          <motion.div
            className="scroll-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.1, duration: 1.2 }}
          >
            <span>scroll</span>
            <div className="scroll-line" />
          </motion.div>
        </section>

        {/* ── Features ── */}
        <section className="features" id="how-it-works">
          <Reveal className="features-header">
            <p className="section-label">System architecture</p>
            <h2 className="section-heading">
              How dialed<br />defends your attention.
            </h2>
          </Reveal>

          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.num} delay={i * 0.11}>
                <div className="feature-card">
                  <span className="feature-num">{f.num}</span>
                  <h3 className="feature-title">{f.title}</h3>
                  <p className="feature-desc">{f.desc}</p>
                  <span className="feature-detail">{f.detail}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Agent ticker ── */}
        <section className="agents" id="agents">
          <Reveal>
            <p className="section-label">Live agent feed</p>
            <h2 className="section-heading">
              The intelligence layer,<br />thinking aloud.
            </h2>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="ticker-card">
              <div className="ticker-header">
                <div className="ticker-dot" />
                <span className="ticker-label">Agent communication layer</span>
                <span className="ticker-live">● Live</span>
              </div>
              <div className="ticker-msgs">
                {TICKER.map((row, i) => (
                  <div key={i} className="ticker-line">
                    <span className="t-agent">{row.from}</span>
                    <span className="t-arrow">→</span>
                    <span className="t-agent">{row.to}</span>
                    &nbsp;
                    {row.flag && <span className="t-flag">{row.flag}</span>}
                    {row.msg}
                    {row.conf && <span className="t-conf">{row.conf}</span>}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Letter ── */}
        <section className="letter-section">
          <Reveal>
            <div className="letter-card">
              <p className="section-label">Letter from the algorithm</p>
              <blockquote className="letter-quote">
                "I showed you the outrage because you were already angry.
                I knew the comparison would land. I surfaced him again because
                you paused for 0.3 seconds too long. Every tactic is catalogued here.
                <em> None of them worked this time.</em>"
              </blockquote>
              <cite className="letter-cite">
                — Generated in real time as dialed intercepted your session
              </cite>
            </div>
          </Reveal>
        </section>

        {/* ── Final CTA ── */}
        <section className="cta-section">
          <Reveal>
            <h2 className="cta-heading">Stay dialed in.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="cta-sub">
              The algorithm never sleeps.<br />Now, neither do we.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <button className="btn-primary" style={{ fontSize: '0.82rem', padding: '1rem 2.5rem' }}>
              Launch the demo
            </button>
          </Reveal>
        </section>

        {/* ── Footer ── */}
        <footer className="footer">
          <span className="footer-logo">dialed.</span>
          <span className="footer-meta">Nathan Doan &amp; Matthew Kim · March 2026 · Mental Health Track</span>
        </footer>
      </div>
    </>
  )
}
