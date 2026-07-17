# Plantilla para un spec de integración de juego (motor + leaderboard)

Este archivo es la referencia que consulta la skill `/add-game` al generar specs. Cada sección
incluye su propósito. **No es texto para copiar literal** — es la forma que la skill debe respetar.

Esta plantilla es una **especialización** de `.claude/skills/spec/template.md` (léela primero: las
reglas globales de esa plantilla —una idea por frase, nombres concretos, criterios booleanos,
sin TODOs— aplican igual aquí). La diferencia es que un spec de `/add-game` siempre cubre **dos
mitades** del mismo juego: el puerto del motor a un `<canvas>` real, y su leaderboard persistido en
Supabase. Los specs `05-asteroids-motor-real.md` y `06-leaderboard-scores-supabase.md` son el
ejemplo canónico de ambas mitades — aquí se fusionan en un solo documento.

---

## Header

Igual que en `/spec`:

```markdown
# NN — Integración de <Nombre del juego> (motor + leaderboard)

**Estado:** Borrador
**Depende de:** <specs previos relevantes, p. ej. 04-integracion-supabase>
**Fecha:** YYYY-MM-DD
**Objetivo:** Una sola frase: portar el motor de <juego> a un canvas real conectado al HUD de
React, y persistir sus puntuaciones en Supabase.
```

Si el objetivo no cabe en una frase, es señal de dividir en dos specs (uno de motor, uno de
leaderboard) como se hizo históricamente en 05/06 — la skill debe ofrecer esa alternativa si el
juego es grande (ver `SKILL.md`, Fase 2).

---

## Alcance

Dos sub-bloques obligatorios, cubriendo ambas mitades explícitamente:

```markdown
## Alcance

**Dentro del alcance:**

- Nueva entrada en el catálogo (`app/data/games.ts`): `id`, `title`, `cat`, `cover`, `color`.
- Puerto del motor: conversión de `references/started-games/<carpeta>/game.js` (o de una mecánica
  descrita desde cero) a `app/game-engines/<id>/engine.ts`, exponiendo
  `createGame(canvas, callbacks)` con `pause()`/`resume()`/`destroy()`.
- Callbacks de notificación a React: cuáles de `onScoreChange`, `onLivesChange`, `onGameOver`,
  `onPauseChange`, `onLevelChange` aplican a este juego (no todos los juegos tienen vidas o
  niveles — decirlo explícitamente).
- Montaje en `app/game/[id]/play/page.tsx` cuando `id === "<id>"`.
- Tabla `games` en Supabase: fila semilla para `<id>` (vía `apply_migration`, reutilizando la tabla
  ya creada en el spec 06 si existe, sin recrearla).
- Tabla `scores`: reutilizada tal cual del spec 06 (ya es genérica vía `game_id`), sin cambios de
  esquema.
- **Generalización de la capa de queries/actions**: si `app/lib/supabase/queries.ts` y
  `app/lib/supabase/actions.ts` siguen cableados a `'asteroids'` como literal (patrón del spec 06),
  este spec debe migrarlos a funciones que reciben `gameId` como parámetro
  (`getGameScores(gameId, limit?)`, `getGameStats(gameId)`, `saveScore(gameId, playerName, score)`),
  actualizando también las llamadas existentes de Asteroids para que seguir usando esas funciones
  genéricas — sin duplicar el patrón por cada juego nuevo. Si ya existen generalizadas (porque un
  spec anterior de `/add-game` ya hizo esta migración), este spec solo las consume.
- Conexión de detalle (`app/game/[id]/page.tsx`), partida (guardar puntuación) y salón de la fama
  (`app/hall-of-fame/page.tsx`) a los datos reales de `<id>`.

**Fuera de alcance (para otros specs):**

- Soporte táctil/móvil (salvo que el juego lo requiera explícitamente).
- Políticas RLS en `games`/`scores`.
- Supabase Auth real / relación de `scores.user_id` con un usuario autenticado.
- Cambios visuales en `Podium.tsx`/`Leaderboard.tsx`.
- Adaptar cualquier otro juego de `references/started-games/` que no sea el de este spec.
```

---

## Modelo de datos

Concreto, con nombres reales — igual criterio que la plantilla base:

```markdown
## Modelo de datos

- Entrada en `app/data/games.ts` (tipo `Game` existente, sin cambios de tipo):
  \`\`\`ts
  { id: "<id>", title: "<TÍTULO>", short: "...", long: "...", cat: "<CAT>", cover: "<clase-css>",
  color: "<color>", best: 0, plays: "0" }
  \`\`\`

- `app/game-engines/<id>/engine.ts`:
  \`\`\`ts
  export interface <Nombre>Callbacks {
  onScoreChange: (score: number) => void;
  onLivesChange?: (lives: number) => void; // solo si el juego tiene vidas
  onGameOver: (finalScore: number) => void;
  onPauseChange: (isPaused: boolean) => void;
  onLevelChange?: (level: number) => void; // solo si el juego tiene niveles
  }

  export interface <Nombre>Game {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  }

  export function createGame(canvas: HTMLCanvasElement, callbacks: <Nombre>Callbacks): <Nombre>Game;
  \`\`\`

- Fila semilla en `games` (SQL de la migración) y forma de las filas de `scores` insertadas para
  este juego (mismo esquema del spec 06, sin cambios de columnas).

- Firmas genéricas de `app/lib/supabase/queries.ts` / `actions.ts` tras la generalización (si aplica
  en este spec):
  \`\`\`ts
  export async function getGameScores(gameId: string, limit?: number): Promise<ScoreRow[]>;
  export async function getGameStats(gameId: string): Promise<{ best: number; plays: number }>;
  export async function saveScore(gameId: string, playerName: string, score: number): Promise<void>;
  \`\`\`
```

