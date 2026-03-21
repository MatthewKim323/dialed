import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Agents',       href: '#agents'       },
  { label: 'Letter',       href: '#letter'       },
]

// Shared content — rendered inside both bar and pill
function NavContent({ pill = false, user = null }) {
  return (
    <>
      {/* Logo */}
      <a href="#" className={pill ? 'nl-logo nl-logo--pill' : 'nl-logo'}>
        dialed.
      </a>

      {/* Center links */}
      <ul className={pill ? 'nl-center nl-center--pill' : 'nl-center'}>
        {LINKS.map(l => (
          <li key={l.href}>
            <a href={l.href}>{l.label}</a>
          </li>
        ))}
      </ul>

      {/* Right actions */}
      <div className="nl-right">
        {!pill && (
          <a href="#" className="nl-link">Docs</a>
        )}
        <button className="nl-cta">Start Pipeline</button>
        <span className="nl-sep" aria-hidden />
        {user
          ? <span className="nl-account">{user}</span>
          : <a href="#" className="nl-login">Login</a>
        }
      </div>
    </>
  )
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [user]    = useState(null) // swap with real auth

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 72)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <>
      {/* ── Full-width bar ── */}
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
            <NavContent user={user} />
          </motion.nav>
        )}
      </AnimatePresence>

      {/* ── Floating pill ── */}
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
              <NavContent pill user={user} />
            </motion.nav>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
