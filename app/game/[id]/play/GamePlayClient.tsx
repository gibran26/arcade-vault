'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import { GAME_ENGINES, type EngineInstance } from '@/app/game-engines/registry';
import { saveScore } from '@/app/lib/supabase/actions';
import type { Game } from '@/app/data/types';

export default function GamePlayClient({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useAuth();
  const entry = GAME_ENGINES[game.id];

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(user ? user.name : 'INVITADO');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<EngineInstance | null>(null);

  const startEngine = () => {
    if (!canvasRef.current) return;
    engineRef.current = entry.createGame(canvasRef.current, {
      onScoreChange: setScore,
      onLivesChange: setLives,
      onGameOver: (finalScore) => {
        setScore(finalScore);
        setOver(true);
      },
      onPauseChange: setPaused,
      onLevelChange: setLevel,
    });
  };

  useEffect(() => {
    startEngine();
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = () => {
    if (paused) engineRef.current?.resume();
    else engineRef.current?.pause();
  };
  const endGame = () => setOver(true);
  const restart = () => {
    engineRef.current?.destroy();
    startEngine();
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaving(false);
    setSaveError(null);
  };

  const handleSaveScore = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveScore(game.id, name, score);
      setSaved(true);
    } catch {
      setSaveError('No se pudo guardar la puntuación. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: 'var(--ink)' }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString('es-ES')}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{'♥ '.repeat(lives).trim() || '—'}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, '0')}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/game/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <canvas ref={canvasRef} width={entry.width} height={entry.height} />
          {paused && (
            <div
              className="crt-content"
              style={{ background: 'rgba(0,0,0,0.6)', zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-dim)',
                    marginTop: 10,
                    letterSpacing: '0.16em',
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString('es-ES')}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={handleSaveScore}
                  disabled={saving}
                >
                  {saving ? 'GUARDANDO...' : 'GUARDAR PUNTUACIÓN'}
                </button>
                {saveError && (
                  <div
                    className="toast-error"
                    style={{ color: 'var(--magenta)' }}
                  >
                    ▸ {saveError}
                  </div>
                )}
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push('/games')}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
