# Integración de Puzzle Bobble — variante powerups-racha (motor + leaderboard)

**Estado:** Borrador
**Depende de:** 04-integracion-supabase (clientes de Supabase); consume la capa ya generalizada
por 07-tetris-motor-leaderboard (`getGames`/`getGame`/`getScores`/`getStats`/`saveScore`,
`GAME_ENGINES`) sin volver a generalizar nada.
**Alternativa a:** `specs/game-jam/puzzle-bobble/01-puzzle-bobble-core.md` — mismo `id`, distinto
alcance; son mutuamente excluyentes, se implementa solo uno.
**Fecha:** 2026-07-29
**Objetivo:** Construir desde cero el motor de Puzzle Bobble con burbujas especiales obligatorias
(bomba, arcoíris y congelante) más un sistema de racha de precisión con multiplicador de puntaje
(3 vidas y niveles con objetivo de despeje total y dificultad creciente) dentro de un `<canvas>` en
`/game/puzzle-bobble/play`, dibujado con gráficos procedurales detallados (mismo estándar gráfico
que la variante `core`) y animaciones simples, notificando a React los cambios de puntaje, vidas y
nivel, y persistir sus puntuaciones vía la capa de datos genérica ya existente.

## Alcance

**Dentro del alcance:**

- **Nueva fila semilla en la tabla `games` de Supabase** (vía `apply_migration`, mismo esquema ya
  existente de `games`/`scores`, sin cambios de columnas): `id: "puzzle-bobble"`,
  `title: "PUZZLE BOBBLE"`, `cat: "PUZZLE"`, `cover: "cover-bg"`, `color: "yellow"`. Es la misma fila
  semilla que definiría la variante `core` — son alternativas del mismo `id`, no coexisten.
- **Sin cover temático nuevo diseñado en este spec**: idéntico razonamiento y placeholder que la
  variante `core` (`cover-bg`) — ver justificación completa en
  `specs/game-jam/puzzle-bobble/01-puzzle-bobble-core.md`.
- **Todo el detalle gráfico y de animación ya descrito en la variante `core`** (burbujas Gota/Rubí/
  Esmeralda/Topacio con facetas y brillo, cañón con anticipación/estiro, guía de trayectoria,
  paredes texturizadas, línea de peligro pulsante, HUD interno) — el estándar gráfico es idéntico
  entre variantes, nunca se reduce en `core` ni se usa como parte de lo que distingue a `feature`.
  Sumado a lo anterior, esta variante agrega el detalle visual de los 3 tipos de burbuja especial y
  del indicador de racha (ver a continuación).
