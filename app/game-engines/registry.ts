import { createGame as arkanoidCreateGame } from './arkanoid/engine';
import { createGame as asteroidsCreateGame } from './asteroids/engine';
import { createGame as tetrisCreateGame } from './tetris/engine';

export interface EngineCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  onPauseChange: (isPaused: boolean) => void;
  onLevelChange: (level: number) => void;
}

export interface EngineInstance {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

interface EngineEntry {
  createGame: (
    canvas: HTMLCanvasElement,
    callbacks: EngineCallbacks,
  ) => EngineInstance;
  width: number;
  height: number;
}

export const GAME_ENGINES: Record<string, EngineEntry> = {
  asteroids: { createGame: asteroidsCreateGame, width: 800, height: 600 },
  tetris: { createGame: tetrisCreateGame, width: 480, height: 600 },
  arkanoid: { createGame: arkanoidCreateGame, width: 800, height: 600 },
};
