# 09 — Integración de Snake (motor + leaderboard)

**Estado:** Aprobado
**Depende de:** 04-integracion-supabase (clientes de Supabase); consume la capa ya generalizada por 07-tetris-motor-leaderboard (`getGames`/`getGame`/`getScores`/`getStats`/`saveScore`, `GAME_ENGINES`) sin volver a generalizar nada.
**Fecha:** 2026-07-20
**Objetivo:** Construir desde cero el motor de Snake (sin código fuente de referencia, solo assets visuales de frutas en `references/source-assets/snake-assets/`) como módulo TypeScript que se ejecute dentro de un `<canvas>` en `/game/snake/play` — movimiento por grilla, frutas con sprites, velocidad creciente —, notificando a React los cambios de puntaje, vidas y nivel, agregar su entrada al catálogo (`games` de Supabase y `GAME_ENGINES`), y persistir sus puntuaciones vía la capa de datos genérica ya existente.

## Alcance

**Dentro del alcance:**

- **Nueva fila semilla en la tabla `games` de Supabase** (vía `apply_migration`, mismo esquema ya existente de `games`/`scores`, sin cambios de columnas): `id: "snake"`, `title: "SNAKE"`, `cat: "ARCADE"`, `cover: "cover-snake"`, `color: "green"`. Es la cuarta fila de `games`, junto a `"asteroids"`, `"tetris"` y `"arkanoid"`. `app/data/games.ts` no se toca — ya es código muerto sin ningún import activo en el proyecto (confirmado: nada importa `GAMES`), así que la entrada mock `"serpentina"` que contiene queda intacta pero irrelevante, sin afectar ningún flujo real.
- **Copia de assets estáticos**: `fruits.png` y `sprites.js` (`references/source-assets/snake-assets/`) se copian a `public/assets/snake/`, referenciados por el engine con rutas absolutas (`/assets/snake/...`). Mismo patrón que `public/assets/arkanoid/` del spec 08. `sprites.js` se porta como datos (el mapa `SPRITE_ATLAS.fruits`) dentro de `engine.ts`, no se sirve como script global.
- **Motor construido desde cero** (sin `game.js` de referencia) en `app/game-engines/snake/engine.ts`, exponiendo `createGame(canvas, callbacks)` con `pause()`/`resume()`/`destroy()`, mismo patrón que `asteroids`/`tetris`/`arkanoid`. Incluye:
  - Canvas de 600×600, grilla lógica de 20×20 celdas (30px cada una).
  - Movimiento de la serpiente por tick de grilla (no framerate libre), controlada con `←`/`→`/`↑`/`↓` y `WASD` indistintamente; un input por dirección, sin diagonales, sin reversa instantánea sobre el propio cuerpo (p. ej. presionar `←` mientras se mueve a la derecha no causa una colisión inmediata contra el segundo segmento).
  - Fruta: en cada spawn se elige al azar uno de los 22 sprites de `SPRITE_ATLAS.fruits` (banana, manzana, sandía, etc.) solo por variedad visual; comerla suma **10 puntos fijos** sin importar el tipo, hace crecer la serpiente en un segmento, y genera una nueva fruta en una celda libre.
  - **Progresión de dificultad**: cada 5 frutas comidas (50 puntos), el nivel sube en 1 y el intervalo del tick de movimiento se reduce ~10% (la serpiente se mueve más rápido), sin límite superior de nivel.
  - **Paredes pintadas visualmente** alrededor del borde del canvas (marco distinguible de la grilla jugable), para que el jugador identifique claramente el límite antes de chocar.
  - **Colisión letal**: chocar contra cualquier pared del borde, o contra el propio cuerpo, termina la partida de inmediato. Sin wrap-around toroidal (a diferencia de Asteroids).
  - **Sin HUD interno dibujado en el canvas**: a diferencia de los motores portados (Asteroids/Tetris/Arkanoid), que replican un HUD propio dentro del canvas porque así lo hacía su `game.js` original, Snake no tiene ese precedente — el canvas dibuja únicamente grilla, paredes, serpiente y fruta. El HUD de React (`player-hud`, arriba del `crt-screen`) es la única fuente visual de score/vidas/nivel. El overlay de pausa (`crt-content` con "EN PAUSA") ya lo dibuja React, no el engine.
