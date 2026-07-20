export interface SnakeCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  onPauseChange: (isPaused: boolean) => void;
  onLevelChange: (level: number) => void;
}

export interface SnakeGame {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
const BASE_TICK_MS = 150;

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
): SnakeGame {
  void callbacks;

  const ctx = canvas.getContext('2d')!;
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  let snake: GridPoint[] = [];
  let direction: GridPoint = { x: 1, y: 0 };
  let pendingDirection: GridPoint = direction;
  let fruit: GridPoint & { sprite: string } = { x: 0, y: 0, sprite: 'apple' };
  let score = 0;
  let gameState: GameState = 'playing';
  const tickIntervalMs = BASE_TICK_MS;
  let tickAccumulator = 0;

  const fruitImage = new Image();
  let fruitImageLoaded = false;
  fruitImage.onload = () => {
    fruitImageLoaded = true;
  };
  fruitImage.src = FRUIT_SPRITE_SOURCE;

  let lastTime: number | null = null;
  let rafId: number | null = null;
  let destroyed = false;

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
      return;
    }

    snake.unshift(newHead);
    if (ateFruit) {
      score += 10;
      spawnFruit();
    } else {
      snake.pop();
    }
  }

  function drawWalls() {
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = WALL_THICKNESS;
    ctx.strokeRect(
      WALL_INSET,
      WALL_INSET,
      CANVAS_SIZE - WALL_INSET * 2,
      CANVAS_SIZE - WALL_INSET * 2,
    );
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
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

  function drawSnake() {
    snake.forEach((segment, i) => {
      ctx.fillStyle = i === 0 ? '#7fff7f' : '#22c55e';
      ctx.fillRect(
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2,
      );
    });
  }

  function drawFruit() {
    const sprite = FRUIT_SPRITES[fruit.sprite];
    if (fruitImageLoaded) {
      ctx.drawImage(
        fruitImage,
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
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawGrid();
    drawFruit();
    drawSnake();
    drawWalls();
  }

  function loop(timestamp: number) {
    const dt = lastTime === null ? 0 : timestamp - lastTime;
    lastTime = timestamp;

    if (gameState === 'playing') {
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
    const dir = KEY_DIRECTIONS[e.code];
    if (dir) {
      e.preventDefault();
      requestDirection(dir);
    }
  }

  window.addEventListener('keydown', handleKeyDown);

  initSnake();
  spawnFruit();
  rafId = requestAnimationFrame(loop);

  return {
    pause: () => {},
    resume: () => {},
    destroy: () => {
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      window.removeEventListener('keydown', handleKeyDown);
      void destroyed;
    },
  };
}
