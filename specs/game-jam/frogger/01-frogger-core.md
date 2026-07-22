# Integración de Frogger — variante core (motor + leaderboard)

**Estado:** Borrador
**Depende de:** 04-integracion-supabase (clientes de Supabase); consume la capa ya generalizada
por 07-tetris-motor-leaderboard (`getGames`/`getGame`/`getScores`/`getStats`/`saveScore`,
`GAME_ENGINES`) sin volver a generalizar nada.
**Alternativa a:** `specs/game-jam/frogger/02-frogger-niveles.md` — mismo `id`, distinto alcance;
son mutuamente excluyentes, se implementa solo uno.
**Fecha:** 2026-07-21
**Objetivo:** Construir desde cero el motor mínimo de Frogger (cruzar carretera y río hasta la
meta, una sola vida, sin niveles) dentro de un `<canvas>` en `/game/frogger/play`, notificando a
React los cambios de puntaje, y persistir sus puntuaciones vía la capa de datos genérica ya
existente.

## Alcance

**Dentro del alcance:**

- **Nueva fila semilla en la tabla `games` de Supabase** (vía `apply_migration`, mismo esquema ya
  existente de `games`/`scores`, sin cambios de columnas): `id: "frogger"`, `title: "FROGGER"`,
  `cat: "ARCADE"`, `cover: "cover-rana"`, `color: "green"`. Se suma a las filas ya existentes
  (`asteroids`, `tetris`, `arkanoid`, `snake`).
- **Sin assets gráficos externos**: el sapo, los troncos, las tortugas, los vehículos y las
  franjas de césped/agua/meta se dibujan con primitivas de canvas (rectángulos y círculos), usando
  la paleta de colores neón ya definida en `globals.css` (variables `--cyan`/`--green`/
  `--yellow`/`--magenta`) — mismo criterio que Tetris/Arkanoid dibujando sus piezas/bloques sin
  sprites, sin necesidad de copiar nada a `public/assets/`.
- **Motor construido desde cero** (sin `game.js` de referencia, igual que Snake) en
  `app/game-engines/frogger/engine.ts`, exponiendo `createGame(canvas, callbacks)` con
  `pause()`/`resume()`/`destroy()`, mismo patrón que `asteroids`/`tetris`/`arkanoid`/`snake`.
  Incluye:
  - Canvas de 560×520, grilla lógica de 14 columnas × 13 filas (celdas de 40px).
  - Distribución de filas (de arriba hacia abajo): fila 0 = meta (5 huecos de "lily pad" en las
    columnas 1, 4, 7, 10 y 13; el resto de la fila es agua, letal); filas 1–5 = río (5 carriles con
    troncos, cada carril con velocidad y sentido propios, alternando dirección entre carriles
    adyacentes, con reaparición en bucle por el borde opuesto); fila 6 = franja mediana segura
    (césped, sin peligro); filas 7–11 = carretera (5 carriles con vehículos, misma lógica de
    velocidad/sentido/bucle que el río); fila 12 = franja de salida segura (césped), punto de
    aparición del sapo.
  - **Movimiento por salto discreto**: cada pulsación de `←`/`→`/`↑`/`↓` o `WASD` mueve al sapo
    exactamente una celda en esa dirección (sin movimiento continuo tipo Snake); los eventos de
    tecla repetidos por mantener presionada la tecla (`event.repeat === true`) se ignoran, para que
    un salto corresponda exactamente a una pulsación real.
  - **Arrastre sobre troncos**: mientras el sapo está sobre un tronco en una fila de río, adopta la
    velocidad horizontal de ese tronco en cada frame, desplazándose junto con él; si el tronco lo
    arrastra fuera de los límites horizontales de la grilla, el sapo muere.
  - **Colisión letal**: pisar una fila de carretera en la posición de un vehículo, caer al agua de
    una fila de río sin un tronco debajo, ser arrastrado fuera de la grilla por un tronco, o
    aterrizar en la fila de meta fuera de uno de los 5 huecos válidos, termina la partida de
    inmediato.
  - **Puntuación por avance**: se lleva un registro interno de la fila más cercana a la meta
    alcanzada en el intento actual (arranca en la fila 12, se reinicia cada vez que el sapo llega a
    la meta o muere). Cada vez que el sapo alcanza una fila nueva más cercana a la meta que su
    récord del intento, suma **10 puntos**; retroceder o moverse lateralmente no suma ni resta
    puntos. Aterrizar en un hueco válido de la fila de meta suma **50 puntos** adicionales, y el
    sapo reaparece de inmediato en la fila de salida para cruzar de nuevo — sin límite de cruces,
    el juego es indefinidamente rejugable hasta la primera muerte.
  - **Sin marcaje de huecos de meta ocupados**: a diferencia de la variante con niveles, en esta
    variante cualquiera de los 5 huecos acepta al sapo en cualquier cruce (no hay condición de
    "llenar los 5" ni de ronda completa) — ver Fuera de alcance.
