import { SKIN_ORDER, type SkinName } from '../skins';

export interface SnakeCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  onPauseChange: (isPaused: boolean) => void;
  onLevelChange: (level: number) => void;
}

export interface SnakeOptions {
  skin?: SkinName;
}

export interface SnakeGame {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setSkin: (skin: SkinName) => void;
}

interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SnakePalette {
  bg: string;
  grid: string;
  wall: string;
  headFill: string;
  bodyFill: string;
  headStroke: string;
  eyeFill: string;
  glow: boolean;
  glowBlur: number;
  // Filtro CSS de canvas aplicado al copiar el atlas de frutas al canvas
  // offscreen de esta skin (ver `buildTintedFruitCanvas`). 'none' para
  // `classic`, que debe conservar el atlas original sin alterar.
  fruitFilter: string;
}

const SKIN_PALETTES: Record<SkinName, SnakePalette> = {
  classic: {
    bg: '#000',
    grid: 'rgba(255, 255, 255, 0.08)',
    wall: '#0f0',
    headFill: '#baffc9',
    bodyFill: '#22c55e',
    headStroke: '#052e0f',
    eyeFill: '#052e0f',
    glow: false,
    glowBlur: 0,
    fruitFilter: 'none',
  },
  neon: {
    bg: '#0a0014',
    grid: 'rgba(0,245,255,0.16)',
    wall: '#00f5ff',
    headFill: '#ffffff',
    bodyFill: '#ff00ff',
    headStroke: '#1a002a',
    eyeFill: '#1a002a',
    glow: true,
    glowBlur: 14,
    fruitFilter:
      'saturate(2.4) hue-rotate(260deg) brightness(1.15) contrast(1.1)',
  },
  retro: {
    bg: '#001100',
    grid: 'rgba(0,255,65,0.14)',
    wall: '#ffb000',
    headFill: '#c8ffd8',
    bodyFill: '#00ff41',
    headStroke: '#001a08',
    eyeFill: '#001a08',
    glow: true,
    glowBlur: 6,
    fruitFilter:
      'grayscale(1) sepia(1) hue-rotate(70deg) saturate(4) brightness(0.85)',
  },
};

// Transcrito de references/source-assets/snake-assets/sprites.js (SPRITE_ATLAS.fruits).
const FRUIT_SPRITES: Record<string, SpriteRect> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};
const FRUIT_SPRITE_KEYS = Object.keys(FRUIT_SPRITES);

const FRUIT_SPRITE_SOURCE = '/assets/snake/fruits.png';

const CANVAS_SIZE = 600;
const GRID_SIZE = 20;
const CELL_SIZE = CANVAS_SIZE / GRID_SIZE;
const WALL_INSET = 3;
const WALL_THICKNESS = 6;
const BASE_TICK_MS = 300;
const MIN_TICK_MS = 60;
const FRUITS_PER_LEVEL = 5;
const TICK_SPEEDUP_FACTOR = 0.9;

interface GridPoint {
  x: number;
  y: number;
}

type GameState = 'playing' | 'gameover';

function directionsOpposite(a: GridPoint, b: GridPoint): boolean {
  return a.x === -b.x && a.y === -b.y;
}

