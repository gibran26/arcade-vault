import { createGame as arkanoidCreateGame } from './arkanoid/engine';
import { createGame as asteroidsCreateGame } from './asteroids/engine';
import { createGame as snakeCreateGame } from './snake/engine';
import { createGame as tetrisCreateGame } from './tetris/engine';
import { SKIN_ORDER, type SkinName } from './skins';

export interface EngineCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  onPauseChange: (isPaused: boolean) => void;
  onLevelChange: (level: number) => void;
}

export interface EngineOptions {
  skin?: SkinName;
}

export interface EngineInstance {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setSkin?: (skin: SkinName) => void;
}

interface EngineEntry {
  createGame: (
    canvas: HTMLCanvasElement,
    callbacks: EngineCallbacks,
    options?: EngineOptions,
  ) => EngineInstance;
  width: number;
  height: number;
  skins?: SkinName[];
}

export const GAME_ENGINES: Record<string, EngineEntry> = {
  asteroids: {
    createGame: asteroidsCreateGame,
    width: 800,
    height: 600,
    skins: SKIN_ORDER,
  },
  tetris: {
    createGame: tetrisCreateGame,
    width: 480,
    height: 600,
    skins: SKIN_ORDER,
  },
  arkanoid: { createGame: arkanoidCreateGame, width: 800, height: 600 },
  snake: { createGame: snakeCreateGame, width: 600, height: 600 },
};
