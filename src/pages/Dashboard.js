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

const calcCVSSScore = (params) => {
  const av = parseFloat(params.av)
  const ac = parseFloat(params.ac)
  const pr = parseFloat(params.pr)
  const ui = parseFloat(params.ui)
  const c = parseFloat(params.c)
  const i = parseFloat(params.i)
  const a = 0.56
  const iss = 1 - (1 - c) * (1 - i) * (1 - a)
  const impact = iss <= 0 ? 0 : 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
  const exploit = 8.22 * av * ac * pr * ui
  const score = impact <= 0 ? 0 : Math.min(10, impact + exploit)
  return Math.round(score * 10) / 10
}

const getCvssColor = (score) => {
  if (score >= 9) return '#dc2626'
  if (score >= 7) return '#ea580c'
  if (score >= 4) return '#ca8a04'
  if (score > 0) return '#16a34a'
  return '#9ca3af'
}

const getCvssLabel = (score) => {
  if (score >= 9) return 'Kritik'
  if (score >= 7) return 'Yüksek'
  if (score >= 4) return 'Orta'
  if (score > 0) return 'Düşük'
  return 'Yok'
}

const CVSS_PARAMS = [
  { key:'av', label:'Attack Vector', options:[{v:'0.85',l:'Network'},{v:'0.62',l:'Adjacent'},{v:'0.55',l:'Local'},{v:'0.2',l:'Physical'}] },
  { key:'ac', label:'Attack Complexity', options:[{v:'0.77',l:'Low'},{v:'0.44',l:'High'}] },
  { key:'pr', label:'Privileges Required', options:[{v:'0.85',l:'None'},{v:'0.62',l:'Low'},{v:'0.27',l:'High'}] },
  { key:'ui', label:'User Interaction', options:[{v:'0.85',l:'None'},{v:'0.62',l:'Required'}] },
  { key:'c',  label:'Confidentiality', options:[{v:'0.56',l:'High'},{v:'0.22',l:'Low'},{v:'0',l:'None'}] },
  { key:'i',  label:'Integrity', options:[{v:'0.56',l:'High'},{v:'0.22',l:'Low'},{v:'0',l:'None'}] },
]

export default function Dashboard({ profile, onLogout }) {
  const [findings, setFindings] = useState([])
  const [comments, setComments] = useState({})
  const [selectedFinding, setSelectedFinding] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [commentName, setCommentName] = useState(profile?.full_name || '')
  const [showModal, setShowModal] = useState(false)
  
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFinding, setEditFinding] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFinding, setEditFinding] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showNewFinding, setShowNewFinding] = useState(false)
  const [showNewClient, setShowNewClient] = useState(false)
  const [activePage, setActivePage] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState([])
  const [savingClient, setSavingClient] = useState(false)
  const [clientErrMsg, setClientErrMsg] = useState('')
  const [newFinding, setNewFinding] = useState({ title:'', level:'kritik', status:'acik', cvss_score:'', impact_area:'', impact_category:[], references_links:'', closure_note:'', client_id:'' })
  const [newClient, setNewClient] = useState({ name:'', email:'', password:'', full_name:'' })
  const [cvssParams, setCvssParams] = useState({ av:'0.85', ac:'0.77', pr:'0.85', ui:'0.85', c:'0.56', i:'0.56' })

  const isPentest = profile?.role === 'pentest'
  const levelLabel = { kritik:'Kritik', yuksek:'Yüksek', orta:'Orta', dusuk:'Düşük' }
  const statusLabel = { acik:'Açık', devam:'Devam', kapali:'Kapatıldı' }
  const cvssScore = calcCVSSScore(cvssParams)
  const cvssColor = getCvssColor(cvssScore)
  const cvssLabel = getCvssLabel(cvssScore)

  useEffect(() => {
    fetchFindings()
    fetchClients()
  }, [])

  const fetchFindings = async () => {
    setLoading(true)
    let query = supabase.from('findings').select('*, clients(name)').order('created_at', { ascending: false })
    if (!isPentest) query = query.eq('client_id', profile.company)
    const { data } = await query
    setFindings(data || [])
    if (data && data.length > 0) fetchComments(data.map(f => f.id))
    setLoading(false)
  }

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data || [])
  }

  const fetchComments = async (ids) => {
    const { data } = await supabase.from('comments').select('*').in('finding_id', ids).order('created_at')
    const grouped = {}
    if (data) data.forEach(c => { if (!grouped[c.finding_id]) grouped[c.finding_id] = []; grouped[c.finding_id].push(c) })
    setComments(grouped)
  }

  const openModal = (finding) => { setSelectedFinding(finding); setShowModal(true) }
  const openEditModal = (e, finding) => {
  e.stopPropagation()
  setEditFinding({ ...finding, impact_category: finding.impact_category ? finding.impact_category.split(', ') : [] })
  setShowEditModal(true)
}

