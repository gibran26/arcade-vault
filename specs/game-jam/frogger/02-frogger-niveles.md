# Integración de Frogger — variante niveles (motor + leaderboard)

**Estado:** Borrador
**Depende de:** 04-integracion-supabase (clientes de Supabase); consume la capa ya generalizada
por 07-tetris-motor-leaderboard (`getGames`/`getGame`/`getScores`/`getStats`/`saveScore`,
`GAME_ENGINES`) sin volver a generalizar nada.
**Alternativa a:** `specs/game-jam/frogger/01-frogger-core.md` — mismo `id`, distinto alcance; son
mutuamente excluyentes, se implementa solo uno.
**Fecha:** 2026-07-21
**Objetivo:** Construir desde cero el motor de Frogger con rondas progresivas (3 vidas, 5 huecos de
meta que hay que llenar por completo, temporizador por intento, tortugas que se sumergen y
dificultad creciente por ronda) dentro de un `<canvas>` en `/game/frogger/play`, notificando a
React los cambios de puntaje, vidas y nivel, y persistir sus puntuaciones vía la capa de datos
genérica ya existente.

## Alcance

**Dentro del alcance:**

- **Nueva fila semilla en la tabla `games` de Supabase** (vía `apply_migration`, mismo esquema ya
  existente de `games`/`scores`, sin cambios de columnas): `id: "frogger"`, `title: "FROGGER"`,
  `cat: "ARCADE"`, `cover: "cover-rana"`, `color: "green"`. Se suma a las filas ya existentes
  (`asteroids`, `tetris`, `arkanoid`, `snake`). Es la misma fila semilla que definiría la variante
  `core` — son alternativas del mismo `id`, no coexisten.
- **Sin assets gráficos externos**: el sapo, los troncos, las tortugas, los vehículos y las
  franjas de césped/agua/meta se dibujan con primitivas de canvas (rectángulos y círculos), usando
  la paleta de colores neón ya definida en `globals.css` (variables `--cyan`/`--green`/
  `--yellow`/`--magenta`) — mismo criterio que Tetris/Arkanoid dibujando sus piezas/bloques sin
  sprites. Un pequeño indicador de tiempo restante (barra que se encoge) se dibuja directamente en
  la franja superior del canvas, como único elemento de "HUD interno" — mismo patrón ya usado por
  Tetris para su panel lateral, aquí reducido a un solo indicador porque score/vidas/nivel ya los
  cubre el HUD de React.
- **Motor construido desde cero** (sin `game.js` de referencia, igual que Snake) en
  `app/game-engines/frogger/engine.ts`, exponiendo `createGame(canvas, callbacks)` con
  `pause()`/`resume()`/`destroy()`, mismo patrón que `asteroids`/`tetris`/`arkanoid`/`snake`.
  Incluye todo lo ya descrito como base común en la variante `core` (canvas 560×520, grilla 14×13
  celdas de 40px, 5 filas de río con troncos, franja mediana, 5 filas de carretera con vehículos,
  franja de salida, movimiento por salto discreto, arrastre sobre troncos, puntuación de 10 pts por
  fila nueva alcanzada y 50 pts por hueco de meta válido) más el eje de profundidad de esta
  variante:
  - **5 huecos de meta que se marcan como ocupados**: al aterrizar en un hueco válido y libre de la
    fila de meta, ese hueco se marca visualmente como ocupado (un sapo pequeño dibujado ahí) y ya
    no puede volver a usarse en la ronda actual; aterrizar en un hueco ya ocupado se trata como
    aterrizaje inválido (misma consecuencia letal que caer en agua fuera de un hueco).
  - **Ronda completa**: cuando los 5 huecos de meta quedan ocupados, la ronda actual termina de
    inmediato: suma **1000 puntos** de bonificación, sube el nivel en 1 (`onLevelChange`), limpia
    los 5 huecos (quedan libres de nuevo para la siguiente ronda), reaparece al sapo en la fila de
    salida, y **incrementa la dificultad** de la siguiente ronda: la velocidad de troncos y
    vehículos sube ~15%, y la proporción de carriles de río con tortugas que se sumergen (ver
    abajo) aumenta, sin límite superior de rondas.
  - **Tortugas que se sumergen**: algunos de los 5 carriles de río usan grupos de tortugas en vez
    de troncos; cada grupo alterna entre "a flote" (soporta al sapo, igual que un tronco), "parpadeo
    de aviso" (~1s, todavía soporta al sapo) y "sumergido" (~1.5s, no soporta al sapo — el sapo que
    está encima al momento de sumergirse muere), en un ciclo continuo. La cantidad de carriles con
    tortugas sumergibles (respecto a troncos normales, que nunca se hunden) aumenta con cada ronda
    superada.
  - **3 vidas**: la partida arranca con 3 vidas. Al morir (por cualquiera de las causas ya
    descritas en la variante `core`, más aterrizar en un hueco de meta ocupado o agotar el
    temporizador del intento), se resta una vida; si quedan vidas, el sapo reaparece en la fila de
    salida conservando el puntaje y el progreso de huecos de meta ocupados en la ronda actual
    (sin perder la ronda en curso), y el temporizador del intento se reinicia; si no quedan vidas,
    la partida termina.
  - **Temporizador por intento**: cada intento (desde que el sapo aparece en la fila de salida hasta
    que llega a un hueco de meta válido o muere) tiene un límite de tiempo, representado por la
    barra que se encoge en la franja superior del canvas. Arranca en 30 segundos en el nivel 1 y se
    reduce ~2 segundos por cada ronda superada, con un piso de 15 segundos. Agotar el temporizador
    cuenta como una muerte más (resta una vida, mismas reglas de reaparición/game over).
  - **Vida extra por puntaje**: cada 5000 puntos acumulados (5000, 10000, 15000, ...) otorga una
    vida adicional (`onLivesChange` refleja el incremento), sin límite superior de vidas
    acumulables.
