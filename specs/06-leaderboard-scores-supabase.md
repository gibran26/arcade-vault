# 06 — Leaderboard y tabla de juegos en Supabase (Asteroids)

**Estado:** Aprobado
**Depende de:** 04-integracion-supabase (clientes de Supabase ya configurados), 05-asteroids-motor-real (engine real que produce el puntaje final a persistir)
**Fecha:** 2026-07-15
**Objetivo:** Crear las tablas `games` y `scores` en Supabase y conectar el flujo real de Asteroids (detalle, partida y salón de la fama) a datos persistidos de verdad, dejando el resto del catálogo funcionando exactamente igual con los datos mock existentes.

## Alcance

**Dentro del alcance:**

- **Tabla `games` en Supabase**: nueva tabla con una única fila sembrada para `asteroids` (id, title, short, long, cat, cover, color — mismos campos de contenido que la entrada `asteroids` ya existente en `app/data/games.ts`). Sirve como referencia (FK) para `scores.game_id`, no reemplaza el catálogo mock.
- **Tabla `scores` en Supabase**: nueva tabla para puntuaciones reales, con `game_id` referenciando `games.id`, `player_name`, `score`, `user_id` (nullable, sin relación a Supabase Auth todavía — reservado para un spec futuro de auth real) y `created_at`.
- **Migración de Supabase** (vía MCP `apply_migration`) que crea ambas tablas e inserta la fila semilla de `asteroids` en `games`.
- **`app/lib/supabase/queries.ts`** (nuevo módulo, solo lectura, usado desde Server Components): funciones para leer la fila de `asteroids` desde `games`, leer/ordenar las filas de `scores` de `asteroids` (mapeadas a `ScoreRow[]`, con `rank` y `date` calculados al leer, no almacenados), y calcular `best` (`MAX(score)`) y `plays` (`COUNT(*)`) en vivo.
- **`app/lib/supabase/actions.ts`** (nuevo módulo, archivo con `'use server'` en la primera línea): Server Action que inserta una fila nueva en `scores`, invocable desde el Client Component de la partida (`app/game/[id]/play/page.tsx`). Se separa de `queries.ts` porque Next.js no permite anotar Server Actions inline dentro de un módulo que también es importado por un Client Component sin forzar que todo ese módulo (incluido el cliente de servidor con `next/headers`) se empaquete para el navegador.
- **`app/game/[id]/page.tsx`**: cuando `id === "asteroids"`, la página deja de usar `GAMES.find(...)` y `seededScores(...)` y en su lugar consulta Supabase (fila de `games`, filas de `scores`, `best`/`plays` calculados). Para el resto de juegos, el comportamiento actual con el mock no cambia.
- **`app/game/[id]/play/page.tsx`**: el botón "GUARDAR PUNTUACIÓN" para Asteroids ejecuta un insert real en `scores` (con `user_id: null` mientras no exista auth real) en vez de solo marcar `saved = true` localmente. Si el insert falla, se muestra un mensaje de error breve en el modal y el botón queda disponible para reintentar; el flujo de "JUGAR DE NUEVO"/"VOLVER AL VAULT" no se bloquea.
- **`app/hall-of-fame/page.tsx`**: la pestaña "ASTEROIDS" consulta las filas reales de `scores` (ordenadas por puntaje) en vez de `seededScores()`. El resto de pestañas (otros juegos) sigue usando `seededScores()` sin cambios.
- Los datos se leen una sola vez al cargar cada página (no hay actualización en vivo/realtime); recargar la página vuelve a consultar Supabase y refleja las puntuaciones guardadas hasta ese momento.

**Fuera de alcance (para otros specs):**

- Diseño y aplicación de políticas RLS en `games`/`scores` (lectura/escritura pública, restricciones, etc.) — queda pendiente para un spec futuro dedicado a seguridad de datos.
- Supabase Auth real y relación de `scores.user_id` con un usuario autenticado real — `user_id` queda declarado como columna nullable sin uso activo en este spec.
- Migrar el resto del catálogo (`bloque-buster`, `caída`, `serpentina`, etc.) a la tabla `games`, o sus leaderboards a `scores` — siguen 100% en el mock (`app/data/games.ts`, `seededScores()`).
- Cualquier UI o lógica de actualización en tiempo real (Supabase Realtime) de puntuaciones mientras otros jugadores guardan las suyas.
- Edición o borrado de puntuaciones ya guardadas (no hay UPDATE ni DELETE en este spec).
- Cambios visuales en `Podium.tsx`/`Leaderboard.tsx` — se reutilizan tal cual, ya que consumen el mismo tipo `ScoreRow[]`.

