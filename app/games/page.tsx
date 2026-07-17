import { getGames } from '@/app/lib/supabase/queries';
import GamesClient from './GamesClient';

export default async function Games() {
  const games = await getGames();

  return <GamesClient games={games} />;
}
