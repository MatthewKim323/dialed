import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import CloudBackground from '../components/CloudBackground'
import './Login.css'

const EASE = [0.22, 1, 0.36, 1]

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signUp, signInWithGoogle, user, profile } = useAuth()

  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If already logged in, redirect
  if (user) {
    if (profile) {
      navigate('/dashboard', { replace: true })
    } else {
      navigate('/onboarding', { replace: true })
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        await signUp(email, password, name)
      } else {
        await signIn(email, password)
      }
      navigate('/onboarding')
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message || 'Google sign-in failed.')
    }
  }

  const heading = mode === 'login' ? 'Welcome back.' : 'Get started.'
  const sub = mode === 'login'
    ? 'Sign in to start your session.'
    : 'Create your account to begin.'

  return (
    <>
      <CloudBackground />

      <div className="login-page">
        <motion.header
          className="login-topbar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <Link to="/" className="login-logo">dialed.</Link>
        </motion.header>

        <main className="login-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="login-inner"
            >
              <h1 className="login-heading">{heading}</h1>
              <p className="login-sub">{sub}</p>

              <div className="login-card">
                <form onSubmit={handleSubmit}>
                  {mode === 'signup' && (
                    <div className="login-field">
                      <label className="login-label">Name</label>
                      <input
                        className="login-input"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Your name"
                        required
                        autoComplete="name"
                      />
                    </div>
                  )}

                  <div className="login-field">
                    <label className="login-label">Email</label>
                    <input
                      className="login-input"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="login-field">
                    <label className="login-label">Password</label>
                    <input
                      className="login-input"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                  </div>

                  {error && <p className="login-error">{error}</p>}

                  <button className="login-submit" type="submit" disabled={loading}>
                    {loading
                      ? <span className="login-spinner" />
                      : mode === 'login' ? 'Sign in' : 'Create account'
                    }
                  </button>
                </form>

                <div className="login-divider"><span>or</span></div>

                <button className="login-oauth" type="button" onClick={handleGoogle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <p className="login-switch">
                  {mode === 'login' ? (
                    <>New here?{' '}
                      <button type="button" onClick={() => { setMode('signup'); setError('') }}>
                        Create an account
                      </button>
                    </>
                  ) : (
                    <>Already have an account?{' '}
                      <button type="button" onClick={() => { setMode('login'); setError('') }}>
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  )
}