- **Motor construido desde cero** (sin `game.js` de referencia) en
  `app/game-engines/puzzle-bobble/engine.ts`, exponiendo `createGame(canvas, callbacks)` con
  `pause()`/`resume()`/`destroy()`, mismo patrón que `asteroids`/`tetris`/`arkanoid`/`snake`/
  `frogger`/`match-three`. Incluye todo lo ya descrito como base común en la variante `core` (canvas
  480×640, grid hexagonal 10 columnas de 40px, cañón con apuntado 10°–170°, disparo con rebote,
  anclaje a celda más cercana, detección de clusters de 3+, caída de burbujas flotantes, puntuación
  base por tamaño de cluster, descenso periódico del techo, niveles por despeje total, 3 vidas por
  línea de peligro) más el eje de profundidad de esta variante:

  - **Burbuja especial "Bomba"** (aparece en el grid, reemplazando una burbuja normal al generarse
    una fila nueva, con `12%` de probabilidad por burbuja generada desde el nivel 1): al ser
    incluida en un cluster resuelto (3+ del mismo color que la bomba adoptó al generarse, ya que
    visualmente combina su propio color base con un ícono de bomba) o al ser impactada directamente
    por la burbuja disparada sin formar cluster, **detona** destruyendo todas las burbujas
    adyacentes en un radio de 1 celda alrededor de su posición, sin importar su color, sumando `15`
    puntos por cada burbuja destruida por la explosión (además del puntaje normal de cualquier
    cluster que la haya incluido). **Duración**: si no es impactada ni incluida en un cluster
    dentro de los `15` segundos desde que aparece en el grid, detona automáticamente en su lugar
    (mismo efecto de radio 1, sin bono de cluster). **Dibujo**: círculo base del color que adoptó al
    generarse, con un ícono de mecha encendida (línea corta ondulada saliendo de un punto superior)
    y un contorno punteado rojo distintivo que la diferencia de una burbuja normal del mismo color.
    **Telegrafiado de vencimiento**: en los últimos `3` segundos antes de detonar automáticamente, el
    contorno punteado parpadea en rojo con frecuencia creciente (de un parpadeo lento a uno rápido)
    para advertir la detonación inminente.
  - **Burbuja especial "Arcoíris"** (aparece en el grid con `8%` de probabidad por burbuja generada
    desde el nivel 1): cuenta como **comodín de color** al evaluarse cualquier cluster que la
    incluya — se une al cluster del color de cualquier burbuja adyacente, sin importar cuál sea,
    permitiendo conectar grupos de colores distintos a través de ella. **Duración**: si permanece sin
    ser incluida en ningún cluster resuelto durante `20` segundos desde que aparece, **se solidifica**
    en un color fijo elegido al azar entre los 4 tipos base, perdiendo su propiedad de comodín.
    **Dibujo**: círculo base con un gradiente cónico multicolor (barrido de los 4 colores base
    alrededor de su circunferencia) más un brillo blanco central pulsante, claramente distinta de
    cualquier burbuja de color único. **Telegrafiado de vencimiento**: en los últimos `5` segundos
    antes de solidificarse, el gradiente cónico gira cada vez más lento (de un giro rápido a
    detenerse casi por completo justo antes de fijar su color final), comunicando visualmente que
    está a punto de perder su propiedad de comodín.
  - **Burbuja especial "Congelante"** (aparece en el grid con `10%` de probabilidad por burbuja
    generada desde el nivel 1): al ser incluida en un cluster resuelto, **retrasa el próximo
    descenso del techo** sumando `3` disparos adicionales a `shotsUntilDrop` (el contador de
    disparos restantes hasta que el grid baje una fila), sin sumar puntaje adicional propio más allá
    del puntaje normal del cluster que la incluyó. **Duración**: si no es incluida en ningún cluster
    dentro de los `18` segundos desde que aparece, se convierte silenciosamente en una burbuja
    normal de un color aleatorio (pierde su efecto de retraso). **Dibujo**: círculo base con un tono
    cian pálido translúcido, cristales de escarcha dibujados como líneas cortas irradiando desde el
    borde hacia el centro, y un halo exterior azulado tenue. **Telegrafiado de vencimiento**: en los
    últimos `4` segundos antes de perder su efecto, el halo azulado se atenúa progresivamente
    (de brillante a casi imperceptible) hasta desaparecer justo cuando la burbuja se vuelve normal.
  - **Sistema de racha de precisión con multiplicador** (segundo eje de profundidad): cada disparo
    que resuelve al menos un cluster de 3+ (sin contar la caída de burbujas flotantes) sin fallar
    (es decir, sin anclarse sin formar cluster) incrementa un contador de racha en 1; un disparo
    que se ancla sin formar ningún cluster reinicia la racha a 0. El multiplicador de puntaje
    aplicado a **todo** el puntaje de ese disparo (puntaje base del cluster + bono de tamaño + bono
    de burbujas caídas + cualquier bono de burbuja especial) es `1×` con racha `0`–`1`, `1.5×` con
    racha `2`–`3`, `2×` con racha `4`–`5`, `3×` con racha `6` o más, redondeando el puntaje final
    hacia abajo al entero más cercano. **Indicador visual**: un contador de racha ("RACHA x`N`" con
    el multiplicador vigente) dibujado en la franja superior de HUD interno junto al indicador de
    nivel, con un breve destello de escala (pop) cada vez que la racha sube, y un parpadeo rojo
    breve cuando la racha se reinicia a 0 por un disparo fallido.

- **Callbacks conectados**: `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`,
  `onLevelChange` — los mismos cinco de la variante `core`, sin un callback nuevo para power-ups o
  racha (ver "Decisiones").
