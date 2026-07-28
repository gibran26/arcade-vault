# Integración de Neon Beats — variante core (motor + leaderboard)

**Estado:** Borrador
**Depende de:** 04-integracion-supabase (clientes de Supabase); consume la capa ya generalizada
por 07-tetris-motor-leaderboard (`getGames`/`getGame`/`getScores`/`getStats`/`saveScore`,
`GAME_ENGINES`) sin volver a generalizar nada.
**Alternativa a:** `specs/game-jam/neon-beats/02-neon-beats-powerups-acordes.md` — mismo `id`,
distinto alcance; son mutuamente excluyentes, se implementa solo uno.
**Fecha:** 2026-07-28
**Objetivo:** Construir desde cero el motor mínimo de Neon Beats (4 carriles de notas cayendo
sincronizadas a un reloj de BPM interno, 3 vidas, rondas con dificultad creciente) dentro de un
`<canvas>` en `/game/neon-beats/play`, dibujado con gráficos procedurales detallados y animadas al
pulso, notificando a React los cambios de puntaje, vidas y nivel, y persistir sus puntuaciones vía
la capa de datos genérica ya existente.

## Alcance

**Dentro del alcance:**

- **Extender `GameCategory`/`CATS`** en `app/data/types.ts` con la categoría nueva `'RHYTHM'`
  (`export type GameCategory = 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS' | 'RHYTHM';` y agregar
  `'RHYTHM'` al arreglo `CATS`). Es la primera categoría nueva del catálogo — no hay ningún juego
  de ritmo hoy. No se tocan `GamesClient.tsx` ni `Nav.tsx`: el filtro de categorías ya itera
  `CATS` genéricamente, sin lista de categorías cableada aparte de esa constante.
- **Nueva fila semilla en la tabla `games` de Supabase** (vía `apply_migration`, mismo esquema ya
  existente de `games`/`scores`, sin cambios de columnas): `id: "neon-beats"`,
  `title: "NEON BEATS"`, `cat: "RHYTHM"`, `cover: "cover-neon-beats"`, `color: "magenta"`. Es la
  misma fila semilla que definiría la variante `powerups-acordes` — son alternativas del mismo
  `id`, no coexisten.
- **Sin assets gráficos ni de audio externos**: todo el detalle visual (carriles, notas, anillo de
  pulso, receptores) se dibuja con primitivas de canvas (rectángulos, círculos, polígonos y
  gradientes), usando la paleta de colores neón ya definida en `globals.css` (variables
  `--cyan`/`--green`/`--yellow`/`--magenta`), un color fijo por carril — mismo criterio que
  Tetris/Arkanoid/Frogger dibujando sin sprites.
- **Sin reproducción de audio real**: Neon Beats no reproduce ningún archivo de sonido ni usa la
  Web Audio API para sintetizar tonos — la prohibición de assets de audio y de "sonido" ya es la
  norma del resto del catálogo construido desde cero (Snake, Frogger) y una regla dura de este jam.
  El "ritmo" del juego se resuelve **enteramente de forma visual**: un reloj interno de BPM
  (`songTimeMs`, acumulador de `dt` independiente del framerate) programa el instante exacto
  (`hitTime`) en el que cada nota debe presionarse, y un **anillo de pulso** dibujado en el canvas
  (ver bloque de gráficos/animación) es el metrónomo visible que reemplaza al audible. Ver
  "Decisiones tomadas y descartadas" para el razonamiento completo de esta resolución.