- **Vida única**: `onLivesChange(1)` se invoca al iniciar la partida; `onLivesChange(0)` se invoca
  en el instante de la colisión letal, inmediatamente seguido de `onGameOver(finalScore)`. No hay
  sistema de vidas múltiples ni reaparición tras morir (mismo patrón que Snake).
- **Sin progresión de niveles**: `onLevelChange(1)` se invoca una única vez al iniciar la partida y
  nunca vuelve a invocarse — la velocidad de troncos y vehículos permanece constante durante toda
  la partida. Se decide explícitamente omitir niveles en esta variante (ver Fuera de alcance).
- **Pausa real con doble camino**: el botón "PAUSA" del HUD de React llama `pause()`/`resume()`;
  las teclas `P`/`Escape` capturadas por el engine hacen lo mismo internamente (mismo patrón que
  Arkanoid/Snake). Ambos caminos detienen/reanudan el loop de animación real (posiciones de
  troncos/vehículos/sapo) y confirman el nuevo estado vía `onPauseChange(isPaused)`.
- **Callbacks conectados**: `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`,
  `onLevelChange` — los cinco ya son consumidos genéricamente por `GamePlayClient.tsx`, sin
  necesidad de tocar ese archivo (en esta variante, `onLevelChange` solo se invoca una vez).
- **Montaje genérico**: se agrega la entrada `frogger: { createGame, width: 560, height: 520 }` a
  `app/game-engines/registry.ts` (`GAME_ENGINES`). No se toca `app/game/[id]/play/page.tsx` ni
  `GamePlayClient.tsx` — ya resuelven cualquier `id` registrado sin condicionales.
- **Consumo de la capa de datos ya generalizada**: `/game/frogger`, el guardado de puntuación en
  `/game/frogger/play` y la pestaña "FROGGER" en `/hall-of-fame` funcionan automáticamente en
  cuanto la fila `"frogger"` existe en `games` y el registro de motores tiene su entrada —
  `getGame`/`getGames`/`getScores`/`getStats`/`saveScore` y las páginas que los consumen ya son
  genéricas por `gameId` desde el spec 07, sin cambios propios en esta variante.

**Fuera de alcance (para otros specs):**

- **Vidas múltiples, huecos de meta que se marcan como ocupados, ronda completa (llenar los 5
  huecos), temporizador por intento, tortugas que se sumergen, bonus de vida extra por puntaje y
  progresión de niveles/velocidad** — todo este eje de profundidad se deja para la variante con
  niveles de este mismo juego, ver `specs/game-jam/frogger/02-frogger-niveles.md`. Esta variante
  `core` es deliberadamente la versión de una sola vida, sin niveles y sin condición de "ronda
  completa".
- Soporte táctil/móvil (solo teclado).
- Sonido (no se proveyeron ni se diseñan assets de audio en esta variante).
- Políticas RLS en `games`/`scores` — mismo pendiente ya documentado en specs 05/06/07/08/09.
- Supabase Auth real / relación de `scores.user_id` con un usuario autenticado.
- Cambios visuales en `Podium.tsx`/`Leaderboard.tsx`/`GameCard.tsx`/`MiniCard`.
- Adaptar cualquier otro juego de `references/started-games/` — este spec cubre únicamente esta
  variante de Frogger.
