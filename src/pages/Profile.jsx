import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import CloudBackground from '../components/CloudBackground'
import './Profile.css'

const EASE = [0.22, 1, 0.36, 1]

const LABELS = {
  purpose: 'Why you use Instagram',
  triggers: 'Content you get stuck on',
  aggressiveness: 'Defense level',
  duration: 'Session length',
  redirect: 'Escape destination',
}

const VALUE_LABELS = {
  connect: 'Stay connected with friends & family',
  discover: 'Discover new ideas & content',
  news: 'Keep up with news & events',
  creative: 'Creative inspiration',
  entertainment: 'Entertainment & killing time',
  professional: 'Professional networking',
  rage: 'Rage bait & outrage',
  gossip: 'Celebrity gossip & drama',
  comparison: 'Lifestyle comparison traps',
  clickbait: 'Clickbait & engagement bait',
  doom: 'Doom-scrolling news',
  parasocial: 'Parasocial influencer content',
  fomo: 'FOMO-inducing posts',
  gentle: 'Gentle — subtle nudges',
  moderate: 'Moderate — overlays & pauses',
  aggressive: 'Aggressive — hard redirects & locks',
  '15': '15 minutes',
  '30': '30 minutes',
  '60': '1 hour',
  none: 'No limit',
  breathing: 'Guided breathing exercise',
  music: 'Music playlist',
  url: 'Custom URL',
  close: 'Back to what you were doing',
  nature: 'Nature livestream',
}

function ProfileField({ label, values }) {
  if (!values || (Array.isArray(values) && values.length === 0)) {
    return (
      <div className="pf-field">
        <span className="pf-field-label">{label}</span>
        <span className="pf-field-empty">Not set</span>
      </div>
    )
  }

  const items = Array.isArray(values) ? values : [values]

  return (
    <div className="pf-field">
      <span className="pf-field-label">{label}</span>
      <div className="pf-field-values">
        {items.map((v, i) => (
          <span key={i} className="pf-chip">{VALUE_LABELS[v] || v}</span>
        ))}
      </div>
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true })
  }, [loading, user, navigate])

  if (loading) return null

  const name = user?.user_metadata?.name || user?.email?.split('@')[0] || ''

  return (
    <>
      <CloudBackground />
      <div className="pf-page">
        <motion.header
          className="pf-topbar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <Link to="/" className="pf-logo">dialed.</Link>
          <Link to="/dashboard" className="pf-back-link">Dashboard</Link>
        </motion.header>

        <main className="pf-main">
          <motion.div
            className="pf-card"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
          >
            {/* Account header */}
            <div className="pf-account">
              <div className="pf-avatar">{name.slice(0, 2).toUpperCase()}</div>
              <div className="pf-account-info">
                <h2 className="pf-name">{name}</h2>
                <span className="pf-email">{user?.email}</span>
              </div>
            </div>

            <div className="pf-divider" />

            {/* Intent profile */}
            <div className="pf-section">
              <div className="pf-section-header">
                <h3 className="pf-section-title">Intent Profile</h3>
                <button className="pf-edit" onClick={() => navigate('/onboarding')}>
                  Edit
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </div>

              {profile ? (
                <div className="pf-fields">
                  <ProfileField label={LABELS.purpose} values={profile.purpose} />
                  <ProfileField label={LABELS.triggers} values={profile.triggers} />
                  <ProfileField label={LABELS.aggressiveness} values={profile.aggressiveness} />
                  <ProfileField label={LABELS.duration} values={profile.duration} />
                  <ProfileField label={LABELS.redirect} values={profile.redirect} />
                  {profile.custom_url && (
                    <div className="pf-field">
                      <span className="pf-field-label">Custom redirect URL</span>
                      <span className="pf-field-url">{profile.custom_url}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="pf-empty">
                  <p>You haven't set up your intent profile yet.</p>
                  <button className="pf-setup-btn" onClick={() => navigate('/onboarding')}>
                    Set up profile
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </main>
      </div>
    </>
  )
}
