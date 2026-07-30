'use server';

import { createClient } from './server';

export async function saveScore(
  gameId: string,
  playerName: string,
  score: number,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('scores').insert({
    game_id: gameId,
    player_name: playerName,
    score,
    user_id: user?.id ?? null,
  });

  if (error) throw error;
}

const GENERIC_LOGIN_ERROR = 'Usuario o contraseña incorrectos';

export async function signInWithUsername(
  username: string,
  password: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('username', username)
    .single();

  if (!profile) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (error) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  return { error: null };
}
