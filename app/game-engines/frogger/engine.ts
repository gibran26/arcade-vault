import { type SkinName } from '../skins';

export interface FroggerCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  onPauseChange: (isPaused: boolean) => void;
  onLevelChange: (level: number) => void;
}

export interface FroggerOptions {
  skin?: SkinName;
}

export interface FroggerGame {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setSkin: (skin: SkinName) => void;
}

const CELL = 40;
const COLS = 14;
const ROWS = 13;
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;

const ROW_GOAL = 0;
const RIVER_ROWS = [1, 2, 3, 4, 5];
const ROW_MEDIAN = 6;
const ROAD_ROWS = [7, 8, 9, 10, 11];
const ROW_START = 12;

const START_COL = 6;
const GOAL_HOLE_COLS = [1, 4, 7, 10, 13];

const JUMP_DURATION_MS = 150;
const BASE_TIMER_MS = 30000;
const MIN_TIMER_MS = 15000;
const TIMER_STEP_MS = 2000;
const EXTRA_LIFE_STEP = 5000;
const MAX_SPEED_MULTIPLIER = 3;

const TURTLE_AFLOAT_MS = 3000;
const TURTLE_WARNING_MS = 1000;
const TURTLE_SUBMERGED_MS = 1500;
const TURTLE_CYCLE_MS =
  TURTLE_AFLOAT_MS + TURTLE_WARNING_MS + TURTLE_SUBMERGED_MS;

const COLLISION_INSET = 4;

interface FroggerPalette {
  grassBg: string;
  grassDot: string;
  waterBg: string;
  waterRipple: string;
  roadBg: string;
  roadDash: string;
  goalBg: string;
  goalHoleStroke: string;
  logFill: string;
  logVein: string;
  turtleShell: string;
  turtleShellLine: string;
  turtleSkin: string;
  frogBody: string;
  frogDark: string;
  frogEyeWhite: string;
  goalOccupant: string;
  timerWarn: string;
  timerDanger: string;
  glow: boolean;
  glowBlur: number;
}

// `classic` es un espejo exacto de los literales que este motor usaba antes
// de introducir el selector de skins: no puede cambiar ni un tono.
const SKIN_PALETTES: Record<SkinName, FroggerPalette> = {
  classic: {
    grassBg: '#0a3d1a',
    grassDot: 'rgba(0, 255, 136, 0.35)',
    waterBg: '#00243d',
    waterRipple: 'rgba(0, 245, 255, 0.3)',
    roadBg: '#161616',
    roadDash: 'rgba(245, 255, 0, 0.55)',
    goalBg: '#1a0533',
    goalHoleStroke: '#00f5ff',
    logFill: '#8b5a2b',
    logVein: '#5c3a1a',
    turtleShell: '#0a6b3a',
    turtleShellLine: '#04321c',
    turtleSkin: '#1fae63',
    frogBody: '#00ff88',
    frogDark: '#052e0f',
    frogEyeWhite: '#fff',
    goalOccupant: '#00ff88',
    timerWarn: '#f5ff00',
    timerDanger: '#ff006e',
    glow: false,
    glowBlur: 0,
  },
  neon: {
    grassBg: '#05001a',
    grassDot: 'rgba(0, 245, 255, 0.4)',
    waterBg: '#00061f',
    waterRipple: 'rgba(255, 0, 255, 0.5)',
    roadBg: '#0a0010',
    roadDash: 'rgba(0, 245, 255, 0.7)',
    goalBg: '#170029',
    goalHoleStroke: '#ff00ff',
    logFill: '#00e5ff',
    logVein: '#0891b2',
    turtleShell: '#ff00ff',
    turtleShellLine: '#7a0068',
    turtleSkin: '#00f5ff',
    frogBody: '#00fff2',
    frogDark: '#1a002a',
    frogEyeWhite: '#fff',
    goalOccupant: '#00fff2',
    timerWarn: '#00f5ff',
    timerDanger: '#ff00ff',
    glow: true,
    glowBlur: 14,
  },
  retro: {
    grassBg: '#001100',
    grassDot: 'rgba(0, 255, 65, 0.35)',
    waterBg: '#001a14',
    waterRipple: 'rgba(0, 255, 65, 0.3)',
    roadBg: '#0d0d00',
    roadDash: 'rgba(255, 176, 0, 0.6)',
    goalBg: '#0d1a00',
    goalHoleStroke: '#ffb000',
    logFill: '#b3820a',
    logVein: '#5c3a05',
    turtleShell: '#00ff41',
    turtleShellLine: '#00701f',
    turtleSkin: '#ffb000',
    frogBody: '#00ff41',
    frogDark: '#001a08',
    frogEyeWhite: '#c8ffd8',
    goalOccupant: '#00ff41',
    timerWarn: '#00ff41',
    timerDanger: '#ffb000',
    glow: true,
    glowBlur: 6,
  },
};

