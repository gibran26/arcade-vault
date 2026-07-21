# CLAUDE.md

Este archivo proporciona guía a Claude Code (claude.ai/code) al trabajar con código en este repositorio.

@AGENTS.md

## ⚠️ Next.js no convencional

Este proyecto usa Next.js 16.2.10, una versión con cambios importantes respecto al Next.js "clásico" que pueda estar en tus datos de entrenamiento (APIs, convenciones y estructura de archivos pueden diferir). **Antes de escribir código**, consulta la guía relevante en `node_modules/next/dist/docs/` (organizada en `01-app/` para el App Router y `02-pages/` para el Pages Router) y respeta los avisos de deprecación que encuentres ahí.

No hay un runner de tests configurado en este proyecto. La verificación de cambios es manual: `npm run dev` y, cuando aplica, el MCP de Playwright (guarda las capturas en `.playwright-screenshots/`).

## Skills

- **`/frontend-design`** — úsala siempre que requieras diseñar o reformar interfaces de usuario.
- **`/spec`** — define specs de funcionalidad de forma guiada (fase de definición lenta, preguntas por bloques, escritura sección por sección). No escribe código.
- **`/spec-impl`** — implementa un spec ya aprobado (`specs/NN-slug.md`), creando su rama de git.
- **`/add-game`** — especialización de `/spec` que diseña un spec combinado (motor real en `<canvas>` + leaderboard en Supabase) para integrar un juego nuevo. Tampoco escribe código.

## Agentes

- **`game-planner`** (`.claude/agents/game-planner.md`) — decide qué juego nuevo conviene integrar a Arcade Vault. Analiza el catálogo (`app/data/games.ts`), los juegos ya implementados y los specs en curso, y propone una recomendación ganadora + shortlist justificada; puede proponer incluso una categoría nueva fuera de `CATS`, señalando que habría que extenderla en `app/data/types.ts`. Mantiene su memoria como un to-do por secciones de estado (🎯 Sugeridos, 👍 Aceptados, ✅ Implementados, 🗑️ Rechazados) en `references/game-suggestions-todo.md`. Solo sugiere: no escribe specs ni código; el siguiente paso siempre es `/add-game <id>`.
  - **Fan-out para pedidos grandes**: como un subagente no puede lanzar otros subagentes, la paralelización la orquesta el asistente principal. Si el usuario pide `N` sugerencias con `N ≥ 8`, lanza `K = min(4, ceil(N/5))` instancias de `game-planner` en paralelo (una sola respuesta, varias llamadas a `Agent`), cada una en **modo Worker**: asígnale una partición de categorías/géneros disjunta de las demás (`CATS` + posibles categorías nuevas) y la lista de ids ya en memoria, para que no se pisen entre sí. Ningún worker escribe memoria. Al volver todos, haz **una sola** pasada de consolidación (modo Consolidador) que deduplique por `id` y grabe `references/game-suggestions-todo.md` una única vez. Para `N < 8`, usa una sola instancia en modo Solo, como siempre.

## Stack técnico

- **Framework**: Next.js 16.2.10 con App Router, React 19.2.4.
- **Base de datos / backend**: Supabase vía `@supabase/ssr` y `@supabase/supabase-js` (persiste el catálogo de juegos y las puntuaciones). El MCP de Supabase está configurado en `.mcp.json` (`project_ref=payulmltnweemggxbxug`).
- **Correo**: `resend` para el envío del formulario de contacto (vía Server Action).
- **Estilos**: Tailwind CSS v4 vía `@tailwindcss/postcss` (sin archivo `tailwind.config.*`; la configuración vive en `postcss.config.mjs` y las directivas de `globals.css`).
- **Fuentes**: `Press_Start_2P` (`--font-pixel`) y `JetBrains_Mono` (`--font-mono-arcade`) cargadas vía `next/font/google` en `app/layout.tsx`.
- **TypeScript**: alias de import `@/*` apunta a la raíz del proyecto (ver `tsconfig.json`).
- **Formato / lint**: Prettier + ESLint (`eslint-config-prettier`). Scripts: `dev`, `build`, `start`, `lint`.

