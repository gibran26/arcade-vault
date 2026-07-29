# Integración de Match Three — variante core (motor + leaderboard)

**Estado:** Borrador
**Depende de:** 04-integracion-supabase (clientes de Supabase); consume la capa ya generalizada
por 07-tetris-motor-leaderboard (`getGames`/`getGame`/`getScores`/`getStats`/`saveScore`,
`GAME_ENGINES`) sin volver a generalizar nada.
**Alternativa a:** `specs/game-jam/match-three/02-match-three-powerups-combos.md` — mismo `id`,
distinto alcance; son mutuamente excluyentes, se implementa solo uno.
**Fecha:** 2026-07-28
**Objetivo:** Construir desde cero el motor mínimo de Match Three (grilla 8×8 de gemas, swap por
cursor de teclado, detección de coincidencias de 3+, gravedad con reposición, 3 vidas y niveles con
objetivo de puntaje creciente) dentro de un `<canvas>` en `/game/match-three/play`, dibujado con
gráficos procedurales detallados y animaciones simples, notificando a React los cambios de puntaje,
vidas y nivel, y persistir sus puntuaciones vía la capa de datos genérica ya existente.

## Alcance

**Dentro del alcance:**

- **Nueva fila semilla en la tabla `games` de Supabase** (vía `apply_migration`, mismo esquema ya
  existente de `games`/`scores`, sin cambios de columnas): `id: "match-three"`,
  `title: "MATCH THREE"`, `cat: "PUZZLE"`, `cover: "cover-tetro"`, `color: "magenta"`. Se suma a las
  filas ya existentes (`asteroids`, `tetris`, `arkanoid`, `snake`, `frogger`).
- **Sin cover nuevo diseñado en este spec**: se revisaron las clases CSS disponibles y sin dueño
  (`cover-glot`, `cover-invaders`, `cover-duelo`) y ninguna sugiere temáticamente un tablero de
  gemas — `cover-glot` es un motivo de Pac-Man (boca recortada), `cover-invaders` es una formación
  de alienígenas, `cover-duelo` es un patrón de duelo VERSUS. Se reutiliza `cover-tetro` (grilla de
  bloques de colores) como placeholder razonable por ser lo más cercano en espíritu (tablero de
  celdas de colores) entre lo ya existente; diseñar un `cover-match3` dedicado queda fuera de
  alcance (ver "Fuera de alcance").
- **Sin assets gráficos externos, pero con detalle visual e identificable**: las gemas, el fondo de
  la grilla y el cursor de selección se dibujan con primitivas de canvas (polígonos, círculos,
  líneas), usando la paleta de colores neón ya definida en `globals.css` (variables
  `--cyan`/`--green`/`--yellow`/`--magenta`) ampliada con dos tonos adicionales (ámbar y amatista,
  ver justificación en "Decisiones") para que hasta 6 tipos de gema simultáneos se distingan entre
  sí — mismo criterio que Frogger ampliando la paleta solo para sus vehículos. Ningún elemento se
  limita a una única forma geométrica de color plano; cada uno combina varias primitivas para
  sugerir textura, identidad o profundidad:
  - **Gema "Gota" (círculo, cian)**: círculo base con relleno en gradiente radial (claro en el
    centro-superior, oscuro en el borde), una elipse de brillo blanco translúcido desplazada hacia
    la esquina superior izquierda, un trazo de contorno más oscuro, y dos arcos cortos internos a
    modo de faceta.
  - **Gema "Rubí" (diamante, magenta)**: cuadrado rotado 45° con una línea diagonal más clara
    cruzando el centro (faceta) y un triángulo pequeño de brillo en el vértice superior.
  - **Gema "Esmeralda" (hexágono, verde)**: hexágono regular con 3 líneas internas que van del
    centro a vértices alternos (facetado) y un arco de brillo en la esquina superior izquierda.
  - **Gema "Topacio" (estrella de 5 puntas, amarillo)**: estrella rellena con un contorno de
    estrella más pequeño inscrito, líneas finas irradiando desde el centro (destello) y un punto de
    brillo fijo.
  - **Gema "Ámbar" (cuadrado redondeado, tono ámbar `#ff9900`, se introduce desde el nivel 3)**:
    cuadrado de esquinas redondeadas con dos trazos diagonales de brillo en esquinas opuestas y un
    contorno interior más claro.
  - **Gema "Amatista" (triángulo, tono violeta `#aa00ff`, se introduce desde el nivel 5)**: triángulo
    relleno con un triángulo inscrito más pequeño de contorno y una franja de brillo a lo largo de
    un borde.
  - **Socket de celda de la grilla**: cada una de las 64 celdas se dibuja como un hueco "hundido"
    (rectángulo redondeado con relleno oscuro, un trazo claro en el borde superior-izquierdo y uno
    oscuro en el inferior-derecho simulando bisel, más un patrón sutil de puntos tenues en las
    esquinas) — nunca una celda plana de un solo color. Este fondo se precalcula una sola vez en un
    `<canvas>` offscreen (ver "Dirección gráfica y de animación" del jam) porque no cambia entre
    frames.
  - **Indicador de cursor**: un contorno rectangular redondeado alrededor de la celda actualmente
    señalada por el teclado, dibujado con un trazo de glow (dos pasadas de `stroke`, una ancha y
    tenue detrás, una fina y brillante encima) — no un simple `strokeRect` de un solo trazo.
  - **Indicador de gema seleccionada**: mismo tipo de contorno que el cursor pero de color blanco,
    dibujado sobre la primera gema elegida mientras se espera el segundo input de swap, para
    distinguirse claramente del cursor libre.
  - **Barra de movimientos restantes y objetivo de nivel**: un indicador (barra que se vacía a
    medida que se consumen movimientos, más un texto del objetivo de puntaje del nivel) dibujado en
    una franja superior del canvas — mismo patrón ya usado por Tetris (panel interno) y por Frogger
    `niveles` (barra de temporizador), aquí como único elemento de "HUD interno" porque
    puntaje/vidas/nivel ya los cubre el HUD de React.
