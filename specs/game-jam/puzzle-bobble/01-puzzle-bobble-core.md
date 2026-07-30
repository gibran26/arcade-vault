# Integración de Puzzle Bobble — variante core (motor + leaderboard)

**Estado:** Borrador
**Depende de:** 04-integracion-supabase (clientes de Supabase); consume la capa ya generalizada
por 07-tetris-motor-leaderboard (`getGames`/`getGame`/`getScores`/`getStats`/`saveScore`,
`GAME_ENGINES`) sin volver a generalizar nada.
**Alternativa a:** `specs/game-jam/puzzle-bobble/02-puzzle-bobble-powerups-racha.md` — mismo `id`,
distinto alcance; son mutuamente excluyentes, se implementa solo uno.
**Fecha:** 2026-07-29
**Objetivo:** Construir desde cero el motor mínimo de Puzzle Bobble (grid hexagonal de burbujas de
colores, cañón giratorio que dispara una burbuja que rebota en las paredes y se ancla al impactar,
detección de clusters de 3+ del mismo color, caída de burbujas flotantes desconectadas, 3 vidas y
niveles con objetivo de despeje total del tablero y dificultad creciente) dentro de un `<canvas>` en
`/game/puzzle-bobble/play`, dibujado con gráficos procedurales detallados y animaciones simples,
notificando a React los cambios de puntaje, vidas y nivel, y persistir sus puntuaciones vía la capa
de datos genérica ya existente.

## Alcance

**Dentro del alcance:**

- **Nueva fila semilla en la tabla `games` de Supabase** (vía `apply_migration`, mismo esquema ya
  existente de `games`/`scores`, sin cambios de columnas): `id: "puzzle-bobble"`,
  `title: "PUZZLE BOBBLE"`, `cat: "PUZZLE"`, `cover: "cover-bg"`, `color: "yellow"`. Se suma a las
  filas ya existentes (`asteroids`, `tetris`, `arkanoid`, `snake`, `frogger`).
- **Sin cover temático nuevo diseñado en este spec**: se revisaron todas las clases CSS de
  `globals.css` (`cover-bricks`, `cover-tetro`, `cover-snake`, `cover-glot`, `cover-invaders`,
  `cover-rocas`, `cover-rana`, `cover-duelo`) y ninguna encaja razonablemente con un disparador de
  burbujas de colores: `cover-glot` es un motivo de boca recortada tipo Pac-Man,
  `cover-invaders` es una formación de alienígenas en grilla, `cover-rocas` sugiere un campo de
  asteroides (con un triángulo de nave superpuesto), `cover-duelo` es un patrón de duelo VERSUS —
  forzar cualquiera de ellas como "burbujas" sería engañoso, a diferencia de Match Three, donde
  `cover-tetro` sí comparte espíritu de "grilla de celdas de colores". Se usa `cover-bg` (la clase
  base neutra, sin gradiente temático propio) como placeholder honesto en la fila semilla en vez de
  reutilizar un cover ajeno a este juego; diseñar un `cover-bubbles` dedicado queda fuera de alcance
  (ver "Fuera de alcance").
- **Sin assets gráficos externos, pero con detalle visual e identificable**: el cañón, las burbujas,
  el grid y el HUD interno se dibujan con primitivas de canvas (círculos, arcos, líneas, polígonos),
  usando la paleta de colores neón ya definida en `globals.css` (variables
  `--cyan`/`--green`/`--yellow`/`--magenta`). Ningún elemento se limita a una única forma geométrica
  de color plano; cada uno combina varias primitivas para sugerir textura, identidad o profundidad:
  - **Burbuja "Gota" (cian)**: círculo base con relleno en gradiente radial (claro en el
    centro-superior, oscuro en el borde), una elipse de brillo blanco translúcido desplazada hacia
    la esquina superior izquierda, un trazo de contorno más oscuro, y dos arcos cortos internos a
    modo de reflejo curvo — mismo lenguaje visual de "faceta" ya usado por las gemas de Match Three,
    adaptado a burbujas.
  - **Burbuja "Rubí" (magenta)**: círculo base con el mismo gradiente radial, más un rombo pequeño
    semitransparente centrado (faceta) y un punto de brillo fijo en la esquina superior derecha.
  - **Burbuja "Esmeralda" (verde)**: círculo base con 3 líneas internas curvas que van del centro
    hacia el borde (facetado tipo gajos) y un arco de brillo en la esquina superior izquierda.
  - **Burbuja "Topacio" (amarillo)**: círculo base con una estrella de 4 puntas pequeña centrada
    (destello) y líneas finas irradiando desde el centro hacia el borde.
  - **Cañón/lanzador**: base semicircular con textura de gradiente metálico (varias bandas
    concéntricas de gris/azul oscuro), un cañón/tubo rectangular con extremos redondeados que rota
    según el ángulo de apuntado, un pequeño anillo decorativo en la base, y la burbuja cargada
    visible dentro de la boca del cañón. Anima una **anticipación**: el cañón se comprime
    ligeramente (squash) una fracción de segundo antes de disparar y se estira al soltar la burbuja.
  - **Burbuja en cola (siguiente disparo)**: un círculo más pequeño dibujado junto al cañón (mismo
    estilo de faceta que su tipo de color) para previsualizar el próximo color a disparar,
    apareciendo con un pequeño rebote (scale-in) al cargarse una nueva burbuja tras cada disparo.
  - **Guía de trayectoria**: una línea punteada ("marching ants", el patrón de guiones se desplaza
    en bucle) desde la boca del cañón hasta el punto de rebote/impacto proyectado, recalculada en
    cada frame según el ángulo de apuntado actual.
  - **Paredes laterales**: franjas verticales con un patrón de líneas diagonales alternas (textura
    de "peligro"/rebote) en vez de un borde plano, precalculadas en un `<canvas>` offscreen porque no
    cambian entre frames.
  - **Línea de peligro**: una línea horizontal cerca del cañón que pulsa (glow que crece y decrece
    en bucle) volviéndose más intensa/rápida cuando la pila de burbujas se acerca a ella —
    telegrafiando visualmente el riesgo de perder una vida antes de que ocurra.
  - **Franja superior de HUD interno**: un indicador del nivel actual y de burbujas restantes por
    despejar, dibujado como texto más una barra de progreso — mismo patrón ya usado por Tetris
    (panel interno) y Match Three (barra de movimientos/objetivo), aquí como único elemento de "HUD
    interno" porque puntaje/vidas/nivel ya los cubre el HUD de React.
