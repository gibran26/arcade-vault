export interface TetrisCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  onPauseChange: (isPaused: boolean) => void;
  onLevelChange: (level: number) => void;
}

export interface TetrisGame {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const W = COLS * BLOCK; // 300 — ancho del tablero
const H = ROWS * BLOCK; // 600
const PANEL_X = W; // 300
const PANEL_W = 180; // W total del canvas = 480
const CANVAS_W = PANEL_X + PANEL_W; // 480
const CANVAS_H = H; // 600

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#9e9e9e', // N - tuerca (gris metálico)
];

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

export function createGame(
  canvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
): TetrisGame {
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d')!;

  let board: number[][];
  let current: Piece;
  let next: Piece;
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropInterval = 1000;
  let dropAccum = 0;
  let gameOver = false;
  let gameOverFired = false;
  let paused = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;

  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = PIECES[type]!.map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function setScore(next: number) {
    score = next;
    callbacks.onScoreChange(score);
  }

  function setLevel(next: number) {
    level = next;
    callbacks.onLevelChange(level);
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      setScore(score + (LINE_SCORES[cleared] || 0) * level);
      setLevel(Math.floor(lines / 10) + 1);
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    setScore(score + (gy - current.y) * 2);
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      setScore(score + 1);
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      endGame();
    }
  }

  function endGame() {
    gameOver = true;
    stopLoop();
    callbacks.onLivesChange(0);
    if (!gameOverFired) {
      gameOverFired = true;
      callbacks.onGameOver(score);
    }
  }

  function drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ) {
    if (!colorIndex) return;
    const color = COLORS[colorIndex]!;
    context.globalAlpha = alpha ?? 1;
    context.fillStyle = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  function drawBoard() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx,
            current.x + c,
            gy + r,
            current.shape[r][c],
            BLOCK,
            0.2,
          );

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          ctx,
          current.x + c,
          current.y + r,
          current.shape[r][c],
          BLOCK,
        );
  }

  function drawNextPreview(x: number, y: number) {
    const NB = 24;
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const color = COLORS[shape[r][c]]!;
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.fillRect(
          x + (offX + c) * NB + 1,
          y + (offY + r) * NB + 1,
          NB - 2,
          NB - 2,
        );
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(
          x + (offX + c) * NB + 1,
          y + (offY + r) * NB + 1,
          NB - 2,
          4,
        );
      }
  }

  function drawPanel() {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(PANEL_X, 0, PANEL_W, CANVAS_H);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(PANEL_X, 0, PANEL_W, CANVAS_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PANEL_X, 0);
    ctx.lineTo(PANEL_X, CANVAS_H);
    ctx.stroke();

    const labelX = PANEL_X + 16;

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('SCORE', labelX, 30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(score.toLocaleString(), labelX, 56);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('LINES', labelX, 96);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(String(lines), labelX, 122);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('LEVEL', labelX, 162);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(String(level), labelX, 188);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('NEXT', labelX, 228);
    drawNextPreview(labelX, 244);
  }

  function drawOverlay(title: string) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(title, W / 2, H / 2);
  }

  function draw() {
    drawBoard();
    drawPanel();
    if (paused) drawOverlay('PAUSA');
    if (gameOver) drawOverlay('GAME OVER');
  }

  function stopLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    lastTime = null;
  }

  function startLoop() {
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function setPaused(next: boolean) {
    if (gameOver || paused === next) return;
    paused = next;
    if (paused) {
      stopLoop();
      draw();
    } else {
      startLoop();
    }
    callbacks.onPauseChange(paused);
  }

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : ts - lastTime;
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
    if (gameOver) {
      draw();
      return;
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  const CAPTURED_KEYS = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Space',
    'KeyX',
    'KeyP',
  ]);

  function handleKeyDown(e: KeyboardEvent) {
    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();

    if (e.code === 'KeyP') {
      setPaused(!paused);
      return;
    }
    if (paused || gameOver) return;

    switch (e.code) {
      case 'ArrowLeft':
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case 'ArrowRight':
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case 'ArrowDown':
        softDrop();
        break;
      case 'ArrowUp':
      case 'KeyX':
        tryRotate();
        break;
      case 'Space':
        hardDrop();
        break;
      default:
        return;
    }
    draw();
  }

  window.addEventListener('keydown', handleKeyDown);

  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  gameOverFired = false;
  dropInterval = 1000;
  dropAccum = 0;
  next = randomPiece();
  spawn();
  callbacks.onScoreChange(score);
  callbacks.onLevelChange(level);
  callbacks.onLivesChange(1);
  draw();
  rafId = requestAnimationFrame(loop);

  return {
    pause() {
      setPaused(true);
    },
    resume() {
      setPaused(false);
    },
    destroy() {
      stopLoop();
      window.removeEventListener('keydown', handleKeyDown);
    },
  };
}
