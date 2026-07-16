import { GAMES } from '@/app/data/games';
import { seededScores } from '@/app/data/players';
import { getAsteroidsScores } from '@/app/lib/supabase/queries';
import type { ScoreRow } from '@/app/data/types';
import HallOfFameClient from './HallOfFameClient';

export default async function HallOfFamePage() {
  const asteroidsScores = await getAsteroidsScores(12);

  const scoresByGame: Record<string, ScoreRow[]> = {};
  for (const g of GAMES) {
    scoresByGame[g.id] =
      g.id === 'asteroids'
        ? asteroidsScores
        : seededScores(g.id.length * 23 + 7, 12);
  }

  return <HallOfFameClient games={GAMES} scoresByGame={scoresByGame} />;
}