- **Vidas simplificadas a una sola**: `onLivesChange(1)` se invoca al iniciar la partida; `onLivesChange(0)` se invoca en el momento de la colisión letal, inmediatamente seguido de `onGameOver(finalScore)`. No hay sistema de vidas múltiples ni reaparición.
- **Pausa real con doble camino**: el botón "PAUSA" del HUD de React llama `pause()`/`resume()`; las teclas `P`/`Escape` capturadas por el engine hacen lo mismo internamente (mismo patrón que Arkanoid). Ambos caminos detienen/reanudan el loop de tick real y confirman el nuevo estado vía `onPauseChange(isPaused)`.
- **Callbacks conectados**: `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`, `onLevelChange` — los cinco ya son consumidos genéricamente por `GamePlayClient.tsx`, sin necesidad de tocar ese archivo.
- **Montaje genérico**: se agrega la entrada `snake: { createGame, width: 600, height: 600 }` a `app/game-engines/registry.ts` (`GAME_ENGINES`). No se toca `app/game/[id]/play/page.tsx` ni `GamePlayClient.tsx` — ya resuelven cualquier `id` registrado sin condicionales.
- **Consumo de la capa de datos ya generalizada**: `/game/snake`, el guardado de puntuación en `/game/snake/play` y la pestaña "SNAKE" en `/hall-of-fame` funcionan automáticamente en cuanto la fila `"snake"` existe en `games` y el registro de motores tiene su entrada — no requieren cambios de código propios, porque `getGame`/`getGames`/`getScores`/`getStats`/`saveScore` y las páginas que los consumen ya son genéricas por `gameId` desde el spec 07.

**Fuera de alcance (para otros specs):**

- Soporte táctil/móvil (solo teclado).
- Sonido (no se proveyeron assets de audio para Snake, a diferencia de Arkanoid).
- Políticas RLS en `games`/`scores` — mismo pendiente ya documentado en specs 05/06/07/08.
- Supabase Auth real / relación de `scores.user_id` con un usuario autenticado.
- Cambios visuales en `Podium.tsx`/`Leaderboard.tsx`/`GameCard.tsx`/`MiniCard`.
- Adaptar cualquier otro juego de `references/started-games/` — este spec cubre únicamente Snake.
- Diseño de un cover/gradiente nuevo — se reutiliza `cover-snake` tal cual existe.
- Limpieza de `app/data/games.ts` (código muerto) — queda igual, sin eliminar la entrada `"serpentina"`, porque no afecta ningún flujo real y limpiarlo no es necesario para este spec.
- Ajustes de responsive/CSS del contenedor `crt`/`crt-screen` para encajar un cuarto tamaño de canvas — mismo pendiente ya anotado en specs 05/07/08.

## Modelo de datos

- **Assets estáticos nuevos** (sin código, solo archivos copiados):

  ```
  public/assets/snake/fruits.png
  ```

  `sprites.js` no se copia tal cual a `public/`: su contenido (`SPRITE_ATLAS.fruits`, 22 entradas `{ x, y, w, h }`) se transcribe como una constante TypeScript dentro de `app/game-engines/snake/engine.ts`, apuntando a `/assets/snake/fruits.png` como fuente de la imagen.

