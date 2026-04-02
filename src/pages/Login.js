import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('pentest')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      setError('E-posta ve şifre gerekli.')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password })

    if (loginError) {
      setError('E-posta veya şifre hatalı.')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()

    if (!profile) {
      setError(`Profil bulunamadı. Hata: ${profileError?.message}`)
      setLoading(false)
      return
    }

    // 
    
    // Rol kontrolü: Müşteri ise ama Pentest girişi seçildiyse
    if (role === 'pentest' && profile.role === 'client') {
      setError('Bu hesap müşteri hesabıdır.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    } // 

    // Rol kontrolü: Pentest ise ama Müşteri girişi seçildiyse
    if (role === 'client' && (profile.role === 'pentest' || profile.role === 'superadmin')) {
      setError('Bu hesap pentest hesabıdır.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    } // 

    onLogin(profile)
    setLoading(false)
  }

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <h2>Giriş Yap</h2>
      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
      <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', marginBottom: '10px', padding: '8px' }}>
        <option value="pentest">Pentest Firması</option>
        <option value="client">Müşteri</option>
      </select>
      <input type="email" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', marginBottom: '10px', padding: '8px' }} />
      <input type="password" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', marginBottom: '10px', padding: '8px' }} />
      <button onClick={handleLogin} disabled={loading} style={{ width: '100%', padding: '10px', background: '#111', color: '#fff', border: 'none', cursor: 'pointer' }}>
        {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
      </button>
    </div>
  )
}
