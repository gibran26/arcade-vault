# Integración de Neon Beats — variante powerups-acordes (motor + leaderboard)

**Estado:** Borrador
**Depende de:** 04-integracion-supabase (clientes de Supabase); consume la capa ya generalizada
por 07-tetris-motor-leaderboard (`getGames`/`getGame`/`getScores`/`getStats`/`saveScore`,
`GAME_ENGINES`) sin volver a generalizar nada.
**Alternativa a:** `specs/game-jam/neon-beats/01-neon-beats-core.md` — mismo `id`, distinto
alcance; son mutuamente excluyentes, se implementa solo uno.
**Fecha:** 2026-07-28
**Objetivo:** Construir desde cero el motor de Neon Beats con power-ups obligatorios
(amplificador ×2, escudo, ralentizador) y notas de acorde multi-carril, sobre la misma base de la
variante `core` (4 carriles, 3 vidas, rondas con dificultad creciente), dentro de un `<canvas>` en
`/game/neon-beats/play`, notificando a React los cambios de puntaje, vidas y nivel, y persistir sus
puntuaciones vía la capa de datos genérica ya existente.

## Alcance

**Dentro del alcance:**

- **Nueva fila semilla en la tabla `games` de Supabase** (vía `apply_migration`, mismo esquema ya
  existente de `games`/`scores`, sin cambios de columnas): `id: "neon-beats"`,
  `title: "NEON BEATS"`, `cat: "RHYTHM"`, `cover: "cover-neon-beats"`, `color: "magenta"`. Es la
  misma fila semilla que definiría la variante `core` — son alternativas del mismo `id`, no
  coexisten.
- **Extender `GameCategory`/`CATS`** en `app/data/types.ts` con `'RHYTHM'`, idéntico a lo descrito
  en la variante `core` — ambas variantes requieren la misma extensión de tipos, solo se ejecuta
  una vez sin importar cuál variante se implemente.
- **Sin assets gráficos ni de audio externos**, mismo criterio que la variante `core`: todo el
  detalle visual (power-ups incluidos) es procedural, sin reproducción de audio real ni síntesis de
  tonos — el ritmo se sigue resolviendo enteramente vía el anillo de pulso visual y el reloj interno
  de BPM (`songTimeMs`), ver `01-neon-beats-core.md` para el razonamiento completo de esa decisión,
  que aplica sin cambios aquí.