const deleteFinding = async (e, id) => {
  e.stopPropagation()
  if (!window.confirm('Bu bulguyu silmek istediğinize emin misiniz?')) return
  await supabase.from('comments').delete().eq('finding_id', id)
  await supabase.from('findings').delete().eq('id', id)
  fetchFindings()
}

const updateFinding = async () => {
  if (!editFinding.title) return
  await supabase.from('findings').update({
    title: editFinding.title,
    level: editFinding.level,
    status: editFinding.status,
    cvss_score: parseFloat(editFinding.cvss_score) || null,
    impact_category: editFinding.impact_category.join(', '),
    references_links: editFinding.references_links,
    closure_note: editFinding.closure_note
  }).eq('id', editFinding.id)
  setShowEditModal(false)
  setEditFinding(null)
  fetchFindings()
}
  const openEditModal = (e, finding) => {
    e.stopPropagation()
    setEditFinding({ ...finding, impact_category: finding.impact_category ? finding.impact_category.split(', ') : [] })
    setShowEditModal(true)
  }

  const deleteFinding = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Bu bulguyu silmek istediğinize emin misiniz?')) return
    await supabase.from('comments').delete().eq('finding_id', id)
    await supabase.from('findings').delete().eq('id', id)
    fetchFindings()
  }

  const updateFinding = async () => {
    if (!editFinding.title) return
    await supabase.from('findings').update({
      title: editFinding.title,
      level: editFinding.level,
      status: editFinding.status,
      cvss_score: parseFloat(editFinding.cvss_score) || null,
      impact_category: editFinding.impact_category.join(', '),
      references_links: editFinding.references_links,
      closure_note: editFinding.closure_note,
      client_id: editFinding.client_id
    }).eq('id', editFinding.id)
    setShowEditModal(false)
    setEditFinding(null)
    fetchFindings()
  }


  const openEditModal = (e, finding) => {
    e.stopPropagation()
    setEditFinding({ ...finding, impact_category: finding.impact_category ? finding.impact_category.split(', ') : [] })
    setShowEditModal(true)
  }

  const deleteFinding = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Bu bulguyu silmek istediğinize emin misiniz?')) return
    await supabase.from('comments').delete().eq('finding_id', id)
    await supabase.from('findings').delete().eq('id', id)
    fetchFindings()
  }

  const updateFinding = async () => {
    if (!editFinding.title) return
    await supabase.from('findings').update({
      title: editFinding.title,
      level: editFinding.level,
      status: editFinding.status,
      cvss_score: parseFloat(editFinding.cvss_score) || null,
      impact_category: editFinding.impact_category.join(', '),
      references_links: editFinding.references_links,
      closure_note: editFinding.closure_note,
      client_id: editFinding.client_id
    }).eq('id', editFinding.id)
    setShowEditModal(false)
    setEditFinding(null)
    fetchFindings()
  }

  const submitComment = async () => {
    if (!commentText.trim()) return
    await supabase.from('comments').insert({ finding_id: selectedFinding.id, author_name: commentName || 'Anonim', author_role: profile.role, content: commentText })
    setCommentText('')
    fetchComments(findings.map(f => f.id))
  }

  const updateCvssParam = (key, value) => {
    const newParams = { ...cvssParams, [key]: value }
    setCvssParams(newParams)
    const score = calcCVSSScore(newParams)
    setNewFinding(prev => ({ ...prev, cvss_score: score.toString() }))
  }

  const submitFinding = async () => {
    if (!newFinding.title) return
    const findingId = 'FS-' + String(findings.length + 1).padStart(3, '0')
    await supabase.from('findings').insert({
      ...newFinding,
      finding_id: findingId,
      cvss_score: parseFloat(newFinding.cvss_score) || null,
      impact_category: newFinding.impact_category.join(', ')
    })
    setShowNewFinding(false)
    setNewFinding({ title:'', level:'kritik', status:'acik', cvss_score:'', impact_area:'', impact_category:[], references_links:'', closure_note:'', client_id:'' })
    setCvssParams({ av:'0.85', ac:'0.77', pr:'0.85', ui:'0.85', c:'0.56', i:'0.56' })
    fetchFindings()
  }

  const submitClient = async () => {
    if (!newClient.name || !newClient.email || !newClient.password) { setClientErrMsg('Tüm alanları doldurun.'); return }
    setSavingClient(true)
    setClientErrMsg('')
    const { data: clientData, error: cErr } = await supabase.from('clients').insert({ name: newClient.name, email: newClient.email }).select().single()
    if (cErr) { setClientErrMsg(cErr.message); setSavingClient(false); return }
    const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/bright-responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ email: newClient.email, password: newClient.password, full_name: newClient.full_name || newClient.name, company_id: clientData.id })
    })
    const result = await res.json()
    if (result.error) { setClientErrMsg(result.error); setSavingClient(false); return }
    setSavingClient(false)
    setShowNewClient(false)
    setNewClient({ name:'', email:'', password:'', full_name:'' })
    fetchClients()
    alert('Müşteri başarıyla eklendi!')
  }

  const stats = {
    total: findings.length,
    critical: findings.filter(f => f.level === 'kritik').length,
    open: findings.filter(f => f.status === 'acik' || f.status === 'devam').length,
    closed: findings.filter(f => f.status === 'kapali').length,
  }

  const navItems = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'findings', label: isPentest ? 'Tüm Bulgular' : 'Bulgularım' },
    { key: 'clients', label: 'Müşteriler' },
    { key: 'reports', label: 'Raporlar' },
  ]

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:'sans-serif', background:'#f8f9fa' }}>
      <div style={{ width:210, background:'#fff', borderRight:'0.5px solid #e5e7eb', display:'flex', flexDirection:'column', padding:'20px 0', flexShrink:0 }}>
        <div style={{ padding:'0 18px 18px', borderBottom:'0.5px solid #e5e7eb', marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#111' }}>VulnBoard</div>
          <span style={{ fontSize:9, fontFamily:'monospace', padding:'2px 6px', borderRadius:4, marginTop:4, display:'inline-block', ...(isPentest ? { background:'#fef2f2', color:'#dc2626', border:'0.5px solid #fecaca' } : { background:'#eff6ff', color:'#2563eb', border:'0.5px solid #bfdbfe' }) }}>
            {isPentest ? 'Pentest Paneli' : 'Müşteri Paneli'}
          </span>
        </div>
        {navItems.map(item => {
          if (item.key === 'clients' && !isPentest) return null
          return (
            <div key={item.key} onClick={() => setActivePage(item.key)}
              style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 18px', fontSize:12, color: activePage===item.key ? '#111' : '#6b7280', background: activePage===item.key ? '#f3f4f6' : 'transparent', borderLeft: activePage===item.key ? '2px solid #111' : '2px solid transparent', cursor:'pointer' }}>
              {item.label}
            </div>
          )
        })}
        <div style={{ marginTop:'auto', padding:'0 18px' }}>
          <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8, fontFamily:'monospace' }}>{profile?.email}</div>
          <button onClick={onLogout} style={{ width:'100%', background:'transparent', border:'0.5px solid #e5e7eb', borderRadius:6, padding:8, fontSize:11, color:'#6b7280', cursor:'pointer' }}>Çıkış Yap</button>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'0.5px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff', flexShrink:0 }}>
          <div style={{ fontSize:14, fontWeight:500 }}>
            {activePage === 'dashboard' && 'Dashboard'}
            {activePage === 'findings' && (isPentest ? 'Tüm Bulgular' : 'Bulgularım')}
            {activePage === 'clients' && 'Müşteriler'}
            {activePage === 'reports' && 'Raporlar'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {isPentest && (activePage === 'findings' || activePage === 'dashboard') && (
              <button onClick={() => setShowNewFinding(true)} style={{ background:'#111', color:'#fff', border:'none', padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>+ Yeni Bulgu</button>
            )}
            {isPentest && activePage === 'clients' && (
              <button onClick={() => setShowNewClient(true)} style={{ background:'#111', color:'#fff', border:'none', padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>+ Yeni Müşteri</button>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:7, background:'#f3f4f6', border:'0.5px solid #e5e7eb', borderRadius:20, padding:'4px 10px 4px 4px' }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background: isPentest ? '#dc2626' : '#2563eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', fontWeight:700 }}>
                {(profile?.full_name || '?').slice(0,2).toUpperCase()}
              </div>
              <span style={{ fontSize:11, color:'#374151' }}>{profile?.full_name}</span>
            </div>
          </div>
        </div>

        {(activePage === 'dashboard' || activePage === 'findings') && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, padding:'16px 20px', flexShrink:0 }}>
              {[['Toplam', stats.total, '#111'], ['Kritik', stats.critical, '#dc2626'], ['Açık', stats.open, '#ea580c'], ['Kapatıldı', stats.closed, '#16a34a']].map(([label, val, color]) => (
                <div key={label} style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:8, padding:'12px 14px' }}>
                  <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:22, fontWeight:700, fontFamily:'monospace', color }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ flex:1, overflow:'auto', padding:'0 20px 20px' }}>
              {loading ? (
                <div style={{ padding:20, color:'#9ca3af', fontSize:12 }}>Yükleniyor...</div>
              ) : findings.length === 0 ? (
                <div style={{ padding:20, color:'#9ca3af', fontSize:12, textAlign:'center' }}>Henüz bulgu yok.</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ borderBottom:'0.5px solid #e5e7eb' }}>
                      {['ID', isPentest ? 'Müşteri' : null, 'Başlık', 'Seviye', 'CVSS', 'Etki Alanı', 'Durum', 'Yorumlar', 'Tarih','ID', isPentest ? 'Müşteri' : null, 'Başlık', 'Seviye', 'CVSS', 'Etki Alanı', 'Durum', 'Yorumlar', 'Tarih', isPentest ? 'İşlem' : null isPentest ? 'İşlem' : null].filter(Boolean).map(h => (
                        <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {findings.map(f => (
                      <tr key={f.id} onClick={() => openModal(f)} style={{ cursor:'pointer', borderBottom:'0.5px solid #f3f4f6' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding:'10px', fontFamily:'monospace', color:'#9ca3af', fontSize:11 }}>{f.finding_id}</td>
                        {isPentest && <td style={{ padding:'10px', fontSize:11, color:'#6b7280' }}>{f.clients?.name || '-'}</td>}
                        <td style={{ padding:'10px', color:'#374151' }}>{f.title}</td>
                        <td style={{ padding:'10px' }}><Badge type={f.level} label={levelLabel[f.level]} /></td>
                        <td style={{ padding:'10px', fontFamily:'monospace', fontSize:11, fontWeight:500, color: getCvssColor(f.cvss_score) }}>{f.cvss_score || '-'}</td>
                        <td style={{ padding:'10px' }}>
                          {f.impact_category ? (
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                              {f.impact_category.split(', ').map(cat => (
                                <span key={cat} style={{ fontSize:10, fontFamily:'monospace', padding:'2px 6px', borderRadius:4, background:'#eff6ff', color:'#2563eb', border:'0.5px solid #bfdbfe' }}>{cat}</span>
                              ))}
                            </div>
                          ) : <span style={{ fontSize:11, color:'#9ca3af' }}>-</span>}
                        </td>
                        <td style={{ padding:'10px' }}><Badge type={f.status} label={statusLabel[f.status]} /></td>
                        <td style={{ padding:'10px' }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontFamily:'monospace', padding:'2px 8px', borderRadius:10, ...(comments[f.id]?.length > 0 ? { background:'#eff6ff', color:'#2563eb', border:'0.5px solid #bfdbfe' } : { background:'#f3f4f6', color:'#9ca3af', border:'0.5px solid #e5e7eb' }) }}>
                            💬 {comments[f.id]?.length || 0}
                          </span>
                        </td>
                        <td style={{ padding:'10px', fontFamily:'monospace', fontSize:11, color:'#9ca3af' }}>{f.created_at?.slice(0, 10)}</td>
                        {isPentest && (
                          <td style={{ padding:'10px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display:'flex', gap:6 }}>
                              <button onClick={e => openEditModal(e, f)} style={{ background:'#f3f4f6', border:'0.5px solid #e5e7eb', borderRadius:4, padding:'3px 8px', fontSize:10, cursor:'pointer', color:'#374151' }}>✏️ Düzenle</button>
                              <button onClick={e => deleteFinding(e, f.id)} style={{ background:'#fef2f2', border:'0.5px solid #fecaca', borderRadius:4, padding:'3px 8px', fontSize:10, cursor:'pointer', color:'#dc2626' }}>🗑️ Sil</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activePage === 'clients' && (
          <div style={{ flex:1, overflow:'auto', padding:'20px' }}>
            {clients.length === 0 ? (
              <div style={{ color:'#9ca3af', fontSize:12, textAlign:'center', padding:20 }}>Henüz müşteri yok.</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:'0.5px solid #e5e7eb' }}>
                    {['Şirket Adı', 'Email', 'Kayıt Tarihi'].map(h => (
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                      <td style={{ padding:'10px', fontWeight:500, color:'#111' }}>{c.name}</td>
                      <td style={{ padding:'10px', color:'#6b7280', fontSize:11 }}>{c.email}</td>
                      <td style={{ padding:'10px', fontFamily:'monospace', fontSize:11, color:'#9ca3af' }}>{c.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activePage === 'reports' && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontSize:12 }}>
            Rapor modülü yakında! 🚀
          </div>
        )}
      </div>

      {/* Comment Modal */}
      {showModal && selectedFinding && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:20, display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
          <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:10, width:520, maxWidth:'100%', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'16px 20px', borderBottom:'0.5px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ fontSize:13, fontWeight:500 }}>{selectedFinding.title}</div>
              <span style={{ fontFamily:'monospace', fontSize:11, color:'#9ca3af', background:'#f3f4f6', padding:'3px 8px', borderRadius:4 }}>{selectedFinding.finding_id}</span>
            </div>
            <div style={{ padding:'16px 20px', flex:1, overflowY:'auto' }}>
              <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
                <Badge type={selectedFinding.level} label={levelLabel[selectedFinding.level]} />
                <span style={{ fontFamily:'monospace', fontSize:11, padding:'2px 8px', background:'#f3f4f6', borderRadius:4, color: getCvssColor(selectedFinding.cvss_score), fontWeight:500 }}>
                  CVSS {selectedFinding.cvss_score || '-'} {selectedFinding.cvss_score ? `(${getCvssLabel(selectedFinding.cvss_score)})` : ''}
                </span>
                <Badge type={selectedFinding.status} label={statusLabel[selectedFinding.status]} />
                {selectedFinding.impact_category && (
                  <span style={{ fontFamily:'monospace', fontSize:11, padding:'2px 8px', background:'#eff6ff', color:'#2563eb', border:'0.5px solid #bfdbfe', borderRadius:4 }}>
                    🎯 {selectedFinding.impact_category}
                  </span>
                )}
              </div>
              {selectedFinding.references_links && (
                <div style={{ marginBottom:12, padding:'10px 12px', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Referanslar</div>
                  <div style={{ fontSize:12, color:'#2563eb', fontFamily:'monospace', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{selectedFinding.references_links}</div>
                </div>
              )}
              {selectedFinding.closure_note && (
                <div style={{ marginBottom:12, padding:'10px 12px', background:'#f0fdf4', border:'0.5px solid #bbf7d0', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'#16a34a', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Kapanış Notu</div>
                  <div style={{ fontSize:12, color:'#374151', lineHeight:1.6 }}>{selectedFinding.closure_note}</div>
                </div>
              )}
              <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
                Yorumlar
                <span style={{ fontSize:9, padding:'2px 7px', borderRadius:4, background:'#f0fdf4', color:'#16a34a', border:'0.5px solid #bbf7d0' }}>🔗 Ortak Alan</span>
              </div>
              <div style={{ marginBottom:12 }}>
                {(comments[selectedFinding.id] || []).length === 0 ? (
                  <div style={{ fontSize:12, color:'#9ca3af', fontFamily:'monospace', padding:'8px 0' }}>Henüz yorum yok.</div>
                ) : (
                  (comments[selectedFinding.id] || []).map((c, i) => (
                    <div key={i} style={{ display:'flex', gap:10, marginBottom:12 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background: c.author_role === 'pentest' ? '#dc2626' : '#2563eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', fontWeight:700, flexShrink:0 }}>
                        {c.author_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex:1, background: c.author_role === 'pentest' ? '#fef2f2' : '#eff6ff', border: `0.5px solid ${c.author_role === 'pentest' ? '#fecaca' : '#bfdbfe'}`, borderRadius:8, padding:'9px 12px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontSize:11, fontWeight:500 }}>{c.author_name}</span>
                            <span style={{ fontSize:9, fontFamily:'monospace', padding:'1px 5px', borderRadius:3, ...(c.author_role === 'pentest' ? { background:'#fef2f2', color:'#dc2626', border:'0.5px solid #fecaca' } : { background:'#eff6ff', color:'#2563eb', border:'0.5px solid #bfdbfe' }) }}>
                              {c.author_role === 'pentest' ? 'Pentest' : 'Müşteri'}
                            </span>
                          </div>
                          <span style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace' }}>{c.created_at?.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <div style={{ fontSize:12, color:'#374151', lineHeight:1.5 }}>{c.content}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
                <div style={{ display:'flex', gap:8, padding:10 }}>
                  <input value={commentName} onChange={e => setCommentName(e.target.value)} placeholder="Adınız..." style={{ width:110, background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', fontSize:12, outline:'none', flexShrink:0 }} />
                  <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitComment()} placeholder="Yorumunuzu yazın..." style={{ flex:1, background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', fontSize:12, outline:'none' }} />
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end', padding:'0 10px 10px' }}>
                  <button onClick={submitComment} style={{ background:'#111', color:'#fff', border:'none', padding:'6px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>Gönder</button>
                </div>
              </div>
            </div>
            <div style={{ padding:'12px 20px', borderTop:'0.5px solid #e5e7eb', display:'flex', justifyContent:'flex-end', flexShrink:0 }}>
              <button onClick={() => setShowModal(false)} style={{ background:'transparent', border:'0.5px solid #e5e7eb', color:'#6b7280', padding:'7px 14px', borderRadius:6, fontSize:11, cursor:'pointer' }}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* New Finding Modal */}
      {showNewFinding && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:20, display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
          <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:10, width:560, maxWidth:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'16px 20px', borderBottom:'0.5px solid #e5e7eb', flexShrink:0 }}>
              <div style={{ fontSize:13, fontWeight:500 }}>Yeni Bulgu Ekle</div>
            </div>
            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12, overflowY:'auto' }}>

              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Başlık</label>
                <input type="text" value={newFinding.title} onChange={e => setNewFinding({...newFinding, title: e.target.value})}
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box' }} />
              </div>

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

              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Müşteri</label>
                <select value={newFinding.client_id} onChange={e => setNewFinding({...newFinding, client_id: e.target.value})}
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none' }}>
                  <option value="">Müşteri seç...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* CVSS Hesaplayıcı */}
              <div style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:8, padding:14 }}>
                <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>CVSS v3.1 Hesaplayıcı</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                  {CVSS_PARAMS.map(param => (
                    <div key={param.key}>
                      <label style={{ display:'block', fontSize:10, color:'#6b7280', fontFamily:'monospace', marginBottom:3 }}>{param.label}</label>
                      <select value={cvssParams[param.key]} onChange={e => updateCvssParam(param.key, e.target.value)}
                        style={{ width:'100%', background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:5, padding:'5px 8px', color:'#111', fontSize:11, fontFamily:'monospace', outline:'none' }}>
                        {param.options.map(opt => <option key={opt.v} value={opt.v}>{opt.l}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12, paddingTop:10, borderTop:'0.5px solid #e5e7eb' }}>
                  <div>
                    <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', marginBottom:2 }}>SKOR</div>
                    <div style={{ fontSize:28, fontWeight:700, fontFamily:'monospace', color:cvssColor }}>{cvssScore.toFixed(1)}</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ height:8, background:'#e5e7eb', borderRadius:4, overflow:'hidden', marginBottom:4 }}>
                      <div style={{ height:'100%', width:`${cvssScore * 10}%`, background:cvssColor, borderRadius:4, transition:'width 0.3s, background 0.3s' }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:11, fontWeight:500, fontFamily:'monospace', color:cvssColor }}>{cvssLabel}</span>
                      <span style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace' }}>0 ——— 10</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Etki Alanı</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {['Network', 'Web', 'Mobile', 'API', 'Cloud', 'Active Directory', 'IoT', 'Other'].map(cat => (
                    <label key={cat} style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
                      <input type="checkbox" checked={newFinding.impact_category.includes(cat)}
                        onChange={e => {
                          if (e.target.checked) setNewFinding({...newFinding, impact_category: [...newFinding.impact_category, cat]})
                          else setNewFinding({...newFinding, impact_category: newFinding.impact_category.filter(c => c !== cat)})
                        }} />
                      <span style={{ fontSize:12, padding:'3px 8px', borderRadius:4, border:'0.5px solid #e5e7eb', color: newFinding.impact_category.includes(cat) ? '#2563eb' : '#6b7280', background: newFinding.impact_category.includes(cat) ? '#eff6ff' : 'transparent' }}>{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Referanslar</label>
                <textarea value={newFinding.references_links} onChange={e => setNewFinding({...newFinding, references_links: e.target.value})}
                  placeholder="https://cve.mitre.org/...&#10;https://owasp.org/..."
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:56, fontFamily:'monospace' }} />
              </div>

              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Kapanış Notu</label>
                <textarea value={newFinding.closure_note} onChange={e => setNewFinding({...newFinding, closure_note: e.target.value})}
                  placeholder="Bulgu nasıl kapatıldı..."
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:56 }} />
              </div>

            </div>
            <div style={{ padding:'12px 20px', borderTop:'0.5px solid #e5e7eb', display:'flex', gap:8, justifyContent:'flex-end', flexShrink:0 }}>
              <button onClick={() => setShowNewFinding(false)} style={{ background:'transparent', border:'0.5px solid #e5e7eb', color:'#6b7280', padding:'7px 14px', borderRadius:6, fontSize:11, cursor:'pointer' }}>İptal</button>
              <button onClick={submitFinding} style={{ background:'#111', color:'#fff', border:'none', padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Finding Modal */}
      {showEditModal && editFinding && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:20, display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
          <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:10, width:520, maxWidth:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'16px 20px', borderBottom:'0.5px solid #e5e7eb', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:13, fontWeight:500 }}>Bulgu Düzenle</div>
              <span style={{ fontFamily:'monospace', fontSize:11, color:'#9ca3af', background:'#f3f4f6', padding:'3px 8px', borderRadius:4 }}>{editFinding.finding_id}</span>
            </div>
            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12, overflowY:'auto' }}>
              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Başlık</label>
                <input type="text" value={editFinding.title} onChange={e => setEditFinding({...editFinding, title: e.target.value})}
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Seviye</label>
                  <select value={editFinding.level} onChange={e => setEditFinding({...editFinding, level: e.target.value})}
                    style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none' }}>
                    <option value="kritik">Kritik</option>
                    <option value="yuksek">Yüksek</option>
                    <option value="orta">Orta</option>
                    <option value="dusuk">Düşük</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Durum</label>
                  <select value={editFinding.status} onChange={e => setEditFinding({...editFinding, status: e.target.value})}
                    style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none' }}>
                    <option value="acik">Açık</option>
                    <option value="devam">Devam Ediyor</option>
                    <option value="kapali">Kapatıldı</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>CVSS Skoru</label>
                <input type="number" value={editFinding.cvss_score || ''} onChange={e => setEditFinding({...editFinding, cvss_score: e.target.value})} min="0" max="10" step="0.1"
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Etki Alanı</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {['Network', 'Web', 'Mobile', 'API', 'Cloud', 'Active Directory', 'IoT', 'Other'].map(cat => (
                    <label key={cat} style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
                      <input type="checkbox" checked={editFinding.impact_category.includes(cat)}
                        onChange={e => {
                          if (e.target.checked) setEditFinding({...editFinding, impact_category: [...editFinding.impact_category, cat]})
                          else setEditFinding({...editFinding, impact_category: editFinding.impact_category.filter(c => c !== cat)})
                        }} />
                      <span style={{ fontSize:12, padding:'3px 8px', borderRadius:4, border:'0.5px solid #e5e7eb', color: editFinding.impact_category.includes(cat) ? '#2563eb' : '#6b7280', background: editFinding.impact_category.includes(cat) ? '#eff6ff' : 'transparent' }}>{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Referanslar</label>
                <textarea value={editFinding.references_links || ''} onChange={e => setEditFinding({...editFinding, references_links: e.target.value})}
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:56, fontFamily:'monospace' }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Kapanış Notu</label>
                <textarea value={editFinding.closure_note || ''} onChange={e => setEditFinding({...editFinding, closure_note: e.target.value})}
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:56 }} />
              </div>
            </div>
            <div style={{ padding:'12px 20px', borderTop:'0.5px solid #e5e7eb', display:'flex', gap:8, justifyContent:'flex-end', flexShrink:0 }}>
              <button onClick={() => setShowEditModal(false)} style={{ background:'transparent', border:'0.5px solid #e5e7eb', color:'#6b7280', padding:'7px 14px', borderRadius:6, fontSize:11, cursor:'pointer' }}>İptal</button>
              <button onClick={updateFinding} style={{ background:'#111', color:'#fff', border:'none', padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>Güncelle</button>
            </div>
          </div>
        </div>
      )}
{showEditModal && editFinding && (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:20, display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
    <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:10, width:520, maxWidth:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px 20px', borderBottom:'0.5px solid #e5e7eb', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:13, fontWeight:500 }}>Bulgu Düzenle</div>
        <span style={{ fontFamily:'monospace', fontSize:11, color:'#9ca3af', background:'#f3f4f6', padding:'3px 8px', borderRadius:4 }}>{editFinding.finding_id}</span>
      </div>
      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12, overflowY:'auto' }}>
        <div>
          <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Başlık</label>
          <input type="text" value={editFinding.title} onChange={e => setEditFinding({...editFinding, title: e.target.value})}
            style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box' }} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Seviye</label>
            <select value={editFinding.level} onChange={e => setEditFinding({...editFinding, level: e.target.value})}
              style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none' }}>
              <option value="kritik">Kritik</option>
              <option value="yuksek">Yüksek</option>
              <option value="orta">Orta</option>
              <option value="dusuk">Düşük</option>
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Durum</label>
            <select value={editFinding.status} onChange={e => setEditFinding({...editFinding, status: e.target.value})}
              style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none' }}>
              <option value="acik">Açık</option>
              <option value="devam">Devam Ediyor</option>
              <option value="kapali">Kapatıldı</option>
            </select>
          </div>
        </div>
        <div>
          <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>CVSS Skoru</label>
          <input type="number" value={editFinding.cvss_score || ''} onChange={e => setEditFinding({...editFinding, cvss_score: e.target.value})} min="0" max="10" step="0.1"
            style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box' }} />
        </div>
        <div>
          <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Etki Alanı</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {['Network', 'Web', 'Mobile', 'API', 'Cloud', 'Active Directory', 'IoT', 'Other'].map(cat => (
              <label key={cat} style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
                <input type="checkbox" checked={editFinding.impact_category.includes(cat)}
                  onChange={e => {
                    if (e.target.checked) setEditFinding({...editFinding, impact_category: [...editFinding.impact_category, cat]})
                    else setEditFinding({...editFinding, impact_category: editFinding.impact_category.filter(c => c !== cat)})
                  }} />
                <span style={{ fontSize:12, padding:'3px 8px', borderRadius:4, border:'0.5px solid #e5e7eb', color: editFinding.impact_category.includes(cat) ? '#2563eb' : '#6b7280', background: editFinding.impact_category.includes(cat) ? '#eff6ff' : 'transparent' }}>{cat}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Referanslar</label>
          <textarea value={editFinding.references_links || ''} onChange={e => setEditFinding({...editFinding, references_links: e.target.value})}
            style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:56, fontFamily:'monospace' }} />
        </div>
        <div>
          <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Kapanış Notu</label>
          <textarea value={editFinding.closure_note || ''} onChange={e => setEditFinding({...editFinding, closure_note: e.target.value})}
            style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:56 }} />
        </div>
      </div>
      <div style={{ padding:'12px 20px', borderTop:'0.5px solid #e5e7eb', display:'flex', gap:8, justifyContent:'flex-end', flexShrink:0 }}>
        <button onClick={() => setShowEditModal(false)} style={{ background:'transparent', border:'0.5px solid #e5e7eb', color:'#6b7280', padding:'7px 14px', borderRadius:6, fontSize:11, cursor:'pointer' }}>İptal</button>
        <button onClick={updateFinding} style={{ background:'#111', color:'#fff', border:'none', padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>Güncelle</button>
      </div>
    </div>
  </div>
)}
      {/* New Client Modal */}
      {showNewClient && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:20, display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
          <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:10, width:460, maxWidth:'100%' }}>
            <div style={{ padding:'16px 20px', borderBottom:'0.5px solid #e5e7eb' }}>
              <div style={{ fontSize:13, fontWeight:500 }}>Yeni Müşteri Ekle</div>
            </div>
            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
              {clientErrMsg && (
                <div style={{ background:'#fef2f2', border:'0.5px solid #fecaca', borderRadius:6, padding:'8px 12px', fontSize:12, color:'#dc2626' }}>{clientErrMsg}</div>
              )}
              {[['Şirket Adı', 'name', 'text'], ['Yetkili Adı', 'full_name', 'text'], ['E-posta', 'email', 'email'], ['Şifre', 'password', 'password']].map(([label, key, type]) => (
                <div key={key}>
                  <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>{label}</label>
                  <input type={type} value={newClient[key]} onChange={e => setNewClient({...newClient, [key]: e.target.value})}
                    style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ padding:'12px 20px', borderTop:'0.5px solid #e5e7eb', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => { setShowNewClient(false); setClientErrMsg('') }} style={{ background:'transparent', border:'0.5px solid #e5e7eb', color:'#6b7280', padding:'7px 14px', borderRadius:6, fontSize:11, cursor:'pointer' }}>İptal</button>
              <button onClick={submitClient} disabled={savingClient} style={{ background:'#111', color:'#fff', border:'none', padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor: savingClient ? 'not-allowed' : 'pointer', opacity: savingClient ? 0.7 : 1 }}>
                {savingClient ? 'Ekleniyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