- **Motor construido desde cero** (sin `game.js` de referencia, igual que Snake/Frogger) en
  `app/game-engines/neon-beats/engine.ts`, exponiendo `createGame(canvas, callbacks)` con
  `pause()`/`resume()`/`destroy()`, mismo patrón que `asteroids`/`tetris`/`arkanoid`/`snake`/
  `frogger`. Incluye:
  - Canvas de 480×640, 4 carriles verticales de 120px de ancho cada uno (`x` 0–120, 120–240,
    240–360, 360–480), colores fijos por carril: carril 0 = cian, carril 1 = magenta, carril 2 =
    amarillo, carril 3 = verde (los 4 colores neón de `globals.css`, uno por carril, sin necesidad
    de ampliar la paleta).
  - **Zona de golpe**: una barra horizontal centrada en `y = 560` (alto 28px, de `y = 546` a
    `y = 574`), fija durante toda la partida.
  - **Reloj de BPM**: `songTimeMs` es un acumulador interno que avanza con el `dt` cappeado de cada
    frame (nunca con `Date.now()` directo, para no arrastrar el tiempo transcurrido durante una
    pausa o una pestaña en segundo plano). BPM inicial: 120 (`beatIntervalMs = 500`). El índice de
    beat actual es `Math.floor(songTimeMs / beatIntervalMs)`.
  - **Generación procedural del chart**: un generador con PRNG semillado por nivel programa notas
    con antelación (ventana rodante de ~4 segundos hacia adelante) sobre una subdivisión de beat
    que crece con el nivel — nivel 1–2: solo negras (1 slot por beat, ~55% de probabilidad por
    carril-beat); nivel 3–4: se habilitan corcheas (2 slots por beat, ~35% de probabilidad por
    slot); nivel 5+: la probabilidad sube gradualmente, con un tope razonable para no saturar el
    tablero. **Nunca dos carriles comparten el mismo `hitTime`** en esta variante (sin acordes, ver
    Fuera de alcance) y nunca hay más de 3 notas consecutivas en el mismo carril, para mantener el
    patrón legible.
  - **Caída de nota**: cada nota nace en `y = -40` del carril asignado y viaja a velocidad
    constante (`300px/s` en nivel 1, derivada de un tiempo de anticipación base de 2000ms entre el
    spawn y el `hitTime`) hasta la zona de golpe; la velocidad sube junto con el BPM en cada ronda
    (ver progresión de nivel).
  - **Entrada del jugador**: cada carril se controla con dos esquemas simultáneos — flechas
    (`←`=carril 0, `↓`=carril 1, `↑`=carril 2, `→`=carril 3) y teclas de ritmo clásicas
    (`D`=carril 0, `F`=carril 1, `J`=carril 2, `K`=carril 3), indistintamente. Los eventos
    `keydown` con `event.repeat === true` se ignoran (un `keydown` real por pulsación, sin repetir
    al mantener presionada la tecla).
  - **Ventanas de juicio**: al presionar la tecla de un carril, se busca la nota pendiente más
    cercana de ese carril dentro de la ventana permitida respecto a `songTimeMs`: **Perfecto**
    (±60ms del `hitTime`, 100 puntos base), **Bien** (±140ms, 50 puntos base), fuera de esas
    ventanas no hay nota que juzgar. Una nota que cruza `y` más allá de la zona de golpe sin haber
    sido presionada dentro de la ventana "Bien" se marca **Fallo** automáticamente (0 puntos).
  - **Pulsación sin nota disponible**: presionar un carril sin ninguna nota dentro de su ventana de
    juicio no resta vida, pero reinicia el combo a 0 (para desalentar presionar teclas al azar sin
    penalizar tan duro como un Fallo real).
  - **Combo y multiplicador**: cada acierto (Perfecto o Bien) incrementa el combo en 1; un Fallo o
    una pulsación vacía lo reinicia a 0. El multiplicador de puntaje es
    `1 + Math.floor(combo / 10)`, con un tope de `×5`. El puntaje otorgado por cada acierto es
    `puntosBase(tier) * multiplicador`.
  - **Vidas**: la partida arranca con 3 vidas. Cada **Fallo** (nota no presionada a tiempo) resta
    una vida. Al llegar a 0 vidas, la partida termina de inmediato.
  - **Rondas y progresión de dificultad**: una ronda dura 32 beats. Al completar los 32 beats de la
    ronda actual (sin importar cuántos aciertos/fallos hubo, mientras queden vidas), la ronda
    termina: suma **300 puntos** de bonificación, sube el nivel en 1 (`onLevelChange`), el BPM sube
    ~8% (`bpm *= 1.08`, con un tope razonable — ver Riesgos), la velocidad de caída de las notas
    nuevas escala junto con el BPM, y la densidad/subdivisión del chart aumenta según lo descrito
    arriba, sin límite superior de rondas.
- **Callbacks conectados**: `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`,
  `onLevelChange` — los cinco ya son consumidos genéricamente por `GamePlayClient.tsx`, sin
  necesidad de tocar ese archivo.
- **Pausa real con doble camino**: el botón "PAUSA" del HUD de React llama `pause()`/`resume()`;
  las teclas `P`/`Escape` capturadas por el engine hacen lo mismo internamente. Ambos caminos
  congelan por completo el acumulador `songTimeMs` (ninguna nota se mueve, el anillo de pulso deja
  de latir, ninguna ventana de juicio se evalúa) y confirman el nuevo estado vía
  `onPauseChange(isPaused)`. Al reanudar, el acumulador continúa desde donde quedó — el tiempo
  transcurrido durante la pausa nunca se suma a `songTimeMs`.
- **Montaje genérico**: se agrega la entrada `'neon-beats': { createGame, width: 480, height: 640 }`
  a `app/game-engines/registry.ts` (`GAME_ENGINES`). No se toca `app/game/[id]/play/page.tsx` ni
  `GamePlayClient.tsx` — ya resuelven cualquier `id` registrado sin condicionales.
- **Consumo de la capa de datos ya generalizada**: `/game/neon-beats`, el guardado de puntuación en
  `/game/neon-beats/play` y la pestaña "NEON BEATS" en `/hall-of-fame` funcionan automáticamente en
  cuanto la fila `"neon-beats"` existe en `games` y el registro de motores tiene su entrada —
  `getGame`/`getGames`/`getScores`/`getStats`/`saveScore` y las páginas que los consumen ya son
  genéricas por `gameId` desde el spec 07, sin cambios propios en esta variante.