- **Callbacks conectados**: `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`,
  `onLevelChange` — los cinco ya son consumidos genéricamente por `GamePlayClient.tsx`, sin
  necesidad de tocar ese archivo. En esta variante, a diferencia de `core`, `onLivesChange` refleja
  un contador real (3 al inicio, sube/baja durante la partida) y `onLevelChange` sube en cada ronda
  completada.
- **Pausa real con doble camino**: el botón "PAUSA" del HUD de React llama `pause()`/`resume()`;
  las teclas `P`/`Escape` capturadas por el engine hacen lo mismo internamente. Ambos caminos
  detienen/reanudan el loop de animación real (troncos, vehículos, tortugas, temporizador y sapo) y
  confirman el nuevo estado vía `onPauseChange(isPaused)`. El temporizador del intento no avanza
  mientras el juego está en pausa.
- **Montaje genérico**: se agrega la entrada `frogger: { createGame, width: 560, height: 520 }` a
  `app/game-engines/registry.ts` (`GAME_ENGINES`). No se toca `app/game/[id]/play/page.tsx` ni
  `GamePlayClient.tsx` — ya resuelven cualquier `id` registrado sin condicionales.
- **Consumo de la capa de datos ya generalizada**: `/game/frogger`, el guardado de puntuación en
  `/game/frogger/play` y la pestaña "FROGGER" en `/hall-of-fame` funcionan automáticamente en
  cuanto la fila `"frogger"` existe en `games` y el registro de motores tiene su entrada —
  `getGame`/`getGames`/`getScores`/`getStats`/`saveScore` y las páginas que los consumen ya son
  genéricas por `gameId` desde el spec 07, sin cambios propios en esta variante.

**Fuera de alcance (para otros specs):**

- **La variante `core` de este mismo juego** (`specs/game-jam/frogger/01-frogger-core.md`): una
  sola vida, sin niveles, sin ronda completa, huecos de meta siempre reutilizables — es la
  alternativa mutuamente excluyente a este spec.
