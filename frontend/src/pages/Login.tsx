import { useState, type FormEvent } from 'react'
import { Fingerprint, ShieldCheck } from 'lucide-react'
import { useAppData } from '../context/AppData'

export function Login() {
  const { login, error: startupError } = useAppData()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Sign in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-mark"><ShieldCheck size={20} /></span>
          <span className="brand-copy"><strong>Fraud Radar</strong><small>SECURITY CONSOLE</small></span>
        </div>
        <span className="login-kicker"><Fingerprint size={15} /> AUTHENTICATED WORKSPACE</span>
        <h1>Sign in to Fraud Radar</h1>
        <p>Use your backend analyst account to review transactions and investigations.</p>
        {(error || startupError) && <div className="api-message api-error" role="alert">{error || startupError}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete="current-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="button button-primary" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in securely'}</button>
        </form>
        <small className="login-note">Credentials are configured in the backend environment. Demo seed instructions are in the backend README.</small>
      </section>
    </main>
  )
}