## Modelo de datos

- **Tabla `games`** (Supabase, nueva):

  | Columna      | Tipo                           | Notas                                              |
  | ------------ | ------------------------------ | -------------------------------------------------- |
  | `id`         | `text` PK                      | ej. `"asteroids"` (mismo valor que hoy en el mock) |
  | `title`      | `text`                         | ej. `"ASTEROIDS"`                                  |
  | `short`      | `text`                         |                                                    |
  | `long`       | `text`                         |                                                    |
  | `cat`        | `text`                         | ej. `"SHOOTER"`                                    |
  | `cover`      | `text`                         | ej. `"cover-rocas"` (clase CSS existente)          |
  | `color`      | `text`                         | ej. `"yellow"`                                     |
  | `created_at` | `timestamptz`, `default now()` | fecha de alta de la fila del juego                 |

  No incluye `best` ni `plays`: para Asteroids esos valores se calculan en vivo a partir de `scores`, no se almacenan.

  Fila semilla insertada por la migración (mismo contenido que la entrada `asteroids` de `app/data/games.ts`, `created_at` se completa solo con `now()`):

  ```sql
  insert into games (id, title, short, long, cat, cover, color) values (
    'asteroids', 'ASTEROIDS',
    'Pulveriza asteroides en gravedad cero.',
    'Tu nave triangular flota en el vacío absoluto. Rota, propulsa y dispara para partir rocas gigantes en fragmentos cada vez más pequeños, en un campo de juego que envuelve sus propios bordes.',
    'SHOOTER', 'cover-rocas', 'yellow'
  );
  ```

- **Tabla `scores`** (Supabase, nueva):

  | Columna       | Tipo                                   | Notas                                                                   |
  | ------------- | -------------------------------------- | ----------------------------------------------------------------------- |
  | `id`          | `uuid` PK, `default gen_random_uuid()` |                                                                         |
  | `game_id`     | `text`, FK → `games.id`                | siempre `"asteroids"` en este spec                                      |
  | `player_name` | `text` not null                        | iniciales capturadas en el modal "FIN DEL JUEGO"                        |
  | `score`       | `integer` not null                     |                                                                         |
  | `user_id`     | `uuid`, nullable                       | reservado para un spec futuro de auth real; siempre `null` en este spec |
  | `created_at`  | `timestamptz`, `default now()`         | usado para derivar la columna `date` (`DD/MM/AAAA`) al leer             |

- **`app/lib/supabase/queries.ts`** (nuevo módulo, funciones async sobre el cliente de servidor):

  ```ts
  export async function getAsteroidsGame(): Promise<{
    title: string;
    short: string;
    long: string;
    cat: string;
    cover: string;
    color: string;
  } | null>;

  export async function getAsteroidsScores(limit?: number): Promise<ScoreRow[]>;
  // ORDER BY score DESC; mapea cada fila a { rank, name: player_name, score, date } —
  // rank calculado por posición en el resultado, date derivado de created_at.

  export async function getAsteroidsStats(): Promise<{
    best: number;
    plays: number;
  }>;
  // best = MAX(score) (0 si no hay filas), plays = COUNT(*).
  ```

  **`app/lib/supabase/actions.ts`** (nuevo módulo, `'use server'` a nivel de archivo):

  ```ts
  export async function saveAsteroidsScore(
    playerName: string,
    score: number,
  ): Promise<void>;
  // insert en scores con game_id: "asteroids", user_id: null. Lanza si falla el insert.
  ```

  `ScoreRow` (`app/data/types.ts`) no cambia de forma — estas funciones producen el mismo shape que `seededScores()`, por lo que `Podium.tsx`/`Leaderboard.tsx` se reutilizan sin modificación.

## Plan de implementación