- **`app/game-engines/snake/engine.ts`** — módulo nuevo, sin estado global de módulo (grilla, serpiente, fruta actual, dirección, score, nivel, tickInterval, gameState, isPaused y listeners quedan encapsulados dentro del closure de `createGame`):

  ```ts
  export interface SnakeCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void; // solo emite 1 (inicio) y 0 (game over)
    onGameOver: (finalScore: number) => void;
    onPauseChange: (isPaused: boolean) => void;
    onLevelChange: (level: number) => void;
  }

  export interface SnakeGame {
    pause: () => void;
    resume: () => void;
    destroy: () => void;
  }

  export function createGame(
    canvas: HTMLCanvasElement,
    callbacks: SnakeCallbacks,
  ): SnakeGame;
  ```

  Internamente conserva, como funciones/estructuras encapsuladas: la constante `FRUIT_SPRITES` (transcrita de `sprites.js`), la carga de `fruits.png` vía `Image()`, la representación de la grilla (20×20, celdas de 30px sobre un canvas de 600×600), el arreglo de segmentos de la serpiente, la posición de la fruta activa, el loop de tick controlado por `setInterval`/`requestAnimationFrame` con acumulador de tiempo (para desacoplar el tick lógico del framerate de render), detección de colisión contra paredes y contra el propio cuerpo, el dibujo del marco de paredes, y los listeners de teclado (`←`/`→`/`↑`/`↓`, `WASD`, `P`/`Escape`).

  - `onScoreChange` se invoca cada vez que la serpiente come una fruta (`score += 10`).
  - `onLivesChange` se invoca exactamente dos veces por partida: `1` al iniciar (`createGame`), `0` en el instante de la colisión letal.
  - `onGameOver` se invoca una única vez por partida, inmediatamente después de `onLivesChange(0)`, con el `score` final acumulado.
  - `onLevelChange` se invoca al iniciar (`level = 1`) y cada vez que se cruza un umbral de 5 frutas comidas (`level++`, reduciendo el intervalo del tick ~10%).
  - `onPauseChange` se invoca al confirmar cada cambio de estado de pausa, sin importar si lo inició `pause()`/`resume()` (React) o las teclas `P`/`Escape` (engine).

- **Fila semilla en `games`** (SQL de la migración, mismo esquema ya existente de `games`/`scores`, sin cambios de columnas):

  ```sql
  insert into games (id, title, short, long, cat, cover, color) values (
    'snake', 'SNAKE',
    'Crece sin morder tu propia cola.',
    'Guía una serpiente de luz por una grilla cerrada, devorando frutas para crecer. Cada bocado la acelera un poco más. Un giro en falso contra tu propio cuerpo o contra el borde termina la partida.',
    'ARCADE', 'cover-snake', 'green'
  );
  ```

- **`app/game-engines/registry.ts`**: se agrega la entrada `snake: { createGame: snakeCreateGame, width: 600, height: 600 }` a `GAME_ENGINES`, con su import correspondiente (`import { createGame as snakeCreateGame } from './snake/engine'`). No se agregan tipos nuevos — reutiliza `EngineCallbacks`/`EngineInstance` ya existentes en ese archivo.

## Plan de implementación

1. **Copiar `fruits.png` a `public/assets/snake/`** y transcribir `SPRITE_ATLAS.fruits` de `sprites.js` como constante `FRUIT_SPRITES` en un archivo nuevo (o al inicio de `engine.ts`, definido en el siguiente paso). El sistema queda funcional: el asset está disponible para servirse, aunque nada lo consuma todavía.

2. **Crear la migración de Supabase** (vía MCP `apply_migration`) que inserta la fila semilla de `"snake"` en `games`, usando el esquema ya existente (sin alterar columnas de `games`/`scores`). El sistema queda funcional: la fila existe en Supabase, pero ninguna ruta la usa todavía (`/game/snake` da 404 porque `GAME_ENGINES` aún no tiene la clave `"snake"`).