- **Pausa real con doble camino**: idéntica a la variante `core`; adicionalmente, mientras el juego
  está en pausa, los temporizadores de vencimiento de las burbujas especiales (bomba, arcoíris,
  congelante) tampoco avanzan.
- **Montaje genérico**: idéntico a la variante `core` — la misma entrada `"puzzle-bobble": {
createGame, width: 480, height: 640 }` en `app/game-engines/registry.ts` (`GAME_ENGINES`), ya que
  ambas variantes comparten dimensiones de canvas.
- **Consumo de la capa de datos ya generalizada**: idéntico a la variante `core` — sin cambios
  propios en `queries.ts`/`actions.ts`.

**Fuera de alcance (para otros specs):**

- **La variante `core` de este mismo juego** (`specs/game-jam/puzzle-bobble/01-puzzle-bobble-core.md`):
  sin power-ups, sin sistema de racha/multiplicador — es la alternativa mutuamente excluyente a este
  spec.
- Power-ups adicionales no descritos aquí (p. ej. una burbuja "láser" que dispara en línea recta sin
  rebotar, o una burbuja que invierte los controles del rival en un modo versus) — se consideraron y
  se descartaron para mantener el eje de profundidad de esta variante enfocado en 3 power-ups bien
  definidos más la racha, sin acumular mecánicas adicionales no relacionadas.
- Vida extra por puntaje — mismo criterio que `core`, se mantiene fuera en ambas variantes.
- Apuntado o disparo por mouse/drag — el control es exclusivamente por teclado, idéntico a `core`.
- Soporte táctil/móvil (solo teclado).
- Sonido (no se proveyeron ni se diseñan assets de audio en esta variante).
- Políticas RLS en `games`/`scores` — mismo pendiente ya documentado en specs 05/06/07/08/09,
  Frogger y Match Three.
- Supabase Auth real / relación de `scores.user_id` con un usuario autenticado.
- Cambios visuales en `Podium.tsx`/`Leaderboard.tsx`/`GameCard.tsx`/`MiniCard`.
- Adaptar cualquier otro juego de `references/started-games/` — este spec cubre únicamente esta
  variante de Puzzle Bobble.
- **Sprites, spritesheets o cualquier imagen externa**: el detalle visual de las 3 burbujas
  especiales (mecha, gradiente cónico, cristales de escarcha) es enteramente procedural, generado
  con primitivas de canvas en tiempo de dibujo (o cacheado en `<canvas>` offscreen cuando su
  contenido no depende del temporizador de vencimiento) — no se cargan ni se generan archivos de
  imagen.
- **Efectos gráficos pesados**: sistemas de partículas grandes (p. ej. explosión de la bomba con
  decenas de fragmentos), sombras dinámicas o post-procesado — la detonación de la bomba se resuelve
  con un flash de escala y un pool fijo acotado de hasta 8 fragmentos simples por detonación (ver
  "Decisiones"), sin motor de partículas costoso.
- **Diseño de un `cover-bubbles` dedicado** — mismo placeholder `cover-bg` que la variante `core`.
- Ajustes de responsive/CSS del contenedor `crt`/`crt-screen` para encajar un sexto tamaño de canvas
  — mismo pendiente ya anotado en specs 05/07/08/09, Frogger y Match Three.

## Modelo de datos

