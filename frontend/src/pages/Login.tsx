import { useState, type FormEvent } from 'react'
import { Fingerprint, ShieldCheck } from 'lucide-react'
import { useAppData } from '../context/AppData'

export function Login() {
  const { login, register, error: startupError } = useAppData()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'register') await register(name, email, password)
      else await login(email, password)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : mode === 'register' ? 'Account creation failed.' : 'Sign in failed.')
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
        <h1>{mode === 'register' ? 'Create your account' : 'Sign in to Fraud Radar'}</h1>
        <p>{mode === 'register' ? 'Create an analyst account to start reviewing fraud alerts and investigations.' : 'Sign in to review transactions and investigations.'}</p>
        {(error || startupError) && <div className="api-message api-error" role="alert">{error || startupError}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'register' && <label>Full name<input type="text" autoComplete="name" maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} /></label>}
          <label>Email address<input type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={8} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="button button-primary" disabled={submitting}>{submitting ? mode === 'register' ? 'Creating account…' : 'Signing in…' : mode === 'register' ? 'Create analyst account' : 'Sign in securely'}</button>
        </form>
        <div className="login-switch">
          <span>{mode === 'register' ? 'Already have an account?' : 'New to Fraud Radar?'}</span>
          <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError('') }}>
            {mode === 'register' ? 'Sign in' : 'Create account'}
          </button>
        </div>
        <small className="login-note">New accounts are created with analyst access. This demo uses fictional transaction data.</small>
      </section>
    </main>
  )
}