- **Motor construido desde cero** (sin `game.js` de referencia, igual que Snake/Frogger) en
  `app/game-engines/match-three/engine.ts`, exponiendo `createGame(canvas, callbacks)` con
  `pause()`/`resume()`/`destroy()`, mismo patrón que `asteroids`/`tetris`/`arkanoid`/`snake`/
  `frogger`. Incluye:
  - Canvas de 480×480, grilla lógica de 8 columnas × 8 filas (celdas de 56px, con un margen de 16px
    por lado más una franja superior de 40px reservada para la barra de movimientos/objetivo, dentro
    del mismo canvas de 480×480 — la grilla jugable ocupa el área inferior).
  - **Generación inicial sin coincidencias**: al crear la partida (y al reiniciar cada intento de
    nivel), la grilla se rellena con gemas aleatorias de los tipos disponibles en el nivel actual,
    re-tirando cualquier celda que resultaría en una coincidencia de 3+ ya formada desde el inicio,
    para que el tablero arranque siempre "limpio".
  - **Selección y swap por teclado**: `←`/`→`/`↑`/`↓`/`WASD` mueven un cursor de celda por la
    grilla (sin diagonales); `Enter`/`Espacio` selecciona la celda señalada como primer origen del
    swap; una segunda pulsación de `Enter`/`Espacio` sobre una celda **adyacente** (arriba, abajo,
    izquierda o derecha, nunca diagonal) al origen intenta el swap; `Enter`/`Espacio` sobre la misma
    celda ya seleccionada, o `Escape`, cancela la selección sin consumir un movimiento.
  - **Validación de swap**: si intercambiar las dos gemas seleccionadas genera al menos una
    coincidencia de 3+ (horizontal o vertical) involucrando alguna de las dos celdas, el swap se
    confirma, se consume **un movimiento**, y se resuelven las coincidencias (ver siguiente punto).
    Si el intercambio no genera ninguna coincidencia, las gemas animan un swap parcial hacia la
    posición contraria y regresan a su posición original (ver animaciones), **sin consumir
    movimiento** y sin alterar el tablero.
  - **Resolución de coincidencias y gravedad**: toda coincidencia de 3 o más gemas del mismo tipo en
    línea recta (fila o columna) se elimina, sumando puntaje (ver "Puntuación"); las gemas por
    encima de cada columna afectada caen para llenar los huecos (con animación de caída, ver
    animaciones) y se generan gemas nuevas en la parte superior para completar la columna. Si la
    caída y reposición generan nuevas coincidencias automáticas (cascada), estas se resuelven de la
    misma forma de manera encadenada hasta que el tablero queda estable, todo dentro del mismo
    movimiento del jugador.
  - **Sin bloqueos de tablero**: si tras resolver un movimiento no queda ningún swap adyacente
    posible en todo el tablero (tablero "trabado"), el motor reordena internamente las gemas
    existentes (mismo conteo por tipo) hasta que exista al menos un swap válido, sin notificarlo
    visualmente como una acción del jugador ni consumir un movimiento.
  - **Puntuación**: cada gema eliminada en una coincidencia suma 10 puntos base; una coincidencia de
    exactamente 3 gemas suma `30` puntos (`3 × 10`), una de 4 suma `70` (`40` base `+ 30` de bono), y
    una de 5 o más suma `120` (`50` base `+ 70` de bono) — los bonos por tamaño de coincidencia
    existen para premiar coincidencias más grandes sin necesitar power-ups (que son exclusivos de la
    variante `feature`). Las coincidencias resueltas por cascada (encadenadas tras la caída) puntúan
    igual que una coincidencia manual, sin multiplicador — el sistema de combo/multiplicador de
    cascadas es el segundo eje de profundidad exclusivo de la variante `feature`.
- **Niveles con objetivo de puntaje y movimientos limitados**: el nivel 1 arranca con un objetivo de
  `500` puntos acumulados en la partida y una asignación de `20` movimientos para lograrlo, usando
  4 tipos de gema (Gota, Rubí, Esmeralda, Topacio). Al alcanzar el objetivo de puntaje del nivel
  actual dentro de los movimientos asignados, el nivel se completa de inmediato: `onLevelChange`
  sube en 1, el objetivo de puntaje del siguiente nivel aumenta en `300` puntos respecto al anterior,
  la asignación de movimientos del siguiente nivel se reduce en 1 (con un piso de `12`), y desde el
  nivel 3 se habilita el tipo de gema Ámbar y desde el nivel 5 el tipo Amatista (más tipos de gema
  en juego dificulta encontrar coincidencias). Si los movimientos asignados se agotan sin alcanzar el
  objetivo del nivel actual, se resta una vida (ver "Vidas") y, si quedan vidas, el intento se
  reinicia con una grilla nueva y la asignación completa de movimientos del nivel actual (el
  objetivo de puntaje del nivel no cambia, pero el puntaje total de la partida ya acumulado se
  conserva).
- **3 vidas**: la partida arranca con `onLivesChange(3)`. Cada vez que se agotan los movimientos de
  un intento sin alcanzar el objetivo del nivel, se resta una vida; si quedan vidas (`> 0`), el
  intento del nivel actual se reinicia (grilla nueva, movimientos recargados); si llegan a `0`, se
  invoca `onGameOver(finalScore)` inmediatamente después del último `onLivesChange(0)`. No hay vida
  extra por puntaje en esta variante (ver "Fuera de alcance").
