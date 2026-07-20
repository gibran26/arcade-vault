export interface ArkanoidCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  onPauseChange: (isPaused: boolean) => void;
  onLevelChange: (level: number) => void;
}

export interface ArkanoidGame {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

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

type BlockColor =
  'red' | 'yellow' | 'cyan' | 'magenta' | 'hotpink' | 'green' | 'gray';

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
): ArkanoidGame {
  const ctx = canvas.getContext('2d')!;

  const paddle: Paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball: Ball = { x: 0, y: 0, w: 16, h: 16, vx: 200, vy: -300 };

  const bounceSound = new Audio('/assets/arkanoid/ball-bounce.mp3');
  const breakSound = new Audio('/assets/arkanoid/break-sound.mp3');

  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = 3;
  let score = 0;
  let gameState: GameState = 'playing';
  let currentLevel = 1;
  let isPaused = false;
  let gameOverFired = false;

  let ssImg: HTMLCanvasElement | null = null;
  let ssLoaded = false;

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
      const oc = document.createElement('canvas');
      oc.width = rawImg.width;
      oc.height = rawImg.height;
      const octx = oc.getContext('2d')!;
      octx.drawImage(rawImg, 0, 0);
      ssImg = oc;
      ssLoaded = true;
      cb();
    };
    rawImg.onerror = () => console.error('Failed to load spritesheet');
    rawImg.src = '/assets/arkanoid/spritesheet-breakout.png';
  }

  function drawFrame(
    context: CanvasRenderingContext2D,
    frame: SpriteFrame,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    if (!ssLoaded || !ssImg) return;
    context.drawImage(
      ssImg,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      x,
      y,
      w,
      h,
    );
  }

  function drawSprite(
    context: CanvasRenderingContext2D,
    name: 'paddle' | 'ball' | `block_${BlockColor}`,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    if (!ssLoaded || !ssImg) return;
    const sp = name.startsWith('block_')
      ? SPRITES.blocks[name.slice(6) as BlockColor]
      : SPRITES[name as 'paddle' | 'ball'];
    if (!sp) return;
    context.drawImage(ssImg, sp.sx, sp.sy, sp.sw, sp.sh, x, y, w, h);
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
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
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
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * level.speed;
    ball.vy = BASE_BALL_VY * level.speed;
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

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      (bounceSound.cloneNode() as HTMLAudioElement).play();
    }
    if (ball.x + ball.w >= canvas.width) {
      ball.x = canvas.width - ball.w;
      ball.vx = -Math.abs(ball.vx);
      (bounceSound.cloneNode() as HTMLAudioElement).play();
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      (bounceSound.cloneNode() as HTMLAudioElement).play();
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
      (bounceSound.cloneNode() as HTMLAudioElement).play();
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
        (breakSound.cloneNode() as HTMLAudioElement).play();
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSA', canvas.width / 2, 260);

    ctx.font = 'bold 16px monospace';
    ctx.fillText('Saltar al nivel:', canvas.width / 2, 310);

    for (let i = 0; i < 5; i++) {
      const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP);
      const isActive = i + 1 === currentLevel;
      ctx.fillStyle = isActive ? '#f0c040' : '#444';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, PAUSE_BTN_Y, PAUSE_BTN_W, PAUSE_BTN_H, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isActive ? '#000' : '#fff';
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

  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const block of blocks) {
      if (block.alive)
        drawSprite(
          ctx,
          `block_${block.color}`,
          block.x,
          block.y,
          block.w,
          block.h,
        );
    }

    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      drawFrame(
        ctx,
        EXPLOSION_FRAMES[exp.color][frameIndex],
        exp.x,
        exp.y,
        exp.w,
        exp.h,
      );
    }

    drawSprite(ctx, 'paddle', paddle.x, paddle.y, paddle.w, paddle.h);
    drawSprite(ctx, 'ball', ball.x, ball.y, ball.w, ball.h);

    if (gameState === 'playing') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Score: ' + score, 10, 10);
      ctx.textAlign = 'center';
      ctx.fillText('Nivel: ' + currentLevel, canvas.width / 2, 10);
      const ballSize = 16;
      const ballSpacing = 4;
      for (let i = 0; i < lives; i++) {
        const bx = canvas.width - 10 - (lives - i) * (ballSize + ballSpacing);
        drawSprite(ctx, 'ball', bx, 10, ballSize, ballSize);
      }
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
    if (!isPaused) return;
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

  const CAPTURED_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'KeyP', 'Escape']);

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
    },
  };
}