Si el motor no introduce estructuras nuevas más allá de lo ya listado (p. ej. reutiliza `ScoreRow`
tal cual), decirlo explícitamente en vez de omitir la sección.

---

## Plan de implementación

Pasos numerados, cada uno dejando el sistema funcional — fusiona el orden de 05 (motor) seguido del
orden de 06 (leaderboard), con la generalización de queries/actions insertada donde corresponda:

```markdown
## Plan de implementación

1. Agregar la entrada del juego a `app/data/games.ts`. El juego aparece en `/games` y `/game/<id>`,
   aún con simulación genérica en `/play`.
2. Crear `app/game-engines/<id>/engine.ts` portando el `game.js` de origen (o la mecánica descrita)
   dentro de `createGame(canvas, callbacks)`, sin variables globales de módulo.
3. Conectar los callbacks aplicables (`onScoreChange`/`onLivesChange`/`onGameOver`/`onLevelChange`)
   en los puntos donde el motor ya actualiza esos valores internamente.
4. Implementar `pause()`/`resume()`/`destroy()` y conectar `onPauseChange`.
5. Modificar `app/game/[id]/play/page.tsx` para montar el `<canvas>` real cuando `id === "<id>"`,
   sin afectar el resto de juegos.
6. (Si aplica) Migrar `apply_migration` para sembrar la fila de `<id>` en `games` — reutilizando la
   tabla existente, no recreándola.
7. (Si aplica) Generalizar `app/lib/supabase/queries.ts`/`actions.ts` de literales de asteroides a
   funciones parametrizadas por `gameId`, actualizando las llamadas existentes de Asteroids.
8. Conectar `app/game/[id]/page.tsx`, el guardado real en `play/page.tsx` y
   `app/hall-of-fame/page.tsx` para `<id>` usando las funciones (genéricas o existentes) de Supabase.
9. Verificación manual end-to-end (partida completa, guardar puntaje, recargar detalle y salón de
   la fama, confirmar que el resto del catálogo no tiene regresiones) y `npm run build` sin errores.
```

Ajustar el orden/número exacto de pasos al juego concreto — esto es la forma, no un texto fijo.

---

## Criterios de aceptación

Checklist booleano, igual criterio que la plantilla base. Cubrir explícitamente ambas mitades:

```markdown
## Criterios de aceptación

- [ ] `app/data/games.ts` incluye la entrada de `<id>`, visible en `/games` y `/game/<id>`.
- [ ] `app/game-engines/<id>/engine.ts` existe, exporta `createGame(canvas, callbacks)` sin estado
      global de módulo.
- [ ] El juego es jugable con teclado en `/game/<id>/play` dentro de un `<canvas>`.
- [ ] El HUD de React refleja puntaje (y vidas/nivel si aplican) reales, vía callbacks.
- [ ] Pausa real detiene el `requestAnimationFrame`; reanudar lo reactiva.
- [ ] Fin de juego dispara `onGameOver(finalScore)` una única vez.
- [ ] "SALIR"/navegación fuera de la página llama `destroy()` sin listeners colgando.
- [ ] La tabla `games` contiene la fila sembrada de `<id>`.
- [ ] Guardar puntuación inserta una fila real en `scores` con `game_id: "<id>"`.
- [ ] (Si se generalizó) `queries.ts`/`actions.ts` exponen funciones parametrizadas por `gameId`, y
      Asteroids sigue funcionando igual usándolas.
- [ ] `/game/<id>` y `/hall-of-fame` (pestaña `<id>`) muestran datos reales de Supabase.
- [ ] El resto del catálogo no tiene regresiones.
- [ ] `npm run build` compila sin errores de TypeScript ni de ESLint.
```

---

## Decisiones tomadas y descartadas

Mismo criterio que la plantilla base: capturar qué se consideró, no solo qué se eligió. Registrar
explícitamente la decisión sobre generalizar o no la capa de Supabase para este juego, y por qué.

---

## Riesgos identificados (si aplica)

Reutilizar como checklist de riesgos conocidos del patrón (documentados en los specs 05/06):
listeners de teclado no limpiados, doble invocación de `onGameOver`, `dt` sin cap al recuperar
foco, canvas de tamaño fijo en layout responsive, RLS no definido. Añadir los que sean específicos
del juego nuevo.

---

## Sección final — Qué NO está en este spec

Repetir al final, igual que en la plantilla base, lo que queda explícitamente fuera.
