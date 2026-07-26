import type { SkinName } from '../skins';

export interface AsteroidsCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  onPauseChange: (isPaused: boolean) => void;
  onLevelChange?: (level: number) => void;
}

export interface AsteroidsOptions {
  skin?: SkinName;
}

export interface AsteroidsGame {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setSkin: (skin: SkinName) => void;
}

interface AsteroidsPalette {
  bg: string;
  ship: string;
  thrust: string;
  asteroid: string;
  bullet: string;
  particleRGB: string;
  powerup: string;
  hudText: string;
  overlayTitle: string;
  overlaySub: string;
  glow: boolean;
  glowBlur: number;
}

const SKIN_PALETTES: Record<SkinName, AsteroidsPalette> = {
  classic: {
    bg: '#000',
    ship: '#fff',
    thrust: 'rgba(255, 130, 0, 0.85)',
    asteroid: '#fff',
    bullet: '#fff',
    particleRGB: '255,255,255',
    powerup: '#0ff',
    hudText: '#fff',
    overlayTitle: '#fff',
    overlaySub: 'rgba(255,255,255,0.65)',
    glow: false,
    glowBlur: 0,
  },
  neon: {
    bg: '#0a0014',
    ship: '#00f5ff',
    thrust: 'rgba(255,0,255,0.9)',
    asteroid: '#ff00ff',
    bullet: '#00f5ff',
    particleRGB: '255,0,255',
    powerup: '#ff00ff',
    hudText: '#00f5ff',
    overlayTitle: '#ff00ff',
    overlaySub: 'rgba(0,245,255,0.75)',
    glow: true,
    glowBlur: 14,
  },
  retro: {
    bg: '#001100',
    ship: '#00ff41',
    thrust: 'rgba(255,176,0,0.85)',
    asteroid: '#00ff41',
    bullet: '#00ff41',
    particleRGB: '0,255,65',
    powerup: '#ffb000',
    hudText: '#00ff41',
    overlayTitle: '#ffb000',
    overlaySub: 'rgba(0,255,65,0.7)',
    glow: true,
    glowBlur: 6,
  },
};

const W = 800;
const H = 600;

const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;

const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño

// Margen de sangrado para los sprites que hornean el `shadowBlur` (mismo criterio que
// Frogger, spec 11 paso 3): cubre con holgura el desenfoque visible incluso en el glowBlur
// más alto del catálogo (14, `neon`).
const GLOW_MARGIN = 20;

// Balas: radio fijo y color uniforme por skin, sin variación de geometría por instancia —
// a diferencia de `Asteroid` (ver su `drawShape`), un único sprite cacheado por skin cubre
// todas las balas en pantalla. Debe coincidir con `Bullet.radius`.
const BULLET_RADIUS = 2;
const BULLET_SPRITE_SIZE = Math.ceil((BULLET_RADIUS + GLOW_MARGIN) * 2);

// Icono de vida del HUD: mismo contorno que la nave (sin llama de empuje ni parpadeo de
// invencibilidad), siempre dibujado ya rotado -90°; figura estática apta para un solo
// sprite horneado una vez y reutilizado hasta 3 veces por frame.
const LIFE_ICON_SPRITE_HALF = Math.ceil(9 + GLOW_MARGIN);
const LIFE_ICON_SPRITE_SIZE = LIFE_ICON_SPRITE_HALF * 2;

const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, half: number) {
    // Sprite offscreen cacheado por skin (`buildBulletSprite`): radio y color fijos, sin
    // variación por instancia, así que el glow ya viene horneado — sin `shadowBlur` en vivo
    // por bala y por frame (antes se aplicaba aquí mismo en cada `Bullet.draw()`).
    ctx.drawImage(sprite, this.x - half, this.y - half);
  }
}

class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][] = [];

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  // La geometría (número y radio de vértices) es aleatoria por instancia — no reducible a un
  // número finito de variantes, así que no se cachea como sprite offscreen (mismo criterio que
  // `drawVehicle` en Frogger). Lo que sí se elimina es el costo redundante de reasignar
  // `strokeStyle`/`lineWidth`/`lineJoin`/`shadowBlur` en cada instancia: ese estado es idéntico
  // para todos los asteroides de un mismo frame, así que se fija una sola vez en
  // `drawAsteroidField` (ver más abajo) y aquí solo queda la transformación + el trazo, que sí
  // varían por instancia.
  drawShape(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = 12;
  ttl = POWERUP_TTL;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, palette: AsteroidsPalette) {
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = palette.powerup;
    ctx.lineWidth = 2;
    if (palette.glow) {
      ctx.shadowColor = palette.powerup;
      ctx.shadowBlur = palette.glowBlur;
    }
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    if (palette.glow) ctx.shadowBlur = 0;
    ctx.fillStyle = palette.powerup;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('3x', this.x, this.y);
  }
}