- **Motor construido desde cero** (sin `game.js` de referencia, igual que Snake/Frogger/Match Three)
  en `app/game-engines/puzzle-bobble/engine.ts`, exponiendo `createGame(canvas, callbacks)` con
  `pause()`/`resume()`/`destroy()`, mismo patrón que `asteroids`/`tetris`/`arkanoid`/`snake`/
  `frogger`. Incluye:
  - Canvas de 480×640. Área de juego del grid hexagonal: desde `y=40` (debajo de la franja de HUD
    interno) hasta `y=560`; 10 columnas lógicas de burbujas de 40px de diámetro (400px de ancho,
    centradas con 40px de margen total), en filas alternas desplazadas media celda (offset
    hexagonal clásico tipo Bust-a-Move). El cañón se dibuja fijo en `(240, 600)`.
  - **Apuntado por teclado**: `←`/`→` (o `A`/`D`) rotan el ángulo de apuntado del cañón de forma
    continua mientras se mantienen presionadas, acotado entre 10° y 170° respecto a la horizontal
    (nunca apunta hacia abajo ni perfectamente horizontal, para que siempre exista una trayectoria
    válida hacia el grid). `Enter`/`Espacio` dispara la burbuja cargada en la dirección apuntada.
  - **Disparo con rebote**: la burbuja disparada viaja en línea recta a velocidad constante,
    rebotando (ángulo de incidencia = ángulo de reflexión) contra las paredes laterales del área de
    juego, hasta colisionar con el borde superior del grid o con otra burbuja ya anclada.
  - **Anclaje a la celda hexagonal más cercana**: al colisionar, la burbuja disparada se ancla en la
    celda vacía del grid hexagonal más cercana al punto de impacto (nunca se superpone con una
    burbuja existente).
  - **Detección de clusters y resolución**: tras anclarse, se evalúa el grupo de burbujas
    conectadas del mismo color (adyacencia hexagonal) que incluye la burbuja recién anclada; si el
    grupo tiene 3 o más burbujas, todas se eliminan sumando puntaje (ver "Puntuación"). Si el grupo
    tiene menos de 3, la burbuja se queda anclada sin efecto adicional.
  - **Caída de burbujas flotantes**: tras resolver un cluster, cualquier burbuja del grid que quede
    sin una cadena de adyacencia hasta el borde superior (grupo "desconectado del techo") cae fuera
    del área de juego (animación de caída con gravedad y rotación, ver animaciones), sumando puntaje
    adicional por cada una (ver "Puntuación").
  - **Puntuación**: cada burbuja eliminada en un cluster resuelto suma `10` puntos base; un cluster
    de exactamente 3 burbujas suma `30` puntos (`3 × 10`), uno de 4 suma `60`, uno de 5 suma `100`,
    uno de 6 suma `150`, y uno de 7 o más suma `200 + 30` por cada burbuja adicional sobre 7 — los
    bonos por tamaño de cluster existen para premiar clusters más grandes sin necesitar power-ups
    (exclusivos de la variante `feature`). Cada burbuja flotante que cae por desconexión suma `20`
    puntos (el doble de la base), sin bono adicional por cantidad — el sistema de racha/multiplicador
    de precisión es el segundo eje de profundidad exclusivo de la variante `feature`.
  - **Descenso periódico del techo**: cada `8` disparos realizados (acierten o no un cluster), todo
    el grid desciende una fila completa (animación de deslizamiento con easing, más un parpadeo de
    aviso en la franja superior un instante antes de bajar) y se genera una nueva fila de burbujas
    aleatorias en la parte superior, aumentando la presión sobre la línea de peligro.
  - **Nivel completado por despeje total**: cuando el grid queda completamente vacío (todas las
    burbujas eliminadas por clusters o caídas por desconexión), el nivel se completa de inmediato:
    suma `500` puntos de bonificación, sube el nivel en 1 (`onLevelChange`), y arranca el siguiente
    nivel con una grilla nueva más difícil: una fila adicional de burbujas iniciales (nivel 1 arranca
    con 5 filas, nivel 2 con 6, etc., con un tope de 9 filas iniciales para dejar margen de juego), y
    el descenso periódico del techo se acelera en 1 disparo menos (de `8` a `7`, luego `6`... con un
    piso de `4` disparos entre descensos).
  - **Pérdida de vida por línea de peligro**: si, tras cualquier anclaje o descenso de techo, alguna
    burbuja del grid queda en la fila adyacente a la línea de peligro (o por debajo de ella), se
    resta una vida (ver "Vidas"); si quedan vidas, el intento del nivel actual se reinicia con una
    grilla nueva del mismo nivel (mismo número de filas iniciales y cadencia de descenso vigentes) y
    el conteo de disparos hasta el próximo descenso se reinicia; el puntaje total de la partida ya
    acumulado se conserva.
  - **3 vidas**: la partida arranca con `onLivesChange(3)`. Cada vez que la pila de burbujas alcanza
    la línea de peligro, se resta una vida; si llegan a `0`, se invoca `onGameOver(finalScore)`
    inmediatamente después del último `onLivesChange(0)`. No hay vida extra por puntaje en esta
    variante (ver "Fuera de alcance").
  - **Sin bloqueos del grid**: si en algún momento no queda ningún color con al menos 3 burbujas
    presentes en el grid (imposible formar un cluster con los colores restantes), el motor sustituye
    silenciosamente el color de una burbuja aleatoria del grid por uno ya presente en cantidad
    suficiente, sin notificarlo visualmente como una acción del jugador.
