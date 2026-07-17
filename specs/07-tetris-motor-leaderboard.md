# 07 — Juego Tetris (motor real + leaderboard)

**Estado:** Implementado
**Depende de:** 04-integracion-supabase (clientes de Supabase ya configurados); generaliza y reemplaza el uso literal de "asteroids" en 05-asteroids-motor-real y 06-leaderboard-scores-supabase
**Fecha:** 2026-07-17
**Objetivo:** Portar el motor real de Tetris (references/started-games/03-tetris/game.js) a un módulo TypeScript que se ejecute dentro de un `<canvas>` en /game/tetris/play, notificando a React los cambios de puntaje, vidas y nivel para alimentar el HUD existente, agregar su entrada al catálogo, y generalizar la capa de Supabase (`games`/`scores`) de funciones literales de Asteroids a funciones parametrizadas por `gameId` que ambos juegos consuman.

## Alcance

**Dentro del alcance:**

- **Nueva entrada en Supabase para Tetris**: fila sembrada en la tabla `games` (`id: "tetris"`, `title: "TETRIS"`, `cat: "PUZZLE"`, `cover: "cover-tetro"`, `color: "magenta"`), vía migración. Junto con la fila `"asteroids"` ya existente, son las únicas dos filas en `games` al cierre de este spec — los otros 6 juegos del catálogo (bloque-buster, serpentina, gloton, invasores, ranaria, duelo-pixel) NO se siembran todavía.
- **Puerto del motor a TypeScript**: conversión de `references/started-games/03-tetris/game.js` (~305 líneas) a `app/game-engines/tetris/engine.ts`, exponiendo `createGame(canvas, callbacks)` con `pause()`/`resume()`/`destroy()`, mismo patrón que `app/game-engines/asteroids/engine.ts`.
- **Callbacks de notificación a React**: `onScoreChange`, `onLivesChange` (solo 1/0), `onGameOver`, `onPauseChange`, `onLevelChange` — ver Modelo de datos.
- **HUD interno del canvas ampliado**: panel lateral (SCORE/LINES/LEVEL/NEXT) dibujado dentro de un único canvas de 480×600, igual que se definió antes.
- **Pausa real con doble camino** (botón de React + tecla `P` interna del engine), ambos confirmando vía `onPauseChange`.
- **Controles originales conservados** tal cual (`←`/`→`/`↑`/`X`/`↓`/`Espacio`/`P`).
- **Generalización total de la capa de datos — "cero mocks, cero cableado por id"**:
  - `app/lib/supabase/queries.ts` expone funciones genéricas por `gameId`: `getGame(gameId)`, `getGames()` (lista completa de filas de `games`, con `best`/`plays` calculados en vivo por juego), `getScores(gameId, limit?)`, `getStats(gameId)`.
  - `app/lib/supabase/actions.ts` expone `saveScore(gameId, playerName, score)`.
  - **Ninguna página vuelve a importar `app/data/games.ts` (`GAMES`) ni `app/data/players.ts` (`seededScores`)** — ambos archivos se conservan tal cual en el repo como referencia de contenido para specs futuros (cuando se porten los otros 6 juegos), pero quedan huérfanos de cualquier llamada real: `/games`, `/`, `/game/[id]`, `/game/[id]/play` y `/hall-of-fame` pasan a consultar Supabase exclusivamente.
  - **Registro genérico de motores** (`app/game-engines/registry.ts`): mapa `gameId → { createGame, width, height }` con las entradas `asteroids` y `tetris`. `app/game/[id]/play/page.tsx` consulta este registro por `id` en vez de usar condicionales `if (id === "asteroids")` / `if (id === "tetris")` — no queda ningún nombre de juego hardcodeado en la página.
  - **Se elimina la simulación decorativa de partida** (`game-arena`, `enemy`, `player-ship`, el `setInterval` de puntaje aleatorio y el auto-incremento de nivel) de `app/game/[id]/play/page.tsx`, porque ya no hay ningún juego alcanzable desde la UI sin motor real — todo juego que aparece en el catálogo tiene una fila en `games` y una entrada en el registro de motores.
