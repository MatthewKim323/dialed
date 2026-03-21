import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Agents',       href: '#agents'       },
  { label: 'Letter',       href: '#letter'       },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [user]    = useState(null)
  const navigate  = useNavigate()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 72)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

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
          <a href="#" className="nl-link nl-docs">Docs</a>
          <button className="nl-cta" onClick={() => navigate('/login')}>
            Start Pipeline
          </button>
          <span className="nl-sep" aria-hidden />
          {user
            ? <span className="nl-account">{user}</span>
            : <Link to="/login" className="nl-login">Login</Link>
          }
        </div>
      </nav>
    </header>
  )
}