- **Pausa real con doble camino**: el botón "PAUSA" del HUD de React llama `pause()`/`resume()`; las
  teclas `P`/`Escape` capturadas por el engine hacen lo mismo internamente. Ambos caminos
  detienen/reanudan el loop de animación real (burbuja en vuelo, descenso de techo, caída de
  burbujas, pulso de la línea de peligro) y confirman el nuevo estado vía `onPauseChange(isPaused)`.
- **Callbacks conectados**: `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`,
  `onLevelChange` — los cinco ya son consumidos genéricamente por `GamePlayClient.tsx`, sin
  necesidad de tocar ese archivo.
- **Montaje genérico**: se agrega la entrada `"puzzle-bobble": { createGame, width: 480, height: 640
}` a `app/game-engines/registry.ts` (`GAME_ENGINES`). No se toca `app/game/[id]/play/page.tsx` ni
  `GamePlayClient.tsx` — ya resuelven cualquier `id` registrado sin condicionales.
- **Consumo de la capa de datos ya generalizada**: `/game/puzzle-bobble`, el guardado de puntuación
  en `/game/puzzle-bobble/play` y la pestaña "PUZZLE BOBBLE" en `/hall-of-fame` funcionan
  automáticamente en cuanto la fila `"puzzle-bobble"` existe en `games` y el registro de motores
  tiene su entrada — `getGame`/`getGames`/`getScores`/`getStats`/`saveScore` y las páginas que los
  consumen ya son genéricas por `gameId` desde el spec 07, sin cambios propios en esta variante.

**Fuera de alcance (para otros specs):**

- **Power-ups (burbuja bomba, arcoíris, congelante) y el sistema de racha/multiplicador de
  precisión** — todo este eje de profundidad se deja para la variante con power-ups de este mismo
  juego, ver `specs/game-jam/puzzle-bobble/02-puzzle-bobble-powerups-racha.md`. Esta variante `core`
  es deliberadamente la versión sin power-ups y sin multiplicador de racha.
- Vida extra por puntaje — se consideró (mismo patrón que Frogger `niveles`) y se descartó para esta
  variante, para mantener el sistema de vidas simple (solo se pierden, nunca se ganan); queda
  disponible como posible extensión de la variante `feature` si se decidiera en el futuro, pero no
  forma parte de ninguna de las dos variantes de este spec.
- Apuntado o disparo por mouse/drag — el control es exclusivamente por teclado (rotación continua +
  disparo), igual criterio que el resto del catálogo (sin soporte de mouse/touch en ningún motor
  existente).
- Soporte táctil/móvil (solo teclado).
- Sonido (no se proveyeron ni se diseñan assets de audio en esta variante).
- Políticas RLS en `games`/`scores` — mismo pendiente ya documentado en specs 05/06/07/08/09 y en
  Frogger/Match Three.
- Supabase Auth real / relación de `scores.user_id` con un usuario autenticado.
- Cambios visuales en `Podium.tsx`/`Leaderboard.tsx`/`GameCard.tsx`/`MiniCard`.
- Adaptar cualquier otro juego de `references/started-games/` — este spec cubre únicamente esta
  variante de Puzzle Bobble.
- **Sprites, spritesheets o cualquier imagen externa**: el detalle visual descrito en el Alcance
  (facetas, brillos, biseles, destellos) es enteramente procedural, generado con primitivas de canvas
  en tiempo de dibujo (o cacheado en `<canvas>` offscreen) — no se cargan ni se generan archivos de
  imagen.
- **Efectos gráficos pesados**: sistemas de partículas grandes, sombras dinámicas o post-procesado —
  el detalle visual se limita a composición de primitivas simples y las animaciones descritas (pop de
  cluster, caída de burbujas, deslizamiento de techo, pulso de línea de peligro), sin motor de
  partículas costoso.
- **Diseño de un `cover-bubbles` dedicado** — se usa `cover-bg` (neutro) como placeholder honesto
  (ver justificación arriba); diseñar un cover propio para Puzzle Bobble queda para un spec de
  `skin-designer` futuro si se decide.
- Ajustes de responsive/CSS del contenedor `crt`/`crt-screen` para encajar un sexto tamaño de canvas
  — mismo pendiente ya anotado en specs 05/07/08/09, Frogger y Match Three.

## Modelo de datos

