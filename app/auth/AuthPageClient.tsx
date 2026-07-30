'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, userFromSession } from '@/app/context/auth-context';
import { createClient } from '@/app/lib/supabase/client';
import { signInWithUsername } from '@/app/lib/supabase/actions';

const GENERIC_ERROR = 'Ocurrió un error. Intenta de nuevo.';

function isPasswordValid(password: string): boolean {
  return password.length >= 8 && /\d/.test(password);
}

export default function AuthPageClient() {
  const router = useRouter();
  const { login } = useAuth();
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (tab === 'up') {
      if (!user || !email || !isPasswordValid(pass)) {
        setError(
          'Revisa los campos: usuario, correo y contraseña (mínimo 8 caracteres y un número).',
        );
        return;
      }

      setLoading(true);
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: { username: user },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setLoading(false);

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setSignupSuccess(true);
      return;
    }

    if (!user || !pass) {
      setError('Ingresa tu usuario y contraseña.');
      return;
    }

    setLoading(true);
    const { error: loginError } = await signInWithUsername(user, pass);
    setLoading(false);

    if (loginError) {
      setError(loginError);
      return;
    }

    // signInWithUsername() es una Server Action: establece la sesión vía
    // cookies desde el servidor, así que el AuthProvider (montado antes del
    // login, no se remonta en esta navegación SPA) no se entera solo. Se
    // relee la sesión real y se sincroniza el contexto explícitamente antes
    // de navegar.
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    login(userFromSession(session));

    router.push('/games');
  };

  const socialLogin = async (provider: 'google' | 'github') => {
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (oauthError) setError(oauthError.message ?? GENERIC_ERROR);
  };

  const playAsGuest = () => {
    router.push('/games');
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--ink-faint)',
              letterSpacing: '0.16em',
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === 'in' ? 'on' : ''}
            onClick={() => {
              setTab('in');
              setError(null);
              setSignupSuccess(false);
            }}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={tab === 'up' ? 'on' : ''}
            onClick={() => {
              setTab('up');
              setError(null);
              setSignupSuccess(false);
            }}
          >
            CREAR CUENTA
          </button>
        </div>

        {signupSuccess ? (
          <div className="field slide-in" style={{ textAlign: 'center' }}>
            <p>Revisa tu correo para confirmar tu cuenta.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Usuario</label>
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="px_kai"
                required
              />
            </div>
            {tab === 'up' && (
              <div className="field slide-in">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                  required
                />
              </div>
            )}
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {tab === 'in' && (
              <div style={{ textAlign: 'right', marginTop: -4 }}>
                <Link
                  href="/auth/forgot-password"
                  className="mono"
                  style={{ fontSize: 11, color: 'var(--ink-faint)' }}
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            )}

            {error && (
              <div
                className="mono"
                style={{
                  color: 'var(--danger, #ff5c5c)',
                  fontSize: 12,
                  marginTop: 8,
                }}
              >
                {error}
              </div>
            )}

            <button
              className="btn lg"
              type="submit"
              disabled={loading}
              style={{ width: '100%', marginTop: 8 }}
            >
              {loading
                ? 'CARGANDO…'
                : tab === 'in'
                  ? 'ENTRAR AL VAULT'
                  : 'CREAR Y JUGAR'}
            </button>
          </form>
        )}

        <button
          className="btn ghost"
          style={{ width: '100%', marginTop: 10 }}
          onClick={playAsGuest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            onClick={() => socialLogin('google')}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => socialLogin('github')}
          >
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--ink-faint)',
            letterSpacing: '0.1em',
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
