import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import ShaderLoader from './components/ShaderLoader'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'

const EASE = [0.22, 1, 0.36, 1]

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  const [appReady, setAppReady] = useState(false)
  const [loaderDone, setLoaderDone] = useState(false)

  return (
    <>
      {isHome && !loaderDone && (
        <ShaderLoader
          onFadeStart={() => setAppReady(true)}
          onComplete={() => setLoaderDone(true)}
        />
      )}

      {(!isHome || appReady) && (
        <motion.div
          initial={isHome && !loaderDone ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: EASE }}
        >
          <Routes>
            <Route index element={<Landing />} />
            <Route path="login" element={<Login />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
          </Routes>
        </motion.div>
      )}
    </>
  )
}