- **`app/game-engines/puzzle-bobble/engine.ts`** — módulo nuevo, sin estado global de módulo (grid,
  cañón, burbuja en vuelo, burbuja en cola, cadencia de descenso, score, vidas, nivel, estado de
  pausa, cachés offscreen y listeners quedan encapsulados dentro del closure de `createGame`):

  ```ts
  export interface PuzzleBobbleCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void; // emite 3 al iniciar; baja al alcanzar la pila la línea de peligro; 0 dispara game over
    onGameOver: (finalScore: number) => void;
    onPauseChange: (isPaused: boolean) => void;
    onLevelChange: (level: number) => void; // emite 1 al iniciar; sube en 1 al despejar completamente el grid
  }

  export interface PuzzleBobbleGame {
    pause: () => void;
    resume: () => void;
    destroy: () => void;
  }

  export function createGame(
    canvas: HTMLCanvasElement,
    callbacks: PuzzleBobbleCallbacks,
  ): PuzzleBobbleGame;
  ```

  Internamente conserva, como estructuras encapsuladas:
  - `grid: (Bubble | null)[][]`, matriz hexagonal offset de burbujas ancladas; cada `Bubble` lleva
    `id` (para animaciones estables entre frames), `bubbleType: 'drop' | 'ruby' | 'emerald' |
'topaz'`, y un bloque de animación `{ state: 'idle' | 'popping' | 'falling', progress: number
(0→1) }` para que cada celda anime su propia transición independientemente de las demás.
  - `cannon: { angle: number (10°–170°), loadedBubble: BubbleType, nextBubble: BubbleType }`.
  - `flyingBubble: { x: number; y: number; vx: number; vy: number; bubbleType: BubbleType } | null`.
  - `shotsUntilDrop: number`, `shotsPerDrop: number` (cadencia vigente del nivel actual, con piso de
    `4`), `startingRows: number` (filas iniciales del nivel actual, con tope de `9`).
  - `score: number`, `lives: number`, `level: number`, `isPaused: boolean`, `gameOverFired: boolean`.
  - **Fase de idle propia por burbuja**: cada `Bubble` lleva un `glowPhase: number` aleatorio fijado
    al generarse, usado para que el brillo/destello sutil de cada burbuja (ver animaciones) no se
    vea sincronizado entre celdas.
  - **Cachés offscreen**: un `<canvas>` offscreen para las paredes laterales con su textura de
    líneas diagonales (dibujadas una sola vez y volcadas cada frame), y un `<canvas>` offscreen por
    cada uno de los 4 tipos de burbuja (sprite pre-renderizado a tamaño de celda, reutilizado al
    dibujar cada instancia en el grid en vez de recomponer sus primitivas en cada frame). Ambos
    cachés se generan una única vez en `createGame` y no se invalidan durante la partida.
  - El loop de animación (`requestAnimationFrame` con `dt` cappeado) avanza la posición de la
    burbuja en vuelo, el `progress` de cada `Bubble` en estado no-`idle`, resuelve clusters/caídas
    cuando corresponde, y redibuja el tablero completo por frame (paredes cacheadas + burbujas
    cacheadas + overlays de cañón/guía de trayectoria/línea de peligro/HUD interno).
  - Los listeners de teclado (`←`/`→`, `A`/`D` para rotar el ángulo del cañón; `Enter`/`Espacio`
    para disparar; `P`/`Escape` para pausa).

  - `onScoreChange` se invoca tras resolver cada cluster (con el bono de tamaño correspondiente) y
    tras cada caída de burbujas desconectadas, con el puntaje acumulado total.
  - `onLivesChange` se invoca al iniciar (`3`), cada vez que la pila alcanza la línea de peligro
    (`lives - 1`), y con `0` en el instante en que la última vida se pierde, inmediatamente seguido
    de `onGameOver`.
  - `onGameOver` se invoca una única vez por partida, cuando `lives` llega a `0`, con el `score`
    final acumulado.
  - `onLevelChange` se invoca al iniciar (`level = 1`) y cada vez que el grid queda completamente
    despejado (`level++`), ajustando en ese momento `startingRows` y `shotsPerDrop` del siguiente
    nivel.
  - `onPauseChange` se invoca al confirmar cada cambio de estado de pausa, sin importar si lo inició
    `pause()`/`resume()` (React) o la tecla `P`/`Escape` (engine); mientras está en pausa, ninguna
    animación (vuelo de burbuja, descenso de techo, caída, pulso de línea de peligro) avanza.

- **Fila semilla en `games`** (SQL de la migración, mismo esquema ya existente de `games`/`scores`,
  sin cambios de columnas):

  ```sql
  insert into games (id, title, short, long, cat, cover, color) values (
    'puzzle-bobble', 'PUZZLE BOBBLE',
    'Dispara burbujas de colores y forma clusters de 3 o más antes de que lleguen a tu cañón.',
    'Rota tu cañón y dispara burbujas de colores que rebotan en las paredes hasta anclarse en el grid hexagonal. Forma clusters de 3 o más burbujas del mismo color para hacerlas estallar y despeja el tablero por completo antes de que la pila alcance la línea de peligro.',
    'PUZZLE', 'cover-bg', 'yellow'
  );
  ```

- **`app/game-engines/registry.ts`**: se agrega la entrada
  `"puzzle-bobble": { createGame: puzzleBobbleCreateGame, width: 480, height: 640 }` a
  `GAME_ENGINES`, con su import correspondiente (`import { createGame as puzzleBobbleCreateGame }
from './puzzle-bobble/engine'`). No se agregan tipos nuevos — reutiliza `EngineCallbacks`/
  `EngineInstance` ya existentes en ese archivo.

- `app/lib/supabase/queries.ts`/`actions.ts` no cambian de firma: `getGames`/`getGame`/`getScores`/
  `getStats`/`saveScore` ya son genéricas por `gameId` desde el spec 07; esta variante solo las
  consume.

## Plan de implementación

1. **Crear la migración de Supabase** (vía MCP `apply_migration`) que inserta la fila semilla de
   `"puzzle-bobble"` en `games`, usando el esquema ya existente (sin alterar columnas de
   `games`/`scores`). El sistema queda funcional: la fila existe en Supabase, pero ninguna ruta la
   usa todavía (`/game/puzzle-bobble` da 404 porque `GAME_ENGINES` aún no tiene la clave
   `"puzzle-bobble"`).
