# 08 — Integración de Arkanoid (motor + leaderboard)

**Estado:** Implementado
**Depende de:** 04-integracion-supabase (clientes de Supabase); consume la capa ya generalizada por 07-tetris-motor-leaderboard (`getGames`/`getGame`/`getScores`/`getStats`/`saveScore`, `GAME_ENGINES`) sin volver a generalizar nada.
**Fecha:** 2026-07-17
**Objetivo:** Portar el motor real de Arkanoid (`references/started-games/04-arkanoid/game.js`) a un módulo TypeScript que se ejecute dentro de un `<canvas>` en `/game/arkanoid/play` — con control por mouse y teclado, sprites y sonido —, notificando a React los cambios de puntaje, vidas y nivel, agregar su entrada al catálogo (`games` de Supabase y `GAME_ENGINES`), y persistir sus puntuaciones vía la capa de datos genérica ya existente.

## Alcance

**Dentro del alcance:**

- **Nueva entrada en el catálogo** (fila semilla en la tabla `games` de Supabase, vía `apply_migration`): `id: "arkanoid"`, `title: "ARKANOID"`, `cat: "ARCADE"`, `cover: "cover-bricks"`, `color: "cyan"`. Es la tercera fila de `games` junto a `"asteroids"` y `"tetris"`. Se elimina la entrada mock `"bloque-buster"` de `app/data/games.ts` (mismo criterio ya aplicado con `"rocas"` → `"asteroids"` y `"caida"` → `"tetris"`: los mocks se retiran conforme se agrega el juego real correspondiente).
- **Copia de assets estáticos**: `spritesheet-breakout.png`, `ball-bounce.mp3` y `break-sound.mp3` se copian a `public/assets/arkanoid/`, referenciados por el engine con rutas absolutas (`/assets/arkanoid/...`). Primer juego portado que requiere sprites/sonido — Asteroids y Tetris dibujan todo con formas vectoriales.
- **Puerto del motor a TypeScript**: conversión de `references/started-games/04-arkanoid/game.js` (269 líneas) + `levels.js` (definición de los 5 niveles, `LEVELS`) + `assets/spritesheet.js` (helpers `loadSpritesheet`/`drawSprite`/`drawFrame`) a `app/game-engines/arkanoid/engine.ts`, exponiendo `createGame(canvas, callbacks)` con `pause()`/`resume()`/`destroy()`, mismo patrón que `asteroids`/`tetris`. Incluye: paddle, pelota, colisiones AABB con bloques, 5 niveles con velocidad creciente, animación de explosión (4 frames por color), reproducción de sonidos de rebote/rotura, y el overlay de pausa con selector de nivel clickeable (botones 1–5).
- **Controles duales, tal cual el original**: la paleta se mueve con `mousemove` sobre el canvas y también con `←`/`→`; `P`/`Escape` alternan pausa internamente en el engine (además del botón "PAUSA" de React); un `click` sobre el canvas, solo durante la pausa, salta al nivel elegido (1–5) mediante los botones dibujados en el overlay de pausa interno.
- **Callbacks de notificación a React**: `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`, `onLevelChange` — ver Modelo de datos. `onGameOver(finalScore)` se invoca tanto al perder las 3 vidas (`gameState === 'gameover'`) como al completar el nivel 5 (`gameState === 'win'`); React muestra el mismo modal "FIN DEL JUEGO" en ambos casos, sin distinguir victoria de derrota.
- **HUD interno del canvas portado tal cual**: `Score`/`Nivel`/iconos de vidas dibujados dentro del propio canvas durante `gameState === 'playing'`, overlay `GAME OVER` / `¡Completaste el juego!` (según corresponda), y el overlay de pausa con el selector de nivel — sin quitar ni agregar elementos, coexistiendo con el `player-hud` de React (duplicación visual intencional, mismo criterio ya aceptado en Asteroids/Tetris).
- **Pausa real con doble camino**: el botón "PAUSA" del HUD de React llama `pause()`/`resume()`; las teclas `P`/`Escape` capturadas por el engine hacen lo mismo internamente. Ambos caminos detienen/reanudan el `requestAnimationFrame` real y confirman el nuevo estado vía `onPauseChange(isPaused)`.
- **Montaje genérico**: se agrega la entrada `arkanoid: { createGame, width: 800, height: 600 }` a `app/game-engines/registry.ts` (`GAME_ENGINES`). No se toca `app/game/[id]/play/page.tsx` ni `GamePlayClient.tsx` — ya resuelven cualquier `id` registrado sin condicionales, y ya conectan los cinco callbacks (incluido `onLevelChange`, obligatorio desde spec 07).
- **Consumo de la capa de datos ya generalizada**: `/game/arkanoid`, el guardado de puntuación en `/game/arkanoid/play` y la pestaña "ARKANOID" en `/hall-of-fame` funcionan automáticamente en cuanto la fila `"arkanoid"` existe en `games` y el registro de motores tiene su entrada — no requieren cambios de código propios, porque `getGame`/`getGames`/`getScores`/`getStats`/`saveScore` y las páginas que los consumen ya son genéricas por `gameId` desde el spec 07.