- **`app/game-engines/puzzle-bobble/engine.ts`** — módulo nuevo, sin estado global de módulo. Todo
  lo ya listado en la variante `core` (grid, cañón, burbuja en vuelo, cadencia de descenso, score,
  vidas, nivel, estado de pausa, cachés offscreen y listeners encapsulados dentro del closure de
  `createGame`) más:

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

  Estructuras adicionales respecto a `core`:
  - Cada `Bubble` del grid gana un campo `special: 'none' | 'bomb' | 'rainbow' | 'freeze'` y, cuando
    `special !== 'none'`, un campo `specialSpawnedAt: number` (timestamp del loop en que apareció,
    usado para calcular su temporizador de vencimiento) y `specialProgress: number` (0→1, progreso
    hacia el vencimiento, usado para el telegrafiado de parpadeo/giro/atenuación).
  - `streak: { count: number; multiplier: 1 | 1.5 | 2 | 3 }`, actualizado tras cada disparo resuelto
    (con o sin cluster).
  - **Cachés offscreen adicionales**: un sprite offscreen por cada uno de los 3 tipos de burbuja
    especial en su estado "fresca" (recién aparecida, sin telegrafiado activo) — el telegrafiado de
    vencimiento (parpadeo/giro/atenuación) se dibuja como una capa adicional en tiempo real sobre el
    sprite cacheado, ya que sí depende del tiempo transcurrido y no puede hornearse por completo.
  - **Pool fijo de fragmentos de detonación**: un arreglo de hasta 8 fragmentos reutilizables
    (posición, velocidad, vida restante) activado únicamente al detonar una bomba, nunca creciendo
    más allá de ese tope fijo por detonación.

  - `onScoreChange` se invoca tras resolver cada cluster (con el bono de tamaño, el multiplicador de
    racha vigente ya aplicado, y cualquier bono de burbuja especial incluida), tras cada caída de
    burbujas flotantes (con el multiplicador de racha del disparo que las originó), y tras cada
    detonación de bomba (con el bono de burbujas destruidas por la explosión, también multiplicado
    por la racha vigente de ese disparo).
  - `onLivesChange`/`onGameOver`/`onLevelChange`/`onPauseChange` se comportan exactamente igual que
    en la variante `core` — el sistema de power-ups y racha no introduce nuevas causas de pérdida de
    vida ni de cambio de nivel.

- **Fila semilla en `games`** (SQL de la migración, idéntica a la definida en la variante `core`,
  mismo esquema ya existente de `games`/`scores`, sin cambios de columnas):

  ```sql
  insert into games (id, title, short, long, cat, cover, color) values (
    'puzzle-bobble', 'PUZZLE BOBBLE',
    'Dispara burbujas de colores y forma clusters de 3 o más antes de que lleguen a tu cañón.',
    'Rota tu cañón y dispara burbujas de colores que rebotan en las paredes hasta anclarse en el grid hexagonal. Usa burbujas bomba, arcoíris y congelante para despejar el tablero antes de que la pila alcance la línea de peligro, y encadena aciertos para multiplicar tu puntaje.',
    'PUZZLE', 'cover-bg', 'yellow'
  );
  ```

- **`app/game-engines/registry.ts`**: idéntico a la variante `core` — la entrada
  `"puzzle-bobble": { createGame: puzzleBobbleCreateGame, width: 480, height: 640 }` se agrega una
  sola vez, según cuál de las dos variantes se implemente.

- `app/lib/supabase/queries.ts`/`actions.ts` no cambian de firma: `getGames`/`getGame`/`getScores`/
  `getStats`/`saveScore` ya son genéricas por `gameId` desde el spec 07; esta variante solo las
  consume.

## Plan de implementación

1. **Crear la migración de Supabase** (vía MCP `apply_migration`) que inserta la fila semilla de
   `"puzzle-bobble"` en `games` (idéntica a la de `core`, no se recrea si ya existe de una
   implementación previa de la otra variante). El sistema queda funcional: la fila existe en
   Supabase.
2. **Implementar la base común de la variante `core`** (pasos 2 a 9 de
   `01-puzzle-bobble-core.md`: grid, cañón, apuntado y disparo, anclaje, clusters, caída de
   burbujas flotantes, descenso de techo, niveles por despeje, vidas por línea de peligro,
   callbacks, pausa, registro en `GAME_ENGINES`). El sistema queda funcional de punta a punta como
   la variante `core`, sirviendo de base sobre la que se agregan power-ups y racha.
3. **Agregar generación y dibujo de las 3 burbujas especiales** — al generar cada burbuja nueva
   (fila inicial o descenso de techo), asignar `special: 'bomb' | 'rainbow' | 'freeze' | 'none'`
   según las probabilidades definidas (12%/8%/10%/resto normal), registrar `specialSpawnedAt`, y
   dibujar cada tipo con su estilo distintivo (mecha+contorno punteado, gradiente cónico, cristales
   de escarcha) sobre el sprite base de su color. El sistema queda funcional: las burbujas
   especiales son visualmente distinguibles en el grid, de forma aislada, aunque su efecto todavía
   no se dispare.
