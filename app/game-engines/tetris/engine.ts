import type { SkinName } from '../skins';

export interface TetrisCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  onPauseChange: (isPaused: boolean) => void;
  onLevelChange: (level: number) => void;
}

export interface TetrisOptions {
  skin?: SkinName;
}

export interface TetrisGame {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setSkin: (skin: SkinName) => void;
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
const NB = 24; // tamaño de celda del panel "NEXT"

// Margen de sangrado reservado en los sprites que hornean el `shadowBlur`
// (mismo criterio que `frogger/engine.ts`, spec 11: cubre con holgura el
// desenfoque visible incluso en el `glowBlur` más alto del catálogo, 14 en
// `neon`), para que el blur no quede recortado en el borde del sprite.
const GLOW_MARGIN = 28;
const BLOCK_SPRITE_SIZE = BLOCK + GLOW_MARGIN * 2;
const NB_SPRITE_SIZE = NB + GLOW_MARGIN * 2;

interface TetrisPalette {
  pieces: (string | null)[];
  boardBg: string;
  gridLine: string;
  blockHighlight: string;
  panelBg: string;
  panelOverlay: string;
  panelBorder: string;
  labelColor: string;
  valueColor: string;
  overlayBg: string;
  overlayText: string;
  glow: boolean;
  glowBlur: number;
}

const SKIN_PALETTES: Record<SkinName, TetrisPalette> = {
  classic: {
    pieces: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#90caf9', // J - pale blue
      '#ffb74d', // L - orange
      '#9e9e9e', // N - tuerca (gris metálico)
    ],
    boardBg: '#000',
    gridLine: 'rgba(255,255,255,0.08)',
    blockHighlight: 'rgba(255,255,255,0.12)',
    panelBg: '#0a0a0f',
    panelOverlay: 'rgba(255,255,255,0.03)',
    panelBorder: 'rgba(255,255,255,0.15)',
    labelColor: 'rgba(255,255,255,0.5)',
    valueColor: '#fff',
    overlayBg: 'rgba(0,0,0,0.6)',
    overlayText: '#fff',
    glow: false,
    glowBlur: 0,
  },
  neon: {
    pieces: [
      null,
      '#00f5ff', // I - cian
      '#ffee00', // O - amarillo neón
      '#ff00ff', // T - magenta
      '#39ff14', // S - verde neón
      '#ff2050', // Z - rojo neón
      '#2979ff', // J - azul eléctrico
      '#ff8800', // L - naranja neón
      '#b000ff', // N - violeta (tuerca)
    ],
    boardBg: '#0a0014',
    gridLine: 'rgba(0,245,255,0.16)',
    blockHighlight: 'rgba(255,255,255,0.2)',
    panelBg: '#0a0014',
    panelOverlay: 'rgba(255,0,255,0.05)',
    panelBorder: 'rgba(0,245,255,0.45)',
    labelColor: 'rgba(255,0,255,0.7)',
    valueColor: '#00f5ff',
    overlayBg: 'rgba(20,0,30,0.7)',
    overlayText: '#ff00ff',
    glow: true,
    glowBlur: 14,
  },
  retro: {
    pieces: [
      null,
      '#39ff14', // I
      '#66ff66', // O
      '#22dd55', // T
      '#00e676', // S
      '#2eff9e', // Z
      '#00ff88', // J
      '#7dffb3', // L
      '#00c853', // N (tuerca)
    ],
    boardBg: '#001100',
    gridLine: 'rgba(0,255,65,0.14)',
    blockHighlight: 'rgba(0,255,65,0.18)',
    panelBg: '#000800',
    panelOverlay: 'rgba(0,255,65,0.04)',
    panelBorder: 'rgba(255,176,0,0.4)',
    labelColor: 'rgba(255,176,0,0.6)',
    valueColor: '#00ff41',
    overlayBg: 'rgba(0,20,0,0.75)',
    overlayText: '#ffb000',
    glow: true,
    glowBlur: 6,
  },
};

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
  options?: TetrisOptions,
): TetrisGame {
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d')!;
  let palette = SKIN_PALETTES[options?.skin ?? 'classic'];

  // Capa estática del tablero (fondo + rejilla, spec 11): nunca cambian entre
  // frames, solo dependen de la skin — se hornean una vez y se blitean.
  const boardStaticLayer = document.createElement('canvas');
  boardStaticLayer.width = W;
  boardStaticLayer.height = H;
  const boardStaticCtx = boardStaticLayer.getContext('2d')!;

  // Capa estática del panel lateral (fondo + overlay + borde + etiquetas
  // fijas SCORE/LINES/LEVEL/NEXT, spec 11): solo los valores numéricos y el
  // preview de la siguiente pieza cambian por frame.
  const panelStaticLayer = document.createElement('canvas');
  panelStaticLayer.width = PANEL_W;
  panelStaticLayer.height = CANVAS_H;
  const panelStaticCtx = panelStaticLayer.getContext('2d')!;

  // Variantes discretas: solo hay 8 tipos de pieza (colorIndex 1-8), así que
  // alcanza con cachear un sprite por color (a las 2 escalas usadas, tablero
  // y preview) en vez de recalcular `fillRect`+`shadowBlur` por bloque y por
  // frame — hasta ~200 bloques de tablero + 4 fantasma + 4 pieza activa
  // (spec 11).
  const blockSprites: Record<number, HTMLCanvasElement> = {};
  const blockSpriteCtxs: Record<number, CanvasRenderingContext2D> = {};
  const nextPreviewSprites: Record<number, HTMLCanvasElement> = {};
  const nextPreviewSpriteCtxs: Record<number, CanvasRenderingContext2D> = {};
  for (let colorIndex = 1; colorIndex <= 8; colorIndex++) {
    const sprite = document.createElement('canvas');
    sprite.width = BLOCK_SPRITE_SIZE;
    sprite.height = BLOCK_SPRITE_SIZE;
    blockSprites[colorIndex] = sprite;
    blockSpriteCtxs[colorIndex] = sprite.getContext('2d')!;

    const previewSprite = document.createElement('canvas');
    previewSprite.width = NB_SPRITE_SIZE;
    previewSprite.height = NB_SPRITE_SIZE;
    nextPreviewSprites[colorIndex] = previewSprite;
    nextPreviewSpriteCtxs[colorIndex] = previewSprite.getContext('2d')!;
  }

  const board: number[][] = createBoard();
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

  function buildBoardStaticLayer() {
    // Fondo + rejilla del tablero (spec 11, técnica de `staticLayer` de
    // Frogger): antes se retrazaban 2 `fillRect` + 28 `stroke()` cada frame
    // pese a no cambiar nunca entre frames; ahora se hornean una sola vez
    // (aquí y en `setSkin`) y se blitean con un único `drawImage`.
    boardStaticCtx.fillStyle = palette.boardBg;
    boardStaticCtx.fillRect(0, 0, W, H);
    boardStaticCtx.strokeStyle = palette.gridLine;
    boardStaticCtx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      boardStaticCtx.beginPath();
      boardStaticCtx.moveTo(c * BLOCK, 0);
      boardStaticCtx.lineTo(c * BLOCK, ROWS * BLOCK);
      boardStaticCtx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      boardStaticCtx.beginPath();
      boardStaticCtx.moveTo(0, r * BLOCK);
      boardStaticCtx.lineTo(COLS * BLOCK, r * BLOCK);
      boardStaticCtx.stroke();
    }
  }

  function buildPanelStaticLayer() {
    // Fondo, overlay, borde y las 4 etiquetas fijas (SCORE/LINES/LEVEL/NEXT)
    // nunca cambian entre frames — solo los valores numéricos lo hacen. Se
    // hornea todo lo estático una sola vez (spec 11).
    panelStaticCtx.clearRect(0, 0, PANEL_W, CANVAS_H);
    panelStaticCtx.fillStyle = palette.panelBg;
    panelStaticCtx.fillRect(0, 0, PANEL_W, CANVAS_H);
    panelStaticCtx.fillStyle = palette.panelOverlay;
    panelStaticCtx.fillRect(0, 0, PANEL_W, CANVAS_H);
    panelStaticCtx.strokeStyle = palette.panelBorder;
    panelStaticCtx.lineWidth = 1;
    panelStaticCtx.beginPath();
    panelStaticCtx.moveTo(0, 0);
    panelStaticCtx.lineTo(0, CANVAS_H);
    panelStaticCtx.stroke();

    const labelX = 16;
    panelStaticCtx.textAlign = 'left';
    panelStaticCtx.fillStyle = palette.labelColor;
    panelStaticCtx.font = 'bold 13px monospace';
    panelStaticCtx.fillText('SCORE', labelX, 30);
    panelStaticCtx.fillText('LINES', labelX, 96);
    panelStaticCtx.fillText('LEVEL', labelX, 162);
    panelStaticCtx.fillText('NEXT', labelX, 228);
  }

  function buildBlockSprites() {
    // Un sprite offscreen por color de pieza (8 variantes), a las 2 escalas
    // usadas (tablero `BLOCK` y preview `NB`): el `shadowBlur` se hornea una
    // sola vez por color aquí (y en `setSkin`) en vez de asignarse en vivo
    // por cada bloque dibujado — hasta ~208 veces por frame en el peor caso
    // (tablero casi lleno + pieza activa + fantasma), spec 11.
    for (let colorIndex = 1; colorIndex <= 8; colorIndex++) {
      const color = palette.pieces[colorIndex]!;

      const bctx = blockSpriteCtxs[colorIndex];
      bctx.clearRect(0, 0, BLOCK_SPRITE_SIZE, BLOCK_SPRITE_SIZE);
      bctx.fillStyle = color;
      if (palette.glow) {
        bctx.shadowColor = color;
        bctx.shadowBlur = palette.glowBlur;
      }
      bctx.fillRect(GLOW_MARGIN + 1, GLOW_MARGIN + 1, BLOCK - 2, BLOCK - 2);
      if (palette.glow) bctx.shadowBlur = 0;
      bctx.fillStyle = palette.blockHighlight;
      bctx.fillRect(GLOW_MARGIN + 1, GLOW_MARGIN + 1, BLOCK - 2, 4);

      const pctx = nextPreviewSpriteCtxs[colorIndex];
      pctx.clearRect(0, 0, NB_SPRITE_SIZE, NB_SPRITE_SIZE);
      pctx.fillStyle = color;
      if (palette.glow) {
        pctx.shadowColor = color;
        pctx.shadowBlur = palette.glowBlur;
      }
      pctx.fillRect(GLOW_MARGIN + 1, GLOW_MARGIN + 1, NB - 2, NB - 2);
      if (palette.glow) pctx.shadowBlur = 0;
      pctx.fillStyle = palette.blockHighlight;
      pctx.fillRect(GLOW_MARGIN + 1, GLOW_MARGIN + 1, NB - 2, 4);
    }
  }

  function drawBlock(
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ) {
    if (!colorIndex) return;
    // Sprite offscreen cacheado (`buildBlockSprites`, spec 11): el glow ya
    // viene horneado, sin `shadowBlur` en vivo por bloque y por frame.
    ctx.globalAlpha = alpha ?? 1;
    ctx.drawImage(
      blockSprites[colorIndex],
      x * size - GLOW_MARGIN,
      y * size - GLOW_MARGIN,
    );
    ctx.globalAlpha = 1;
  }

  function drawBoard() {
    // Capa estática cacheada (`buildBoardStaticLayer`, spec 11): un único
    // `drawImage` en vez de 2 `fillRect` + 28 `stroke()` por frame.
    ctx.drawImage(boardStaticLayer, 0, 0);

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(c, r, board[r][c], BLOCK);

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }

  function drawNextPreview(x: number, y: number) {
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        // Sprite offscreen cacheado (`buildBlockSprites`, spec 11), a la
        // escala del panel NEXT — mismo glow horneado que el tablero.
        ctx.drawImage(
          nextPreviewSprites[shape[r][c]],
          x + (offX + c) * NB - GLOW_MARGIN,
          y + (offY + r) * NB - GLOW_MARGIN,
        );
      }
  }

  function drawPanel() {
    // Capa estática cacheada (`buildPanelStaticLayer`, spec 11): fondo,
    // overlay, borde y las 4 etiquetas fijas se blitean con un único
    // `drawImage`; solo los valores numéricos y el preview se redibujan.
    ctx.drawImage(panelStaticLayer, PANEL_X, 0);

    const labelX = PANEL_X + 16;
    ctx.textAlign = 'left';
    ctx.fillStyle = palette.valueColor;
    ctx.font = 'bold 20px monospace';
    ctx.fillText(score.toLocaleString(), labelX, 56);
    ctx.fillText(String(lines), labelX, 122);
    ctx.fillText(String(level), labelX, 188);
    drawNextPreview(labelX, 244);
  }

  function drawOverlay(title: string) {
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.overlayBg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = palette.overlayText;
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
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
    ) {
      return;
    }

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
  buildBoardStaticLayer();
  buildPanelStaticLayer();
  buildBlockSprites();
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
    setSkin(skin: SkinName) {
      palette = SKIN_PALETTES[skin];
      // El fondo del tablero, el panel lateral y los sprites de bloque
      // (pieza activa, fantasma, preview) viven en canvas offscreen
      // cacheados: hay que regenerarlos todos con la nueva paleta antes de
      // repintar el frame actual (mismo contrato que `frogger/engine.ts`,
      // spec 11), sin tocar el estado de la partida en curso.
      buildBoardStaticLayer();
      buildPanelStaticLayer();
      buildBlockSprites();
      draw();
    },
  };
}