**Fuera de alcance (para otros specs):**

- Soporte táctil/móvil (el original ya usa mouse en desktop, pero no hay adaptación a touch/tap para móvil).
- Políticas RLS en `games`/`scores` — mismo pendiente ya documentado en specs 05/06/07.
- Supabase Auth real / relación de `scores.user_id` con un usuario autenticado.
- Cambios visuales en `Podium.tsx`/`Leaderboard.tsx`/`GameCard.tsx`/`MiniCard`.
- Adaptar cualquier otro juego de `references/started-games/` que no sea Arkanoid.
- Diseño de un cover/gradiente nuevo — se reutiliza `cover-bricks` tal cual existe.
- Ajustes de responsive/CSS del contenedor `crt`/`crt-screen` para encajar un tercer tamaño de canvas — mismo pendiente ya anotado en specs 05/07.

## Modelo de datos

- **Assets estáticos nuevos** (sin código, solo archivos copiados):

  ```
  public/assets/arkanoid/spritesheet-breakout.png
  public/assets/arkanoid/ball-bounce.mp3
  public/assets/arkanoid/break-sound.mp3
  ```

- **`app/game-engines/arkanoid/engine.ts`** — módulo nuevo, sin estado global de módulo (paddle, ball, blocks, explosions, lives, score, gameState, currentLevel, isPaused, listeners y el spritesheet cargado quedan encapsulados dentro del closure de `createGame`):

  ```ts
  export interface ArkanoidCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void;
    onGameOver: (finalScore: number) => void; // se invoca en 'gameover' Y en 'win'
    onPauseChange: (isPaused: boolean) => void;
    onLevelChange: (level: number) => void;
  }

  export interface ArkanoidGame {
    pause: () => void;
    resume: () => void;
    destroy: () => void;
  }

  export function createGame(
    canvas: HTMLCanvasElement,
    callbacks: ArkanoidCallbacks,
  ): ArkanoidGame;
  ```

  Internamente conserva, como funciones/estructuras encapsuladas: `LEVELS` (portado de `levels.js`, 5 niveles con `blocks[]` y `speed`), la carga del spritesheet (`loadSpritesheet`/`drawSprite`/`drawFrame`, portado de `assets/spritesheet.js`, apuntando a `/assets/arkanoid/spritesheet-breakout.png`), `initPaddle`/`initBall`/`loadLevel`, detección de colisión AABB con bloques, wall/paddle bounces, explosiones, `drawOverlay`/`drawPauseOverlay` (HUD interno + selector de nivel clickeable), y los `Audio` de `/assets/arkanoid/ball-bounce.mp3` y `/assets/arkanoid/break-sound.mp3`.

  - `onLivesChange` se invoca cada vez que la pelota cae y se pierde una vida (`lives--`), incluida la transición a `0`.
  - `onGameOver` se invoca una única vez por partida: inmediatamente después de la última `onLivesChange(0)` (derrota), o al completar el nivel 5 (`blocks.every(b => !b.alive)` en el último nivel) — victoria. En ambos casos se pasa el `score` final acumulado.
  - `onLevelChange` se invoca en `loadLevel(n)`, incluyendo la carga inicial del nivel 1.
  - `onPauseChange` se invoca al confirmar cada cambio de estado de pausa, sin importar si lo inició `pause()`/`resume()` (React) o las teclas `P`/`Escape` (engine).