2. **Crear `app/game-engines/puzzle-bobble/engine.ts` — grid y cañón estático**:
   `createGame(canvas, callbacks)` que inicializa el grid hexagonal 10 columnas con las 5 filas
   iniciales del nivel 1 (4 tipos de burbuja), dibuja el cañón fijo apuntando hacia arriba, y
   renderiza el tablero estático (sin cachés aún, primitivas directas) sobre un canvas de 480×640.
   El sistema queda funcional: el módulo compila, es importable, y el tablero inicial se renderiza
   correctamente de forma aislada.
3. **Conectar apuntado y disparo por teclado** — capturar `←`/`→`/`A`/`D` para rotar el ángulo del
   cañón (acotado 10°–170°), `Enter`/`Espacio` para disparar la burbuja cargada, moviéndola en línea
   recta con rebote contra las paredes laterales hasta colisionar con el grid o su borde superior.
   El sistema queda funcional: el jugador puede apuntar y disparar burbujas con teclado de forma
   aislada, aunque los clusters todavía no se resuelvan.
4. **Agregar anclaje, detección de clusters y caída de burbujas flotantes** — anclar la burbuja
   disparada a la celda hexagonal libre más cercana al punto de impacto, evaluar el cluster conexo
   del mismo color, eliminar clusters de 3+ sumando puntaje según su tamaño, y detectar y hacer caer
   cualquier burbuja desconectada del borde superior tras la resolución. El sistema queda funcional:
   el ciclo completo de disparo → anclaje → cluster → caída funciona de forma aislada.
5. **Agregar descenso periódico del techo y nivel completado por despeje** — decrementar
   `shotsUntilDrop` en cada disparo, deslizar el grid una fila hacia abajo con una fila nueva arriba
   cuando llega a 0 (reiniciando el contador con `shotsPerDrop` vigente), y detectar cuándo el grid
   queda completamente vacío para completar el nivel (bono de 500 puntos, sube nivel, aumenta filas
   iniciales y acelera la cadencia de descenso del siguiente nivel). El sistema queda funcional: la
   progresión de niveles y el descenso del techo son observables de forma aislada.
6. **Agregar detección de línea de peligro, vidas y game over** — detectar cuándo alguna burbuja del
   grid alcanza o supera la línea de peligro, restar una vida, reiniciar el intento del nivel actual
   si quedan vidas (grilla nueva, mismo nivel vigente), y detener el juego invocando `onGameOver`
   cuando las vidas llegan a 0. El sistema queda funcional: el ciclo completo de vidas/reinicio/fin
   de partida funciona de forma aislada.
7. **Conectar los callbacks `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver`** —
   invocar `onLivesChange(3)` y `onLevelChange(1)` al iniciar; `onScoreChange` tras cada cluster
   resuelto y cada caída de burbujas; `onLivesChange`/`onLevelChange` en los puntos ya descritos; y
   `onGameOver(finalScore)` inmediatamente después del último `onLivesChange(0)`, deteniendo el loop
   de animación. El sistema queda funcional: el engine notifica todos los cambios de estado
   relevantes, aunque aún no haya un consumidor en React.
8. **Implementar `pause()`/`resume()`/`destroy()`** — controlando el loop de animación real
   (deteniendo/reanudando el vuelo de la burbuja, el descenso de techo, la caída y el pulso de la
   línea de peligro), agregando los listeners de teclado `P`/`Escape`, invocando
   `onPauseChange(true)`/`onPauseChange(false)` en ambos caminos. `destroy()` detiene el loop y
   remueve todos los listeners de teclado agregados por `createGame`. El sistema queda funcional: la
   API pública del engine está completa y probada de forma aislada.
9. **Registrar el motor en `app/game-engines/registry.ts`** — agregar el import
   `puzzleBobbleCreateGame` y la entrada `"puzzle-bobble": { createGame: puzzleBobbleCreateGame,
width: 480, height: 640 }` a `GAME_ENGINES`. El sistema queda funcional de punta a punta: `/game/
puzzle-bobble` y `/game/puzzle-bobble/play` dejan de dar 404, el juego es jugable completo desde la
   UI real (HUD de React conectado, pausa, fin de juego), y el guardado de puntuación, el detalle
   del juego y la pestaña "PUZZLE BOBBLE" del salón de la fama funcionan automáticamente vía la capa
   de datos ya generalizada.
10. **Agregar la capa de dibujo detallada y sus cachés** — precalcular en un `<canvas>` offscreen la
    textura de las paredes laterales, precalcular en cachés offscreen individuales los 4 sprites de
    tipo de burbuja (facetas, brillos, contornos descritos en el Alcance), y por frame: volcar ambos
    cachés, dibujar el pulso de brillo propio de cada burbuja (`glowPhase`), la anticipación/estiro
    del cañón al disparar, la guía de trayectoria punteada animada, el pulso de la línea de peligro,
    y la franja superior de HUD interno (nivel y burbujas restantes). El sistema queda funcional: el
    tablero completo se ve detallado y animado, de forma aislada.
11. **Verificación manual y build** — jugar una partida completa en `/game/puzzle-bobble/play`
    confirmando: rotación de cañón y disparo con teclado, rebote correcto en paredes, anclaje preciso
    a la celda hexagonal más cercana, resolución de clusters con puntaje correcto según tamaño, caída
    de burbujas desconectadas, descenso periódico del techo visible y con cadencia decreciente por
    nivel, nivel completado al despejar el grid con aumento de dificultad (más filas iniciales, techo
    más frecuente), vida perdida al alcanzar la línea de peligro con reinicio del intento, fin de
    juego al agotar las 3 vidas, pausa real con botón y con `P`/`Escape`, guardado de puntuación
    real, y que la puntuación aparece en `/game/puzzle-bobble` y en la pestaña "PUZZLE BOBBLE" de
    `/hall-of-fame` tras recargar. Confirmar también el detalle visual (cada tipo de burbuja
    identificable de un vistazo, animaciones de anticipación del cañón/pop de cluster/caída/pulso de
    línea de peligro fluidas y perceptibles) y que el framerate se mantiene estable durante una
    partida larga con varios niveles superados. Confirmar que el resto del catálogo no tiene
    regresiones. Ejecutar `npm run build` sin errores de TypeScript ni de ESLint. El sistema queda
    funcional y verificado de punta a punta.