- **Catálogo (`/games`, biblioteca) generalizado**: se divide en un Server Component (`app/games/page.tsx`) que llama `getGames()` y un Client Component (`app/games/GamesClient.tsx`) que recibe la lista como prop y conserva la búsqueda/filtro por categoría actuales. Solo se listan los juegos que existen en Supabase (asteroids, tetris).
- **Home (`/`) generalizado para su mini-rail de juegos**: se divide en un Server Component (`app/page.tsx`) que llama `getGames()` y un Client Component (`app/HomeClient.tsx`) que recibe la lista y conserva toda la interactividad actual (animaciones `reveal`, navegación). La sección "JUEGOS DISPONIBLES AHORA" muestra solo los juegos reales (asteroids, tetris) en vez de `GAMES.slice(0, 6)`.
- **`app/game/[id]/page.tsx` generalizado**: una sola rama que llama `getGame(id)`/`getScores(id, 10)`/`getStats(id)` para cualquier `id`; si `getGame` devuelve `null`, `notFound()`. Ya no existe una segunda rama con el mock.
- **`app/hall-of-fame/page.tsx` generalizado**: las pestañas se construyen a partir de `getGames()` (no de `GAMES`), y cada pestaña consulta `getScores(g.id, 12)`. Ya no existe rama con `seededScores()`.
- **`CATS` (taxonomía de categorías)** se conserva como constante estática (no es un mock de juegos/puntuaciones, es una lista fija de categorías válidas para el filtro de la UI), pero se reubica en `app/data/types.ts` para que `/games` no necesite importar `app/data/games.ts` en absoluto.

**Fuera de alcance (para otros specs):**

- Migrar los 6 juegos restantes del catálogo (bloque-buster, serpentina, gloton, invasores, ranaria, duelo-pixel) a Supabase, o portarles un motor real — quedan fuera de la UI por completo hasta que cada uno tenga su propio spec de integración.
- `RECENT_SCORES`/`TOP_PLAYERS` del Home — quedan como arrays estáticos ilustrativos, sin conexión a Supabase (no forman parte del sistema de mocks que este spec elimina).
- Eliminar físicamente `app/data/games.ts` o `app/data/players.ts` del repo — se conservan como referencia de contenido para specs futuros, solo se retira su uso desde código en ejecución.
- Soporte táctil/móvil, políticas RLS, Supabase Auth real, cambios visuales en `Podium.tsx`/`Leaderboard.tsx`/`GameCard.tsx`/`MiniCard` — mismos criterios que specs anteriores.
- Diseño de un cover/gradiente nuevo — se reutiliza `cover-tetro` tal cual existe.
- Ajustes de responsive/CSS del contenedor `crt`/`crt-screen` para encajar canvases de distinto tamaño — mismo pendiente ya anotado en el spec 05.

## Modelo de datos

- **`app/lib/supabase/queries.ts`** (funciones genéricas, ninguna referencia a un `gameId` literal):

  ```ts
  export async function getGames(): Promise<Game[]>;
  // SELECT * FROM games; para cada fila, best/plays se calculan en vivo agrupando scores por game_id
  // (MAX(score), COUNT(*)), igual criterio que getStats. Devuelve el tipo Game ya existente en
  // app/data/types.ts (id, title, short, long, cat, cover, color, best, plays).

  export async function getGame(gameId: string): Promise<Game | null>;
  // Una sola fila de games + su best/plays calculado en vivo desde scores.

  export async function getScores(
    gameId: string,
    limit?: number,
  ): Promise<ScoreRow[]>;
  // Sin cambios respecto a la versión ya aprobada: ORDER BY score DESC WHERE game_id = gameId.

  export async function getStats(
    gameId: string,
  ): Promise<{ best: number; plays: number }>;
  // Sin cambios respecto a la versión ya aprobada.
  ```

- **`app/lib/supabase/actions.ts`**:

  ```ts
  export async function saveScore(
    gameId: string,
    playerName: string,
    score: number,
  ): Promise<void>;
  // Sin cambios respecto a la versión ya aprobada.
  ```