export function createGame(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
  options?: SnakeOptions,
): SnakeGame {
  const ctx = canvas.getContext('2d')!;
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  let currentSkin: SkinName = options?.skin ?? 'classic';
  let palette = SKIN_PALETTES[currentSkin];

  let snake: GridPoint[] = [];
  let direction: GridPoint = { x: 1, y: 0 };
  let pendingDirection: GridPoint = direction;
  let fruit: GridPoint & { sprite: string } = { x: 0, y: 0, sprite: 'apple' };
  let score = 0;
  let level = 1;
  let fruitsEaten = 0;
  let gameState: GameState = 'playing';
  let tickIntervalMs = BASE_TICK_MS;
  let tickAccumulator = 0;
  let isPaused = false;

  const fruitImage = new Image();
  let fruitImageLoaded = false;
  // Variante offscreen por skin: se tiñe una copia completa del atlas de
  // frutas por cada skin en cuanto la imagen carga, y `drawFruit` solo
  // conmuta cuál de esos canvas usa como fuente — sin regenerar nada en cada
  // frame ni tocar el estado de la partida.
  const tintedFruitAtlas: Partial<Record<SkinName, HTMLCanvasElement>> = {};

  function buildTintedFruitAtlas(skin: SkinName): HTMLCanvasElement {
    const offscreen = document.createElement('canvas');
    offscreen.width = fruitImage.naturalWidth;
    offscreen.height = fruitImage.naturalHeight;
    const octx = offscreen.getContext('2d')!;
    octx.filter = SKIN_PALETTES[skin].fruitFilter;
    octx.drawImage(fruitImage, 0, 0);
    return offscreen;
  }

  fruitImage.onload = () => {
    fruitImageLoaded = true;
    for (const skinName of SKIN_ORDER) {
      tintedFruitAtlas[skinName] = buildTintedFruitAtlas(skinName);
    }
  };
  fruitImage.src = FRUIT_SPRITE_SOURCE;

  let lastTime: number | null = null;
  let rafId: number | null = null;
  let destroyed = false;

  function setScore(next: number) {
    score = next;
    callbacks.onScoreChange(score);
  }

  function setLevel(next: number) {
    level = next;
    callbacks.onLevelChange(level);
  }

  function occupiedCells(): Set<string> {
    return new Set(snake.map((s) => `${s.x},${s.y}`));
  }

  function spawnFruit() {
    const occupied = occupiedCells();
    const free: GridPoint[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    const cell = free[Math.floor(Math.random() * free.length)];
    const sprite =
      FRUIT_SPRITE_KEYS[Math.floor(Math.random() * FRUIT_SPRITE_KEYS.length)];
    fruit = { x: cell.x, y: cell.y, sprite };
  }

  function initSnake() {
    const startX = Math.floor(GRID_SIZE / 2);
    const startY = Math.floor(GRID_SIZE / 2);
    snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    direction = { x: 1, y: 0 };
    pendingDirection = direction;
    score = 0;
    level = 1;
    fruitsEaten = 0;
    tickIntervalMs = BASE_TICK_MS;
    gameState = 'playing';
  }

  function tick() {
    if (gameState !== 'playing') return;

    direction = pendingDirection;
    const head = snake[0];
    const newHead: GridPoint = {
      x: head.x + direction.x,
      y: head.y + direction.y,
    };

    const hitWall =
      newHead.x < 0 ||
      newHead.x >= GRID_SIZE ||
      newHead.y < 0 ||
      newHead.y >= GRID_SIZE;
    const ateFruit = newHead.x === fruit.x && newHead.y === fruit.y;
    const bodyToCheck = ateFruit ? snake : snake.slice(0, -1);
    const hitSelf = bodyToCheck.some(
      (s) => s.x === newHead.x && s.y === newHead.y,
    );

    if (hitWall || hitSelf) {
      gameState = 'gameover';
      callbacks.onLivesChange(0);
      callbacks.onGameOver(score);
      return;
    }

    snake.unshift(newHead);
    if (ateFruit) {
      setScore(score + 10);
      fruitsEaten += 1;
      if (fruitsEaten % FRUITS_PER_LEVEL === 0) {
        tickIntervalMs = Math.max(
          MIN_TICK_MS,
          Math.round(tickIntervalMs * TICK_SPEEDUP_FACTOR),
        );
        setLevel(level + 1);
      }
      spawnFruit();
    } else {
      snake.pop();
    }
  }

  function drawWalls() {
    ctx.strokeStyle = palette.wall;
    ctx.lineWidth = WALL_THICKNESS;
    if (palette.glow) {
      ctx.shadowColor = palette.wall;
      ctx.shadowBlur = palette.glowBlur;
    }
    ctx.strokeRect(
      WALL_INSET,
      WALL_INSET,
      CANVAS_SIZE - WALL_INSET * 2,
      CANVAS_SIZE - WALL_INSET * 2,
    );
    if (palette.glow) ctx.shadowBlur = 0;
  }

  function drawGrid() {
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }
  }

  function drawEyes(head: GridPoint) {
    const cx = head.x * CELL_SIZE + CELL_SIZE / 2;
    const cy = head.y * CELL_SIZE + CELL_SIZE / 2;
    const offset = 7;
    const radius = 3;
    let e1: GridPoint;
    let e2: GridPoint;
    if (direction.x === 1) {
      e1 = { x: cx + offset, y: cy - offset };
      e2 = { x: cx + offset, y: cy + offset };
    } else if (direction.x === -1) {
      e1 = { x: cx - offset, y: cy - offset };
      e2 = { x: cx - offset, y: cy + offset };
    } else if (direction.y === -1) {
      e1 = { x: cx - offset, y: cy - offset };
      e2 = { x: cx + offset, y: cy - offset };
    } else {
      e1 = { x: cx - offset, y: cy + offset };
      e2 = { x: cx + offset, y: cy + offset };
    }
    ctx.fillStyle = palette.eyeFill;
    for (const eye of [e1, e2]) {
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSnake() {
    snake.forEach((segment, i) => {
      const isHead = i === 0;
      const fill = isHead ? palette.headFill : palette.bodyFill;
      ctx.fillStyle = fill;
      if (palette.glow) {
        ctx.shadowColor = fill;
        ctx.shadowBlur = palette.glowBlur * (isHead ? 1 : 0.6);
      }
      ctx.fillRect(
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2,
      );
      if (palette.glow) ctx.shadowBlur = 0;
      if (isHead) {
        ctx.strokeStyle = palette.headStroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(
          segment.x * CELL_SIZE + 2,
          segment.y * CELL_SIZE + 2,
          CELL_SIZE - 4,
          CELL_SIZE - 4,
        );
        drawEyes(segment);
      }
    });
  }

  function drawFruit() {
    const sprite = FRUIT_SPRITES[fruit.sprite];
    const source = tintedFruitAtlas[currentSkin];
    if (fruitImageLoaded && source) {
      ctx.drawImage(
        source,
        sprite.x,
        sprite.y,
        sprite.w,
        sprite.h,
        fruit.x * CELL_SIZE,
        fruit.y * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE,
      );
    }
  }

  function draw() {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawGrid();
    drawFruit();
    drawSnake();
    drawWalls();
  }

  function loop(timestamp: number) {
    const dt = lastTime === null ? 0 : timestamp - lastTime;
    lastTime = timestamp;

    if (gameState === 'playing' && !isPaused) {
      tickAccumulator += dt;
      while (tickAccumulator >= tickIntervalMs) {
        tick();
        tickAccumulator -= tickIntervalMs;
        if (gameState !== 'playing') break;
      }
    }

    draw();
    rafId = requestAnimationFrame(loop);
  }

  function setPaused(next: boolean) {
    if (gameState !== 'playing' || isPaused === next) return;
    isPaused = next;
    if (!isPaused) lastTime = null;
    callbacks.onPauseChange(isPaused);
  }

  function requestDirection(next: GridPoint) {
    if (directionsOpposite(next, direction)) return;
    pendingDirection = next;
  }

  const KEY_DIRECTIONS: Record<string, GridPoint> = {
    ArrowUp: { x: 0, y: -1 },
    KeyW: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    KeyS: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    KeyA: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    KeyD: { x: 1, y: 0 },
  };

  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
    ) {
      return;
    }

    const dir = KEY_DIRECTIONS[e.code];
    if (dir) {
      e.preventDefault();
      requestDirection(dir);
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      setPaused(!isPaused);
    }
  }

  window.addEventListener('keydown', handleKeyDown);

  initSnake();
  spawnFruit();
  callbacks.onLivesChange(1);
  callbacks.onLevelChange(level);
  callbacks.onScoreChange(score);
  rafId = requestAnimationFrame(loop);

  return {
    pause() {
      setPaused(true);
    },
    resume() {
      setPaused(false);
    },
    destroy() {
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      window.removeEventListener('keydown', handleKeyDown);
      void destroyed;
    },
    setSkin(skin: SkinName) {
      currentSkin = skin;
      palette = SKIN_PALETTES[skin];
      draw();
    },
  };
}