## Criterios de aceptación

- [ ] La tabla `games` de Supabase contiene una fila `id: "puzzle-bobble"`,
      `title: "PUZZLE BOBBLE"`, `cat: "PUZZLE"`, `cover: "cover-bg"`, `color: "yellow"`, sembrada
      por la migración.
- [ ] `app/game-engines/puzzle-bobble/engine.ts` existe, exporta `createGame(canvas, callbacks)` y
      no usa variables globales de módulo (grid, cañón, burbuja en vuelo, score, vidas, nivel,
      estado de pausa, cachés y listeners quedan encapsulados dentro del closure de `createGame`).
- [ ] `PuzzleBobbleCallbacks` incluye `onScoreChange`, `onLivesChange`, `onGameOver`,
      `onPauseChange`, `onLevelChange`, todos obligatorios, compatibles con `EngineCallbacks` de
      `registry.ts`.
- [ ] En `/game/puzzle-bobble/play` el juego se renderiza dentro de un `<canvas>` de 480×640 y es
      jugable con teclado: `←`/`→`/`A`/`D` rotan el ángulo del cañón de forma continua,
      `Enter`/`Espacio` disparan la burbuja cargada.
- [ ] La burbuja disparada rebota correctamente en las paredes laterales (ángulo de incidencia =
      ángulo de reflexión) y se ancla en la celda hexagonal vacía más cercana al punto de impacto,
      sin superponerse nunca con una burbuja existente.
- [ ] Un cluster conexo de 3+ burbujas del mismo color se elimina al formarse, sumando puntaje
      (`30` por cluster de 3, `60` de 4, `100` de 5, `150` de 6, `200 + 30` por adicional desde 7).
- [ ] Tras resolver un cluster, cualquier burbuja desconectada del borde superior del grid cae fuera
      del área de juego, sumando `20` puntos por burbuja caída.
- [ ] Cada 8 disparos (cadencia vigente del nivel), el grid desciende una fila completa con una fila
      nueva generada arriba, visible como una animación de deslizamiento.
- [ ] Despejar completamente el grid completa el nivel: suma 500 puntos, `onLevelChange` sube en 1,
      el siguiente nivel arranca con una fila inicial adicional (tope de 9) y la cadencia de
      descenso del techo se reduce en 1 disparo (piso de 4).
- [ ] Si alguna burbuja del grid alcanza la línea de peligro, se resta una vida (`onLivesChange`) y,
      si quedan vidas, se reinicia el intento del nivel actual con una grilla nueva, conservando el
      puntaje total ya acumulado.
- [ ] La partida arranca con `onLivesChange(3)`; al llegar a `0`, se invoca `onGameOver(finalScore)`
      una única vez, y React muestra el modal "FIN DEL JUEGO" con el puntaje final.
- [ ] Si en algún momento ningún color tiene 3+ burbujas presentes en el grid, el motor reordena
      silenciosamente los colores existentes para garantizar que exista al menos un cluster posible.
- [ ] El botón "PAUSA" del HUD de React y las teclas `P`/`Escape` capturadas por el engine
      detienen/reanudan el loop de animación real (ninguna burbuja anima vuelo/descenso/caída/pulso
      mientras está en pausa), confirmando el estado vía `onPauseChange(isPaused)`.
- [ ] Al presionar "JUGAR DE NUEVO", el engine se destruye y se vuelve a crear desde cero: grid,
      cañón, vidas (3), nivel (1) y puntaje (0) quedan en su estado inicial.
- [ ] Salir de la partida (botón "SALIR" o navegación fuera de la página) limpia correctamente el
      engine (`destroy()` se llama en el cleanup del `useEffect`, sin loops ni listeners de teclado
      colgando).
- [ ] `app/game-engines/registry.ts` incluye la entrada `"puzzle-bobble": { createGame, width: 480,
  height: 640 }`, sin modificar `app/game/[id]/play/page.tsx` ni `GamePlayClient.tsx`.
- [ ] En `/game/puzzle-bobble/play`, guardar la puntuación inserta una fila real en `scores`
      (`game_id: "puzzle-bobble"`) vía `saveScore`, reutilizando la Server Action ya existente sin
      cambios.
- [ ] En `/game/puzzle-bobble`, el título, descripción, leaderboard lateral, "Mejor global" y
      "Partidas" provienen de Supabase vía `getGame`/`getScores`/`getStats`, sin cambios en esas
      funciones.
- [ ] En `/hall-of-fame`, la pestaña "PUZZLE BOBBLE" muestra las puntuaciones reales de `scores`
      para `game_id: "puzzle-bobble"`.
- [ ] El resto del catálogo (`asteroids`, `tetris`, `arkanoid`, `snake`, `frogger`) conserva
      exactamente su comportamiento actual, sin regresiones.
- [ ] Ningún elemento del tablero (las 4 burbujas, el cañón, las paredes, la línea de peligro) se
      dibuja como una única forma geométrica plana de un solo color; cada uno combina varias
      primitivas para sugerir textura o identidad, según lo descrito en el Alcance.
- [ ] Cada uno de los 4 tipos de burbuja es distinguible de un vistazo por su faceta/destello
      interno, incluso con el grid lleno de burbujas.