- **Gráficos y animación (elemento por elemento)**:
  - **Carril (fondo de cada uno de los 4 carriles)**: franja vertical con gradiente oscuro teñido
    al color del carril (baja opacidad), una textura de líneas de "scanline" horizontales finas que
    se desplazan verticalmente en bucle continuo (sugieren flujo de energía), y un borde lateral con
    resplandor sutil del color del carril. Cada carril desplaza sus scanlines a una velocidad
    ligeramente distinta (±5% entre carriles) para que el movimiento no se vea idéntico ni
    mecánicamente sincronizado entre los 4. Esta franja (gradiente + bordes) se precalcula una sola
    vez en un `<canvas>` offscreen por carril; solo el offset de scanline se recalcula por frame al
    volcar la textura cacheada con un desplazamiento vertical, sin redibujar el gradiente completo.
  - **Nota (por carril)**: combina un anillo exterior de resplandor (glow radial, cacheado
    offscreen con el color del carril), un cuerpo de "gema" romboidal (cuadrado rotado 45°) con una
    faceta más clara (triángulo pequeño superpuesto) que sugiere un corte de piedra preciosa, y un
    núcleo circular interior que pulsa suavemente de tamaño. Nunca es un círculo o cuadrado de color
    plano. Cada nota gira lentamente sobre su propio eje mientras cae (ciclo de idle en bucle), con
    una fase de rotación inicial aleatoria por nota para que varias notas en pantalla no giren
    sincronizadas. Al entrar en la "zona de peligro" (los últimos ~150ms antes del límite de la
    ventana "Bien", si todavía no fue presionada) la nota **parpadea** en opacidad de forma
    perceptible (telegrafiado de fallo inminente, nunca un cambio de color instantáneo). Al ser
    acertada, la gema anima un **squash & stretch** de impacto: escala a ~1.3× en un instante y
    luego colapsa a 0 mientras emite una ráfaga de partículas pequeñas (pool fijo de 24 partículas
    reutilizadas en todo el motor, nunca un sistema de partículas sin límite) del color del carril.
  - **Receptor / barra de zona de golpe**: 4 anillos receptores (uno por carril, coloreados según
    su carril) conectados por una franja de resplandor horizontal. Cada anillo respira con un
    pulso de escala sutil sincronizado exactamente al beat del reloj interno — es intencional que
    este pulso **sí** esté sincronizado entre los 4 carriles (a diferencia del resto de ciclos
    decorativos): es el metrónomo visual del juego, no un detalle ambiental (ver Decisiones). Al
    acertar una nota en su carril, el anillo correspondiente anima un squash horizontal breve más
    un destello de brillo (feedback de impacto); al fallar una nota de su carril, el anillo
    parpadea en rojo brevemente.
  - **Anillo de pulso (metrónomo visual)**: un anillo grande centrado en la parte superior del
    canvas que se expande bruscamente en cada beat (anticipación) y luego se contrae suavemente
    con easing durante el resto del intervalo del beat, con marcas de subdivisión (puntos
    pequeños alrededor del anillo) que se iluminan en las corcheas cuando esa subdivisión está
    activa (nivel 3+). Es el elemento que reemplaza a la música real: el jugador sincroniza sus
    pulsaciones observándolo.
  - **Racha de combo**: un pequeño ícono de llama/chispa dibujado junto a la barra de progreso de
    ronda que crece de tamaño con una transición de easing cada vez que el combo cruza un múltiplo
    de 10 (umbral de multiplicador), y tiembla/parpadea sutilmente en su ciclo de idle; al
    reiniciarse el combo (fallo o pulsación vacía), se encoge de golpe con una pequeña sacudida
    (feedback de impacto negativo).
  - **HUD interno — barra de progreso de ronda**: una barra horizontal en la franja superior del
    canvas que se llena progresivamente a medida que avanzan los 32 beats de la ronda actual,
    animada con easing en cada actualización (no un salto instantáneo de ancho), y que se vacía con
    un breve destello al completar la ronda. Mismo patrón que la barra de temporizador de Frogger,
    aquí representando progreso en vez de tiempo restante.

**Fuera de alcance (para otros specs):**

- **La variante `powerups-acordes` de este mismo juego**
  (`specs/game-jam/neon-beats/02-neon-beats-powerups-acordes.md`): power-ups (amplificador ×2,
  escudo, ralentizador) y notas de acorde (dos o más carriles simultáneos) — es la alternativa
  mutuamente excluyente a este spec. La variante `core` es deliberadamente la versión sin
  power-ups y sin acordes.
- Reproducción de audio real o síntesis de tonos vía Web Audio API — regla dura del jam (sin
  assets ni efectos de audio); el ritmo se resuelve enteramente vía el anillo de pulso visual.
- Soporte táctil/móvil (solo teclado).
- Políticas RLS en `games`/`scores` — mismo pendiente ya documentado en specs 05/06/07/08/09 y en
  la variante `core` de Frogger.
- Supabase Auth real / relación de `scores.user_id` con un usuario autenticado.
- Cambios visuales en `Podium.tsx`/`Leaderboard.tsx`/`GameCard.tsx`/`MiniCard`.
- Adaptar cualquier otro juego del catálogo — este spec cubre únicamente esta variante de
  Neon Beats.
- **Sprites, spritesheets o cualquier imagen externa**: el detalle visual descrito arriba es
  enteramente procedural, generado con primitivas de canvas en tiempo de dibujo.
- **Efectos gráficos pesados**: sistemas de partículas sin límite, sombras dinámicas o
  post-procesado — el único efecto de partículas es el pool fijo de 24 partículas del impacto de
  nota, explícitamente acotado.
- **Diseño del cover `cover-neon-beats`** en `globals.css` — no existe ninguna clase reutilizable
  con temática de ritmo/música en el catálogo actual (`cover-bricks`, `cover-tetro`, `cover-snake`,
  `cover-glot`, `cover-invaders`, `cover-rocas`, `cover-rana`, `cover-duelo` no encajan). Se
  propone el nombre de clase `cover-neon-beats` para la fila semilla, pero su diseño CSS queda
  fuera de alcance de este spec — mismo tratamiento que otros specs dan al diseño de un cover
  nuevo cuando no hay clase reutilizable.
- Ajustes de responsive/CSS del contenedor `crt`/`crt-screen` para encajar un nuevo tamaño de
  canvas — mismo pendiente ya anotado en specs 05/07/08/09 y en Frogger.

## Modelo de datos

