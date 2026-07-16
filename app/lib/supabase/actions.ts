'use server';

import { createClient } from './server';

export async function saveAsteroidsScore(
  playerName: string,
  score: number,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('scores').insert({
    game_id: 'asteroids',
    player_name: playerName,
    score,
    user_id: null,
  });

  if (error) throw error;
}