- **`app/game-engines/tetris/engine.ts`** — sin cambios respecto a lo ya aprobado:

  ```ts
  export interface TetrisCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void; // solo emite 1 (inicio) y 0 (game over)
    onGameOver: (finalScore: number) => void;
    onPauseChange: (isPaused: boolean) => void;
    onLevelChange: (level: number) => void;
  }

  export interface TetrisGame {
    pause: () => void;
    resume: () => void;
    destroy: () => void;
  }

  export function createGame(
    canvas: HTMLCanvasElement,
    callbacks: TetrisCallbacks,
  ): TetrisGame;
  ```

- **`app/game-engines/registry.ts`** (nuevo módulo — el único lugar del proyecto que asocia un `gameId` a su motor):

  ```ts
  interface EngineEntry {
    createGame: (
      canvas: HTMLCanvasElement,
      callbacks: EngineCallbacks,
    ) => EngineInstance;
    width: number;
    height: number;
  }

  export const GAME_ENGINES: Record<string, EngineEntry> = {
    asteroids: { createGame: asteroidsCreateGame, width: 800, height: 600 },
    tetris: { createGame: tetrisCreateGame, width: 480, height: 600 },
  };
  ```

  `EngineCallbacks`/`EngineInstance` son un tipo unión/compatible de `AsteroidsCallbacks`/`AsteroidsGame` y `TetrisCallbacks`/`TetrisGame` (ambos ya comparten la misma forma: `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`, `onLevelChange`, `pause`/`resume`/`destroy`). `app/game/[id]/play/page.tsx` consulta `GAME_ENGINES[id]` en vez de condicionales por nombre de juego; si no hay entrada (no debería ocurrir, ya que solo se listan juegos con motor registrado), la página usa `notFound()`.

- **`app/data/types.ts`**: `CATS` se agrega aquí (se retira de `app/data/games.ts`) como constante estática de categorías válidas, sin relación a datos de juegos simulados:

  ```ts
  export const CATS = [
    'TODOS',
    'ARCADE',
    'PUZZLE',
    'SHOOTER',
    'VERSUS',
  ] as const;
  ```

- **`app/games/GamesClient.tsx`** (nuevo, recibe la lista ya resuelta por el Server Component `app/games/page.tsx`):

  ```ts
  { games: Game[] } // mismo shape que ya consume GameCard, sin cambios de props
  ```

- **`app/HomeClient.tsx`** (nuevo, recibe la lista ya resuelta por el Server Component `app/page.tsx`):

  ```ts
  { games: Game[] } // usado para el mini-rail (MiniCard); RECENT_SCORES/TOP_PLAYERS siguen como constantes internas del componente, sin props nuevas
  ```

- **Fila semilla nueva en `games`** (migración, sin cambios respecto a lo ya aprobado):

  ```sql
  insert into games (id, title, short, long, cat, cover, color) values (
    'tetris', 'TETRIS',
    'Encaja las piezas antes de que el techo te aplaste.',
    'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.',
    'PUZZLE', 'cover-tetro', 'magenta'
  );
  ```

- **`app/data/games.ts` y `app/data/players.ts`**: no cambian de contenido ni se eliminan del repo; simplemente ningún archivo bajo `app/` los vuelve a importar al cierre de este spec.

## Plan de implementación

1. **Reubicar `CATS` a `app/data/types.ts`** y quitarlo de `app/data/games.ts`. Ajustar el único import actual (`app/games/page.tsx`). El sistema queda funcional: mismo comportamiento, sin cambios visibles.

2. **Generalizar `app/lib/supabase/queries.ts` y `app/lib/supabase/actions.ts`** — reemplazar `getAsteroidsGame`/`getAsteroidsScores`/`getAsteroidsStats`/`saveAsteroidsScore` por `getGame(gameId)`, `getGames()`, `getScores(gameId, limit?)`, `getStats(gameId)` y `saveScore(gameId, playerName, score)`. El sistema queda funcional: los módulos compilan e importan, pero ninguna página los usa todavía (siguen consumiendo las funciones literales viejas hasta el paso 7).

3. **Crear la migración de Supabase** (vía MCP `apply_migration`) que inserta la fila semilla de `"tetris"` en `games`, sin alterar el esquema existente ni las filas de Asteroids. El sistema queda funcional: la fila existe en Supabase, pero ninguna página la consulta todavía.