- Entrada en el catálogo (tipo `Game`, sin cambios de forma más allá de la categoría nueva):

  ```ts
  {
    id: "neon-beats",
    title: "NEON BEATS",
    short: "Acierta las notas al ritmo del pulso neón antes de que se apaguen.",
    long: "Un pulso electrónico marca el compás mientras gemas de colores caen por cuatro carriles. Presiona el carril correcto en el instante exacto para encadenar combos y subir de ronda; un fallo de más y las luces se apagan.",
    cat: "RHYTHM",
    cover: "cover-neon-beats",
    color: "magenta",
    best: 0,
    plays: "0",
  }
  ```

- **`app/data/types.ts`**: `GameCategory` gana el miembro `'RHYTHM'`; `CATS` gana `'RHYTHM'` en su
  arreglo. Sin cambios de forma en `Game`/`ScoreRow`/`User`.

- **`app/game-engines/neon-beats/engine.ts`** — módulo nuevo, sin estado global de módulo (todo lo
  listado abajo queda encapsulado dentro del closure de `createGame`):

  ```ts
  export interface NeonBeatsCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void; // emite 3 al iniciar; baja en cada Fallo; 0 dispara game over
    onGameOver: (finalScore: number) => void;
    onPauseChange: (isPaused: boolean) => void;
    onLevelChange: (level: number) => void; // emite 1 al iniciar; sube en 1 cada ronda completada (32 beats)
  }

  export interface NeonBeatsGame {
    pause: () => void;
    resume: () => void;
    destroy: () => void;
  }

  export function createGame(
    canvas: HTMLCanvasElement,
    callbacks: NeonBeatsCallbacks,
  ): NeonBeatsGame;
  ```

  Internamente conserva, como estructuras encapsuladas:
  - Configuración estática de los 4 carriles (`x`, `color`).
  - `songTimeMs`: acumulador de tiempo interno avanzado por `dt` cappeado cada frame, congelado
    mientras `isPaused` es `true`; `bpm`/`beatIntervalMs` actuales; `level`; `beatsElapsedInRound`
    (0–32, se reinicia en cada ronda completada).
  - Lista de notas activas, cada una con: `id`, `lane` (0–3), `hitTime` (valor absoluto de
    `songTimeMs` al que corresponde), `state: 'pending' | 'hit' | 'missed'`,
    `judgment?: 'perfect' | 'good'`, `rotationPhase` (offset aleatorio 0–2π para el giro de idle,
    fijado al crear la nota), `hitAnimProgress` (`0`→`1`, progreso de la animación de
    squash-y-partículas al acertar).
  - Un PRNG semillado por nivel para el generador de chart (ventana rodante de ~4 segundos hacia
    adelante), y los parámetros de densidad/subdivisión vigentes según el nivel actual.
  - `combo`, `multiplier` (derivado de `combo`), `score`, `lives`.
  - `beatRingScale` (progreso de la animación de expansión/easing del anillo de pulso, reiniciado
    en cada beat) y `receptorPulsePhase` (sincronizado al mismo reloj de beat, deliberadamente
    compartido entre los 4 receptores).
  - `laneScanlineOffsetPx` por carril, cada uno incrementado a una velocidad ligeramente distinta
    (±5%) para desincronizar visualmente el scroll entre carriles.
  - Pool fijo de 24 partículas de impacto (posición, velocidad, tiempo de vida restante,
    reutilizadas por índice circular — nunca se crean partículas nuevas fuera del pool).
  - `gameOverFired` (bandera para evitar doble `onGameOver`), `isPaused`, listeners de teclado
    (flechas + `DFJK` + `P`/`Escape`).
  - **Cachés offscreen**: un `<canvas>` por carril con su fondo (gradiente + bordes) precalculado
    una sola vez al iniciar (invalidado solo si cambiara el tamaño del canvas, lo cual no ocurre en
    esta variante); un sprite offscreen de "gema" cacheado por cada uno de los 4 colores de carril
    (con el resplandor ya horneado, sin `shadowBlur` por primitiva dentro del loop de animación).

- **Fila semilla en `games`** (SQL de la migración, mismo esquema ya existente de `games`/`scores`,
  sin cambios de columnas):

  ```sql
  insert into games (id, title, short, long, cat, cover, color) values (
    'neon-beats', 'NEON BEATS',
    'Acierta las notas al ritmo del pulso neón antes de que se apaguen.',
    'Un pulso electrónico marca el compás mientras gemas de colores caen por cuatro carriles. Presiona el carril correcto en el instante exacto para encadenar combos y subir de ronda; un fallo de más y las luces se apagan.',
    'RHYTHM', 'cover-neon-beats', 'magenta'
  );
  ```

- **`app/game-engines/registry.ts`**: se agrega la entrada
  `'neon-beats': { createGame: neonBeatsCreateGame, width: 480, height: 640 }` a `GAME_ENGINES`,
  con su import correspondiente
  (`import { createGame as neonBeatsCreateGame } from './neon-beats/engine'`). No se agregan tipos
  nuevos — reutiliza `EngineCallbacks`/`EngineInstance` ya existentes en ese archivo.

- `app/lib/supabase/queries.ts`/`actions.ts` no cambian de firma: `getGames`/`getGame`/
  `getScores`/`getStats`/`saveScore` ya son genéricas por `gameId` desde el spec 07; esta variante
  solo las consume.

## Plan de implementación

1. **Extender `GameCategory`/`CATS`** en `app/data/types.ts` con `'RHYTHM'`. El sistema queda
   funcional: el tipo compila, la categoría existe, aunque nada la usa todavía.
