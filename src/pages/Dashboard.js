import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const Badge = ({ type, label }) => {
  const styles = {
    kritik: { background:'#fef2f2', color:'#dc2626', border:'0.5px solid #fecaca' },
    yuksek: { background:'#fff7ed', color:'#ea580c', border:'0.5px solid #fed7aa' },
    orta:   { background:'#fefce8', color:'#ca8a04', border:'0.5px solid #fde68a' },
    dusuk:  { background:'#f0fdf4', color:'#16a34a', border:'0.5px solid #bbf7d0' },
    acik:   { background:'#eff6ff', color:'#2563eb', border:'0.5px solid #bfdbfe' },
    devam:  { background:'#faf5ff', color:'#7c3aed', border:'0.5px solid #ddd6fe' },
    kapali: { background:'#f0fdf4', color:'#16a34a', border:'0.5px solid #bbf7d0' },
  }
  return <span style={{ ...styles[type], display:'inline-block', padding:'2px 7px', borderRadius:4, fontSize:10, fontWeight:500, fontFamily:'monospace' }}>{label}</span>
}

export default function Dashboard({ profile, onLogout }) {
  const [findings, setFindings] = useState([])
  const [comments, setComments] = useState({})
  const [selectedFinding, setSelectedFinding] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [commentName, setCommentName] = useState(profile?.full_name || '')
  const [showModal, setShowModal] = useState(false)
  const [showNewFinding, setShowNewFinding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState([])
  const [newFinding, setNewFinding] = useState({ title:'', level:'kritik', status:'acik', cvss_score:'', impact_area:'', client_id:'' })

  const isPentest = profile?.role === 'pentest'
  const levelLabel = { kritik:'Kritik', yuksek:'Yüksek', orta:'Orta', dusuk:'Düşük' }
  const statusLabel = { acik:'Açık', devam:'Devam', kapali:'Kapatıldı' }

  useEffect(() => { fetchFindings(); if(isPentest) fetchClients() }, [])

  const fetchFindings = async () => {
    setLoading(true)
    let query = supabase.from('findings').select('*, clients(name)').order('created_at', { ascending: false })
    if (!isPentest) {
      query = query.eq('client_id', profile.company)
    }
    const { data } = await query
    setFindings(data || [])
    if (data?.length) fetchComments(data.map(f => f.id))
    setLoading(false)
  }
  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*')
    setClients(data || [])
  }

  const fetchComments = async (ids) => {
    const { data } = await supabase.from('comments').select('*').in('finding_id', ids).order('created_at')
    const grouped = {}
    data?.forEach(c => { if (!grouped[c.finding_id]) grouped[c.finding_id] = []; grouped[c.finding_id].push(c) })
    setComments(grouped)
  }

  const openModal = (finding) => { setSelectedFinding(finding); setShowModal(true) }

  const submitComment = async () => {
    if (!commentText.trim()) return
    await supabase.from('comments').insert({ finding_id: selectedFinding.id, author_name: commentName || 'Anonim', author_role: profile.role, content: commentText })
    setCommentText('')
    fetchComments(findings.map(f => f.id))
  }

  const submitFinding = async () => {
    if (!newFinding.title) return
    const findingId = 'FS-' + String(findings.length + 1).padStart(3, '0')
    await supabase.from('findings').insert({ ...newFinding, finding_id: findingId, cvss_score: parseFloat(newFinding.cvss_score) || null })
    setShowNewFinding(false)
    setNewFinding({ title:'', level:'kritik', status:'acik', cvss_score:'', impact_area:'', client_id:'' })
    fetchFindings()
  }

  const stats = {
    total: findings.length,
    critical: findings.filter(f => f.level === 'kritik').length,
    open: findings.filter(f => f.status === 'acik' || f.status === 'devam').length,
    closed: findings.filter(f => f.status === 'kapali').length,
  }

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:'sans-serif', background:'#f8f9fa' }}>
      {/* Sidebar */}
      <div style={{ width:210, background:'#fff', borderRight:'0.5px solid #e5e7eb', display:'flex', flexDirection:'column', padding:'20px 0', flexShrink:0 }}>
        <div style={{ padding:'0 18px 18px', borderBottom:'0.5px solid #e5e7eb', marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#111' }}>VulnBoard</div>
          <span style={{ fontSize:9, fontFamily:'monospace', padding:'2px 6px', borderRadius:4, marginTop:4, display:'inline-block', ...(isPentest ? { background:'#fef2f2', color:'#dc2626', border:'0.5px solid #fecaca' } : { background:'#eff6ff', color:'#2563eb', border:'0.5px solid #bfdbfe' }) }}>
            {isPentest ? 'Pentest Paneli' : 'Müşteri Paneli'}
          </span>
        </div>
        {['Dashboard', isPentest ? 'Tüm Bulgular' : 'Bulgularım', 'Raporlar'].map((item, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 18px', fontSize:12, color: i===0?'#111':'#6b7280', background: i===0?'#f3f4f6':'transparent', borderLeft: i===0?'2px solid #111':'2px solid transparent', cursor:'pointer' }}>
            {item}
          </div>
        ))}
        <div style={{ marginTop:'auto', padding:'0 18px' }}>
          <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8, fontFamily:'monospace' }}>{profile?.email}</div>
          <button onClick={onLogout} style={{ width:'100%', background:'transparent', border:'0.5px solid #e5e7eb', borderRadius:6, padding:8, fontSize:11, color:'#6b7280', cursor:'pointer' }}>Çıkış Yap</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'0.5px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff', flexShrink:0 }}>
          <div style={{ fontSize:14, fontWeight:500 }}>Dashboard {isPentest ? '— Tüm Müşteriler' : `— ${profile?.company}`}</div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {isPentest && (
              <button onClick={() => setShowNewFinding(true)} style={{ background:'#111', color:'#fff', border:'none', padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                + Yeni Bulgu
              </button>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:7, background:'#f3f4f6', border:'0.5px solid #e5e7eb', borderRadius:20, padding:'4px 10px 4px 4px' }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background: isPentest?'#dc2626':'#2563eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', fontWeight:700 }}>
                {(profile?.full_name||'?').slice(0,2).toUpperCase()}
              </div>
              <span style={{ fontSize:11, color:'#374151' }}>{profile?.full_name}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, padding:'16px 20px', flexShrink:0 }}>
          {[['Toplam',stats.total,'#111'],['Kritik',stats.critical,'#dc2626'],['Açık',stats.open,'#ea580c'],['Kapatıldı',stats.closed,'#16a34a']].map(([label,val,color]) => (
            <div key={label} style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:8, padding:'12px 14px' }}>
              <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:22, fontWeight:700, fontFamily:'monospace', color }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex:1, overflow:'auto', padding:'0 20px 20px' }}>
          {loading ? (
            <div style={{ padding:20, color:'#9ca3af', fontSize:12 }}>Yükleniyor...</div>
          ) : findings.length === 0 ? (
            <div style={{ padding:20, color:'#9ca3af', fontSize:12, textAlign:'center' }}>
              Henüz bulgu yok. {isPentest && '"+ Yeni Bulgu" butonuyla ekleyebilirsiniz.'}
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:'0.5px solid #e5e7eb' }}>
                  {['ID', isPentest && 'Müşteri', 'Başlık', 'Seviye', 'CVSS', 'Durum', 'Yorumlar', 'Tarih'].filter(Boolean).map(h => (
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {findings.map(f => (
                  <tr key={f.id} onClick={() => openModal(f)} style={{ cursor:'pointer', borderBottom:'0.5px solid #f3f4f6' }}
                    onMouseEnter={e => e.currentTarget.style.background='#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'10px', fontFamily:'monospace', color:'#9ca3af', fontSize:11 }}>{f.finding_id}</td>
                    {isPentest && <td style={{ padding:'10px', fontSize:11, color:'#6b7280' }}>{f.clients?.name || '-'}</td>}
                    <td style={{ padding:'10px', color:'#374151' }}>{f.title}</td>
                    <td style={{ padding:'10px' }}><Badge type={f.level} label={levelLabel[f.level]} /></td>
                    <td style={{ padding:'10px', fontFamily:'monospace', fontSize:11, color: f.cvss_score>=9?'#dc2626':f.cvss_score>=7?'#ea580c':f.cvss_score>=4?'#ca8a04':'#16a34a' }}>{f.cvss_score || '-'}</td>
                    <td style={{ padding:'10px' }}><Badge type={f.status} label={statusLabel[f.status]} /></td>
                    <td style={{ padding:'10px' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontFamily:'monospace', padding:'2px 8px', borderRadius:10, ...(comments[f.id]?.length > 0 ? { background:'#eff6ff', color:'#2563eb', border:'0.5px solid #bfdbfe' } : { background:'#f3f4f6', color:'#9ca3af', border:'0.5px solid #e5e7eb' }) }}>
                        💬 {comments[f.id]?.length || 0}
                      </span>
                    </td>
                    <td style={{ padding:'10px', fontFamily:'monospace', fontSize:11, color:'#9ca3af' }}>{f.created_at?.slice(0,10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Comment Modal */}
      {showModal && selectedFinding && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:20, display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
          <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:10, width:520, maxWidth:'100%', maxHeight:'80vh', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'16px 20px', borderBottom:'0.5px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:13, fontWeight:500 }}>{selectedFinding.title}</div>
              <span style={{ fontFamily:'monospace', fontSize:11, color:'#9ca3af', background:'#f3f4f6', padding:'3px 8px', borderRadius:4 }}>{selectedFinding.finding_id}</span>
            </div>
            <div style={{ padding:'16px 20px', flex:1, overflowY:'auto' }}>
              <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
                <Badge type={selectedFinding.level} label={levelLabel[selectedFinding.level]} />
                <span style={{ fontFamily:'monospace', fontSize:11, padding:'2px 8px', background:'#f3f4f6', borderRadius:4 }}>CVSS {selectedFinding.cvss_score || '-'}</span>
                <Badge type={selectedFinding.status} label={statusLabel[selectedFinding.status]} />
              </div>
              <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
                Yorumlar
                <span style={{ fontSize:9, padding:'2px 7px', borderRadius:4, background:'#f0fdf4', color:'#16a34a', border:'0.5px solid #bbf7d0' }}>🔗 Ortak Alan</span>
              </div>
              <div style={{ marginBottom:12 }}>
                {(comments[selectedFinding.id] || []).length === 0 ? (
                  <div style={{ fontSize:12, color:'#9ca3af', fontFamily:'monospace', padding:'8px 0' }}>Henüz yorum yok. İlk yorumu siz ekleyin!</div>
                ) : (
                  (comments[selectedFinding.id] || []).map((c, i) => (
                    <div key={i} style={{ display:'flex', gap:10, marginBottom:12 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background: c.author_role==='pentest'?'#dc2626':'#2563eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', fontWeight:700, flexShrink:0 }}>
                        {c.author_name.slice(0,2).toUpperCase()}
                      </div>
                      <div style={{ flex:1, background: c.author_role==='pentest'?'#fef2f2':'#eff6ff', border:`0.5px solid ${c.author_role==='pentest'?'#fecaca':'#bfdbfe'}`, borderRadius:8, padding:'9px 12px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontSize:11, fontWeight:500 }}>{c.author_name}</span>
                            <span style={{ fontSize:9, fontFamily:'monospace', padding:'1px 5px', borderRadius:3, ...(c.author_role==='pentest' ? { background:'#fef2f2', color:'#dc2626', border:'0.5px solid #fecaca' } : { background:'#eff6ff', color:'#2563eb', border:'0.5px solid #bfdbfe' }) }}>
                              {c.author_role==='pentest'?'Pentest':'Müşteri'}
                            </span>
                          </div>
                          <span style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace' }}>{c.created_at?.slice(0,16).replace('T',' ')}</span>
                        </div>
                        <div style={{ fontSize:12, color:'#374151', lineHeight:1.5 }}>{c.content}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
                <div style={{ display:'flex', gap:8, padding:10 }}>
                  <input value={commentName} onChange={e => setCommentName(e.target.value)} placeholder="Adınız..."
                    style={{ width:110, background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', fontSize:12, outline:'none', flexShrink:0 }} />
                  <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key==='Enter' && submitComment()} placeholder="Yorumunuzu yazın..."
                    style={{ flex:1, background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', fontSize:12, outline:'none' }} />
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end', padding:'0 10px 10px' }}>
                  <button onClick={submitComment} style={{ background:'#111', color:'#fff', border:'none', padding:'6px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>Gönder</button>
                </div>
              </div>
            </div>
            <div style={{ padding:'12px 20px', borderTop:'0.5px solid #e5e7eb', display:'flex', justifyContent:'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ background:'transparent', border:'0.5px solid #e5e7eb', color:'#6b7280', padding:'7px 14px', borderRadius:6, fontSize:11, cursor:'pointer' }}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* New Finding Modal */}
      {showNewFinding && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:20, display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
          <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:10, width:480, maxWidth:'100%' }}>
            <div style={{ padding:'16px 20px', borderBottom:'0.5px solid #e5e7eb' }}>
              <div style={{ fontSize:13, fontWeight:500 }}>Yeni Bulgu Ekle</div>
            </div>
            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
              {[['Başlık','title','text'],['CVSS Skoru','cvss_score','number'],['Impact Area','impact_area','text']].map(([label, key, type]) => (
                <div key={key}>
                  <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>{label}</label>
                  <input type={type} value={newFinding[key]} onChange={e => setNewFinding({...newFinding, [key]: e.target.value})}
                    style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Seviye</label>
                  <select value={newFinding.level} onChange={e => setNewFinding({...newFinding, level: e.target.value})}
                    style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none' }}>
                    <option value="kritik">Kritik</option>
                    <option value="yuksek">Yüksek</option>
                    <option value="orta">Orta</option>
                    <option value="dusuk">Düşük</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Durum</label>
                  <select value={newFinding.status} onChange={e => setNewFinding({...newFinding, status: e.target.value})}
                    style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none' }}>
                    <option value="acik">Açık</option>
                    <option value="devam">Devam Ediyor</option>
                    <option value="kapali">Kapatıldı</option>
                  </select>
                </div>
              </div>
              {clients.length > 0 && (
                <div>
                  <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Müşteri</label>
                  <select value={newFinding.client_id} onChange={e => setNewFinding({...newFinding, client_id: e.target.value})}
                    style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none' }}>
                    <option value="">Müşteri seç...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ padding:'12px 20px', borderTop:'0.5px solid #e5e7eb', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setShowNewFinding(false)} style={{ background:'transparent', border:'0.5px solid #e5e7eb', color:'#6b7280', padding:'7px 14px', borderRadius:6, fontSize:11, cursor:'pointer' }}>İptal</button>
              <button onClick={submitFinding} style={{ background:'#111', color:'#fff', border:'none', padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
