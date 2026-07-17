import type { ScoreRow } from '@/app/data/types';
import { getGames, getScores } from '@/app/lib/supabase/queries';
import HallOfFameClient from './HallOfFameClient';

export default async function HallOfFamePage() {
  const games = await getGames();

  const scoresByGame: Record<string, ScoreRow[]> = {};
  await Promise.all(
    games.map(async (g) => {
      scoresByGame[g.id] = await getScores(g.id, 12);
    }),
  );

  return <HallOfFameClient games={games} scoresByGame={scoresByGame} />;
}