- **Motor construido desde cero** (sin `game.js` de referencia, igual que la variante `core`) en
  `app/game-engines/neon-beats/engine.ts`, exponiendo `createGame(canvas, callbacks)` con
  `pause()`/`resume()`/`destroy()`. Incluye todo lo ya descrito como base común en la variante
  `core` (canvas 480×640, 4 carriles de 120px con colores fijos cian/magenta/amarillo/verde, zona
  de golpe en `y = 560`, reloj de BPM con `songTimeMs`, generador procedural de chart, caída de
  notas, controles duales flechas/`DFJK`, ventanas de juicio Perfecto/Bien/Fallo, combo y
  multiplicador con tope `×5`, 3 vidas, rondas de 32 beats con BPM/densidad creciente) más los dos
  ejes de profundidad de esta variante:
  - **Power-ups obligatorios** (aparecen como notas especiales que reemplazan a una nota normal en
    el chart, deben presionarse igual que cualquier nota dentro de sus ventanas de juicio —
    otorgan puntos base normales además de su efecto):
    1. **Amplificador (×2 de puntaje)**: aparece aproximadamente una vez cada 20 beats (nunca en el
       mismo `hitTime` que un acorde), en un carril elegido al azar entre los 4. **Duración**: 8000ms
       de tiempo real desde que se acierta (no avanza mientras el juego está en pausa). **Efecto**:
       durante su ventana activa, todo puntaje otorgado por aciertos (Perfecto/Bien) se multiplica
       ×2 adicional, apilado de forma multiplicativa sobre el multiplicador de combo normal
       (`puntoFinal = puntosBase(tier) * multiplicadorCombo * 2`). Acertar un segundo amplificador
       mientras uno ya está activo **reinicia** su duración a 8000ms en vez de acumular duraciones.
       **Dibujo**: en vez de la gema romboidal estándar, es una estrella de 5 puntas dorada/blanca
       (independiente del color de su carril, para que se distinga de cualquier nota normal a
       simple vista) con un rastro de destellos pequeños que orbitan girando más rápido que el giro
       de idle normal de una nota. **Telegrafiado de vencimiento**: mientras está activo, una
       insignia "×2" con un anillo de cuenta regresiva se dibuja en la esquina superior derecha del
       canvas; el anillo se vacía proporcionalmente al tiempo restante y, en los últimos 2000ms,
       parpadea en rojo cada vez más rápido.
    2. **Escudo (Absorción)**: aparece aproximadamente una vez cada 24 beats, en un carril al azar.
       **Duración**: la carga de escudo obtenida dura hasta 15000ms sin usarse (expira si no se
       consume) o hasta que absorbe un Fallo, lo que ocurra primero. **Efecto**: mientras haya una
       carga de escudo disponible (máximo 1 acumulable — acertar un segundo escudo con una carga ya
       activa no otorga una carga adicional, solo reinicia su ventana de 15000ms), el próximo Fallo
       que ocurriría se cancela por completo: no resta vida, no reinicia el combo, y consume la
       carga. **Dibujo**: nota hexagonal con una cruz/signo "+" en su interior, color blanco-cian
       fijo (independiente del carril) con un anillo orbital sutil alrededor. Mientras hay una carga
       disponible, un ícono de escudo pequeño orbita junto al indicador de vidas del HUD interno,
       con un anillo de cuenta regresiva propio. **Telegrafiado de vencimiento**: en los últimos
       3000ms sin usarse, el ícono orbital parpadea para avisar que la carga está por perderse.
    3. **Ralentizador ("Groove Lento")**: aparece aproximadamente una vez cada 28 beats, en un
       carril al azar. **Duración**: 6000ms de tiempo real desde que se acierta. **Efecto**: durante
       su ventana activa, toda nota nueva programada por el generador de chart nace con un tiempo de
       anticipación 30% mayor (cae más lento/desde más arriba en términos de tiempo perceptible),
       dando más margen de reacción sin alterar el BPM ni las ventanas de juicio de las notas que ya
       estaban en pantalla al activarse (evita que una nota ya cayendo cambie de velocidad a mitad
       de camino). **Dibujo**: nota circular con carátula de reloj y dos manecillas que giran como
       animación de idle (más rápido que un reloj real, como acento visual de "tiempo alterado"),
       color celeste pálido. **Telegrafiado de vencimiento**: mientras está activo, un anillo de
       "ondulación temporal" translúcido pulsa lentamente alrededor del borde de los 4 carriles; en
       los últimos 1500ms, un ícono de reloj de arena pequeño junto al HUD interno parpadea.

  - **Segundo eje de profundidad: notas de acorde**. A partir del nivel 2, el generador de chart
    programa ocasionalmente **acordes**: dos notas en carriles distintos que comparten exactamente
    el mismo `hitTime`, que deben presionarse juntas. Desde el nivel 4 en adelante, ocasionalmente
    se programan acordes de 3 carriles. La probabilidad y el tamaño de los acordes aumentan
    gradualmente con el nivel, igual que la densidad general del chart. **Dibujo**: un arco/corchete
    curvo con resplandor conecta visualmente las notas de un mismo acorde; el corchete aparece con
    una animación de crecimiento (anticipación) poco después de que las notas del acorde nacen, y
    su trazo pulsa con un efecto de "hormigas marchando" (offset de guiones desplazándose a lo largo
    del arco) para señalar "presionar juntas". **Combo de acorde**: cada acorde en el que todas sus
    notas se aciertan (Perfecto o Bien, cada una dentro de su propia ventana) dentro de una
    tolerancia de ±80ms entre sí incrementa un contador de "racha de acordes"; cada 5 acordes
    consecutivos acertados por completo otorgan **+200 puntos** de bonificación y un **+1 temporal**
    al tope del multiplicador de combo (de `×5` a `×6`) que decae de vuelta a `×5` si la racha de
    acordes se rompe (un acorde con al menos una nota fallada). Fallar una sola nota de un acorde
    cuenta como un Fallo individual normal para esa nota/carril (resta una vida, mismas reglas que
    cualquier Fallo) — **no** hace fallar en cascada a las demás notas del mismo acorde, para no
    castigar desproporcionadamente un solo error de sincronización.

- **Callbacks conectados**: `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`,
  `onLevelChange` — los mismos cinco de la variante `core`, sin agregar ninguno nuevo (ver
  Decisiones): el estado de power-ups activos, la racha de acordes y el tope temporal de
  multiplicador se dibujan enteramente dentro del canvas, sin necesitar una fuente de verdad en
  React.
