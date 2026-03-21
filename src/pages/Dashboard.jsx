import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import './Dashboard.css'

const EASE = [0.22, 1, 0.36, 1]

const TICKER_SEQUENCE = [
  { delay: 1500,  from: 'System',     to: 'Scout',        msg: 'Session initialized — connecting to Instagram feed',                                              type: 'system' },
  { delay: 3500,  from: 'Scout',      to: 'System',       msg: 'Authentication verified. Feed access confirmed.',                                                  type: 'system' },
  { delay: 5500,  from: 'Scout',      to: 'Boss',         msg: 'ContentPayload #1 — @travel.vibes — "Golden hour in Santorini" — 43.2K likes',                     type: 'payload' },
  { delay: 7500,  from: 'Boss',       to: 'Classifier',   msg: 'Dispatching for analysis — checking against intent profile triggers',                              type: 'dispatch' },
  { delay: 9000,  from: 'Classifier', to: 'Boss',         msg: 'CLEAR — travel/photography — intent-aligned — conf: 0.08',                                         type: 'clear' },
  { delay: 12000, from: 'Scout',      to: 'Boss',         msg: 'ContentPayload #2 — @drama.central — "You won\'t BELIEVE what she said 💀"',                       type: 'payload' },
  { delay: 14000, from: 'Boss',       to: 'Classifier',   msg: 'Dispatching — flagged patterns: curiosity gap, emotional bait',                                    type: 'dispatch' },
  { delay: 15500, from: 'Classifier', to: 'Boss',         msg: 'BRAIN ROT — clickbait + engagement bait — conf: 0.87',                                             type: 'alert' },
  { delay: 16500, from: 'Context',    to: 'Boss',         msg: 'State: NORMAL — concur with verdict — no intervention fatigue',                                     type: 'context' },
  { delay: 17500, from: 'Boss',       to: 'Strategist',   msg: 'Confirmed brain rot — requesting intervention strategy',                                           type: 'verdict' },
  { delay: 19000, from: 'Strategist', to: 'Intervention', msg: 'WARNING OVERLAY — "This content uses clickbait tactics to hijack your attention"',                  type: 'intervention' },
  { delay: 20500, from: 'Synthesis',  to: 'Letter',       msg: 'Appending — tactic: curiosity gap — hook: manufactured suspense',                                   type: 'synthesis' },
  { delay: 24000, from: 'Scout',      to: 'Boss',         msg: 'ContentPayload #3 — @chef.marco — "3-ingredient pasta" — 28.1K likes',                             type: 'payload' },
  { delay: 26000, from: 'Classifier', to: 'Boss',         msg: 'CLEAR — cooking content — no manipulation — conf: 0.11',                                           type: 'clear' },
  { delay: 30000, from: 'Scout',      to: 'Boss',         msg: 'ContentPayload #4 — @hot.takes — "This is EVERYTHING wrong with your generation"',                 type: 'payload' },
  { delay: 32000, from: 'Boss',       to: 'Classifier',   msg: 'Dispatching — flagged: outrage pattern, generational targeting',                                    type: 'dispatch' },
  { delay: 33500, from: 'Classifier', to: 'Boss',         msg: 'BRAIN ROT — rage bait + outrage amplification — conf: 0.94',                                       type: 'alert' },
  { delay: 35000, from: 'Context',    to: 'Boss',         msg: 'ESCALATING → ELEVATED — 2 detections in 5 items — threshold now 0.50',                              type: 'escalate' },
  { delay: 37000, from: 'Strategist', to: 'Intervention', msg: 'FULL OVERLAY — severity: HIGH — "Rage bait detected. Exploiting moral outrage."',                  type: 'intervention' },
  { delay: 38500, from: 'Synthesis',  to: 'Letter',       msg: 'Appending — tactic: outrage amplification — intended emotion: moral indignation',                   type: 'synthesis' },
  { delay: 43000, from: 'Scout',      to: 'Boss',         msg: 'ContentPayload #5 — @nature.daily — "Morning fog in the Cascades" — 67K likes',                    type: 'payload' },
  { delay: 45000, from: 'Classifier', to: 'Boss',         msg: 'CLEAR — nature photography — strongly intent-aligned — conf: 0.04',                                type: 'clear' },
  { delay: 49000, from: 'Scout',      to: 'Boss',         msg: 'ContentPayload #6 — @fomo.life — "Everyone is doing this and you\'re missing out"',                 type: 'payload' },
  { delay: 51000, from: 'Classifier', to: 'Boss',         msg: 'BRAIN ROT — FOMO exploitation + social comparison — conf: 0.91',                                   type: 'alert' },
  { delay: 52500, from: 'Context',    to: 'Boss',         msg: 'State holds ELEVATED — 3 detections — intervention fatigue: LOW',                                   type: 'context' },
  { delay: 54000, from: 'Strategist', to: 'Intervention', msg: 'OVERLAY + REDIRECT — severity: HIGH — redirecting to user-defined destination',                    type: 'intervention' },
  { delay: 55500, from: 'Synthesis',  to: 'Letter',       msg: 'Appending — tactic: FOMO exploitation — hook: exclusion anxiety',                                   type: 'synthesis' },
]