1. **Crear la migración de Supabase** (vía MCP `apply_migration`) que define las tablas `games` y `scores` (columnas y tipos del modelo de datos, FK de `scores.game_id` → `games.id`) e inserta la fila semilla de `asteroids` en `games`. El sistema queda funcional: las tablas existen en Supabase con datos, pero ninguna página del proyecto las consulta todavía.

2. **Crear `app/lib/supabase/queries.ts`** — implementar `getAsteroidsGame()`, `getAsteroidsScores(limit?)`, `getAsteroidsStats()` y `saveAsteroidsScore(playerName, score)` usando el cliente de servidor (`app/lib/supabase/server.ts`), mapeando las filas de `scores` a `ScoreRow[]` (rank por posición, date derivado de `created_at`). El sistema queda funcional: el módulo compila y es importable, pero aún no se usa desde ninguna página.

3. **Conectar `app/game/[id]/page.tsx`** — cuando `id === "asteroids"`, reemplazar `GAMES.find(...)` + `seededScores(...)` por `getAsteroidsGame()`, `getAsteroidsScores(10)` y `getAsteroidsStats()` (para `best`/`plays` en el `stat-strip`). El resto de juegos sigue usando el mock sin cambios. El sistema queda funcional: la página de detalle de Asteroids muestra datos reales (aunque `scores` esté vacía, mostrando 0 partidas y mejor global 0).

4. **Conectar el guardado real en `app/game/[id]/play/page.tsx`** — al presionar "GUARDAR PUNTUACIÓN" con `id === "asteroids"`, llamar a `saveAsteroidsScore(name, score)`; si resuelve, marcar `saved = true` como hoy; si falla, mostrar un mensaje de error breve en el modal y dejar el botón disponible para reintentar (sin bloquear "JUGAR DE NUEVO"/"VOLVER AL VAULT"). El resto de juegos sigue con el guardado simulado actual. El sistema queda funcional: jugar una partida de Asteroids y guardar la puntuación la persiste de verdad en Supabase.

5. **Conectar `app/hall-of-fame/page.tsx`** — cuando la pestaña activa sea `"asteroids"`, reemplazar `seededScores(...)` por `getAsteroidsScores(12)` (consulta real, ordenada por puntaje). El resto de pestañas sigue usando `seededScores()` sin cambios. El sistema queda funcional: el salón de la fama de Asteroids refleja las puntuaciones reales guardadas hasta el momento de cargar la página.

6. **Verificación manual y build** — jugar una partida completa de Asteroids, guardar la puntuación, y confirmar que aparece reflejada al recargar `/game/asteroids` (leaderboard lateral, mejor global, partidas) y `/hall-of-fame` (pestaña Asteroids). Confirmar que el resto del catálogo no tiene regresiones (sigue 100% mock). Ejecutar `npm run build` sin errores de TypeScript ni de ESLint. El sistema queda funcional y verificado de punta a punta.

## Criterios de aceptación

