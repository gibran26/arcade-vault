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

export interface JoystickMapping {
  up?: string;
  down?: string;
  left?: string;
  right?: string;
}

export interface ActionButtonMapping {
  code: string;
  label: string;
  icon: 'rotate' | 'shoot' | 'thrust' | 'drop';
}

export interface TouchControlsSchema {
  directions: 4 | 8;
  joystick: JoystickMapping;
  buttonA?: ActionButtonMapping;
  buttonB?: ActionButtonMapping;
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
  touchControls?: TouchControlsSchema;
}

export const GAME_ENGINES: Record<string, EngineEntry> = {
  asteroids: {
    createGame: asteroidsCreateGame,
    width: 800,
    height: 600,
    skins: SKIN_ORDER,
    touchControls: {
      directions: 4,
      joystick: { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp' },
      buttonA: { code: 'Space', label: 'DISPARAR', icon: 'shoot' },
    },
  },
  tetris: {
    createGame: tetrisCreateGame,
    width: 480,
    height: 600,
    skins: SKIN_ORDER,
    touchControls: {
      directions: 4,
      joystick: { left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown' },
      buttonA: { code: 'ArrowUp', label: 'ROTAR', icon: 'rotate' },
      buttonB: { code: 'Space', label: 'CAÍDA', icon: 'drop' },
    },
  },
  arkanoid: {
    createGame: arkanoidCreateGame,
    width: 800,
    height: 600,
    skins: SKIN_ORDER,
    touchControls: {
      directions: 4,
      joystick: { left: 'ArrowLeft', right: 'ArrowRight' },
    },
  },
  snake: {
    createGame: snakeCreateGame,
    width: 600,
    height: 600,
    skins: SKIN_ORDER,
    touchControls: {
      directions: 4,
      joystick: {
        up: 'ArrowUp',
        down: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight',
      },
    },
  },
};