const LETTER_TEXT = `I showed you @drama.central because the curiosity gap in "You won't BELIEVE" has a 73% pause rate with profiles like yours. I knew you'd stop scrolling. That pause was my signal to queue three more just like it.

Then came the outrage. @hot.takes has learned that generational conflict generates the longest view durations in your demographic. I surfaced it because your session engagement was cooling — I needed an emotional spike to pull you back.

The FOMO was my final play. @fomo.life targets the exact insecurity profile your browsing history suggests. I amplified it because two previous interventions had disrupted my retention loop.

Every tactic documented here was deployed against you in real time. None of them landed. Your agents caught each one before the dopamine hook could set.`

const STATE_COLORS = {
  NORMAL:   { bg: 'rgba(34,197,94,0.12)',  color: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  ELEVATED: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  ALERT:    { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
  COOLDOWN: { bg: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: 'rgba(56,189,248,0.25)' },
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function TypeLabel({ type }) {
  const map = {
    system:       { label: 'SYS',   cls: 'dash-tag--sys' },
    payload:      { label: 'DATA',  cls: 'dash-tag--data' },
    dispatch:     { label: 'SEND',  cls: 'dash-tag--send' },
    clear:        { label: 'SAFE',  cls: 'dash-tag--safe' },
    alert:        { label: 'ALERT', cls: 'dash-tag--alert' },
    context:      { label: 'CTX',   cls: 'dash-tag--ctx' },
    escalate:     { label: 'ESC',   cls: 'dash-tag--esc' },
    verdict:      { label: 'VERDICT', cls: 'dash-tag--verdict' },
    intervention: { label: 'ACT',   cls: 'dash-tag--act' },
    synthesis:    { label: 'WRITE', cls: 'dash-tag--write' },
  }
  const { label, cls } = map[type] || map.system
  return <span className={`dash-tag ${cls}`}>{label}</span>
}

export default function Dashboard() {
  const navigate = useNavigate()
  const tickerRef = useRef(null)

  const [sessionTime, setSessionTime] = useState(0)
  const [messages, setMessages] = useState([])
  const [letterChars, setLetterChars] = useState(0)
  const [letterStarted, setLetterStarted] = useState(false)
  const [stats, setStats] = useState({ scanned: 0, detected: 0, interventions: 0, reclaimed: 0 })
  const [sessionState, setSessionState] = useState('NORMAL')

  // Session timer
  useEffect(() => {
    const iv = setInterval(() => setSessionTime(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  // Ticker sequence
  useEffect(() => {
    const timeouts = TICKER_SEQUENCE.map(entry =>
      setTimeout(() => {
        setMessages(prev => [...prev, entry])

        if (entry.type === 'payload') setStats(s => ({ ...s, scanned: s.scanned + 1 }))
        if (entry.type === 'alert')   setStats(s => ({ ...s, detected: s.detected + 1 }))
        if (entry.type === 'intervention') {
          setStats(s => ({
            ...s,
            interventions: s.interventions + 1,
            reclaimed: s.reclaimed + Math.floor(Math.random() * 20) + 15,
          }))
        }
        if (entry.type === 'escalate') setSessionState('ELEVATED')
        if (entry.type === 'synthesis' && !letterStarted) setLetterStarted(true)
      }, entry.delay)
    )
    return () => timeouts.forEach(clearTimeout)
  }, [])

  // Letter typing
  useEffect(() => {
    if (!letterStarted) return
    const iv = setInterval(() => {
      setLetterChars(c => {
        if (c >= LETTER_TEXT.length) { clearInterval(iv); return c }
        return c + 1
      })
    }, 28)
    return () => clearInterval(iv)
  }, [letterStarted])

  // Auto-scroll ticker
  useEffect(() => {
    if (tickerRef.current) {
      tickerRef.current.scrollTop = tickerRef.current.scrollHeight
    }
  }, [messages])

  const stateStyle = STATE_COLORS[sessionState]

  return (
    <div className="dash">
      {/* ── Nav ── */}
      <motion.nav
        className="dash-nav"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <Link to="/" className="dash-logo">dialed.</Link>

        <div className="dash-nav-center">
          <div className="dash-timer">
            <span className="dash-timer-dot" />
            {formatTime(sessionTime)}
          </div>
          <div
            className="dash-state"
            style={{
              background: stateStyle.bg,
              color: stateStyle.color,
              borderColor: stateStyle.border,
            }}
          >
            {sessionState}
          </div>
        </div>

        <div className="dash-nav-right">
          <button className="dash-end" onClick={() => navigate('/')}>
            End Session
          </button>
        </div>
      </motion.nav>

      {/* ── Main grid ── */}
      <div className="dash-grid">
        {/* Left: Scout Stream */}
        <motion.div
          className="dash-panel dash-stream"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
        >
          <div className="dash-panel-header">
            <span className="dash-panel-dot dash-panel-dot--blue" />
            <span className="dash-panel-title">Scout Agent</span>
            <span className="dash-panel-status">Streaming</span>
          </div>
          <div className="dash-stream-body">
            <div className="dash-stream-placeholder">
              <div className="dash-stream-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
              </div>
              <p className="dash-stream-label">Live feed monitoring</p>
              <span className="dash-stream-sub">instagram.com/reels</span>
              <div className="dash-stream-scan">
                <div className="dash-scan-line" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Center: Ticker + Letter */}
        <div className="dash-center">
          {/* Agent Ticker */}
          <motion.div
            className="dash-panel dash-ticker"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
          >
            <div className="dash-panel-header">
              <span className="dash-panel-dot dash-panel-dot--green" />
              <span className="dash-panel-title">Agent Communication</span>
              <span className="dash-panel-live">LIVE</span>
            </div>
            <div className="dash-ticker-body" ref={tickerRef}>
              <AnimatePresence>
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    className="dash-ticker-line"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                  >
                    <TypeLabel type={m.type} />
                    <span className="dash-ticker-agents">
                      <span className="dash-ticker-from">{m.from}</span>
                      <span className="dash-ticker-arrow">&rarr;</span>
                      <span className="dash-ticker-to">{m.to}</span>
                    </span>
                    <span className="dash-ticker-msg">{m.msg}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {messages.length === 0 && (
                <div className="dash-ticker-empty">
                  <span className="dash-ticker-waiting" />
                  Initializing agent pipeline...
                </div>
              )}
            </div>
          </motion.div>

          {/* Letter */}
          <motion.div
            className="dash-panel dash-letter"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.35 }}
          >
            <div className="dash-panel-header">
              <span className="dash-panel-dot dash-panel-dot--amber" />
              <span className="dash-panel-title">Letter from the Algorithm</span>
            </div>
            <div className="dash-letter-body">
              {letterChars > 0 ? (
                <p className="dash-letter-text">
                  {LETTER_TEXT.slice(0, letterChars)}
                  <span className="dash-letter-cursor" />
                </p>
              ) : (
                <p className="dash-letter-waiting">
                  Waiting for first detection...
                </p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right: Intervention Stream */}
        <motion.div
          className="dash-panel dash-stream"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
        >
          <div className="dash-panel-header">
            <span className="dash-panel-dot dash-panel-dot--red" />
            <span className="dash-panel-title">Intervention Agent</span>
            <span className="dash-panel-status">Standing by</span>
          </div>
          <div className="dash-stream-body">
            <div className="dash-stream-placeholder">
              <div className="dash-stream-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <p className="dash-stream-label">Defense active</p>
              <span className="dash-stream-sub">Awaiting intervention orders</span>
              <div className="dash-stream-pulse">
                <span /><span /><span />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Status bar ── */}
      <motion.footer
        className="dash-status"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
      >
        <div className="dash-stat">
          <span className="dash-stat-value">{stats.scanned}</span>
          <span className="dash-stat-label">scanned</span>
        </div>
        <div className="dash-stat-sep" />
        <div className="dash-stat">
          <span className="dash-stat-value dash-stat-value--alert">{stats.detected}</span>
          <span className="dash-stat-label">detected</span>
        </div>
        <div className="dash-stat-sep" />
        <div className="dash-stat">
          <span className="dash-stat-value dash-stat-value--act">{stats.interventions}</span>
          <span className="dash-stat-label">interventions</span>
        </div>
        <div className="dash-stat-sep" />
        <div className="dash-stat">
          <span className="dash-stat-value dash-stat-value--reclaimed">{stats.reclaimed}s</span>
          <span className="dash-stat-label">reclaimed</span>
        </div>
      </motion.footer>
    </div>
  )
}