2. **Crear la migración de Supabase** (vía MCP `apply_migration`) que inserta la fila semilla de
   `"neon-beats"` en `games`, usando el esquema ya existente. El sistema queda funcional: la fila
   existe en Supabase, pero ninguna ruta la usa todavía (`/game/neon-beats` da 404 porque
   `GAME_ENGINES` aún no tiene la clave `"neon-beats"`).
3. **Crear `app/game-engines/neon-beats/engine.ts` — grilla de carriles y reloj de BPM**:
   `createGame(canvas, callbacks)` que dibuja los 4 carriles estáticos y hace correr el acumulador
   `songTimeMs` con `dt` cappeado, mostrando el anillo de pulso latiendo al BPM inicial. El sistema
   queda funcional: el reloj interno corre de forma visible y verificable, aunque todavía no caen
   notas.
4. **Agregar el generador procedural de chart y la caída de notas** — PRNG semillado por nivel que
   programa notas por carril con antelación, notas naciendo en `y = -40` y cayendo a velocidad
   constante hasta la zona de golpe, sin lógica de juicio ni input todavía. El sistema queda
   funcional: el tablero se ve vivo (notas cayendo) de forma aislada.
5. **Conectar el input y el juicio de notas** — listeners de teclado (flechas + `DFJK`, filtrando
   `event.repeat`), cálculo de la ventana de juicio más cercana por carril (Perfecto/Bien/vacío) y
   marcar Fallo automático a las notas que cruzan la zona de golpe sin presionarse. El sistema
   queda funcional: el juego es jugable con teclado de forma aislada, aunque todavía no notifique
   nada a React.
6. **Conectar combo, multiplicador y puntaje** — incrementar/reiniciar `combo`, derivar
   `multiplier`, sumar `score` según el tier de cada acierto. El sistema queda funcional: la
   puntuación y el combo se calculan correctamente de forma aislada.
7. **Conectar vidas y fin de juego** — restar una vida en cada Fallo, invocar `onGameOver` cuando
   las vidas llegan a 0, con la bandera `gameOverFired` evitando doble invocación. El sistema queda
   funcional: una partida completa termina correctamente de forma aislada.
8. **Agregar rondas y progresión de dificultad** — contar 32 beats por ronda, al completarla sumar
   300 puntos, subir nivel, subir BPM ~8% y la densidad del chart. El sistema queda funcional: el
   ciclo completo de dificultad progresiva funciona de forma aislada.
9. **Conectar los callbacks `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver`** —
   invocar `onLivesChange(3)` y `onLevelChange(1)` al iniciar, y el resto de callbacks en los
   puntos ya descritos en los pasos anteriores. El sistema queda funcional: el engine notifica
   todos los cambios de estado relevantes, aunque aún no haya un consumidor en React.
10. **Implementar `pause()`/`resume()`/`destroy()`** — congelando por completo el acumulador
    `songTimeMs` (sin arrastrar tiempo transcurrido en pausa) y agregando los listeners de teclado
    `P`/`Escape`, invocando `onPauseChange(true)`/`onPauseChange(false)` en ambos caminos.
    `destroy()` detiene el loop y remueve todos los listeners agregados por `createGame`. El
    sistema queda funcional: la API pública del engine está completa y probada de forma aislada.
11. **Registrar el motor en `app/game-engines/registry.ts`** — agregar el import
    `neonBeatsCreateGame` y la entrada `'neon-beats': { createGame: neonBeatsCreateGame, width: 480,
height: 640 }` a `GAME_ENGINES`. El sistema queda funcional de punta a punta: `/game/neon-beats`
    y `/game/neon-beats/play` dejan de dar 404, el juego es jugable completo desde la UI real, y el
    guardado de puntuación, el detalle del juego y la pestaña "NEON BEATS" del salón de la fama
    funcionan automáticamente vía la capa de datos ya generalizada.
12. **Agregar la capa de dibujo detallada y sus cachés** — precalcular en `<canvas>` offscreen el
    fondo de cada carril y el sprite de gema por color, y dibujar por frame el resto del detalle: el
    scroll de scanlines desincronizado por carril, el giro/pulso de idle de cada nota, el
    parpadeo de peligro antes de un Fallo, el squash-y-partículas al acertar, el anillo de pulso con
    su expansión/easing, los receptores respirando sincronizados al beat con su squash de impacto,
    la llama de combo y la barra de progreso de ronda. El sistema queda funcional: el tablero
    completo se ve detallado y animado, de forma aislada.
13. **Verificación manual y build** — jugar una partida completa en `/game/neon-beats/play`
    confirmando: notas cayendo en los 4 carriles, juicio correcto de Perfecto/Bien/Fallo con ambos
    esquemas de teclas, combo/multiplicador escalando y reiniciándose correctamente, vidas
    descontando en cada Fallo, rondas completándose con subida de nivel/BPM/densidad, fin de juego
    al agotar las 3 vidas, pausa real congelando el reloj interno por completo (sin fallos
    "fantasma" al reanudar), guardado de puntuación real, y que la puntuación aparece en
    `/game/neon-beats` y en la pestaña "NEON BEATS" de `/hall-of-fame` tras recargar. Confirmar
    también legibilidad de cada elemento en movimiento (notas, anillo de pulso, receptores) y que
    el framerate se mantiene estable durante una partida larga con varias rondas superadas.
    Confirmar que el resto del catálogo no tiene regresiones. Ejecutar `npm run build` sin errores
    de TypeScript ni de ESLint. El sistema queda funcional y verificado de punta a punta.

