import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleReset = async () => {
    if (!password || !confirm) { setError('Tüm alanları doldurun.'); return }
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
    setTimeout(() => onDone(), 2000)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f9fa',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '40px 44px',
        width: 420,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28 }}>
          <div style={{ width:36, height:36, background:'linear-gradient(135deg, #dc2626, #991b1b)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🛡️</div>
          <span style={{ fontSize:18, fontWeight:800, color:'#111' }}>Vuln<span style={{ color:'#dc2626' }}>Board</span></span>
        </div>

        {success ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:40, marginBottom:16 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:600, color:'#16a34a', marginBottom:8 }}>Şifre güncellendi!</div>
            <div style={{ fontSize:13, color:'#9ca3af' }}>Giriş sayfasına yönlendiriliyorsunuz...</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom:28 }}>
              <h2 style={{ fontSize:22, fontWeight:700, color:'#111', marginBottom:6 }}>Yeni Şifre Belirle</h2>
              <p style={{ fontSize:13, color:'#6b7280' }}>Hesabın için yeni bir şifre oluştur.</p>
            </div>

            {error && (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderLeft:'3px solid #dc2626', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#dc2626', marginBottom:20 }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:12, color:'#374151', fontWeight:500, marginBottom:6 }}>Yeni Şifre</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
                style={{ width:'100%', background:'#f9fafb', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'11px 14px', color:'#111', fontSize:14, outline:'none', boxSizing:'border-box', transition:'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#111'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom:28 }}>
              <label style={{ display:'block', fontSize:12, color:'#374151', fontWeight:500, marginBottom:6 }}>Şifre Tekrar</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="Şifreyi tekrar gir"
                style={{ width:'100%', background:'#f9fafb', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'11px 14px', color:'#111', fontSize:14, outline:'none', boxSizing:'border-box', transition:'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#111'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <button onClick={handleReset} disabled={loading} style={{
              width:'100%', background: loading ? '#6b7280' : '#111',
              color:'#fff', border:'none', padding:'13px',
              borderRadius:8, fontSize:14, fontWeight:600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              transition:'background 0.15s',
            }}>
              {loading ? 'Güncelleniyor...' : <>Şifreyi Güncelle <span style={{ fontSize:16 }}>→</span></>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
