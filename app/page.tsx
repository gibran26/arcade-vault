import { getGames } from '@/app/lib/supabase/queries';
import HomeClient from '@/app/HomeClient';

export default async function Home() {
  const games = await getGames();

  return <HomeClient games={games} />;
}
