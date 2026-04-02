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

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('E-posta veya şifre hatalı.')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle()

    console.log('Profile:', profile, 'Error:', profileError)

    if (!profile) {
      setError('Profil bulunamadı. Yönetici ile iletişime geçin.')
      setLoading(false)
      return
    }

    if (profile.role !== 'superadmin' && profile.role !== role) {
      setError(role === 'pentest' ? 'Bu hesap müşteri hesabıdır.' : 'Bu hesap pentest hesabıdır.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    onLogin(profile)
  }

  return (
    // JSX kodunuz buraya gelecek
  )
}
