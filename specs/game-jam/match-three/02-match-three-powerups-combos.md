# Integración de Match Three — variante powerups-combos (motor + leaderboard)

**Estado:** Borrador
**Depende de:** 04-integracion-supabase (clientes de Supabase); consume la capa ya generalizada
por 07-tetris-motor-leaderboard (`getGames`/`getGame`/`getScores`/`getStats`/`saveScore`,
`GAME_ENGINES`) sin volver a generalizar nada.
**Alternativa a:** `specs/game-jam/match-three/01-match-three-core.md` — mismo `id`, distinto
alcance; son mutuamente excluyentes, se implementa solo uno.
**Fecha:** 2026-07-28
**Objetivo:** Construir desde cero el motor de Match Three con power-ups obligatorios (gema rayada
y bomba de color, ambas con caducidad telegrafiada) más un multiplicador de combo por cascadas,
sobre la misma base de vidas y niveles de la variante `core`, dentro de un `<canvas>` en
`/game/match-three/play`, dibujado con gráficos procedurales detallados y animaciones simples,
notificando a React los cambios de puntaje, vidas y nivel, y persistir sus puntuaciones vía la capa
de datos genérica ya existente.

## Alcance

**Dentro del alcance:**

- **Nueva fila semilla en la tabla `games` de Supabase** (vía `apply_migration`, mismo esquema ya
  existente de `games`/`scores`, sin cambios de columnas): `id: "match-three"`,
  `title: "MATCH THREE"`, `cat: "PUZZLE"`, `cover: "cover-tetro"`, `color: "magenta"`. Es la misma
  fila semilla que definiría la variante `core` — son alternativas del mismo `id`, no coexisten.
- **Sin cover nuevo diseñado en este spec**: idéntico criterio y reutilización de `cover-tetro` que
  la variante `core` (ver esa sección en `01-match-three-core.md` para la justificación completa de
  por qué ninguna clase CSS libre encaja temáticamente).
- **Toda la base de la variante `core`, sin cambios**: grilla 8×8 (celdas de 56px, canvas 480×480
  con franja superior de HUD interno), generación inicial sin coincidencias, cursor y selección por
  teclado, swap válido/inválido con animación, resolución de coincidencias con bonos por tamaño
  (`30`/`70`/`120`), gravedad con reposición y cascadas, re-barajado silencioso de tableros trabados,
  3 vidas, niveles con objetivo de puntaje creciente y movimientos limitados (tipos de gema Ámbar
  desde nivel 3 y Amatista desde nivel 5), pausa dual, y los 6 tipos de gema base con su dibujo
  detallado (círculo/diamante/hexágono/estrella/cuadrado/triángulo, cada uno con facetas y brillos).
- **Gráficos y animación al mismo estándar que `core`, sin reducirse**: el socket de celda, el
  cursor, la selección, y las 6 gemas base se dibujan exactamente igual que en `01-match-three-core
.md` — la diferencia entre variantes es de mecánica, nunca de calidad visual.
- **Power-up "Gema Rayada" (obligatorio)**:
  - **Cómo aparece**: se genera automáticamente cada vez que un swap (manual o resuelto en cascada)
    forma una coincidencia de **exactamente 4** gemas del mismo tipo en línea recta; la gema rayada
    resultante ocupa la celda donde terminó el movimiento del jugador (o el centro de la coincidencia
    si se generó en cascada) y conserva el color/forma base de su tipo de gema de origen.
  - **Orientación**: si la coincidencia de 4 fue horizontal, la gema rayada queda orientada
    "horizontal" (limpia una fila al activarse); si fue vertical, queda "vertical" (limpia una
    columna).
  - **Cuánto dura**: permanece en el tablero sin caducar mientras el jugador la mueve o interactúa
    con el tablero cerca de ella; si pasan **20 segundos** de tiempo de juego (sin contar mientras
    está en pausa) sin que la gema rayada sea parte de un swap, "caduca" y se convierte de vuelta en
    una gema base normal de su mismo tipo, sin efecto especial.
  - **Efecto al activarse**: cuando la gema rayada participa en un swap válido (se mueve, sin
    importar si el swap en sí forma o no una nueva coincidencia con las gemas vecinas), se activa de
    inmediato: elimina **toda su fila** (si es horizontal) o **toda su columna** (si es vertical),
    sumando el puntaje de eliminación de cada gema afectada (10 pts base cada una, sin los bonos de
    tamaño de `core` porque no es una coincidencia normal), y dispara gravedad/reposición igual que
    cualquier eliminación.
  - **Cómo se dibuja**: el sprite base del tipo de gema (mismas primitivas que en `core`) más una
    superposición de 3 franjas rectas semitransparentes blancas, perpendiculares a la fila/columna
    que limpiará (franjas verticales sobre una gema "horizontal", franjas horizontales sobre una gema
    "vertical"), y un halo de brillo pulsante alrededor del contorno completo de la gema —
    claramente distinguible de cualquier gema base o de la bomba de color.
  - **Cómo se telegrafía que está por vencer**: durante los últimos **5 segundos** antes de caducar,
    el halo de brillo pulsante acelera su frecuencia de pulso progresivamente (de ~1 pulso/seg a
    ~4 pulsos/seg) y reduce su opacidad máxima (de 100% a ~40%), en vez de desaparecer sin aviso —
    mismo criterio de "parpadeo previo, no conmutación de golpe" exigido por el estándar gráfico del
    jam.
