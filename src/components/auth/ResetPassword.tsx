import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setMessage('Passwords do not match'); return }
    setLoading(true)
    setMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setMessage('Recovery session missing. Open the full reset link from your email again.')
        return
      }

      const { error } = await supabase.auth.updateUser({ password })
      if (error) setMessage(error.message)
      else setMessage('Password reset successful. You can now sign in.')
    } catch (err: any) {
      setMessage(err.message || 'Failed to reset password')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleReset} className="space-y-3">
      <div>
        <label className="text-sm">New password</label>
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" className="w-full px-2 py-1" required />
      </div>
      <div>
        <label className="text-sm">Confirm password</label>
        <input value={confirm} onChange={e => setConfirm(e.target.value)} type="password" className="w-full px-2 py-1" required />
      </div>
      <div>
        <button type="submit" disabled={loading} className="px-3 py-1 bg-primary text-white">{loading ? 'Saving...' : 'Set new password'}</button>
      </div>
      {message && <div className="text-sm mt-2">{message}</div>}
    </form>
  )
}