- **Fila semilla en `games`** (SQL de la migración, mismo esquema ya existente de `games`/`scores`, sin cambios de columnas):

  ```sql
  insert into games (id, title, short, long, cat, cover, color) values (
    'arkanoid', 'ARKANOID',
    'Rebota la pelota y destruye muros de neón.',
    'Pilota una paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos a través de 5 niveles. Cada nivel reorganiza la grilla y acelera la pelota. ¿Llegarás hasta el final?',
    'ARCADE', 'cover-bricks', 'cyan'
  );
  ```

  (Contenido reutilizado casi tal cual de la extinta entrada mock `"bloque-buster"`, ajustando `long` para mencionar los 5 niveles reales.)

- **`app/game-engines/registry.ts`**: se agrega una entrada más al mapa ya existente, sin cambiar su forma:

  ```ts
  arkanoid: { createGame: arkanoidCreateGame, width: 800, height: 600 },
  ```

- **Capa de Supabase (`queries.ts`/`actions.ts`) y páginas consumidoras**: sin cambios de firma ni de código — ya son genéricas por `gameId` desde el spec 07 (`getGame`, `getGames`, `getScores`, `getStats`, `saveScore`). Este spec solo agrega la fila `"arkanoid"` que esas funciones ya saben leer/escribir.

## Plan de implementación

1. **Copiar los assets estáticos** a `public/assets/arkanoid/` (`spritesheet-breakout.png`, `ball-bounce.mp3`, `break-sound.mp3`). El sistema queda funcional: los archivos son accesibles vía HTTP en `/assets/arkanoid/...`, aunque nada los consuma todavía.

2. **Crear `app/game-engines/arkanoid/engine.ts`** — portar `game.js` + `levels.js` + `assets/spritesheet.js` completos dentro de `createGame(canvas, callbacks)`: carga del spritesheet (rutas ajustadas a `/assets/arkanoid/...`), `LEVELS`, paddle, pelota, colisiones AABB, wall/paddle bounces, explosiones, sonidos, `drawOverlay`/`drawPauseOverlay` con el selector de nivel clickeable, todo encapsulado (sin variables de módulo globales). El sistema queda funcional: el módulo compila y es importable, pero todavía no se usa desde ninguna página.

3. **Conectar los callbacks del engine** — `onScoreChange`/`onLivesChange` en los puntos donde `game.js` ya actualiza `score`/`lives` (rotura de bloque, pelota perdida); `onLevelChange` en `loadLevel(n)`; `onGameOver(finalScore)` tanto al llegar a `gameState = 'gameover'` como a `gameState = 'win'`, usando una bandera interna (`gameOverFired`) para garantizar una única invocación por partida. El sistema queda funcional: el engine notifica todos los cambios de estado relevantes de forma aislada.

4. **Implementar controles duales y `pause()`/`resume()`/`destroy()`** — listeners de `mousemove`/`click` sobre el canvas (movimiento de paddle y selector de nivel del overlay de pausa) y de teclado (`←`/`→`, `P`/`Escape`) agregados por `createGame` y removidos explícitamente en `destroy()`; `pause()`/`resume()` (llamados por React) y las teclas `P`/`Escape` (internas) controlan el mismo `requestAnimationFrame` real y confirman el estado vía `onPauseChange`. El sistema queda funcional: la API pública del engine está completa y probada de forma aislada.

5. **Agregar la entrada `arkanoid` a `app/game-engines/registry.ts`** (`GAME_ENGINES`), con `width: 800, height: 600`. El sistema queda funcional: el registro reconoce `"arkanoid"`, aunque la fila en Supabase todavía no exista (`/game/arkanoid/play` daría `notFound()` hasta el paso 6).