- **Pausa real con doble camino**, idéntico a la variante `core`: congela por completo
  `songTimeMs`, incluyendo la cuenta regresiva de duración de cualquier power-up activo (un
  amplificador o ralentizador activo no pierde tiempo de su ventana mientras el juego está en
  pausa).
- **Montaje genérico**: se agrega la entrada `'neon-beats': { createGame, width: 480, height: 640 }`
  a `app/game-engines/registry.ts` (`GAME_ENGINES`). No se toca `app/game/[id]/play/page.tsx` ni
  `GamePlayClient.tsx`.
- **Consumo de la capa de datos ya generalizada**: idéntico a la variante `core` — `/game/neon-beats`,
  el guardado de puntuación y la pestaña "NEON BEATS" en `/hall-of-fame` funcionan automáticamente
  en cuanto la fila y el registro de motores existen.

- **Gráficos y animación (elemento por elemento)**: todo lo ya descrito en la variante `core`
  (carril, nota estándar, receptor, anillo de pulso, racha de combo, barra de progreso de ronda)
  aplica sin reducción — el estándar gráfico es idéntico entre variantes. Se agrega:
  - **Nota de amplificador**: estrella de 5 puntas dorada/blanca con destellos orbitando y giro de
    idle más rápido que una gema normal (ver arriba); al acertarla, el mismo squash-y-partículas de
    impacto que cualquier nota, más un destello dorado adicional que se expande brevemente desde su
    posición.
  - **Nota de escudo**: hexágono con cruz interior, color fijo blanco-cian, anillo orbital sutil
    como ciclo de idle; al acertarla, un breve pulso de expansión en vez del colapso estándar (para
    diferenciar visualmente "recogí una carga" de "destruí una nota").
  - **Nota de ralentizador**: círculo con carátula de reloj y manecillas girando como ciclo de idle;
    al acertarla, una ondulación circular se expande desde su posición hacia los bordes del carril.
  - **Insignias de estado de power-up** (esquina superior derecha para el amplificador, junto al
    HUD interno de vidas para el escudo, junto al HUD interno para el ralentizador): cada una con
    su propio anillo/ícono de cuenta regresiva, animado con una reducción progresiva (no un salto
    instantáneo) y parpadeo acelerado en su tramo final como telegrafiado de vencimiento, según lo
    descrito arriba para cada power-up.
  - **Corchete de acorde**: arco curvo con resplandor, animado con crecimiento por anticipación al
    aparecer y un efecto de guiones en movimiento ("hormigas marchando") mientras está vigente;
    desaparece con un breve destello si el acorde se completa con éxito, o con un parpadeo rojo si
    al menos una de sus notas termina en Fallo.
  - **Anillo de ondulación temporal** (mientras el ralentizador está activo): pulsa lentamente
    alrededor del borde de los 4 carriles, con una fase de ciclo propia independiente del anillo de
    pulso del metrónomo, para que ambos efectos sean visualmente distinguibles entre sí.

**Fuera de alcance (para otros specs):**

- **La variante `core` de este mismo juego** (`specs/game-jam/neon-beats/01-neon-beats-core.md`):
  sin power-ups, sin acordes, chart con un máximo de una nota por beat-slot — es la alternativa
  mutuamente excluyente a este spec.
