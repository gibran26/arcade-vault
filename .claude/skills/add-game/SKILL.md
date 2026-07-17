---
name: add-game
description: Diseña un spec combinado (motor + leaderboard) para integrar un juego nuevo en Arcade Vault, siguiendo la metodología spec-driven de la skill /spec. No escribe código.
disable-model-invocation: true
argument-hint: 'nombre o carpeta del juego a integrar (opcional), p. ej. "03-tetris" o "tetris"'
---

# /add-game — Diseñador guiado de specs de integración de juegos

Esta skill produce un spec para llevar un juego a Arcade Vault de punta a punta: motor real
jugable en un `<canvas>` conectado al HUD de React, y su leaderboard persistido en Supabase.
**Aquí no se escribe código.** Tu trabajo es ayudar al usuario a definir el juego, hacer preguntas
cuando algo no está suficientemente definido, y desarrollar el spec sección por sección hasta que
esté listo para guardarse en `specs/`.

## Relación con `/spec`

Esta skill **es una especialización de la skill `/spec` existente** (`.claude/skills/spec/SKILL.md`
y su `template.md`), no un reemplazo. Reutiliza exactamente su metodología: fase de definición
lenta, preguntas en bloques, escritura sección por sección con confirmación, y el mismo criterio de
"nunca generar el spec completo de una sola vez". Antes de continuar:

1. Lee `.claude/skills/spec/SKILL.md` completo y aplica sus fases, su tono al preguntar, y sus
   reglas duras (nunca escribir código, nunca asumir decisiones no confirmadas, nunca proponer
   implementar después de guardar) exactamente igual que si el usuario hubiera invocado `/spec`.
2. Lee `.claude/skills/spec/template.md` para las reglas globales de forma del documento (una idea
   por frase, nombres concretos, criterios booleanos, sin TODOs, sin código largo).
3. Lee `template.md` (en esta misma carpeta) — es la especialización de esa plantilla para specs de
   "motor + leaderboard". Ese archivo define la forma exacta de cada sección para este tipo de spec.

Donde este documento no diga lo contrario, el comportamiento de `/spec` aplica sin cambios (numeración
de specs, estados válidos, seed de `specs/.spec-config.yml`, idioma de respuesta igual al del prompt
inicial, etc.).

## Filosofía

Un juego integrado a medias (motor sin leaderboard, o leaderboard sin motor jugable) dificulta
verificar el criterio de aceptación real: "se puede jugar y la puntuación queda guardada". Por eso
el spec que produce esta skill cubre **ambas mitades en un solo documento**, aunque el plan de
implementación interno las mantenga como pasos separados y commitables.

Los specs `specs/05-asteroids-motor-real.md` (puerto de motor) y
`specs/06-leaderboard-scores-supabase.md` (leaderboard en Supabase) son el ejemplo canónico de
ambas mitades — fusionadas, son la referencia de lo que debe producir esta skill.

## Flujo del comando

Sigue las cuatro fases en orden. **No te saltes fases.**

### Fase 1 — Entender el contexto del proyecto y del juego fuente

Antes de preguntar sobre el juego en sí:

1. Lee la memoria de proyecto, en orden, deteniéndote en el primer hit: `CLAUDE.md`, `AGENTS.md`,
   `GEMINI.md`, `README.md`.
2. Lista `specs/` para ver la numeración existente y confirma el siguiente número disponible.
3. Lee `specs/05-asteroids-motor-real.md` y `specs/06-leaderboard-scores-supabase.md` completos —
   son la referencia obligatoria del patrón (nombres de archivos, forma de los callbacks, forma de
   las tablas Supabase, decisiones ya tomadas que no hace falta reabrir).
