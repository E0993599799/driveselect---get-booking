import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toAuthEmail } from '../../lib/auth-identifier'

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const authEmail = toAuthEmail(identifier)
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      })
      if (error) setMessage(error.message)
      else setMessage('If an account exists, a password reset email has been sent.')
    } catch (err: any) {
      setMessage(err.message || 'Failed to request password reset')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-sm">Email or username</label>
        <input value={identifier} onChange={e => setIdentifier(e.target.value)} type="text" className="w-full px-2 py-1" required />
      </div>
      <div>
        <button type="submit" disabled={loading} className="px-3 py-1 bg-primary text-white">{loading ? 'Sending...' : 'Send reset link'}</button>
      </div>
      {message && <div className="text-sm mt-2">{message}</div>}
    </form>
  )
}