3. **Crear `app/game-engines/snake/engine.ts` — núcleo del motor**: `createGame(canvas, callbacks)` que inicializa la grilla 20×20 (celdas de 30px sobre canvas 600×600), dibuja el marco de paredes, coloca la serpiente inicial y una primera fruta (sprite aleatorio de `FRUIT_SPRITES`), captura `←`/`→`/`↑`/`↓`/`WASD` para cambiar de dirección (sin permitir reversa instantánea sobre el segundo segmento), y corre un loop de tick que mueve la serpiente, detecta colisión contra pared o contra el propio cuerpo, detecta si comió la fruta (crece, nueva fruta, `score += 10`), y renderiza cada frame (grilla, paredes, serpiente, fruta). El sistema queda funcional: el módulo compila, es importable, y de forma aislada (ej. montado manualmente en una página de prueba) el juego es jugable con teclado, aunque todavía no notifique nada a React.

4. **Agregar progresión de dificultad** — cada 5 frutas comidas, incrementar el nivel interno en 1 y reducir ~10% el intervalo del tick de movimiento (tope inferior razonable para que el juego siga siendo jugable en niveles altos, ej. no bajar de ~50ms). El sistema queda funcional: la velocidad del juego se acelera visiblemente a medida que la serpiente crece, de forma aislada.

5. **Conectar los callbacks `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver`** — invocar `onLivesChange(1)` y `onLevelChange(1)` al iniciar; `onScoreChange(score)` en cada fruta comida; `onLevelChange(level)` en cada umbral de 5 frutas; y en el instante de colisión letal, `onLivesChange(0)` seguido de `onGameOver(finalScore)`, deteniendo el loop de tick. El sistema queda funcional: el engine notifica todos los cambios de estado relevantes, aunque aún no haya un consumidor en React.

6. **Implementar `pause()`/`resume()`/`destroy()`** — controlando el loop de tick real (detener/reanudar el `setInterval`/acumulador), agregando además los listeners de teclado `P`/`Escape` que llaman internamente a la misma lógica de pausa/reanudación, invocando `onPauseChange(true)`/`onPauseChange(false)` en ambos caminos. `destroy()` detiene el loop y remueve todos los listeners de teclado agregados por `createGame`. El sistema queda funcional: la API pública del engine está completa y probada de forma aislada.

7. **Registrar el motor en `app/game-engines/registry.ts`** — agregar el import `snakeCreateGame` y la entrada `snake: { createGame: snakeCreateGame, width: 600, height: 600 }` a `GAME_ENGINES`. El sistema queda funcional de punta a punta: `/game/snake` y `/game/snake/play` dejan de dar 404, el juego es jugable completo desde la UI real (HUD de React conectado, pausa, fin de juego), y el guardado de puntuación, el detalle del juego y la pestaña "SNAKE" del salón de la fama funcionan automáticamente vía la capa de datos ya generalizada.

8. **Verificación manual y build** — jugar una partida completa en `/game/snake/play` confirmando: movimiento con flechas y WASD, crecimiento al comer fruta (con sprites variados), aceleración progresiva cada 5 frutas, paredes visibles y letales, colisión contra el propio cuerpo, pausa real con botón y con `P`/`Escape`, fin de juego automático al chocar, guardado de puntuación real, y que la puntuación aparece en `/game/snake` y en la pestaña "SNAKE" de `/hall-of-fame` tras recargar. Confirmar que el resto del catálogo no tiene regresiones. Ejecutar `npm run build` sin errores de TypeScript ni de ESLint. El sistema queda funcional y verificado de punta a punta.

## Criterios de aceptación