## Criterios de aceptación

- [ ] `app/data/types.ts` incluye `'RHYTHM'` en `GameCategory` y en `CATS`.
- [ ] La tabla `games` de Supabase contiene una fila `id: "neon-beats"`, `title: "NEON BEATS"`,
      `cat: "RHYTHM"`, `cover: "cover-neon-beats"`, `color: "magenta"`, sembrada por la migración.
- [ ] `app/game-engines/neon-beats/engine.ts` existe, exporta `createGame(canvas, callbacks)` y no
      usa variables globales de módulo.
- [ ] `NeonBeatsCallbacks` incluye `onScoreChange`, `onLivesChange`, `onGameOver`,
      `onPauseChange`, `onLevelChange`, todos obligatorios, compatibles con `EngineCallbacks` de
      `registry.ts`.
- [ ] En `/game/neon-beats/play` el juego se renderiza dentro de un `<canvas>` de 480×640 y es
      jugable con teclado: flechas (`←↓↑→`) y `D`/`F`/`J`/`K` controlan los carriles 0–3
      indistintamente, sin juicios duplicados por mantener una tecla presionada.
- [ ] Las notas nacen en la parte superior de su carril y caen a velocidad constante hasta la zona
      de golpe (`y = 560`), sincronizadas al reloj interno de BPM.
- [ ] Presionar la tecla de un carril dentro de ±60ms del `hitTime` de su nota más cercana otorga
      el tier "Perfecto" (100 pts base); dentro de ±140ms otorga "Bien" (50 pts base); una nota que
      cruza la zona de golpe sin presionarse se marca "Fallo" automáticamente.
- [ ] Una pulsación sin ninguna nota en su ventana de juicio reinicia el combo a 0 sin restar
      vidas.
- [ ] El combo sube en 1 por cada acierto y se reinicia a 0 en cada Fallo o pulsación vacía; el
      multiplicador (`1 + floor(combo/10)`, tope `×5`) se aplica al puntaje base de cada acierto.
- [ ] La partida arranca con 3 vidas (`onLivesChange(3)` al iniciar); cada Fallo resta una vida; al
      llegar a 0, se invoca `onGameOver(finalScore)` una única vez.
- [ ] Cada 32 beats completados suma 300 puntos de bonificación, sube el nivel en 1
      (`onLevelChange`), sube el BPM ~8% y aumenta la densidad/subdivisión del chart.
- [ ] El botón "PAUSA" del HUD de React y las teclas `P`/`Escape` capturadas por el engine
      congelan por completo el acumulador `songTimeMs` (ninguna nota se mueve, el anillo de pulso
      deja de latir) y lo reanudan sin arrastrar el tiempo transcurrido en pausa, confirmando el
      estado vía `onPauseChange(isPaused)`.
- [ ] Al presionar "JUGAR DE NUEVO", el engine se destruye y se vuelve a crear desde cero: notas,
      combo, puntaje (0), nivel (1), BPM inicial y vidas (3) quedan en su estado inicial.
- [ ] Salir de la partida (botón "SALIR" o navegación fuera de la página) limpia correctamente el
      engine (`destroy()` se llama en el cleanup del `useEffect`, sin loops ni listeners de teclado
      colgando).
- [ ] `app/game-engines/registry.ts` incluye la entrada `'neon-beats': { createGame, width: 480,
    height: 640 }`, sin modificar `app/game/[id]/play/page.tsx` ni `GamePlayClient.tsx`.
- [ ] En `/game/neon-beats/play`, guardar la puntuación inserta una fila real en `scores`
      (`game_id: "neon-beats"`) vía `saveScore`, reutilizando la Server Action ya existente sin
      cambios.
- [ ] En `/game/neon-beats`, el título, descripción, leaderboard lateral, "Mejor global" y
      "Partidas" provienen de Supabase vía `getGame`/`getScores`/`getStats`, sin cambios en esas
      funciones.
- [ ] En `/hall-of-fame`, la pestaña "NEON BEATS" muestra las puntuaciones reales de `scores` para
      `game_id: "neon-beats"`.
- [ ] El resto del catálogo (`asteroids`, `tetris`, `arkanoid`, `snake`, `frogger`) conserva
      exactamente su comportamiento actual, sin regresiones.
- [ ] Ningún elemento del tablero (carril, nota, receptor, anillo de pulso, barra de progreso) se
      dibuja como una única forma geométrica plana de un solo color; cada uno combina varias
      primitivas para sugerir textura o identidad, según lo descrito en el Alcance.
- [ ] Cada nota gira sobre su propio eje mientras cae, con fase inicial distinta entre notas, y
      parpadea en opacidad de forma perceptible en los últimos ~150ms antes de convertirse en
      Fallo.
- [ ] Al acertar una nota, la gema anima squash & stretch de impacto y emite una ráfaga de
      partículas del pool fijo de 24; el receptor de su carril anima squash horizontal y destello.
- [ ] El anillo de pulso se expande en cada beat y se contrae con easing durante el resto del
      intervalo; los 4 receptores respiran con un pulso sincronizado exactamente a ese mismo beat.
- [ ] Los scanlines de fondo de cada carril se desplazan en bucle con una velocidad ligeramente
      distinta entre carriles (no sincronizada).
- [ ] Los fondos estáticos de los 4 carriles y los sprites de gema por color están cacheados en
      `<canvas>` offscreen, no redibujados desde cero cada frame.
