import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Agents',       href: '#agents'       },
  { label: 'Letter',       href: '#letter'       },
]

function UserMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const name = user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const initials = name.slice(0, 2).toUpperCase()

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const go = (path) => { setOpen(false); navigate(path) }

  return (
    <div className="nl-user-menu" ref={ref}>
      <button className="nl-avatar" onClick={() => setOpen(o => !o)}>
        {initials}
      </button>

      {open && (
        <div className="nl-dropdown">
          <div className="nl-dropdown-header">
            <span className="nl-dropdown-name">{name}</span>
            <span className="nl-dropdown-email">{user?.email}</span>
          </div>
          <div className="nl-dropdown-sep" />
          <button className="nl-dropdown-item" onClick={() => go('/dashboard')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Dashboard
          </button>
          <button className="nl-dropdown-item" onClick={() => go('/profile')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Intent Profile
          </button>
          <div className="nl-dropdown-sep" />
          <button className="nl-dropdown-item nl-dropdown-item--danger" onClick={async () => { await signOut(); setOpen(false); navigate('/') }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 72)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const handleStart = () => {
    if (user && profile) return navigate('/dashboard')
    if (user) return navigate('/onboarding')
    navigate('/login')
  }

  return (
    <header className={`nl-header ${scrolled ? 'is-scrolled' : ''}`}>
      <nav className="nl-nav">
        <Link to="/" className="nl-logo">dialed.</Link>

        <ul className="nl-center">
          {LINKS.map(l => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </ul>

        <div className="nl-right">
          <a href="#" className="nl-link">Docs</a>
          <button className="nl-cta" onClick={handleStart}>
            {user && profile ? 'Dashboard' : 'Start Pipeline'}
          </button>
          <span className="nl-sep" aria-hidden />
          {user ? <UserMenu /> : <Link to="/login" className="nl-login">Login</Link>}
        </div>
      </nav>
    </header>
  )
}