- [ ] La tabla `games` de Supabase contiene una fila `id: "snake"`, `title: "SNAKE"`, `cat: "ARCADE"`, `cover: "cover-snake"`, `color: "green"`, sembrada por la migración.
- [ ] `public/assets/snake/fruits.png` existe y es servido por la app; `app/game-engines/snake/engine.ts` referencia la imagen con ruta absoluta (`/assets/snake/fruits.png`).
- [ ] `app/game-engines/snake/engine.ts` existe, exporta `createGame(canvas, callbacks)` y no usa variables globales de módulo (grilla, serpiente, fruta, score, nivel, estado de pausa y listeners quedan encapsulados dentro del closure de `createGame`).
- [ ] `SnakeCallbacks` incluye `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`, `onLevelChange`, todos obligatorios, compatibles con `EngineCallbacks` de `registry.ts`.
- [ ] En `/game/snake/play` el juego se renderiza dentro de un `<canvas>` de 600×600 y es jugable con teclado: `←`/`→`/`↑`/`↓` y `WASD` controlan la dirección de la serpiente, sin reversa instantánea sobre el segundo segmento.
- [ ] El borde del canvas muestra un marco de paredes claramente distinguible de la grilla jugable.
- [ ] Comer una fruta hace crecer la serpiente en un segmento, suma 10 puntos, y genera una nueva fruta en una celda libre con un sprite aleatorio entre los 22 de `FRUIT_SPRITES`.
- [ ] Cada 5 frutas comidas (50 puntos), el nivel sube en 1 y la velocidad de movimiento de la serpiente aumenta (~10% de reducción del intervalo del tick).
- [ ] Chocar contra cualquier pared del borde, o contra el propio cuerpo, termina la partida de inmediato (sin wrap-around toroidal).
- [ ] El canvas no dibuja ningún HUD interno propio (score/vidas/nivel) — el HUD de React es la única fuente visual de esos datos durante la partida.
- [ ] `onLivesChange` se invoca exactamente con `1` al iniciar la partida y con `0` en el instante de la colisión letal, inmediatamente seguido de `onGameOver(finalScore)`.
- [ ] El botón "PAUSA" del HUD de React detiene el loop de tick real (la serpiente deja de moverse), y "REANUDAR" lo reactiva; las teclas `P`/`Escape` capturadas por el engine producen el mismo efecto; ambos caminos confirman el estado vía `onPauseChange(isPaused)`.
- [ ] Al llegar a la colisión letal, React muestra automáticamente el modal "FIN DEL JUEGO" con el puntaje final recibido vía `onGameOver`.
- [ ] Al presionar "JUGAR DE NUEVO", el engine se destruye y se vuelve a crear desde cero: serpiente, fruta, puntaje (0), nivel (1) y velocidad quedan en su estado inicial.
- [ ] Salir de la partida (botón "SALIR" o navegación fuera de la página) limpia correctamente el engine (`destroy()` se llama en el cleanup del `useEffect`, sin loops ni listeners de teclado colgando).
- [ ] `app/game-engines/registry.ts` incluye la entrada `snake: { createGame, width: 600, height: 600 }`, sin modificar `app/game/[id]/play/page.tsx` ni `GamePlayClient.tsx`.
- [ ] En `/game/snake/play`, guardar la puntuación inserta una fila real en `scores` (`game_id: "snake"`) vía `saveScore`, reutilizando la Server Action ya existente sin cambios.
- [ ] En `/game/snake`, el título, descripción, leaderboard lateral, "Mejor global" y "Partidas" provienen de Supabase vía `getGame`/`getScores`/`getStats`, sin cambios en esas funciones.
- [ ] En `/hall-of-fame`, la pestaña "SNAKE" muestra las puntuaciones reales de `scores` para `game_id: "snake"`.
- [ ] El resto del catálogo (`asteroids`, `tetris`, `arkanoid`, y los juegos mock restantes) conserva exactamente su comportamiento actual, sin regresiones.
- [ ] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Motor construido desde cero**, sin `game.js` de referencia (a diferencia de Asteroids/Tetris/Arkanoid), porque el usuario no dispone de código fuente para Snake — solo de los sprites de frutas (`fruits.png`/`sprites.js`). Toda la mecánica se definió por preguntas directas en vez de leerse de un archivo existente. Decisión explícita del usuario.
- **`id: "snake"` (inglés) en vez de reutilizar `"serpentina"`**, mismo criterio ya aplicado con rocas→asteroids y caida→tetris: el nombre en inglés del juego real como id/ruta/carpeta, dejando la entrada mock en español intacta pero sin usarse. Decisión explícita del usuario.
- **`app/data/games.ts` no se toca**, a diferencia de lo que describían los specs 07/08 sobre "eliminar la entrada mock correspondiente" — se confirmó durante este spec que ese archivo ya es código muerto (ningún import activo en el proyecto lo referencia; todas las páginas leen el catálogo desde Supabase vía `getGames`/`getGame`). Limpiarlo no tiene ningún efecto funcional, así que queda fuera de alcance en vez de repetir un paso que ya no aporta nada.
- **Reutilización de `cover-snake` y `color: "green"`** ya existentes en `globals.css`/mock, en vez de diseñar un cover nuevo — mismo criterio de reutilización visual que asteroids (`cover-rocas`) y arkanoid (`cover-bricks`). Decisión explícita del usuario.
- **Controles duales `←`/`→`/`↑`/`↓` + `WASD`**, en vez de solo flechas, porque el usuario prefirió cubrir ambos esquemas desde el inicio al no haber un original que definiera un único esquema. Decisión explícita del usuario.
- **Una fruta aleatoria del atlas por cada spawn, todas con el mismo puntaje fijo (10 pts)**, en vez de asignar valores distintos por tipo de fruta, para mantener la mecánica simple y usar los 22 sprites solo como variedad visual. Decisión explícita del usuario (se descartó la alternativa de puntajes/efectos diferenciados por fruta).
- **Progresión de dificultad ligada al puntaje** (nivel +1 y velocidad +10% cada 5 frutas), en vez de velocidad fija durante toda la partida, para que el campo "Nivel" del HUD de React tenga un significado real en Snake (igual que ya lo tiene en Asteroids/Tetris/Arkanoid) y el juego se sienta progresivamente más difícil. Decisión explícita del usuario.
- **Una sola vida** (`onLivesChange` solo emite `1` y `0`), en vez de un sistema de vidas múltiples como Asteroids/Arkanoid, porque Snake clásico termina la partida en el primer choque letal — no hay reaparición. Se decidió sobre la restricción de que `onLivesChange` es obligatorio en `EngineCallbacks`; en vez de omitirlo o inventar un sistema de vidas artificial, se mapea directamente al ciclo de vida real de una partida de Snake. Decisión explícita del usuario.
- **Colisión letal contra pared Y contra el propio cuerpo**, sin wrap-around toroidal, en vez de que la serpiente atraviese los bordes como en Asteroids — es el comportamiento del Snake clásico, y el usuario lo confirmó explícitamente pidiendo además que las paredes se pinten visualmente alrededor del canvas para que el límite sea evidente antes de chocar. Decisión explícita del usuario.
- **Sin HUD interno dibujado en el canvas**, a diferencia de Asteroids/Tetris/Arkanoid (que replican su HUD original dentro del canvas por ser motores portados), porque Snake no tiene un `game.js` original cuyo HUD preservar — el usuario prefirió evitar la duplicación visual heredada y dejar el HUD de React como única fuente. Decisión explícita del usuario (revierte el patrón por defecto de los specs anteriores para este caso específico).
- **Pausa dual con tecla `P`/`Escape` además del botón de React**, igual que el patrón ya establecido en Arkanoid, en vez de solo el botón de React (como en Asteroids/Tetris). Decisión explícita del usuario.
- **Canvas 600×600 con grilla 20×20 (celdas de 30px)**, un tamaño y proporción propios de Snake, distintos de los ya usados por Asteroids/Arkanoid (800×600) y Tetris. Decisión explícita del usuario.
- **`sprites.js` transcrito como constante TypeScript dentro del engine**, en vez de copiarse tal cual a `public/` y cargarse como `<script>` con un global `window.SPRITE_ATLAS`, para mantener consistencia con el resto del proyecto (100% módulos ES, sin variables globales) — mismo criterio ya aplicado en el puerto de Asteroids respecto a evitar globals.
- **Sin assets de sonido**, a diferencia de Arkanoid, porque no se proveyeron archivos de audio para Snake — queda fuera de alcance de este spec, no es una omisión accidental.
- **Consumo directo de la capa de Supabase ya generalizada** (`getGames`/`getGame`/`getScores`/`getStats`/`saveScore`, `GAME_ENGINES`), sin volver a generalizarla ni duplicarla — mismo criterio ya aplicado por el spec 08 al consumir lo que generalizó el spec 07.

