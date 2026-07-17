import { notFound } from 'next/navigation';
import Link from 'next/link';
import Leaderboard from '@/components/Leaderboard';
import { getGame, getScores, getStats } from '@/app/lib/supabase/queries';

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const game = await getGame(id);
  if (!game) notFound();

  const scores = await getScores(id, 10);
  const stats = await getStats(id);

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={'cover-bg ' + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{stats.plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{
                  color: 'var(--magenta)',
                  textShadow: '0 0 6px rgba(255,0,110,0.5)',
                }}
              >
                {stats.best.toLocaleString('es-ES')}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{
                  color: 'var(--yellow)',
                  textShadow: '0 0 6px rgba(245,255,0,0.5)',
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/game/${game.id}/play`} className="btn xl pulse">
              ▶ JUGAR AHORA
            </Link>
            <Link href="/games" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <Leaderboard scores={scores} />
      </aside>
    </div>
  );
}