6. **Crear la migración de Supabase** (vía MCP `apply_migration`) que inserta la fila semilla de `"arkanoid"` en `games`, sin alterar el esquema existente ni las filas de Asteroids/Tetris. El sistema queda funcional de punta a punta: Arkanoid es jugable en `/game/arkanoid/play`, visible en `/game/arkanoid`, `/games`, `/` y `/hall-of-fame` (consumiendo la capa de datos ya generalizada, sin cambios de código adicionales).

7. **Eliminar la entrada mock `"bloque-buster"`** de `app/data/games.ts` (el archivo se conserva, solo se retira esa fila del array `GAMES`), mismo criterio ya aplicado con `"rocas"` y `"caida"`. El sistema queda funcional: sin cambios visibles, ya que `app/data/games.ts` no es importado por ninguna página real desde el spec 07.

8. **Verificación manual y build** — jugar una partida completa de Arkanoid: mover la paleta con mouse y con `←`/`→`, romper bloques (explosión + sonido), pausar con el botón de React y con `P`/`Escape`, saltar de nivel desde el overlay de pausa, perder las 3 vidas (verificar `onGameOver` + modal), completar los 5 niveles en otra partida (verificar que `'win'` también dispara `onGameOver` + modal), guardar puntuación y confirmar que aparece en `/game/arkanoid` y en la pestaña "ARKANOID" de `/hall-of-fame`. Confirmar que Asteroids y Tetris no tienen regresiones. Ejecutar `npm run build` sin errores de TypeScript/ESLint. El sistema queda funcional y verificado de punta a punta.

## Criterios de aceptación