- **Pausa real con doble camino**: el botón "PAUSA" del HUD de React llama `pause()`/`resume()`; las
  teclas `P`/`Escape` (fuera del flujo de cancelar una selección activa) capturadas por el engine
  hacen lo mismo internamente. Ambos caminos detienen/reanudan el loop de animación real (caída de
  gemas, cascadas, pulso del cursor) y confirman el nuevo estado vía `onPauseChange(isPaused)`.
- **Callbacks conectados**: `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`,
  `onLevelChange` — los cinco ya son consumidos genéricamente por `GamePlayClient.tsx`, sin
  necesidad de tocar ese archivo.
- **Montaje genérico**: se agrega la entrada `"match-three": { createGame, width: 480, height: 480
}` a `app/game-engines/registry.ts` (`GAME_ENGINES`). No se toca `app/game/[id]/play/page.tsx` ni
  `GamePlayClient.tsx` — ya resuelven cualquier `id` registrado sin condicionales.
- **Consumo de la capa de datos ya generalizada**: `/game/match-three`, el guardado de puntuación en
  `/game/match-three/play` y la pestaña "MATCH THREE" en `/hall-of-fame` funcionan automáticamente
  en cuanto la fila `"match-three"` existe en `games` y el registro de motores tiene su entrada —
  `getGame`/`getGames`/`getScores`/`getStats`/`saveScore` y las páginas que los consumen ya son
  genéricas por `gameId` desde el spec 07, sin cambios propios en esta variante.

**Fuera de alcance (para otros specs):**

- **Power-ups (gemas rayadas y bomba de color) y el sistema de combo/multiplicador de cascadas** —
  todo este eje de profundidad se deja para la variante con power-ups de este mismo juego, ver
  `specs/game-jam/match-three/02-match-three-powerups-combos.md`. Esta variante `core` es
  deliberadamente la versión sin power-ups y sin multiplicador de combo.
- Vida extra por puntaje — se consideró (mismo patrón que Frogger `niveles`) y se descartó para esta
  variante, para mantener el sistema de vidas simple (solo se pierden, nunca se ganan); queda
  disponible como posible extensión de la variante `feature` si se decidiera en el futuro, pero no
  forma parte de ninguna de las dos variantes de este spec.
- Swap por mouse/drag — el control es exclusivamente por teclado (cursor + selección), igual criterio
  que el resto del catálogo (sin soporte de mouse/touch en ningún motor existente).
- Soporte táctil/móvil (solo teclado).
- Sonido (no se proveyeron ni se diseñan assets de audio en esta variante).
- Políticas RLS en `games`/`scores` — mismo pendiente ya documentado en specs 05/06/07/08/09 y en
  ambas variantes de Frogger.
- Supabase Auth real / relación de `scores.user_id` con un usuario autenticado.
- Cambios visuales en `Podium.tsx`/`Leaderboard.tsx`/`GameCard.tsx`/`MiniCard`.
- Adaptar cualquier otro juego de `references/started-games/` — este spec cubre únicamente esta
  variante de Match Three.
- **Sprites, spritesheets o cualquier imagen externa**: el detalle visual descrito en el Alcance
  (facetas, brillos, biseles, destellos) es enteramente procedural, generado con primitivas de canvas
  en tiempo de dibujo (o cacheado en `<canvas>` offscreen) — no se cargan ni se generan archivos de
  imagen.
- **Efectos gráficos pesados**: sistemas de partículas grandes, sombras dinámicas o post-procesado —
  el detalle visual se limita a composición de primitivas simples y las animaciones descritas
  (swap, pop de coincidencia, caída, pulso del cursor), sin motor de partículas costoso.
- **Diseño de un `cover-match3` dedicado** — se reutiliza `cover-tetro` como placeholder razonable
  (ver justificación arriba); diseñar un cover propio para Match Three queda para un spec de
  `skin-designer` futuro si se decide.
- Ajustes de responsive/CSS del contenedor `crt`/`crt-screen` para encajar un sexto tamaño de canvas
  — mismo pendiente ya anotado en specs 05/07/08/09 y en Frogger.

## Modelo de datos