4. **Crear `app/game-engines/tetris/engine.ts`** — portar `game.js` completo: tablero, pieza actual/siguiente, `rotateCW`/`tryRotate` (wall kicks), `collide`, `clearLines`, `ghostY`, `lockPiece`, y el dibujo combinado tablero + panel lateral (SCORE/LINES/LEVEL/NEXT) en un canvas de 480×600, encapsulado en `createGame(canvas, callbacks)`. El sistema queda funcional: el módulo compila y es importable, pero todavía no se usa desde ninguna página.

5. **Conectar los callbacks del engine de Tetris** — `onLivesChange(1)` al iniciar; `onScoreChange`/`onLevelChange` en los puntos donde `clearLines()` actualiza `score`/`level`; `onLivesChange(0)` + `onGameOver(finalScore)` cuando `spawn()` detecta colisión inmediata; `onPauseChange` confirmado tanto por `pause()`/`resume()` externos como por la tecla `P` interna. El sistema queda funcional: el engine notifica todos los cambios de estado de forma aislada.

6. **Crear `app/game-engines/registry.ts`** — mapa `GAME_ENGINES: Record<string, { createGame, width, height }>` con las entradas `asteroids` y `tetris`, usando los engines ya existentes de ambos. El sistema queda funcional: el registro compila y exporta el mapa, aún no se consume desde ninguna página.

7. **Reescribir `app/game/[id]/play/page.tsx`** — eliminar por completo la simulación decorativa (`game-arena`, `enemy`, `player-ship`, el `setInterval` de puntaje aleatorio y el auto-incremento de nivel) y las condicionales `isAsteroids`/por-id; sustituir por una consulta genérica a `GAME_ENGINES[id]` que monta un `<canvas>` con las dimensiones (`width`/`height`) declaradas en el registro y conecta sus callbacks al estado React existente (`score`, `lives`, `level`, `paused`, `over`). El guardado de puntuación llama a `saveScore(game.id, name, score)` para cualquier `id`. El sistema queda funcional: tanto Asteroids como Tetris son jugables end-to-end vía el mismo código genérico, sin ningún nombre de juego hardcodeado en la página.

8. **Reescribir `app/game/[id]/page.tsx`** — una sola rama que llama `getGame(id)`, `getScores(id, 10)` y `getStats(id)`; si `getGame` devuelve `null`, `notFound()`. Se elimina la segunda rama que usaba `GAMES`/`seededScores()`. El sistema queda funcional: `/game/asteroids` y `/game/tetris` muestran datos reales; cualquier otro `id` da 404 (correcto, ya no existe en Supabase).

9. **Dividir `/games` en Server + Client Component** — `app/games/page.tsx` pasa a ser un Server Component `async` que llama `getGames()` y renderiza `app/games/GamesClient.tsx` (nuevo, `'use client'`) con la lista como prop, conservando la búsqueda y el filtro por categoría (`CATS` ahora importado desde `app/data/types.ts`) tal cual funcionan hoy. El sistema queda funcional: la biblioteca solo lista los juegos reales (Asteroids, Tetris), con búsqueda/filtro intactos.

10. **Dividir Home en Server + Client Component** — `app/page.tsx` pasa a ser un Server Component `async` que llama `getGames()` y renderiza `app/HomeClient.tsx` (nuevo, `'use client'`, contiene todo lo que hoy vive en `Home`: hero, features, mini-rail, stats, actividad, pricing) con la lista como prop para el mini-rail `"JUEGOS DISPONIBLES AHORA"`. `RECENT_SCORES`/`TOP_PLAYERS` siguen como constantes estáticas dentro de `HomeClient.tsx`, sin cambios. El sistema queda funcional: el Home muestra solo juegos reales en esa sección, sin regresiones en el resto de secciones.

11. **Reescribir `app/hall-of-fame/page.tsx`** — construir las pestañas a partir de `getGames()` y resolver `getScores(g.id, 12)` para cada juego devuelto (en paralelo, vía `Promise.all`), eliminando la referencia a `GAMES`/`seededScores()`. El sistema queda funcional: el salón de la fama solo tiene pestañas para Asteroids y Tetris, con datos reales.