- **Power-up "Bomba de Color" (obligatorio)**:
  - **Cómo aparece**: se genera automáticamente cada vez que un swap forma una coincidencia de **5 o
    más** gemas del mismo tipo en línea recta, o una coincidencia en forma de L/T (dos líneas de 3+
    que comparten una celda); ocupa la celda donde terminó el movimiento del jugador.
  - **Cuánto dura**: permanece en el tablero sin caducar mientras no participe de un swap; si pasan
    **20 segundos** de tiempo de juego sin ser movida, caduca y se convierte en una gema base
    aleatoria entre los tipos habilitados en el nivel actual (no conserva un tipo "de origen" porque
    la bomba de color no representa ningún tipo específico).
  - **Efecto al activarse**: cuando la bomba de color participa en un swap válido contra una gema
    base (sin importar si ese swap por sí solo formaría una coincidencia), se activa de inmediato:
    elimina **todas las gemas del tablero del mismo tipo que la gema con la que fue intercambiada**,
    sumando 10 pts base por cada gema eliminada, y dispara gravedad/reposición para las columnas
    afectadas. Si se intercambia con otro power-up, ver "Combos de power-ups" abajo.
  - **Cómo se dibuja**: un círculo de fondo casi negro con un anillo exterior brillante multicolor
    (segmentos alternados de los 4 colores neón base), y un **pool fijo de 6 partículas** pequeñas
    (puntos de colores) orbitando el centro a velocidad angular constante, cada una con su propio
    ángulo inicial para no verse sincronizadas — el único uso de partículas en esta variante, con
    cantidad explícitamente acotada (6, nunca más) por presupuesto de rendimiento.
  - **Cómo se telegrafía que está por vencer**: en los últimos 5 segundos antes de caducar, las 6
    partículas orbitantes aceleran su velocidad angular progresivamente y el anillo exterior reduce
    su opacidad máxima de igual forma que la gema rayada — mismo patrón de telegrafiado.
- **Combos de power-ups (activación combinada)**: intercambiar dos power-ups entre sí produce un
  efecto mayor que activarlos por separado:
  - **Rayada + Rayada**: elimina la fila completa de una y la columna completa de la otra
    simultáneamente (efecto "cruz"), sin importar sus orientaciones individuales.
  - **Rayada + Bomba de color**: convierte temporalmente (solo para este efecto, sin generar gemas
    rayadas nuevas en el tablero) todas las gemas del tipo de la gema rayada en gemas rayadas, y las
    activa todas a la vez, limpiando múltiples filas/columnas del tablero de un golpe.
  - **Bomba + Bomba**: elimina **todo el tablero** (todas las 64 celdas), sumando 10 pts base por
    cada una, seguido de una reposición completa de gemas nuevas — el efecto más grande del juego.
- **Segundo eje de profundidad: multiplicador de combo por cascadas**: cada movimiento del jugador
  arranca con un multiplicador `x1`. Cada coincidencia adicional resuelta automáticamente por
  cascada (una nueva coincidencia formada por la caída/reposición tras la coincidencia anterior,
  dentro del mismo movimiento) incrementa el multiplicador en `+1` (`x2`, `x3`, `x4`, ...) **antes**
  de puntuar esa coincidencia — el puntaje de cada coincidencia en cascada es
  `(puntaje base + bono de tamaño, igual fórmula que core) × multiplicador vigente en ese paso`. El
  multiplicador se reinicia a `x1` en cuanto el tablero queda estable (sin nuevas coincidencias
  pendientes) o al iniciar un nuevo movimiento manual del jugador. Un contador de combo (`"COMBO x3"`
  o similar) se dibuja como parte del HUD interno del canvas, apareciendo solo mientras el
  multiplicador es `> x1` y desvaneciéndose (fade-out con easing) cuando el tablero se estabiliza —
  no un texto que se desactiva de golpe.