4. **Agregar efecto de la burbuja Arcoíris (comodín de color)** — modificar la evaluación de
   clusters para que una burbuja `rainbow` se una al color de cualquier vecino adyacente al
   evaluar conectividad, permitiendo formar clusters mixtos a través de ella. El sistema queda
   funcional: los clusters que incluyen una burbuja arcoíris se resuelven correctamente de forma
   aislada.
5. **Agregar efecto de la burbuja Bomba (detonación en radio)** — al resolver un cluster que incluya
   una bomba, o al ser impactada directamente sin formar cluster, destruir todas las burbujas en un
   radio de 1 celda alrededor de su posición, sumando 15 puntos por burbuja destruida, activando
   hasta 8 fragmentos del pool fijo para el efecto visual de explosión. El sistema queda funcional:
   la detonación de bomba funciona de forma aislada, con su efecto visual acotado.
6. **Agregar efecto de la burbuja Congelante (retraso del descenso)** — al resolver un cluster que
   incluya una congelante, sumar 3 disparos a `shotsUntilDrop`. El sistema queda funcional: el
   retraso del descenso del techo es observable de forma aislada tras incluir una congelante en un
   cluster.
7. **Agregar temporizadores de vencimiento y su telegrafiado** — decrementar el tiempo restante de
   cada burbuja especial activa (bomba: 15s con parpadeo en los últimos 3s y detonación automática
   al expirar; arcoíris: 20s con giro decreciente en los últimos 5s y solidificación a color
   aleatorio al expirar; congelante: 18s con atenuación de halo en los últimos 4s y conversión a
   normal al expirar), deteniéndose mientras el juego está en pausa. El sistema queda funcional: cada
   power-up vence correctamente con su telegrafiado visible, de forma aislada.
8. **Agregar el sistema de racha de precisión y multiplicador** — incrementar el contador de racha
   en cada disparo que resuelve al menos un cluster, reiniciarlo a 0 en cada disparo que se ancla
   sin formar cluster, calcular el multiplicador vigente (`1×`/`1.5×`/`2×`/`3×` según los umbrales
   de racha) y aplicarlo a todo el puntaje generado por ese disparo (cluster + bono de tamaño + bono
   de burbujas caídas + bono de burbuja especial), redondeando hacia abajo. El sistema queda
   funcional: la racha y su multiplicador se aplican correctamente al puntaje de forma aislada.
9. **Conectar el indicador visual de racha en el HUD interno** — dibujar "RACHA x`N`" junto al
   indicador de nivel en la franja superior, con destello de escala al subir y parpadeo rojo al
   reiniciarse. El sistema queda funcional: el jugador puede ver su racha y multiplicador vigente en
   todo momento.
10. **Verificación manual y build** — jugar una partida completa en `/game/puzzle-bobble/play`
    confirmando: todo lo ya verificado en la variante `core` (apuntado, disparo, rebote, anclaje,
    clusters, caída, descenso de techo, niveles, vidas, pausa, guardado de puntuación), más:
    detonación de bomba con radio correcto y vencimiento automático con parpadeo previo, arcoíris
    conectando clusters de colores distintos y solidificándose con giro decreciente si no se usa,
    congelante retrasando el descenso del techo y perdiendo su efecto con halo atenuado si no se usa,
    racha subiendo con disparos consecutivos exitosos y reiniciándose con un disparo fallido, y el
    multiplicador aplicándose correctamente al puntaje total de cada disparo. Confirmar también el
    detalle visual (cada power-up identificable de un vistazo, telegrafiado de vencimiento
    perceptible, indicador de racha legible) y que el framerate se mantiene estable durante una
    partida larga con detonaciones de bomba frecuentes. Confirmar que el resto del catálogo no tiene
    regresiones. Ejecutar `npm run build` sin errores de TypeScript ni de ESLint. El sistema queda
    funcional y verificado de punta a punta.

