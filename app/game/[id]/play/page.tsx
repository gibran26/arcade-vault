import { notFound } from 'next/navigation';
import { getGame } from '@/app/lib/supabase/queries';
import { GAME_ENGINES } from '@/app/game-engines/registry';
import GamePlayClient from './GamePlayClient';

export default async function GamePlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game || !GAME_ENGINES[id]) notFound();

  return <GamePlayClient game={game} />;
}