12. **Verificación manual, chequeo de imports muertos y build** — confirmar (vía búsqueda de texto) que ningún archivo bajo `app/`/`components/` importa `app/data/games.ts` ni `app/data/players.ts`. Jugar una partida completa de Tetris (controles, wall kicks, limpieza de líneas, pausa por botón y por `P`, fin de juego, guardado real) y de Asteroids (sin regresiones tras la generalización). Confirmar `/games`, `/`, `/game/asteroids`, `/game/tetris` y `/hall-of-fame` reflejan datos reales y solo listan los dos juegos sembrados. Ejecutar `npm run build` sin errores de TypeScript/ESLint. El sistema queda funcional y verificado de punta a punta.

## Criterios de aceptación

- [x] La tabla `games` de Supabase contiene exactamente dos filas (`"asteroids"`, `"tetris"`) al cierre de este spec; la fila `"tetris"` fue insertada por la migración de este spec con el mismo contenido definido en el Modelo de datos.
- [x] `app/lib/supabase/queries.ts` exporta `getGames()`, `getGame(gameId)`, `getScores(gameId, limit?)` y `getStats(gameId)` — ninguna contiene el literal `"asteroids"` ni `"tetris"` hardcodeado en su lógica. `app/lib/supabase/actions.ts` exporta `saveScore(gameId, playerName, score)`.
- [x] `app/game-engines/tetris/engine.ts` existe, exporta `createGame(canvas, callbacks)` y no usa variables globales de módulo.
- [x] `TetrisCallbacks` incluye `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`, `onLevelChange` (todos obligatorios).
- [x] `app/game-engines/registry.ts` existe y exporta un mapa `gameId → { createGame, width, height }` con entradas para `asteroids` (800×600) y `tetris` (480×600).
- [x] En `/game/tetris/play`, el juego se renderiza dentro de un `<canvas>` de 480×600 y es jugable con teclado: `←`/`→` mueven, `↑`/`X` rotan (con wall kicks), `↓` hace soft drop, `Espacio` hace hard drop.
- [x] El HUD interno del canvas de Tetris (SCORE/LINES/LEVEL/vista previa NEXT) se dibuja dentro del mismo canvas, igual que en `game.js` original, sin quitar ni agregar elementos.
- [x] El HUD de React (Jugador/Puntuación/Vidas/Nivel) refleja datos reales de Tetris: `Vidas` muestra 1 mientras la partida está en curso y 0 al terminar; `Nivel` refleja el nivel real.
- [x] El botón "PAUSA" del HUD de React y la tecla `P` capturada por el engine pausan/reanudan el `requestAnimationFrame` real de Tetris; ambos caminos sincronizan el estado visual de pausa vía `onPauseChange`.
- [x] Al no caber una pieza nueva al generarse, el engine invoca `onLivesChange(0)` seguido de `onGameOver(finalScore)`, y React muestra el modal "FIN DEL JUEGO" con el puntaje final.
- [x] Al presionar "JUGAR DE NUEVO" en Tetris, el engine se destruye y se vuelve a crear desde cero: tablero, puntaje, líneas y nivel quedan en su estado inicial.
- [x] `app/game/[id]/play/page.tsx` no contiene ninguna condicional `if (id === "asteroids")`/`if (id === "tetris")` ni la simulación decorativa (`game-arena`, `enemy`, `player-ship`, `setInterval` de puntaje aleatorio) — el motor se resuelve exclusivamente vía `GAME_ENGINES[id]`.
- [x] "GUARDAR PUNTUACIÓN" en Tetris inserta una fila real en `scores` (`game_id: "tetris"`) vía `saveScore`; si falla, muestra el mismo mensaje de error con reintento ya existente para Asteroids.
- [x] `app/game/[id]/page.tsx` tiene una sola rama que usa `getGame`/`getScores`/`getStats` para cualquier `id`; visitar `/game/tetris` y `/game/asteroids` muestra datos reales; visitar un `id` que no existe en Supabase da 404.
- [x] `/games` (biblioteca) lista únicamente los juegos devueltos por `getGames()` (Asteroids, Tetris); la búsqueda y el filtro por categoría siguen funcionando.
- [x] La sección "JUEGOS DISPONIBLES AHORA" del Home lista únicamente los juegos devueltos por `getGames()`; el resto de secciones del Home (hero, features, stats, actividad, pricing) no tiene regresiones.
- [x] `/hall-of-fame` muestra únicamente pestañas para los juegos devueltos por `getGames()` (Asteroids, Tetris), cada una con puntuaciones reales vía `getScores(gameId, 12)`.
- [x] Ningún archivo bajo `app/` o `components/` importa `app/data/games.ts` (`GAMES`) ni `app/data/players.ts` (`seededScores`); ambos archivos permanecen en el repo sin eliminarse.
- [x] `CATS` se exporta desde `app/data/types.ts` (ya no desde `app/data/games.ts`).
- [x] Jugar una partida completa de Tetris, guardar la puntuación, y recargar `/game/tetris` y `/hall-of-fame` refleja esa puntuación nueva en ambas pantallas.
- [x] Jugar una partida completa de Asteroids sigue funcionando end-to-end sin regresiones tras la generalización de la capa de Supabase y del registro de motores.
- [x] `Podium.tsx`, `Leaderboard.tsx`, `GameCard.tsx` y `MiniCard` no se modifican — siguen consumiendo los mismos tipos (`ScoreRow[]`, `Game`) sin cambios de props ni de forma.
- [x] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Generalización total de la capa de datos ("cero mocks, cero cableado por id")**, en vez de limitar este spec a agregar Tetris de forma aislada (como se planteó inicialmente, replicando el patrón literal de Asteroids). Decisión explícita del usuario, tomada a mitad del spec tras revisar el primer borrador del plan de implementación: ninguna página debe volver a importar `app/data/games.ts`/`app/data/players.ts`, y no debe quedar ningún `if (id === "asteroids")`/`if (id === "tetris")` en el código. Esto amplía el alcance de "agregar un juego" a "generalizar la arquitectura de catálogo/leaderboard/motor completa", usando Tetris como el caso que fuerza esa generalización.
- **`app/data/games.ts` y `app/data/players.ts` se conservan en el repo sin eliminarse**, pero dejan de ser importados por cualquier página real. Decisión explícita del usuario: sirven como referencia de contenido (textos, categorías, coberturas) para cuando se escriban los specs futuros de los 6 juegos restantes, evitando tener que re-redactar esos textos desde cero.
- **Solo `asteroids` y `tetris` se siembran en la tabla `games` de Supabase** en este spec, en vez de migrar las 8 entradas del catálogo mock de una sola vez. Decisión explícita del usuario: los 6 juegos sin motor real simplemente no aparecen en ninguna pantalla (biblioteca, Home, salón de la fama) hasta que cada uno tenga su propio spec de integración con motor real — ya no se muestran "a medias" con datos simulados.
- **Sin scores sembrados artificialmente para juegos futuros**: cuando un juego nuevo se agregue más adelante, su leaderboard debe iniciar vacío (mismo guard "AÚN NO HAY SUFICIENTES PUNTUACIONES" ya existente para el podio) en vez de sembrar puntuaciones falsas en Supabase para simular actividad previa. Decisión explícita del usuario.
- **Se elimina por completo la simulación decorativa de partida** (`game-arena`, `enemy`/`player-ship`, `setInterval` de puntaje aleatorio, auto-incremento de nivel) de `app/game/[id]/play/page.tsx`, reemplazada por un registro genérico de motores (`app/game-engines/registry.ts`). Como ya no hay ningún juego visible en la UI sin motor real registrado, mantener un camino de "fallback simulado" habría sido código muerto inalcanzable.
- **Registro genérico `GAME_ENGINES` (`gameId → { createGame, width, height }`)** como único punto del proyecto que asocia un id de juego a su motor, en vez de condicionales por nombre esparcidos en `play/page.tsx`. Permite que agregar un futuro motor sea una entrada nueva en el mapa, no una rama `if` adicional.
- **Home (`/`) también generalizado para su mini-rail "JUEGOS DISPONIBLES AHORA"**, dividiéndolo en Server Component (`app/page.tsx`) + Client Component (`app/HomeClient.tsx`), mismo patrón ya usado en `/hall-of-fame`. Decisión explícita del usuario, tras confirmar que ese import de `GAMES` también debía dejar de usarse.
- **`RECENT_SCORES`/`TOP_PLAYERS` del Home quedan fuera de alcance**, como contenido estático ilustrativo, porque no forman parte del sistema formal de mocks (`GAMES`/`seededScores()`) que este spec elimina — son arrays hardcodeados directamente en el componente, sin relación con datos reales de ningún juego. Decisión explícita del usuario.
- **`CATS` se reubica a `app/data/types.ts`**, en vez de quedarse en `app/data/games.ts`, para que `/games` no necesite importar el archivo de mock en absoluto — se trata como una taxonomía fija de categorías, no como "datos de juegos simulados".
- **`/games` (biblioteca) dividido en Server + Client Component**, mismo patrón ya usado en `/hall-of-fame` (Server Component que llama a Supabase, Client Component que recibe los datos como prop y conserva la interactividad de búsqueda/filtro).
- **Nuevo id "tetris" (inglés) en vez de reutilizar la entrada mock "caída"**, mismo criterio ya aplicado con "rocas" → "asteroids": el nombre del juego original es "Tetris" y se conserva tal cual en id, rutas (`/game/tetris`) y carpeta del motor (`app/game-engines/tetris/`). Decisión explícita del usuario.
- **Eliminación de la entrada mock "caída"** del array `GAMES` (aunque el archivo se conserve, ver arriba), en vez de dejarla convivir con "tetris" como se hizo con "rocas"/"asteroids". Decisión explícita del usuario: los mocks se van retirando conforme se agregan los juegos reales correspondientes.
- **`cat: PUZZLE`, `cover: cover-tetro`, `color: magenta`** reutilizados tal cual de la extinta entrada "caída", sin diseñar un cover nuevo — mismo criterio de reutilización visual que "asteroids" aplicó con `cover-rocas`.
- **Spec combinado (motor + leaderboard/generalización)** en un solo documento, en vez de dividir en dos como se hizo históricamente en 05/06, porque el motor de Tetris es sustancialmente más chico que el de Asteroids (sin clases, sin power-ups, sin física de partículas) y no justifica un spec de motor separado.
- **El campo "Vidas" del HUD de React se mantiene sin ocultarse para Tetris**, pero solo toma los valores 1 (partida en curso) y 0 (fin del juego) — en vez de ocultar el campo o dejarlo fijo sin usar. Decisión explícita del usuario: "todos los juegos tienen vidas", y Tetris simplemente tiene una sola.
- **Panel lateral original (SCORE/LINES/LEVEL/NEXT) portado completo dentro de un único canvas ampliado (480×600)**, en vez de separar el tablero del panel o mover ese panel al HUD de React. Decisión explícita del usuario: se conserva el HUD interno del juego tal cual está.
- **Sin campo "Líneas" nuevo en el HUD principal de React** — ese dato vive únicamente dentro del panel interno del canvas, evitando duplicar información que el usuario ya puede ver ahí. Decisión explícita del usuario (ajustada tras una primera propuesta que sí lo agregaba).
- **Tecla `P` conservada como atajo de pausa además del botón de React**, a diferencia de Asteroids (que no tenía atajo de teclado). Ambos caminos confirman el estado real vía `onPauseChange`, manteniendo a React como fuente de verdad visual sin importar cuál se usó. Decisión explícita del usuario.
- **Controles originales conservados tal cual** (`←`/`→`, `↑`/`X`, `↓`, `Espacio`, `P`), sin modificaciones.
- **Reinicio del juego únicamente vía el botón "JUGAR DE NUEVO" de React** (`destroy()` + `createGame()`), descartando el botón `#restart-btn` del DOM original de `game.js` — mismo criterio ya aplicado en Asteroids para evitar que el engine se reinicie por su cuenta mientras el modal de React sigue abierto.
- **Generalización de `queries.ts`/`actions.ts` aplicada retroactivamente a Asteroids**, migrando `getAsteroidsGame`/`getAsteroidsScores`/`getAsteroidsStats`/`saveAsteroidsScore` a las funciones genéricas por `gameId`, en vez de mantener las funciones literales de Asteroids intactas y agregar funciones nuevas y paralelas para Tetris. Decisión explícita del usuario: "ya todo debe ser generalizado", sin duplicar el patrón por juego.