- **Motor construido desde cero** (sin `game.js` de referencia, igual que Snake/Frogger) en
  `app/game-engines/match-three/engine.ts`, exponiendo `createGame(canvas, callbacks)` con
  `pause()`/`resume()`/`destroy()`, mismo patrón que el resto del catálogo. Incluye todo lo ya
  descrito como base común en la variante `core` más los dos power-ups obligatorios y el
  multiplicador de combo descritos arriba.
- **Callbacks conectados**: `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`,
  `onLevelChange` — los mismos cinco de `core`; el multiplicador de combo y la caducidad de
  power-ups son enteramente visuales/internos (dibujados en el canvas), sin necesidad de un callback
  nuevo — mismo criterio que la barra de movimientos/objetivo de `core`.
- **Pausa real con doble camino**: idéntica a `core`; adicionalmente, mientras el juego está en
  pausa, el temporizador de caducidad de los power-ups activos en el tablero no avanza (mismo
  criterio que el temporizador de intento de Frogger `niveles`).
- **Montaje genérico**: se agrega la entrada `"match-three": { createGame, width: 480, height: 480
}` a `app/game-engines/registry.ts` (`GAME_ENGINES`). No se toca `app/game/[id]/play/page.tsx` ni
  `GamePlayClient.tsx` — ya resuelven cualquier `id` registrado sin condicionales.
- **Consumo de la capa de datos ya generalizada**: `/game/match-three`, el guardado de puntuación en
  `/game/match-three/play` y la pestaña "MATCH THREE" en `/hall-of-fame` funcionan automáticamente
  en cuanto la fila `"match-three"` existe en `games` y el registro de motores tiene su entrada —
  `getGame`/`getGames`/`getScores`/`getStats`/`saveScore` y las páginas que los consumen ya son
  genéricas por `gameId` desde el spec 07, sin cambios propios en esta variante.

**Fuera de alcance (para otros specs):**

- **La variante `core` de este mismo juego** (`specs/game-jam/match-three/01-match-three-core.md`):
  sin power-ups, sin multiplicador de combo, coincidencias de 4/5+ solo suman el bono de tamaño ya
  descrito en esa variante — es la alternativa mutuamente excluyente a este spec.
- Power-ups adicionales no descritos aquí (p. ej. un "martillo" que rompe una celda a elección libre
  del jugador, o gemas congeladas/bloqueadas) — se consideraron y se descartaron para mantener el
  eje de power-ups enfocado en los dos ya descritos (rayada y bomba de color), que ya cubren tanto
  eliminación en línea como eliminación por tipo/color, sin acumular mecánicas adicionales que
  infle el alcance.
- Selección/activación manual de power-ups sin necesidad de un swap (p. ej. tocar la bomba
  directamente para detonarla sin moverla) — en esta variante, todo power-up se activa
  exclusivamente participando en un swap válido, igual que cualquier otra gema, para mantener el
  control uniforme (cursor + `Enter`/`Espacio`) sin agregar un modo de interacción adicional.
- Soporte táctil/móvil (solo teclado).
- Sonido (no se proveyeron ni se diseñan assets de audio en esta variante).
- Políticas RLS en `games`/`scores` — mismo pendiente ya documentado en specs anteriores y en ambas
  variantes de Frogger.
- Supabase Auth real / relación de `scores.user_id` con un usuario autenticado.
- Cambios visuales en `Podium.tsx`/`Leaderboard.tsx`/`GameCard.tsx`/`MiniCard`.
- Adaptar cualquier otro juego de `references/started-games/` — este spec cubre únicamente esta
  variante de Match Three.
- **Sprites, spritesheets o cualquier imagen externa**: todo el detalle visual (incluidas las
  franjas de la gema rayada y el anillo/partículas de la bomba de color) es enteramente procedural,
  generado con primitivas de canvas en tiempo de dibujo o cacheado offscreen — no se cargan ni se
  generan archivos de imagen.
- **Efectos gráficos pesados más allá del pool fijo ya acotado**: ningún sistema de partículas
  adicional al de la bomba de color (6 partículas, tope fijo), sin sombras dinámicas ni
  post-procesado.
- **Diseño de un `cover-match3` dedicado** — mismo criterio y reutilización de `cover-tetro` que la
  variante `core`.
- Ajustes de responsive/CSS del contenedor `crt`/`crt-screen` para encajar un sexto tamaño de canvas
  — mismo pendiente ya anotado en specs anteriores y en Frogger.

## Modelo de datos

