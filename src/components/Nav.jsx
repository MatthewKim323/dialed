import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

const LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Agents',       href: '#agents'       },
  { label: 'Letter',       href: '#letter'       },
]

function NavContent({ pill = false }) {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const handleStart = () => {
    if (user && profile) return navigate('/dashboard')
    if (user) return navigate('/onboarding')
    navigate('/login')
  }

  return (
    <>
      <Link to="/" className={pill ? 'nl-logo nl-logo--pill' : 'nl-logo'}>
        dialed.
      </Link>

      <ul className={pill ? 'nl-center nl-center--pill' : 'nl-center'}>
        {LINKS.map(l => (
          <li key={l.href}>
            <a href={l.href}>{l.label}</a>
          </li>
        ))}
      </ul>

      <div className="nl-right">
        {!pill && (
          <a href="#" className="nl-link">Docs</a>
        )}
        <button className="nl-cta" onClick={handleStart}>
          Start Pipeline
        </button>
        <span className="nl-sep" aria-hidden />
        {user
          ? <span className="nl-account">{user.user_metadata?.name || user.email?.split('@')[0]}</span>
          : <Link to="/login" className="nl-login">Login</Link>
        }
      </div>
    </>
  )
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 72)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <>
      <AnimatePresence>
        {!scrolled && (
          <motion.nav
            key="bar"
            className="nl-bar"
            initial={{ opacity: 0, y: -22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -14 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <NavContent />
          </motion.nav>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scrolled && (
          <div className="nl-pill-rail">
            <motion.nav
              key="pill"
              className="nl-pill"
              initial={{ opacity: 0, y: -20, scale: 0.94 }}
              animate={{ opacity: 1, y: 0,   scale: 1    }}
              exit={{    opacity: 0, y: -14,  scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            >
              <NavContent pill />
            </motion.nav>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