- Diseño de un cover/gradiente nuevo — se reutiliza `cover-rana`, ya existente en `globals.css`
  (usada originalmente por la entrada mock "ranaria", nunca sembrada en Supabase).
- Ajustes de responsive/CSS del contenedor `crt`/`crt-screen` para encajar un quinto tamaño de
  canvas — mismo pendiente ya anotado en specs 05/07/08/09.

## Modelo de datos

- **`app/game-engines/frogger/engine.ts`** — módulo nuevo, sin estado global de módulo (grilla,
  posición del sapo, troncos, vehículos, récord de fila del intento actual, score, estado de pausa
  y listeners quedan encapsulados dentro del closure de `createGame`):

  ```ts
  export interface FroggerCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void; // solo emite 1 (inicio) y 0 (game over) — una sola vida
    onGameOver: (finalScore: number) => void;
    onPauseChange: (isPaused: boolean) => void;
    onLevelChange: (level: number) => void; // solo emite 1 al iniciar; sin progresión de niveles
  }

  export interface FroggerGame {
    pause: () => void;
    resume: () => void;
    destroy: () => void;
  }

  export function createGame(
    canvas: HTMLCanvasElement,
    callbacks: FroggerCallbacks,
  ): FroggerGame;
  ```

  Internamente conserva, como estructuras encapsuladas: la grilla lógica (14×13, celdas de 40px
  sobre canvas de 560×520), las 5 filas de río (troncos con velocidad/sentido propios) y las 5
  filas de carretera (vehículos con velocidad/sentido propios), ambas con reaparición en bucle por
  el borde opuesto; la posición del sapo (fila/columna lógica más un desplazamiento horizontal
  continuo mientras va sobre un tronco); el récord de fila del intento actual para la puntuación
  por avance; el loop de animación (`requestAnimationFrame` con `dt` cappeado) que mueve
  troncos/vehículos y detecta colisiones cada frame; y los listeners de teclado (`←`/`→`/`↑`/`↓`,
  `WASD` para saltos discretos, `P`/`Escape` para pausa).

  - `onScoreChange` se invoca en cada salto que alcanza una fila nueva más cercana a la meta
    (`score += 10`) y al aterrizar en un hueco válido de meta (`score += 50`).
  - `onLivesChange` se invoca exactamente dos veces por partida: `1` al iniciar (`createGame`), `0`
    en el instante de la colisión letal.
  - `onGameOver` se invoca una única vez por partida, inmediatamente después de `onLivesChange(0)`,
    con el `score` final acumulado.
  - `onLevelChange` se invoca una única vez, al iniciar (`level = 1`), y nunca vuelve a invocarse.
  - `onPauseChange` se invoca al confirmar cada cambio de estado de pausa, sin importar si lo
    inició `pause()`/`resume()` (React) o las teclas `P`/`Escape` (engine).

- **Fila semilla en `games`** (SQL de la migración, mismo esquema ya existente de `games`/`scores`,
  sin cambios de columnas):

  ```sql
  insert into games (id, title, short, long, cat, cover, color) values (
    'frogger', 'FROGGER',
    'Cruza la calle y el río sin perder el pellejo.',
    'Guía a tu sapo desde la orilla segura, esquivando el tráfico y saltando sobre troncos en el río, hasta alcanzar uno de los huecos de meta al otro lado. Un despiste contra un vehículo, el agua o el borde del mapa termina la partida.',
    'ARCADE', 'cover-rana', 'green'
  );
  ```

- **`app/game-engines/registry.ts`**: se agrega la entrada
  `frogger: { createGame: froggerCreateGame, width: 560, height: 520 }` a `GAME_ENGINES`, con su
  import correspondiente (`import { createGame as froggerCreateGame } from './frogger/engine'`).
  No se agregan tipos nuevos — reutiliza `EngineCallbacks`/`EngineInstance` ya existentes en ese
  archivo.

- `app/lib/supabase/queries.ts`/`actions.ts` no cambian de firma: `getGames`/`getGame`/
  `getScores`/`getStats`/`saveScore` ya son genéricas por `gameId` desde el spec 07; esta variante
  solo las consume.

