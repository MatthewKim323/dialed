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
        <div className="ticker-dot" />
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
                    <span className="pipeline-arrow">→</span>
                  )}
                </div>
              ))}
            </div>
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

        <section className="stats">
          {[
            { value: '5',        label: 'Coordinated agents' },
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

        <div className="marquee marquee--reverse" aria-hidden>
          <div className="marquee-track marquee-track--reverse">
            {[...Array(2)].map((_, copy) => (
              <div className="marquee-content" key={copy}>
                {['Fetch.ai', 'Claude Sonnet', 'browser-use', 'Chromium', 'Supabase', 'React', 'Vite', 'DOM injection'].map(t => (
                  <span key={t}>{t}<span className="marquee-dot">·</span></span>
                ))}
              </div>
            ))}
          </div>
        </div>

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