- [x] `public/assets/arkanoid/` contiene `spritesheet-breakout.png`, `ball-bounce.mp3` y `break-sound.mp3`, accesibles vía HTTP.
- [x] `app/game-engines/arkanoid/engine.ts` existe, exporta `createGame(canvas, callbacks)` y no usa variables globales de módulo.
- [x] `ArkanoidCallbacks` incluye `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`, `onLevelChange` (todos obligatorios).
- [x] En `/game/arkanoid/play`, el juego se renderiza dentro de un `<canvas>` de 800×600 y es jugable: la paleta se mueve con mouse y con `←`/`→`, los bloques se rompen con colisión AABB (animación de explosión + sonido), y la pelota rebota en paredes/paleta con sonido.
- [x] Los 5 niveles cargan en orden con velocidad creciente, igual que en `levels.js` original; `onLevelChange` refleja el nivel real en el HUD de React.
- [x] El HUD interno del canvas (Score/Nivel/iconos de vidas, overlay `GAME OVER`, overlay `¡Completaste el juego!`, overlay de pausa con selector de nivel 1–5) se dibuja igual que en `game.js` original, sin quitar ni agregar elementos.
- [x] El botón "PAUSA" de React y las teclas `P`/`Escape` capturadas por el engine pausan/reanudan el mismo `requestAnimationFrame` real; ambos caminos sincronizan el estado visual de pausa vía `onPauseChange`.
- [x] Durante la pausa, hacer clic en uno de los botones 1–5 del overlay interno salta a ese nivel (tablero, pelota y velocidad se reinician al del nivel elegido).
- [x] Al perder las 3 vidas, el engine invoca `onLivesChange(0)` seguido de `onGameOver(finalScore)`, y React muestra el modal "FIN DEL JUEGO" con el puntaje final.
- [x] Al completar el nivel 5 (`gameState === 'win'`), el engine invoca `onGameOver(finalScore)` también, mostrando el mismo modal "FIN DEL JUEGO" con el puntaje final acumulado.
- [x] `onGameOver` se invoca como máximo una vez por partida, sin importar cuántas colisiones/eventos ocurran después de llegar al estado final (derrota o victoria).
- [x] Al presionar "JUGAR DE NUEVO", el engine se destruye y se vuelve a crear desde cero: paddle, pelota, bloques del nivel 1, puntaje (0) y vidas (3) quedan en su estado inicial.
- [x] Salir de la partida (botón "SALIR" o navegación fuera de la página) limpia correctamente el engine (`destroy()` remueve listeners de `mousemove`/`click`/teclado sin dejar ninguno colgando).
- [x] `app/game-engines/registry.ts` incluye la entrada `arkanoid: { createGame, width: 800, height: 600 }`.
- [x] La tabla `games` de Supabase contiene la fila `"arkanoid"` sembrada por la migración de este spec, con el contenido definido en el Modelo de datos.
- [x] "GUARDAR PUNTUACIÓN" en Arkanoid inserta una fila real en `scores` (`game_id: "arkanoid"`) vía `saveScore`, sin cambios de código en `actions.ts`; si falla, muestra el mismo mensaje de error con reintento ya existente para los otros juegos.
- [x] `/game/arkanoid`, `/games`, `/` y `/hall-of-fame` (pestaña "ARKANOID") muestran datos reales de Arkanoid sin ningún cambio de código en esas páginas, más allá de la fila sembrada en `games` y la entrada en `GAME_ENGINES`.
- [x] La entrada mock `"bloque-buster"` ya no existe en el array `GAMES` de `app/data/games.ts` (el archivo se conserva, no se elimina).
- [x] Asteroids y Tetris siguen funcionando end-to-end sin regresiones.
- [x] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **No se generaliza nada de la capa de datos**, a diferencia de los specs 05/06/07 — `queries.ts`/`actions.ts` ya son genéricos por `gameId` desde el spec 07, y este spec confirma que ese diseño escala a un tercer juego sin tocar código: agregar la fila en `games` y la entrada en `GAME_ENGINES` es suficiente para que detalle, partida y salón de la fama funcionen. Decisión explícita del usuario (confirmó el spec combinado recomendado, que asume esta arquitectura ya cerrada).
- **Controles duales (mouse + teclado) portados tal cual el original**, incluyendo el clic para saltar de nivel en el overlay de pausa, en vez de simplificar a solo teclado. Mismo criterio ya aplicado en Asteroids/Tetris de preservar el juego original sin modificarlo. Decisión explícita del usuario.
- **`onGameOver` se invoca tanto en derrota (`gameover`) como en victoria (`win`)**, sin ampliar el contrato de callbacks con un dato adicional de resultado, en vez de agregar una distinción win/lose al modal de React. El modal "FIN DEL JUEGO" de React ya es genérico y no necesita saber si el juego original distingue estados internos de fin de partida — mismo criterio de mantener el contrato de callbacks igual entre todos los engines (`ArkanoidCallbacks` es estructuralmente idéntico a `TetrisCallbacks`/`AsteroidsCallbacks`, compatible con `EngineCallbacks` del registro sin necesidad de un tipo unión especial). Decisión explícita del usuario.
- **Pausa dual (botón de React + `P`/`Escape` internos)**, mismo patrón ya usado en Tetris, en vez de limitarse solo al botón de React como en Asteroids — porque el usuario prefirió preservar los atajos de teclado originales del juego fuente. Decisión explícita del usuario.
- **Assets copiados a `public/assets/arkanoid/`** (carpeta dedicada), en vez de una carpeta compartida `public/assets/` sin subcarpetas, para evitar colisión de nombres de archivo si futuros juegos portados también traen sprites/sonidos. Primer juego del proyecto que requiere assets estáticos servidos por Next.js (Asteroids y Tetris son 100% vectoriales). Decisión explícita del usuario.
- **Reutilización de `cover-bricks`/`cyan`/`ARCADE`** de la extinta entrada mock `"bloque-buster"`, sin diseñar un cover nuevo — mismo criterio ya aplicado con `cover-rocas` (asteroids) y `cover-tetro` (tetris). Se elimina esa entrada del array `GAMES`, igual que se hizo con `"rocas"` y `"caida"` en specs anteriores.
- **Nuevo `id: "arkanoid"`** (nombre del juego original), consistente con el criterio ya usado ("asteroids", "tetris") de usar el nombre real del juego fuente en `id`, ruta (`/game/arkanoid`) y carpeta del motor (`app/game-engines/arkanoid/`), en vez de reutilizar literalmente `"bloque-buster"`.
- **Reinicio únicamente vía "JUGAR DE NUEVO" de React** (`destroy()` + `createGame()`), descartando cualquier reinicio automático interno del engine — mismo criterio ya aplicado en Asteroids/Tetris.
- **Selector de nivel del overlay de pausa conservado como funcionalidad real** (no decorativa): saltar de nivel durante la pausa reinicia tablero/pelota/velocidad al nivel elegido, igual que en el `game.js` original. Decisión explícita del usuario (dentro de "portar tal cual el HUD interno").

