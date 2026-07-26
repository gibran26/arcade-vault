import { SKIN_ORDER, type SkinName } from '../skins';

export interface ArkanoidCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  onPauseChange: (isPaused: boolean) => void;
  onLevelChange: (level: number) => void;
}

export interface ArkanoidOptions {
  skin?: SkinName;
}

export interface ArkanoidGame {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setSkin: (skin: SkinName) => void;
}

interface ArkanoidPalette {
  bg: string;
  hudText: string;
  overlayBg: string;
  overlayText: string;
  pauseOverlayBg: string;
  pauseTitle: string;
  pauseSub: string;
  pauseBorder: string;
  pauseActiveFill: string;
  pauseActiveText: string;
  pauseInactiveFill: string;
  pauseInactiveText: string;
  glow: boolean;
  glowColor: string;
  glowBlur: number;
  /** Filtro de canvas aplicado al copiar el atlas del spritesheet para esta skin. */
  atlasFilter: string;
}

const SKIN_PALETTES: Record<SkinName, ArkanoidPalette> = {
  classic: {
    bg: '#000',
    hudText: '#fff',
    overlayBg: 'rgba(0, 0, 0, 0.6)',
    overlayText: '#fff',
    pauseOverlayBg: 'rgba(0, 0, 0, 0.65)',
    pauseTitle: '#fff',
    pauseSub: '#fff',
    pauseBorder: '#fff',
    pauseActiveFill: '#f0c040',
    pauseActiveText: '#000',
    pauseInactiveFill: '#444',
    pauseInactiveText: '#fff',
    glow: false,
    glowColor: '',
    glowBlur: 0,
    atlasFilter: 'none',
  },
  neon: {
    bg: '#050014',
    hudText: '#00f5ff',
    overlayBg: 'rgba(10, 0, 24, 0.65)',
    overlayText: '#ff00ff',
    pauseOverlayBg: 'rgba(10, 0, 24, 0.7)',
    pauseTitle: '#00f5ff',
    pauseSub: '#ff00ff',
    pauseBorder: '#00f5ff',
    pauseActiveFill: '#ff00ff',
    pauseActiveText: '#000',
    pauseInactiveFill: '#1a0033',
    pauseInactiveText: '#00f5ff',
    glow: true,
    glowColor: '#00f5ff',
    glowBlur: 16,
    atlasFilter:
      'saturate(2.4) brightness(1.15) contrast(1.05) hue-rotate(-8deg)',
  },
  retro: {
    bg: '#001100',
    hudText: '#00ff41',
    overlayBg: 'rgba(0, 20, 0, 0.65)',
    overlayText: '#00ff41',
    pauseOverlayBg: 'rgba(0, 20, 0, 0.7)',
    pauseTitle: '#00ff41',
    pauseSub: '#00ff41',
    pauseBorder: '#00ff41',
    pauseActiveFill: '#ffb000',
    pauseActiveText: '#000',
    pauseInactiveFill: '#003300',
    pauseInactiveText: '#00ff41',
    glow: true,
    glowColor: '#00ff41',
    glowBlur: 8,
    atlasFilter:
      'grayscale(1) sepia(1) hue-rotate(70deg) saturate(4) brightness(1.05)',
  },
};

const CANVAS_W = 800;

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (CANVAS_W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

const PAUSE_BTN_W = 60;
const PAUSE_BTN_H = 40;
const PAUSE_BTN_GAP = 12;
const PAUSE_BTN_Y = 340;
const PAUSE_BTN_ROW_X = (CANVAS_W - (5 * PAUSE_BTN_W + 4 * PAUSE_BTN_GAP)) / 2;

// Margen de sangrado reservado en los sprites que hornean el `shadowBlur`
// (spec 11, mismo patrón aplicado aquí): cubre con holgura el `glowBlur` más
// alto del catálogo de paletas de este motor (16, `neon`), con la misma
// proporción ~2x que usó Frogger (margen 28 para blur 14).
const GLOW_MARGIN = 32;

type BlockColor =
  'red' | 'yellow' | 'cyan' | 'magenta' | 'hotpink' | 'green' | 'gray';

const BLOCK_COLORS: BlockColor[] = [
  'red',
  'yellow',
  'cyan',
  'magenta',
  'hotpink',
  'green',
  'gray',
];

interface SpriteFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const EXPLOSION_FRAMES: Record<BlockColor, SpriteFrame[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

const EXPLOSION_DURATION = 150;

const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  } satisfies Record<BlockColor, SpriteFrame>,
};

