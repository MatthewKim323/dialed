import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'

export default function App() {
  return (
    <Routes>
      <Route index element={<Landing />} />
      <Route path="login" element={<Login />} />
      <Route path="onboarding" element={<Onboarding />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="profile" element={<Profile />} />
    </Routes>
  )
}