- [ ] Las tablas `games` y `scores` existen en Supabase con las columnas del modelo de datos, incluyendo `created_at` en ambas, `user_id` (nullable) en `scores`, y la FK `scores.game_id` → `games.id`.
- [ ] La tabla `games` contiene exactamente una fila (`id: "asteroids"`) sembrada por la migración, con el mismo contenido que la entrada `asteroids` de `app/data/games.ts`.
- [ ] `app/lib/supabase/queries.ts` exporta `getAsteroidsGame`, `getAsteroidsScores` y `getAsteroidsStats`, todas funciones async sobre el cliente de servidor. `app/lib/supabase/actions.ts` exporta `saveAsteroidsScore` como Server Action (`'use server'` a nivel de archivo), invocable desde el Client Component de la partida.
- [ ] `getAsteroidsScores` devuelve `ScoreRow[]` ordenado por `score` descendente, con `rank` calculado por posición y `date` derivado de `created_at` en formato `DD/MM/AAAA`.
- [ ] `getAsteroidsStats` devuelve `best` (`MAX(score)`, 0 si `scores` está vacía para asteroids) y `plays` (`COUNT(*)` de filas de asteroids en `scores`).
- [ ] En `/game/asteroids`, el título, descripción, leaderboard lateral, "Mejor global" y "Partidas" provienen de Supabase (no de `app/data/games.ts` ni `seededScores()`).
- [ ] El resto de páginas de detalle (`/game/<otro-id>`) sigue usando `app/data/games.ts` y `seededScores()` sin cambios ni regresiones.
- [ ] En `/game/asteroids/play`, al presionar "GUARDAR PUNTUACIÓN" se inserta una fila real en `scores` (`game_id: "asteroids"`, `player_name`, `score`, `user_id: null`), y `saved` pasa a `true` solo si el insert resuelve correctamente.
- [ ] Si el insert falla, se muestra un mensaje de error breve en el modal, el botón "GUARDAR PUNTUACIÓN" permanece disponible para reintentar, y "JUGAR DE NUEVO"/"VOLVER AL VAULT" siguen funcionando sin bloqueo.
- [ ] El guardado simulado del resto de juegos (`id !== "asteroids"`) no cambia de comportamiento.
- [ ] En `/hall-of-fame`, la pestaña "ASTEROIDS" muestra las puntuaciones reales de `scores` (recalculadas al cargar la página), y el resto de pestañas sigue mostrando `seededScores()` sin cambios.
- [ ] Jugar una partida completa de Asteroids, guardar la puntuación, y recargar `/game/asteroids` y `/hall-of-fame` refleja esa puntuación nueva en ambas pantallas.
- [ ] `Podium.tsx` y `Leaderboard.tsx` no se modifican — siguen consumiendo `ScoreRow[]` sin cambios de props ni de forma.
- [ ] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Un solo spec para ambas tablas** (`games` y `scores`), en vez de dividir en dos specs separados, porque `scores.game_id` depende de `games` como FK y separar ambas tablas en specs distintos habría dejado un spec intermedio con una FK apuntando a una tabla que no existe todavía. Decisión explícita del usuario.
- **Coexistencia de datos mock y reales**: `app/data/games.ts` y `seededScores()` se mantienen intactos y siguen alimentando todo el catálogo excepto Asteroids. No se migra el resto de juegos a Supabase en este spec. Decisión explícita del usuario.
- **Solo Asteroids se sincroniza con Supabase** (tabla `games` con una única fila sembrada), en vez de migrar todo `app/data/games.ts`, porque es el único juego con motor real y datos reales que tiene sentido persistir por ahora; el resto sigue siendo simulación visual. Decisión explícita del usuario.
- **`app/game/[id]/page.tsx` y `app/game/[id]/play/page.tsx` leen datos reales de Supabase para Asteroids**, en vez de que la tabla `games` sirva únicamente como FK sin consultarse desde la UI, porque el usuario prefirió que el detalle y la partida reales de Asteroids reflejen datos reales de punta a punta. Decisión explícita del usuario.
- **`user_id` (no `player_id`) como nombre de columna** en `scores`, nullable y sin relación activa a Supabase Auth en este spec — se deja reservado para cuando exista un spec de autenticación real con Supabase Auth. Decisión explícita del usuario (ajuste durante la Fase 2 de este spec, sobre la propuesta inicial de `player_id`).
- **`created_at` agregado también a la tabla `games`** (no solo a `scores`), aunque no se use para lógica de negocio en este spec, para mantener consistencia de auditoría entre ambas tablas nuevas. Decisión explícita del usuario.
- **`best`/`plays` calculados en vivo desde `scores`** (`MAX(score)`, `COUNT(*)`) en vez de almacenarse como columnas estáticas en `games`, para que "Mejor global" y "Partidas" en `/game/asteroids` reflejen datos reales sin necesidad de mantenerlos sincronizados manualmente. Se calculan solo al cargar la página (sin tiempo real/polling) — no hay actualización en vivo mientras la página está abierta. Decisión explícita del usuario.
- **`rank` y `date` derivados al leer, no almacenados** en `scores`, porque son puramente presentacionales (orden por puntaje, formato de fecha) y almacenarlos introduciría redundancia y riesgo de desincronización si se re-ordenan las puntuaciones.
- **`player_name` como texto libre, sin relación a usuario real**, igual que el campo "TUS INICIALES" que ya existe hoy en el modal de fin de juego — no se fuerza login para guardar una puntuación.
- **Diseño de políticas RLS explícitamente fuera de alcance** de este spec — las tablas se crean sin que este spec defina sus políticas de acceso; se abordará en un spec futuro dedicado a seguridad de datos. Decisión explícita del usuario.
- **Manejo de errores en el guardado**: mensaje de error breve con reintento habilitado, en vez de fallar silenciosamente marcando `saved = true` de todas formas, porque el usuario prefiere que el jugador sepa si su puntuación no se persistió realmente. Decisión explícita del usuario.
- **`saveAsteroidsScore` vive en `app/lib/supabase/actions.ts` (archivo separado con `'use server'`), no en `queries.ts`**, ajuste hecho durante la Fase 4 de este spec sobre la propuesta inicial de tener las 4 funciones en un mismo módulo. Next.js no permite anotar Server Actions inline dentro de un módulo que un Client Component también importa (forzaría empaquetar `next/headers` para el navegador), y separar lecturas (`queries.ts`, solo Server Components) de la mutación (`actions.ts`, Server Action invocable desde cliente) es además el patrón idiomático de Next.js App Router. Decisión explícita del usuario, priorizando el diseño correcto sobre cumplir el texto original al pie de la letra.
- **`Podium.tsx`/`Leaderboard.tsx` sin cambios**, porque las funciones nuevas de `queries.ts` producen el mismo shape `ScoreRow[]` que `seededScores()` ya produce — no hay necesidad de tocar los componentes de presentación.
- **Supabase Auth real fuera de alcance**, manteniendo `app/context/auth-context.tsx` con `localStorage` exactamente como hoy — `user_id` queda declarado en el esquema pero siempre `null` en este spec.