## Criterios de aceptación

- [ ] Todos los criterios de aceptación de la variante `core` aplican igual aquí (fila semilla,
      estructura del engine, callbacks, controles, rebote/anclaje/clusters/caída, descenso de
      techo, niveles por despeje, vidas por línea de peligro, pausa dual, registro en
      `GAME_ENGINES`, persistencia real de puntuación, sin regresiones en el resto del catálogo).
- [ ] Las burbujas especiales (bomba, arcoíris, congelante) aparecen en el grid con las
      probabilidades definidas (12%/8%/10%) al generarse cada burbuja nueva, y son visualmente
      distinguibles entre sí y de las burbujas normales según lo descrito en el Alcance.
- [ ] Incluir una burbuja Bomba en un cluster resuelto (o impactarla directamente) la detona,
      destruyendo todas las burbujas en un radio de 1 celda y sumando 15 puntos por cada una
      destruida por la explosión.
- [ ] Una burbuja Bomba no impactada ni incluida en un cluster dentro de 15 segundos detona
      automáticamente, con su contorno punteado parpadeando en rojo con frecuencia creciente en los
      últimos 3 segundos antes de la detonación automática.
- [ ] Una burbuja Arcoíris incluida en la evaluación de un cluster se une correctamente al color de
      cualquier vecino adyacente, permitiendo formar clusters de colores mixtos a través de ella.
- [ ] Una burbuja Arcoíris no incluida en ningún cluster dentro de 20 segundos se solidifica en un
      color fijo aleatorio, con su gradiente cónico girando cada vez más lento en los últimos 5
      segundos antes de solidificarse.
- [ ] Incluir una burbuja Congelante en un cluster resuelto suma 3 disparos a `shotsUntilDrop`
      (retrasa el próximo descenso del techo), sin puntaje adicional propio.
- [ ] Una burbuja Congelante no incluida en ningún cluster dentro de 18 segundos se convierte en una
      burbuja normal de color aleatorio, con su halo azulado atenuándose progresivamente en los
      últimos 4 segundos antes de perder su efecto.
- [ ] Cada disparo que resuelve al menos un cluster incrementa el contador de racha en 1; cada
      disparo que se ancla sin formar cluster reinicia la racha a 0.
- [ ] El multiplicador de puntaje vigente (`1×` con racha 0–1, `1.5×` con racha 2–3, `2×` con racha
      4–5, `3×` con racha 6+) se aplica correctamente a todo el puntaje generado por cada disparo
      (cluster + bono de tamaño + bono de burbujas caídas + bono de burbuja especial), redondeado
      hacia abajo.
- [ ] El indicador "RACHA x`N`" es visible en la franja superior del canvas, se actualiza en tiempo
      real, destella al subir y parpadea en rojo al reiniciarse.
- [ ] Ningún elemento del tablero (incluidas las 3 burbujas especiales y el indicador de racha) se
      dibuja como una única forma geométrica plana de un solo color; cada uno combina varias
      primitivas para sugerir textura o identidad, según lo descrito en el Alcance.
- [ ] La detonación de una burbuja Bomba usa un pool fijo de hasta 8 fragmentos reutilizables, sin
      crecer más allá de ese tope por detonación.
- [ ] Los 3 tipos de burbuja especial y su telegrafiado de vencimiento son perceptibles y
      distinguibles entre sí y de las burbujas normales, incluso con el grid lleno.
- [ ] El framerate se mantiene estable durante una partida larga con detonaciones de bomba
      frecuentes y varios niveles superados.
- [ ] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Motor construido desde cero**, sin `game.js` de referencia (mismo criterio que la variante
  `core` y que Snake/Frogger/Match Three).
- **`id: "puzzle-bobble"`**, idéntico al de la variante `core` — ambas variantes comparten
  exactamente el mismo `id`/`title`/categoría/cover, porque son alternativas de alcance del mismo
  juego, no juegos distintos.
- **Callbacks: los cinco estándar, sin uno nuevo para power-ups o racha**, igual criterio que Match
  Three `feature` (combo de cascadas) y Frogger `niveles` (temporizador) — los power-ups y el
  indicador de racha son elementos puramente visuales/internos del engine, no necesitan ser fuente
  de verdad para React, evitando generalizar `EngineCallbacks` por una sola variante de un solo
  juego.