## Riesgos identificados

- **Regresión en Asteroids por la generalización de la capa de Supabase**: al migrar `getAsteroidsGame`/`getAsteroidsScores`/`getAsteroidsStats`/`saveAsteroidsScore` a funciones genéricas por `gameId`, un error en el refactor (columnas mal mapeadas, `gameId` no propagado correctamente) podría romper silenciosamente el flujo ya funcional de Asteroids. Mitigación: el Paso 12 de verificación manual exige jugar una partida completa de Asteroids además de Tetris antes de dar el spec por terminado.
- **Catálogo completamente vacío si la migración de la fila `"tetris"` falla o el registro de motores queda desincronizado de `games`**: como ya no hay fallback mock en ninguna página, un error de red o una fila mal sembrada dejaría `/games`, `/` y `/hall-of-fame` sin ningún juego visible (a diferencia del estado actual, donde el mock siempre garantiza contenido). Mitigación: no se define en este spec una pantalla de fallback/error para ese caso — queda como riesgo aceptado explícitamente, ya documentado como pendiente de fallas de lectura desde el spec 06.
- **Desincronización entre `games` (Supabase) y `GAME_ENGINES` (registro en código)**: si una fila se siembra en `games` sin agregar su entrada correspondiente en `registry.ts` (o viceversa), un juego listado en el catálogo llevaría a `/game/<id>/play` a un `notFound()` inesperado, o un motor registrado nunca sería alcanzable por no tener fila en `games`. Mitigación: el Paso 12 verifica explícitamente que ambas fuentes queden sincronizadas (exactamente `asteroids` y `tetris` en ambos lados) antes de cerrar el spec.
- **Fugas de memoria por listeners de teclado no limpiados en Tetris**, igual riesgo ya identificado en el spec 05 para Asteroids — ahora agravado por la tecla `P` adicional. Mitigación: `destroy()` del engine de Tetris debe remover explícitamente todos los listeners (`keydown` de movimiento/rotación/drop y el de `P`).
- **Tecla `Espacio` y `P` con comportamiento por defecto del navegador**: `Espacio` puede hacer scroll de la página y `P` no tiene efecto por defecto pero conviene confirmar que no interfiere con otros atajos del navegador/extensión. Mitigación: el engine debe llamar `preventDefault()` en los listeners relevantes, igual que se hizo en Asteroids.
- **Doble invocación de `onGameOver`**: mismo riesgo ya identificado en el spec 05 — si `spawn()` no queda debidamente encapsulado, una condición de carrera podría disparar `onLivesChange(0)`/`onGameOver` más de una vez. Mitigación: usar una bandera interna (`gameOverFired`) igual que en el engine de Asteroids.
- **Server/Client Component split en `/games` y `/` puede introducir errores de hidratación** si el Client Component (`GamesClient.tsx`/`HomeClient.tsx`) asume que la lista de juegos nunca está vacía (p. ej. `games[0]` sin guard) — a diferencia del mock, que siempre tenía 8 entradas, la lista real puede tener solo 2 filas o, en el peor caso, 0. Mitigación: replicar el mismo guard que ya existe en `HallOfFameClient.tsx` para `tab = games[0].id` (comportamiento indefinido si `games` está vacío) — no se resuelve en este spec un estado vacío explícito para `/games`/`/`, queda como riesgo aceptado si la migración fallara.
- **Tamaño fijo de canvas (480×600 para Tetris, distinto de 800×600 para Asteroids) en un layout responsive**: mismo riesgo ya confirmado y aceptado como pendiente en el spec 05 (espacio sobrante en `crt-screen` en viewports angostos), ahora con dos tamaños distintos de canvas conviviendo. Sigue fuera de alcance de este spec.
- **Imports residuales de `app/data/games.ts`/`app/data/players.ts` no detectados**: si algún componente auxiliar no cubierto explícitamente en el plan (por ejemplo, algún componente compartido no listado) sigue importando el mock, el criterio de aceptación de "cero imports" quedaría incumplido sin que ningún build falle (TypeScript no marca error por un import válido a un archivo que sigue existiendo). Mitigación: el Paso 12 incluye una búsqueda de texto explícita (`GAMES`/`seededScores`) sobre `app/` y `components/` antes de cerrar el spec, no solo confiar en `npm run build`.