class Ship {
  x = W / 2;
  y = H / 2;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  dead = false;
  tripleShot = 0;

  constructor(private keys: Record<string, boolean>) {}

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;

    const ROT = 3.5;
    const THRUST = 260;
    const DRAG = 0.987;

    if (this.keys['ArrowLeft']) this.angle -= ROT * dt;
    if (this.keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!this.keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D, palette: AsteroidsPalette) {
    if (this.dead) return;
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = palette.ship;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    if (palette.glow) {
      ctx.shadowColor = palette.ship;
      ctx.shadowBlur = palette.glowBlur;
    }

    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 9);
    ctx.closePath();
    ctx.stroke();

    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = palette.thrust;
      ctx.stroke();
    }

    ctx.restore();
  }
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, palette: AsteroidsPalette) {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(${palette.particleRGB},${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

type GameState = 'playing' | 'dead' | 'gameover';

export function createGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
  options?: AsteroidsOptions,
): AsteroidsGame {
  const ctx = canvas.getContext('2d')!;
  let palette = SKIN_PALETTES[options?.skin ?? 'classic'];

  // Sprites offscreen cacheados (spec 11, mismo patrón de Frogger): geometría fija y
  // determinista, sin variación por instancia, así que un solo sprite por skin cubre todas
  // las balas/iconos de vida en pantalla. Se construyen aquí y se reconstruyen íntegros en
  // `setSkin()` antes de repintar (ver más abajo).
  const bulletSprite = document.createElement('canvas');
  bulletSprite.width = BULLET_SPRITE_SIZE;
  bulletSprite.height = BULLET_SPRITE_SIZE;
  const bulletSpriteCtx = bulletSprite.getContext('2d')!;

  const lifeIconSprite = document.createElement('canvas');
  lifeIconSprite.width = LIFE_ICON_SPRITE_SIZE;
  lifeIconSprite.height = LIFE_ICON_SPRITE_SIZE;
  const lifeIconCtx = lifeIconSprite.getContext('2d')!;

  function buildBulletSprite() {
    const c = BULLET_SPRITE_SIZE / 2;
    bulletSpriteCtx.clearRect(0, 0, BULLET_SPRITE_SIZE, BULLET_SPRITE_SIZE);
    bulletSpriteCtx.fillStyle = palette.bullet;
    // Glow horneado una sola vez (antes se aplicaba `shadowBlur` por bala y por frame).
    if (palette.glow) {
      bulletSpriteCtx.shadowColor = palette.bullet;
      bulletSpriteCtx.shadowBlur = palette.glowBlur * 0.6;
    }
    bulletSpriteCtx.beginPath();
    bulletSpriteCtx.arc(c, c, BULLET_RADIUS, 0, Math.PI * 2);
    bulletSpriteCtx.fill();
    if (palette.glow) bulletSpriteCtx.shadowBlur = 0;
  }

  function buildLifeIconSprite() {
    const cx = LIFE_ICON_SPRITE_HALF;
    const cy = LIFE_ICON_SPRITE_HALF;
    lifeIconCtx.clearRect(0, 0, LIFE_ICON_SPRITE_SIZE, LIFE_ICON_SPRITE_SIZE);
    lifeIconCtx.save();
    lifeIconCtx.translate(cx, cy);
    lifeIconCtx.rotate(-Math.PI / 2);
    lifeIconCtx.strokeStyle = palette.ship;
    lifeIconCtx.lineWidth = 1.2;
    lifeIconCtx.lineJoin = 'round';
    // Glow horneado una sola vez (antes se aplicaba `shadowBlur` por icono y por frame,
    // hasta 3 veces por frame según las vidas restantes).
    if (palette.glow) {
      lifeIconCtx.shadowColor = palette.ship;
      lifeIconCtx.shadowBlur = palette.glowBlur * 0.5;
    }
    lifeIconCtx.beginPath();
    lifeIconCtx.moveTo(9, 0);
    lifeIconCtx.lineTo(-6, -5);
    lifeIconCtx.lineTo(-3, 0);
    lifeIconCtx.lineTo(-6, 5);
    lifeIconCtx.closePath();
    lifeIconCtx.stroke();
    if (palette.glow) lifeIconCtx.shadowBlur = 0;
    lifeIconCtx.restore();
  }

  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};

  const CAPTURED_KEYS = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'Space',
  ]);

  function pressed(code: string) {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  }

  let ship: Ship;
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: GameState = 'playing';
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;
  let gameOverFired = false;

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function setScore(next: number) {
    score = next;
    callbacks.onScoreChange(score);
  }

  function setLives(next: number) {
    lives = next;
    callbacks.onLivesChange(lives);
  }

  function initGame() {
    ship = new Ship(keys);
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    gameOverFired = false;
    level = 1;
    state = 'playing';
    setScore(0);
    setLives(3);
    spawnAsteroids(4);
    callbacks.onLevelChange?.(level);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
    callbacks.onLevelChange?.(level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    setLives(lives - 1);
    if (lives <= 0) {
      state = 'gameover';
      if (!gameOverFired) {
        gameOverFired = true;
        callbacks.onGameOver(score);
      }
    } else {
      state = 'dead';
      deadTimer = 2;
    }
  }

  function update(dt: number) {
    if (state === 'gameover') {
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === 'dead') {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = 'playing';
        ship.reset();
      }
      return;
    }

    if (pressed('Space')) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          setScore(score + POINTS[a.size]);
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    if (asteroids.length === 0) nextLevel();
  }

  function drawLifeIcon(x: number, y: number) {
    // Sprite offscreen cacheado (`buildLifeIconSprite`): ya viene rotado y con el glow
    // horneado, sin `shadowBlur` en vivo por icono y por frame (antes se aplicaba aquí,
    // hasta 3 veces por frame según las vidas restantes).
    ctx.drawImage(
      lifeIconSprite,
      x - LIFE_ICON_SPRITE_HALF,
      y - LIFE_ICON_SPRITE_HALF,
    );
  }

  function drawAsteroidField() {
    // El estado compartido (estilo, glow) se fija una sola vez por frame en vez de una vez
    // por asteroide (ver comentario de `Asteroid.drawShape`); la geometría en sí no se
    // cachea porque es aleatoria por instancia.
    if (asteroids.length === 0) return;
    ctx.strokeStyle = palette.asteroid;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    if (palette.glow) {
      ctx.shadowColor = palette.asteroid;
      ctx.shadowBlur = palette.glowBlur;
    }
    for (const a of asteroids) a.drawShape(ctx);
    if (palette.glow) ctx.shadowBlur = 0;
  }

  function drawBullets() {
    const half = BULLET_SPRITE_SIZE / 2;
    for (const b of bullets) b.draw(ctx, bulletSprite, half);
  }

  function drawHUD() {
    ctx.fillStyle = palette.hudText;
    ctx.font = '15px monospace';

    ctx.textAlign = 'left';
    ctx.fillText(`SCORE  ${score}`, 14, 26);

    ctx.textAlign = 'center';
    ctx.fillText(`NIVEL ${level}`, W / 2, 26);

    for (let i = 0; i < lives; i++) drawLifeIcon(W - 16 - i * 22, 18);

    if (ship.tripleShot > 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = palette.powerup;
      ctx.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 14, 46);
    }
  }

  function drawOverlay(title: string, sub: string) {
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.overlayTitle;
    ctx.font = 'bold 46px monospace';
    ctx.fillText(title, W / 2, H / 2 - 18);
    ctx.font = '18px monospace';
    ctx.fillStyle = palette.overlaySub;
    ctx.fillText(sub, W / 2, H / 2 + 22);
  }

  function draw() {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx, palette));
    drawAsteroidField();
    powerUps.forEach((p) => p.draw(ctx, palette));
    drawBullets();
    ship.draw(ctx, palette);

    drawHUD();

    if (state === 'gameover')
      drawOverlay(
        'GAME OVER',
        `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`,
      );
  }

  let lastTime: number | null = null;
  let rafId: number | null = null;
  let paused = false;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
    ) {
      return;
    }

    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  }

  function handleKeyUp(e: KeyboardEvent) {
    keys[e.code] = false;
  }

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  buildBulletSprite();
  buildLifeIconSprite();
  initGame();
  rafId = requestAnimationFrame(loop);

  return {
    pause() {
      if (paused) return;
      paused = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      lastTime = null;
      callbacks.onPauseChange(true);
    },
    resume() {
      if (!paused) return;
      paused = false;
      rafId = requestAnimationFrame(loop);
      callbacks.onPauseChange(false);
    },
    destroy() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    },
    setSkin(skin: SkinName) {
      palette = SKIN_PALETTES[skin];
      // El sprite de bala y el icono de vida viven en canvas offscreen cacheados: hay que
      // regenerarlos con la nueva paleta antes de repintar el frame actual (mismo contrato
      // que `setSkin()` en Frogger, spec 11).
      buildBulletSprite();
      buildLifeIconSprite();
      draw();
    },
  };
}
