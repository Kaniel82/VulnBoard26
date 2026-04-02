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
  if (!profile) { setError(`Profil bulunamadı. Hata: ${profileError?.message}`); setLoading(false); return }

  // Rol kontrolü
  if (role === 'pentest' && profile.role === 'client') {
    setError('Bu hesap müşteri hesabıdır.')
    await supabase.auth.signOut()
    setLoading(false)
    return

  if (role === 'client' && (profile.role === 'pentest' || profile.role === 'superadmin')) {
    setError('Bu hesap pentest hesabıdır.')
    await supabase.auth.signOut()
    setLoading(false)
    return

  onLogin(profile)
  setLoading(false)
}
