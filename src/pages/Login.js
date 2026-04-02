import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('pentest')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) { setError('E-posta ve şifre gerekli.'); return }
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('E-posta veya şifre hatalı.'); setLoading(false); return }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    console.log('Profile:', profile, 'Error:', profileError)
if (!profile) { setError('Profil bulunamadı. Yönetici ile iletişime geçin.'); setLoading(false); return }

    const allowedRole = profile.role === 'superadmin' ? 'pentest' : profile.role
if (allowedRole !== role) {
  setError(role === 'pentest' ? 'Bu hesap müşteri hesabıdır.' : 'Bu hesap pentest hesabıdır.')
  await supabase.auth.signOut()
  setLoading(false)
  return
}

onLogin(profile)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f8f9fa', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif' }}>
      <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'36px 32px', width:380 }}>
        <div style={{ fontSize:22, fontWeight:700, color:'#111', marginBottom:4 }}>VulnBoard</div>
        <div style={{ fontSize:12, color:'#9ca3af', marginBottom:28, fontFamily:'monospace' }}>Vulnerability Management Platform</div>

        <div style={{ display:'flex', marginBottom:24, border:'0.5px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
          {['pentest','client'].map(r => (
            <button key={r} onClick={() => setRole(r)} style={{ flex:1, padding:9, fontSize:12, cursor:'pointer', background: role===r?'#111':'#fff', color: role===r?'#fff':'#6b7280', border:'none', fontWeight: role===r?600:400, fontFamily:'sans-serif' }}>
              {r==='pentest' ? '🔐 Pentest Firması' : '👤 Müşteri'}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background:'#fef2f2', border:'0.5px solid #fecaca', borderRadius:6, padding:'8px 12px', fontSize:12, color:'#dc2626', marginBottom:14 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>E-posta</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@vulnboard.com"
            style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'9px 12px', color:'#111', fontSize:13, outline:'none', boxSizing:'border-box' }} />
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Şifre</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==='Enter' && handleLogin()} placeholder="••••••••"
            style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'9px 12px', color:'#111', fontSize:13, outline:'none', boxSizing:'border-box' }} />
        </div>

        <button onClick={handleLogin} disabled={loading}
          style={{ width:'100%', background:'#111', color:'#fff', border:'none', padding:10, borderRadius:6, fontSize:13, fontWeight:700, cursor: loading?'not-allowed':'pointer', marginTop:8, opacity: loading?0.7:1, fontFamily:'sans-serif' }}>
          {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>
      </div>
    </div>
  )
}
