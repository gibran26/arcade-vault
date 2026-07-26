'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import { GAME_ENGINES, type EngineInstance } from '@/app/game-engines/registry';
import {
  SKIN_LABELS,
  SKIN_ORDER,
  loadSkin,
  saveSkin,
  type SkinName,
} from '@/app/game-engines/skins';
import { saveScore } from '@/app/lib/supabase/actions';
import { useTouchDevice } from '@/app/lib/use-touch-device';
import type { Game } from '@/app/data/types';
import TouchControls from './TouchControls';

export default function GamePlayClient({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useAuth();
  const entry = GAME_ENGINES[game.id];
  const isTouch = useTouchDevice();

  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(user ? user.name : 'INVITADO');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [skin, setSkinState] = useState<SkinName>('classic');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<EngineInstance | null>(null);

  // `score`/`lives`/`level` cambian por cada avance de fila/vida/nivel del
  // engine: se guardan en refs (sin disparar re-render de React) y se
  // reflejan en el DOM directamente a través de los nodos referenciados más
  // abajo (spec 11, paso 4). El JSX de estos nodos nunca depende del valor
  // cambiante como children, para que un re-render por otro motivo (pausa,
  // skin, modal) no lo sobrescriba con un valor obsoleto.
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const levelRef = useRef(1);
  const scoreElRef = useRef<HTMLDivElement | null>(null);
  const livesElRef = useRef<HTMLDivElement | null>(null);
  const levelElRef = useRef<HTMLDivElement | null>(null);
  const finalScoreElRef = useRef<HTMLDivElement | null>(null);
  const isTouchRef = useRef(isTouch);

  const renderScore = (next: number) => {
    const formatted = next.toLocaleString('es-ES');
    if (scoreElRef.current) {
      scoreElRef.current.textContent = formatted;
    }
    // El motor no se detiene solo porque se abra el modal de "FIN DEL JUEGO"
    // (`endGame` no llama a `pause()`/`destroy()`, es comportamiento previo a
    // este spec): si sigue emitiendo `onScoreChange` con el modal abierto, el
    // puntaje del modal debe seguir en vivo igual que el del HUD, tal como
    // ocurría antes cuando ambos leían el mismo estado de React.
    if (finalScoreElRef.current) {
      finalScoreElRef.current.textContent = formatted;
    }
  };
  const renderLives = (next: number) => {
    const el = livesElRef.current;
    if (!el) return;
    if (next <= 0) {
      el.textContent = '—';
    } else if (isTouchRef.current) {
      el.innerHTML = `<span class="lives-compact"><span>♥</span><span>X${next}</span></span>`;
    } else {
      el.textContent = '♥ '.repeat(next).trim();
    }
  };
  const renderLevel = (next: number) => {
    if (levelElRef.current) {
      levelElRef.current.textContent = String(next).padStart(2, '0');
    }
  };

  useEffect(() => {
    isTouchRef.current = isTouch;
    renderLives(livesRef.current);
  }, [isTouch]);

  // El puntaje final del modal se lee desde `scoreRef` dentro de un efecto
  // (nunca durante el render, ver reglas de `react-hooks/refs`) justo cuando
  // el modal aparece, evitando un `useState` que se actualizaría en cada
  // avance de puntaje durante la partida.
  useLayoutEffect(() => {
    if (over && finalScoreElRef.current) {
      finalScoreElRef.current.textContent =
        scoreRef.current.toLocaleString('es-ES');
    }
  }, [over]);

  const startEngine = (skinOverride?: SkinName) => {
    if (!canvasRef.current) return;
    engineRef.current = entry.createGame(
      canvasRef.current,
      {
        onScoreChange: (next) => {
          scoreRef.current = next;
          renderScore(next);
        },
        onLivesChange: (next) => {
          livesRef.current = next;
          renderLives(next);
        },
        onGameOver: (finalScore) => {
          scoreRef.current = finalScore;
          renderScore(finalScore);
          setOver(true);
        },
        onPauseChange: setPaused,
        onLevelChange: (next) => {
          levelRef.current = next;
          renderLevel(next);
        },
      },
      { skin: skinOverride ?? skin },
    );
  };

  useEffect(() => {
    const initialSkin = loadSkin(game.id);
    setSkinState(initialSkin);
    startEngine(initialSkin);
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
  const changeSkin = (next: SkinName) => {
    if (next === skin) return;
    saveSkin(game.id, next);
    setSkinState(next);
    engineRef.current?.setSkin?.(next);
  };

  const handleSaveScore = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveScore(game.id, name, scoreRef.current);
      setSaved(true);
    } catch {
      setSaveError('No se pudo guardar la puntuación. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="av-player fade-in" data-skin={skin}>
      <div className={`player-hud${isTouch ? ' player-hud-touch' : ''}`}>
        <div
          style={{
            display: 'flex',
            gap: isTouch ? 6 : 24,
            flexWrap: isTouch ? 'nowrap' : 'wrap',
          }}
        >
          <div className="hud-stat name">
            <div className="l">{isTouch ? 'JUG' : 'Jugador'}</div>
            <div className="v" style={{ color: 'var(--ink)' }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">{isTouch ? 'PTS' : 'Puntuación'}</div>
            <div className="v" ref={scoreElRef}>
              {(0).toLocaleString('es-ES')}
            </div>
          </div>
          <div className="hud-stat lives">
            <div className="l">{isTouch ? 'VIDA' : 'Vidas'}</div>
            <div className="v" ref={livesElRef}>
              {isTouch ? (
                <span className="lives-compact">
                  <span>♥</span>
                  <span>X3</span>
                </span>
              ) : (
                '♥ ♥ ♥'
              )}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">{isTouch ? 'NV' : 'Nivel'}</div>
            <div className="v" ref={levelElRef}>
              01
            </div>
          </div>
        </div>
        <div className="hud-actions">
          {entry.skins && (
            <select
              className="hud-skins"
              aria-label="Skin visual"
              value={skin}
              onChange={(e) => changeSkin(e.target.value as SkinName)}
            >
              {SKIN_ORDER.map((s) => (
                <option key={s} value={s}>
                  {SKIN_LABELS[s]}
                </option>
              ))}
            </select>
          )}
          {!isTouch && (
            <>
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
            </>
          )}
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

      {isTouch && entry.touchControls && (
        <TouchControls
          schema={entry.touchControls}
          paused={paused}
          onTogglePause={togglePause}
          onFinish={endGame}
          onExit={() => router.push(`/game/${game.id}`)}
        />
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final" ref={finalScoreElRef}>
              {(0).toLocaleString('es-ES')}
            </div>
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
