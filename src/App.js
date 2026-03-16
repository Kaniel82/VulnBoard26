import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname)
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        if (data) {
          setProfile(data)
        } else {
          await supabase.auth.signOut()
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = (profile) => setProfile(profile)
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif', color:'#9ca3af', fontSize:14 }}>
      Yükleniyor...
    </div>
  )

  return profile
    ? <Dashboard profile={profile} onLogout={handleLogout} />
    : <Login onLogin={handleLogin} />
}