- [ ] Las burbujas animan: pop (escala/flash) al ser eliminadas en un cluster, caída con gravedad y
      rotación al desconectarse del techo, y un pulso de brillo sutil en bucle con fase propia por
      burbuja (no sincronizado entre celdas).
- [ ] El cañón anima una anticipación (compresión) antes de disparar y un estiro al soltar la
      burbuja; la guía de trayectoria punteada se recalcula en tiempo real según el ángulo actual.
- [ ] La línea de peligro pulsa con un glow que se intensifica visiblemente cuando la pila de
      burbujas se acerca a ella.
- [ ] Las paredes laterales están cacheadas en un `<canvas>` offscreen (no recompuestas con
      primitivas cada frame), y las 4 burbujas están cacheadas como sprites offscreen reutilizados
      al dibujar cada instancia en el grid.
- [ ] El framerate se mantiene estable durante una partida larga con varios niveles superados.
- [ ] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Motor construido desde cero**, sin `game.js` de referencia (mismo criterio que Snake/Frogger/
  Match Three), porque Puzzle Bobble no forma parte de `references/started-games/` — toda la
  mecánica se definió en este spec a partir de la sugerencia del jam ("dispara burbujas de colores
  para formar clusters y reventarlos").
- **`id: "puzzle-bobble"` (inglés, con guion)**, mismo criterio ya aplicado en el resto del catálogo
  — slug descriptivo del género en inglés, tomado directamente de la fila del to-do de
  `game-planner`.
- **Callbacks: los cinco estándar, sin uno nuevo para disparos/racha**, igual criterio que Frogger
  `niveles` (temporizador) y Match Three `core` (movimientos/objetivo) — los indicadores de disparos
  hasta el próximo descenso y burbujas restantes son elementos puramente visuales dibujados en el
  canvas (barra de HUD interno), no necesitan ser fuente de verdad para React, evitando generalizar
  `EngineCallbacks` por una sola variante de un solo juego.
- **Por qué este alcance corresponde a `core`**: vidas (3, solo se pierden) y niveles (despeje total
  del grid con dificultad creciente vía filas iniciales y cadencia de descenso del techo) son el
  mínimo que vuelve a Puzzle Bobble un juego completo y rejugable, no una demo de disparo-y-ancla
  suelta. Se dejó deliberadamente fuera cualquier power-up (bomba, arcoíris, congelante) y el
  sistema de racha/multiplicador de precisión, reservados enteros para la variante `feature`
  (`02-puzzle-bobble-powerups-racha.md`), para que el eje de profundidad de esa variante sea nítido
  y no esté parcialmente adelantado aquí.
- **Vidas por "la pila alcanza la línea de peligro"**, en vez de por cualquier otra causa, porque es
  la condición de derrota clásica e inequívoca del género (Bust-a-Move/Puzzle Bobble original) — se
  mapeó directamente sin inventar una condición alternativa.
- **Despeje total del grid como objetivo de nivel**, en vez de un objetivo de puntaje como Match
  Three, porque en Puzzle Bobble "vaciar el tablero" es el objetivo natural y reconocible del
  género, mientras que un puntaje objetivo se sentiría artificial para este tipo de mecánica.
- **Filas iniciales crecientes + cadencia de descenso decreciente como progresión de dificultad**, en
  vez de solo uno de los dos ejes, para que subir de nivel se sienta perceptiblemente más difícil
  (más burbujas que despejar desde el inicio, menos margen de disparos antes de que el techo baje) —
  mismo espíritu que la progresión combinada de Frogger `niveles` (velocidad + tortugas +
  temporizador) y Match Three `core` (objetivo + movimientos + tipos de gema), adaptado a un género
  de disparo con rebote.
- **Sin vida extra por puntaje**, a diferencia de Frogger `niveles`, para mantener el sistema de
  vidas de esta variante simple (solo bajan) — se consideró y se descartó explícitamente, ver "Fuera
  de alcance".
- **Bonos de puntaje por tamaño de cluster** (`30`/`60`/`100`/`150`/`200+30` por adicional), en vez
  de un puntaje lineal puro (`10 × burbujas`), para que clusters más grandes se sientan recompensados
  incluso sin power-ups — mismo criterio ya aplicado por Match Three `core` con sus bonos de
  coincidencia.
- **Apuntado y disparo por teclado (rotación continua + `Enter`/`Espacio`), sin mouse**, mismo
  criterio que todo el catálogo existente (ningún motor soporta mouse/touch hoy) — se consideró un
  esquema de apuntado con mouse (más natural para el género en otras plataformas) y se descartó por
  inconsistencia con el resto de Arcade Vault. Controles y canvas base son idénticos entre ambas
  variantes de este juego, ver header del jam.
- **Estilo gráfico y de animación**: burbujas 100% procedurales (círculo con faceta/brillo/contorno
  compuestos de varias primitivas), en vez de sprites — mismo criterio de "cero assets externos" ya
  aplicado por Tetris/Arkanoid/Snake/Frogger/Match Three. Se consideraron sombras dinámicas
  (`shadowBlur`) por burbuja en tiempo real y se descartaron por costo — el brillo se hornea en el
  sprite cacheado offscreen de cada tipo de burbuja en vez de recalcularse cada frame. Se consideró
  un sistema de partículas al eliminar un cluster (confeti/chispas) y se descartó para esta variante
  por presupuesto de rendimiento — el "pop" se resuelve con squash & stretch y flash de escala, sin
  partículas.
- **`cover-bg` como placeholder honesto**, en vez de reutilizar `cover-glot`/`cover-invaders`/
  `cover-rocas`/`cover-duelo` — ver justificación completa en "Dentro del alcance"; ninguna clase
  existente sugiere temáticamente un disparador de burbujas de colores, y forzar una de ellas sería
  engañoso (a diferencia del caso de Match Three, donde `cover-tetro` sí compartía espíritu de
  grilla de celdas de colores).
- **Canvas 480×640 con grid hexagonal de 10 columnas (celdas de 40px)**, un tamaño y proporción
  propios de Puzzle Bobble, distinto de los ya usados por el resto del catálogo — la proporción más
  alta que ancha (640 vs 480) refleja el espacio vertical necesario para el descenso progresivo del
  techo.
- **Pausa dual con tecla `P`/`Escape` además del botón de React**, igual que el patrón ya
  establecido en Arkanoid/Snake/Frogger/Match Three.
- **Consumo directo de la capa de Supabase ya generalizada** (`getGames`/`getGame`/`getScores`/
  `getStats`/`saveScore`, `GAME_ENGINES`), sin volver a generalizarla ni duplicarla — mismo criterio
  ya aplicado por los specs 08/09 y por Frogger/Match Three.

## Riesgos identificados

- **Anclaje impreciso a la celda hexagonal**: si el cálculo de "celda más cercana" al punto de
  impacto no considera correctamente el offset de filas alternas, la burbuja podría anclarse
  visualmente superpuesta o en una celda incorrecta. Mitigación: usar coordenadas axiales/offset
  hexagonales estándar para el cálculo de distancia, validado en el paso de verificación manual con
  disparos desde ángulos extremos.
- **Rebote en paredes con ángulo mal calculado**: un cálculo de reflexión incorrecto podría hacer que
  la burbuja "atraviese" la pared o rebote en una dirección inesperada. Mitigación: clamping estricto
  de la posición `x` al límite del área de juego antes de invertir `vx`, evitando que el `dt` de un
  frame lento haga que la burbuja quede fuera del canvas antes de detectarse el rebote.
- **Detección de clusters con conteo incorrecto de adyacencia hexagonal**: si la función de vecinos
  no contempla correctamente el desplazamiento de filas pares/impares, un cluster real podría no
  detectarse (o detectarse de más). Mitigación: una función de vecinos hexagonales única y probada
  aisladamente antes de integrarla al ciclo de resolución.
- **Cascada de burbujas flotantes con doble conteo de puntaje**: si la detección de burbujas
  desconectadas del techo se ejecuta más de una vez por resolución, el mismo grupo de burbujas
  caídas podría sumar puntos de más. Mitigación: ejecutar la detección de desconexión exactamente una
  vez por resolución de cluster, marcando las burbujas ya evaluadas.
- **Condición de carrera entre "nivel completado" y "línea de peligro alcanzada" en el mismo frame**:
  si el grid queda vacío en el mismo instante en que una fila recién generada por el descenso del
  techo ya alcanzaba la línea de peligro, el orden de evaluación podría disparar tanto la lógica de
  nivel completado como la de vida perdida, dejando el estado interno inconsistente. Mitigación:
  evaluar primero si el grid quedó completamente vacío (nivel completado tiene prioridad) antes de
  evaluar la posición de las burbujas restantes respecto a la línea de peligro.
- **Desincronización entre animaciones concurrentes (vuelo de burbuja, pop, caída, descenso de
  techo) y el `dt` del loop**: si el `progress`/posición de cada animación no se actualiza con un
  `dt` cappeado, la velocidad dependería del framerate real del dispositivo. Mitigación: mismo patrón
  de `dt` cappeado ya usado en Asteroids/Snake/Frogger/Match Three.
- **Fugas de memoria por listeners de teclado no limpiados en `destroy()`**, mismo riesgo ya
  documentado en Asteroids/Tetris/Arkanoid/Snake/Frogger/Match Three — si `destroy()` no remueve
  correctamente los listeners de `keydown` (incluyendo `P`/`Escape`), reiniciar varias veces o
  navegar entre `/game/puzzle-bobble/play` y otras rutas podría acumular listeners duplicados.
- **Doble invocación de `onGameOver`**: mismo riesgo ya documentado en specs anteriores — si la
  transición de vidas no queda debidamente encapsulada con una bandera interna (`gameOverFired`),
  una condición de carrera entre el descenso del techo y la detección de línea de peligro podría
  disparar `onLivesChange(0)`/`onGameOver` más de una vez.
- **Teclas de flecha y `Espacio` con comportamiento por defecto del navegador**: por defecto, las
  flechas pueden hacer scroll de la página y `Espacio` puede activar el último elemento enfocado si
  el foco no está en el canvas. Mitigación: el engine debe llamar `preventDefault()` en los listeners
  de teclado relevantes, igual que en los motores anteriores.
- **Costo de dibujo por frame por el mayor detalle visual**: redibujar facetas, brillos y guías de
  trayectoria con varias primitivas por burbuja, en vez de un círculo por celda, aumenta el trabajo
  del loop de canvas; con el grid lleno más animaciones de caída/descenso podría degradar el
  framerate. Mitigación: los cachés offscreen de las paredes y de los 4 sprites de burbuja descritos
  en el Modelo de datos, evitando recomponer primitivas costosas cada frame.
- **Contraste/legibilidad entre tipos de burbuja**: con el grid lleno, una combinación de
  color+faceta mal elegida podría confundirse a primera vista, especialmente con la burbuja en
  vuelo en movimiento rápido. Mitigación: mantener facetas claramente distintas por tipo y verificar
  legibilidad durante el paso de verificación manual con el grid completamente lleno.
- **Tamaño fijo de canvas (480×640) en un layout responsive**: mismo riesgo ya documentado y
  aceptado como pendiente en specs 05/07/08/09, Frogger y Match Three.
- **RLS no definido** en `games`/`scores` — mismo pendiente ya documentado y aceptado en specs
  05/06/07/08/09, Frogger y Match Three.