- **`app/game-engines/match-three/engine.ts`** — módulo nuevo, sin estado global de módulo (grilla,
  cursor, selección activa, movimientos restantes, objetivo de nivel, tipos de gema habilitados,
  score, vidas, nivel, estado de pausa, cachés offscreen y listeners quedan encapsulados dentro del
  closure de `createGame`):

  ```ts
  export interface MatchThreeCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void; // emite 3 al iniciar; baja al agotar movimientos sin llegar al objetivo; 0 dispara game over
    onGameOver: (finalScore: number) => void;
    onPauseChange: (isPaused: boolean) => void;
    onLevelChange: (level: number) => void; // emite 1 al iniciar; sube en 1 al alcanzar el objetivo de puntaje del nivel
  }

  export interface MatchThreeGame {
    pause: () => void;
    resume: () => void;
    destroy: () => void;
  }

  export function createGame(
    canvas: HTMLCanvasElement,
    callbacks: MatchThreeCallbacks,
  ): MatchThreeGame;
  ```

  Internamente conserva, como estructuras encapsuladas:
  - `grid: Tile[8][8]`, donde cada `Tile` lleva `id` (para animaciones estables entre frames),
    `gemType: 'drop' | 'ruby' | 'emerald' | 'topaz' | 'amber' | 'amethyst'`, y un bloque de animación
    `{ state: 'idle' | 'swapping' | 'invalid-swap' | 'matching' | 'falling', progress: number (0→1),
fromRow?: number, fromCol?: number }` para que cada celda anime su propia transición
    independientemente de las demás.
  - `cursor: { row: number; col: number }` y `selected: { row: number; col: number } | null`.
  - `movesRemaining: number`, `movesAllowance: number` (del nivel actual), `levelTarget: number`
    (puntaje objetivo del nivel actual), `enabledGemTypes` (crece por nivel, ver Alcance).
  - `score: number`, `lives: number`, `level: number`, `isPaused: boolean`, `gameOverFired: boolean`.
  - **Fase de idle propia por gema**: cada `Tile` lleva un `glowPhase: number` aleatorio fijado al
    generarse, usado para que el brillo/destello sutil de cada gema (ver animaciones) no se vea
    sincronizado entre celdas.
  - **Cachés offscreen**: un `<canvas>` offscreen para el fondo de la grilla (los 64 sockets
    biselados, dibujados una sola vez y volcados cada frame), y un `<canvas>` offscreen por cada uno
    de los 6 tipos de gema (sprite pre-renderizado a tamaño de celda, reutilizado al dibujar cada
    instancia en el tablero en vez de recomponer sus primitivas en cada frame). Ambos cachés se
    generan una única vez en `createGame` y no se invalidan durante la partida (el set de tipos de
    gema habilitados solo crece, nunca cambia de forma retroactiva).
  - El loop de animación (`requestAnimationFrame` con `dt` cappeado) avanza el `progress` de cada
    `Tile` en estado no-`idle`, resuelve swaps/coincidencias/cascadas cuando sus animaciones
    terminan, y redibuja el tablero completo por frame (fondo cacheado + gemas cacheadas + overlays
    de cursor/selección/HUD interno).
  - Los listeners de teclado (`←`/`→`/`↑`/`↓`, `WASD` para mover el cursor; `Enter`/`Espacio` para
    seleccionar/confirmar swap; `P`/`Escape` para pausa, con `Escape` cancelando primero una
    selección activa si existe antes de actuar como atajo de pausa).

  - `onScoreChange` se invoca tras resolver cada coincidencia (manual o en cascada), con el puntaje
    acumulado total.
  - `onLivesChange` se invoca al iniciar (`3`), en cada intento de nivel fallido por agotar
    movimientos (`lives - 1`), y con `0` en el instante en que la última vida se pierde,
    inmediatamente seguido de `onGameOver`.
  - `onGameOver` se invoca una única vez por partida, cuando `lives` llega a `0`, con el `score`
    final acumulado.
  - `onLevelChange` se invoca al iniciar (`level = 1`) y cada vez que se alcanza el objetivo de
    puntaje del nivel actual (`level++`), ajustando en ese momento el objetivo del siguiente nivel,
    su asignación de movimientos, y los tipos de gema habilitados.
  - `onPauseChange` se invoca al confirmar cada cambio de estado de pausa, sin importar si lo inició
    `pause()`/`resume()` (React) o la tecla `P`/`Escape` (engine); mientras está en pausa, ninguna
    animación (swap, caída, pulso del cursor) avanza.

- **Fila semilla en `games`** (SQL de la migración, mismo esquema ya existente de `games`/`scores`,
  sin cambios de columnas):

  ```sql
  insert into games (id, title, short, long, cat, cover, color) values (
    'match-three', 'MATCH THREE',
    'Combina 3 o más gemas antes de quedarte sin movimientos.',
    'Desliza el cursor por una grilla de gemas y combina 3 o más del mismo tipo en línea para hacerlas estallar. Cada nivel exige un puntaje objetivo con un número limitado de movimientos: agotarlos sin alcanzarlo te cuesta una vida.',
    'PUZZLE', 'cover-tetro', 'magenta'
  );
  ```

- **`app/game-engines/registry.ts`**: se agrega la entrada
  `"match-three": { createGame: matchThreeCreateGame, width: 480, height: 480 }` a `GAME_ENGINES`,
  con su import correspondiente (`import { createGame as matchThreeCreateGame } from
'./match-three/engine'`). No se agregan tipos nuevos — reutiliza `EngineCallbacks`/`EngineInstance`
  ya existentes en ese archivo.

- `app/lib/supabase/queries.ts`/`actions.ts` no cambian de firma: `getGames`/`getGame`/`getScores`/
  `getStats`/`saveScore` ya son genéricas por `gameId` desde el spec 07; esta variante solo las
  consume.

## Plan de implementación

1. **Crear la migración de Supabase** (vía MCP `apply_migration`) que inserta la fila semilla de
   `"match-three"` en `games`, usando el esquema ya existente (sin alterar columnas de
   `games`/`scores`). El sistema queda funcional: la fila existe en Supabase, pero ninguna ruta la
   usa todavía (`/game/match-three` da 404 porque `GAME_ENGINES` aún no tiene la clave
   `"match-three"`).
2. **Crear `app/game-engines/match-three/engine.ts` — grilla y generación inicial**:
   `createGame(canvas, callbacks)` que inicializa la grilla lógica 8×8 con los 4 tipos de gema del
   nivel 1, re-tirando celdas hasta que no exista ninguna coincidencia inicial, y dibuja el tablero
   estático (sin cachés aún, primitivas directas) sobre un canvas de 480×480. El sistema queda
   funcional: el módulo compila, es importable, y el tablero inicial se renderiza correctamente de
   forma aislada, sin coincidencias preexistentes.