### Variables de entorno

Ver `.env.local.example`. Se requieren las credenciales de Supabase y `RESEND_API_KEY` (sin ella, el formulario de contacto muestra su estado de error).

## Arquitectura

Sigue el App Router con el patrón **Server Component + Client Component** (la página `page.tsx` obtiene datos en el servidor y delega la interactividad a un `*Client.tsx`).

### Rutas (`app/`)

- `/` — `page.tsx` + `HomeClient.tsx` (portada).
- `/games` — `page.tsx` + `GamesClient.tsx` (biblioteca con búsqueda y filtros por categoría).
- `/game/[id]` — `page.tsx` (detalle del juego).
- `/game/[id]/play` — `page.tsx` + `GamePlayClient.tsx` (monta el motor en canvas y el HUD).
- `/about` — `page.tsx` + `ContactForm.tsx` + `actions.ts` (Server Action que envía el correo con Resend).
- `/hall-of-fame` — `page.tsx` + `HallOfFameClient.tsx` (salón de la fama con podio y tabla).
- `/auth` — `page.tsx`.
- `app/layout.tsx` monta `AuthProvider`, el `Nav` global y el footer.

### Datos y dominio

- `app/data/games.ts` — catálogo `GAMES`.
- `app/data/types.ts` — `Game`, `ScoreRow`, `User`, `GameCategory` y `CATS`.
- `app/data/players.ts`.
- `components/` — `GameCard.tsx`, `Nav.tsx`, `Leaderboard.tsx`, `Podium.tsx`.

### Motores de juego (`app/game-engines/`)

Cada juego jugable tiene un motor real en `<canvas>` conectado al HUD de React, portado desde `references/started-games/`.

- Motores: `asteroids/`, `tetris/`, `arkanoid/`, `snake/` (cada uno en su `engine.ts`).
- `registry.ts` — mapa `GAME_ENGINES` (`id → { createGame, width, height }`) más las interfaces:
  - `EngineCallbacks`: `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange`, `onLevelChange`.
  - `EngineInstance`: `pause()`, `resume()`, `destroy()`.
- Convención: `createGame(canvas, callbacks)` encapsulado, sin variables globales.

### Capa Supabase (`app/lib/supabase/`)

- `client.ts` / `server.ts` — clientes SSR (browser y servidor).
- `queries.ts` — `getGames`, `getGame`, `getScores`, `getStats` (parametrizadas por `gameId`).
- `actions.ts` — `saveScore` (Server Action que inserta en `scores`).
- **Tablas**: `games` (catálogo) y `scores` (puntuaciones por juego y jugador).

### Sesión

- `app/context/auth-context.tsx` — `AuthProvider` / `useAuth`, sesión ligera persistida en `localStorage` (clave `av_user`).

## Automatización

Hook `PostToolUse` en `.claude/settings.json`: tras cada `Write`/`Edit`, ejecuta `.claude/hooks/format-file.mjs`, que corre Prettier (`--write`) y ESLint (`--fix`) sobre el archivo tocado.

## Metodología del proyecto (Spec Driven Design)

Este proyecto sigue Spec Driven Design usando los comandos `/spec`, `/spec-impl` y `/add-game`, basado en las prácticas de https://github.com/Klerith/fernando-skills. Los skills se instalan con:

```bash
npx skills@latest add Klerith/fernando-skills
```

- Los specs viven en `specs/NN-slug.md`, numerados secuencialmente, con un campo `**Estado:**` (`Borrador` → `Aprobado` → `Implementado`).
- `specs/.spec-config.yml` controla el flujo (`AutoCreateBranch: true`: `/spec-impl` crea la rama `spec-NN-slug` automáticamente).
- Los juegos fuente que se portan a `app/game-engines/` viven en `references/started-games/` (p. ej. `02-asteroids`, `03-tetris`, `04-arkanoid`).

## Producto

Arcade Vault es una plataforma para jugar online y competir por la mayor cantidad de puntos. El catálogo incluye varios juegos; **asteroids, tetris, arkanoid y snake** ya son jugables con motor real y su puntuación queda persistida en Supabase y visible en el salón de la fama.