## Riesgos identificados

- **Sin RLS definido, las tablas quedan abiertas o bloqueadas por el comportamiento por defecto de Supabase**: al no diseñarse políticas de RLS en este spec, el comportamiento de lectura/escritura dependerá de si RLS queda habilitado sin policies (todo bloqueado, incluyendo el `SELECT`/`INSERT` que este spec necesita para funcionar) o deshabilitado (todo abierto públicamente, incluyendo `INSERT` desde cualquier cliente con la clave pública). Mitigación: verificar explícitamente durante el Paso 1 que la migración deja las tablas en un estado donde el flujo de este spec (leer `games`/`scores`, insertar en `scores`) funciona end-to-end, dejando una nota explícita de que la política real de acceso queda pendiente para el spec futuro de RLS.
- **Guardado de puntuaciones sin límite ni validación de rango**: al no requerir autenticación y no haber políticas de RLS, cualquier cliente puede insertar puntuaciones arbitrariamente altas o en volumen (spam de scores) contra la tabla `scores`. Mitigación: no forma parte del alcance de este spec — queda como punto de partida para el spec futuro de RLS/seguridad, que podría incorporar validaciones de rango o rate limiting.
- **Desincronización entre `best`/`plays` calculados y la percepción del jugador**: como los stats se calculan solo al cargar la página (sin tiempo real), un jugador que guarda una puntuación y no recarga `/game/asteroids` seguirá viendo los valores previos hasta refrescar. Mitigación: comportamiento aceptado explícitamente por el usuario (cálculo solo al cargar, no en vivo); no se implementa revalidación automática en este spec.
- **`game_id` como texto libre en vez de enum/constraint**: si en el futuro se escribe un `game_id` que no coincide exactamente con `"asteroids"` (typo, mayúsculas), la fila de `scores` quedaría huérfana o violaría la FK sin un mensaje de error claro para el jugador. Mitigación: `saveAsteroidsScore` fija `game_id: "asteroids"` como literal dentro del propio código, sin aceptarlo como parámetro externo, eliminando la posibilidad de error de tipeo en este spec.
- **Falla de red al leer datos reales en Server Components (`app/game/[id]/page.tsx`, `app/hall-of-fame/page.tsx`)**: a diferencia del guardado (que sí tiene manejo de error explícito en el Paso 4), una falla de Supabase al leer `games`/`scores` en estas páginas no tiene un comportamiento de fallback definido en este spec y podría romper el render de la página. Mitigación: no forma parte del alcance de este spec definir una pantalla de error o fallback para fallas de lectura; queda anotado como pendiente si se observa en la verificación manual del Paso 6.
