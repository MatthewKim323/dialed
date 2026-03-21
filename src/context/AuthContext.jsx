import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  async function signUp(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) throw error
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/onboarding' },
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  async function saveProfile(intentProfile) {
    if (!user) return
    const row = {
      id: user.id,
      name: user.user_metadata?.name || null,
      purpose: intentProfile.purpose || [],
      triggers: intentProfile.triggers || [],
      aggressiveness: intentProfile.aggressiveness?.[0] || 'moderate',
      duration: intentProfile.duration?.[0] || '30',
      redirect: intentProfile.redirect?.[0] || 'close',
      custom_url: intentProfile.customUrl || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw error
    setProfile(data)
    return data
  }

  async function saveSocialCreds(platform, username, password) {
    if (!user) return
    const col_user = `${platform}_username`
    const col_pass = `${platform}_password`

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        { id: user.id, [col_user]: username, [col_pass]: password, updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      )
      .select()
      .single()

    if (error) throw error
    setProfile(data)
    return data
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    saveProfile,
    saveSocialCreds,
    fetchProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