## Plan de implementación

1. **Crear la migración de Supabase** (vía MCP `apply_migration`) que inserta la fila semilla de
   `"frogger"` en `games`, usando el esquema ya existente (sin alterar columnas de
   `games`/`scores`). El sistema queda funcional: la fila existe en Supabase, pero ninguna ruta la
   usa todavía (`/game/frogger` da 404 porque `GAME_ENGINES` aún no tiene la clave `"frogger"`).
2. **Crear `app/game-engines/frogger/engine.ts` — grilla y dibujo estático**: `createGame(canvas,
callbacks)` que inicializa la grilla 14×13 (celdas de 40px sobre canvas 560×520), dibuja las
   franjas de meta/río/mediana/carretera/salida y coloca al sapo en su celda de salida. El sistema
   queda funcional: el módulo compila, es importable, y el tablero estático se renderiza
   correctamente de forma aislada.
3. **Agregar troncos y vehículos en movimiento** — 5 carriles de río con troncos y 5 carriles de
   carretera con vehículos, cada carril con velocidad/sentido propio y reaparición en bucle por el
   borde opuesto, animados vía `requestAnimationFrame` con `dt` cappeado. El sistema queda
   funcional: el tablero se ve vivo (troncos y vehículos desplazándose) de forma aislada, aunque el
   sapo todavía no reacciona a ellos.
4. **Conectar el movimiento del sapo y las colisiones** — capturar `←`/`→`/`↑`/`↓`/`WASD` para
   saltos discretos de una celda (ignorando `event.repeat`), arrastrar al sapo con la velocidad
   horizontal del tronco cuando está sobre uno, y detectar las cuatro condiciones de muerte
   (vehículo, agua sin tronco, arrastre fuera de la grilla, meta fuera de un hueco válido). El
   sistema queda funcional: el juego es jugable con teclado de forma aislada, aunque todavía no
   notifique nada a React.
5. **Conectar la puntuación por avance y el ciclo de cruce** — llevar el registro de la fila más
   alta alcanzada en el intento actual, sumar 10 puntos por cada fila nueva, sumar 50 puntos y
   reaparecer al sapo en la fila de salida al llegar a un hueco de meta válido, reiniciando el
   récord del intento. El sistema queda funcional: el ciclo completo de cruce y puntuación
   funciona de forma aislada.
6. **Conectar los callbacks `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver`** —
   invocar `onLivesChange(1)` y `onLevelChange(1)` al iniciar; `onScoreChange(score)` en cada
   avance/llegada a meta; y en el instante de colisión letal, `onLivesChange(0)` seguido de
   `onGameOver(finalScore)`, deteniendo el loop de animación. El sistema queda funcional: el engine
   notifica todos los cambios de estado relevantes, aunque aún no haya un consumidor en React.
7. **Implementar `pause()`/`resume()`/`destroy()`** — controlando el loop de animación real
   (detener/reanudar troncos, vehículos y el sapo), agregando además los listeners de teclado
   `P`/`Escape` que llaman internamente a la misma lógica de pausa/reanudación, invocando
   `onPauseChange(true)`/`onPauseChange(false)` en ambos caminos. `destroy()` detiene el loop y
   remueve todos los listeners de teclado agregados por `createGame`. El sistema queda funcional:
   la API pública del engine está completa y probada de forma aislada.
8. **Registrar el motor en `app/game-engines/registry.ts`** — agregar el import
   `froggerCreateGame` y la entrada `frogger: { createGame: froggerCreateGame, width: 560, height:
520 }` a `GAME_ENGINES`. El sistema queda funcional de punta a punta: `/game/frogger` y
   `/game/frogger/play` dejan de dar 404, el juego es jugable completo desde la UI real (HUD de
   React conectado, pausa, fin de juego), y el guardado de puntuación, el detalle del juego y la
   pestaña "FROGGER" del salón de la fama funcionan automáticamente vía la capa de datos ya
   generalizada.
