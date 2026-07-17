import { createClient } from './server';
import type { Game, ScoreRow } from '@/app/data/types';

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, title, short, long, cat, cover, color');
  if (gamesError) throw gamesError;

  const { data: scores, error: scoresError } = await supabase
    .from('scores')
    .select('game_id, score');
  if (scoresError) throw scoresError;

  const statsByGame = new Map<string, { best: number; plays: number }>();
  for (const row of scores ?? []) {
    const stats = statsByGame.get(row.game_id) ?? { best: 0, plays: 0 };
    stats.best = Math.max(stats.best, row.score);
    stats.plays += 1;
    statsByGame.set(row.game_id, stats);
  }

  return (games ?? []).map((game) => {
    const stats = statsByGame.get(game.id) ?? { best: 0, plays: 0 };
    return { ...game, best: stats.best, plays: String(stats.plays) };
  });
}

export async function getGame(gameId: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id, title, short, long, cat, cover, color')
    .eq('id', gameId)
    .maybeSingle();
  if (gameError) throw gameError;
  if (!game) return null;

  const stats = await getStats(gameId);
  return { ...game, best: stats.best, plays: String(stats.plays) };
}

export async function getScores(
  gameId: string,
  limit?: number,
): Promise<ScoreRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('scores')
    .select('player_name, score, created_at')
    .eq('game_id', gameId)
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

export async function getStats(gameId: string): Promise<{
  best: number;
  plays: number;
}> {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from('scores')
    .select('score', { count: 'exact' })
    .eq('game_id', gameId);

  if (error) throw error;

  const best = (data ?? []).reduce((max, row) => Math.max(max, row.score), 0);
  return { best, plays: count ?? 0 };
}

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
