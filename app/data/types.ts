export type GameCategory = 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS';

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string; // clase CSS del gradiente (ej. "cover-bricks")
  color: 'cyan' | 'magenta' | 'yellow' | 'green';
  best: number;
  plays: string; // ej. "12.4K"
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/AAAA"
}

export interface User {
  name: string;
}

export const CATS = ['TODOS', 'ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS'] as const;