9. **Verificación manual y build** — jugar una partida completa en `/game/frogger/play`
   confirmando: saltos discretos con flechas y WASD, arrastre correcto sobre troncos, muerte por
   vehículo/agua/arrastre fuera de grilla/meta inválida, puntuación por avance y por llegada a
   meta, cruces repetidos indefinidos, pausa real con botón y con `P`/`Escape`, fin de juego
   automático al morir, guardado de puntuación real, y que la puntuación aparece en `/game/frogger`
   y en la pestaña "FROGGER" de `/hall-of-fame` tras recargar. Confirmar que el resto del catálogo
   no tiene regresiones. Ejecutar `npm run build` sin errores de TypeScript ni de ESLint. El
   sistema queda funcional y verificado de punta a punta.

## Criterios de aceptación

- [ ] La tabla `games` de Supabase contiene una fila `id: "frogger"`, `title: "FROGGER"`,
      `cat: "ARCADE"`, `cover: "cover-rana"`, `color: "green"`, sembrada por la migración.
- [ ] `app/game-engines/frogger/engine.ts` existe, exporta `createGame(canvas, callbacks)` y no
      usa variables globales de módulo (grilla, sapo, troncos, vehículos, score, récord de fila,
      estado de pausa y listeners quedan encapsulados dentro del closure de `createGame`).
- [ ] `FroggerCallbacks` incluye `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`,
      `onLevelChange`, todos obligatorios, compatibles con `EngineCallbacks` de `registry.ts`.
- [ ] En `/game/frogger/play` el juego se renderiza dentro de un `<canvas>` de 560×520 y es jugable
      con teclado: `←`/`→`/`↑`/`↓` y `WASD` mueven al sapo exactamente una celda por pulsación, sin
      saltos duplicados por mantener la tecla presionada.
- [ ] Los 5 carriles de río y los 5 carriles de carretera se animan de forma continua, cada uno con
      su propia velocidad/sentido, reapareciendo en bucle por el borde opuesto.
- [ ] Estar sobre un tronco arrastra al sapo con la velocidad horizontal de ese tronco; ser
      arrastrado fuera de los límites horizontales de la grilla termina la partida.
- [ ] Pisar una fila de carretera en la posición de un vehículo, o caer al agua sin un tronco
      debajo, termina la partida de inmediato.
- [ ] Aterrizar en cualquiera de los 5 huecos de la fila de meta suma 50 puntos y reaparece al sapo
      en la fila de salida; aterrizar en la fila de meta fuera de un hueco válido termina la
      partida.
- [ ] Cada salto que alcanza una fila más cercana a la meta que el récord del intento actual suma
      10 puntos; retroceder o moverse lateralmente no suma ni resta puntos.
- [ ] `onLivesChange` se invoca exactamente con `1` al iniciar la partida y con `0` en el instante
      de la colisión letal, inmediatamente seguido de `onGameOver(finalScore)`.
- [ ] `onLevelChange` se invoca una única vez, con `1`, al iniciar la partida, y nunca vuelve a
      invocarse durante la misma partida.
- [ ] El botón "PAUSA" del HUD de React detiene el loop de animación real (troncos, vehículos y
      sapo dejan de moverse), y "REANUDAR" lo reactiva; las teclas `P`/`Escape` capturadas por el
      engine producen el mismo efecto; ambos caminos confirman el estado vía
      `onPauseChange(isPaused)`.
- [ ] Al llegar a la colisión letal, React muestra automáticamente el modal "FIN DEL JUEGO" con el
      puntaje final recibido vía `onGameOver`.
- [ ] Al presionar "JUGAR DE NUEVO", el engine se destruye y se vuelve a crear desde cero: sapo,
      troncos, vehículos y puntaje (0) quedan en su estado inicial.
- [ ] Salir de la partida (botón "SALIR" o navegación fuera de la página) limpia correctamente el
      engine (`destroy()` se llama en el cleanup del `useEffect`, sin loops ni listeners de teclado
      colgando).
- [ ] `app/game-engines/registry.ts` incluye la entrada `frogger: { createGame, width: 560, height:
    520 }`, sin modificar `app/game/[id]/play/page.tsx` ni `GamePlayClient.tsx`.