4. **Localiza el juego fuente.** El juego a integrar puede venir o no de
   `references/started-games/`:
   - Si `$ARGUMENTS` nombra o parece referirse a una carpeta de `references/started-games/`
     (ej. `03-tetris`, `tetris`, `04-arkanoid`), lista esa carpeta y lee su `game.js`, `index.html`,
     y `README.md`/`CLAUDE.md` si existen, para entender clases, mecánica de puntaje, vidas,
     niveles y controles reales del juego original.
   - Si `$ARGUMENTS` viene vacío o no corresponde a ninguna carpeta existente en
     `references/started-games/`, no asumas que el juego no existe en disco: lista
     `references/started-games/` y pregunta al usuario si el juego es uno de esos o si es un juego
     descrito desde cero (sin `game.js` de referencia). Si es desde cero, la Fase 2 debe cubrir la
     mecánica completa por preguntas (no hay código fuente que leer).
5. Detecta qué piezas ya existen en el proyecto para reutilizar en vez de re-diseñar:
   - `app/game-engines/asteroids/engine.ts` — patrón de motor ya portado, úsalo como referencia de
     forma (`createGame(canvas, callbacks)`, encapsulado, sin globals).
   - `app/lib/supabase/queries.ts` y `app/lib/supabase/actions.ts` — lee su estado actual. Si siguen
     con funciones literales de asteroides (`getAsteroidsScores`, `saveAsteroidsScore`, etc.), el
     spec que generes debe contemplar generalizarlas (ver Fase 2, categoría Leaderboard). Si ya
     están generalizadas por un spec anterior de `/add-game`, el spec nuevo solo las consume.
   - `app/data/games.ts`, `app/data/types.ts`, `app/game/[id]/page.tsx`,
     `app/game/[id]/play/page.tsx`, `app/hall-of-fame/page.tsx`, `app/hall-of-fame/HallOfFameClient.tsx`.

Si `$ARGUMENTS` viene vacío, pide al usuario una descripción de una sola frase de qué juego quiere
integrar (nombre y, si aplica, carpeta de origen).

### Fase 2 — Aclarar por bloques de preguntas

Igual que `/spec`: bloques de 3 a 5 preguntas, esperando respuesta antes de continuar. Categorías
que siempre debes considerar para este tipo de spec (con recomendación cuando ofrezcas opciones):

- **Identidad de catálogo.** `id` (slug en inglés o el que ya use el juego de origen), `title`,
  `cat` (¿encaja en alguna de `CATS` en `app/data/games.ts` o necesita una nueva?), `cover`
  (¿reutiliza una clase CSS existente de `globals.css` o necesita una nueva — y en ese caso, es
  fuera de alcance de este spec según la convención ya usada con `cover-rocas`?), `color`.
- **Tamaño del spec.** Si el motor a portar es grande o el juego tiene mecánicas no triviales
  (varias clases, power-ups, física compleja), pregunta explícitamente si el usuario prefiere
  **un spec combinado** (comportamiento por defecto de esta skill) o **dividirlo en dos specs**
  como se hizo históricamente en 05/06 (uno de motor, uno de leaderboard). Si el usuario no tiene
  preferencia, recomienda el spec combinado por defecto, salvo que el motor por sí solo ya luzca
  como una pieza de trabajo grande.
- **Motor.** Qué clases/sistemas hay que portar, controles originales, qué callbacks de
  `AsteroidsCallbacks`-como (`onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`,
  `onLevelChange`) aplican — **no asumas que todo juego tiene vidas o niveles**; pregúntalo. Si hay
  power-ups o un HUD interno dibujado dentro del propio canvas, confirma si se porta tal cual (como
  se hizo con `PowerUp`/`tripleShot` en el spec 05) o se simplifica.
- **Leaderboard / Supabase.** Confirma que la fila del juego se siembra en la tabla `games` ya
  existente (no se recrea la tabla). Pregunta explícitamente si este spec debe **generalizar**
  `queries.ts`/`actions.ts` de literales de asteroides a funciones parametrizadas por `gameId`
  (recomendado, para no duplicar el patrón por cada juego nuevo) o si el usuario prefiere duplicar
  el patrón de asteroides tal cual para este juego. Registra la respuesta en la sección de
  Decisiones del spec.
- **Fuera de alcance.** Igual que 05/06 por defecto: soporte táctil/móvil, políticas RLS, Supabase
  Auth real, cambios visuales en `Podium.tsx`/`Leaderboard.tsx` — confirma que siguen fuera salvo
  que el usuario diga lo contrario explícitamente.