- Bonus adicionales no descritos aquí (p. ej. insectos/moscas que otorgan puntos extra al pisarlos)
  — se consideraron y se descartaron para mantener el eje de profundidad de esta variante enfocado
  en el sistema de rondas/vidas/temporizador, sin acumular mecánicas adicionales no relacionadas.
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
  posición del sapo, troncos, vehículos, tortugas y su ciclo de sumersión, huecos de meta
  ocupados, temporizador del intento, vidas, nivel, score, estado de pausa y listeners quedan
  encapsulados dentro del closure de `createGame`):

  ```ts
  export interface FroggerCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void; // emite 3 al iniciar; baja en cada muerte; sube por vida extra cada 5000 pts; 0 dispara game over
    onGameOver: (finalScore: number) => void;
    onPauseChange: (isPaused: boolean) => void;
    onLevelChange: (level: number) => void; // emite 1 al iniciar; sube en 1 cada ronda completada (5 huecos de meta ocupados)
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

  Internamente conserva, como estructuras encapsuladas: todo lo ya listado en la variante `core`
  (grilla, río, carretera, sapo, récord de fila del intento, loop de animación, listeners) más: el
  arreglo de 5 huecos de meta con su estado `libre`/`ocupado`; los carriles de río marcados como
  "con tortugas" (con su ciclo `a flote → parpadeo → sumergida`) frente a los de tronco fijo; el
  contador de vidas y el nivel/ronda actual; el temporizador del intento (con su valor inicial y
  reducción por ronda); y el umbral de vida extra por puntaje.

  - `onScoreChange` se invoca en cada avance de fila (`+10`), en cada hueco de meta ocupado
    (`+50`), y en cada ronda completada (`+1000`).
  - `onLivesChange` se invoca al iniciar (`3`), en cada muerte (`lives - 1`), en cada vida extra
    ganada (`lives + 1`), y con `0` en el instante en que la última vida se pierde, inmediatamente
    seguido de `onGameOver`.
  - `onGameOver` se invoca una única vez por partida, cuando `lives` llega a `0`, con el `score`
    final acumulado.
  - `onLevelChange` se invoca al iniciar (`level = 1`) y cada vez que se completa una ronda
    (`level++`), ajustando en ese momento la velocidad de troncos/vehículos, la proporción de
    carriles con tortugas sumergibles, y la duración del temporizador del siguiente intento.
  - `onPauseChange` se invoca al confirmar cada cambio de estado de pausa, sin importar si lo
    inició `pause()`/`resume()` (React) o las teclas `P`/`Escape` (engine); mientras está en pausa,
    el temporizador del intento no avanza.

- **Fila semilla en `games`** (SQL de la migración, idéntica a la definida en la variante `core`,
  mismo esquema ya existente de `games`/`scores`, sin cambios de columnas):

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
2. **Crear `app/game-engines/frogger/engine.ts` — base común**: grilla 14×13 (celdas de 40px sobre
   canvas 560×520), franjas de meta/río/mediana/carretera/salida, troncos y vehículos en
   movimiento, sapo con salto discreto y arrastre sobre troncos, y las cuatro condiciones de muerte
   base (vehículo, agua sin tronco, arrastre fuera de la grilla, meta fuera de hueco válido) — todo
   igual que el paso a paso ya descrito en la variante `core` (pasos 2 a 5 de ese spec), pero como
   punto de partida de esta variante. El sistema queda funcional: el juego base es jugable de forma
   aislada, con la puntuación por avance funcionando.
3. **Agregar el sistema de huecos de meta ocupados y ronda completa** — marcar cada hueco de meta
   como `ocupado` al aterrizar ahí (sumando 50 pts), tratar aterrizar en un hueco ya ocupado como
   muerte, y al ocupar los 5, sumar 1000 pts, limpiar los huecos, reaparecer al sapo, e incrementar
   internamente un contador de ronda. El sistema queda funcional: se puede jugar una ronda completa
   y ver cómo se reinicia, de forma aislada.
4. **Agregar tortugas que se sumergen** — convertir algunos carriles de río de troncos fijos a
   grupos de tortugas con ciclo `a flote → parpadeo de aviso → sumergida → a flote`, detectando la
   muerte del sapo si está sobre una tortuga en el instante en que se sumerge. El sistema queda
   funcional: los carriles con tortugas son un peligro adicional identificable, de forma aislada.
5. **Agregar el temporizador por intento** — barra visual que se encoge en la franja superior del
   canvas, con valor inicial de 30 segundos, deteniéndose mientras el juego está en pausa, y
   tratando su expiración como una muerte más. El sistema queda funcional: el temporizador se ve y
   funciona de forma aislada.
6. **Agregar vidas múltiples, vida extra por puntaje y escalado de dificultad por ronda** — arrancar
   con 3 vidas, restar una en cada muerte (reapareciendo con el progreso de la ronda intacto si
   quedan vidas), otorgar una vida extra cada 5000 puntos acumulados, y en cada ronda completada
   subir ~15% la velocidad de troncos/vehículos, aumentar la proporción de carriles con tortugas
   sumergibles, y reducir ~2 segundos (piso de 15s) el temporizador del siguiente intento. El
   sistema queda funcional: el ciclo completo de dificultad progresiva funciona de forma aislada.
7. **Conectar los callbacks `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver`** —
   invocar `onLivesChange(3)` y `onLevelChange(1)` al iniciar; `onScoreChange` en cada avance/meta
   ocupada/ronda completada; `onLivesChange` en cada muerte y en cada vida extra ganada;
   `onLevelChange` en cada ronda completada; y cuando las vidas llegan a `0`, `onGameOver(finalScore)`
   inmediatamente después del último `onLivesChange(0)`, deteniendo el loop de animación. El
   sistema queda funcional: el engine notifica todos los cambios de estado relevantes, aunque aún
   no haya un consumidor en React.
8. **Implementar `pause()`/`resume()`/`destroy()`** — controlando el loop de animación real
   (troncos, vehículos, tortugas, temporizador y sapo) y agregando los listeners de teclado
   `P`/`Escape`, invocando `onPauseChange(true)`/`onPauseChange(false)` en ambos caminos.
   `destroy()` detiene el loop y remueve todos los listeners de teclado agregados por
   `createGame`. El sistema queda funcional: la API pública del engine está completa y probada de
   forma aislada.
9. **Registrar el motor en `app/game-engines/registry.ts`** — agregar el import
   `froggerCreateGame` y la entrada `frogger: { createGame: froggerCreateGame, width: 560, height:
520 }` a `GAME_ENGINES`. El sistema queda funcional de punta a punta: `/game/frogger` y
   `/game/frogger/play` dejan de dar 404, el juego es jugable completo desde la UI real (HUD de
   React conectado, pausa, fin de juego), y el guardado de puntuación, el detalle del juego y la
   pestaña "FROGGER" del salón de la fama funcionan automáticamente vía la capa de datos ya
   generalizada.
10. **Verificación manual y build** — jugar una partida completa en `/game/frogger/play`
    confirmando: mecánica base (saltos, troncos, colisiones), llenar los 5 huecos de meta y ver la
    ronda completarse (bonus, limpieza de huecos, subida de nivel, aumento de dificultad),
    tortugas sumergiéndose de forma letal, el temporizador agotándose como causa de muerte,
    reaparición con vidas restantes conservando el progreso de la ronda, vida extra al cruzar 5000
    puntos, fin de juego al agotar las 3 vidas, pausa real con botón y con `P`/`Escape`, guardado
    de puntuación real, y que la puntuación aparece en `/game/frogger` y en la pestaña "FROGGER" de
    `/hall-of-fame` tras recargar. Confirmar que el resto del catálogo no tiene regresiones.
    Ejecutar `npm run build` sin errores de TypeScript ni de ESLint. El sistema queda funcional y
    verificado de punta a punta.

## Criterios de aceptación

- [ ] La tabla `games` de Supabase contiene una fila `id: "frogger"`, `title: "FROGGER"`,
      `cat: "ARCADE"`, `cover: "cover-rana"`, `color: "green"`, sembrada por la migración.
- [ ] `app/game-engines/frogger/engine.ts` existe, exporta `createGame(canvas, callbacks)` y no
      usa variables globales de módulo.
- [ ] `FroggerCallbacks` incluye `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`,
      `onLevelChange`, todos obligatorios, compatibles con `EngineCallbacks` de `registry.ts`.
- [ ] En `/game/frogger/play` el juego se renderiza dentro de un `<canvas>` de 560×520 y es jugable
      con teclado: `←`/`→`/`↑`/`↓` y `WASD` mueven al sapo exactamente una celda por pulsación.
- [ ] Aterrizar en un hueco de meta libre lo marca como ocupado (visualmente distinguible) y suma
      50 puntos; aterrizar en un hueco ya ocupado termina la partida (resta una vida).
- [ ] Al ocupar los 5 huecos de meta, la ronda se completa: suma 1000 puntos, el nivel sube en 1
      (`onLevelChange`), los huecos se liberan, el sapo reaparece en la fila de salida, y la
      dificultad de la siguiente ronda aumenta (troncos/vehículos ~15% más rápidos, más carriles
      con tortugas sumergibles, temporizador ~2s más corto con piso de 15s).
- [ ] Al menos un carril de río usa tortugas con ciclo visible `a flote → parpadeo de aviso →
    sumergida`; el sapo sobre una tortuga en el instante en que se sumerge muere (resta una
      vida).
- [ ] Una barra de temporizador visible en la franja superior del canvas se encoge durante cada
      intento y no avanza mientras el juego está en pausa; agotarla resta una vida.
- [ ] La partida arranca con 3 vidas (`onLivesChange(3)` al iniciar); cada muerte (vehículo, agua,
      arrastre fuera de grilla, hueco ocupado, o temporizador agotado) resta una vida y, si quedan
      vidas, el sapo reaparece en la fila de salida conservando el puntaje y el progreso de huecos
      de meta ocupados en la ronda actual.
- [ ] Cada 5000 puntos acumulados otorga una vida adicional, reflejada vía `onLivesChange`.
- [ ] Cuando las vidas llegan a `0`, se invoca `onGameOver(finalScore)` una única vez, y React
      muestra el modal "FIN DEL JUEGO" con el puntaje final.
- [ ] El botón "PAUSA" del HUD de React y las teclas `P`/`Escape` capturadas por el engine
      detienen/reanudan el loop de animación real (troncos, vehículos, tortugas, temporizador y
      sapo), confirmando el estado vía `onPauseChange(isPaused)`.
- [ ] Al presionar "JUGAR DE NUEVO", el engine se destruye y se vuelve a crear desde cero: sapo,
      huecos de meta, vidas (3), nivel (1) y puntaje (0) quedan en su estado inicial.
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

- **Motor construido desde cero**, sin `game.js` de referencia (mismo criterio que Snake y que la
  variante `core` de este mismo juego), porque Frogger no forma parte de
  `references/started-games/`.
- **`id: "frogger"` (inglés)**, idéntico al de la variante `core` — ambas variantes comparten
  exactamente el mismo `id`/`title`/categoría/cover, porque son alternativas de alcance del mismo
  juego, no juegos distintos.
- **Eje de profundidad elegido: rondas progresivas** (5 huecos de meta que hay que llenar, subida
  de nivel al completarlos, dificultad creciente por ronda), envolviendo en un solo sistema
  coherente las vidas múltiples, el temporizador por intento y las tortugas sumergibles, en vez de
  tratarlas como ejes separados — todas estas mecánicas solo tienen sentido combinadas: sin ronda
  no hay "nivel" que subir, sin vidas múltiples una ronda larga sería demasiado punitiva, y sin
  temporizador/tortugas la dificultad no escalaría de forma perceptible entre rondas. Es el mismo
  criterio que usó Snake al ligar su progresión de dificultad al puntaje en un solo sistema.
- **3 vidas iniciales**, en vez de 1 (como la variante `core`) o el rango clásico de 4-5, como un
  punto intermedio razonable que deja margen de error sin volver la partida demasiado larga.
- **Vida extra cada 5000 puntos, sin límite superior**, en vez de un umbral único no repetible o un
  tope de vidas acumulables, para que el sistema de vidas siga siendo relevante en partidas largas
  de jugadores expertos — mismo espíritu que el bonus de vida extra del Frogger clásico, sin copiar
  su umbral exacto (20000 pts), ajustado a la escala de puntaje de esta variante (1000 pts por
  ronda completa).
- **Reaparición conserva el progreso de huecos de meta ocupados en la ronda actual**, en vez de
  reiniciar la ronda completa al perder una vida, para que morir no invalide el avance ya logrado
  dentro de la misma ronda — se decidió que solo agotar las 3 vidas reinicia el progreso (fin de la
  partida), mientras que dentro de una partida, una muerte individual solo cuesta una vida.
- **Temporizador con piso de 15 segundos y reducción de 2s por ronda**, en vez de una reducción sin
  límite inferior, para evitar que en rondas muy avanzadas el temporizador se vuelva
  matemáticamente imposible de cumplir — mismo criterio de "piso razonable" ya aplicado a la
  velocidad de tick de Snake.
- **Barra de temporizador dibujada directamente en el canvas**, en vez de agregar un callback nuevo
  (`onTimeChange`) a `EngineCallbacks`/`registry.ts`, para no volver a generalizar la capa de
  callbacks del proyecto por una sola variante de un solo juego — es un elemento puramente visual
  que no necesita ser una fuente de verdad para React, mismo criterio que el panel interno de
  Tetris (SCORE/LINES/LEVEL/NEXT), aquí reducido a un único indicador.
- **Bonus de insectos/moscas descartado**, aunque es parte del Frogger clásico, para mantener el
  eje de profundidad de esta variante enfocado en un solo sistema coherente (rondas/vidas/
  temporizador/tortugas) en vez de sumar mecánicas adicionales no directamente relacionadas, que
  inflarían el alcance sin aportar a la variante que la distingue de `core`.
- **Sin assets gráficos externos**, mismo criterio que la variante `core`: todo se dibuja con
  primitivas de canvas y la paleta de colores ya existente.
- **Reutilización de `cover-rana` y `color: "green"`**, mismo criterio que la variante `core` — la
  fila semilla de `games` es idéntica entre ambas variantes.
- **Canvas 560×520 con grilla 14×13 (celdas de 40px)**, idéntico al de la variante `core` — mismo
  criterio del jam: controles y canvas base no cambian entre variantes de un mismo juego, solo el
  alcance de su mecánica interna.
- **Pausa dual con tecla `P`/`Escape` además del botón de React**, idéntico a la variante `core`.
- **Consumo directo de la capa de Supabase ya generalizada**, sin volver a generalizarla ni
  duplicarla — mismo criterio ya aplicado por los specs 08/09.

## Riesgos identificados

- **Todos los riesgos ya documentados en la variante `core`** (saltos duplicados por repetición de
  tecla, desincronización de `dt` con el framerate, colisión de arrastre mal detectada en el borde,
  fugas de memoria por listeners no limpiados en `destroy()`, doble invocación de `onGameOver`,
  teclas de flecha con scroll por defecto, canvas de tamaño fijo en layout responsive, RLS no
  definido) aplican igual aquí y se agravan por la mayor cantidad de estado concurrente (huecos de
  meta, tortugas, temporizador, vidas, rondas).
- **Condición de carrera entre "ronda completa" y "muerte en el mismo frame"**: si el quinto hueco
  de meta se ocupa en el mismo frame en que el temporizador expira o el sapo muere por otra causa,
  el orden de evaluación podría disparar tanto la lógica de ronda completa como la de muerte,
  dejando el estado interno (huecos, nivel, vidas) inconsistente. Mitigación: evaluar primero si el
  aterrizaje en el hueco fue válido y completar la ronda antes de evaluar cualquier otra condición
  de muerte en ese mismo frame.
- **Ciclo de sumersión de tortugas desincronizado entre carriles**: si todos los carriles con
  tortugas usan la misma fase de ciclo, el patrón se volvería predecible y trivial de memorizar en
  vez de representar un peligro real. Mitigación: cada carril de tortugas debe iniciar su ciclo con
  un desfase (offset) propio.
- **Temporizador que sigue corriendo durante la pausa**: si `pause()` no detiene explícitamente el
  acumulador del temporizador del intento (además del loop de animación general), el jugador podría
  perder una vida por expiración del tiempo mientras el juego está pausado, un comportamiento
  injusto e inesperado. Mitigación: el temporizador debe depender del mismo mecanismo de
  pausa/reanudación que troncos y vehículos, verificado explícitamente en el paso de verificación
  manual.
- **Escalado de dificultad sin límite superior de rondas**: como la velocidad de troncos/vehículos
  sube ~15% en cada ronda sin un tope definido en este spec, una partida muy larga de un jugador
  experto podría volver el juego imposible de controlar o generar velocidades que saturen el loop
  de animación. Mitigación: fijar un tope razonable al incremento de velocidad durante la
  implementación (p. ej. no superar ~3x la velocidad base), aunque el valor exacto no forma parte
  de los criterios de aceptación de este spec — mismo criterio de "riesgo aceptado documentado" ya
  usado en Snake para su velocidad de tick.
- **Vida extra por puntaje interactuando con el modal de fin de juego**: si `onLivesChange` se
  invoca con un incremento justo en el mismo frame en que otra condición de muerte reduce las vidas
  a 0, el orden de las dos invocaciones podría hacer que React muestre brevemente un estado
  inconsistente (vidas en 0 seguido de un incremento que ya no tiene efecto porque el juego
  terminó). Mitigación: una vez que `onGameOver` se invoca, el engine no debe volver a invocar
  `onLivesChange` bajo ninguna circunstancia (misma bandera `gameOverFired` que evita el doble
  `onGameOver`).