3. **Conectar cursor, selección y swap por teclado** — capturar `←`/`→`/`↑`/`↓`/`WASD` para mover el
   cursor, `Enter`/`Espacio` para seleccionar y confirmar un swap contra una celda adyacente, validar
   que el swap genera al menos una coincidencia antes de confirmarlo (revirtiendo sin consumir
   movimiento si no la genera). El sistema queda funcional: el jugador puede seleccionar e
   intercambiar gemas con teclado de forma aislada, aunque las coincidencias todavía no se resuelvan.
4. **Agregar resolución de coincidencias, gravedad y cascadas** — detectar coincidencias de 3+ en
   fila/columna tras cada swap válido, eliminarlas sumando puntaje según su tamaño, aplicar gravedad
   para llenar huecos, generar gemas nuevas arriba, y resolver encadenadamente cualquier coincidencia
   nueva generada por la caída, hasta que el tablero quede estable. Incluir la detección y
   re-barajado silencioso de tableros sin swaps posibles. El sistema queda funcional: el ciclo
   completo de swap → coincidencia → cascada → tablero estable funciona de forma aislada.
5. **Agregar movimientos limitados y objetivo de nivel** — inicializar `movesRemaining`/
   `movesAllowance`/`levelTarget` del nivel 1, decrementar `movesRemaining` en cada swap válido,
   detectar cuándo el puntaje acumulado alcanza `levelTarget` (completa el nivel: sube objetivo,
   reduce asignación de movimientos con piso de 12, habilita nuevos tipos de gema en los umbrales de
   nivel 3/5) y cuándo `movesRemaining` llega a 0 sin alcanzar el objetivo (falla el intento). El
   sistema queda funcional: la progresión de niveles y el fallo de intento son observables de forma
   aislada (vía logs o breakpoints), aunque las vidas todavía no reaccionen.
6. **Conectar vidas y game over** — restar una vida en cada intento fallido, reiniciar la grilla y
   los movimientos del nivel actual si quedan vidas, y detener el juego invocando `onGameOver` cuando
   las vidas llegan a 0. El sistema queda funcional: el ciclo completo de vidas/reinicio/fin de
   partida funciona de forma aislada.
7. **Conectar los callbacks `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver`** —
   invocar `onLivesChange(3)` y `onLevelChange(1)` al iniciar; `onScoreChange` tras cada coincidencia
   resuelta; `onLivesChange`/`onLevelChange` en los puntos ya descritos; y `onGameOver(finalScore)`
   inmediatamente después del último `onLivesChange(0)`, deteniendo el loop de animación. El sistema
   queda funcional: el engine notifica todos los cambios de estado relevantes, aunque aún no haya un
   consumidor en React.
8. **Implementar `pause()`/`resume()`/`destroy()`** — controlando el loop de animación real
   (deteniendo/reanudando el avance de `progress` en todas las gemas), agregando los listeners de
   teclado `P`/`Escape` (con `Escape` cancelando primero una selección activa), invocando
   `onPauseChange(true)`/`onPauseChange(false)` en ambos caminos. `destroy()` detiene el loop y
   remueve todos los listeners de teclado agregados por `createGame`. El sistema queda funcional: la
   API pública del engine está completa y probada de forma aislada.
9. **Registrar el motor en `app/game-engines/registry.ts`** — agregar el import
   `matchThreeCreateGame` y la entrada `"match-three": { createGame: matchThreeCreateGame, width:
480, height: 480 }` a `GAME_ENGINES`. El sistema queda funcional de punta a punta: `/game/
match-three` y `/game/match-three/play` dejan de dar 404, el juego es jugable completo desde la UI
   real (HUD de React conectado, pausa, fin de juego), y el guardado de puntuación, el detalle del
   juego y la pestaña "MATCH THREE" del salón de la fama funcionan automáticamente vía la capa de
   datos ya generalizada.
10. **Agregar la capa de dibujo detallada y sus cachés** — precalcular en un `<canvas>` offscreen el
    fondo biselado de las 64 celdas, precalcular en cachés offscreen individuales los 6 sprites de
    tipo de gema (facetas, brillos, contornos descritos en el Alcance), y por frame: volcar ambos
    cachés, dibujar el pulso de brillo propio de cada gema (`glowPhase`), el contorno de glow del
    cursor y de la selección activa, la animación de swap/swap-inválido/pop-de-coincidencia/caída de
    cada `Tile` según su estado, y la barra de movimientos/objetivo de nivel en la franja superior.
    El sistema queda funcional: el tablero completo se ve detallado y animado, de forma aislada.
11. **Verificación manual y build** — jugar una partida completa en `/game/match-three/play`
    confirmando: movimiento de cursor y selección con teclado, swap válido con animación y
    coincidencia resuelta, swap inválido revertido sin consumir movimiento, cascadas encadenadas tras
    la caída, barra de movimientos/objetivo visible y decreciente, nivel completado al alcanzar el
    objetivo (con aumento de dificultad: menos movimientos, más tipos de gema), vida perdida al
    agotar movimientos sin alcanzar el objetivo con reinicio del intento, fin de juego al agotar las
    3 vidas, pausa real con botón y con `P`/`Escape`, guardado de puntuación real, y que la
    puntuación aparece en `/game/match-three` y en la pestaña "MATCH THREE" de `/hall-of-fame` tras
    recargar. Confirmar también el detalle visual (cada tipo de gema identificable de un vistazo,
    animaciones de swap/pop/caída/pulso de cursor fluidas y perceptibles) y que el framerate se
    mantiene estable durante una partida larga con varios niveles superados. Confirmar que el resto
    del catálogo no tiene regresiones. Ejecutar `npm run build` sin errores de TypeScript ni de
    ESLint. El sistema queda funcional y verificado de punta a punta.