- **Power-ups elegidos: Bomba, Arcoíris, Congelante** — se eligieron por cubrir tres efectos
  claramente distintos y complementarios del género (destrucción de área, comodín de conectividad,
  alivio de presión temporal), cada uno con una mecánica de juego real más allá de solo "puntos
  extra". Se consideraron y descartaron: una burbuja "láser" que dispara en línea recta sin rebotar
  (redundante con el comodín de la arcoíris en cuanto a "facilitar un cluster difícil", sin aportar
  un efecto lo bastante distinto) y una burbuja que reduce temporalmente el tamaño mínimo de cluster
  a 2 (se consideró demasiado poderosa y difícil de balancear sin pruebas de juego reales).
  Descartadas explícitamente porque el jam no permite iterar con el usuario para balancear más de
  tres power-ups en una sola pasada.
- **Segundo eje de profundidad: racha de precisión con multiplicador**, en vez de una mecánica de
  "modo extra" o "jefe de ronda", porque encaja naturalmente con la mecánica de disparo turno-a-turno
  de Puzzle Bobble (cada disparo es un evento discreto de acierto/fallo, ideal para un contador de
  racha) — mismo espíritu que el combo de cascadas de Match Three `feature`, pero adaptado a la
  unidad de "disparo" en vez de "movimiento de swap". Se consideró un "modo contrarreloj" alternativo
  (temporizador global en vez de por techo) y se descartó por redundar con el descenso periódico del
  techo ya presente en `core`, que ya cumple ese rol de presión temporal.
  - **Por qué este alcance corresponde a `feature`**: los 3 power-ups (cada uno con
    aparición/duración/efecto/dibujo/telegrafiado propios) más la racha de precisión con multiplicador
    son el eje de profundidad que distingue a esta variante de `core`, que es deliberadamente la
    versión sin ninguno de los dos. El estándar gráfico/animación no cambia entre variantes — solo la
    profundidad de la mecánica.
- **Probabilidades de aparición (12% bomba, 8% arcoíris, 10% congelante) fijas desde el nivel 1**,
  en vez de escalar con el nivel como los tipos de gema de Match Three, porque los power-ups de
  Puzzle Bobble son un alivio/herramienta más que una dificultad creciente — se decidió que su
  frecuencia no necesita variar por nivel para esta variante (posible ajuste futuro fuera de
  alcance).
- **Temporizadores de vencimiento distintos por power-up (15s/20s/18s)**, en vez de un valor único
  compartido, para que cada power-up tenga una ventana de uso ligeramente distinta acorde a su
  poder relativo (la bomba, más destructiva, vence más rápido que el arcoíris, más situacional).
- **Multiplicador de racha en 4 escalones (1×/1.5×/2×/3×)**, en vez de un multiplicador lineal
  continuo, para que el HUD interno pueda mostrar un número simple y legible ("RACHA x`N`") en vez de
  un decimal cambiante constantemente.
- **Pool fijo de 8 fragmentos para la detonación de bomba**, en vez de un sistema de partículas sin
  límite, siguiendo el presupuesto de rendimiento del jam (se permite un efecto puntual con pool fijo
  si se justifica y acota explícitamente su cantidad, ver "Dirección gráfica y de animación" del
  jam) — 8 fragmentos son suficientes para comunicar una explosión sin costo significativo por
  frame, incluso con varias detonaciones simultáneas en niveles avanzados.
- **Telegrafiado de vencimiento dibujado como capa en tiempo real sobre un sprite cacheado**, en vez
  de invalidar y regenerar el caché offscreen del power-up en cada frame, para mantener el costo de
  dibujo acotado — el sprite base (color + ícono distintivo) se cachea una sola vez por burbuja al
  aparecer, y solo la capa de parpadeo/giro/atenuación se recalcula por frame.
