import { useState, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import CloudBackground from '../components/CloudBackground'
import './Onboarding.css'

const EASE = [0.22, 1, 0.36, 1]

const STEPS = [
  {
    id: 'purpose',
    eyebrow: "Let\u2019s understand your relationship with social media.",
    question: 'Why do you open Instagram?',
    multi: true,
    options: [
      { id: 'connect',       label: 'Stay connected with friends & family' },
      { id: 'discover',      label: 'Discover new ideas & content' },
      { id: 'news',          label: 'Keep up with news & events' },
      { id: 'creative',      label: 'Creative inspiration' },
      { id: 'entertainment', label: 'Entertainment & killing time' },
      { id: 'professional',  label: 'Professional networking' },
    ],
  },
  {
    id: 'triggers',
    eyebrow: 'Now, the harder question.',
    question: 'What content do you find yourself stuck on?',
    multi: true,
    options: [
      { id: 'rage',       label: 'Rage bait & outrage content' },
      { id: 'gossip',     label: 'Celebrity gossip & drama' },
      { id: 'comparison', label: 'Lifestyle comparison traps' },
      { id: 'clickbait',  label: 'Clickbait & engagement bait' },
      { id: 'doom',       label: 'Doom-scrolling news' },
      { id: 'parasocial', label: 'Parasocial influencer content' },
      { id: 'fomo',       label: 'FOMO-inducing posts' },
    ],
  },
  {
    id: 'aggressiveness',
    eyebrow: 'How hard should we hit back?',
    question: 'Choose your defense level.',
    multi: false,
    options: [
      { id: 'gentle',     label: 'Gentle',     desc: 'Subtle nudges and awareness cues. Light touch.' },
      { id: 'moderate',   label: 'Moderate',    desc: 'Active overlays and content pauses. Balanced.', recommended: true },
      { id: 'aggressive', label: 'Aggressive',  desc: 'Hard redirects and scroll locks. No mercy.' },
    ],
  },
  {
    id: 'duration',
    eyebrow: 'Set your boundary.',
    question: 'How long should this session last?',
    multi: false,
    options: [
      { id: '15',   label: '15 minutes' },
      { id: '30',   label: '30 minutes' },
      { id: '60',   label: '1 hour' },
      { id: 'none', label: 'No limit' },
    ],
  },
  {
    id: 'redirect',
    eyebrow: 'When we pull you out, where should you land?',
    question: 'Choose your escape destination.',
    multi: false,
    options: [
      { id: 'breathing', label: 'A guided breathing exercise' },
      { id: 'music',     label: 'A music playlist' },
      { id: 'url',       label: 'A specific URL', hasInput: true },
      { id: 'close',     label: 'Back to what you were doing' },
      { id: 'nature',    label: 'A nature livestream' },
    ],
  },
]

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, profile, saveProfile, loading: authLoading } = useAuth()

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [answers, setAnswers] = useState({})
  const [customUrl, setCustomUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true })
  }, [authLoading, user, navigate])

  // Skip onboarding if profile already exists
  useEffect(() => {
    if (profile) navigate('/dashboard', { replace: true })
  }, [profile, navigate])

  const current = STEPS[step]
  const selected = answers[current.id] || []

  const toggle = useCallback((optId) => {
    setAnswers(prev => {
      const curr = prev[current.id] || []
      if (current.multi) {
        return {
          ...prev,
          [current.id]: curr.includes(optId)
            ? curr.filter(x => x !== optId)
            : [...curr, optId],
        }
      }
      return { ...prev, [current.id]: [optId] }
    })
  }, [current])

  const canContinue = selected.length > 0
  const isLast = step === STEPS.length - 1

  const next = async () => {
    if (!canContinue) return

    if (isLast) {
      setSaving(true)
      setError('')
      try {
        const intentProfile = { ...answers }
        if (customUrl) intentProfile.customUrl = customUrl
        await saveProfile(intentProfile)
        navigate('/dashboard')
      } catch (err) {
        setError(err.message || 'Failed to save profile.')
        setSaving(false)
      }
      return
    }

    setDir(1)
    setStep(s => s + 1)
  }

  const back = () => {
    if (step === 0) return
    setDir(-1)
    setStep(s => s - 1)
  }

  if (authLoading) return null

  return (
    <>
      <CloudBackground />

      <div className="ob-page">
        <motion.header
          className="ob-topbar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <Link to="/" className="ob-logo">dialed.</Link>
          <span className="ob-step-label">Step {step + 1} of {STEPS.length}</span>
        </motion.header>

        <div className="ob-progress">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={
                'ob-dot' +
                (i === step ? ' ob-dot--active' : '') +
                (i < step ? ' ob-dot--done' : '')
              }
            />
          ))}
        </div>

        <main className="ob-main">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              className="ob-content"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: EASE }}
            >
              <p className="ob-eyebrow">{current.eyebrow}</p>
              <h2 className="ob-question">{current.question}</h2>

              {current.multi && (
                <p className="ob-hint">Select all that apply</p>
              )}

              <div className="ob-options">
                {current.options.map(opt => {
                  const active = selected.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={'ob-option' + (active ? ' ob-option--selected' : '')}
                      onClick={() => toggle(opt.id)}
                    >
                      <span className="ob-check">
                        {active && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                      <span className="ob-option-text">
                        <span className="ob-option-label">{opt.label}</span>
                        {opt.desc && <span className="ob-option-desc">{opt.desc}</span>}
                      </span>
                      {opt.recommended && (
                        <span className="ob-rec">recommended</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {current.id === 'redirect' && selected.includes('url') && (
                <motion.div
                  className="ob-url-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3 }}
                >
                  <input
                    className="ob-url-input"
                    type="url"
                    placeholder="https://your-destination.com"
                    value={customUrl}
                    onChange={e => setCustomUrl(e.target.value)}
                    autoFocus
                  />
                </motion.div>
              )}

              {error && <p className="ob-error">{error}</p>}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="ob-footer">
          <button
            className="ob-back"
            onClick={back}
            style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
          >
            Back
          </button>
          <button
            className={'ob-continue' + (isLast ? ' ob-continue--launch' : '')}
            onClick={next}
            disabled={!canContinue || saving}
          >
            {saving ? (
              <span className="ob-spinner" />
            ) : isLast ? (
              'Launch session'
            ) : (
              <>
                Continue
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 6 }}>
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </>
            )}
          </button>
        </footer>
      </div>
    </>
  )
}
