import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { isValidUsername, toAuthEmail } from '../../lib/auth-identifier'

export default function Register() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      if (!isValidUsername(username)) {
        setMessage('Username can only contain letters, numbers, dot, underscore, and hyphen.')
        return
      }

      const authEmail = toAuthEmail(username)
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password,
        options: {
          data: { name, username: username.trim().toLowerCase() },
        },
      })

      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Registration successful. You can now sign in with your username and password.')
      }
    } catch (err: any) {
      setMessage(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleRegister} className="space-y-3">
      <div>
        <label className="text-sm">Name</label>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full px-2 py-1" />
      </div>
      <div>
        <label className="text-sm">Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} type="text" className="w-full px-2 py-1" required />
      </div>
      <div>
        <label className="text-sm">Password</label>
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" className="w-full px-2 py-1" required />
      </div>
      <div>
        <button type="submit" disabled={loading} className="px-3 py-1 bg-primary text-white">{loading ? 'Registering...' : 'Register'}</button>
      </div>
      {message && <div className="text-sm mt-2">{message}</div>}
    </form>
  )
}