- [ ] El framerate se mantiene estable durante una partida larga con varias rondas superadas.
- [ ] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Sin audio real, ritmo resuelto 100% de forma visual**: la regla dura del jam prohíbe assets de
  audio y "sonido" queda fuera de alcance en todos los motores construidos desde cero de este
  catálogo (Snake, Frogger). Un juego de ritmo sin sonido pierde su ancla natural de sincronización
  — se resolvió reemplazándola por un **anillo de pulso visual** que late exactamente al BPM
  interno, más receptores que respiran sincronizados al mismo reloj: el jugador sincroniza sus
  pulsaciones observando el canvas, no escuchando música. Se descartó usar la Web Audio API para
  sintetizar tonos (osciladores) porque "sonido" ya es una categoría explícitamente fuera de
  alcance en este proyecto, no solo "archivos de audio" — evitar la ambigüedad fue una decisión
  explícita, documentada aquí para que quien apruebe el spec la revise con ese contexto.
- **Motor construido desde cero**, sin `game.js` de referencia (mismo criterio que Snake/Frogger),
  porque Neon Beats no forma parte de `references/started-games/` — toda la mecánica se definió a
  partir de la descripción del jam ("notas cayendo en carriles fijos estilo DDR/Guitar Hero
  reducido").
- **`id: "neon-beats"` (inglés)**, mismo criterio ya aplicado en el resto del catálogo (`snake`,
  `frogger`): nombre en inglés del juego real como id/ruta/carpeta.
- **Categoría nueva `RHYTHM`**, en vez de forzar el juego dentro de `ARCADE` (que ya es la
  categoría más poblada del catálogo), porque la mecánica de juicio por ventana de tiempo contra un
  reloj interno es cualitativamente distinta de cualquier juego ya implementado — mismo criterio
  que `PLATFORMER`/`RACING`/`MAZE`/`REFLEX` propuestas como categorías nuevas por `game-planner`
  para otros conceptos sin encaje natural.
- **Los cinco callbacks estándar, sin agregar ninguno nuevo**: el combo, el multiplicador, el
  progreso de ronda y el anillo de pulso se dibujan enteramente dentro del canvas, sin necesitar
  una fuente de verdad en React — mismo criterio que Frogger aplicó a su barra de temporizador
  interna en vez de agregar `onTimeChange` a `EngineCallbacks`/`registry.ts`. `onLivesChange` y
  `onLevelChange` sí se reutilizan tal cual porque mapean directamente a conceptos reales del
  juego (vidas, rondas).
- **Por qué vidas y rondas son parte del mínimo**: sin vidas, un Fallo no tendría consecuencia
  real más allá de romper el combo, y la partida sería indefinidamente rejugable sin condición de
  fin — igual que el resto de motores del catálogo, "perder una vida" en Neon Beats se define
  concretamente como "una nota cruza la zona de golpe sin presionarse a tiempo". Sin rondas, no
  habría "nivel" que subir ni dificultad creciente perceptible — el campo "Nivel" del HUD de React
  necesita significado real, igual que ya lo tiene en el resto del catálogo.
- **Ventanas de juicio ±60ms/±140ms**, un rango típico de juegos de ritmo reducidos (más generoso
  que un juego de ritmo profesional, que suele usar ventanas de ~20-50ms), elegido para que el
  juego sea jugable con precisión de teclado estándar (sin hardware dedicado) y framerate variable,
  sin volverlo trivial.
- **Multiplicador con tope `×5`**, en vez de crecimiento sin límite, para evitar que una racha muy
  larga vuelva el puntaje desproporcionado respecto al resto del catálogo (mismo espíritu de "piso
  o techo razonable" ya aplicado a la velocidad de Snake y al temporizador de Frogger).
- **Pulsación vacía reinicia combo pero no resta vida**, en vez de ignorarla sin consecuencia o
  penalizarla como un Fallo completo, como término medio entre desalentar presionar teclas al azar
  y no castigar tan duro como perder una nota real — decisión explícita de diseño para esta
  variante.
- **Ronda de 32 beats, BPM +8% y bonificación de 300 pts por ronda**, valores concretos elegidos
  para que una ronda dure ~13-16 segundos en niveles bajos (32 beats a 500-460ms por beat) —
  suficientemente corta para sentir progresión seguido, sin ser tan corta que el jugador no llegue
  a acostumbrarse al patrón antes de que suba la dificultad.
- **Estilo gráfico procedural elegido por entidad**: gemas romboidales con faceta y núcleo
  pulsante para las notas (en vez de círculos planos) porque necesitan leerse de un vistazo cayendo
  a velocidad variable; anillo de pulso con anticipación+easing en vez de un simple parpadeo,
  porque es el elemento que reemplaza al audio y necesita "sentirse" como un latido, no como un
  interruptor. Se consideraron y descartaron: un rastro tipo cometa detrás de cada nota (costo de
  dibujo alto por frame sin aportar legibilidad adicional) y sacudida de pantalla completa en cada
  acierto (podría desorientar la precisión de lectura de las próximas notas, que es crítica en este
  género).
- **Paleta sin ampliar**: a diferencia de los vehículos de Frogger, los 4 carriles de Neon Beats
  usan exactamente los 4 colores neón ya existentes de `globals.css` (uno fijo por carril), sin
  necesidad de colores adicionales — cada carril ya es distinguible por posición y color fijo, sin
  el problema de "varios elementos del mismo tipo compartiendo carril" que sí tenía Frogger.
- **`cover-neon-beats` como nombre de clase nueva**, sin diseñar su CSS en este spec — ninguna
  clase existente en `globals.css` tiene temática de ritmo/música; se prefirió proponer un nombre
  de clase consistente con el `id` en vez de forzar la reutilización de un cover no relacionado
  (como `cover-glot` o `cover-duelo`).
- **Canvas 480×640 (vertical) con 4 carriles de 120px**, un tamaño y proporción propios de Neon
  Beats — más alto que ancho, acorde al recorrido vertical de las notas, distinto de los tamaños ya
  usados por el resto del catálogo (800×600, 480×600, 600×600, 560×520).
- **Controles duales flechas + `DFJK`**, combinando el esquema ya usado por el resto del catálogo
  (flechas) con el esquema clásico de juegos de ritmo de 4 teclas (`D`/`F`/`J`/`K`, mapeo estándar
  de juegos como osu!/StepMania en teclado), para que un jugador familiarizado con cualquiera de
  los dos esquemas pueda jugar sin fricción.
- **Pausa dual con tecla `P`/`Escape` además del botón de React**, mismo patrón ya establecido en
  Arkanoid/Snake/Frogger.
- **Consumo directo de la capa de Supabase ya generalizada**, sin volver a generalizarla ni
  duplicarla — mismo criterio ya aplicado por los specs 08/09 y por Frogger.

## Riesgos identificados

- **Deriva del reloj de BPM si `songTimeMs` no usa un acumulador de `dt` cappeado**: si el reloj
  interno se calculara con `Date.now()` directo en vez de acumular `dt` por frame, el tiempo
  transcurrido durante una pausa o con la pestaña en segundo plano se sumaría de golpe al
  reanudar, desincronizando instantáneamente todas las notas en pantalla de sus `hitTime`
  programados y generando Fallos "fantasma". Mitigación: `songTimeMs` debe ser un acumulador
  interno avanzado exclusivamente por el `dt` cappeado del loop de animación, nunca por diferencias
  de timestamps de reloj real, y debe congelarse por completo (no solo el dibujo) mientras
  `isPaused` es `true`.
- **Precisión de juicio dependiente del framerate**: si la detección de la ventana de juicio se
  basara en el frame en que ocurre el `keydown` en vez de un timestamp preciso, dispositivos con
  framerate bajo o inestable serían injustamente más difíciles de jugar. Mitigación: cada
  `keydown` debe capturar `songTimeMs` en el instante exacto del evento (no en el próximo tick del
  loop de animación) para comparar contra el `hitTime` de la nota.
- **Notas duplicadas por repetición de tecla del sistema operativo**: mismo riesgo ya documentado
  en Frogger — si el listener no filtra `event.repeat`, mantener presionada una tecla generaría
  múltiples juicios por una sola pulsación intencional. Mitigación: ignorar explícitamente los
  eventos `keydown` con `event.repeat === true`.
- **Costo de dibujo por frame por el mayor detalle visual**: redibujar gemas con glow, facetas y
  núcleo pulsante, más el anillo de pulso y los receptores, con varias notas simultáneas en
  pantalla en rondas avanzadas (mayor densidad de chart), podría degradar el framerate si cada
  primitiva se recalcula desde cero. Mitigación: precalcular el fondo de cada carril y el sprite de
  gema por color en `<canvas>` offscreen (con el resplandor ya horneado, sin `shadowBlur` por
  primitiva dentro del loop), y mantener el pool de partículas de impacto fijo en 24 elementos.
- **Contraste/legibilidad de cada nota en movimiento**: una gema con baja opacidad de resplandor
  sobre el fondo teñido de su propio carril podría perderse visualmente, especialmente en
  densidades altas con varias notas cercanas en el mismo carril. Mitigación: el núcleo interior de
  cada gema usa un color casi blanco de alto contraste sobre el resplandor de color del carril, y
  la legibilidad se verifica explícitamente en el paso de verificación manual con varias notas en
  pantalla a la vez.
- **Fugas de memoria por listeners de teclado no limpiados en `destroy()`**, mismo riesgo ya
  documentado en el resto del catálogo — si `destroy()` no remueve correctamente los listeners de
  `keydown` (incluyendo `P`/`Escape`), reiniciar varias veces o navegar entre
  `/game/neon-beats/play` y otras rutas podría acumular listeners duplicados.
- **Doble invocación de `onGameOver`**: mismo riesgo ya documentado en specs anteriores — si la
  transición a 0 vidas no queda encapsulada con la bandera `gameOverFired`, una condición de
  carrera (p. ej. dos Fallos evaluados en el mismo frame) podría disparar `onLivesChange(0)`/
  `onGameOver` más de una vez.
- **Progresión de BPM sin límite superior de rondas**: como el BPM sube ~8% en cada ronda sin un
  tope definido en este spec, una partida muy larga de un jugador experto podría volver las
  ventanas de juicio matemáticamente imposibles de cumplir con precisión humana. Mitigación: fijar
  un tope razonable de BPM durante la implementación (p. ej. no superar ~240 BPM), aunque el valor
  exacto no forma parte de los criterios de aceptación de este spec — mismo criterio de "riesgo
  aceptado documentado" ya usado en Snake (velocidad de tick) y Frogger (velocidad por ronda).
- **Tamaño fijo de canvas (480×640) en un layout responsive**: mismo riesgo ya documentado y
  aceptado como pendiente en specs 05/07/08/09 y en Frogger.
- **RLS no definido** en `games`/`scores` — mismo pendiente ya documentado y aceptado en specs
  05/06/07/08/09 y en Frogger.
