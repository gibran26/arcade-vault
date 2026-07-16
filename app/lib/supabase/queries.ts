import { createClient } from './server';
import type { ScoreRow } from '@/app/data/types';

export async function getAsteroidsGame(): Promise<{
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: string;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('games')
    .select('title, short, long, cat, cover, color')
    .eq('id', 'asteroids')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAsteroidsScores(limit?: number): Promise<ScoreRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('scores')
    .select('player_name, score, created_at')
    .eq('game_id', 'asteroids')
    .order('score', { ascending: false });

  if (limit !== undefined) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row, i) => {
    const date = new Date(row.created_at);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return {
      rank: i + 1,
      name: row.player_name,
      score: row.score,
      date: `${day}/${month}/${year}`,
    };
  });
}

export async function getAsteroidsStats(): Promise<{
  best: number;
  plays: number;
}> {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from('scores')
    .select('score', { count: 'exact' })
    .eq('game_id', 'asteroids');

  if (error) throw error;

  const best = (data ?? []).reduce((max, row) => Math.max(max, row.score), 0);
  return { best, plays: count ?? 0 };
}

export async function saveAsteroidsScore(
  playerName: string,
  score: number,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('scores')
    .insert({
      game_id: 'asteroids',
      player_name: playerName,
      score,
      user_id: null,
    });

  if (error) throw error;
}
