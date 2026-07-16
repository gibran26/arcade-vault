'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Game, ScoreRow } from '@/app/data/types';
import { useAuth } from '@/app/context/auth-context';
import Podium from '@/components/Podium';

export default function HallOfFameClient({
  games,
  scoresByGame,
}: {
  games: Game[];
  scoresByGame: Record<string, ScoreRow[]>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState(games[0].id);

  const rows = useMemo(() => scoresByGame[tab] ?? [], [scoresByGame, tab]);
  const game = games.find((g) => g.id === tab)!;
  const youRank = user ? Math.floor(8 + (tab.length % 4)) : null;
  const youScore = user ? rows[5]?.score - 2400 : null;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={'chip' + (tab === g.id ? ' active' : '')}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length >= 3 ? (
        <Podium rows={rows} />
      ) : (
        <p
          className="mono"
          style={{ textAlign: 'center', color: 'var(--ink-dim)' }}
        >
          AÚN NO HAY SUFICIENTES PUNTUACIONES PARA EL PODIO
        </p>
      )}

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.name + i}
            className={
              'tr' +
              (i === 0 ? ' top1' : i === 1 ? ' top2' : i === 2 ? ' top3' : '')
            }
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(r.rank).padStart(2, '0')}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{r.score.toLocaleString('es-ES')}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
        {user && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            <div
              className="tr you"
              style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
            >
              <div className="rk" style={{ color: 'var(--yellow)' }}>
                #{String(youRank).padStart(2, '0')}
              </div>
              <div className="pl" style={{ color: 'var(--yellow)' }}>
                {user.name}
              </div>
              <div
                className="sc"
                style={{
                  color: 'var(--yellow)',
                  textShadow: '0 0 6px rgba(245,255,0,0.5)',
                }}
              >
                {(youScore || 9999).toLocaleString('es-ES')}
              </div>
              <div className="dt">11/05/2026</div>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <button className="btn lg" onClick={() => router.push('/games')}>
          VOLVER A LA BIBLIOTECA
        </button>
      </div>
    </div>
  );
}
