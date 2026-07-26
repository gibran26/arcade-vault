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

// El fondo+grid, el borde con glow, el cuerpo de cada segmento y la cabeza
// (contorno + ojos) tienen geometría fija: solo cambian de posición/color
// por skin, nunca de forma frame a frame. Se cachean en canvas offscreen
// construidos una sola vez (y reconstruidos en `setSkin`) en vez de
// retrazarse/recalcular `shadowBlur` cada frame — mismo tratamiento aplicado
// a Frogger (spec 11).
//
// Margen de sangrado reservado en los sprites que hornean el `shadowBlur`:
// cubre con holgura el desenfoque visible incluso en el glowBlur más alto
// del catálogo de este motor (14, `neon`), igual que `GLOW_MARGIN` en
// frogger/engine.ts.
const GLOW_MARGIN = 28;
const BODY_SPRITE_SIZE = Math.ceil(CELL_SIZE - 2 + GLOW_MARGIN * 2);
const HEAD_SPRITE_SIZE = BODY_SPRITE_SIZE;

// La cabeza solo tiene 4 orientaciones posibles (arriba/abajo/izquierda/
// derecha): se cachean las 4 variantes completas (relleno + contorno + ojos)
// en vez de recalcular la posición de los ojos cada frame.
type SnakeDirKey = 'up' | 'down' | 'left' | 'right';
const SNAKE_DIR_KEYS: SnakeDirKey[] = ['up', 'down', 'left', 'right'];

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

  // Fondo + grid: geometría 100% fija, se pinta una vez y se blitea con
  // `drawImage` en vez de retrazar 19x2 líneas por frame (ver `buildStaticLayer`).
  const staticLayer = document.createElement('canvas');
  staticLayer.width = CANVAS_SIZE;
  staticLayer.height = CANVAS_SIZE;
  const staticCtx = staticLayer.getContext('2d')!;

  // Borde con glow: se dibuja al final (encima de la serpiente, igual que
  // antes) pero desde un canvas transparente cacheado, con el `shadowBlur`
  // horneado una sola vez en vez de asignarlo/resetearlo cada frame.
  const wallLayer = document.createElement('canvas');
  wallLayer.width = CANVAS_SIZE;
  wallLayer.height = CANVAS_SIZE;
  const wallCtx = wallLayer.getContext('2d')!;

  // Sprite único del cuerpo (mismo cuadrado para todos los segmentos, solo
  // cambia la posición): el glow ya viene horneado (ver `buildBodySprite`).
  const bodySprite = document.createElement('canvas');
  bodySprite.width = BODY_SPRITE_SIZE;
  bodySprite.height = BODY_SPRITE_SIZE;
  const bodyCtx = bodySprite.getContext('2d')!;

  // 4 variantes de cabeza (una por dirección), con relleno+glow, contorno y
  // ojos ya compuestos (ver `buildHeadSprites`).
  const headSprites = {} as Record<SnakeDirKey, HTMLCanvasElement>;
  const headSpriteCtxs = {} as Record<SnakeDirKey, CanvasRenderingContext2D>;
  for (const key of SNAKE_DIR_KEYS) {
    const sprite = document.createElement('canvas');
    sprite.width = HEAD_SPRITE_SIZE;
    sprite.height = HEAD_SPRITE_SIZE;
    headSprites[key] = sprite;
    headSpriteCtxs[key] = sprite.getContext('2d')!;
  }

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

  // Construye una sola vez (y en cada `setSkin`) el fondo + grid en un canvas
  // offscreen: geometría 100% fija, antes se retrazaban 19x2 líneas por
  // frame sin necesidad (spec 11, mismo tratamiento que `drawStaticLayer` de
  // Frogger).
  function buildStaticLayer() {
    staticCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    staticCtx.fillStyle = palette.bg;
    staticCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    staticCtx.strokeStyle = palette.grid;
    staticCtx.lineWidth = 1;
    for (let i = 1; i < GRID_SIZE; i++) {
      staticCtx.beginPath();
      staticCtx.moveTo(i * CELL_SIZE, 0);
      staticCtx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      staticCtx.stroke();
      staticCtx.beginPath();
      staticCtx.moveTo(0, i * CELL_SIZE);
      staticCtx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      staticCtx.stroke();
    }
  }

  // El borde nunca cambia de forma ni de posición: el `shadowBlur` se
  // hornea una sola vez aquí (antes se asignaba/reseteaba cada frame para
  // una figura estática).
  function buildWallLayer() {
    wallCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    wallCtx.strokeStyle = palette.wall;
    wallCtx.lineWidth = WALL_THICKNESS;
    if (palette.glow) {
      wallCtx.shadowColor = palette.wall;
      wallCtx.shadowBlur = palette.glowBlur;
    }
    wallCtx.strokeRect(
      WALL_INSET,
      WALL_INSET,
      CANVAS_SIZE - WALL_INSET * 2,
      CANVAS_SIZE - WALL_INSET * 2,
    );
    if (palette.glow) wallCtx.shadowBlur = 0;
  }

  // Sprite único del cuerpo: mismo cuadrado para cualquier segmento, con el
  // glow horneado una sola vez (antes: `shadowBlur` asignado/reseteado
  // dentro del bucle por segmento en `drawSnake`, igual que el antipatrón ya
  // corregido en `drawTurtleGroup` de Frogger).
  function buildBodySprite() {
    bodyCtx.clearRect(0, 0, BODY_SPRITE_SIZE, BODY_SPRITE_SIZE);
    bodyCtx.fillStyle = palette.bodyFill;
    if (palette.glow) {
      bodyCtx.shadowColor = palette.bodyFill;
      bodyCtx.shadowBlur = palette.glowBlur * 0.6;
    }
    bodyCtx.fillRect(
      GLOW_MARGIN + 1,
      GLOW_MARGIN + 1,
      CELL_SIZE - 2,
      CELL_SIZE - 2,
    );
    if (palette.glow) bodyCtx.shadowBlur = 0;
  }

  function dirKey(d: GridPoint): SnakeDirKey {
    if (d.x === 1) return 'right';
    if (d.x === -1) return 'left';
    if (d.y === -1) return 'up';
    return 'down';
  }

  function eyeOffsetsFor(
    key: SnakeDirKey,
    cx: number,
    cy: number,
  ): { e1: GridPoint; e2: GridPoint } {
    const offset = 7;
    if (key === 'right') {
      return {
        e1: { x: cx + offset, y: cy - offset },
        e2: { x: cx + offset, y: cy + offset },
      };
    }
    if (key === 'left') {
      return {
        e1: { x: cx - offset, y: cy - offset },
        e2: { x: cx - offset, y: cy + offset },
      };
    }
    if (key === 'up') {
      return {
        e1: { x: cx - offset, y: cy - offset },
        e2: { x: cx + offset, y: cy - offset },
      };
    }
    return {
      e1: { x: cx - offset, y: cy + offset },
      e2: { x: cx + offset, y: cy + offset },
    };
  }

  // Las 4 orientaciones de la cabeza (relleno+glow, contorno y ojos) se
  // cachean completas: antes `drawEyes` recalculaba la posición de los ojos
  // cada frame y `drawSnake` asignaba `shadowBlur` en vivo para el relleno.
  function buildHeadSprites() {
    for (const key of SNAKE_DIR_KEYS) {
      const hctx = headSpriteCtxs[key];
      hctx.clearRect(0, 0, HEAD_SPRITE_SIZE, HEAD_SPRITE_SIZE);
      hctx.fillStyle = palette.headFill;
      if (palette.glow) {
        hctx.shadowColor = palette.headFill;
        hctx.shadowBlur = palette.glowBlur;
      }
      hctx.fillRect(
        GLOW_MARGIN + 1,
        GLOW_MARGIN + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2,
      );
      if (palette.glow) hctx.shadowBlur = 0;

      hctx.strokeStyle = palette.headStroke;
      hctx.lineWidth = 2;
      hctx.strokeRect(
        GLOW_MARGIN + 2,
        GLOW_MARGIN + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4,
      );

      const cx = GLOW_MARGIN + CELL_SIZE / 2;
      const cy = GLOW_MARGIN + CELL_SIZE / 2;
      const { e1, e2 } = eyeOffsetsFor(key, cx, cy);
      hctx.fillStyle = palette.eyeFill;
      for (const eye of [e1, e2]) {
        hctx.beginPath();
        hctx.arc(eye.x, eye.y, 3, 0, Math.PI * 2);
        hctx.fill();
      }
    }
  }

  function drawSnake() {
    snake.forEach((segment, i) => {
      const isHead = i === 0;
      // Sprites offscreen cacheados (`buildBodySprite`/`buildHeadSprites`):
      // el glow ya viene horneado, sin `shadowBlur` en vivo por segmento y
      // por frame (spec 11, mismo tratamiento que `drawTurtleGroup`).
      const sprite = isHead ? headSprites[dirKey(direction)] : bodySprite;
      ctx.drawImage(
        sprite,
        segment.x * CELL_SIZE - GLOW_MARGIN,
        segment.y * CELL_SIZE - GLOW_MARGIN,
      );
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
    // Fondo+grid cacheados (`buildStaticLayer`): un solo `drawImage` en vez
    // de un `fillRect` + 38 `stroke()` de grid cada frame.
    ctx.drawImage(staticLayer, 0, 0);
    drawFruit();
    drawSnake();
    // El borde se dibuja al final (encima de la serpiente, mismo orden que
    // antes) desde el sprite cacheado con el glow ya horneado.
    ctx.drawImage(wallLayer, 0, 0);
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
  buildStaticLayer();
  buildWallLayer();
  buildBodySprite();
  buildHeadSprites();
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
      // El fondo/grid, el borde y los sprites de cuerpo/cabeza viven en
      // canvas offscreen cacheados: hay que regenerarlos todos con la nueva
      // paleta antes de repintar el frame actual (mismo contrato que
      // `setSkin` en frogger/engine.ts).
      buildStaticLayer();
      buildWallLayer();
      buildBodySprite();
      buildHeadSprites();
      draw();
    },
  };
}