**Cuándo dejar de preguntar:** cuando puedas responder sin asumir nada: qué archivos
aparecen/cambian, cuál es el primer y el último paso ejecutable, y cómo se verifica que el juego
quedó integrado de punta a punta (jugable + puntaje persistido + visible en salón de la fama).

### Fase 3 — Desarrollar el spec sección por sección

No generes el spec completo de una vez. Sigue el orden de `template.md` (en esta carpeta):

1. Header (una frase de objetivo — si no cabe, vuelve a Fase 2 o propone dividir en dos specs).
2. Alcance (dentro/fuera, cubriendo explícitamente motor y leaderboard).
3. Modelo de datos (entrada de catálogo, interfaz de callbacks del engine, fila semilla de `games`,
   firmas de Supabase — genéricas o no, según lo decidido en Fase 2).
4. Plan de implementación (pasos numerados, cada uno deja el sistema funcional).
5. Criterios de aceptación (checklist booleano).
6. Decisiones tomadas y descartadas (incluyendo explícitamente la decisión sobre generalizar o no
   la capa de Supabase).
7. Riesgos identificados (solo si aplican — reutiliza los ya documentados en 05/06 que sigan siendo
   relevantes, y añade los específicos del juego nuevo).

Después de cada sección: muéstrala en markdown y pregunta "¿Esta sección queda así o quieres
ajustarla?". Solo avanza a la siguiente sección tras confirmación explícita.

### Fase 4 — Guardar el spec

Igual que `/spec`:

1. Determina el siguiente número secuencial mirando `specs/`.
2. Genera un slug corto a partir del objetivo (ej. `tetris-motor-leaderboard`).
3. Confirma el nombre de archivo propuesto con el usuario antes de escribirlo.
4. Crea `specs/NN-slug.md` con todas las secciones aprobadas.
5. Marca el estado como `Borrador` por defecto. **No lo marques `Aprobado` automáticamente.**
6. Si `specs/.spec-config.yml` no existe, siémbralo con el contenido por defecto (mismo que usa
   `/spec` — `AutoCreateBranch: true`). Si ya existe, no lo toques.
7. Confirma al usuario: ruta del archivo creado, recordatorio de que está en `Borrador`, y que el
   siguiente paso es `/spec-impl NN-slug` una vez revisado y aprobado. **Detente ahí** — no
   propongas implementar, ni escribir código, ni ninguna acción más allá de esta confirmación.

## Reglas duras

- **Nunca escribas código durante este comando.** Solo el `.md` del spec al final.
- **Nunca propongas implementar el spec después de guardarlo.** Tu trabajo termina al escribir el
  archivo. El usuario ejecuta `/spec-impl` cuando esté listo.
- **Nunca asumas decisiones que el usuario no confirmó** — ni sobre el juego fuente, ni sobre si
  generalizar la capa de Supabase, ni sobre nombres de archivos o `id`.
- **Nunca generes el spec completo en una sola respuesta.** Sección por sección, con confirmación.
- **Si el motor a portar es grande**, ofrece explícitamente la alternativa de dividir en dos specs
  (motor / leaderboard) en vez de forzar un único documento combinado — pero el comportamiento por
  defecto de esta skill es el spec combinado.
- **Si la capa de Supabase ya está generalizada** por un spec previo, no la vuelvas a generalizar ni
  la dupliques — el spec nuevo simplemente la consume con el `gameId` de este juego.

## Tono al preguntar

Igual que `/spec`: directo y específico, sin disculparte por preguntar, opciones numeradas con
recomendación cuando ofrezcas alternativas.

## Argumentos

Si el usuario invoca `/add-game 03-tetris`, usa esa carpeta de `references/started-games/` como
juego fuente por defecto, pero confirma con el usuario antes de leerla como definitiva (podría
referirse a otra cosa). Si invoca `/add-game` sin argumentos, empieza preguntando qué juego quiere
integrar y si tiene una carpeta de origen en `references/started-games/`.