## Riesgos identificados

- **Desincronización entre el tick lógico y el framerate de render**: si el loop de movimiento se implementa acoplado directamente a `requestAnimationFrame` sin un acumulador de tiempo, la velocidad de la serpiente dependería del framerate real del dispositivo en vez del intervalo de tick definido, haciendo el juego más rápido o lento según la máquina. Mitigación: el tick de movimiento debe controlarse con un acumulador de tiempo (`dt`) independiente del framerate de dibujo, igual que ya se maneja el `dt` cappeado en Asteroids.
- **Colisión por reversa instantánea mal detectada**: si el cambio de dirección no valida que la nueva dirección no sea el opuesto exacto de la actual, presionar la tecla opuesta a la de movimiento actual (ej. `←` mientras se mueve a la derecha) causaría que la cabeza "choque" contra el segundo segmento en el mismo tick, terminando la partida de forma injusta e inesperada para el jugador. Mitigación: el engine debe ignorar explícitamente los inputs de dirección opuesta a la actual, no solo confiar en la detección de colisión genérica.
- **Fruta generada sobre una celda ocupada por el propio cuerpo**: si el spawn de la fruta no valida las celdas libres, podría aparecer superpuesta a un segmento de la serpiente, haciéndola inalcanzable o generando un comportamiento visual inconsistente. Mitigación: el cálculo de la celda de spawn debe excluir explícitamente todas las celdas ocupadas por segmentos de la serpiente.
- **Velocidad sin límite inferior razonable**: como la progresión de dificultad reduce el intervalo del tick indefinidamente cada 5 frutas sin un umbral definido en este spec, una partida muy larga podría volver el juego imposible de controlar (tick por debajo de la capacidad de reacción humana) o, en un caso extremo, generar un intervalo tan bajo que sature el loop. Mitigación: fijar un piso razonable al intervalo del tick (ej. no bajar de ~50-80ms) durante la implementación, aunque el valor exacto no forma parte de los criterios de aceptación de este spec.
- **Fugas de memoria por listeners de teclado no limpiados**: mismo riesgo ya documentado en Asteroids/Arkanoid — si `destroy()` no remueve correctamente los listeners de `keydown` (incluyendo `P`/`Escape`), reiniciar varias veces o navegar entre `/game/snake/play` y otras rutas podría acumular listeners duplicados. Mitigación: `destroy()` debe remover explícitamente todos los listeners que `createGame()` agregó.
- **Doble inicialización en desarrollo (React Strict Mode)**: mismo riesgo ya documentado en Asteroids — en modo desarrollo, Next.js invoca los efectos dos veces intencionalmente; si el cleanup no es correcto, podrían quedar dos loops de tick corriendo sobre el mismo canvas. Mitigación: verificar manualmente en `npm run dev` que solo hay una serpiente/loop activo.
- **Teclas de flecha y `Espacio`/`WASD` con comportamiento por defecto del navegador**: por defecto, las flechas pueden hacer scroll de la página si el foco no está en el canvas. Mitigación: el engine debe llamar `preventDefault()` en los listeners de teclado relevantes, igual que en los motores anteriores.
- **Tamaño fijo de canvas (600×600) en un layout responsive**: mismo riesgo ya documentado y aceptado como pendiente en specs 05/07/08 — el resto de la UI es fluida, un canvas de tamaño fijo podría desbordar en pantallas angostas. Mitigación: fuera de alcance de este spec; queda para el spec futuro de responsive/UI ya anotado.
