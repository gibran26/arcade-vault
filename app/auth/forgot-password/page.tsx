'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/app/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Ingresa tu correo electrónico.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      },
    );
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
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
            RECUPERAR CONTRASEÑA
          </div>
        </div>

        {sent ? (
          <div className="field slide-in" style={{ textAlign: 'center' }}>
            <p>
              Revisa tu correo para continuar con la recuperación de tu
              contraseña.
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                required
              />
            </div>

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
              {loading ? 'ENVIANDO…' : 'ENVIAR ENLACE DE RECUPERACIÓN'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