## Criterios de aceptación

- [ ] La tabla `games` de Supabase contiene una fila `id: "match-three"`, `title: "MATCH THREE"`,
      `cat: "PUZZLE"`, `cover: "cover-tetro"`, `color: "magenta"`, sembrada por la migración.
- [ ] `app/game-engines/match-three/engine.ts` existe, exporta `createGame(canvas, callbacks)` y no
      usa variables globales de módulo (grilla, cursor, selección, movimientos, score, vidas, nivel,
      estado de pausa, cachés y listeners quedan encapsulados dentro del closure de `createGame`).
- [ ] `MatchThreeCallbacks` incluye `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`,
      `onLevelChange`, todos obligatorios, compatibles con `EngineCallbacks` de `registry.ts`.
- [ ] En `/game/match-three/play` el juego se renderiza dentro de un `<canvas>` de 480×480 y es
      jugable con teclado: `←`/`→`/`↑`/`↓` y `WASD` mueven el cursor una celda por pulsación,
      `Enter`/`Espacio` seleccionan y confirman swaps entre celdas adyacentes.
- [ ] La grilla inicial (y cada reinicio de intento) nunca contiene una coincidencia de 3+ ya
      formada al arrancar.
- [ ] Un swap que genera una coincidencia de 3+ se confirma, consume un movimiento y elimina las
      gemas coincidentes sumando puntaje (`30` por coincidencia de 3, `70` de 4, `120` de 5+).
- [ ] Un swap que no genera ninguna coincidencia anima un intento parcial y revierte a la posición
      original sin consumir movimiento ni alterar el tablero.
- [ ] Tras resolver una coincidencia, las gemas superiores caen para llenar los huecos, se generan
      gemas nuevas arriba, y cualquier coincidencia nueva formada por la caída se resuelve en cascada
      automáticamente, sumando puntaje igual que una coincidencia manual.
- [ ] Si el tablero queda sin ningún swap adyacente posible, el motor lo reordena internamente sin
      consumir un movimiento ni requerir acción del jugador.
- [ ] Una barra de movimientos restantes y el objetivo de puntaje del nivel actual son visibles en
      la franja superior del canvas y se actualizan en tiempo real.
- [ ] Alcanzar el objetivo de puntaje del nivel dentro de los movimientos asignados completa el
      nivel: `onLevelChange` sube en 1, el objetivo del siguiente nivel aumenta en 300, la
      asignación de movimientos baja en 1 (piso de 12), y desde nivel 3 se habilita la gema Ámbar y
      desde nivel 5 la gema Amatista.
- [ ] Agotar los movimientos asignados sin alcanzar el objetivo del nivel resta una vida
      (`onLivesChange`) y, si quedan vidas, reinicia el intento del nivel actual con una grilla
      nueva y los movimientos recargados, conservando el puntaje total ya acumulado.
- [ ] La partida arranca con `onLivesChange(3)`; al llegar a `0`, se invoca `onGameOver(finalScore)`
      una única vez, y React muestra el modal "FIN DEL JUEGO" con el puntaje final.
- [ ] El botón "PAUSA" del HUD de React y las teclas `P`/`Escape` capturadas por el engine
      detienen/reanudan el loop de animación real (ninguna gema anima swap/caída/pulso mientras está
      en pausa), confirmando el estado vía `onPauseChange(isPaused)`; `Escape` cancela primero una
      selección activa antes de actuar como atajo de pausa.
- [ ] Al presionar "JUGAR DE NUEVO", el engine se destruye y se vuelve a crear desde cero: grilla,
      cursor, selección, movimientos, vidas (3), nivel (1) y puntaje (0) quedan en su estado inicial.
- [ ] Salir de la partida (botón "SALIR" o navegación fuera de la página) limpia correctamente el
      engine (`destroy()` se llama en el cleanup del `useEffect`, sin loops ni listeners de teclado
      colgando).
- [ ] `app/game-engines/registry.ts` incluye la entrada `"match-three": { createGame, width: 480,
    height: 480 }`, sin modificar `app/game/[id]/play/page.tsx` ni `GamePlayClient.tsx`.
- [ ] En `/game/match-three/play`, guardar la puntuación inserta una fila real en `scores`
      (`game_id: "match-three"`) vía `saveScore`, reutilizando la Server Action ya existente sin
      cambios.
- [ ] En `/game/match-three`, el título, descripción, leaderboard lateral, "Mejor global" y
      "Partidas" provienen de Supabase vía `getGame`/`getScores`/`getStats`, sin cambios en esas
      funciones.
- [ ] En `/hall-of-fame`, la pestaña "MATCH THREE" muestra las puntuaciones reales de `scores` para
      `game_id: "match-three"`.
- [ ] El resto del catálogo (`asteroids`, `tetris`, `arkanoid`, `snake`, `frogger`) conserva
      exactamente su comportamiento actual, sin regresiones.
- [ ] Ningún elemento del tablero (las 6 gemas, el socket de celda, el cursor, la selección) se
      dibuja como una única forma geométrica plana de un solo color; cada uno combina varias
      primitivas para sugerir textura o identidad, según lo descrito en el Alcance.
- [ ] Cada uno de los 6 tipos de gema es distinguible de un vistazo por forma y color, incluso con
      los 6 tipos habilitados simultáneamente en el tablero (nivel 5+).
- [ ] Las gemas animan: pop (escala/flash) al ser eliminadas en una coincidencia, deslizamiento con
      easing al hacer swap (válido o inválido, con revert visible en el inválido), caída con easing
      y un ligero rebote/aplastado al aterrizar, y un pulso de brillo sutil en bucle con fase propia
      por gema (no sincronizado entre celdas).
