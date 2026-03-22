import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import CloudBackground from '../components/CloudBackground'
import './Dashboard.css'

const EASE = [0.22, 1, 0.36, 1]
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_URL = API_URL.replace(/^http/, 'ws')

// ── Mock data (fallback when backend isn't running) ─────────────────────

const MOCK_TICKER = [
  { delay: 1500,  from: 'System',     to: 'Scout',        msg: 'Session initialized — connecting to Instagram feed',                                    type: 'system' },
  { delay: 3500,  from: 'Scout',      to: 'System',       msg: 'Authentication verified. Feed access confirmed.',                                        type: 'system' },
  { delay: 5500,  from: 'Scout',      to: 'Boss',         msg: 'ContentPayload #1 — @travel.vibes — "Golden hour in Santorini" — 43.2K likes',           type: 'payload' },
  { delay: 7500,  from: 'Boss',       to: 'Classifier',   msg: 'Dispatching for analysis — checking against intent profile triggers',                    type: 'dispatch' },
  { delay: 9000,  from: 'Classifier', to: 'Boss',         msg: 'CLEAR — travel/photography — intent-aligned — conf: 0.08',                               type: 'clear' },
  { delay: 12000, from: 'Scout',      to: 'Boss',         msg: 'ContentPayload #2 — @drama.central — "You won\'t BELIEVE what she said"',                type: 'payload' },
  { delay: 14000, from: 'Boss',       to: 'Classifier',   msg: 'Dispatching — flagged patterns: curiosity gap, emotional bait',                          type: 'dispatch' },
  { delay: 15500, from: 'Classifier', to: 'Boss',         msg: 'BRAIN ROT — clickbait + engagement bait — conf: 0.87',                                   type: 'alert' },
  { delay: 16500, from: 'Context',    to: 'Boss',         msg: 'State: NORMAL — concur with verdict — no intervention fatigue',                           type: 'context' },
  { delay: 17500, from: 'Boss',       to: 'Strategist',   msg: 'Confirmed brain rot — requesting intervention strategy',                                 type: 'verdict' },
  { delay: 19000, from: 'Strategist', to: 'System',       msg: 'WARNING OVERLAY — "This content uses clickbait tactics"',                                type: 'intervention' },
  { delay: 20500, from: 'Synthesis',  to: 'Boss',         msg: 'Recording — tactic: curiosity gap — flagged for session report',                          type: 'synthesis' },
  { delay: 24000, from: 'Scout',      to: 'Boss',         msg: 'ContentPayload #3 — @chef.marco — "3-ingredient pasta" — 28.1K likes',                   type: 'payload' },
  { delay: 26000, from: 'Classifier', to: 'Boss',         msg: 'CLEAR — cooking content — no manipulation — conf: 0.11',                                 type: 'clear' },
  { delay: 30000, from: 'Scout',      to: 'Boss',         msg: 'ContentPayload #4 — @hot.takes — "This is EVERYTHING wrong with your generation"',       type: 'payload' },
  { delay: 32000, from: 'Boss',       to: 'Classifier',   msg: 'Dispatching — flagged: outrage pattern, generational targeting',                          type: 'dispatch' },
  { delay: 33500, from: 'Classifier', to: 'Boss',         msg: 'BRAIN ROT — rage bait + outrage amplification — conf: 0.94',                             type: 'alert' },
  { delay: 35000, from: 'Context',    to: 'Boss',         msg: 'ESCALATING → ELEVATED — 2 detections in 5 items — threshold now 0.50',                    type: 'escalate' },
  { delay: 37000, from: 'Strategist', to: 'System',       msg: 'FULL OVERLAY — severity: HIGH — "Rage bait detected."',                                  type: 'intervention' },
  { delay: 38500, from: 'Synthesis',  to: 'Boss',         msg: 'Recording — tactic: outrage amplification — added to session report',                     type: 'synthesis' },
]

