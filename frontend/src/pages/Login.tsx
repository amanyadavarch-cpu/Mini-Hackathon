import { useState, type FormEvent } from 'react'
import { Fingerprint, ShieldCheck } from 'lucide-react'
import { useAppData } from '../context/AppData'

export function Login() {
  const { login, register, error: startupError } = useAppData()
  const [isRegistering, setIsRegistering] = useState(false)
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
      if (isRegistering) await register(name, email, password)
      else await login(email, password)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : isRegistering ? 'Account creation failed.' : 'Sign in failed.')
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
        <h1>{isRegistering ? 'Create your analyst account' : 'Sign in to Fraud Radar'}</h1>
        <p>{isRegistering ? 'Create an account to securely access the Fraud Radar workspace.' : 'Use your analyst account to review transactions and investigations.'}</p>
        {(error || startupError) && <div className="api-message api-error" role="alert">{error || startupError}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          {isRegistering && <label>Full name<input type="text" autoComplete="name" maxLength={80} minLength={2} required value={name} onChange={(event) => setName(event.target.value)} /></label>}
          <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} minLength={8} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="button button-primary" disabled={submitting}>{submitting ? isRegistering ? 'Creating account…' : 'Signing in…' : isRegistering ? 'Create account securely' : 'Sign in securely'}</button>
        </form>
        <p className="login-switch">
          {isRegistering ? 'Already have an account?' : 'New to Fraud Radar?'}
          <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError('') }}>
            {isRegistering ? 'Sign in' : 'Create an account'}
          </button>
        </p>
        {!isRegistering && <small className="login-note">Demo administrator credentials are configured in the backend environment.</small>}
      </section>
    </main>
  )
}