- [ ] El cursor y la selección activa animan un pulso de brillo (breathing) en bucle, y son
      visualmente distinguibles entre sí (color propio cada uno).
- [ ] El fondo biselado de las 64 celdas está cacheado en un `<canvas>` offscreen (no recompuesto
      con primitivas cada frame), y las 6 gemas están cacheadas como sprites offscreen reutilizados
      al dibujar cada instancia en el tablero.
- [ ] El framerate se mantiene estable durante una partida larga con varios niveles superados y
      cascadas frecuentes.
- [ ] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Motor construido desde cero**, sin `game.js` de referencia (mismo criterio que Snake/Frogger),
  porque Match Three no forma parte de `references/started-games/` — toda la mecánica se definió en
  este spec a partir de la sugerencia del jam ("combina 3 o más fichas para sumar puntos y combos").
- **`id: "match-three"` (inglés, con guion)**, mismo criterio ya aplicado con rocas→asteroids,
  caída→tetris, serpentina→snake y el nombre directo de frogger — slug descriptivo del género en
  inglés.
- **Callbacks: los cinco estándar, sin uno nuevo para movimientos/objetivo**, igual que Frogger
  `niveles` decidió no agregar `onTimeChange` para su temporizador — el contador de movimientos y el
  objetivo de nivel son elementos puramente visuales dibujados en el canvas (barra de HUD interno),
  no necesitan ser fuente de verdad para React, evitando generalizar `EngineCallbacks` por una sola
  variante de un solo juego.
- **Por qué este alcance corresponde a `core`**: vidas (3, solo se pierden) y niveles (objetivo de
  puntaje creciente con movimientos limitados y más tipos de gema) son el mínimo que vuelve a Match
  Three un juego completo y rejugable, no una demo de swap-y-coincide suelta. Se dejó
  deliberadamente fuera cualquier power-up (gemas rayadas, bomba de color) y el sistema de
  combo/multiplicador de cascadas, reservados enteros para la variante `feature`
  (`02-match-three-powerups-combos.md`), para que el eje de profundidad de esa variante sea nítido y
  no esté parcialmente adelantado aquí.
- **Vidas por "intento de nivel fallido" (agotar movimientos sin el objetivo)**, en vez de vidas por
  cada swap inválido o por cualquier otra causa, porque Match Three no tiene una condición de
  "muerte" instantánea como Snake/Frogger — el fallo natural del género es quedarse sin movimientos,
  así que se mapeó la vida directamente a esa condición.
- **Objetivo de puntaje creciente + movimientos decrecientes + tipos de gema crecientes como
  progresión de dificultad**, en vez de solo uno de los tres ejes, para que subir de nivel se sienta
  perceptiblemente más difícil (más puntaje que alcanzar, menos margen de movimientos, tablero más
  "ruidoso" con más tipos de gema) — mismo espíritu que la progresión combinada de Frogger `niveles`
  (velocidad + tortugas + temporizador), adaptado a un género de grilla estática.
- **Sin vida extra por puntaje**, a diferencia de Frogger `niveles`, para mantener el sistema de
  vidas de esta variante simple (solo bajan) — se consideró y se descartó explícitamente, ver "Fuera
  de alcance".
- **Bonos de puntaje por tamaño de coincidencia** (`30`/`70`/`120` para 3/4/5+), en vez de un
  puntaje lineal puro (`10 × tiles`), para que coincidencias grandes se sientan recompensadas incluso
  sin power-ups — es el "premio consuelo" de esta variante frente al sistema real de power-ups de
  `feature`.
- **Selección por teclado (cursor + `Enter`/`Espacio`), sin mouse/drag**, mismo criterio que todo el
  catálogo existente (ningún motor soporta mouse/touch hoy) — se consideró un esquema de arrastre con
  mouse (más natural para el género en otras plataformas) y se descartó por inconsistencia con el
  resto de Arcade Vault y por quedar fuera del alcance de teclado que comparten todos los engines.
  Controles y canvas base son idénticos entre ambas variantes de este juego, ver header del jam.
  Controles duales `←`/`→`/`↑`/`↓` + `WASD`, mismo criterio ya aplicado en Snake/Frogger.
- **Estilo gráfico y de animación**: gemas 100% procedurales (círculo/diamante/hexágono/estrella/
  cuadrado redondeado/triángulo, cada una con facetas, brillos y contornos compuestos de varias
  primitivas), en vez de sprites — mismo criterio de "cero assets externos" ya aplicado por
  Tetris/Arkanoid/Snake/Frogger a sus piezas/bloques/sapo. Se consideraron sombras dinámicas
  (`shadowBlur`) por gema en tiempo real y se descartaron por costo — el brillo se hornea en el
  sprite cacheado offscreen de cada tipo de gema en vez de recalcularse cada frame. Se consideró un
  sistema de partículas al eliminar una coincidencia (confeti/chispas) y se descartó para esta
  variante por presupuesto de rendimiento — el "pop" se resuelve con squash & stretch y flash de
  escala, sin partículas.
- **Paleta ampliada con Ámbar y Amatista** para los dos tipos de gema adicionales que se habilitan en
  niveles altos, en vez de reutilizar tonos ya usados por otra gema, porque los 4 colores neón base
  (cian/magenta/amarillo/verde) ya están asignados a las primeras 4 gemas — mismo criterio de
  ampliación de paleta ya usado por Frogger `niveles` para sus vehículos, justificado por legibilidad
  cuando hay 6 tipos simultáneos en pantalla.