- **Estilo gráfico y de animación de los power-ups**: 100% procedural (mecha ondulada, gradiente
  cónico, cristales de escarcha), mismo criterio de "cero assets externos" que el resto del
  catálogo. Se consideró un ícono con imagen prerenderizada por power-up y se descartó por romper la
  regla dura de "sin assets externos" del jam.
- **Resto de decisiones (canvas, controles, paleta, `cover-bg`, pausa dual, consumo de Supabase)
  idénticas a la variante `core`** — ver `01-puzzle-bobble-core.md` para su justificación completa,
  no se repiten aquí por no divergir entre variantes.

## Riesgos identificados

- **Todos los riesgos ya documentados en la variante `core`** (anclaje impreciso, rebote mal
  calculado, adyacencia hexagonal incorrecta, doble conteo de puntaje en cascadas, condición de
  carrera entre nivel completado y línea de peligro, `dt` sin cap, listeners no limpiados, doble
  invocación de `onGameOver`, teclas con comportamiento por defecto, costo de dibujo por detalle
  visual, contraste entre tipos de burbuja, canvas de tamaño fijo, RLS no definido) aplican igual
  aquí y se agravan por el estado adicional de power-ups y racha.
- **Detonación de bomba en cadena (bomba que destruye a otra bomba en su radio)**: si la destrucción
  por radio no evalúa correctamente si una de las burbujas destruidas es a su vez otra bomba, podría
  generarse una reacción en cadena no intencional o, en el otro extremo, una bomba destruida por otra
  podría no notificar su propio puntaje. Mitigación: decidir explícitamente en la implementación si
  las detonaciones encadenan (recomendado, ya que refuerza la mecánica) y sumar el puntaje de cada
  detonación individualmente, evitando doble conteo.
- **Condición de carrera entre vencimiento automático de un power-up y su inclusión en un cluster en
  el mismo frame**: si una burbuja bomba/arcoíris/congelante es incluida en un cluster resuelto en el
  mismo instante en que su temporizador de vencimiento expira, el orden de evaluación podría aplicar
  ambos efectos (el de cluster y el de vencimiento automático) sobre la misma burbuja. Mitigación:
  evaluar primero si la burbuja fue incluida en un cluster de ese disparo (su efecto de cluster tiene
  prioridad) antes de evaluar el vencimiento de temporizador para el resto de burbujas especiales
  activas en el grid.
- **Reinicio de racha por un disparo que rebota fuera del grid sin anclarse** (caso límite si el
  rebote llevara la burbuja fuera del área de juego por un error de física): debe tratarse igual que
  cualquier disparo sin cluster, reiniciando la racha, para no dejar el contador en un estado
  ambiguo. Mitigación: todo disparo que termina en un anclaje se clasifica explícitamente como
  "con cluster" o "sin cluster" antes de actualizar la racha, sin estados intermedios.
- **Desincronización entre los temporizadores de vencimiento de power-ups y el `dt` cappeado del
  loop**: si el conteo regresivo de cada power-up no usa el mismo `dt` cappeado que el resto de
  animaciones, su vencimiento podría depender del framerate real del dispositivo, haciendo que un
  power-up dure más o menos tiempo real según el rendimiento. Mitigación: derivar el progreso de
  vencimiento del mismo acumulador de tiempo cappeado usado por el resto del engine.
- **Costo de dibujo adicional por múltiples power-ups activos simultáneamente**: con hasta 3 tipos de
  power-up activos a la vez más sus capas de telegrafiado en tiempo real, el costo por frame es
  mayor que en la variante `core`. Mitigación: mantener el sprite base de cada power-up cacheado
  (según el Modelo de datos) y limitar la capa de telegrafiado a operaciones baratas (alpha, ángulo
  de rotación), sin recomponer las primitivas completas del power-up en cada frame.
- **Multiplicador de racha aplicado de forma inconsistente entre el puntaje de cluster y el de
  burbujas caídas del mismo disparo**: si solo una parte del puntaje de un disparo aplica el
  multiplicador vigente, el jugador percibiría un cálculo de puntaje incoherente. Mitigación: calcular
  el puntaje total del disparo (cluster + bonos + power-ups) antes de aplicar el multiplicador una
  única vez sobre el total, nunca sobre componentes individuales por separado.