- **`app/game-engines/match-three/engine.ts`** — módulo nuevo, sin estado global de módulo. Conserva
  todo lo ya descrito en la variante `core` (grilla, cursor, selección, movimientos, objetivo de
  nivel, score, vidas, nivel, pausa, cachés offscreen, listeners) más:

  ```ts
  export interface MatchThreeCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void; // idéntico a core: emite 3 al iniciar; baja al agotar movimientos; 0 dispara game over
    onGameOver: (finalScore: number) => void;
    onPauseChange: (isPaused: boolean) => void;
    onLevelChange: (level: number) => void; // idéntico a core
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

  - Cada `Tile` de la grilla amplía su forma de `core` con:
    `powerUp: 'none' | 'striped-h' | 'striped-v' | 'color-bomb'`, y — solo si `powerUp !== 'none'` —
    `powerUpTimeRemaining: number` (arranca en `20000` ms al generarse, cuenta regresiva mientras el
    juego no está en pausa, dispara la reversión a gema base/aleatoria al llegar a `0`) y
    `powerUpTelegraphPhase: number` (fase de pulso independiente por power-up, usada para que el
    parpecheo/aceleración de los últimos 5 segundos no se vea sincronizado entre power-ups distintos
    en el tablero al mismo tiempo).
  - `comboMultiplier: number` (arranca en `1` por movimiento, sube en cada paso de cascada, se
    reinicia a `1` al estabilizarse el tablero o al iniciar un nuevo swap manual) y
    `comboDisplayOpacity: number` (usado para el fade-out con easing del contador de combo cuando el
    multiplicador vuelve a `1`).
  - La **bomba de color** lleva además, solo para su render, un arreglo fijo de 6
    `{ angleOffset: number }` (uno por partícula orbitante), generado una vez al crearse el power-up,
    reutilizado en cada frame para calcular la posición angular actual de cada partícula sin
    recrearlas.
  - **Cachés offscreen**: además de los ya descritos en `core` (fondo de grilla, 6 sprites de gema
    base), se agregan dos sprites offscreen adicionales: el patrón de franjas de la gema rayada
    (horizontal y vertical, dos variantes) y el anillo multicolor base de la bomba de color (sin las
    partículas orbitantes, que sí se recalculan por frame al ser dinámicas); ambos se componen sobre
    el sprite de gema base correspondiente al dibujar, en vez de recrearse desde cero cada vez.
  - El loop de animación, además de lo ya descrito en `core`, decrementa `powerUpTimeRemaining` de
    cada power-up activo (pausando ese descuento junto con el resto del juego), revierte el power-up
    a gema base/aleatoria al llegar a `0`, avanza `comboMultiplier`/`comboDisplayOpacity`, y
    resuelve la lógica de combo de power-ups descrita en el Alcance cuando un swap involucra a dos
    power-ups a la vez.

  - `onScoreChange` se invoca igual que en `core` (tras cada coincidencia resuelta), además de tras
    cada activación de power-up (fila/columna/tipo/tablero completo eliminado) y aplicando el
    `comboMultiplier` vigente a cada paso de cascada, según la fórmula descrita en el Alcance.
  - `onLivesChange`/`onGameOver`/`onLevelChange`/`onPauseChange` se comportan exactamente igual que
    en `core` — el sistema de vidas y niveles no cambia entre variantes, solo el puntaje que se
    acumula hacia el objetivo de cada nivel.

- **Fila semilla en `games`** (SQL de la migración, idéntica a la definida en la variante `core`,
  mismo esquema ya existente de `games`/`scores`, sin cambios de columnas):

  ```sql
  insert into games (id, title, short, long, cat, cover, color) values (
    'match-three', 'MATCH THREE',
    'Combina 3 o más gemas antes de quedarte sin movimientos.',
    'Desliza el cursor por una grilla de gemas y combina 3 o más del mismo tipo en línea para hacerlas estallar. Encadena cascadas para multiplicar tu puntaje y aprovecha las gemas rayadas y las bombas de color antes de que caduquen. Cada nivel exige un puntaje objetivo con un número limitado de movimientos.',
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
   `"match-three"` en `games` (idéntica a la de `core`; si ya existe por haberse aplicado antes, este
   paso se omite). El sistema queda funcional: la fila existe en Supabase, pero ninguna ruta la usa
   todavía (`/game/match-three` da 404 porque `GAME_ENGINES` aún no tiene la clave `"match-three"`).
2. **Crear `app/game-engines/match-three/engine.ts` — base común**: grilla 8×8, generación inicial
   sin coincidencias, cursor/selección/swap por teclado, resolución de coincidencias con bonos de
   tamaño, gravedad/cascadas, re-barajado silencioso, 3 vidas, niveles con objetivo/movimientos —
   todo igual que el paso a paso ya descrito en la variante `core` (pasos 2 a 6 de ese spec), pero
   como punto de partida de esta variante. El sistema queda funcional: el juego base sin power-ups
   ni combo es jugable de forma aislada, igual que la variante `core`.
3. **Agregar generación de power-ups** — al resolver una coincidencia de exactamente 4 en línea,
   generar una gema rayada (orientación según la dirección de la coincidencia) en la celda de destino
   del swap; al resolver una coincidencia de 5+ o en forma de L/T, generar una bomba de color en esa
   misma celda; ambas con su `powerUpTimeRemaining` inicial de 20000ms. El sistema queda funcional:
   los power-ups aparecen correctamente identificados en el tablero, de forma aislada (aún sin
   activarse).
4. **Agregar activación de power-ups individuales** — al confirmarse un swap donde una de las dos
   celdas es una gema rayada, eliminar su fila/columna completa según su orientación; al confirmarse
   un swap donde una de las dos celdas es una bomba de color y la otra es una gema base, eliminar
   todas las gemas del tablero de ese tipo; sumando puntaje y disparando gravedad/reposición en
   ambos casos. El sistema queda funcional: ambos power-ups se activan correctamente al moverlos, de
   forma aislada.
5. **Agregar combos de power-ups** — detectar cuándo un swap involucra dos power-ups entre sí y
   resolver el efecto combinado correspondiente (rayada+rayada = cruz, rayada+bomba = todas las
   gemas del tipo de la rayada se activan como rayadas, bomba+bomba = tablero completo), sumando
   puntaje y disparando gravedad/reposición para toda el área afectada. El sistema queda funcional:
   los tres combos son reproducibles y verificables de forma aislada.
6. **Agregar caducidad y telegrafiado de power-ups** — decrementar `powerUpTimeRemaining` de cada
   power-up activo en cada frame (pausando junto con el resto del juego), revertirlo a gema base
   (rayada) o gema base aleatoria (bomba) al llegar a 0, y en los últimos 5000ms acelerar
   progresivamente el pulso/velocidad de partículas y reducir la opacidad máxima del halo/anillo. El
   sistema queda funcional: los power-ups caducan visiblemente con aviso previo si no se usan a
   tiempo, de forma aislada.
7. **Agregar el multiplicador de combo por cascadas** — incrementar `comboMultiplier` en cada paso de
   cascada antes de puntuarlo, aplicar el multiplicador vigente al puntaje de esa coincidencia,
   reiniciar el multiplicador a `x1` al estabilizarse el tablero o al iniciar un nuevo swap manual, y
   dibujar el contador de combo con su fade-out al finalizar. El sistema queda funcional: el
   multiplicador de combo es visible y afecta el puntaje correctamente, de forma aislada.
8. **Conectar los callbacks `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver`** —
   idéntico al paso 7 de `core`, con `onScoreChange` ahora incluyendo también el puntaje de
   activaciones de power-ups y el multiplicador de combo aplicado. El sistema queda funcional: el
   engine notifica todos los cambios de estado relevantes, aunque aún no haya un consumidor en React.
9. **Implementar `pause()`/`resume()`/`destroy()`** — idéntico al paso 8 de `core`, agregando que la
   pausa también detiene el descuento de `powerUpTimeRemaining` de todos los power-ups activos. El
   sistema queda funcional: la API pública del engine está completa y probada de forma aislada.
10. **Registrar el motor en `app/game-engines/registry.ts`** — agregar el import
    `matchThreeCreateGame` y la entrada `"match-three": { createGame: matchThreeCreateGame, width:
480, height: 480 }` a `GAME_ENGINES`. El sistema queda funcional de punta a punta: `/game/
match-three` y `/game/match-three/play` dejan de dar 404, el juego es jugable completo desde la
    UI real (HUD de React conectado, pausa, fin de juego), y el guardado de puntuación, el detalle
    del juego y la pestaña "MATCH THREE" del salón de la fama funcionan automáticamente vía la capa
    de datos ya generalizada.
11. **Agregar la capa de dibujo detallada y sus cachés** — precalcular en cachés offscreen el fondo
    de grilla, los 6 sprites de gema base y los dos sprites de patrón de franjas de la gema rayada
    (idéntico a `core` más lo nuevo de esta variante); y por frame: componer el sprite de gema rayada
    sobre su sprite base con el halo pulsante, dibujar el anillo de la bomba de color con sus 6
    partículas orbitantes recalculadas por frame, aplicar la aceleración/reducción de opacidad del
    telegrafiado en los últimos 5 segundos de cada power-up activo, y dibujar el contador de combo
    con su fade-out. El sistema queda funcional: el tablero completo, con power-ups y combo, se ve
    detallado y animado, de forma aislada.
12. **Verificación manual y build** — jugar una partida completa en `/game/match-three/play`
    confirmando: generación de gema rayada al coincidir 4, generación de bomba de color al coincidir
    5+ o en L/T, activación de fila/columna al mover una gema rayada, activación de tipo completo al
    mover la bomba de color, los tres combos de power-ups (cruz, tipo-a-rayadas, tablero completo),
    caducidad de power-ups no usados con telegrafiado visible en los últimos 5 segundos, multiplicador
    de combo subiendo con cascadas y reiniciándose correctamente, toda la base de `core` (movimientos,
    niveles, vidas, game over), pausa real deteniendo también la caducidad de power-ups, guardado de
    puntuación real, y que la puntuación aparece en `/game/match-three` y en la pestaña "MATCH THREE"
    de `/hall-of-fame` tras recargar. Confirmar también el detalle visual (power-ups claramente
    distinguibles de gemas base y entre sí, telegrafiado de caducidad perceptible, contador de combo
    legible) y que el framerate se mantiene estable durante una partida larga con cascadas y combos
    frecuentes. Confirmar que el resto del catálogo no tiene regresiones. Ejecutar `npm run build`
    sin errores de TypeScript ni de ESLint. El sistema queda funcional y verificado de punta a punta.

## Criterios de aceptación

- [ ] La tabla `games` de Supabase contiene una fila `id: "match-three"`, `title: "MATCH THREE"`,
      `cat: "PUZZLE"`, `cover: "cover-tetro"`, `color: "magenta"`, sembrada por la migración.
- [ ] `app/game-engines/match-three/engine.ts` existe, exporta `createGame(canvas, callbacks)` y no
      usa variables globales de módulo.
- [ ] `MatchThreeCallbacks` incluye `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`,
      `onLevelChange`, todos obligatorios, compatibles con `EngineCallbacks` de `registry.ts`.
- [ ] Toda la base de la variante `core` funciona igual en esta variante: cursor/selección por
      teclado, swap válido/inválido, coincidencias con bonos de tamaño, gravedad/cascadas,
      re-barajado silencioso, 3 vidas, niveles con objetivo/movimientos/tipos de gema crecientes.
- [ ] Una coincidencia de exactamente 4 gemas en línea genera una gema rayada en la celda de destino
      del swap, con orientación horizontal o vertical según la dirección de la coincidencia.
- [ ] Una coincidencia de 5+ gemas en línea, o en forma de L/T, genera una bomba de color en la
      celda de destino del swap.
- [ ] Mover (swap válido) una gema rayada elimina toda su fila (horizontal) o columna (vertical),
      sumando puntaje y disparando gravedad/reposición.
- [ ] Mover (swap válido) una bomba de color contra una gema base elimina todas las gemas del
      tablero de ese tipo, sumando puntaje y disparando gravedad/reposición.
- [ ] Intercambiar dos gemas rayadas produce el efecto "cruz" (fila de una + columna de la otra);
      intercambiar una rayada con una bomba de color activa todas las gemas del tipo de la rayada
      como rayadas; intercambiar dos bombas de color elimina las 64 celdas del tablero.
- [ ] Un power-up no movido en 20 segundos de tiempo de juego (sin contar pausa) caduca: la gema
      rayada vuelve a ser una gema base de su mismo tipo; la bomba de color se vuelve una gema base
      aleatoria entre los tipos habilitados.
- [ ] En los últimos 5 segundos antes de caducar, el halo/anillo del power-up acelera
      progresivamente su pulso/velocidad de partículas y reduce su opacidad máxima, en vez de
      desaparecer sin aviso.
- [ ] Cada coincidencia adicional resuelta por cascada dentro del mismo movimiento incrementa el
      multiplicador de combo en `+1` antes de puntuarla, aplicándolo al puntaje de esa coincidencia;
      el multiplicador se reinicia a `x1` al estabilizarse el tablero o al iniciar un nuevo swap
      manual.
- [ ] Un contador de combo (`"COMBO xN"`) es visible en el HUD interno del canvas mientras el
      multiplicador es mayor a `x1`, y se desvanece con un fade-out (no una desaparición instantánea)
      al estabilizarse el tablero.
- [ ] El botón "PAUSA" del HUD de React y las teclas `P`/`Escape` detienen/reanudan el loop de
      animación real, incluyendo el descuento de `powerUpTimeRemaining` de todos los power-ups
      activos en el tablero (no caducan durante la pausa).
- [ ] Al presionar "JUGAR DE NUEVO", el engine se destruye y se vuelve a crear desde cero: grilla,
      power-ups, multiplicador de combo, vidas (3), nivel (1) y puntaje (0) quedan en su estado
      inicial.
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
- [ ] Ningún elemento del tablero (gemas base, gema rayada, bomba de color, socket de celda, cursor,
      selección, contador de combo) se dibuja como una única forma geométrica plana de un solo
      color; cada uno combina varias primitivas para sugerir textura o identidad, según lo descrito
      en el Alcance.
- [ ] La gema rayada y la bomba de color son visualmente distinguibles entre sí y de cualquier gema
      base, incluso en movimiento.
- [ ] La bomba de color anima exactamente 6 partículas orbitantes con ángulos iniciales
      desincronizados entre sí (pool fijo, nunca más de 6).
- [ ] El fondo biselado de las 64 celdas y los sprites de las 6 gemas base están cacheados en
      `<canvas>` offscreen (no recompuestos con primitivas cada frame); el patrón de franjas de la
      gema rayada y el anillo base de la bomba de color también están cacheados, componiéndose sobre
      el sprite base en tiempo de dibujo.
- [ ] El framerate se mantiene estable durante una partida larga con cascadas, combos y varios
      power-ups activos simultáneamente.
- [ ] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Motor construido desde cero**, sin `game.js` de referencia, idéntico criterio que la variante
  `core` y que Snake/Frogger.
- **`id: "match-three"` (inglés, con guion)**, idéntico al de la variante `core` — ambas variantes
  comparten exactamente el mismo `id`/`title`/categoría/cover, porque son alternativas de alcance
  del mismo juego, no juegos distintos.
- **Callbacks: los cinco estándar, sin uno nuevo para power-ups/combo**, mismo criterio que `core`
  para su barra de movimientos — el estado de power-ups y el multiplicador de combo son
  puramente visuales/internos, dibujados en el canvas, sin necesidad de generalizar
  `EngineCallbacks` por esta variante de un solo juego.
- **Eje de profundidad elegido: power-ups (gema rayada + bomba de color) más multiplicador de combo
  por cascadas**, como los dos ejes obligatorios de esta variante — se combinan naturalmente porque
  encadenar cascadas con power-ups activados dentro de la misma cascada es donde el multiplicador de
  combo se vuelve más relevante (una activación de power-up en medio de una racha de cascadas
  también se beneficia del multiplicador vigente), reforzando que ambos ejes están diseñados para
  jugarse juntos, no como sistemas aislados.
- **Dos power-ups (no más), generados por umbral de tamaño de coincidencia (4 → rayada, 5+/L/T →
  bomba)**, en vez de un sistema con más tipos de power-up o generación aleatoria independiente de la
  coincidencia, para mantener la regla de generación simple y predecible para el jugador (el tamaño
  de la coincidencia que hiciste determina qué obtienes) — se consideraron power-ups adicionales
  (martillo de celda libre, gemas bloqueadas/congeladas) y se descartaron explícitamente para no
  inflar el alcance de esta variante, ver "Fuera de alcance".
- **Power-ups se activan únicamente participando en un swap**, sin un modo de activación directa sin
  mover la pieza, para mantener el esquema de control uniforme (cursor + `Enter`/`Espacio`, mismo
  input que cualquier otro swap) sin agregar una acción de teclado adicional.
- **Caducidad de 20 segundos con telegrafiado en los últimos 5**, en vez de power-ups permanentes
  sin límite de tiempo, para que el jugador tenga presión de usarlos activamente en vez de acumular
  un tablero lleno de power-ups sin explotar — el telegrafiado (aceleración de pulso + reducción de
  opacidad) es obligatorio por el estándar gráfico del jam ("parpadeo previo, no conmutación de
  golpe"), mismo criterio que el ciclo de sumersión de las tortugas de Frogger `niveles`.
- **Combos de power-ups con tres resultados fijos** (cruz, tipo-a-rayadas, tablero completo), en vez
  de una matriz más grande de combinaciones (p. ej. power-ups de distinto tipo de gema con reglas
  distintas entre sí), para que el sistema de combos sea memorizable y predecible con solo dos tipos
  de power-up en juego.
- **Multiplicador de combo reiniciado por movimiento manual, no acumulable entre movimientos**, en
  vez de un multiplicador persistente durante toda la partida, para que el combo recompense
  específicamente la habilidad de generar cascadas largas en un solo movimiento (el objetivo de
  diseño de este eje), no la duración de la partida.
- **Multiplicador aplicado por paso de cascada, no de forma global al final**, para que el puntaje de
  cada coincidencia dentro de la cascada refleje el multiplicador vigente en ese momento exacto
  (creciente), premiando más las cascadas largas de forma exponencial en vez de lineal.
- **Contador de combo dibujado en el canvas con fade-out**, en vez de un callback nuevo hacia React,
  mismo criterio que la barra de movimientos/objetivo de `core` y el temporizador de Frogger
  `niveles` — un elemento puramente visual no necesita ser fuente de verdad para React.
- **Estilo gráfico y de animación de los power-ups**: ambos 100% procedurales, componiendo sus
  overlays (franjas / anillo + partículas) sobre el sprite base de gema ya cacheado, en vez de
  sprites nuevos independientes — mismo criterio de "cero assets externos" de toda la plataforma. Se
  consideró un sistema de partículas más grande para la bomba de color (p. ej. 20+ partículas) y se
  descartó por presupuesto de rendimiento, fijándose explícitamente en 6 (pool fijo, nunca más),
  igual criterio de acotamiento explícito que exige el estándar gráfico del jam para efectos
  puntuales con partículas.
- **Reutilización de `cover-tetro` y `color: "magenta"`**, idéntico criterio y fila semilla que la
  variante `core`.
- **Canvas 480×480 con grilla 8×8**, idéntico al de la variante `core` — mismo criterio del jam:
  controles y canvas base no cambian entre variantes de un mismo juego, solo el alcance de su
  mecánica interna.
- **Pausa dual con tecla `P`/`Escape` además del botón de React**, idéntica a la variante `core`,
  extendida para detener también el descuento de caducidad de power-ups.
- **Consumo directo de la capa de Supabase ya generalizada**, sin volver a generalizarla ni
  duplicarla — mismo criterio ya aplicado por los specs 08/09 y por ambas variantes de Frogger.

## Riesgos identificados

- **Todos los riesgos ya documentados en la variante `core`** (grilla inicial con coincidencias
  preexistentes, tablero trabado, doble consumo de movimiento, condición de carrera entre nivel
  completado y movimientos agotados, desincronización de `dt`, fugas de memoria por listeners no
  limpiados, doble invocación de `onGameOver`, teclas con comportamiento por defecto del navegador,
  canvas de tamaño fijo en layout responsive, RLS no definido) aplican igual aquí y se agravan por
  la mayor cantidad de estado concurrente (power-ups activos, sus temporizadores, y el multiplicador
  de combo).
- **Condición de carrera entre la caducidad de un power-up y su activación en el mismo frame**: si
  el swap que activa un power-up y el vencimiento de su `powerUpTimeRemaining` se evalúan en el
  mismo frame, el orden de evaluación podría revertir el power-up justo cuando el jugador ya lo
  había movido válidamente, causando una activación "fantasma" perdida. Mitigación: al confirmarse
  un swap que involucra un power-up, procesar su activación antes de evaluar cualquier decremento de
  temporizador pendiente en ese mismo frame.
- **Recursión o bucle infinito en el combo Rayada + Bomba de color**: si "convertir todas las gemas
  del tipo de la rayada en rayadas y activarlas" no se implementa como una operación atómica de un
  solo paso (marcar todas, eliminar todas, una sola vez), podría entrar en un ciclo donde cada
  activación genera nuevas gemas del mismo tipo que vuelven a activarse. Mitigación: el combo debe
  operar sobre una instantánea (`snapshot`) del tablero en el instante del swap, no sobre el estado
  mutable mientras se resuelve.
- **Multiplicador de combo desincronizado del paso de cascada real**: si el incremento del
  multiplicador no está atado exactamente a "una nueva coincidencia formada por gravedad/reposición
  tras la anterior" sino a un conteo más laxo (p. ej. por frame), el multiplicador podría subir de
  forma incorrecta o no reflejar cascadas reales. Mitigación: incrementar `comboMultiplier`
  exclusivamente en el punto donde el motor detecta una coincidencia nueva generada por la
  resolución de gravedad, nunca por temporización.
- **Costo de dibujo por frame por power-ups adicionales**: el anillo con 6 partículas recalculadas
  por frame de cada bomba de color activa, sumado a las franjas y halos pulsantes de cada gema
  rayada activa, incrementa el trabajo del loop de canvas respecto a `core`; con varios power-ups
  activos simultáneamente en niveles avanzados podría degradar el framerate. Mitigación: mantener el
  pool de partículas fijo en 6 (nunca dinámico ni proporcional a la cantidad de bombas activas), y
  cachear en offscreen todo lo que no depende de animación por frame (el sprite base de gema, el
  patrón de franjas, el anillo sin partículas), recalculando por frame únicamente la posición angular
  de las partículas y la opacidad del telegrafiado.
- **Confusión visual entre el telegrafiado de caducidad y el pulso de brillo idle normal de las
  gemas base**: si la aceleración de pulso de un power-up por caducar se ve demasiado similar al
  pulso sutil normal de cualquier gema (heredado de `core`), el jugador podría no notar la urgencia.
  Mitigación: la amplitud y frecuencia del telegrafiado de caducidad debe ser claramente mayor
  (~4 pulsos/seg en los últimos 5 segundos) que el pulso idle base, verificado durante el paso de
  verificación manual.
