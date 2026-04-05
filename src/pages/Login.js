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
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    if (!profile) { setError('Profil bulunamadı.'); setLoading(false); return }
    if (role === 'pentest' && profile.role === 'client') {
      setError('Bu hesap müşteri hesabıdır.')
      await supabase.auth.signOut(); setLoading(false); return
    }
    if (role === 'client' && (profile.role === 'pentest' || profile.role === 'superadmin')) {
      setError('Bu hesap pentest hesabıdır.')
      await supabase.auth.signOut(); setLoading(false); return
    }
    onLogin(profile)
    setLoading(false)
  }

  const features = [
    { icon: '🎯', title: 'CVSS v3.1 Hesaplayıcı', desc: 'Otomatik skor hesaplama' },
    { icon: '📊', title: 'Anlık Dashboard', desc: 'SLA ve zafiyet grafikleri' },
    { icon: '📄', title: 'PDF & Excel Rapor', desc: 'Tek tıkla profesyonel rapor' },
    { icon: '🔐', title: 'Müşteri Portalı', desc: 'Güvenli izole erişim' },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: '#0a0a0a',
    }}>
      {/* LEFT PANEL */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #0f0f0f 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 64px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: '20%', left: '30%',
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', right: '10%',
          width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40,
              background: 'linear-gradient(135deg, #dc2626, #991b1b)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, boxShadow: '0 0 20px rgba(220,38,38,0.3)',
            }}>🛡️</div>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              Vuln<span style={{ color: '#dc2626' }}>Board</span>
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#4b5563', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
            VULNERABILITY MANAGEMENT PLATFORM
          </div>
        </div>

        {/* Headline */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{
            fontSize: 40, fontWeight: 800, color: '#fff',
            lineHeight: 1.15, marginBottom: 16,
            letterSpacing: '-0.03em',
          }}>
            Güvenlik Açıklarını<br />
            <span style={{
              background: 'linear-gradient(90deg, #dc2626, #f87171)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Profesyonelce</span><br />
            Yönet.
          </h1>
          <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6, maxWidth: 380 }}>
            Red team, blue team, pentest ve yazılım güvenliği ekipleri için bulgu yönetimi ve raporlama platformu.
          </p>
        </div>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {features.map((f, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb', marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 11, color: '#4b5563' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom tag */}
        <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          <span style={{ fontSize: 11, color: '#4b5563', fontFamily: 'monospace' }}>Tüm sistemler çalışıyor</span>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{
        width: 480,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 52px',
        position: 'relative',
      }}>
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 8, letterSpacing: '-0.02em' }}>
            Hoş Geldiniz
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280' }}>Hesabınıza giriş yapın</p>
        </div>

        {/* Role tabs */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 500 }}>
            Hesap Türü
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { key: 'pentest', label: 'Pentest Firması', icon: '🔐' },
              { key: 'client', label: 'Müşteri', icon: '🏢' },
            ].map(r => (
              <button key={r.key} onClick={() => setRole(r.key)} style={{
                padding: '12px 14px',
                background: role === r.key ? '#111' : '#f9fafb',
                color: role === r.key ? '#fff' : '#6b7280',
                border: role === r.key ? '1.5px solid #111' : '1.5px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: role === r.key ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'all 0.15s',
              }}>
                <span>{r.icon}</span> {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderLeft: '3px solid #dc2626',
            borderRadius: 8, padding: '10px 14px',
            fontSize: 13, color: '#dc2626', marginBottom: 20,
          }}>
            {error}
          </div>
        )}

        {/* Inputs */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#374151', fontWeight: 500, marginBottom: 6 }}>
            E-posta
          </label>
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="ornek@firma.com"
            style={{
              width: '100%', background: '#f9fafb',
              border: '1.5px solid #e5e7eb', borderRadius: 8,
              padding: '11px 14px', color: '#111', fontSize: 14,
              outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = '#111'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#374151', fontWeight: 500, marginBottom: 6 }}>
            Şifre
          </label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            style={{
              width: '100%', background: '#f9fafb',
              border: '1.5px solid #e5e7eb', borderRadius: 8,
              padding: '11px 14px', color: '#111', fontSize: 14,
              outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = '#111'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>

        {/* Submit */}
        <button onClick={handleLogin} disabled={loading} style={{
          width: '100%', background: loading ? '#6b7280' : '#111',
          color: '#fff', border: 'none', padding: '13px',
          borderRadius: 8, fontSize: 14, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', letterSpacing: '0.01em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.15s',
        }}>
          {loading ? 'Giriş yapılıyor...' : <>Giriş Yap <span style={{ fontSize: 16 }}>→</span></>}
        </button>

        {/* Bottom */}
        <div style={{
          marginTop: 32, paddingTop: 24,
          borderTop: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'space-between',
          fontSize: 11, color: '#d1d5db',
        }}>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}>🔒 SSL ile korunuyor</span>
          <span>v1.0 Beta</span>
        </div>
      </div>
    </div>
  )
}
