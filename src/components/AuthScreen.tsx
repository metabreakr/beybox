import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';

type Mode = 'signup' | 'login';

export function AuthScreen() {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    reset();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password, displayName);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="auth-logo" role="img" aria-label="Beybox" />
        <div className="auth-wm">BEYBOX</div>
        <h1>
          Three Beys. No repeated parts.
          <br />
          <em>One legal deck.</em>
        </h1>
        <p>
          Beybox tracks what you actually own and builds WBO-legal decks from it —
          then tells you which part to buy next, and why.
        </p>
      </div>

      <div className="form">
        <div className="eyebrow">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</div>

        <div className="note">
          {mode === 'signup'
            ? 'Free forever — the full catalogue, unlimited inventory, three decks, and WBO deck validation. Beybox Pro adds unlimited decks.'
            : 'Sign in to your Beybox collection and decks.'}
        </div>

        {error && <div className="note form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="displayName">Display name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="The name shown beside your email"
                required
                autoComplete="name"
              />
              <div className="hint">Shown on your account screen and the admin users table.</div>
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          <div className="btnrow">
            <button type="submit" className="b go" disabled={submitting}>
              {submitting ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
            </button>
          </div>
        </form>

        <div className="btnrow">
          <button
            type="button"
            className="b"
            onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
          >
            {mode === 'signup' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>

      <div className="foot">
        <div className="foot-l">
          <span>Free to use · Beybox Pro unlocks unlimited decks</span>
        </div>
        <div className="foot-r">
          <span>Unaffiliated with Takara Tomy, Hasbro, or the WBO</span>
        </div>
      </div>
    </div>
  );
}
