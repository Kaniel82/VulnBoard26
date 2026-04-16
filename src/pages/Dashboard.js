import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

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
  return <span style={{ ...styles[type], display:'inline-block', padding:'3px 10px', borderRadius:5, fontSize:12, fontWeight:500, fontFamily:'monospace' }}>{label}</span>
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


const SuperAdminPage = ({ clients, fetchClients, supabaseUrl, supabaseKey }) => {
  const [activeTab, setActiveTab] = useState('pentest')
  const [form, setForm] = useState({ name:'', email:'', password:'', full_name:'' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pentestUsers, setPentestUsers] = useState([])
  const [editingClient, setEditingClient] = useState(null)
  const [editForm, setEditForm] = useState({ name:'', email:'' })

  useEffect(() => { fetchPentestUsers() }, [])

  const fetchPentestUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'pentest').order('created_at', { ascending: false })
    setPentestUsers(data || [])
  }

  const createUser = async (role) => {
    if (!form.email || !form.password || !form.full_name) {
      setError('Tüm alanları doldurun.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (role === 'client') {
        const { data: clientData, error: cErr } = await supabase
          .from('clients')
          .insert({ name: form.name || form.full_name, email: form.email })
          .select()
          .single()
        if (cErr) throw new Error(cErr.message)

        const res = await fetch(`${supabaseUrl}/functions/v1/bright-responder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({ email: form.email, password: form.password, full_name: form.full_name, company_id: clientData.id, role: 'client' })
        })
        const result = await res.json()
        if (result.error) throw new Error(result.error)
        if (fetchClients) fetchClients()
      } else {
        const res = await fetch(`${supabaseUrl}/functions/v1/bright-responder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({ email: form.email, password: form.password, full_name: form.full_name, company_id: null, role: 'pentest' })
        })
        const result = await res.json()
        if (result.error) throw new Error(result.error)
        fetchPentestUsers()
      }

      setSuccess(`${role === 'pentest' ? 'Pentest firması' : 'Müşteri'} başarıyla oluşturuldu!`)
      setForm({ name:'', email:'', password:'', full_name:'' })
    } catch(e) {
      setError(e.message)
    }
    setSaving(false)
  }

  const deleteClient = async (clientId, clientName) => {
    if (!window.confirm(`"${clientName}" silinsin mi?`)) return
    const { error } = await supabase.from('clients').delete().eq('id', clientId)
    if (!error) {
      setSuccess('Müşteri silindi!')
      if (fetchClients) fetchClients()
    } else {
      setError('Silme başarısız: ' + error.message)
    }
  }

  const deletePentest = async (profileId, name) => {
    if (!window.confirm(`"${name}" silinsin mi?`)) return
    const { error } = await supabase.from('profiles').delete().eq('id', profileId)
    if (!error) {
      setSuccess('Pentest firması silindi!')
      fetchPentestUsers()
    } else {
      setError('Silme başarısız: ' + error.message)
    }
  }

  const startEditClient = (client) => {
    setEditingClient(client.id)
    setEditForm({ name: client.name, email: client.email || '' })
  }

  const saveEditClient = async (clientId) => {
    const { error } = await supabase.from('clients').update({ name: editForm.name, email: editForm.email }).eq('id', clientId)
    if (!error) {
      setSuccess('Müşteri güncellendi!')
      setEditingClient(null)
      if (fetchClients) fetchClients()
    } else {
      setError('Güncelleme başarısız: ' + error.message)
    }
  }

  const btnStyle = (color) => ({ border:`0.5px solid ${color}33`, borderRadius:4, padding:'3px 8px', fontSize:10, cursor:'pointer', background:`${color}11`, color })

  return (
    <div style={{ flex:1, overflow:'auto', padding:'20px' }}>
      <div style={{ background:'#fef2f2', border:'0.5px solid #fecaca', borderRadius:8, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:16 }}>⚠️</span>
        <span style={{ fontSize:12, color:'#dc2626', fontWeight:500 }}>Super Admin Paneli — Sadece geliştirici erişimi</span>
      </div>

      <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:8, overflow:'hidden', marginBottom:16 }}>
        <div style={{ display:'flex', borderBottom:'0.5px solid #e5e7eb' }}>
          {[['pentest','🔐 Pentest Firması Ekle'],['client','👤 Müşteri Ekle']].map(([key, label]) => (
            <button key={key} onClick={() => { setActiveTab(key); setError(''); setSuccess('') }}
              style={{ flex:1, padding:'12px', fontSize:12, cursor:'pointer', background: activeTab===key?'#f3f4f6':'#fff', color: activeTab===key?'#111':'#6b7280', border:'none', fontWeight: activeTab===key?500:400, fontFamily:'sans-serif', borderBottom: activeTab===key?'2px solid #111':'2px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding:'20px' }}>
          {error && <div style={{ background:'#fef2f2', border:'0.5px solid #fecaca', borderRadius:6, padding:'8px 12px', fontSize:12, color:'#dc2626', marginBottom:12 }}>{error}</div>}
          {success && <div style={{ background:'#f0fdf4', border:'0.5px solid #bbf7d0', borderRadius:6, padding:'8px 12px', fontSize:12, color:'#16a34a', marginBottom:12 }}>{success}</div>}

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {activeTab === 'client' && (
              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Şirket Adı</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Şirket adı..."
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box' }} />
              </div>
            )}
            {[
              ['Yetkili / Tam Ad', 'full_name', 'text', 'Ad Soyad...'],
              ['E-posta', 'email', 'email', 'ornek@firma.com'],
              ['Şifre', 'password', 'password', '••••••••']
            ].map(([label, key, type, placeholder]) => (
              <div key={key}>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>{label}</label>
                <input type={type} value={form[key]} onChange={e => setForm({...form, [key]: e.target.value})} placeholder={placeholder}
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
          </div>

          <button onClick={() => createUser(activeTab)} disabled={saving}
            style={{ marginTop:16, background:'#111', color:'#fff', border:'none', padding:'9px 20px', borderRadius:6, fontSize:12, fontWeight:700, cursor: saving?'not-allowed':'pointer', opacity: saving?0.7:1, width:'100%', fontFamily:'sans-serif' }}>
            {saving ? 'Oluşturuluyor...' : `${activeTab === 'pentest' ? 'Pentest Firması' : 'Müşteri'} Oluştur`}
          </button>
        </div>
      </div>

      {/* Pentest Firmaları */}
      <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:8, padding:'16px', marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:500, color:'#111', marginBottom:12 }}>Pentest Firmaları ({pentestUsers.length})</div>
        {pentestUsers.length === 0 ? (
          <div style={{ fontSize:12, color:'#9ca3af', textAlign:'center', padding:12 }}>Henüz pentest firması yok.</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:'0.5px solid #e5e7eb' }}>
                {['Ad', 'Email', 'Kayıt', 'İşlem'].map(h => (
                  <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', fontWeight:400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pentestUsers.map(u => (
                <tr key={u.id} style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                  <td style={{ padding:'8px 10px', fontWeight:500, color:'#111' }}>{u.full_name}</td>
                  <td style={{ padding:'8px 10px', color:'#6b7280', fontSize:11 }}>{u.email}</td>
                  <td style={{ padding:'8px 10px', fontFamily:'monospace', fontSize:11, color:'#9ca3af' }}>{u.created_at?.slice(0,10)}</td>
                  <td style={{ padding:'8px 10px' }}>
                    <button onClick={() => deletePentest(u.id, u.full_name)} style={btnStyle('#dc2626')}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Müşteriler */}
      <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:8, padding:'16px' }}>
        <div style={{ fontSize:12, fontWeight:500, color:'#111', marginBottom:12 }}>Müşteriler ({clients.length})</div>
        {clients.length === 0 ? (
          <div style={{ fontSize:12, color:'#9ca3af', textAlign:'center', padding:12 }}>Henüz müşteri yok.</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:'0.5px solid #e5e7eb' }}>
                {['Şirket', 'Email', 'Kayıt', 'İşlem'].map(h => (
                  <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', fontWeight:400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} style={{ borderBottom:'0.5px solid #f3f4f6' }}>
                  <td style={{ padding:'8px 10px', fontWeight:500, color:'#111' }}>
                    {editingClient === c.id ? (
                      <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                        style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:4, padding:'4px 8px', fontSize:12, outline:'none', width:'120px' }} />
                    ) : c.name}
                  </td>
                  <td style={{ padding:'8px 10px', color:'#6b7280', fontSize:11 }}>
                    {editingClient === c.id ? (
                      <input value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})}
                        style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:4, padding:'4px 8px', fontSize:12, outline:'none', width:'160px' }} />
                    ) : c.email}
                  </td>
                  <td style={{ padding:'8px 10px', fontFamily:'monospace', fontSize:11, color:'#9ca3af' }}>{c.created_at?.slice(0,10)}</td>
                  <td style={{ padding:'8px 10px' }}>
                    {editingClient === c.id ? (
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => saveEditClient(c.id)} style={{ background:'#111', color:'#fff', border:'none', borderRadius:4, padding:'3px 8px', fontSize:10, cursor:'pointer' }}>✓ Kaydet</button>
                        <button onClick={() => setEditingClient(null)} style={{ background:'#f3f4f6', color:'#374151', border:'0.5px solid #e5e7eb', borderRadius:4, padding:'3px 8px', fontSize:10, cursor:'pointer' }}>İptal</button>
                      </div>
                    ) : (
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => startEditClient(c)} style={btnStyle('#374151')}>✏️</button>
                        <button onClick={() => deleteClient(c.id, c.name)} style={btnStyle('#dc2626')}>🗑️</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}


const ReportsPage = ({ profile, clients, findings, isPentest }) => {
  const [selectedClient, setSelectedClient] = useState('')
  const [generating, setGenerating] = useState(false)
  const [reportType, setReportType] = useState('pdf')
  const [generatedReports, setGeneratedReports] = useState([])

  const clientFindings = selectedClient
    ? findings.filter(f => f.client_id === selectedClient)
    : isPentest ? findings : findings

  const clientName = clients.find(c => c.id === selectedClient)?.name || 'Tüm Müşteriler'

  const stats = {
    total: clientFindings.length,
    critical: clientFindings.filter(f => f.level === 'kritik').length,
    high: clientFindings.filter(f => f.level === 'yuksek').length,
    medium: clientFindings.filter(f => f.level === 'orta').length,
    low: clientFindings.filter(f => f.level === 'dusuk').length,
    closed: clientFindings.filter(f => f.status === 'kapali').length,
  }

  const slaScore = stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0

  const generatePDF = () => {
    const doc = new jsPDF()
    const date = new Date().toLocaleDateString('tr-TR')

    // Header
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('VulnBoard', 14, 20)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(128, 128, 128)
    doc.text('Penetration Test Report', 14, 27)
    doc.text(`Tarih: ${date}`, 140, 20)
    doc.text(`Müşteri: ${clientName}`, 140, 27)
    doc.setTextColor(0, 0, 0)

    // Line
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(14, 32, 196, 32)

    // Executive Summary
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Executive Summary', 14, 42)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const summary = `${clientName} için gerçekleştirilen penetrasyon testi kapsamında ${stats.total} adet güvenlik açığı tespit edilmiştir. Bulgular arasında ${stats.critical} kritik, ${stats.high} yüksek, ${stats.medium} orta ve ${stats.low} düşük seviyeli zafiyet bulunmaktadır. Toplam bulgular içinde ${stats.closed} adet (${slaScore}%) kapatılmıştır.`
    const lines = doc.splitTextToSize(summary, 180)
    doc.text(lines, 14, 50)

    // Stats table
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Özet İstatistikler', 14, 72)
    autoTable(doc, {
      startY: 76,
      head: [['Toplam', 'Kritik', 'Yüksek', 'Orta', 'Düşük', 'Kapatıldı']],
      body: [[stats.total, stats.critical, stats.high, stats.medium, stats.low, stats.closed]],
      styles: { fontSize: 10, halign: 'center' },
      headStyles: { fillColor: [17, 17, 17] },
      margin: { left: 14 }
    })

    // Findings table
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    const y1 = doc.lastAutoTable.finalY + 10
    doc.text('Bulgular', 14, y1)
    
    const levelMap = { kritik:'Kritik', yuksek:'Yüksek', orta:'Orta', dusuk:'Düşük' }
    const statusMap = { acik:'Açık', devam:'Devam', kapali:'Kapatıldı' }

    autoTable(doc, {
      startY: y1 + 4,
      head: [['ID', 'Başlık', 'Seviye', 'CVSS', 'Durum', 'Etki Alanı']],
      body: clientFindings.map(f => [
        f.finding_id || '-',
        f.title,
        levelMap[f.level] || f.level,
        f.cvss_score || '-',
        statusMap[f.status] || f.status,
        f.impact_category || '-'
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [17, 17, 17] },
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 60 }, 2: { cellWidth: 20 }, 3: { cellWidth: 15 }, 4: { cellWidth: 20 } },
      margin: { left: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const level = clientFindings[data.row.index]?.level
          if (level === 'kritik') data.cell.styles.textColor = [220, 38, 38]
          else if (level === 'yuksek') data.cell.styles.textColor = [234, 88, 12]
          else if (level === 'orta') data.cell.styles.textColor = [202, 138, 4]
          else if (level === 'dusuk') data.cell.styles.textColor = [22, 163, 74]
        }
      }
    })

    // Tavsiyeler
    let currentY = doc.lastAutoTable.finalY + 10
    const findingsWithRec = clientFindings.filter(f => f.recommendation)
    if (findingsWithRec.length > 0) {
      if (currentY > 250) { doc.addPage(); currentY = 20 }
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Tavsiyeler', 14, currentY)
      currentY += 6
      findingsWithRec.forEach(f => {
        if (currentY > 260) { doc.addPage(); currentY = 20 }
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(`${f.finding_id} - ${f.title}`, 14, currentY)
        currentY += 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        const recLines = doc.splitTextToSize(f.recommendation, 180)
        doc.text(recLines, 14, currentY)
        currentY += recLines.length * 5 + 4
      })
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text(`VulnBoard // Gizli`, 14, 290)
      doc.text(`${i}/${pageCount}`, 100, 290)
      doc.text(`vulnboard.com`, 160, 290)
    }

    doc.save(`${clientName}-pentest-raporu-${date.replace(/\./g,'-')}.pdf`)
  }

  const generateExcel = () => {
    const wb = XLSX.utils.book_new()
    const levelMap = { kritik:'Kritik', yuksek:'Yüksek', orta:'Orta', dusuk:'Düşük' }
    const statusMap = { acik:'Açık', devam:'Devam', kapali:'Kapatıldı' }

    // Bulgular sheet
    const findingsData = [
      ['ID', 'Başlık', 'Seviye', 'CVSS', 'Durum', 'Etki Alanı', 'Tavsiye', 'Referanslar', 'Kapanış Notu', 'Tarih'],
      ...clientFindings.map(f => [
        f.finding_id || '-',
        f.title,
        levelMap[f.level] || f.level,
        f.cvss_score || '-',
        statusMap[f.status] || f.status,
        f.impact_category || '-',
        f.recommendation || '-',
        f.references_links || '-',
        f.closure_note || '-',
        f.created_at?.slice(0,10) || '-'
      ])
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(findingsData)
    ws1['!cols'] = [
      {wch:10},{wch:40},{wch:10},{wch:8},{wch:12},{wch:20},{wch:40},{wch:30},{wch:30},{wch:12}
    ]
    XLSX.utils.book_append_sheet(wb, ws1, 'Bulgular')

    // Özet sheet
    const summaryData = [
      ['VulnBoard - Pentest Raporu'],
      ['Müşteri', clientName],
      ['Tarih', new Date().toLocaleDateString('tr-TR')],
      [''],
      ['İstatistikler', ''],
      ['Toplam Bulgu', stats.total],
      ['Kritik', stats.critical],
      ['Yüksek', stats.high],
      ['Orta', stats.medium],
      ['Düşük', stats.low],
      ['Kapatıldı', stats.closed],
      ['SLA Performansı', `${slaScore}%`],
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData)
    ws2['!cols'] = [{wch:20},{wch:30}]
    XLSX.utils.book_append_sheet(wb, ws2, 'Özet')

    XLSX.writeFile(wb, `${clientName}-pentest-raporu-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const generateReport = () => {
    setGenerating(true)
    try {
      if (reportType === 'pdf') {
        generatePDF()
      } else {
        generateExcel()
      }
      const report = {
        id: Date.now(),
        title: `${clientName} - Pentest Raporu`,
        date: new Date().toISOString().slice(0,10),
        format: reportType,
        findings: clientFindings.length
      }
      setGeneratedReports(prev => [report, ...prev])
    } catch(e) {
      alert('Rapor oluşturma hatası: ' + e.message)
    }
    setGenerating(false)
  }

  const levelLabel = { kritik:'Kritik', yuksek:'Yüksek', orta:'Orta', dusuk:'Düşük' }
  const statusLabel = { acik:'Açık', devam:'Devam', kapali:'Kapatıldı' }
  const levelColor = { kritik:'#dc2626', yuksek:'#ea580c', orta:'#ca8a04', dusuk:'#16a34a' }

  return (
    <div style={{ flex:1, overflow:'auto', padding:'20px' }}>
      {isPentest && (
        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:8, padding:'16px', marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:500, color:'#111', marginBottom:12 }}>Rapor Oluştur</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, alignItems:'end' }}>
            <div>
              <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Müşteri</label>
              <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none' }}>
                <option value="">Tüm Müşteriler</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Format</label>
              <div style={{ display:'flex', border:'0.5px solid #e5e7eb', borderRadius:6, overflow:'hidden' }}>
                {['pdf','excel'].map(f => (
                  <button key={f} onClick={() => setReportType(f)}
                    style={{ flex:1, padding:'7px', fontSize:11, cursor:'pointer', background: reportType===f?'#111':'#fff', color: reportType===f?'#fff':'#6b7280', border:'none', fontFamily:'sans-serif' }}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={generateReport} disabled={generating}
              style={{ background:'#111', color:'#fff', border:'none', padding:'7px 16px', borderRadius:6, fontSize:11, fontWeight:700, cursor: generating?'not-allowed':'pointer', opacity: generating?0.7:1, whiteSpace:'nowrap' }}>
              {generating ? 'Oluşturuluyor...' : '📄 Rapor Oluştur'}
            </button>
          </div>
        </div>
      )}

      {/* Rapor Önizleme */}
      <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:8, padding:'24px', marginBottom:16 }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingBottom:16, borderBottom:'2px solid #111', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:'#111' }}>VulnBoard</div>
            <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>Penetration Test Report</div>
          </div>
          <div style={{ textAlign:'right', fontSize:10, color:'#9ca3af', fontFamily:'monospace', lineHeight:1.8 }}>
            <div>Tarih: {new Date().toLocaleDateString('tr-TR')}</div>
            <div>Müşteri: {clientName}</div>
            <div>Gizlilik: Müşteriye Özel</div>
          </div>
        </div>

        {/* Executive Summary */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:500, color:'#111', textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:'monospace', marginBottom:8, paddingBottom:4, borderBottom:'0.5px solid #e5e7eb' }}>Executive Summary</div>
          <div style={{ fontSize:13, color:'#374151', lineHeight:1.7 }}>
            {clientName} için gerçekleştirilen penetrasyon testi kapsamında <strong>{stats.total} adet güvenlik açığı</strong> tespit edilmiştir.
            Bulgular arasında {stats.critical} kritik, {stats.high} yüksek, {stats.medium} orta ve {stats.low} düşük seviyeli zafiyet bulunmaktadır.
            Toplam bulgular içinde <strong>{stats.closed} adet ({slaScore}%)</strong> kapatılmıştır.
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:16 }}>
          {[['Toplam','#111',stats.total],['Kritik','#dc2626',stats.critical],['Yüksek','#ea580c',stats.high],['Orta','#ca8a04',stats.medium],['Kapatıldı','#16a34a',stats.closed]].map(([l,c,v]) => (
            <div key={l} style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'10px', textAlign:'center' }}>
              <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace', color:c }}>{v}</div>
              <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>

        {/* SLA */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:500, color:'#111', textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:'monospace', marginBottom:8, paddingBottom:4, borderBottom:'0.5px solid #e5e7eb' }}>SLA Performansı</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {[
              { label:'Kritik', target:'24 saat', closed: clientFindings.filter(f=>f.level==='kritik'&&f.status==='kapali').length, total: clientFindings.filter(f=>f.level==='kritik').length },
              { label:'Yüksek', target:'7 gün',   closed: clientFindings.filter(f=>f.level==='yuksek'&&f.status==='kapali').length, total: clientFindings.filter(f=>f.level==='yuksek').length },
              { label:'Orta',   target:'30 gün',  closed: clientFindings.filter(f=>f.level==='orta'&&f.status==='kapali').length,   total: clientFindings.filter(f=>f.level==='orta').length },
            ].map(item => {
              const rate = item.total > 0 ? Math.round((item.closed/item.total)*100) : 0
              const color = rate>=80?'#16a34a':rate>=50?'#ca8a04':'#dc2626'
              return (
                <div key={item.label} style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'10px' }}>
                  <div style={{ fontSize:11, color:'#374151', marginBottom:2 }}>{item.label} — {item.target}</div>
                  <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace', color, marginBottom:4 }}>{rate}%</div>
                  <div style={{ height:5, background:'#e5e7eb', borderRadius:3 }}>
                    <div style={{ height:'100%', width:`${rate}%`, background:color, borderRadius:3 }} />
                  </div>
                  <div style={{ fontSize:10, color:'#9ca3af', marginTop:3, fontFamily:'monospace' }}>{item.closed}/{item.total}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bulgular */}
        <div>
          <div style={{ fontSize:11, fontWeight:500, color:'#111', textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:'monospace', marginBottom:8, paddingBottom:4, borderBottom:'0.5px solid #e5e7eb' }}>Bulgular</div>
          {clientFindings.length === 0 ? (
            <div style={{ fontSize:12, color:'#9ca3af', textAlign:'center', padding:20 }}>Bulgu bulunamadı.</div>
          ) : clientFindings.map(f => (
            <div key={f.id} style={{ background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'12px', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ fontFamily:'monospace', fontSize:10, color:'#9ca3af' }}>{f.finding_id}</span>
                <span style={{ fontSize:11, fontWeight:500, color:'#111' }}>{f.title}</span>
                <span style={{ marginLeft:'auto', fontSize:10, fontFamily:'monospace', fontWeight:500, color: levelColor[f.level] }}>CVSS {f.cvss_score || '-'}</span>
              </div>
              <div style={{ display:'flex', gap:6, marginBottom: f.recommendation ? 8 : 0 }}>
                <span style={{ fontSize:10, fontFamily:'monospace', padding:'2px 6px', borderRadius:4, background:'#fef2f2', color: levelColor[f.level], border:`0.5px solid ${levelColor[f.level]}33` }}>{levelLabel[f.level]}</span>
                <span style={{ fontSize:10, fontFamily:'monospace', padding:'2px 6px', borderRadius:4, background:'#f3f4f6', color:'#374151' }}>{statusLabel[f.status]}</span>
                {f.impact_category && <span style={{ fontSize:10, fontFamily:'monospace', padding:'2px 6px', borderRadius:4, background:'#eff6ff', color:'#2563eb' }}>{f.impact_category}</span>}
              </div>
              {f.recommendation && (
                <div style={{ marginTop:6, padding:'8px', background:'#f0fdf4', border:'0.5px solid #bbf7d0', borderRadius:4 }}>
                  <div style={{ fontSize:10, color:'#16a34a', fontFamily:'monospace', marginBottom:3 }}>TAVSİYE</div>
                  <div style={{ fontSize:11, color:'#374151', lineHeight:1.5 }}>{f.recommendation}</div>
                </div>
              )}
              {f.references_links && (
                <div style={{ marginTop:6, padding:'8px', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:4 }}>
                  <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', marginBottom:3 }}>REFERANSLAR</div>
                  <div style={{ fontSize:11, color:'#2563eb', fontFamily:'monospace', whiteSpace:'pre-wrap' }}>{f.references_links}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop:16, paddingTop:12, borderTop:'0.5px solid #e5e7eb', display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af', fontFamily:'monospace' }}>
          <span>VulnBoard // Gizli</span>
          <span>{new Date().toLocaleDateString('tr-TR')}</span>
          <span>vulnboard.com</span>
        </div>
      </div>

      {/* Oluşturulan Raporlar */}
      {generatedReports.length > 0 && (
        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:8, padding:'16px' }}>
          <div style={{ fontSize:12, fontWeight:500, color:'#111', marginBottom:12 }}>Oluşturulan Raporlar</div>
          {generatedReports.map(r => (
            <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, marginBottom:8 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:500, color:'#111' }}>{r.title}</div>
                <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace' }}>{r.date} · {r.findings} bulgu · {r.format.toUpperCase()}</div>
              </div>
              <button style={{ background:'#111', color:'#fff', border:'none', padding:'5px 12px', borderRadius:6, fontSize:11, cursor:'pointer' }}>
                ⬇ İndir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
export default function Dashboard({ profile, onLogout }) {
  const [findings, setFindings] = useState([])
  const [comments, setComments] = useState({})
  const [selectedFinding, setSelectedFinding] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [commentName, setCommentName] = useState(profile?.full_name || '')
  const [showModal, setShowModal] = useState(false)
  const [editFinding, setEditFinding] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
      const [showNewFinding, setShowNewFinding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importData, setImportData] = useState([])
  const [importSource, setImportSource] = useState('')
  const [importClientId, setImportClientId] = useState('')
  const [importing, setImporting] = useState(false)
  const [showNewClient, setShowNewClient] = useState(false)
  const [activePage, setActivePage] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState([])
  const [savingClient, setSavingClient] = useState(false)
  const [clientErrMsg, setClientErrMsg] = useState('')
  const [newFinding, setNewFinding] = useState({ title:'', level:'kritik', status:'acik', cvss_score:'', impact_area:'', impact_category:[], references_links:'', closure_note:'', recommendation:'', poc:'', description:'', observation:'', technical_details:'', client_id:'' })
  const [newClient, setNewClient] = useState({ name:'', email:'', password:'', full_name:'' })
  const [cvssParams, setCvssParams] = useState({ av:'0.85', ac:'0.77', pr:'0.85', ui:'0.85', c:'0.56', i:'0.56' })

  const isPentest = profile?.role === 'pentest' || profile?.role === 'superadmin'
  const isSuperAdmin = profile?.role === 'superadmin'
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
    setEditFinding({ ...finding, impact_category: finding.impact_category ? finding.impact_category.split(', ') : [], recommendation: finding.recommendation || '', poc: finding.poc || '', description: finding.description || '', observation: finding.observation || '', technical_details: finding.technical_details || '' })
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
      recommendation: editFinding.recommendation,
      poc: editFinding.poc,
      description: editFinding.description,
      observation: editFinding.observation,
      technical_details: editFinding.technical_details,
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


  const detectSource = (headers) => {
    const h = headers.map(x => x.toLowerCase())
    if (h.includes('plugin id') || h.includes('plugin name')) return 'nessus'
    if (h.includes('vulnerability id') || h.includes('nexpose id')) return 'nexpose'
    if (h.includes('qid') || h.includes('qualys')) return 'qualys'
    return 'generic'
  }

  const parseCSV = (text) => {
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
    const rows = lines.slice(1).map(line => {
      const vals = []
      let cur = ''
      let inQuotes = false
      for (let c of line) {
        if (c === '"') inQuotes = !inQuotes
        else if (c === ',' && !inQuotes) { vals.push(cur.trim()); cur = '' }
        else cur += c
      }
      vals.push(cur.trim())
      const obj = {}
      headers.forEach((h, i) => obj[h] = vals[i] || '')
      return obj
    })
    return { headers, rows }
  }

  const mapToFinding = (row, source) => {
    const h = Object.keys(row).map(k => k.toLowerCase())
    const get = (keys) => {
      for (let k of keys) {
        const found = Object.keys(row).find(rk => rk.toLowerCase().includes(k))
        if (found && row[found]) return row[found]
      }
      return ''
    }

    const riskToLevel = (risk) => {
      const r = (risk || '').toLowerCase()
      if (r.includes('critical') || r === '4') return 'kritik'
      if (r.includes('high') || r === '3') return 'yuksek'
      if (r.includes('medium') || r === '2') return 'orta'
      return 'dusuk'
    }

    const cvss = parseFloat(get(['cvss', 'cvss base', 'cvss score', 'cvss_base'])) || null
    const level = cvss >= 9 ? 'kritik' : cvss >= 7 ? 'yuksek' : cvss >= 4 ? 'orta' : 'dusuk'

    return {
      title: get(['name', 'title', 'vulnerability title', 'plugin name', 'vuln name']) || 'İsimsiz Bulgu',
      level: riskToLevel(get(['risk', 'severity', 'risk factor'])) || level || 'orta',
      status: 'acik',
      cvss_score: cvss,
      description: get(['description', 'synopsis', 'vuln description']).slice(0, 500),
      recommendation: get(['solution', 'remediation', 'fix']).slice(0, 500),
      references_links: get(['cve', 'cve id', 'references', 'see also']),
      impact_category: get(['protocol', 'category', 'family', 'plugin family']) || 'Network',
      technical_details: get(['plugin output', 'proof', 'technical details', 'output']).slice(0, 500),
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const text = evt.target.result
        const { headers, rows } = parseCSV(text)
        const source = detectSource(headers)
        setImportSource(source)
        const mapped = rows.filter(r => Object.values(r).some(v => v)).map(r => mapToFinding(r, source))
        setImportData(mapped)
      } catch(err) {
        alert('CSV okunamadı: ' + err.message)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const executeImport = async () => {
    if (!importData.length) return
    setImporting(true)
    let success = 0
    for (let i = 0; i < importData.length; i++) {
      const finding = importData[i]
      const findingId = 'VULN-' + Date.now().toString().slice(-6) + i
      const { error } = await supabase.from('findings').insert({
        ...finding,
        finding_id: findingId,
        client_id: importClientId || null,
      })
      if (!error) success++
      await new Promise(r => setTimeout(r, 50))
    }
    setImporting(false)
    setShowImport(false)
    setImportData([])
    fetchFindings()
    alert(`${success}/${importData.length} bulgu başarıyla içe aktarıldı!`)
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
    setNewFinding({ title:'', level:'kritik', status:'acik', cvss_score:'', impact_area:'', impact_category:[], references_links:'', closure_note:'', recommendation:'', poc:'', description:'', observation:'', technical_details:'', client_id:'' })
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
    { key: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { key: 'findings', label: isPentest ? 'Tüm Bulgular' : 'Bulgularım', icon: '🛡️' },
    { key: 'clients', label: 'Müşteriler', icon: '👥' },
    { key: 'reports', label: 'Raporlar', icon: '📄' },
    { key: 'superadmin', label: 'Super Admin', icon: '⚙️' },
  ]

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:'sans-serif', background:'#f5f5f5' }}>
      <div style={{ width:220, background:'#7f1d1d', borderRight:'none', boxShadow:'2px 0 12px rgba(0,0,0,0.2)', display:'flex', flexDirection:'column', padding:'20px 0', flexShrink:0 }}>
        <div style={{ padding:'0 18px 16px', borderBottom:'1px solid rgba(255,255,255,0.15)', marginBottom:12 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>VulnBoard</div>
          <span style={{ fontSize:9, fontFamily:'monospace', padding:'2px 6px', borderRadius:4, marginTop:4, display:'inline-block', ...(isPentest ? { background:'rgba(255,255,255,0.2)', color:'#fff', border:'1px solid rgba(255,255,255,0.4)' } : { background:'rgba(255,255,255,0.2)', color:'#fff', border:'1px solid rgba(255,255,255,0.4)' }) }}>
            {isPentest ? 'Pentest Paneli' : 'Müşteri Paneli'}
          </span>
        </div>
        {navItems.map(item => {
          if (item.key === 'clients' && !isPentest) return null
          if (item.key === 'superadmin' && !isSuperAdmin) return null
          return (
            <div key={item.key} onClick={() => setActivePage(item.key)}
              style={{ display:'flex', alignItems:'center', gap:9, padding:'0', fontSize:12, color: activePage===item.key ? '#fff' : 'rgba(255,255,255,0.65)', background: activePage===item.key ? 'rgba(255,255,255,0.18)' : 'transparent', borderLeft: 'none', cursor:'pointer', borderRadius:8, margin:'2px 10px', padding:'10px 14px' }}>
              <span style={{ fontSize:14, width:18, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          )
        })}
        <div style={{ marginTop:'auto', padding:'0 18px' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginBottom:8, fontFamily:'monospace' }}>{profile?.email}</div>
          <button onClick={onLogout} style={{ width:'100%', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:6, padding:8, fontSize:11, color:'#fff', cursor:'pointer' }}>Çıkış Yap</button>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'12px 24px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#7f1d1d', flexShrink:0, minHeight:56 }}>
          <div style={{ fontSize:14, fontWeight:500 }}>
            {activePage === 'dashboard' && 'Dashboard'}
            {activePage === 'findings' && (isPentest ? 'Tüm Bulgular' : 'Bulgularım')}
            {activePage === 'clients' && 'Müşteriler'}
            {activePage === 'reports' && 'Raporlar'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {isPentest && (activePage === 'findings' || activePage === 'dashboard') && (
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setShowImport(true)} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)', padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>⬆ CSV Import</button>
                <button onClick={() => setShowNewFinding(true)} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)', padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>+ Yeni Bulgu</button>
              </div>
            )}
            {isPentest && activePage === 'clients' && (
              <button onClick={() => setShowNewClient(true)} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)', padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', backdropFilter:'blur(4px)' }}>+ Yeni Müşteri</button>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:20, padding:'4px 10px 4px 4px', backdropFilter:'blur(4px)' }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background: isPentest ? '#dc2626' : '#2563eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', fontWeight:700 }}>
                {(profile?.full_name || '?').slice(0,2).toUpperCase()}
              </div>
              <span style={{ fontSize:11, color:'#fff' }}>{profile?.full_name}</span>
            </div>
          </div>
        </div>


        {activePage === 'dashboard' && (
          <div style={{ flex:1, overflow:'auto', padding:'24px', background:'#f5f5f5' }}>

            {/* Row 1 — Main Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:16, marginBottom:16, alignItems:'stretch' }}>

              {/* Critical Vulnerabilities — Big Card */}
              <div style={{ background:'#fff', borderRadius:12, padding:'24px 28px', color:'#111', position:'relative', overflow:'hidden', border:'1px solid #e5e7eb' }}>
                <div style={{ position:'absolute', top:0, right:0, width:120, height:120, background:'rgba(220,38,38,0.04)', borderRadius:'50%', transform:'translate(30px,-30px)' }} />
                <div style={{ fontSize:11, fontWeight:600, color:'#dc2626', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6 }}>KRİTİK ZAFİYETLER</div>
                <div style={{ fontSize:11, color:'#6b7280', marginBottom:16 }}>Acil müdahale gerekli — SLA: 24 saat</div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:16, marginBottom:20 }}>
                  <div style={{ fontSize:64, fontWeight:800, lineHeight:1, color:'#111', fontFamily:'sans-serif' }}>{stats.critical}</div>
                  <div style={{ paddingBottom:8 }}>
                    <div style={{ fontSize:13, color:'#9ca3af', marginBottom:4 }}>açık</div>
                    {findings.filter(f=>f.level==='kritik'&&f.status!=='kapali').length > 0 && (
                      <div style={{ fontSize:11, color:'#dc2626', display:'flex', alignItems:'center', gap:4 }}>
                        ⚠ {findings.filter(f=>f.level==='kritik'&&f.status!=='kapali').length} SLA ihlali riski
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, borderTop:'1px solid #f3f4f6', paddingTop:16 }}>
                  {[
                    { label:'YÜKSEK', val: findings.filter(f=>f.level==='yuksek').length, color:'#f97316' },
                    { label:'ORTA', val: findings.filter(f=>f.level==='orta').length, color:'#eab308' },
                    { label:'DÜŞÜK', val: findings.filter(f=>f.level==='dusuk').length, color:'#22c55e' },
                    { label:'TOPLAM AÇIK', val: stats.open, color:'#94a3b8' },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize:22, fontWeight:800, fontFamily:'monospace', color:item.color }}>{item.val}</div>
                      <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:2 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SLA Compliance */}
              <div style={{ background:'#fff', borderRadius:12, padding:'24px', border:'1px solid #e5e7eb', display:'flex', flexDirection:'column' }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6 }}>SLA UYUM</div>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:20 }}>Hedef: %95</div>
                {(() => {
                  const rate = findings.length > 0 ? Math.round((stats.closed/findings.length)*100) : 0
                  const color = rate >= 80 ? '#16a34a' : rate >= 50 ? '#ca8a04' : '#dc2626'
                  return (
                    <>
                      <div style={{ fontSize:52, fontWeight:800, color, lineHeight:1, marginBottom:16, fontFamily:'sans-serif' }}>{rate}%</div>
                      <div style={{ height:6, background:'#f3f4f6', borderRadius:3, marginBottom:8, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${rate}%`, background:color, borderRadius:3, transition:'width 0.5s' }} />
                      </div>
                      <div style={{ fontSize:11, color: rate < 95 ? '#dc2626' : '#16a34a', display:'flex', alignItems:'center', gap:4 }}>
                        {rate < 95 ? `↘ Hedefin ${95-rate}% altında` : '↗ Hedef karşılandı'}
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* SLA Breaches */}
              <div style={{ background:'#fff', borderRadius:12, padding:'24px', border:'1px solid #e5e7eb', display:'flex', flexDirection:'column' }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6 }}>SLA İHLALİ</div>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:20 }}>SLA süresi aşıldı</div>
                {(() => {
                  const breaches = findings.filter(f => (f.level==='kritik'||f.level==='yuksek') && f.status!=='kapali').length
                  return (
                    <>
                      <div style={{ fontSize:52, fontWeight:800, color: breaches>0?'#dc2626':'#16a34a', lineHeight:1, marginBottom:16, fontFamily:'sans-serif' }}>{breaches}</div>
                      <div style={{ fontSize:11, color:'#dc2626' }}>
                        {breaches > 0 ? `${breaches} bulgu risk altında` : '✓ İhlal yok'}
                      </div>
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>48 saat içinde</div>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* Row 2 — MTTR, At Risk, Avg Aging */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:16, alignItems:'stretch' }}>
              {(() => {
                const openFindings = findings.filter(f => f.status !== 'kapali')
                const closedFindings = findings.filter(f => f.status === 'kapali')
                const mttr = closedFindings.length > 0
                  ? Math.round(closedFindings.reduce((acc,f) => acc + (new Date()-new Date(f.created_at))/(1000*60*60*24), 0) / closedFindings.length)
                  : 0
                const atRisk = findings.filter(f=>(f.level==='kritik'||f.level==='yuksek')&&f.status!=='kapali').length
                const avgAging = openFindings.length > 0
                  ? Math.round(openFindings.reduce((acc,f) => acc + (new Date()-new Date(f.created_at))/(1000*60*60*24), 0) / openFindings.length)
                  : 0

                return [
                  { label:'ORT. MTTR', value: mttr, unit:'gün', sub:'Ortalama düzeltme süresi', color:'#7c3aed', trend: mttr > 7 ? '↗ Yüksek' : '↘ İyi', trendColor: mttr > 7 ? '#dc2626' : '#16a34a' },
                  { label:'RİSK ALTINDA', value: atRisk, unit:'', sub:'48 saat içinde ihlal', color: atRisk>0?'#dc2626':'#16a34a', trend: atRisk>0?'Acil müdahale':'✓ Güvende', trendColor: atRisk>0?'#dc2626':'#16a34a' },
                  { label:'ORT. AÇIK KALMA', value: avgAging, unit:'gün', sub:'Tüm açık bulgular', color: avgAging>14?'#dc2626':avgAging>7?'#ca8a04':'#16a34a', trend: avgAging>14?'↗ Kritik seviye':'↘ Normal', trendColor: avgAging>14?'#dc2626':'#16a34a' },
                ].map((item,i) => (
                  <div key={i} style={{ background:'#fff', borderRadius:12, padding:'24px', border:'1px solid #e5e7eb' }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6 }}>{item.label}</div>
                    <div style={{ fontSize:11, color:'#9ca3af', marginBottom:16 }}>{item.sub}</div>
                    <div style={{ display:'flex', alignItems:'flex-end', gap:6, marginBottom:12 }}>
                      <div style={{ fontSize:48, fontWeight:800, color:item.color, lineHeight:1, fontFamily:'sans-serif' }}>{item.value}</div>
                      {item.unit && <div style={{ fontSize:16, color:'#9ca3af', paddingBottom:6 }}>{item.unit}</div>}
                    </div>
                    <div style={{ fontSize:11, color:item.trendColor, fontWeight:500 }}>{item.trend}</div>
                  </div>
                ))
              })()}
            </div>

            {/* Row 3 — Charts */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

              {/* Severity Distribution */}
              <div style={{ background:'#fff', borderRadius:12, padding:'24px', border:'1px solid #e5e7eb' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:4 }}>Zafiyet Dağılımı</div>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:20 }}>Seviyeye göre açık bulgular</div>
                <div style={{ display:'flex', gap:24, alignItems:'center' }}>
                  <div style={{ position:'relative', width:130, height:130, flexShrink:0 }}>
                  <svg viewBox="0 0 36 36" style={{ width:130, height:130, transform:'rotate(-90deg)', position:'absolute', top:0, left:0 }}>
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
                    {(() => {
                      const total = findings.length || 1
                      const segs = [
                        { count: findings.filter(f=>f.level==='kritik').length, color:'#dc2626' },
                        { count: findings.filter(f=>f.level==='yuksek').length, color:'#f97316' },
                        { count: findings.filter(f=>f.level==='orta').length, color:'#eab308' },
                        { count: findings.filter(f=>f.level==='dusuk').length, color:'#22c55e' },
                      ]
                      const r = 15.9155
                      const circ = 2 * Math.PI * r
                      let offset = 0
                      return segs.map((seg,i) => {
                        const pct = seg.count/total
                        const dash = pct*circ
                        const gap = circ-dash
                        const el = <circle key={i} cx="18" cy="18" r={r} fill="none" stroke={seg.color} strokeWidth="3.5" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset*circ} />
                        offset += pct
                        return el
                      })
                    })()}
                  </svg>
                  <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
                    <div style={{ fontSize:18, fontWeight:800, color:'#111' }}>{findings.length}</div>
                    <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase' }}>toplam</div>
                  </div>
                  </div>
                  <div style={{ flex:1 }}>
                    {[
                      { label:'Kritik', color:'#dc2626', count: findings.filter(f=>f.level==='kritik').length },
                      { label:'Yüksek', color:'#f97316', count: findings.filter(f=>f.level==='yuksek').length },
                      { label:'Orta', color:'#eab308', count: findings.filter(f=>f.level==='orta').length },
                      { label:'Düşük', color:'#22c55e', count: findings.filter(f=>f.level==='dusuk').length },
                    ].map(s => (
                      <div key={s.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }} />
                          <span style={{ fontSize:13, color:'#374151' }}>{s.label}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:80, height:6, background:'#f3f4f6', borderRadius:3, overflow:'hidden' }}>
                            <div style={{ height:'100%', width: findings.length ? `${(s.count/findings.length)*100}%` : '0%', background:s.color, borderRadius:3 }} />
                          </div>
                          <span style={{ fontSize:13, fontWeight:700, fontFamily:'monospace', color:s.color, width:20, textAlign:'right' }}>{s.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Distribution */}
              <div style={{ background:'#fff', borderRadius:12, padding:'24px', border:'1px solid #e5e7eb' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:4 }}>Durum Dağılımı</div>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:20 }}>Açık / Devam / Kapatıldı</div>
                <div style={{ display:'flex', gap:24, alignItems:'center' }}>
                  <div style={{ position:'relative', width:130, height:130, flexShrink:0 }}>
                  <svg viewBox="0 0 36 36" style={{ width:130, height:130, transform:'rotate(-90deg)', position:'absolute', top:0, left:0 }}>
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
                    {(() => {
                      const total = findings.length || 1
                      const segs = [
                        { count: findings.filter(f=>f.status==='acik').length, color:'#3b82f6' },
                        { count: findings.filter(f=>f.status==='devam').length, color:'#8b5cf6' },
                        { count: findings.filter(f=>f.status==='kapali').length, color:'#22c55e' },
                      ]
                      const r = 15.9155
                      const circ = 2 * Math.PI * r
                      let offset = 0
                      return segs.map((seg,i) => {
                        const pct = seg.count/total
                        const dash = pct*circ
                        const gap = circ-dash
                        const el = <circle key={i} cx="18" cy="18" r={r} fill="none" stroke={seg.color} strokeWidth="3.5" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset*circ} />
                        offset += pct
                        return el
                      })
                    })()}
                  </svg>
                  <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
                    <div style={{ fontSize:18, fontWeight:800, color:'#111' }}>{findings.length}</div>
                    <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase' }}>toplam</div>
                  </div>
                  </div>
                  <div style={{ flex:1 }}>
                    {[
                      { label:'Açık', color:'#3b82f6', count: findings.filter(f=>f.status==='acik').length },
                      { label:'Devam', color:'#8b5cf6', count: findings.filter(f=>f.status==='devam').length },
                      { label:'Kapatıldı', color:'#22c55e', count: findings.filter(f=>f.status==='kapali').length },
                    ].map(s => (
                      <div key={s.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }} />
                          <span style={{ fontSize:13, color:'#374151' }}>{s.label}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:80, height:6, background:'#f3f4f6', borderRadius:3, overflow:'hidden' }}>
                            <div style={{ height:'100%', width: findings.length ? `${(s.count/findings.length)*100}%` : '0%', background:s.color, borderRadius:3 }} />
                          </div>
                          <span style={{ fontSize:13, fontWeight:700, fontFamily:'monospace', color:s.color, width:20, textAlign:'right' }}>{s.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 4 — SLA Performance */}
            <div style={{ background:'#fff', borderRadius:12, padding:'24px', border:'1px solid #e5e7eb' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:4 }}>SLA Performansı</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginBottom:20 }}>Seviyeye göre hedef kapatma oranları</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
                {[
                  { label:'KRİTİK', target:'24 saat', color:'#dc2626',
                    closed: findings.filter(f=>f.level==='kritik'&&f.status==='kapali').length,
                    total: findings.filter(f=>f.level==='kritik').length },
                  { label:'YÜKSEK', target:'7 gün', color:'#f97316',
                    closed: findings.filter(f=>f.level==='yuksek'&&f.status==='kapali').length,
                    total: findings.filter(f=>f.level==='yuksek').length },
                  { label:'ORTA', target:'30 gün', color:'#eab308',
                    closed: findings.filter(f=>f.level==='orta'&&f.status==='kapali').length,
                    total: findings.filter(f=>f.level==='orta').length },
                ].map(item => {
                  const rate = item.total > 0 ? Math.round((item.closed/item.total)*100) : 0
                  const color = rate>=80?'#16a34a':rate>=50?'#ca8a04':'#dc2626'
                  return (
                    <div key={item.label} style={{ background:'#f9fafb', borderRadius:10, padding:'20px', border:'1px solid #f3f4f6' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                        <div>
                          <div style={{ fontSize:11, fontWeight:600, color:item.color, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:2 }}>{item.label}</div>
                          <div style={{ fontSize:10, color:'#9ca3af' }}>Hedef: {item.target}</div>
                        </div>
                        <div style={{ fontSize:28, fontWeight:800, fontFamily:'monospace', color }}>{rate}%</div>
                      </div>
                      <div style={{ height:8, background:'#e5e7eb', borderRadius:4, overflow:'hidden', marginBottom:8 }}>
                        <div style={{ height:'100%', width:`${rate}%`, background:color, borderRadius:4, transition:'width 0.5s' }} />
                      </div>
                      <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>{item.closed}/{item.total} kapatıldı</div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}

        {activePage === 'findings' && (
          <>
            {/* Findings Header Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, padding:'20px 20px 16px', flexShrink:0 }}>
              {[
                { label:'KRİTİK', val: stats.critical, color:'#dc2626', bg:'#fef2f2', border:'#fecaca', icon:'🛡' },
                { label:'YÜKSEK', val: findings.filter(f=>f.level==='yuksek').length, color:'#ea580c', bg:'#fff7ed', border:'#fed7aa', icon:'⚠' },
                { label:'SLA İHLALİ', val: findings.filter(f=>(f.level==='kritik'||f.level==='yuksek')&&f.status!=='kapali').length, color:'#dc2626', bg:'#fef2f2', border:'#fecaca', icon:'⏰' },
                { label:'TOPLAM AÇIK', val: stats.open, color:'#111', bg:'#fff', border:'#e5e7eb', icon:'📋' },
              ].map((item) => (
                <div key={item.label} style={{ background:item.bg, border:`1px solid ${item.border}`, borderRadius:10, padding:'16px 18px', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:40, height:40, borderRadius:8, background:`${item.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize:28, fontWeight:800, color:item.color, lineHeight:1 }}>{item.val}</div>
                    <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.1em', marginTop:3, fontWeight:600 }}>{item.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Findings Table Container */}
            <div style={{ margin:'0 20px 20px', background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden', flex:1, display:'flex', flexDirection:'column' }}>
              {/* Table Header */}
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#111' }}>Zafiyet Envanteri</div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Tüm bulgular — seviye ve yaşa göre sıralı</div>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>{findings.length} zafiyet</div>
                  {isPentest && (
                    <button onClick={() => setShowNewFinding(true)} style={{ background:'#111', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                      + Bulgu Ekle
                    </button>
                  )}
                </div>
              </div>

              {/* Search + Filters */}
              <div style={{ padding:'12px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', gap:10, alignItems:'center', flexShrink:0, flexWrap:'wrap' }}>
                <div style={{ position:'relative', flex:1, minWidth:200 }}>
                  <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', fontSize:14 }}>🔍</span>
                  <input
                    placeholder="CVE ID, başlık veya etki alanı ara..."
                    onChange={e => setSearchQuery(e.target.value)}
                    value={searchQuery || ''}
                    style={{ width:'100%', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px 8px 36px', fontSize:13, outline:'none', boxSizing:'border-box', color:'#111' }}
                  />
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <div style={{ fontSize:12, color:'#6b7280', fontWeight:600, display:'flex', alignItems:'center' }}>SEVİYE:</div>
                  {[
                    { key:'', label:'Tümü', color:'#6b7280', bg:'#f3f4f6' },
                    { key:'kritik', label:'Kritik', color:'#dc2626', bg:'#fef2f2' },
                    { key:'yuksek', label:'Yüksek', color:'#ea580c', bg:'#fff7ed' },
                    { key:'orta', label:'Orta', color:'#ca8a04', bg:'#fefce8' },
                    { key:'dusuk', label:'Düşük', color:'#16a34a', bg:'#f0fdf4' },
                  ].map(f => (
                    <button key={f.key} onClick={() => setLevelFilter(f.key)}
                      style={{ padding:'4px 12px', borderRadius:6, border:`1px solid ${levelFilter===f.key ? f.color : '#e5e7eb'}`, background: levelFilter===f.key ? f.bg : '#fff', color: levelFilter===f.key ? f.color : '#6b7280', fontSize:12, fontWeight:500, cursor:'pointer' }}>
                      {f.label}
                    </button>
                  ))}
                  <div style={{ fontSize:12, color:'#6b7280', fontWeight:600, display:'flex', alignItems:'center', marginLeft:8 }}>DURUM:</div>
                  {[
                    { key:'', label:'Tümü' },
                    { key:'acik', label:'Açık' },
                    { key:'devam', label:'Devam' },
                    { key:'kapali', label:'Kapatıldı' },
                  ].map(f => (
                    <button key={f.key} onClick={() => setStatusFilter(f.key)}
                      style={{ padding:'4px 12px', borderRadius:6, border:`1px solid ${statusFilter===f.key ? '#111' : '#e5e7eb'}`, background: statusFilter===f.key ? '#111' : '#fff', color: statusFilter===f.key ? '#fff' : '#6b7280', fontSize:12, fontWeight:500, cursor:'pointer' }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

            <div style={{ flex:1, overflow:'auto' }}>
              {loading ? (
                <div style={{ padding:20, color:'#9ca3af', fontSize:12 }}>Yükleniyor...</div>
              ) : findings.length === 0 ? (
                <div style={{ padding:20, color:'#9ca3af', fontSize:12, textAlign:'center' }}>Henüz bulgu yok.</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ borderBottom:'0.5px solid #e5e7eb' }}>
                      {['ID', isPentest ? 'Müşteri' : null, 'Başlık', 'Seviye', 'CVSS', 'Etki Alanı', 'Durum', 'SLA', 'Gün Açık', 'Yorumlar', isPentest ? 'İşlem' : null].filter(Boolean).map(h => (
                        <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:11, color:'#6b7280', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {findings.filter(f => {
                        if (levelFilter && f.level !== levelFilter) return false
                        if (statusFilter && f.status !== statusFilter) return false
                        if (searchQuery && !f.title?.toLowerCase().includes(searchQuery.toLowerCase()) && !f.finding_id?.toLowerCase().includes(searchQuery.toLowerCase()) && !f.impact_category?.toLowerCase().includes(searchQuery.toLowerCase())) return false
                        return true
                      }).map(f => (
                      <tr key={f.id} onClick={() => openModal(f)} style={{ cursor:'pointer', borderBottom:'1px solid #f3f4f6', height:52 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding:'12px 10px', fontFamily:'monospace', color:'#9ca3af', fontSize:13 }}>{f.finding_id}</td>
                        {isPentest && <td style={{ padding:'12px 10px', fontSize:13, color:'#6b7280' }}>{f.clients?.name || '-'}</td>}
                        <td style={{ padding:'10px', color:'#374151' }}>{f.title}</td>
                        <td style={{ padding:'10px' }}><Badge type={f.level} label={levelLabel[f.level]} /></td>
                        <td style={{ padding:'10px', fontFamily:'monospace', fontSize:13, fontWeight:600, color: getCvssColor(f.cvss_score) }}>{f.cvss_score || '-'}</td>
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
                        <td style={{ padding:'10px' }}>
                          {(() => {
                            const isBreached = (f.level==='kritik'||f.level==='yuksek') && f.status!=='kapali'
                            const isOnTrack = f.status==='kapali'
                            return isOnTrack ? (
                              <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', fontWeight:500 }}>✓ Tamam</span>
                            ) : isBreached ? (
                              <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', fontWeight:500 }}>⚠ İhlal</span>
                            ) : (
                              <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:'#f9fafb', color:'#6b7280', border:'1px solid #e5e7eb' }}>—</span>
                            )
                          })()}
                        </td>
                        <td style={{ padding:'10px', fontFamily:'monospace', fontSize:13, fontWeight:700, color: (() => { const days = Math.floor((new Date()-new Date(f.created_at))/(1000*60*60*24)); return days > 14 ? '#dc2626' : days > 7 ? '#ca8a04' : '#16a34a' })() }}>
                          {Math.floor((new Date()-new Date(f.created_at))/(1000*60*60*24))}g
                        </td>
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
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:11, color:'#6b7280', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600 }}>{h}</th>
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

        {activePage === 'superadmin' && isSuperAdmin && (
          <SuperAdminPage clients={clients} fetchClients={fetchClients} supabaseUrl={process.env.REACT_APP_SUPABASE_URL} supabaseKey={process.env.REACT_APP_SUPABASE_ANON_KEY} />
        )}

        {activePage === 'reports' && (
          <ReportsPage profile={profile} clients={clients} findings={findings} isPentest={isPentest} />
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
              {selectedFinding.description && (
                <div style={{ marginBottom:12, padding:'10px 12px', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Açıklama</div>
                  <div style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>{selectedFinding.description}</div>
                </div>
              )}

              {selectedFinding.observation && (
                <div style={{ marginBottom:12, padding:'10px 12px', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Gözlem</div>
                  <div style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>{selectedFinding.observation}</div>
                </div>
              )}

              {selectedFinding.technical_details && (
                <div style={{ marginBottom:12, padding:'10px 12px', background:'#1e1e1e', border:'0.5px solid #333', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Teknik Detaylar</div>
                  <div style={{ fontSize:12, color:'#e5e7eb', fontFamily:'monospace', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{selectedFinding.technical_details}</div>
                </div>
              )}

              {selectedFinding.recommendation && (
                <div style={{ marginBottom:12, padding:'10px 12px', background:'#f0fdf4', border:'0.5px solid #bbf7d0', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'#16a34a', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Tavsiye</div>
                  <div style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>{selectedFinding.recommendation}</div>
                </div>
              )}

              {selectedFinding.poc && (
                <div style={{ marginBottom:12, padding:'10px 12px', background:'#1e1e1e', border:'0.5px solid #333', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>PoC</div>
                  <div style={{ fontSize:12, color:'#4ade80', fontFamily:'monospace', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{selectedFinding.poc}</div>
                </div>
              )}

              {selectedFinding.references_links && (
                <div style={{ marginBottom:12, padding:'10px 12px', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Referanslar</div>
                  <div style={{ fontSize:12, color:'#2563eb', fontFamily:'monospace', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{selectedFinding.references_links}</div>
                </div>
              )}
              {selectedFinding.closure_note && (
                <div style={{ marginBottom:12, padding:'10px 12px', background:'#f0fdf4', border:'0.5px solid #bbf7d0', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'#16a34a', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Kapanış Notu</div>
                  <div style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>{selectedFinding.closure_note}</div>
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
                        <div style={{ fontSize:13, color:'#374151', lineHeight:1.5 }}>{c.content}</div>
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


      {/* CSV Import Modal */}
      {showImport && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:20, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:640, maxWidth:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:'#111' }}>CSV Import</div>
                <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>Nessus, Nexpose, Qualys veya generic CSV</div>
              </div>
              <button onClick={() => { setShowImport(false); setImportData([]) }} style={{ background:'transparent', border:'none', fontSize:20, cursor:'pointer', color:'#9ca3af' }}>×</button>
            </div>

            <div style={{ padding:'20px 24px', flex:1, overflowY:'auto' }}>
              {importData.length === 0 ? (
                <div>
                  <div style={{ border:'2px dashed #e5e7eb', borderRadius:10, padding:'32px', textAlign:'center', marginBottom:16, cursor:'pointer', background:'#f9fafb' }}
                    onClick={() => document.getElementById('csv-input').click()}>
                    <div style={{ fontSize:32, marginBottom:8 }}>📂</div>
                    <div style={{ fontSize:14, fontWeight:500, color:'#374151', marginBottom:4 }}>CSV dosyası seç</div>
                    <div style={{ fontSize:12, color:'#9ca3af' }}>Nessus, Nexpose, Qualys veya generic CSV</div>
                    <input id="csv-input" type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display:'none' }} />
                  </div>

                  <div style={{ background:'#f9fafb', borderRadius:8, padding:'14px 16px', marginBottom:16 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#374151', marginBottom:8 }}>Desteklenen Formatlar</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      {[
                        { tool:'Nessus', cols:'Plugin ID, CVE, CVSS, Risk, Name, Description' },
                        { tool:'Nexpose', cols:'Vulnerability ID, Title, CVSS Score, Severity' },
                        { tool:'Qualys', cols:'QID, Title, Severity, CVE ID, CVSS Base' },
                        { tool:'Generic', cols:'Title/Name, CVSS, Risk/Severity, Description' },
                      ].map(f => (
                        <div key={f.tool} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:6, padding:'10px 12px' }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'#111', marginBottom:3 }}>{f.tool}</div>
                          <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace' }}>{f.cols}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, padding:'12px 16px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8 }}>
                    <span style={{ fontSize:20 }}>✅</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#16a34a' }}>{importData.length} bulgu tespit edildi</div>
                      <div style={{ fontSize:11, color:'#6b7280' }}>Kaynak: {importSource.toUpperCase()}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block', fontSize:12, color:'#374151', fontWeight:500, marginBottom:6 }}>Müşteri Seç</label>
                    <select value={importClientId} onChange={e => setImportClientId(e.target.value)}
                      style={{ width:'100%', background:'#f9fafb', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'9px 12px', fontSize:13, outline:'none', color:'#111' }}>
                      <option value="">Müşteri seç...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div style={{ maxHeight:280, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:8 }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead style={{ position:'sticky', top:0, background:'#f9fafb' }}>
                        <tr>
                          {['Başlık', 'Seviye', 'CVSS', 'Etki Alanı'].map(h => (
                            <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, color:'#6b7280', fontWeight:600, borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importData.slice(0,20).map((f, i) => (
                          <tr key={i} style={{ borderBottom:'1px solid #f3f4f6' }}>
                            <td style={{ padding:'8px 12px', color:'#111', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.title}</td>
                            <td style={{ padding:'8px 12px' }}>
                              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background: f.level==='kritik'?'#fef2f2':f.level==='yuksek'?'#fff7ed':f.level==='orta'?'#fefce8':'#f0fdf4', color: f.level==='kritik'?'#dc2626':f.level==='yuksek'?'#ea580c':f.level==='orta'?'#ca8a04':'#16a34a' }}>
                                {f.level==='kritik'?'Kritik':f.level==='yuksek'?'Yüksek':f.level==='orta'?'Orta':'Düşük'}
                              </span>
                            </td>
                            <td style={{ padding:'8px 12px', fontFamily:'monospace', fontWeight:600, color: f.cvss_score>=9?'#dc2626':f.cvss_score>=7?'#ea580c':f.cvss_score>=4?'#ca8a04':'#16a34a' }}>{f.cvss_score || '-'}</td>
                            <td style={{ padding:'8px 12px', color:'#6b7280' }}>{f.impact_category}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importData.length > 20 && (
                      <div style={{ padding:'8px 12px', fontSize:11, color:'#9ca3af', textAlign:'center' }}>+{importData.length - 20} daha...</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {importData.length > 0 && (
              <div style={{ padding:'16px 24px', borderTop:'1px solid #f3f4f6', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
                <button onClick={() => { setImportData([]); setImportSource('') }} style={{ background:'transparent', border:'1.5px solid #e5e7eb', color:'#6b7280', padding:'9px 18px', borderRadius:8, fontSize:13, cursor:'pointer' }}>
                  Geri
                </button>
                <button onClick={executeImport} disabled={importing} style={{ background:'#7f1d1d', color:'#fff', border:'none', padding:'9px 20px', borderRadius:8, fontSize:13, fontWeight:600, cursor: importing?'not-allowed':'pointer', opacity: importing?0.7:1 }}>
                  {importing ? `İçe Aktarılıyor...` : `${importData.length} Bulguyu İçe Aktar`}
                </button>
              </div>
            )}
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
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Açıklama</label>
                <textarea value={newFinding.description} onChange={e => setNewFinding({...newFinding, description: e.target.value})}
                  placeholder="Zafiyetin genel açıklaması..."
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:68 }} />
              </div>

              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Gözlem</label>
                <textarea value={newFinding.observation} onChange={e => setNewFinding({...newFinding, observation: e.target.value})}
                  placeholder="Test sırasında gözlemlenen bulgular..."
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:68 }} />
              </div>

              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Teknik Detaylar</label>
                <textarea value={newFinding.technical_details} onChange={e => setNewFinding({...newFinding, technical_details: e.target.value})}
                  placeholder="Teknik detaylar, payload, endpoint bilgileri..."
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:68, fontFamily:'monospace' }} />
              </div>

              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Tavsiye (Recommendation)</label>
                <textarea value={newFinding.recommendation} onChange={e => setNewFinding({...newFinding, recommendation: e.target.value})}
                  placeholder="Bu zafiyetin nasıl giderileceğine dair tavsiyeler..."
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:68 }} />
              </div>

              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>PoC (Proof of Concept)</label>
                <textarea value={newFinding.poc} onChange={e => setNewFinding({...newFinding, poc: e.target.value})}
                  placeholder="```python&#10;# Exploit kodu veya adımlar...&#10;```"
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:68, fontFamily:'monospace' }} />
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
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Açıklama</label>
                <textarea value={editFinding.description || ''} onChange={e => setEditFinding({...editFinding, description: e.target.value})}
                  placeholder="Zafiyetin genel açıklaması..."
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:68 }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Gözlem</label>
                <textarea value={editFinding.observation || ''} onChange={e => setEditFinding({...editFinding, observation: e.target.value})}
                  placeholder="Test sırasında gözlemlenen bulgular..."
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:68 }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Teknik Detaylar</label>
                <textarea value={editFinding.technical_details || ''} onChange={e => setEditFinding({...editFinding, technical_details: e.target.value})}
                  placeholder="Teknik detaylar, payload, endpoint bilgileri..."
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:68, fontFamily:'monospace' }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Tavsiye (Recommendation)</label>
                <textarea value={editFinding.recommendation || ''} onChange={e => setEditFinding({...editFinding, recommendation: e.target.value})}
                  placeholder="Bu zafiyetin nasıl giderileceğine dair tavsiyeler..."
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:68 }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'#9ca3af', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>PoC (Proof of Concept)</label>
                <textarea value={editFinding.poc || ''} onChange={e => setEditFinding({...editFinding, poc: e.target.value})}
                  placeholder="```python&#10;# Exploit kodu veya adımlar...&#10;```"
                  style={{ width:'100%', background:'#f9fafb', border:'0.5px solid #e5e7eb', borderRadius:6, padding:'7px 10px', color:'#111', fontSize:12, outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:68, fontFamily:'monospace' }} />
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