// Los vehículos usan una paleta ampliada propia (10 colores variados) que es
// parte del diseño de la carretera en sí, no del tema visual del tablero:
// se mantiene igual entre skins.
const VEHICLE_COLORS = [
  '#ff6b35',
  '#ffd23f',
  '#3bceac',
  '#5e60ce',
  '#f72585',
  '#4cc9f0',
  '#ff9f1c',
  '#06ffa5',
  '#e63946',
  '#c77dff',
];

type RowKind = 'goal' | 'river' | 'median' | 'road' | 'start';

function rowKind(row: number): RowKind {
  if (row === ROW_GOAL) return 'goal';
  if (row === ROW_MEDIAN) return 'median';
  if (row === ROW_START) return 'start';
  if (RIVER_ROWS.includes(row)) return 'river';
  return 'road';
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface GoalHole {
  col: number;
  occupied: boolean;
}

interface FloatItem {
  x: number;
  widthCells: number;
}

interface RiverLane {
  row: number;
  isTurtle: boolean;
  direction: 1 | -1;
  baseSpeed: number;
  items: FloatItem[];
  cyclePhaseOffset: number;
}

interface Vehicle {
  x: number;
  kind: 'car' | 'truck';
  lengthCells: 1 | 2;
  color: string;
}

interface RoadLane {
  row: number;
  direction: 1 | -1;
  baseSpeed: number;
  vehicles: Vehicle[];
}

interface FrogState {
  x: number;
  y: number;
  row: number;
  jumping: boolean;
  jumpStartX: number;
  jumpStartY: number;
  jumpTargetX: number;
  jumpTargetY: number;
  jumpTargetRow: number;
  jumpElapsed: number;
  lastDir: { dx: number; dy: number };
}

const RIVER_BASE_SPEEDS = [42, 58, 36, 52, 46];
const RIVER_DIRECTIONS: (1 | -1)[] = [1, -1, 1, -1, 1];
const ROAD_BASE_SPEEDS = [70, 95, 60, 105, 82];
const ROAD_DIRECTIONS: (1 | -1)[] = [-1, 1, -1, 1, -1];

export function createGame(
  canvas: HTMLCanvasElement,
  callbacks: FroggerCallbacks,
  options?: FroggerOptions,
): FroggerGame {
  const ctx = canvas.getContext('2d')!;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  let palette = SKIN_PALETTES[options?.skin ?? 'classic'];

  const staticLayer = document.createElement('canvas');
  staticLayer.width = CANVAS_W;
  staticLayer.height = CANVAS_H;
  const staticCtx = staticLayer.getContext('2d')!;

  let score = 0;
  let lives = 3;
  let level = 1;
  let nextExtraLifeThreshold = EXTRA_LIFE_STEP;
  let gameOverFired = false;
  let isPaused = false;
  let elapsedMs = 0;
  let attemptTimeRemaining = BASE_TIMER_MS;
  let deepestRowThisAttempt = ROW_START;

  const holes: GoalHole[] = GOAL_HOLE_COLS.map((col) => ({
    col,
    occupied: false,
  }));

  const riverLanes: RiverLane[] = RIVER_ROWS.map((row, i) => ({
    row,
    isTurtle: false,
    direction: RIVER_DIRECTIONS[i],
    baseSpeed: RIVER_BASE_SPEEDS[i],
    items: [],
    cyclePhaseOffset: 0,
  }));

  const roadLanes: RoadLane[] = ROAD_ROWS.map((row, i) => ({
    row,
    direction: ROAD_DIRECTIONS[i],
    baseSpeed: ROAD_BASE_SPEEDS[i],
    vehicles: [],
  }));

  const frog: FrogState = {
    x: START_COL * CELL,
    y: ROW_START * CELL,
    row: ROW_START,
    jumping: false,
    jumpStartX: 0,
    jumpStartY: 0,
    jumpTargetX: 0,
    jumpTargetY: 0,
    jumpTargetRow: ROW_START,
    jumpElapsed: 0,
    lastDir: { dx: 0, dy: -1 },
  };

  function currentTimerDuration(): number {
    return Math.max(MIN_TIMER_MS, BASE_TIMER_MS - (level - 1) * TIMER_STEP_MS);
  }

  function speedMultiplier(): number {
    return Math.min(MAX_SPEED_MULTIPLIER, Math.pow(1.15, level - 1));
  }

  function turtleLaneCount(): number {
    return Math.min(5, 1 + Math.floor((level - 1) / 2));
  }

  function setScore(next: number) {
    score = next;
    callbacks.onScoreChange(score);
    if (gameOverFired) return;
    while (score >= nextExtraLifeThreshold) {
      lives += 1;
      callbacks.onLivesChange(lives);
      nextExtraLifeThreshold += EXTRA_LIFE_STEP;
    }
  }

  function generateFloatItems(): FloatItem[] {
    const items: FloatItem[] = [];
    let cursor = -CELL * 2;
    while (cursor < CANVAS_W + CELL * 2) {
      const widthCells = randomItem([2, 3]);
      items.push({ x: cursor, widthCells });
      cursor += widthCells * CELL + CELL * (1.5 + Math.random());
    }
    return items;
  }

  function generateVehicles(): Vehicle[] {
    const vehicles: Vehicle[] = [];
    let cursor = -CELL * 2;
    while (cursor < CANVAS_W + CELL * 2) {
      const kind: 'car' | 'truck' = Math.random() < 0.35 ? 'truck' : 'car';
      const lengthCells: 1 | 2 = kind === 'truck' ? 2 : 1;
      vehicles.push({
        x: cursor,
        kind,
        lengthCells,
        color: randomItem(VEHICLE_COLORS),
      });
      cursor += lengthCells * CELL + CELL * (1.8 + Math.random() * 1.5);
    }
    return vehicles;
  }

  function regenerateRoundContent() {
    const laneIndices = [0, 1, 2, 3, 4];
    for (let i = laneIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [laneIndices[i], laneIndices[j]] = [laneIndices[j], laneIndices[i]];
    }
    const turtleSet = new Set(laneIndices.slice(0, turtleLaneCount()));

    riverLanes.forEach((lane, i) => {
      lane.isTurtle = turtleSet.has(i);
      lane.cyclePhaseOffset = Math.random() * TURTLE_CYCLE_MS;
      lane.items = generateFloatItems();
    });

    roadLanes.forEach((lane) => {
      lane.vehicles = generateVehicles();
    });
  }

  function drawStaticLayer() {
    staticCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    staticCtx.fillStyle = palette.grassBg;
    staticCtx.fillRect(0, ROW_MEDIAN * CELL, CANVAS_W, CELL);
    staticCtx.fillRect(0, ROW_START * CELL, CANVAS_W, CELL);
    for (const row of [ROW_MEDIAN, ROW_START]) {
      staticCtx.fillStyle = palette.grassDot;
      let seed = row * 7919;
      for (let i = 0; i < 90; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        const px = (seed / 233280) * CANVAS_W;
        seed = (seed * 9301 + 49297) % 233280;
        const py = row * CELL + (seed / 233280) * CELL;
        staticCtx.fillRect(px, py, 2, 6);
      }
    }

    staticCtx.fillStyle = palette.roadBg;
    staticCtx.fillRect(
      0,
      ROAD_ROWS[0] * CELL,
      CANVAS_W,
      ROAD_ROWS.length * CELL,
    );
    staticCtx.strokeStyle = palette.roadDash;
    staticCtx.lineWidth = 2;
    staticCtx.setLineDash([14, 10]);
    for (const row of ROAD_ROWS) {
      const y = row * CELL + CELL;
      staticCtx.beginPath();
      staticCtx.moveTo(0, y);
      staticCtx.lineTo(CANVAS_W, y);
      staticCtx.stroke();
    }
    staticCtx.setLineDash([]);

    staticCtx.fillStyle = palette.goalBg;
    staticCtx.fillRect(0, ROW_GOAL * CELL, CANVAS_W, CELL);
    staticCtx.strokeStyle = palette.goalHoleStroke;
    staticCtx.lineWidth = 2;
    if (palette.glow) {
      staticCtx.shadowColor = palette.goalHoleStroke;
      staticCtx.shadowBlur = palette.glowBlur;
    }
    for (const hole of holes) {
      const cx = hole.col * CELL + CELL / 2;
      const cy = ROW_GOAL * CELL + CELL / 2;
      staticCtx.beginPath();
      staticCtx.arc(cx, cy, CELL * 0.32, 0, Math.PI * 2);
      staticCtx.stroke();
    }
    if (palette.glow) staticCtx.shadowBlur = 0;
  }

  function currentGlobalTimeSeconds(): number {
    return elapsedMs / 1000;
  }

  function drawWaterAndLogs() {
    for (const lane of riverLanes) {
      const y = lane.row * CELL;
      ctx.fillStyle = palette.waterBg;
      ctx.fillRect(0, y, CANVAS_W, CELL);

      ctx.strokeStyle = palette.waterRipple;
      ctx.lineWidth = 1.5;
      const t = currentGlobalTimeSeconds();
      for (let line = 0; line < 3; line++) {
        const baseY = y + 10 + line * 10;
        ctx.beginPath();
        for (let x = 0; x <= CANVAS_W; x += 8) {
          const wave = Math.sin(x * 0.08 + t * 2 + line + lane.row) * 2.5;
          if (x === 0) ctx.moveTo(x, baseY + wave);
          else ctx.lineTo(x, baseY + wave);
        }
        ctx.stroke();
      }

      for (const item of lane.items) {
        const widthPx = item.widthCells * CELL;
        if (lane.isTurtle) {
          drawTurtleGroup(item, y, lane.cyclePhaseOffset);
        } else {
          drawLog(item, y, widthPx);
        }
      }
    }
  }

  function drawLog(item: FloatItem, y: number, widthPx: number) {
    ctx.fillStyle = palette.logFill;
    if (palette.glow) {
      ctx.shadowColor = palette.logFill;
      ctx.shadowBlur = palette.glowBlur * 0.6;
    }
    ctx.beginPath();
    ctx.roundRect(item.x, y + 6, widthPx, CELL - 12, 8);
    ctx.fill();
    if (palette.glow) ctx.shadowBlur = 0;
    ctx.strokeStyle = palette.logVein;
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 3; i++) {
      const vy = y + 6 + (i * (CELL - 12)) / 3;
      ctx.beginPath();
      ctx.moveTo(item.x + 6, vy);
      ctx.lineTo(item.x + widthPx - 6, vy);
      ctx.stroke();
    }
  }

  function turtlePhase(cyclePhaseOffset: number): {
    phase: 'afloat' | 'warning' | 'submerged';
    sinkOffset: number;
    opacity: number;
  } {
    const cycleTime = (elapsedMs + cyclePhaseOffset) % TURTLE_CYCLE_MS;
    if (cycleTime < TURTLE_AFLOAT_MS) {
      return { phase: 'afloat', sinkOffset: 0, opacity: 1 };
    }
    if (cycleTime < TURTLE_AFLOAT_MS + TURTLE_WARNING_MS) {
      const wt = (cycleTime - TURTLE_AFLOAT_MS) / TURTLE_WARNING_MS;
      const blink = 0.55 + 0.45 * Math.abs(Math.sin(wt * Math.PI * 4));
      return { phase: 'warning', sinkOffset: wt * 3, opacity: blink };
    }
    const st =
      (cycleTime - TURTLE_AFLOAT_MS - TURTLE_WARNING_MS) / TURTLE_SUBMERGED_MS;
    return {
      phase: 'submerged',
      sinkOffset: 3 + st * 6,
      opacity: Math.max(0.15, 1 - st),
    };
  }

  function drawTurtleGroup(
    item: FloatItem,
    y: number,
    cyclePhaseOffset: number,
  ) {
    const { sinkOffset, opacity } = turtlePhase(cyclePhaseOffset);
    ctx.save();
    ctx.globalAlpha = opacity;
    const segments = item.widthCells;
    for (let s = 0; s < segments; s++) {
      const cx = item.x + s * CELL + CELL / 2;
      const cy = y + CELL / 2 + sinkOffset;
      ctx.fillStyle = palette.turtleShell;
      if (palette.glow) {
        ctx.shadowColor = palette.turtleShell;
        ctx.shadowBlur = palette.glowBlur * 0.5;
      }
      ctx.beginPath();
      ctx.ellipse(cx, cy, CELL * 0.42, CELL * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      if (palette.glow) ctx.shadowBlur = 0;
      ctx.strokeStyle = palette.turtleShellLine;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.34, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.fillStyle = palette.turtleSkin;
      ctx.beginPath();
      ctx.ellipse(cx - CELL * 0.4, cy, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + CELL * 0.4, cy, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawVehicles() {
    for (const lane of roadLanes) {
      const y = lane.row * CELL;
      for (const v of lane.vehicles) {
        drawVehicle(v, y);
      }
    }
  }

  function drawVehicle(v: Vehicle, y: number) {
    const widthPx = v.lengthCells * CELL;
    const bodyX = v.x + 4;
    const bodyY = y + 8;
    const bodyW = widthPx - 8;
    const bodyH = CELL - 16;

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(bodyX - 1, bodyY - 1, bodyW + 2, bodyH + 2, 6);
    ctx.fill();

    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 6);
    ctx.fill();

    ctx.fillStyle = 'rgba(180, 230, 255, 0.65)';
    const windowW = bodyW * (v.kind === 'truck' ? 0.32 : 0.42);
    ctx.fillRect(bodyX + bodyW * 0.3, bodyY + 3, windowW, bodyH - 6);

    ctx.fillStyle = '#fff8c4';
    const frontX = bodyX + bodyW - 5;
    ctx.beginPath();
    ctx.arc(frontX, bodyY + 3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(frontX, bodyY + bodyH - 3, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(bodyX + 6, bodyY + bodyH + 1, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bodyX + bodyW - 6, bodyY + bodyH + 1, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGoalOccupants() {
    for (const hole of holes) {
      if (!hole.occupied) continue;
      const cx = hole.col * CELL + CELL / 2;
      const cy = ROW_GOAL * CELL + CELL / 2;
      ctx.fillStyle = palette.goalOccupant;
      if (palette.glow) {
        ctx.shadowColor = palette.goalOccupant;
        ctx.shadowBlur = palette.glowBlur * 0.6;
      }
      ctx.beginPath();
      ctx.ellipse(cx, cy, CELL * 0.24, CELL * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (palette.glow) ctx.shadowBlur = 0;
      ctx.fillStyle = palette.frogDark;
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 5, cy - 5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFrog() {
    const t = frog.jumping
      ? Math.min(1, frog.jumpElapsed / JUMP_DURATION_MS)
      : 1;
    const arc = frog.jumping ? Math.sin(t * Math.PI) * 8 : 0;
    let scaleX = 1;
    let scaleY = 1;
    if (frog.jumping) {
      if (t < 0.3) {
        const k = t / 0.3;
        scaleX = lerp(1, 1.25, k);
        scaleY = lerp(1, 0.75, k);
      } else if (t > 0.75) {
        const k = (t - 0.75) / 0.25;
        scaleX = lerp(1.1, 1, k);
        scaleY = lerp(0.85, 1, k);
      }
    }

    const cx = frog.x + CELL / 2;
    const cy = frog.y + CELL / 2 - arc;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scaleX, scaleY);

    ctx.fillStyle = palette.frogBody;
    if (palette.glow) {
      ctx.shadowColor = palette.frogBody;
      ctx.shadowBlur = palette.glowBlur;
    }
    ctx.beginPath();
    ctx.ellipse(0, 2, CELL * 0.34, CELL * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (palette.glow) ctx.shadowBlur = 0;

    ctx.fillStyle = palette.frogDark;
    const legOffsets = [
      [-CELL * 0.32, -CELL * 0.12],
      [CELL * 0.32, -CELL * 0.12],
      [-CELL * 0.3, CELL * 0.28],
      [CELL * 0.3, CELL * 0.28],
    ];
    for (const [lx, ly] of legOffsets) {
      ctx.beginPath();
      ctx.ellipse(lx, ly, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const { dx, dy } = frog.lastDir;
    const eyeSpread = 10;
    let e1 = { x: -eyeSpread, y: -14 };
    let e2 = { x: eyeSpread, y: -14 };
    if (dx === 1) {
      e1 = { x: 6, y: -18 };
      e2 = { x: 6, y: -6 };
    } else if (dx === -1) {
      e1 = { x: -6, y: -18 };
      e2 = { x: -6, y: -6 };
    } else if (dy === 1) {
      e1 = { x: -8, y: -2 };
      e2 = { x: 8, y: -2 };
    }
    for (const eye of [e1, e2]) {
      ctx.fillStyle = palette.frogEyeWhite;
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.frogDark;
      ctx.beginPath();
      ctx.arc(eye.x + dx * 1.5, eye.y + dy * 1.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawTimerBar() {
    const duration = currentTimerDuration();
    const ratio = Math.max(0, attemptTimeRemaining / duration);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, CANVAS_W, 6);
    ctx.fillStyle = ratio > 0.3 ? palette.timerWarn : palette.timerDanger;
    ctx.fillRect(0, 0, CANVAS_W * ratio, 6);
  }

  function draw() {
    ctx.drawImage(staticLayer, 0, 0);
    drawWaterAndLogs();
    drawVehicles();
    drawGoalOccupants();
    drawFrog();
    drawTimerBar();
  }

  function respawnFrog() {
    frog.x = START_COL * CELL;
    frog.y = ROW_START * CELL;
    frog.row = ROW_START;
    frog.jumping = false;
    frog.lastDir = { dx: 0, dy: -1 };
    deepestRowThisAttempt = ROW_START;
    attemptTimeRemaining = currentTimerDuration();
  }

  function killFrog() {
    if (gameOverFired) return;
    lives -= 1;
    if (lives <= 0) {
      lives = 0;
      callbacks.onLivesChange(0);
      gameOverFired = true;
      callbacks.onGameOver(score);
      return;
    }
    callbacks.onLivesChange(lives);
    respawnFrog();
  }

  function completeRound() {
    setScore(score + 1000);
    level += 1;
    callbacks.onLevelChange(level);
    holes.forEach((h) => (h.occupied = false));
    regenerateRoundContent();
    respawnFrog();
  }

  function awardRowProgress(newRow: number) {
    if (newRow < deepestRowThisAttempt) {
      setScore(score + (deepestRowThisAttempt - newRow) * 10);
      deepestRowThisAttempt = newRow;
    }
  }

  function resolveGoalLanding() {
    const col = Math.round(frog.x / CELL);
    const hole = holes.find((h) => h.col === col);
    if (!hole || hole.occupied) {
      killFrog();
      return;
    }
    hole.occupied = true;
    setScore(score + 50);
    if (holes.every((h) => h.occupied)) {
      completeRound();
    } else {
      respawnFrog();
    }
  }

  function overlaps(
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number,
  ): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function checkRoadCollision() {
    const lane = roadLanes[frog.row - ROAD_ROWS[0]];
    if (!lane) return;
    const fx = frog.x + COLLISION_INSET;
    const fy = frog.y + COLLISION_INSET;
    const fs = CELL - COLLISION_INSET * 2;
    for (const v of lane.vehicles) {
      const vw = v.lengthCells * CELL - COLLISION_INSET * 2;
      if (
        overlaps(
          fx,
          fy,
          fs,
          fs,
          v.x + COLLISION_INSET,
          lane.row * CELL + COLLISION_INSET,
          vw,
          fs,
        )
      ) {
        killFrog();
        return;
      }
    }
  }

  function findSupport(lane: RiverLane): FloatItem | null {
    const center = frog.x + CELL / 2;
    for (const item of lane.items) {
      const widthPx = item.widthCells * CELL;
      if (center >= item.x && center <= item.x + widthPx) {
        if (lane.isTurtle) {
          const { phase } = turtlePhase(lane.cyclePhaseOffset);
          if (phase === 'submerged') return null;
        }
        return item;
      }
    }
    return null;
  }

  function checkRiverSupportOnLanding() {
    const lane = riverLanes[frog.row - RIVER_ROWS[0]];
    if (!lane) return;
    const support = findSupport(lane);
    if (!support) killFrog();
  }

  function resolveLanding() {
    const row = frog.row;
    awardRowProgress(row);
    const kind = rowKind(row);
    if (kind === 'goal') {
      resolveGoalLanding();
      return;
    }
    if (kind === 'road') {
      checkRoadCollision();
      return;
    }
    if (kind === 'river') {
      checkRiverSupportOnLanding();
      return;
    }
  }

  function updateLanes(dt: number) {
    const mult = speedMultiplier();
    for (const lane of riverLanes) {
      const speed = lane.baseSpeed * mult;
      for (const item of lane.items) {
        const widthPx = item.widthCells * CELL;
        item.x += lane.direction * speed * (dt / 1000);
        if (lane.direction > 0 && item.x > CANVAS_W + CELL) {
          item.x -= CANVAS_W + widthPx + CELL * 3;
        } else if (lane.direction < 0 && item.x + widthPx < -CELL) {
          item.x += CANVAS_W + widthPx + CELL * 3;
        }
      }
    }
    for (const lane of roadLanes) {
      const speed = lane.baseSpeed * mult;
      for (const v of lane.vehicles) {
        const widthPx = v.lengthCells * CELL;
        v.x += lane.direction * speed * (dt / 1000);
        if (lane.direction > 0 && v.x > CANVAS_W + CELL) {
          v.x -= CANVAS_W + widthPx + CELL * 3;
        } else if (lane.direction < 0 && v.x + widthPx < -CELL) {
          v.x += CANVAS_W + widthPx + CELL * 3;
        }
      }
    }
  }

  function updateJump(dt: number) {
    frog.jumpElapsed += dt;
    const t = Math.min(1, frog.jumpElapsed / JUMP_DURATION_MS);
    frog.x = lerp(frog.jumpStartX, frog.jumpTargetX, t);
    frog.y = lerp(frog.jumpStartY, frog.jumpTargetY, t);
    if (t >= 1) {
      frog.jumping = false;
      frog.x = frog.jumpTargetX;
      frog.y = frog.jumpTargetY;
      frog.row = frog.jumpTargetRow;
      resolveLanding();
    }
  }

  function applyRestChecks(dt: number) {
    const kind = rowKind(frog.row);
    if (kind === 'road') {
      checkRoadCollision();
      return;
    }
    if (kind === 'river') {
      const lane = riverLanes[frog.row - RIVER_ROWS[0]];
      const support = findSupport(lane);
      if (!support) {
        killFrog();
        return;
      }
      frog.x +=
        lane.direction * lane.baseSpeed * speedMultiplier() * (dt / 1000);
      if (frog.x + CELL / 2 < 0 || frog.x + CELL / 2 > CANVAS_W) {
        killFrog();
      }
    }
  }

  function updateTimer(dt: number) {
    attemptTimeRemaining -= dt;
    if (attemptTimeRemaining <= 0) {
      attemptTimeRemaining = 0;
      killFrog();
    }
  }

  function update(dt: number) {
    if (gameOverFired || isPaused) return;
    elapsedMs += dt;
    updateLanes(dt);
    if (frog.jumping) {
      updateJump(dt);
    } else {
      applyRestChecks(dt);
    }
    updateTimer(dt);
  }

  let lastTime: number | null = null;
  let rafId: number | null = null;

  function loop(timestamp: number) {
    const dt = lastTime === null ? 0 : timestamp - lastTime;
    lastTime = timestamp;
    update(Math.min(dt, 100));
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function setPaused(next: boolean) {
    if (gameOverFired || isPaused === next) return;
    isPaused = next;
    if (!isPaused) lastTime = null;
    callbacks.onPauseChange(isPaused);
  }

  function tryJump(dx: number, dy: number) {
    if (frog.jumping || isPaused || gameOverFired) return;
    const targetX = frog.x + dx * CELL;
    const targetRow = frog.row + dy;
    if (targetX < 0 || targetX > (COLS - 1) * CELL) return;
    if (targetRow < 0 || targetRow > ROWS - 1) return;
    frog.jumping = true;
    frog.jumpStartX = frog.x;
    frog.jumpStartY = frog.y;
    frog.jumpTargetX = targetX;
    frog.jumpTargetY = targetRow * CELL;
    frog.jumpTargetRow = targetRow;
    frog.jumpElapsed = 0;
    frog.lastDir = { dx, dy };
  }

  const KEY_DIRECTIONS: Record<string, { dx: number; dy: number }> = {
    ArrowUp: { dx: 0, dy: -1 },
    KeyW: { dx: 0, dy: -1 },
    ArrowDown: { dx: 0, dy: 1 },
    KeyS: { dx: 0, dy: 1 },
    ArrowLeft: { dx: -1, dy: 0 },
    KeyA: { dx: -1, dy: 0 },
    ArrowRight: { dx: 1, dy: 0 },
    KeyD: { dx: 1, dy: 0 },
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
      tryJump(dir.dx, dir.dy);
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      setPaused(!isPaused);
    }
  }

  window.addEventListener('keydown', handleKeyDown);

  regenerateRoundContent();
  drawStaticLayer();
  callbacks.onLivesChange(lives);
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
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      window.removeEventListener('keydown', handleKeyDown);
    },
    setSkin(skin: SkinName) {
      palette = SKIN_PALETTES[skin];
      // El fondo de agua/césped/carretera/meta vive en el canvas offscreen
      // cacheado (`staticLayer`): hay que regenerarlo con la nueva paleta
      // antes de repintar el frame actual, sin tocar ningún otro estado de
      // la partida en curso (score, vidas, nivel, posición del sapo, etc.).
      drawStaticLayer();
      draw();
    },
  };
}