- Power-ups o ejes de profundidad adicionales no descritos aquí (p. ej. un power-up de "vida
  extra" instantánea, o un modo de "solo de jefe" con un patrón especial de fin de ronda) — se
  consideraron y se descartaron para mantener el alcance de esta variante enfocado en los tres
  power-ups y el sistema de acordes descritos, sin acumular mecánicas adicionales no relacionadas.
- Reproducción de audio real o síntesis de tonos vía Web Audio API — misma regla dura del jam que
  la variante `core`.
- Soporte táctil/móvil (solo teclado).
- Políticas RLS en `games`/`scores` — mismo pendiente ya documentado en el resto del catálogo.
- Supabase Auth real / relación de `scores.user_id` con un usuario autenticado.
- Cambios visuales en `Podium.tsx`/`Leaderboard.tsx`/`GameCard.tsx`/`MiniCard`.
- Adaptar cualquier otro juego del catálogo — este spec cubre únicamente esta variante de
  Neon Beats.
- **Sprites, spritesheets o cualquier imagen externa**: el detalle visual de los power-ups y el
  corchete de acorde es enteramente procedural, igual que el resto del tablero.
- **Efectos gráficos pesados**: sistemas de partículas sin límite, sombras dinámicas o
  post-procesado — el pool de partículas de impacto sigue fijo en 24 elementos, compartido entre
  notas normales y de power-up.
- **Diseño del cover `cover-neon-beats`** — mismo tratamiento que la variante `core`: se propone el
  nombre de clase para la fila semilla, pero su diseño CSS queda fuera de alcance.
- Ajustes de responsive/CSS del contenedor `crt`/`crt-screen` — mismo pendiente ya anotado en el
  resto del catálogo.

## Modelo de datos

- Entrada en el catálogo (tipo `Game`) — idéntica a la definida en la variante `core` (mismo
  `id`/`title`/`short`/`long`/`cat`/`cover`/`color`).

- **`app/data/types.ts`**: misma extensión de `GameCategory`/`CATS` con `'RHYTHM'` descrita en la
  variante `core` — se ejecuta una sola vez sin importar cuál variante termine implementándose.

- **`app/game-engines/neon-beats/engine.ts`** — módulo nuevo, sin estado global de módulo. Conserva
  todo lo ya listado en la variante `core` (carriles, `songTimeMs`, notas activas con su
  `rotationPhase`/`hitAnimProgress`, PRNG del chart, combo/multiplicador/score, vidas, nivel/ronda,
  `beatRingScale`, `receptorPulsePhase`, `laneScanlineOffsetPx` por carril, pool fijo de 24
  partículas, `gameOverFired`, `isPaused`, listeners, cachés offscreen de fondo de carril y sprite
  de gema por color) más, para esta variante:

  ```ts
  export interface NeonBeatsCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void; // emite 3 al iniciar; baja en cada Fallo no absorbido por el escudo; 0 dispara game over
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

  Mismas firmas que la variante `core` — el segundo eje de profundidad no exige callbacks nuevos
  (ver Decisiones). Estado adicional encapsulado:
  - Cada nota gana un campo `kind: 'normal' | 'amplifier' | 'shield' | 'slow'`, determinando su
    sprite, su efecto al acertarla y si reemplaza o no la gema estándar del carril.
  - `activePowerUps`: registro de hasta un efecto activo por tipo —
    `{ type: 'amplifier' | 'slow'; startedAt: number; durationMs: number }` para los que expiran
    por tiempo, y `shieldCharge: { active: boolean; grantedAt: number; expiresAt: number }` para el
    escudo (booleano de carga disponible, no acumulable).
  - `chordGroups`: mapa de `hitTime` a la lista de `lane`s que comparten ese acorde, más
    `chordBracketProgress` (`0`→`1`, animación de crecimiento del corchete al aparecer) y
    `chordDashOffset` (offset continuo del efecto de guiones en movimiento) por grupo.
  - `chordStreak`: contador de acordes consecutivos completados con éxito; `multiplierCapBonus`
    (`0` o `1`, sumado al tope base de `×5` mientras la racha de acordes de múltiplos de 5 esté
    vigente, decayendo a `0` si la racha se rompe).
  - Sprites offscreen cacheados adicionales: uno por cada `kind` de power-up (estrella, hexágono,
    reloj), con su resplandor/color ya horneado, sin `shadowBlur` por primitiva dentro del loop de
    animación.

- **Fila semilla en `games`** (SQL de la migración, idéntica a la definida en la variante `core`,
  mismo esquema ya existente de `games`/`scores`, sin cambios de columnas):

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
  nuevos.

- `app/lib/supabase/queries.ts`/`actions.ts` no cambian de firma: `getGames`/`getGame`/
  `getScores`/`getStats`/`saveScore` ya son genéricas por `gameId` desde el spec 07; esta variante
  solo las consume.

## Plan de implementación

1. **Extender `GameCategory`/`CATS`** en `app/data/types.ts` con `'RHYTHM'` (idéntico al paso 1 de
   la variante `core`; se ejecuta una sola vez).
2. **Crear la migración de Supabase** (vía MCP `apply_migration`) que inserta la fila semilla de
   `"neon-beats"` en `games`. El sistema queda funcional: la fila existe en Supabase, pero ninguna
   ruta la usa todavía.
3. **Crear `app/game-engines/neon-beats/engine.ts` — base común**: carriles, reloj de BPM
   (`songTimeMs`), generador procedural de chart, caída de notas, input/juicio
   (Perfecto/Bien/Fallo), combo/multiplicador/score, vidas, rondas con progresión de
   BPM/densidad — todo igual que el paso a paso ya descrito en la variante `core` (pasos 3 a 9 de
   ese spec), como punto de partida de esta variante, con el campo `kind: 'normal'` ya presente en
   cada nota desde este paso (para no ajustarlo después). El sistema queda funcional: el juego base
   es jugable de forma aislada, idéntico en mecánica a la variante `core`.
4. **Agregar el generador de acordes** — extender el generador de chart para que, a partir del
   nivel 2, programe ocasionalmente dos (o, desde el nivel 4, tres) notas en carriles distintos
   compartiendo el mismo `hitTime`, registradas en `chordGroups`; detectar el acierto/fallo
   conjunto de cada acorde y actualizar `chordStreak`/`multiplierCapBonus` según las reglas
   descritas en el Alcance. El sistema queda funcional: los acordes aparecen, se juzgan
   correctamente y afectan el tope del multiplicador, de forma aislada.
5. **Agregar los tres power-ups** — extender el generador de chart para intercalar notas de
   `kind: 'amplifier' | 'shield' | 'slow'` con la frecuencia descrita, implementar `activePowerUps`
   y `shieldCharge`, y conectar sus efectos: multiplicador ×2 apilado, absorción del próximo Fallo,
   y anticipación 30% mayor para notas nuevas mientras el ralentizador está activo (sin afectar
   notas ya en pantalla). El sistema queda funcional: los tres power-ups aparecen, se recogen y
   producen su efecto de juego correctamente, de forma aislada.
6. **Conectar los callbacks `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver`** —
   mismos puntos de invocación que la variante `core`, ajustados para que un Fallo absorbido por el
   escudo no invoque `onLivesChange`. El sistema queda funcional: el engine notifica todos los
   cambios de estado relevantes.
7. **Implementar `pause()`/`resume()`/`destroy()`** — congelando `songTimeMs` (incluida la cuenta
   regresiva de cualquier power-up activo) y agregando los listeners de teclado `P`/`Escape`. El
   sistema queda funcional: la API pública del engine está completa y probada de forma aislada.
8. **Registrar el motor en `app/game-engines/registry.ts`** — agregar el import
   `neonBeatsCreateGame` y la entrada `'neon-beats': { createGame: neonBeatsCreateGame, width: 480,
height: 640 }` a `GAME_ENGINES`. El sistema queda funcional de punta a punta: `/game/neon-beats`
   y `/game/neon-beats/play` dejan de dar 404, el juego es jugable completo desde la UI real, y el
   guardado de puntuación, el detalle del juego y la pestaña "NEON BEATS" del salón de la fama
   funcionan automáticamente.
9. **Agregar la capa de dibujo detallada y sus cachés** — precalcular en `<canvas>` offscreen el
   fondo de cada carril, el sprite de gema estándar por color y los sprites de los tres power-ups
   (estrella, hexágono, reloj), y dibujar por frame el resto del detalle: scanlines
   desincronizados, giro/pulso de idle de cada nota (con el giro más rápido de la estrella y las
   manecillas del reloj), parpadeo de peligro, squash-y-partículas al acertar, corchetes de acorde
   con su crecimiento y efecto de guiones en movimiento, insignias de estado de power-up con sus
   anillos de cuenta regresiva y parpadeo de vencimiento, anillo de ondulación temporal del
   ralentizador, anillo de pulso del metrónomo, receptores, llama de combo y barra de progreso de
   ronda. El sistema queda funcional: el tablero completo se ve detallado y animado, con todos los
   elementos de esta variante visibles y legibles, de forma aislada.
10. **Verificación manual y build** — jugar una partida completa en `/game/neon-beats/play`
    confirmando: mecánica base idéntica a `core` (notas, juicio, combo, vidas, rondas); los tres
    power-ups apareciendo, siendo recogibles como notas normales, y produciendo su efecto (×2
    apilado con recuento visible y reinicio de duración al recoger otro, escudo absorbiendo
    exactamente un Fallo, ralentizador dando más margen a notas nuevas sin afectar las ya en
    pantalla); acordes de 2 y 3 carriles apareciendo desde los niveles correspondientes, con su
    corchete visible, juzgándose correctamente notas individuales y actualizando la racha de
    acordes y el tope temporal del multiplicador; fin de juego al agotar las 3 vidas; pausa real
    congelando también la cuenta regresiva de power-ups activos; guardado de puntuación real; y que
    la puntuación aparece en `/game/neon-beats` y en la pestaña "NEON BEATS" de `/hall-of-fame` tras
    recargar. Confirmar también legibilidad de cada elemento en movimiento (incluidos los power-ups
    y el corchete de acorde, distinguibles entre sí y de una nota normal) y que el framerate se
    mantiene estable durante una partida larga con varias rondas superadas y varios power-ups/
    acordes simultáneos. Confirmar que el resto del catálogo no tiene regresiones. Ejecutar
    `npm run build` sin errores de TypeScript ni de ESLint. El sistema queda funcional y verificado
    de punta a punta.

## Criterios de aceptación

- [ ] `app/data/types.ts` incluye `'RHYTHM'` en `GameCategory` y en `CATS`.
- [ ] La tabla `games` de Supabase contiene una fila `id: "neon-beats"`, `title: "NEON BEATS"`,
      `cat: "RHYTHM"`, `cover: "cover-neon-beats"`, `color: "magenta"`, sembrada por la migración.
- [ ] `app/game-engines/neon-beats/engine.ts` existe, exporta `createGame(canvas, callbacks)` y no
      usa variables globales de módulo.
- [ ] `NeonBeatsCallbacks` incluye `onScoreChange`, `onLivesChange`, `onGameOver`,
      `onPauseChange`, `onLevelChange`, todos obligatorios, compatibles con `EngineCallbacks` de
      `registry.ts`.
- [ ] Toda la mecánica base de la variante `core` funciona igual aquí (carriles, juicio
      Perfecto/Bien/Fallo, combo/multiplicador con tope `×5`, 3 vidas, rondas de 32 beats con
      BPM/densidad creciente).
- [ ] El power-up **Amplificador** aparece como estrella dorada/blanca, se recoge como una nota
      normal, y durante 8000ms duplica el puntaje de cada acierto además del multiplicador de
      combo; recoger un segundo amplificador mientras uno está activo reinicia su duración a
      8000ms en vez de acumularla.
- [ ] El power-up **Escudo** aparece como hexágono con cruz, otorga como máximo una carga
      acumulada, y cancela por completo el próximo Fallo (sin restar vida ni reiniciar combo) hasta
      15000ms después de recogerlo o hasta ser consumido, lo que ocurra primero.
- [ ] El power-up **Ralentizador** aparece como nota circular con carátula de reloj, y durante
      6000ms hace que las notas nuevas nazcan con 30% más de tiempo de anticipación, sin alterar la
      velocidad de las notas que ya estaban en pantalla al activarse.
- [ ] Cada power-up activo muestra una insignia/ícono con anillo de cuenta regresiva que se vacía
      proporcionalmente al tiempo restante y parpadea de forma acelerada en su tramo final.
- [ ] A partir del nivel 2 el chart programa acordes de 2 carriles (y desde el nivel 4, de 3
      carriles), conectados visualmente por un corchete curvo con animación de crecimiento y efecto
      de guiones en movimiento.
- [ ] Acertar todas las notas de un acorde (cada una dentro de su propia ventana de juicio, con
      ±80ms de tolerancia entre sí) incrementa la racha de acordes; cada 5 acordes consecutivos
      completos otorgan +200 puntos y suben el tope del multiplicador de `×5` a `×6` hasta que la
      racha se rompe.
- [ ] Fallar una sola nota de un acorde resta una vida (como cualquier Fallo) sin hacer fallar en
      cascada a las demás notas del mismo acorde, y rompe la racha de acordes.
- [ ] El botón "PAUSA" y las teclas `P`/`Escape` congelan por completo `songTimeMs`, incluida la
      cuenta regresiva de cualquier power-up activo, confirmando el estado vía
      `onPauseChange(isPaused)`.
- [ ] Al presionar "JUGAR DE NUEVO", el engine se destruye y se vuelve a crear desde cero: notas,
      power-ups activos, racha de acordes, combo, puntaje (0), nivel (1), BPM inicial y vidas (3)
      quedan en su estado inicial.
- [ ] Salir de la partida limpia correctamente el engine (`destroy()` sin loops ni listeners
      colgando).
- [ ] `app/game-engines/registry.ts` incluye la entrada `'neon-beats': { createGame, width: 480,
    height: 640 }`, sin modificar `app/game/[id]/play/page.tsx` ni `GamePlayClient.tsx`.
- [ ] En `/game/neon-beats/play`, guardar la puntuación inserta una fila real en `scores`
      (`game_id: "neon-beats"`) vía `saveScore`.
- [ ] En `/game/neon-beats`, el título, descripción, leaderboard lateral, "Mejor global" y
      "Partidas" provienen de Supabase vía `getGame`/`getScores`/`getStats`.
- [ ] En `/hall-of-fame`, la pestaña "NEON BEATS" muestra las puntuaciones reales de `scores` para
      `game_id: "neon-beats"`.
- [ ] El resto del catálogo conserva exactamente su comportamiento actual, sin regresiones.
- [ ] Ningún elemento del tablero, incluidos los tres power-ups y el corchete de acorde, se dibuja
      como una única forma geométrica plana de un solo color; cada uno combina varias primitivas
      para sugerir textura o identidad.
- [ ] Cada power-up es visualmente distinguible entre sí y de una nota normal a simple vista
      (forma, color fijo y animación de idle propia por tipo).
- [ ] El corchete de acorde crece con anticipación al aparecer, pulsa con efecto de guiones en
      movimiento mientras está vigente, y reacciona (destello de éxito o parpadeo rojo) según el
      resultado del acorde.
- [ ] Todas las animaciones ya exigidas por la variante `core` (giro/pulso de idle de notas,
      parpadeo de peligro, squash-y-partículas al acertar, anillo de pulso del metrónomo,
      receptores sincronizados, scanlines desincronizados) siguen presentes y son perceptibles.
- [ ] Los fondos estáticos de carril y los sprites de gema/power-up por tipo están cacheados en
      `<canvas>` offscreen, no redibujados desde cero cada frame.
- [ ] El framerate se mantiene estable durante una partida larga con varios power-ups y acordes
      simultáneos en pantalla.
- [ ] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Los cinco callbacks estándar, sin agregar ninguno nuevo**, igual que la variante `core`: el
  estado de power-ups activos, la racha de acordes y el tope temporal del multiplicador se dibujan
  enteramente en el canvas — mismo criterio que Frogger aplicó a su temporizador interno en vez de
  generalizar `EngineCallbacks`/`registry.ts` por una sola variante de un solo juego.
- **`id`/categoría/cover idénticos a la variante `core`**, porque son alternativas de alcance del
  mismo juego, no juegos distintos.
- **Eje de power-ups elegido: Amplificador + Escudo + Ralentizador**, tres efectos con naturalezas
  claramente distintas (ofensivo/puntaje, defensivo/perdón de error, y de asistencia/tiempo) para
  que cada uno se sienta mecánicamente único y no una variación cosmética del mismo efecto. Se
  consideraron y descartaron: un power-up de "vida extra instantánea" (se prefirió que el escudo
  cumpla el rol defensivo sin regalar una vida directa, que se sintió demasiado generoso dado que
  las vidas ya son escasas — 3 —); y un power-up de "carril ancho" (agrandar temporalmente la
  ventana de juicio de un carril), descartado por redundar conceptualmente con el escudo.
- **Segundo eje elegido: acordes**, en vez de un enemigo/obstáculo nuevo (que no tiene un análogo
  natural en un juego de ritmo sin adversario) o un "jefe de ronda" (que exigiría una mecánica de
  patrón especial fuera del sistema de carriles ya establecido). Los acordes extienden
  directamente el sistema de juicio ya existente (múltiples notas, misma lógica de ventana) sin
  introducir un sistema paralelo, y encajan naturalmente con la referencia real del género
  (acordes/power-chords en Guitar Hero, pasos dobles en DDR).
- **Racha de acordes con bonificación de tope de multiplicador, en vez de puntos fijos únicamente**,
  para que los acordes tengan una recompensa que se sienta relacionada con el sistema de combo ya
  existente (subir el techo del multiplicador) en vez de ser un sistema de puntaje totalmente
  paralelo y desconectado.
- **Fallo de una nota de acorde no hace fallar a las demás**, decisión explícita para evitar que un
  solo error de sincronización cueste 2-3 vidas de golpe en niveles altos (donde los acordes de 3
  carriles son más frecuentes) — se consideró la alternativa de "todo o nada" (fallar una nota falla
  el acorde completo) y se descartó por punitiva en exceso para una variante que ya es más difícil
  que `core` por el volumen de notas simultáneas.
- **Amplificador reinicia duración en vez de acumular**, y **escudo no acumula cargas**, ambas
  decisiones para evitar que un jugador experto pueda encadenar amplificadores/escudos hasta volver
  el juego trivialmente fácil o el puntaje desproporcionado — mismo espíritu de "techo razonable"
  ya aplicado al multiplicador de combo.
- **Ralentizador no afecta notas ya en pantalla**, solo a las que nacen mientras está activo, para
  evitar que una nota cambie de velocidad mientras el jugador ya está calibrando su timing contra
  ella — un cambio de velocidad a mitad de camino sería una fuente de fallos "injustos" percibidos.
- **Estilo gráfico y animación de power-ups**: formas completamente distintas a la gema estándar
  (estrella, hexágono, reloj) en vez de simplemente recolorear la gema normal, porque un power-up
  debe distinguirse de una nota normal de forma instantánea sin depender del color (que ya varía
  por carril) — mismo criterio de "nunca ambigüedad visual entre tipos de elemento" ya aplicado por
  Frogger entre autos y camiones. Se descartó animar los power-ups con un brillo intermitente
  constante (en vez del giro/orbita/manecillas elegidos) porque un parpadeo constante compite
  visualmente con el parpadeo de "peligro" ya reservado para notas por vencer, y generaría
  ambigüedad entre "esto es un power-up" y "esto está por fallarse".
- **Corchete de acorde con efecto de guiones en movimiento**, en vez de una línea recta estática,
  para que se lea activamente como una instrucción ("presionar junto") y no como decoración pasiva
  — inspirado en el mismo principio de telegrafiado ya aplicado al parpadeo de las tortugas de
  Frogger, pero aplicado a una relación entre dos notas en vez de a un solo elemento.
- **Consumo directo de la capa de Supabase ya generalizada**, sin volver a generalizarla ni
  duplicarla — mismo criterio ya aplicado por los specs 08/09 y por Frogger.

## Riesgos identificados

- **Todos los riesgos ya documentados en la variante `core`** (deriva del reloj de BPM si
  `songTimeMs` no usa un acumulador cappeado, precisión de juicio dependiente del framerate, notas
  duplicadas por repetición de tecla, fugas de memoria por listeners no limpiados, doble invocación
  de `onGameOver`, progresión de BPM sin límite superior, canvas de tamaño fijo en layout
  responsive, RLS no definido) aplican igual aquí y se agravan por la mayor cantidad de estado
  concurrente (power-ups activos, acordes, racha de acordes).
- **Detección de acordes por presiones no perfectamente simultáneas**: dos `keydown` de teclas
  físicas distintas nunca llegan en el mismo tick exacto del navegador, incluso si el jugador las
  presiona "a la vez". Mitigación: la tolerancia de ±80ms entre las notas de un mismo acorde (ya
  definida en el Alcance) debe evaluarse comparando los timestamps de `songTimeMs` de cada
  `keydown` individual, no exigiendo que ambos ocurran en el mismo frame de animación.
- **Power-up y acorde compitiendo por el mismo `hitTime`**: si el generador de chart no excluye
  explícitamente que una nota de power-up participe de un grupo de acorde, un acorde con una nota
  de power-up mezclada complicaría el juicio (¿el efecto se aplica si solo se acierta esa nota y se
  falla el resto del acorde?) de forma ambigua. Mitigación: el generador debe garantizar que
  ninguna nota de power-up comparta `hitTime` con un grupo de acorde.
- **Interacción entre el escudo y el fin de partida**: si un Fallo que reduciría las vidas a 0
  ocurre en el mismo instante en que el escudo debería absorberlo, el orden de evaluación debe
  aplicar primero la absorción del escudo (si hay una carga disponible) antes de evaluar
  `onGameOver`, para que el jugador nunca pierda por un Fallo que el juego le indicó visualmente
  que estaba protegido.
- **Costo de dibujo por frame agravado por power-ups y acordes simultáneos**: en niveles altos, con
  varios power-ups activos (cada uno con su insignia de cuenta regresiva) y acordes de 3 carriles
  con su corchete animado, el trabajo de dibujo por frame crece respecto a la variante `core`.
  Mitigación: mismo patrón de cachés offscreen ya descrito (fondo de carril, sprites de gema y de
  power-up por tipo/color precalculados), y mantener el pool de partículas de impacto fijo en 24
  elementos compartido entre todos los tipos de nota.
- **Contraste/legibilidad de las insignias de estado de power-up superpuestas**: con los tres
  power-ups activos a la vez, sus insignias (esquina superior derecha, junto a vidas, junto al HUD
  interno) podrían saturar visualmente una zona pequeña del canvas. Mitigación: reservar posiciones
  fijas y no superpuestas para cada insignia desde el diseño, verificado explícitamente en el paso
  de verificación manual con los tres power-ups activos simultáneamente.