const STATE_COLORS = {
  NORMAL:   { bg: 'rgba(42,157,92,0.1)',   color: '#1e8449', border: 'rgba(42,157,92,0.25)' },
  ELEVATED: { bg: 'rgba(199,140,32,0.1)',  color: '#9a6f15', border: 'rgba(199,140,32,0.25)' },
  ALERT:    { bg: 'rgba(192,80,42,0.1)',   color: '#C0502A', border: 'rgba(192,80,42,0.25)' },
  COOLDOWN: { bg: 'rgba(46,110,168,0.1)',  color: 'var(--accent)', border: 'rgba(46,110,168,0.25)' },
}

const PROFILE_LABELS = {
  gentle: 'Gentle nudges',
  moderate: 'Moderate overlays',
  aggressive: 'Hard redirects',
  '15': '15 min', '30': '30 min', '60': '1 hr', none: 'No limit',
}

const AGENT_META = {
  boss:       { icon: 'B', color: '#4a6fa5', label: 'Boss Agent',     role: 'Dispatch & Coordination' },
  classifier: { icon: 'C', color: '#C0502A', label: 'Classifier',     role: 'Brain Rot Detection' },
  context:    { icon: 'X', color: '#7c4dbd', label: 'Context Agent',  role: 'Session State Machine' },
  strategist: { icon: 'S', color: '#9a6f15', label: 'Strategist',     role: 'Intervention Planning' },
  synthesis:  { icon: 'A', color: '#1e8449', label: 'Synthesis Agent', role: 'Session Summary & Reports' },
}