- **Reutilización de `cover-tetro` como placeholder**, en vez de diseñar un `cover-match3` dedicado
  — ver justificación completa en "Dentro del alcance"; es la clase existente más cercana en
  espíritu (grilla de bloques de colores) entre las disponibles sin dueño temático claro.
- **Canvas 480×480 con grilla 8×8 (celdas de 56px + franja superior de 40px)**, un tamaño y
  proporción propios de Match Three, distinto de los ya usados por el resto del catálogo — 8×8 es el
  tamaño de grilla clásico del género (Bejeweled/Candy Crush simplificado).
- **Pausa dual con tecla `P`/`Escape` además del botón de React**, igual que el patrón ya
  establecido en Arkanoid/Snake/Frogger, con la particularidad de que `Escape` primero cancela una
  selección activa antes de actuar como atajo de pausa (para no pausar accidentalmente cuando el
  jugador solo quería deseleccionar una gema).
- **Consumo directo de la capa de Supabase ya generalizada** (`getGames`/`getGame`/`getScores`/
  `getStats`/`saveScore`, `GAME_ENGINES`), sin volver a generalizarla ni duplicarla — mismo criterio
  ya aplicado por los specs 08/09 y por ambas variantes de Frogger.

## Riesgos identificados

- **Grilla inicial (o de reinicio de intento) generada con coincidencias preexistentes**: si la
  generación aleatoria no re-tira explícitamente las celdas que formarían una coincidencia de 3+, el
  tablero podría arrancar con puntos "gratis" o con un estado visualmente inconsistente antes de
  cualquier input del jugador. Mitigación: validar y re-tirar durante la generación, no solo al
  primer render.
- **Tablero trabado sin ningún swap posible**: si el motor no detecta ni resuelve esta condición, el
  jugador quedaría sin ninguna acción válida disponible, consumiendo movimientos sin poder actuar.
  Mitigación: el re-barajado silencioso descrito en el Alcance debe ejecutarse cada vez que, tras
  estabilizarse el tablero, no exista ningún swap adyacente que genere una coincidencia.
- **Doble consumo de movimiento en un swap que dispara una cascada muy larga**: si el conteo de
  `movesRemaining` no se decrementa exactamente una vez por swap válido (independientemente de
  cuántas coincidencias en cascada genere), el jugador podría perder movimientos de más o de menos.
  Mitigación: decrementar `movesRemaining` en el instante en que el swap se confirma como válido, no
  en cada paso de la cascada resultante.
- **Condición de carrera entre "nivel completado" y "movimientos agotados" en el mismo swap**: si un
  swap simultáneamente hace que el puntaje alcance el objetivo del nivel y agota el último
  movimiento, el orden de evaluación podría disparar tanto la lógica de nivel completado como la de
  intento fallido, dejando el estado interno inconsistente. Mitigación: evaluar primero si el
  puntaje alcanzó el objetivo del nivel (nivel completado tiene prioridad) antes de evaluar si los
  movimientos llegaron a 0.
- **Desincronización entre animaciones de gemas concurrentes y el `dt` del loop**: si el `progress`
  de swap/caída/pop no se actualiza con un `dt` cappeado, la velocidad de las animaciones dependería
  del framerate real del dispositivo. Mitigación: mismo patrón de `dt` cappeado ya usado en
  Asteroids/Snake/Frogger.
- **Fugas de memoria por listeners de teclado no limpiados en `destroy()`**, mismo riesgo ya
  documentado en Asteroids/Tetris/Arkanoid/Snake/Frogger — si `destroy()` no remueve correctamente
  los listeners de `keydown` (incluyendo `P`/`Escape`), reiniciar varias veces o navegar entre
  `/game/match-three/play` y otras rutas podría acumular listeners duplicados.
- **Doble invocación de `onGameOver`**: mismo riesgo ya documentado en specs anteriores — si la
  transición de vidas no queda debidamente encapsulada con una bandera interna (`gameOverFired`),
  una condición de carrera entre el fin de una cascada y el conteo de vidas podría disparar
  `onLivesChange(0)`/`onGameOver` más de una vez.
- **Teclas de flecha y `Espacio` con comportamiento por defecto del navegador**: por defecto, las
  flechas pueden hacer scroll de la página y `Espacio` puede activar el último elemento enfocado si
  el foco no está en el canvas. Mitigación: el engine debe llamar `preventDefault()` en los
  listeners de teclado relevantes, igual que en los motores anteriores.
- **Costo de dibujo por frame por el mayor detalle visual**: redibujar facetas, brillos y biseles
  con varias primitivas por gema, en vez de un rectángulo por celda, aumenta el trabajo del loop de
  canvas; con 64 celdas simultáneas más animaciones de cascada podría degradar el framerate.
  Mitigación: los cachés offscreen del fondo de grilla y de los 6 sprites de gema descritos en el
  Modelo de datos, evitando recomponer primitivas costosas cada frame.
- **Contraste/legibilidad entre tipos de gema**: con 6 tipos simultáneos en niveles altos, una
  combinación de forma+color mal elegida podría confundirse a primera vista (p. ej. Ámbar cuadrado
  vs. Rubí diamante en movimiento rápido). Mitigación: mantener forma geométrica claramente distinta
  por tipo (nunca dos tipos con la misma silueta) y verificar legibilidad durante el paso de
  verificación manual con los 6 tipos habilitados a la vez.
- **Tamaño fijo de canvas (480×480) en un layout responsive**: mismo riesgo ya documentado y
  aceptado como pendiente en specs 05/07/08/09 y en Frogger.
- **RLS no definido** en `games`/`scores` — mismo pendiente ya documentado y aceptado en specs
  05/06/07/08/09 y en Frogger.