- [ ] En `/game/frogger/play`, guardar la puntuación inserta una fila real en `scores`
      (`game_id: "frogger"`) vía `saveScore`, reutilizando la Server Action ya existente sin
      cambios.
- [ ] En `/game/frogger`, el título, descripción, leaderboard lateral, "Mejor global" y "Partidas"
      provienen de Supabase vía `getGame`/`getScores`/`getStats`, sin cambios en esas funciones.
- [ ] En `/hall-of-fame`, la pestaña "FROGGER" muestra las puntuaciones reales de `scores` para
      `game_id: "frogger"`.
- [ ] El resto del catálogo (`asteroids`, `tetris`, `arkanoid`, `snake`) conserva exactamente su
      comportamiento actual, sin regresiones.
- [ ] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Motor construido desde cero**, sin `game.js` de referencia (mismo criterio que Snake), porque
  Frogger no forma parte de `references/started-games/` — toda la mecánica se definió en este spec
  a partir de la descripción del jam ("cruzar la calle y el río esquivando tráfico y troncos hasta
  llegar a la meta").
- **`id: "frogger"` (inglés)**, mismo criterio ya aplicado con rocas→asteroids, caída→tetris y
  serpentina→snake: el nombre en inglés del juego real como id/ruta/carpeta.
- **Una sola vida** (`onLivesChange` solo emite `1` y `0`), en vez de un sistema de vidas múltiples
  como el Frogger clásico (que arranca con 3-5 sapos), porque este spec es deliberadamente la
  variante `core`: la mecánica de vidas múltiples, junto con el sistema de ronda/meta llena, se
  reservó completa para la variante `niveles` (`02-frogger-niveles.md`), para que el eje de
  profundidad de esa variante sea nítido y no esté parcialmente adelantado aquí.
- **Sin progresión de niveles ni temporizador por intento**, a diferencia del Frogger clásico
  (donde completar la meta con los 5 huecos llenos avanza de ronda y acelera el juego), porque esa
  progresión es exactamente el eje de profundidad que define a la variante `niveles` de este mismo
  juego — omitirla aquí es la decisión que da sentido a que existan dos variantes distintas del
  mismo `id`.
- **Huecos de meta reutilizables en cada cruce** (sin marcarse como "ocupados"), en vez de exigir
  llenar los 5 para completar algo, para que el juego `core` sea un loop simple e indefinidamente
  rejugable — cruzar y sumar puntos — sin condición de victoria por ronda, que sí exige la variante
  `niveles`.
- **Puntuación por "récord de fila del intento actual"** (10 pts por fila nueva, no por cada salto
  repetido), en vez de sumar puntos por cualquier salto hacia adelante sin deduplicar, para evitar
  que retroceder y volver a avanzar sobre la misma fila permita acumular puntos de forma trivial —
  mismo criterio de puntuación "limpia" que ya se aplicó en Snake (10 pts fijos por fruta, sin
  farmeo).
- **Sin assets gráficos externos**: el sapo, los troncos, los vehículos y las franjas del tablero
  se dibujan con primitivas de canvas y la paleta de colores neón ya existente, en vez de diseñar o
  conseguir sprites nuevos — mismo criterio de "cero assets nuevos" que Tetris/Arkanoid aplicaron a
  sus piezas/bloques, evitando trabajo de diseño gráfico fuera de alcance de este spec.
- **Reutilización de `cover-rana` y `color: "green"`**, clase CSS ya existente en `globals.css`
  (heredada de la entrada mock "ranaria", nunca sembrada en Supabase), en vez de diseñar un cover
  nuevo — mismo criterio de reutilización visual que asteroids (`cover-rocas`), tetris
  (`cover-tetro`) y arkanoid (`cover-bricks`).
- **Movimiento por salto discreto por pulsación** (ignorando `event.repeat`), en vez de movimiento
  continuo por tick como Snake, porque Frogger clásico es un juego de saltos exactos entre celdas,
  no de desplazamiento fluido — cada pulsación real de tecla corresponde a exactamente un salto.
- **Controles duales `←`/`→`/`↑`/`↓` + `WASD`**, mismo criterio ya aplicado en Snake, para cubrir
  ambos esquemas desde el inicio al no haber un original que defina un único esquema.
- **Pausa dual con tecla `P`/`Escape` además del botón de React**, igual que el patrón ya
  establecido en Arkanoid/Snake.
- **Canvas 560×520 con grilla 14×13 (celdas de 40px)**, un tamaño y proporción propios de Frogger
  (más alto que ancho, acorde a su tablero clásico de franjas horizontales), distinto de los ya
  usados por Asteroids/Arkanoid (800×600), Tetris (480×600) y Snake (600×600).
- **Consumo directo de la capa de Supabase ya generalizada** (`getGames`/`getGame`/`getScores`/
  `getStats`/`saveScore`, `GAME_ENGINES`), sin volver a generalizarla ni duplicarla — mismo
  criterio ya aplicado por los specs 08/09 al consumir lo que generalizó el spec 07.

## Riesgos identificados

- **Saltos duplicados por repetición de tecla del sistema operativo**: si el listener de teclado no
  filtra `event.repeat`, mantener presionada una tecla generaría múltiples saltos por una sola
  pulsación intencional, rompiendo la naturaleza de "un salto por pulsación" del juego. Mitigación:
  ignorar explícitamente los eventos `keydown` con `event.repeat === true`.
- **Desincronización entre el arrastre del tronco y el framerate de render**: si la velocidad
  horizontal de troncos/vehículos no se aplica con un `dt` cappeado, el juego correría distinto
  según el dispositivo. Mitigación: mismo patrón de `dt` cappeado ya usado en Asteroids/Snake.
  Frame — mismo riesgo ya documentado en Asteroids/Snake al recuperar el foco de una pestaña en
  segundo plano.
- **Colisión de arrastre mal detectada en el borde de la grilla**: si el chequeo de "arrastrado
  fuera de la grilla" usa la posición lógica de la celda en vez de la posición continua real del
  sapo mientras va sobre el tronco, podría no detectar la muerte a tiempo o detectarla de forma
  prematura mientras el sapo todavía es visualmente válido. Mitigación: el chequeo debe usar la
  posición horizontal continua real del sapo (no solo su columna redondeada) contra los límites del
  canvas.
- **Fuga de puntos por el registro de "récord de fila del intento"**: si el récord no se reinicia
  correctamente al llegar a la meta o al morir, el jugador podría arrastrar un récord alto de un
  intento anterior y no recibir puntos por avances legítimos en el siguiente intento (o, en el caso
  inverso, seguir sumando puntos indebidamente). Mitigación: reiniciar explícitamente el récord de
  fila tanto al reaparecer tras llegar a la meta como al iniciar la partida.
- **Fugas de memoria por listeners de teclado no limpiados en `destroy()`**, mismo riesgo ya
  documentado en Asteroids/Tetris/Arkanoid/Snake — si `destroy()` no remueve correctamente los
  listeners de `keydown` (incluyendo `P`/`Escape`), reiniciar varias veces o navegar entre
  `/game/frogger/play` y otras rutas podría acumular listeners duplicados.
- **Doble invocación de `onGameOver`**: mismo riesgo ya documentado en specs anteriores — si la
  detección de colisión no queda debidamente encapsulada con una bandera interna (`gameOverFired`),
  una condición de carrera (p. ej. morir por vehículo y por agua en el mismo frame) podría disparar
  `onLivesChange(0)`/`onGameOver` más de una vez.
- **Teclas de flecha con comportamiento por defecto del navegador**: por defecto, las flechas
  pueden hacer scroll de la página si el foco no está en el canvas. Mitigación: el engine debe
  llamar `preventDefault()` en los listeners de teclado relevantes, igual que en los motores
  anteriores.
- **Tamaño fijo de canvas (560×520) en un layout responsive**: mismo riesgo ya documentado y
  aceptado como pendiente en specs 05/07/08/09 — el resto de la UI es fluida, un canvas de tamaño
  fijo podría desbordar en pantallas angostas.
- **RLS no definido** en `games`/`scores` — mismo pendiente ya documentado y aceptado en specs
  05/06/07/08/09.