function truncAddr(addr) {
  if (!addr) return ''
  return addr.slice(0, 12) + '...' + addr.slice(-6)
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function TypeLabel({ type }) {
  const map = {
    system:       { label: 'SYS',     cls: 'dash-tag--sys' },
    payload:      { label: 'DATA',    cls: 'dash-tag--data' },
    dispatch:     { label: 'SEND',    cls: 'dash-tag--send' },
    clear:        { label: 'SAFE',    cls: 'dash-tag--safe' },
    alert:        { label: 'ALERT',   cls: 'dash-tag--alert' },
    context:      { label: 'CTX',     cls: 'dash-tag--ctx' },
    escalate:     { label: 'ESC',     cls: 'dash-tag--esc' },
    verdict:      { label: 'VERDICT', cls: 'dash-tag--verdict' },
    intervention: { label: 'ACT',     cls: 'dash-tag--act' },
    synthesis:    { label: 'WRITE',   cls: 'dash-tag--write' },
  }
  const { label, cls } = map[type] || map.system
  return <span className={`dash-tag ${cls}`}>{label}</span>
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOBBY — Pre-session screen
   ═══════════════════════════════════════════════════════════════════════════ */

function Lobby({ user, profile, onStart, saveSocialCreds }) {
  const navigate = useNavigate()
  const name = user?.user_metadata?.name || user?.email?.split('@')[0] || ''

  const hasSavedCreds = !!profile?.ig_username
  const [showCredForm, setShowCredForm] = useState(!hasSavedCreds)
  const [igUser, setIgUser] = useState(profile?.ig_username || '')
  const [igPass, setIgPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [credError, setCredError] = useState(null)

  useEffect(() => {
    if (profile?.ig_username) {
      setIgUser(profile.ig_username)
      setShowCredForm(false)
    }
  }, [profile])

  const handleSaveCreds = async () => {
    if (!igUser.trim() || !igPass.trim()) {
      setCredError('Both fields are required')
      return
    }
    setSaving(true)
    setCredError(null)
    try {
      await saveSocialCreds('ig', igUser.trim(), igPass.trim())
      setShowCredForm(false)
    } catch (err) {
      setCredError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const canStart = !!profile?.ig_username

  return (
    <div className="lobby">
      <motion.nav
        className="dash-nav"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <Link to="/" className="dash-logo">dialed.</Link>
        <div className="dash-nav-center" />
        <div className="dash-nav-right">
          <Link to="/profile" className="lobby-profile-link">Profile</Link>
        </div>
      </motion.nav>

      <div className="lobby-body">
        <motion.div
          className="lobby-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
        >
          <p className="lobby-greeting">Welcome back, {name}</p>

          {profile && (
            <div className="lobby-profile-summary">
              <div className="lobby-profile-row">
                <span className="lobby-profile-label">Defense</span>
                <span className="lobby-profile-val">{PROFILE_LABELS[profile.aggressiveness] || profile.aggressiveness}</span>
              </div>
              <div className="lobby-profile-row">
                <span className="lobby-profile-label">Session</span>
                <span className="lobby-profile-val">{PROFILE_LABELS[profile.duration] || profile.duration}</span>
              </div>
              <div className="lobby-profile-row">
                <span className="lobby-profile-label">Triggers</span>
                <span className="lobby-profile-val">{profile.triggers?.length || 0} configured</span>
              </div>
            </div>
          )}

          <div className="lobby-social">
            <div className="lobby-social-header">
              <svg className="lobby-ig-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="2" y="2" width="20" height="20" rx="5"/>
                <circle cx="12" cy="12" r="5"/>
                <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
              <span className="lobby-social-title">Instagram</span>
              {hasSavedCreds && !showCredForm && (
                <span className="lobby-social-connected">
                  <span className="lobby-connected-dot" />
                  Connected
                </span>
              )}
            </div>

            {showCredForm ? (
              <div className="lobby-cred-form">
                <input className="lobby-cred-input" type="text" placeholder="Username" value={igUser} onChange={e => setIgUser(e.target.value)} autoComplete="username" />
                <input className="lobby-cred-input" type="password" placeholder="Password" value={igPass} onChange={e => setIgPass(e.target.value)} autoComplete="current-password" />
                {credError && <p className="lobby-cred-error">{credError}</p>}
                <div className="lobby-cred-actions">
                  <button className="lobby-cred-save" onClick={handleSaveCreds} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  {hasSavedCreds && (
                    <button className="lobby-cred-cancel" onClick={() => setShowCredForm(false)}>Cancel</button>
                  )}
                </div>
                <p className="lobby-cred-note">Credentials are used only by your browser agents to access your feed. Never shared.</p>
              </div>
            ) : (
              <div className="lobby-cred-saved">
                <span className="lobby-cred-saved-user">@{profile?.ig_username}</span>
                <button className="lobby-cred-edit" onClick={() => { setShowCredForm(true); setIgPass('') }}>Edit</button>
              </div>
            )}
          </div>

          <button className={`lobby-start ${!canStart ? 'lobby-start--disabled' : ''}`} onClick={canStart ? onStart : undefined} disabled={!canStart}>
            <span className="lobby-start-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </span>
            Start Pipeline
          </button>

          {!canStart && <p className="lobby-hint">Connect your Instagram account above to start the pipeline.</p>}
          {canStart && <p className="lobby-hint">Your agents will log into your Instagram and begin monitoring your feed in real time.</p>}
        </motion.div>

        {!profile && (
          <motion.p className="lobby-no-profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            No intent profile yet.{' '}
            <button className="lobby-setup-link" onClick={() => navigate('/onboarding')}>Set one up</button>{' '}
            for better results.
          </motion.p>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   AGENT CARD — expandable with thinking dropdown, visualizer, TTS
   ═══════════════════════════════════════════════════════════════════════════ */

function AgentCard({ agentId, isActive, isSpeaking, agentAddress, messages, onSpeak }) {
  const [expanded, setExpanded] = useState(false)
  const meta = AGENT_META[agentId]
  if (!meta) return null

  const agentMessages = messages.filter(m => m.from?.toLowerCase() === agentId)
  const recentMessages = agentMessages.slice(-5)
  const lastMessage = recentMessages[recentMessages.length - 1]
  const showViz = isActive || isSpeaking

  return (
    <div className={`ac ${isActive ? 'ac--active' : ''} ${isSpeaking ? 'ac--speaking' : ''} ${expanded ? 'ac--expanded' : ''}`}>
      <div className="ac-header" onClick={() => setExpanded(e => !e)}>
        <div className="ac-icon" style={{ background: `${meta.color}18`, color: meta.color }}>
          {meta.icon}
        </div>
        <div className="ac-info">
          <span className="ac-name">{meta.label}</span>
          <span className="ac-role">{meta.role}</span>
          {agentAddress && (
            <span className="ac-addr" title={agentAddress}>{truncAddr(agentAddress)}</span>
          )}
        </div>
        <div className="ac-controls">
          {showViz && (
            <div className={`ac-visualizer ${isSpeaking ? 'ac-visualizer--speaking' : ''}`} style={{ color: meta.color }}>
              <span className="ac-viz-bar" />
              <span className="ac-viz-bar" />
              <span className="ac-viz-bar" />
              <span className="ac-viz-bar" />
            </div>
          )}
          <button
            className={`ac-speak-btn ${isSpeaking ? 'ac-speak-btn--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onSpeak(agentId, lastMessage?.msg || 'No messages yet')
            }}
            title={isSpeaking ? 'Stop speaking' : 'Speak latest message'}
          >
            {isSpeaking ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/>
                <path d="M15.54 8.46a5 5 0 010 7.07"/>
              </svg>
            )}
          </button>
          <div className={`ac-dot ${isActive ? 'ac-dot--on' : ''}`} />
          <svg className={`ac-chevron ${expanded ? 'ac-chevron--open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="ac-dropdown"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <div className="ac-dropdown-inner">
              {recentMessages.length > 0 ? recentMessages.map((m, i) => (
                <div key={i} className="ac-thought">
                  <TypeLabel type={m.type} />
                  <span className="ac-thought-msg">{m.msg}</span>
                </div>
              )) : (
                <div className="ac-thought ac-thought--empty">Waiting for activity...</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   USER CHAT
   ═══════════════════════════════════════════════════════════════════════════ */

const MENTION_AGENTS = ['boss', 'classifier', 'context', 'strategist', 'synthesis']

function UserChat({ chatMessages, onSend }) {
  const [input, setInput] = useState('')
  const chatEndRef = useRef(null)
  const [sending, setSending] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleChange = (e) => {
    const val = e.target.value
    setInput(val)
    const atMatch = val.match(/@(\w*)$/)
    if (atMatch) {
      setShowMentions(true)
      setMentionFilter(atMatch[1].toLowerCase())
    } else {
      setShowMentions(false)
    }
  }

  const handleMentionSelect = (agent) => {
    const before = input.replace(/@\w*$/, '')
    setInput(`@${agent} ${before}`.trim().replace(/^(.+)(@)/, '$2') || `@${agent} `)
    setInput(`@${agent} `)
    setShowMentions(false)
  }

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || sending) return
    setInput('')
    setShowMentions(false)
    setSending(true)
    await onSend(msg)
    setSending(false)
  }

  const filtered = MENTION_AGENTS.filter(a => a.startsWith(mentionFilter))

  return (
    <div className="uc">
      <div className="uc-messages">
        {chatMessages.length === 0 && (
          <div className="uc-empty">
            <p>Talk to your agents</p>
            <span>Type @ to mention a specific agent</span>
            <span className="uc-empty-examples">"@classifier why did you flag that?" · "@context what state?" · "go more aggressive"</span>
          </div>
        )}
        {chatMessages.map((m, i) => (
          <div key={i} className={`uc-bubble ${m.role === 'user' ? 'uc-bubble--user' : 'uc-bubble--agent'}`}>
            {m.role === 'agent' && (
              <div className="uc-bubble-agent-label" style={{ color: AGENT_META[m.agent_id]?.color }}>
                {AGENT_META[m.agent_id]?.icon} {m.agent_name}
              </div>
            )}
            <p>{m.message}</p>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {showMentions && filtered.length > 0 && (
        <div className="uc-mentions">
          {filtered.map(agent => (
            <button key={agent} className="uc-mention-item" onClick={() => handleMentionSelect(agent)}>
              <span className="uc-mention-icon" style={{ color: AGENT_META[agent]?.color }}>{AGENT_META[agent]?.icon}</span>
              <span className="uc-mention-name">@{agent}</span>
              <span className="uc-mention-role">{AGENT_META[agent]?.role}</span>
            </button>
          ))}
        </div>
      )}

      <div className="uc-input-row">
        <input
          className="uc-input"
          value={input}
          onChange={handleChange}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Talk to your agents... (type @ to mention)"
          disabled={sending}
        />
        <button className="uc-send" onClick={handleSend} disabled={sending || !input.trim()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SESSION SUMMARY — practical report shown when session ends
   ═══════════════════════════════════════════════════════════════════════════ */

function SessionSummary({ stats, messages, sessionTime, onBack }) {
  const flaggedContent = messages.filter(m => m.type === 'alert' || m.type === 'intervention')
  const safeContent = messages.filter(m => m.type === 'clear')
  const totalPayloads = messages.filter(m => m.type === 'payload')

  return (
    <div className="dash">
      <nav className="dash-nav">
        <Link to="/" className="dash-logo">dialed.</Link>
        <div className="dash-nav-center">
          <span className="ss-nav-title">Session Report</span>
        </div>
        <div className="dash-nav-right" />
      </nav>

      <div className="ss">
        <motion.div
          className="ss-body"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="ss-duration-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Session duration: {formatTime(sessionTime)}</span>
          </div>

          <div className="ss-stats-grid">
            <div className="ss-stat">
              <span className="ss-stat-val">{stats.scanned}</span>
              <span className="ss-stat-label">Content Scanned</span>
            </div>
            <div className="ss-stat ss-stat--alert">
              <span className="ss-stat-val">{stats.detected}</span>
              <span className="ss-stat-label">Brain Rot Detected</span>
            </div>
            <div className="ss-stat ss-stat--warn">
              <span className="ss-stat-val">{stats.interventions}</span>
              <span className="ss-stat-label">Interventions Triggered</span>
            </div>
            <div className="ss-stat ss-stat--good">
              <span className="ss-stat-val">{stats.reclaimed}s</span>
              <span className="ss-stat-label">Time Reclaimed</span>
            </div>
          </div>

          <div className="ss-breakdown">
            <div className="ss-breakdown-row">
              <span className="ss-breakdown-label">Detection rate</span>
              <span className="ss-breakdown-val">{totalPayloads.length > 0 ? Math.round((stats.detected / totalPayloads.length) * 100) : 0}%</span>
            </div>
            <div className="ss-breakdown-row">
              <span className="ss-breakdown-label">Content passed</span>
              <span className="ss-breakdown-val ss-breakdown-val--safe">{safeContent.length}</span>
            </div>
            <div className="ss-breakdown-row">
              <span className="ss-breakdown-label">Content blocked</span>
              <span className="ss-breakdown-val ss-breakdown-val--blocked">{flaggedContent.length}</span>
            </div>
          </div>

          {flaggedContent.length > 0 && (
            <div className="ss-flagged">
              <div className="ss-flagged-header">
                <span className="ss-flagged-title">Flagged Content Log</span>
                <span className="ss-flagged-count">{flaggedContent.length} items</span>
              </div>
              <div className="ss-flagged-list">
                {flaggedContent.map((m, i) => (
                  <div key={i} className="ss-flag-item">
                    <TypeLabel type={m.type} />
                    <span className="ss-flag-from">{m.from}</span>
                    <span className="ss-flag-msg">{m.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="ss-back" onClick={onBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Lobby
          </button>
        </motion.div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIVE SESSION
   ═══════════════════════════════════════════════════════════════════════════ */

function ActiveSession({ onEnd, credentials }) {
  const tickerRef = useRef(null)
  const wsRef = useRef(null)

  const [sessionTime, setSessionTime] = useState(0)
  const [messages, setMessages] = useState([])
  const [stats, setStats] = useState({ scanned: 0, detected: 0, interventions: 0, reclaimed: 0 })
  const [sessionState, setSessionState] = useState('NORMAL')
  const [showSummary, setShowSummary] = useState(false)

  const [backendConnected, setBackendConnected] = useState(false)
  const [liveUrl, setLiveUrl] = useState(null)
  const [connecting, setConnecting] = useState(true)
  const [needs2FA, setNeeds2FA] = useState(false)
  const [tfaCode, setTfaCode] = useState('')
  const [tfaSubmitting, setTfaSubmitting] = useState(false)

  const [activeAgents, setActiveAgents] = useState(new Set())
  const [chatMessages, setChatMessages] = useState([])
  const [agentAddresses, setAgentAddresses] = useState({})
  const [bureauInfo, setBureauInfo] = useState(null)
  const [interventionMsg, setInterventionMsg] = useState(null)

  // Session timer
  useEffect(() => {
    if (showSummary) return
    const iv = setInterval(() => setSessionTime(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [showSummary])

  // Start session
  useEffect(() => {
    let cancelled = false

    const startSession = async () => {
      try {
        const res = await fetch(`${API_URL}/api/session/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: credentials?.platform || 'instagram',
            username: credentials?.username || '',
            password: credentials?.password || '',
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        setLiveUrl(data.live_url)
        setBackendConnected(true)
      } catch {
        // Backend not available — mock fallback
      } finally {
        if (!cancelled) setConnecting(false)
      }
    }

    startSession()

    fetch(`${API_URL}/api/agents`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.agents) {
          const addrMap = {}
          data.agents.forEach(a => { addrMap[a.id] = a.address })
          setAgentAddresses(addrMap)
        }
        if (data.bureau) setBureauInfo(data.bureau)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      setTimeout(() => {
        fetch(`${API_URL}/api/session/stop`, { method: 'POST' }).catch(() => {})
      }, 500)
    }
  }, [])

  // WebSocket
  useEffect(() => {
    if (!backendConnected) return

    const ws = new WebSocket(`${WS_URL}/ws`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'ticker') {
        setMessages(prev => [...prev, {
          from: data.from, to: data.to, msg: data.msg, type: data.msg_type,
        }])
        if (data.msg_type === 'payload') setStats(s => ({ ...s, scanned: s.scanned + 1 }))
        if (data.msg_type === 'alert')   setStats(s => ({ ...s, detected: s.detected + 1 }))
        if (data.msg_type === 'intervention') {
          setStats(s => ({ ...s, interventions: s.interventions + 1, reclaimed: s.reclaimed + Math.floor(Math.random() * 20) + 15 }))
        }
        if (data.msg_type === 'escalate') setSessionState('ELEVATED')
      }

      if (data.type === '2fa_required') setNeeds2FA(true)
      if (data.type === '2fa_resolved') setNeeds2FA(false)
      if (data.type === 'stats') setStats(data)
      if (data.type === 'session_ended') setBackendConnected(false)
      if (data.type === 'state_change') setSessionState(data.state)
      if (data.type === 'agent_status') {
        setActiveAgents(prev => {
          const next = new Set(prev)
          data.active ? next.add(data.agent_id) : next.delete(data.agent_id)
          return next
        })
      }
      if (data.type === 'chat') {
        setChatMessages(prev => [...prev, data])
      }
      if (data.type === 'intervention_overlay') {
        setInterventionMsg(data.message)
        setTimeout(() => setInterventionMsg(null), 4000)
      }
    }

    ws.onclose = () => wsRef.current = null
    return () => ws.close()
  }, [backendConnected])

  // Mock data fallback
  useEffect(() => {
    if (backendConnected || connecting) return
    const timeouts = MOCK_TICKER.map(entry =>
      setTimeout(() => {
        setMessages(prev => [...prev, entry])
        if (entry.type === 'payload') setStats(s => ({ ...s, scanned: s.scanned + 1 }))
        if (entry.type === 'alert')   setStats(s => ({ ...s, detected: s.detected + 1 }))
        if (entry.type === 'intervention') {
          setStats(s => ({ ...s, interventions: s.interventions + 1, reclaimed: s.reclaimed + Math.floor(Math.random() * 20) + 15 }))
        }
        if (entry.type === 'escalate') setSessionState('ELEVATED')
      }, entry.delay)
    )
    return () => timeouts.forEach(clearTimeout)
  }, [backendConnected, connecting])

  // Auto-scroll ticker
  useEffect(() => {
    if (tickerRef.current) tickerRef.current.scrollTop = tickerRef.current.scrollHeight
  }, [messages])

  const handleEnd = () => {
    if (backendConnected) fetch(`${API_URL}/api/session/stop`, { method: 'POST' }).catch(() => {})
    setShowSummary(true)
  }

  const handle2FASubmit = async () => {
    if (!tfaCode.trim() || tfaSubmitting) return
    setTfaSubmitting(true)
    try {
      await fetch(`${API_URL}/api/session/2fa-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: tfaCode.trim() }),
      })
      setNeeds2FA(false)
      setTfaCode('')
    } catch { /* ignore */ }
    setTfaSubmitting(false)
  }

  const handleChatSend = async (msg) => {
    try {
      await fetch(`${API_URL}/api/session/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
    } catch { /* ignore */ }
  }

  const [speakingAgent, setSpeakingAgent] = useState(null)
  const audioRef = useRef(null)

  const handleSpeak = async (agentId, text) => {
    if (speakingAgent === agentId) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
      setSpeakingAgent(null)
      return
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setSpeakingAgent(agentId)
    try {
      const resp = await fetch(`${API_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, text }),
      })
      if (!resp.ok) { setSpeakingAgent(null); return }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setSpeakingAgent(null); audioRef.current = null; URL.revokeObjectURL(url) }
      audio.onerror = () => { setSpeakingAgent(null); audioRef.current = null }
      await audio.play()
    } catch {
      setSpeakingAgent(null)
    }
  }

  // ── Session Summary view ──────────────────────────────────────────────
  if (showSummary) {
    return (
      <SessionSummary
        stats={stats}
        messages={messages}
        sessionTime={sessionTime}
        onBack={onEnd}
      />
    )
  }

  // ── Active session view ───────────────────────────────────────────────
  const stateStyle = STATE_COLORS[sessionState]

  return (
    <div className="dash">
      {/* Nav */}
      <motion.nav className="dash-nav" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
        <Link to="/" className="dash-logo">dialed.</Link>
        <div className="dash-nav-center">
          <div className="dash-timer"><span className="dash-timer-dot" />{formatTime(sessionTime)}</div>
          <div className="dash-state" style={{ background: stateStyle.bg, color: stateStyle.color, borderColor: stateStyle.border }}>{sessionState}</div>
          {backendConnected && <span className="dash-live-badge">LIVE</span>}
        </div>
        <div className="dash-nav-right">
          <button className="dash-end" onClick={handleEnd}>End Session</button>
        </div>
      </motion.nav>

      {/* Trifold grid */}
      <div className="dash-grid">

        {/* ── Left: Live Feed ──────────────────────────────────────────── */}
        <motion.div
          className="dash-panel dash-feed"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
        >
          <div className="dash-panel-header">
            <span className="dash-panel-dot dash-panel-dot--blue" />
            <span className="dash-panel-title">Live Feed</span>
            <span className="dash-panel-status">{liveUrl ? 'Streaming' : 'Standby'}</span>
          </div>
          <div className="dash-feed-body">
            {liveUrl ? (
              <iframe src={liveUrl} className="dash-feed-iframe" title="Dialed Agent — Live Feed" allow="autoplay" />
            ) : (
              <div className="dash-stream-placeholder">
                <div className="dash-stream-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                </div>
                <p className="dash-stream-label">Live feed monitoring</p>
                <span className="dash-stream-sub">instagram.com/reels</span>
                <div className="dash-stream-scan"><div className="dash-scan-line" /></div>
              </div>
            )}

            {/* Intervention overlay */}
            <AnimatePresence>
              {interventionMsg && (
                <motion.div
                  className="dash-intervention-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="dash-intervention-card">
                    <div className="dash-intervention-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    </div>
                    <p className="dash-intervention-msg">{interventionMsg}</p>
                    <span className="dash-intervention-tag">BLOCKED BY AGENT SWARM</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 2FA overlay */}
            {needs2FA && (
              <div className="dash-2fa-overlay">
                <div className="dash-2fa-card">
                  <div className="dash-2fa-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                  </div>
                  <p className="dash-2fa-title">Verification needed</p>
                  <p className="dash-2fa-desc">Enter the security code sent to your email or phone. The agent will input it for you.</p>
                  <input
                    className="dash-2fa-input"
                    type="text"
                    placeholder="Enter code"
                    value={tfaCode}
                    onChange={e => setTfaCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handle2FASubmit()}
                    autoFocus
                    autoComplete="one-time-code"
                    inputMode="numeric"
                  />
                  <button
                    className="dash-2fa-btn"
                    onClick={handle2FASubmit}
                    disabled={!tfaCode.trim() || tfaSubmitting}
                  >
                    {tfaSubmitting ? 'Submitting...' : 'Submit Code'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Center: Ticker + Command Center ──────────────────────────── */}
        <div className="dash-center">
          <motion.div
            className="dash-panel dash-ticker"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
          >
            <div className="dash-panel-header">
              <span className="dash-panel-dot dash-panel-dot--green" />
              <span className="dash-panel-title">Agent Communication</span>
              {bureauInfo && <span className="dash-panel-proto">uAgents Protocol</span>}
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
                    {m.type === 'dispatch' && <span className="dash-ticker-proto">ctx.send</span>}
                    {m.type === 'alert' && <span className="dash-ticker-proto">on_message</span>}
                    {m.type === 'verdict' && <span className="dash-ticker-proto">send_and_receive</span>}
                    {m.type === 'clear' && <span className="dash-ticker-proto">on_message</span>}
                  </motion.div>
                ))}
              </AnimatePresence>
              {messages.length === 0 && (
                <div className="dash-ticker-empty">
                  <span className="dash-ticker-waiting" />
                  {connecting ? 'Connecting to agent pipeline...' : 'Initializing agent pipeline...'}
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            className="dash-panel dash-chat"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.35 }}
          >
            <div className="dash-panel-header">
              <span className="dash-panel-dot dash-panel-dot--green" />
              <span className="dash-panel-title">Command Center</span>
            </div>
            <UserChat chatMessages={chatMessages} onSend={handleChatSend} />
          </motion.div>
        </div>

        {/* ── Right: Agent Fleet ───────────────────────────────────────── */}
        <motion.div
          className="dash-panel dash-fleet"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
        >
          <div className="dash-panel-header">
            <span className="dash-panel-dot dash-panel-dot--blue" />
            <span className="dash-panel-title">Agent Fleet</span>
            <span className="dash-panel-status">{activeAgents.size} active</span>
          </div>
          {bureauInfo && (
            <div className="dash-bureau-bar">
              <span className="dash-bureau-badge">Fetch.ai uAgents</span>
              <span className="dash-bureau-detail">Bureau :{bureauInfo.port}</span>
              <span className="dash-bureau-dot" />
              <span className="dash-bureau-detail">{bureauInfo.status}</span>
            </div>
          )}
          <div className="dash-fleet-list">
            {Object.keys(AGENT_META).map(id => (
              <AgentCard
                key={id}
                agentId={id}
                isActive={activeAgents.has(id)}
                isSpeaking={speakingAgent === id}
                agentAddress={agentAddresses[id]}
                messages={messages}
                onSpeak={handleSpeak}
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Status bar */}
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

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD — Orchestrator
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, saveSocialCreds } = useAuth()
  const [sessionActive, setSessionActive] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true })
  }, [authLoading, user, navigate])

  if (authLoading) return null

  const credentials = profile?.ig_username
    ? { platform: 'instagram', username: profile.ig_username, password: profile.ig_password }
    : null

  return (
    <>
      <CloudBackground />
      <AnimatePresence mode="wait">
        {sessionActive ? (
          <motion.div key="session" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} style={{ height: '100vh' }}>
            <ActiveSession onEnd={() => setSessionActive(false)} credentials={credentials} />
          </motion.div>
        ) : (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} style={{ height: '100vh' }}>
            <Lobby user={user} profile={profile} onStart={() => setSessionActive(true)} saveSocialCreds={saveSocialCreds} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
