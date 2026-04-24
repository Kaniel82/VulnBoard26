import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [firma, setFirma]       = useState('')
  const [role, setRole]         = useState('pentest')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [forgotMode, setForgotMode]     = useState(false)
  const [forgotEmail, setForgotEmail]   = useState('')
  const [forgotSent, setForgotSent]     = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [kvkkAccepted, setKvkkAccepted] = useState(false)
  const [showKvkk, setShowKvkk]         = useState(false)

  const handleForgot = async () => {
    if (!forgotEmail) { setError('E-posta adresinizi girin.'); return }
    setForgotLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: window.location.origin
    })
    if (error) { setError(error.message); setForgotLoading(false); return }
    setForgotSent(true); setForgotLoading(false)
  }

  const handleLogin = async () => {
    if (!email || !password) { setError('E-posta ve şifre gerekli.'); return }
    if (role === 'pentest' && !firma.trim()) { setError('Firma adı gerekli.'); return }
    if (!kvkkAccepted) { setError('Devam etmek için KVKK metnini onaylamanız gerekiyor.'); return }
    setLoading(true); setError('')
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
    // Attach firma info to profile object for session
    onLogin({ ...profile, firma: firma || profile.company })
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', background: '#f9fafb',
    border: '1.5px solid #e5e7eb', borderRadius: 8,
    padding: '11px 14px', color: '#111', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', transition: 'border-color 0.15s',
  }

  const features = [
    { icon: '🎯', title: 'CVSS v3.1 Hesaplayıcı', desc: 'Otomatik risk skoru' },
    { icon: '📊', title: 'Canlı Dashboard',         desc: 'SLA & trend grafikleri' },
    { icon: '📄', title: 'PDF & Excel Rapor',        desc: 'Tek tıkla profesyonel' },
    { icon: '🔐', title: 'Müşteri Portalı',          desc: 'Güvenli izole erişim' },
  ]

  const stats = [
    { value: '500+', label: 'Bulgu Yönetildi' },
    { value: '99.9%', label: 'Uptime' },
    { value: '3dk',   label: 'Ortalama Rapor Süresi' },
  ]

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: '#0a0a0a',
    }}>

      {/* ─── LEFT PANEL ─────────────────────────────── */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #0c0c14 0%, #12102a 50%, #0c0c14 100%)',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 64px',
      }}>
        {/* Glow blobs */}
        <div style={{ position:'absolute', top:'10%', left:'20%', width:500, height:500,
          background:'radial-gradient(circle, rgba(220,38,38,0.07) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'15%', right:'5%', width:350, height:350,
          background:'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', pointerEvents:'none' }} />
        {/* Grid lines subtle */}
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize:'40px 40px', pointerEvents:'none' }} />

        {/* Logo */}
        <div style={{ marginBottom: 52, position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
            <div style={{
              width:44, height:44, background:'linear-gradient(135deg,#dc2626,#991b1b)',
              borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:20, boxShadow:'0 0 24px rgba(220,38,38,0.35)',
            }}>🛡️</div>
            <span style={{ fontSize:24, fontWeight:800, color:'#fff', letterSpacing:'-0.03em' }}>
              Vuln<span style={{ color:'#dc2626' }}>Board</span>
            </span>
          </div>
          <div style={{ fontSize:11, color:'#374151', fontFamily:'monospace', letterSpacing:'0.12em' }}>
            VULNERABILITY MANAGEMENT PLATFORM
          </div>
        </div>

        {/* Headline */}
        <div style={{ marginBottom: 44, position:'relative' }}>
          <h1 style={{ fontSize:42, fontWeight:800, color:'#fff', lineHeight:1.15, marginBottom:18, letterSpacing:'-0.03em' }}>
            Pentest Bulgularını<br />
            <span style={{ background:'linear-gradient(90deg,#dc2626,#f87171)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              Profesyonelce
            </span><br />
            Yönet & Raporla.
          </h1>
          <p style={{ fontSize:15, color:'#6b7280', lineHeight:1.7, maxWidth:380 }}>
            Red team, blue team ve pentest ekipleri için — CVSS hesaplama, SLA takibi, müşteri portalı ve tek tıkla PDF rapor.
          </p>
        </div>

        {/* Feature grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:40, position:'relative' }}>
          {features.map((f, i) => (
            <div key={i} style={{
              background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:10, padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:10,
            }}>
              <span style={{ fontSize:18, flexShrink:0 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'#e5e7eb', marginBottom:2 }}>{f.title}</div>
                <div style={{ fontSize:11, color:'#4b5563' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div style={{
          display:'flex', gap:32, paddingTop:24,
          borderTop:'1px solid rgba(255,255,255,0.06)',
          position:'relative',
        }}>
          {stats.map((s, i) => (
            <div key={i}>
              <div style={{ fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-0.02em' }}>{s.value}</div>
              <div style={{ fontSize:11, color:'#4b5563', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 8px #22c55e' }} />
            <span style={{ fontSize:11, color:'#4b5563', fontFamily:'monospace' }}>Sistemler çalışıyor</span>
          </div>
        </div>
      </div>

      {/* ─── RIGHT PANEL ────────────────────────────── */}
      <div style={{
        width: 500,
        background: '#fff',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '56px 52px', position: 'relative',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.12)',
      }}>
        {/* Top accent bar */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#7f1d1d,#dc2626,#f87171)' }} />

        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize:26, fontWeight:800, color:'#111', marginBottom:6, letterSpacing:'-0.02em' }}>
            Hoş Geldiniz
          </h2>
          <p style={{ fontSize:13, color:'#9ca3af' }}>Hesabınıza giriş yaparak devam edin</p>
        </div>

        {/* Role Tabs */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10, fontWeight:600 }}>
            Hesap Türü
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { key:'pentest', label:'Firma', icon:'🔐' },
              { key:'client',  label:'Müşteri',          icon:'🏢' },
            ].map(r => (
              <button key={r.key} onClick={() => { setRole(r.key); setError('') }} style={{
                padding:'12px 14px',
                background: role === r.key ? '#7f1d1d' : '#f9fafb',
                color:      role === r.key ? '#fff'    : '#6b7280',
                border:     role === r.key ? '1.5px solid #7f1d1d' : '1.5px solid #e5e7eb',
                borderRadius:8, fontSize:13, fontWeight: role === r.key ? 600 : 400,
                cursor:'pointer', fontFamily:'inherit',
                display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                transition:'all 0.15s',
              }}>
                <span>{r.icon}</span>{r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background:'#fef2f2', border:'1px solid #fecaca',
            borderLeft:'3px solid #dc2626',
            borderRadius:8, padding:'10px 14px',
            fontSize:13, color:'#dc2626', marginBottom:18,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Firma field — only for pentest */}
        {role === 'pentest' && (
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:12, color:'#374151', fontWeight:600, marginBottom:6 }}>
              Firma Adı <span style={{ color:'#dc2626' }}>*</span>
            </label>
            <input
              value={firma} onChange={e => setFirma(e.target.value)}
              placeholder="Şirketinizin adını girin"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor='#7f1d1d'}
              onBlur={e => e.target.style.borderColor='#e5e7eb'}
            />
          </div>
        )}

        {/* Email */}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:12, color:'#374151', fontWeight:600, marginBottom:6 }}>
            E-posta
          </label>
          <input
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="ornek@firma.com"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor='#7f1d1d'}
            onBlur={e => e.target.style.borderColor='#e5e7eb'}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <label style={{ fontSize:12, color:'#374151', fontWeight:600 }}>Şifre</label>
            <span onClick={() => { setForgotMode(true); setError(''); setForgotSent(false) }}
              style={{ fontSize:11, color:'#7f1d1d', cursor:'pointer', textDecoration:'underline' }}>
              Şifremi Unuttum
            </span>
          </div>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor='#7f1d1d'}
            onBlur={e => e.target.style.borderColor='#e5e7eb'}
          />
        </div>

        {/* KVKK */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:22, padding:'12px 14px', background:'#fafafa', border:'1px solid #e5e7eb', borderRadius:8 }}>
          <input type="checkbox" id="kvkk" checked={kvkkAccepted} onChange={e => setKvkkAccepted(e.target.checked)}
            style={{ marginTop:2, width:15, height:15, cursor:'pointer', flexShrink:0, accentColor:'#7f1d1d' }} />
          <label htmlFor="kvkk" style={{ fontSize:12, color:'#374151', lineHeight:1.6, cursor:'pointer' }}>
            <span style={{ color:'#7f1d1d', fontWeight:600, cursor:'pointer', textDecoration:'underline' }} onClick={() => setShowKvkk(true)}>KVKK & Gizlilik Politikası</span>'nı okudum, kabul ediyorum.
          </label>
        </div>

        {/* Submit */}
        <button onClick={handleLogin} disabled={loading} style={{
          width:'100%', background: loading ? '#9ca3af' : 'linear-gradient(135deg,#7f1d1d,#dc2626)',
          color:'#fff', border:'none', padding:'13px',
          borderRadius:8, fontSize:14, fontWeight:700,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily:'inherit', letterSpacing:'0.01em',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          boxShadow: loading ? 'none' : '0 4px 16px rgba(127,29,29,0.35)',
          transition:'all 0.2s',
        }}>
          {loading ? (
            <span style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin 0.8s linear infinite' }} />
              Giriş yapılıyor...
            </span>
          ) : (
            <>Giriş Yap <span style={{ fontSize:16 }}>→</span></>
          )}
        </button>

        {/* Bottom */}
        <div style={{
          marginTop:28, paddingTop:20,
          borderTop:'1px solid #f3f4f6',
          display:'flex', justifyContent:'space-between',
          fontSize:11, color:'#d1d5db',
        }}>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}>🔒 SSL ile şifrelendi</span>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', display:'inline-block' }} />
            v1.0 Beta
          </span>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* ─── KVKK MODAL ─────────────────────────────── */}
      {showKvkk && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, width:560, maxWidth:'100%', maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#111' }}>🔒 KVKK & Gizlilik Politikası</div>
              <button onClick={() => setShowKvkk(false)} style={{ background:'transparent', border:'none', fontSize:22, cursor:'pointer', color:'#9ca3af', lineHeight:1 }}>×</button>
            </div>
            <div style={{ padding:'20px 24px', overflowY:'auto', flex:1, fontSize:13, color:'#374151', lineHeight:1.8 }}>
              {[
                ['1. Veri Sorumlusu', 'VulnBoard platformu, kişisel verilerinizi 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında işlemektedir.'],
                ['2. Toplanan Veriler', 'Platform kullanımı sırasında ad-soyad, e-posta adresi, firma bilgisi ve güvenlik bulgularına ilişkin teknik veriler işlenmektedir.'],
                ['3. Verilerin Kullanımı', 'Verileriniz yalnızca platform hizmetlerinin sunulması amacıyla kullanılır, üçüncü taraflarla paylaşılmaz.'],
                ['4. Veri Güvenliği', 'Tüm veriler SSL şifreleme ile iletilir ve güvenli sunucularda saklanır. Yetkisiz erişime karşı teknik önlemler alınmıştır.'],
                ['5. Haklarınız', 'KVKK kapsamında verilerinize erişme, düzeltme ve silme hakkına sahipsiniz. Talepler için: info@vulnboard.com'],
                ['6. Çerezler', 'Platform yalnızca oturum yönetimi için zorunlu çerezler kullanmaktadır. Pazarlama çerezi kullanılmamaktadır.'],
              ].map(([title, text]) => (
                <div key={title} style={{ marginBottom:16 }}>
                  <div style={{ fontWeight:700, color:'#111', marginBottom:4 }}>{title}</div>
                  <div>{text}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid #e5e7eb', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
              <button onClick={() => setShowKvkk(false)} style={{ background:'transparent', border:'1.5px solid #e5e7eb', color:'#6b7280', padding:'9px 20px', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                Kapat
              </button>
              <button onClick={() => { setKvkkAccepted(true); setShowKvkk(false) }} style={{ background:'linear-gradient(135deg,#7f1d1d,#dc2626)', color:'#fff', border:'none', padding:'9px 22px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                ✓ Okudum, Kabul Ediyorum
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── FORGOT PASSWORD MODAL ──────────────────── */}
      {forgotMode && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, padding:'32px 36px', width:400, maxWidth:'100%', boxShadow:'0 24px 80px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize:18, fontWeight:800, color:'#111', marginBottom:8 }}>🔑 Şifremi Unuttum</div>
            {forgotSent ? (
              <>
                <div style={{ fontSize:13, color:'#16a34a', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'12px 16px', marginBottom:20, lineHeight:1.6 }}>
                  ✅ Şifre sıfırlama linki <strong>{forgotEmail}</strong> adresine gönderildi. E-postanı kontrol et!
                </div>
                <button onClick={() => setForgotMode(false)} style={{ width:'100%', background:'linear-gradient(135deg,#7f1d1d,#dc2626)', color:'#fff', border:'none', padding:'12px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  Tamam
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize:13, color:'#6b7280', marginBottom:20, lineHeight:1.6 }}>E-posta adresini gir, sana şifre sıfırlama linki gönderelim.</p>
                {error && (
                  <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderLeft:'3px solid #dc2626', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#dc2626', marginBottom:16 }}>
                    {error}
                  </div>
                )}
                <div style={{ marginBottom:20 }}>
                  <label style={{ display:'block', fontSize:12, color:'#374151', fontWeight:600, marginBottom:6 }}>E-posta</label>
                  <input value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleForgot()}
                    placeholder="ornek@firma.com"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor='#7f1d1d'}
                    onBlur={e => e.target.style.borderColor='#e5e7eb'}
                  />
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => { setForgotMode(false); setError('') }} style={{ flex:1, background:'transparent', border:'1.5px solid #e5e7eb', color:'#6b7280', padding:'11px', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                    İptal
                  </button>
                  <button onClick={handleForgot} disabled={forgotLoading} style={{ flex:1, background:'linear-gradient(135deg,#7f1d1d,#dc2626)', color:'#fff', border:'none', padding:'11px', borderRadius:8, fontSize:13, fontWeight:600, cursor: forgotLoading ? 'not-allowed' : 'pointer', opacity: forgotLoading ? 0.7 : 1, fontFamily:'inherit' }}>
                    {forgotLoading ? 'Gönderiliyor...' : 'Link Gönder'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