interface LevelBlock {
  col: number;
  row: number;
  color: BlockColor;
}

interface Level {
  speed: number;
  blocks: LevelBlock[];
}

const LEVELS: Level[] = (() => {
  const rowColors1: BlockColor[] = [
    'red',
    'yellow',
    'cyan',
    'magenta',
    'hotpink',
    'green',
  ];
  const rowColors2: BlockColor[] = [
    'gray',
    'cyan',
    'hotpink',
    'yellow',
    'magenta',
    'green',
  ];
  const rowColors4: BlockColor[] = [
    'cyan',
    'magenta',
    'green',
    'yellow',
    'hotpink',
    'red',
  ];

  const l1: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: LevelBlock[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? 'yellow' : 'magenta' });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? 'hotpink' : 'cyan' });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
}

type GameState = 'playing' | 'gameover' | 'win';

export function createGame(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks,
  options?: ArkanoidOptions,
): ArkanoidGame {
  const ctx = canvas.getContext('2d')!;
  let currentSkin: SkinName = options?.skin ?? 'classic';
  let palette = SKIN_PALETTES[currentSkin];

  const paddle: Paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball: Ball = { x: 0, y: 0, w: 16, h: 16, vx: 0, vy: 0 };

  // Web Audio API en vez de `new Audio(...).cloneNode().play()`: un clon de
  // `<audio>` no hereda el audio ya decodificado, así que cada colisión
  // forzaba decodificar el MP3 desde cero — barato en escritorio, pero en el
  // CPU de un móvil (compitiendo con el propio loop de juego) causaba tanto
  // retraso audible como cuelgues del frame. Decodificando una sola vez a un
  // `AudioBuffer` y reproduciéndolo con `AudioBufferSourceNode`, cada disparo
  // es solo programar PCM ya decodificado: latencia mínima, sin recompetir
  // por CPU.
  let audioCtx: AudioContext | null = null;
  let bounceBuffer: AudioBuffer | null = null;
  let breakBuffer: AudioBuffer | null = null;

  function loadSound(ctx: AudioContext, url: string): Promise<AudioBuffer> {
    return fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data));
  }

  function getAudioContext(): AudioContext | null {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextCtor();
      Promise.all([
        loadSound(audioCtx, '/assets/arkanoid/ball-bounce.mp3'),
        loadSound(audioCtx, '/assets/arkanoid/break-sound.mp3'),
      ])
        .then(([bounce, brk]) => {
          bounceBuffer = bounce;
          breakBuffer = brk;
        })
        .catch(() => {});
    }
    return audioCtx;
  }

  function playSound(buffer: AudioBuffer | null) {
    if (!audioCtx || !buffer) return;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
  }

  // El `AudioContext` nace suspendido en la mayoría de navegadores móviles
  // hasta que se reanuda dentro de un gesto real del usuario — igual que el
  // desbloqueo de `<audio>`, pero explícito para la Web Audio API. Se
  // reanuda en el mismo lanzamiento manual de la pelota (`launchBall()`), que
  // ya es el gesto real que gatea todo el audio de esta partida.
  function unlockAudio() {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = 3;
  let score = 0;
  let gameState: GameState = 'playing';
  let currentLevel = 1;
  let isPaused = false;
  let gameOverFired = false;
  // La pelota nace pegada al paddle y no se mueve hasta que el jugador la
  // lanza. Además de ser la mecánica clásica, garantiza que la primera
  // llamada a `.play()` de un sonido ocurra después de un gesto real del
  // usuario, que es lo que desbloquea el audio en móvil (ver la entrada de
  // este bug en `references/pendent-fixes-todo.md`).
  let ballLaunched = false;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  // Un atlas offscreen por skin: `classic` es el original sin teñir; `neon`
  // y `retro` aplican un filtro de canvas al copiarlo (ver SKIN_PALETTES).
  const ssVariants: Partial<Record<SkinName, HTMLCanvasElement>> = {};
  let ssLoaded = false;

  // Sprites con el glow ya horneado para la skin vigente (spec 11, mismo
  // patrón que Frogger paso 3): antes, `withGlow` aplicaba `ctx.shadowBlur`
  // en vivo dentro de los bucles de bloques/explosiones (hasta 60 bloques por
  // frame en el nivel 1) y en paddle/bola/vidas — ahora cada elemento se
  // recorta una sola vez a un canvas offscreen con el glow ya horneado, y el
  // loop de dibujo solo hace `drawImage` sin tocar `shadowBlur`.
  const paddleSprite = document.createElement('canvas');
  paddleSprite.width = paddle.w + GLOW_MARGIN * 2;
  paddleSprite.height = paddle.h + GLOW_MARGIN * 2;
  const paddleSpriteCtx = paddleSprite.getContext('2d')!;

  const ballSprite = document.createElement('canvas');
  ballSprite.width = ball.w + GLOW_MARGIN * 2;
  ballSprite.height = ball.h + GLOW_MARGIN * 2;
  const ballSpriteCtx = ballSprite.getContext('2d')!;

  const blockSprites = {} as Record<BlockColor, HTMLCanvasElement>;
  const blockSpriteCtxs = {} as Record<BlockColor, CanvasRenderingContext2D>;
  for (const color of BLOCK_COLORS) {
    const sprite = document.createElement('canvas');
    sprite.width = BLOCK_W + GLOW_MARGIN * 2;
    sprite.height = BLOCK_H + GLOW_MARGIN * 2;
    blockSprites[color] = sprite;
    blockSpriteCtxs[color] = sprite.getContext('2d')!;
  }

  // Las explosiones comparten tamaño con los bloques (`exp.w/h` se crean a
  // partir de `block.w/h`): 4 variantes de frame por color, cacheadas igual.
  const explosionSprites = {} as Record<BlockColor, HTMLCanvasElement[]>;
  const explosionSpriteCtxs = {} as Record<
    BlockColor,
    CanvasRenderingContext2D[]
  >;
  for (const color of BLOCK_COLORS) {
    explosionSprites[color] = EXPLOSION_FRAMES[color].map(() => {
      const sprite = document.createElement('canvas');
      sprite.width = BLOCK_W + GLOW_MARGIN * 2;
      sprite.height = BLOCK_H + GLOW_MARGIN * 2;
      return sprite;
    });
    explosionSpriteCtxs[color] = explosionSprites[color].map((sprite) =>
      sprite.getContext('2d')!,
    );
  }

  const keys: Record<'ArrowLeft' | 'ArrowRight', boolean> = {
    ArrowLeft: false,
    ArrowRight: false,
  };

  let lastTime: number | null = null;
  let rafId: number | null = null;
  let destroyed = false;

  function loadSpritesheet(cb: () => void) {
    const rawImg = new Image();
    rawImg.onload = () => {
      for (const skin of SKIN_ORDER) {
        const oc = document.createElement('canvas');
        oc.width = rawImg.width;
        oc.height = rawImg.height;
        const octx = oc.getContext('2d')!;
        octx.filter = SKIN_PALETTES[skin].atlasFilter;
        octx.drawImage(rawImg, 0, 0);
        octx.filter = 'none';
        ssVariants[skin] = oc;
      }
      ssLoaded = true;
      cb();
    };
    rawImg.onerror = () => console.error('Failed to load spritesheet');
    rawImg.src = '/assets/arkanoid/spritesheet-breakout.png';
  }

  // Builders de caché: hornean el `shadowBlur` de la skin vigente una sola
  // vez por elemento/variante (spec 11, mismo contrato que
  // `buildTurtleSprites`/`buildLogSprites` de Frogger), en vez de aplicarlo
  // en vivo dentro de los bucles de dibujo. Se llaman al cargar el atlas y de
  // nuevo, íntegras, dentro de `setSkin()`.
  function buildPaddleSprite() {
    const atlas = ssVariants[currentSkin];
    paddleSpriteCtx.clearRect(0, 0, paddleSprite.width, paddleSprite.height);
    if (!atlas) return;
    if (palette.glow) {
      paddleSpriteCtx.shadowColor = palette.glowColor;
      paddleSpriteCtx.shadowBlur = palette.glowBlur;
    }
    paddleSpriteCtx.drawImage(
      atlas,
      SPRITES.paddle.sx,
      SPRITES.paddle.sy,
      SPRITES.paddle.sw,
      SPRITES.paddle.sh,
      GLOW_MARGIN,
      GLOW_MARGIN,
      paddle.w,
      paddle.h,
    );
    if (palette.glow) paddleSpriteCtx.shadowBlur = 0;
  }

  function buildBallSprite() {
    const atlas = ssVariants[currentSkin];
    ballSpriteCtx.clearRect(0, 0, ballSprite.width, ballSprite.height);
    if (!atlas) return;
    if (palette.glow) {
      ballSpriteCtx.shadowColor = palette.glowColor;
      ballSpriteCtx.shadowBlur = palette.glowBlur;
    }
    ballSpriteCtx.drawImage(
      atlas,
      SPRITES.ball.sx,
      SPRITES.ball.sy,
      SPRITES.ball.sw,
      SPRITES.ball.sh,
      GLOW_MARGIN,
      GLOW_MARGIN,
      ball.w,
      ball.h,
    );
    if (palette.glow) ballSpriteCtx.shadowBlur = 0;
  }

  // Solo hay 7 colores de bloque posibles (`BLOCK_COLORS`), cada uno con un
  // único frame estático: se cachea una variante por color en vez de aplicar
  // `shadowBlur` hasta 60 veces por frame (nivel 1 con el tablero lleno).
  function buildBlockSprites() {
    const atlas = ssVariants[currentSkin];
    for (const color of BLOCK_COLORS) {
      const bctx = blockSpriteCtxs[color];
      const sprite = blockSprites[color];
      bctx.clearRect(0, 0, sprite.width, sprite.height);
      if (!atlas) continue;
      const sp = SPRITES.blocks[color];
      if (palette.glow) {
        bctx.shadowColor = palette.glowColor;
        bctx.shadowBlur = palette.glowBlur;
      }
      bctx.drawImage(
        atlas,
        sp.sx,
        sp.sy,
        sp.sw,
        sp.sh,
        GLOW_MARGIN,
        GLOW_MARGIN,
        BLOCK_W,
        BLOCK_H,
      );
      if (palette.glow) bctx.shadowBlur = 0;
    }
  }

  // 4 frames × 7 colores: mismo tamaño que un bloque (`exp.w/h` se copian de
  // `block.w/h` al crear la explosión), cacheados igual que los bloques.
  function buildExplosionSprites() {
    const atlas = ssVariants[currentSkin];
    for (const color of BLOCK_COLORS) {
      const frames = EXPLOSION_FRAMES[color];
      const ctxs = explosionSpriteCtxs[color];
      const sprites = explosionSprites[color];
      frames.forEach((frame, i) => {
        const ectx = ctxs[i];
        ectx.clearRect(0, 0, sprites[i].width, sprites[i].height);
        if (!atlas) return;
        if (palette.glow) {
          ectx.shadowColor = palette.glowColor;
          ectx.shadowBlur = palette.glowBlur;
        }
        ectx.drawImage(
          atlas,
          frame.sx,
          frame.sy,
          frame.sw,
          frame.sh,
          GLOW_MARGIN,
          GLOW_MARGIN,
          BLOCK_W,
          BLOCK_H,
        );
        if (palette.glow) ectx.shadowBlur = 0;
      });
    }
  }

  function buildSkinSpriteCaches() {
    buildPaddleSprite();
    buildBallSprite();
    buildBlockSprites();
    buildExplosionSprites();
  }

  // El loop de dibujo consume las cachés con `drawImage` (sin tocar
  // `shadowBlur` en vivo), igual que `drawWaterAndLogs`/`drawTurtleGroup` en
  // Frogger tras el spec 11.
  function drawPaddleSprite() {
    if (!ssLoaded) return;
    ctx.drawImage(paddleSprite, paddle.x - GLOW_MARGIN, paddle.y - GLOW_MARGIN);
  }

  function drawBallSpriteAt(x: number, y: number) {
    if (!ssLoaded) return;
    ctx.drawImage(ballSprite, x - GLOW_MARGIN, y - GLOW_MARGIN);
  }

  function drawBlockSprite(color: BlockColor, x: number, y: number) {
    if (!ssLoaded) return;
    ctx.drawImage(blockSprites[color], x - GLOW_MARGIN, y - GLOW_MARGIN);
  }

  function drawExplosionSprite(
    color: BlockColor,
    frameIndex: number,
    x: number,
    y: number,
  ) {
    if (!ssLoaded) return;
    ctx.drawImage(
      explosionSprites[color][frameIndex],
      x - GLOW_MARGIN,
      y - GLOW_MARGIN,
    );
  }

  function setScore(next: number) {
    score = next;
    callbacks.onScoreChange(score);
  }

  function setLives(next: number) {
    lives = next;
    callbacks.onLivesChange(lives);
  }

  function initPaddle() {
    paddle.x = (canvas.width - paddle.w) / 2;
  }

  function initBall() {
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = 0;
    ball.vy = 0;
    ballLaunched = false;
  }

  function launchBall() {
    if (ballLaunched || gameState !== 'playing' || isPaused) return;
    unlockAudio();
    const speed = LEVELS[currentLevel - 1].speed;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
    ballLaunched = true;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    initBall();
    callbacks.onLevelChange(currentLevel);
  }

  function collideAABB(block: Block): boolean {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  function fireGameOver() {
    if (gameOverFired) return;
    gameOverFired = true;
    callbacks.onGameOver(score);
  }

  function update(dt: number) {
    if (gameState !== 'playing') return;

    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight)
      paddle.x = Math.min(
        canvas.width - paddle.w,
        paddle.x + PADDLE_SPEED * dt,
      );

    if (!ballLaunched) {
      // Pegada al centro del paddle: se mueve con él y no colisiona con
      // nada, así que tampoco puede sonar ni perderse antes del saque.
      ball.x = paddle.x + (paddle.w - ball.w) / 2;
      ball.y = paddle.y - ball.h;
      return;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      playSound(bounceBuffer);
    }
    if (ball.x + ball.w >= canvas.width) {
      ball.x = canvas.width - ball.w;
      ball.vx = -Math.abs(ball.vx);
      playSound(bounceBuffer);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      playSound(bounceBuffer);
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      playSound(bounceBuffer);
    }

    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        setScore(score + 10);
        ball.vy = -ball.vy;
        playSound(breakBuffer);
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < 5) {
            loadLevel(currentLevel + 1);
          } else {
            gameState = 'win';
            fireGameOver();
          }
        }
        break;
      }
    }

    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    if (ball.y > canvas.height) {
      setLives(lives - 1);
      if (lives <= 0) {
        gameState = 'gameover';
        fireGameOver();
      } else {
        initBall();
      }
    }
  }

  function drawOverlay(message: string) {
    ctx.fillStyle = palette.overlayBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = palette.overlayText;
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  }

  function drawPauseOverlay() {
    ctx.fillStyle = palette.pauseOverlayBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = palette.pauseTitle;
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSA', canvas.width / 2, 260);

    ctx.fillStyle = palette.pauseSub;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('Saltar al nivel:', canvas.width / 2, 310);

    for (let i = 0; i < 5; i++) {
      const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP);
      const isActive = i + 1 === currentLevel;
      ctx.fillStyle = isActive
        ? palette.pauseActiveFill
        : palette.pauseInactiveFill;
      ctx.strokeStyle = palette.pauseBorder;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, PAUSE_BTN_Y, PAUSE_BTN_W, PAUSE_BTN_H, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isActive
        ? palette.pauseActiveText
        : palette.pauseInactiveText;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        String(i + 1),
        bx + PAUSE_BTN_W / 2,
        PAUSE_BTN_Y + PAUSE_BTN_H / 2,
      );
    }
  }

  function drawLaunchHint() {
    ctx.fillStyle = palette.hudText;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isCoarsePointer ? 'TOCA LANZAR PARA SACAR' : 'ESPACIO O CLIC PARA LANZAR',
      canvas.width / 2,
      480,
    );
  }

  function draw() {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const block of blocks) {
      if (block.alive) drawBlockSprite(block.color, block.x, block.y);
    }

    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      drawExplosionSprite(exp.color, frameIndex, exp.x, exp.y);
    }

    drawPaddleSprite();
    drawBallSpriteAt(ball.x, ball.y);

    if (gameState === 'playing') {
      ctx.fillStyle = palette.hudText;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Score: ' + score, 10, 10);
      ctx.textAlign = 'center';
      ctx.fillText('Nivel: ' + currentLevel, canvas.width / 2, 10);
      // Los íconos de vida reutilizan `ballSprite`: comparten el mismo
      // tamaño (16x16) que la bola en juego, sin necesitar una caché aparte.
      const ballSize = 16;
      const ballSpacing = 4;
      for (let i = 0; i < lives; i++) {
        const bx = canvas.width - 10 - (lives - i) * (ballSize + ballSpacing);
        drawBallSpriteAt(bx, 10);
      }
      if (!ballLaunched && !isPaused) drawLaunchHint();
    }

    if (gameState === 'gameover') drawOverlay('GAME OVER');
    if (gameState === 'win') drawOverlay('¡Completaste el juego!');
    if (isPaused) drawPauseOverlay();
  }

  function setPaused(next: boolean) {
    if (gameState !== 'playing' || isPaused === next) return;
    isPaused = next;
    draw();
    callbacks.onPauseChange(isPaused);
  }

  function loop(timestamp: number) {
    const dt =
      lastTime === null ? 0 : Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (!isPaused) update(dt);
    draw();

    rafId = requestAnimationFrame(loop);
  }

  function handleClick(e: MouseEvent) {
    if (!isPaused) {
      launchBall();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    for (let i = 0; i < 5; i++) {
      const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP);
      if (
        mx >= bx &&
        mx <= bx + PAUSE_BTN_W &&
        my >= PAUSE_BTN_Y &&
        my <= PAUSE_BTN_Y + PAUSE_BTN_H
      ) {
        loadLevel(i + 1);
        setPaused(false);
        return;
      }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    paddle.x = Math.max(
      0,
      Math.min(canvas.width - paddle.w, mouseX - paddle.w / 2),
    );
  }

  const CAPTURED_KEYS = new Set([
    'ArrowLeft',
    'ArrowRight',
    'KeyP',
    'Escape',
    'Space',
  ]);

  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
    ) {
      return;
    }

    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
    if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
    if (e.code === 'ArrowRight') keys.ArrowRight = true;
    if (e.code === 'Space') launchBall();
    if ((e.code === 'KeyP' || e.code === 'Escape') && gameState === 'playing') {
      setPaused(!isPaused);
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
    if (e.code === 'ArrowRight') keys.ArrowRight = false;
  }

  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  callbacks.onScoreChange(score);
  callbacks.onLivesChange(lives);

  loadSpritesheet(() => {
    if (destroyed) return;
    // El atlas ya está listo (`ssVariants`/`ssLoaded`): hornear las cachés de
    // sprites con glow para la skin inicial antes del primer `draw()`.
    buildSkinSpriteCaches();
    initPaddle();
    loadLevel(1);
    rafId = requestAnimationFrame(loop);
  });

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
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (audioCtx) audioCtx.close().catch(() => {});
    },
    setSkin(skin: SkinName) {
      currentSkin = skin;
      palette = SKIN_PALETTES[skin];
      // Las cachés de paddle/bola/bloques/explosiones hornean el glow de la
      // skin vigente: hay que reconstruirlas íntegras antes de repintar,
      // igual que `setSkin()` en Frogger (spec 11).
      if (ssLoaded) buildSkinSpriteCaches();
      draw();
    },
  };
}