## Riesgos identificados

- **Fugas de memoria por listeners no limpiados**: Arkanoid agrega más listeners que Asteroids/Tetris (`mousemove`, `click`, y teclado con `P`/`Escape` además de `←`/`→`). Si `destroy()` no remueve alguno, reiniciar varias veces o navegar entre `/game/arkanoid/play` y otras rutas podría acumular listeners duplicados (paddle respondiendo doble al mouse, clics fantasma en el overlay de pausa). Mitigación: `destroy()` debe remover explícitamente los cinco listeners (`mousemove`, `click`, `keydown`, `keyup`, y cualquier handler adicional) que `createGame()` agregó.
- **Carga asíncrona del spritesheet**: a diferencia de Asteroids/Tetris (dibujo vectorial inmediato), Arkanoid depende de `loadSpritesheet(cb)` completando antes de poder dibujar. Si el `requestAnimationFrame` arranca antes de que la imagen cargue, podría haber un frame o más sin sprites visibles (pantalla negra breve). Mitigación: igual que el original, el loop de dibujo solo debe iniciar (o solo debe dibujar sprites) una vez que `loadSpritesheet` confirma la carga; no forma parte del alcance optimizar ese instante de carga más allá de replicar el comportamiento del juego original.
- **Rutas de assets rotas si no se ajustan al portar**: el `spritesheet.js` y `game.js` originales usan rutas relativas (`assets/spritesheet-breakout.png`, `assets/sounds/*.mp3`) pensadas para abrirse como `file://` o servidor estático simple; si no se ajustan a `/assets/arkanoid/...` (rutas absolutas servidas por Next.js desde `public/`), el spritesheet y los sonidos no cargarán en producción. Mitigación: el Paso 8 de verificación manual exige confirmar visualmente que los sprites y sonidos cargan correctamente, no solo que el build compila.
- **Doble invocación de `onGameOver` por dos caminos distintos** (derrota por vidas agotadas vs. victoria por completar el nivel 5): al haber dos condiciones de disparo distintas en el motor original, hay más superficie para que ambas se cumplan casi simultáneamente (por ejemplo, perder la última vida en el mismo frame que se limpia el último bloque del nivel 5) y disparen `onGameOver` dos veces. Mitigación: misma bandera interna `gameOverFired` ya usada en Asteroids/Tetris, verificando ambas condiciones antes de invocar el callback.
- **Tecla `Espacio` no usada por este juego pero `P`/`Escape` sí interceptadas**: `Escape` puede tener comportamiento por defecto del navegador (salir de fullscreen, cerrar diálogos) que conviene no romper fuera del contexto del canvas. Mitigación: el engine debe llamar `preventDefault()` solo cuando el juego está activo/enfocado, igual criterio ya aplicado con `Espacio` en Asteroids.
- **Tamaño fijo de canvas (800×600, igual que Asteroids pero distinto de Tetris 480×600) en un layout responsive**: mismo riesgo ya confirmado y aceptado como pendiente en los specs 05/07. Sigue fuera de alcance de este spec.
- **`dt` sin cap al recuperar foco de pestaña**: mismo riesgo ya identificado en el spec 05 — si se pierde ese detalle al portar el loop, pausar/reanudar el navegador de pestaña (no el botón de pausa) podría causar saltos bruscos en la física de la pelota. Mitigación: preservar un cap de `dt` explícito al portar el loop, igual que en Asteroids.
