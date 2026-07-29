# CLAUDE.md

Este archivo proporciona guía a Claude Code (claude.ai/code) al trabajar con código en este repositorio.

@AGENTS.md

## ⚠️ Next.js no convencional

Este proyecto usa Next.js 16.2.10, una versión con cambios importantes respecto al Next.js "clásico" que pueda estar en tus datos de entrenamiento (APIs, convenciones y estructura de archivos pueden diferir). **Antes de escribir código**, consulta la guía relevante en `node_modules/next/dist/docs/` (organizada en `01-app/` para el App Router y `02-pages/` para el Pages Router) y respeta los avisos de deprecación que encuentres ahí.

No hay un runner de tests configurado en este proyecto. La verificación de cambios es manual: `npm run dev` y, cuando aplica, el MCP de Playwright (guarda las capturas en `.playwright-screenshots/`).

## Skills

- **`/frontend-design`** — skill global; úsala siempre que requieras diseñar o reformar interfaces de usuario.
- **`/spec`** — define specs de funcionalidad de forma guiada (fase de definición lenta, preguntas por bloques, escritura sección por sección). No escribe código.
- **`/spec-impl`** — implementa un spec ya aprobado (`specs/NN-slug.md`), creando su rama de git.
- **`/add-game`** — especialización de `/spec` que diseña un spec combinado (motor real en `<canvas>` + leaderboard en Supabase) para integrar un juego nuevo. Tampoco escribe código.
- **`/spec-impl-game`** — variante de `/spec-impl` para specs de juego: implementa de corrido y, al terminar, encadena los agentes `skin-designer` y `mobile-porter`.

Definiciones completas en `.claude/skills/*/SKILL.md`.

## Agentes

Agentes definidos en `.claude/agents/*.md` (`game-planner`, `skin-designer`, `mobile-porter`, `game-performance-booster`, `game-jam`) — su descripción completa (alcance, qué escriben, memoria) ya se carga automáticamente al usar el tool Agent.

## Stack técnico

El MCP de Supabase está configurado en `.mcp.json` (`project_ref=payulmltnweemggxbxug`); persiste el catálogo de juegos y las puntuaciones.

### Variables de entorno

Ver `.env.local.example`. Se requieren las credenciales de Supabase y `RESEND_API_KEY` (sin ella, el formulario de contacto muestra su estado de error).

## Arquitectura

Sigue el App Router con el patrón **Server Component + Client Component** (la página `page.tsx` obtiene datos en el servidor y delega la interactividad a un `*Client.tsx`). No hay API routes: las lecturas viven en `app/lib/supabase/queries.ts` y las mutaciones son Server Actions (`app/lib/supabase/actions.ts`, `app/about/actions.ts`).

Convención en `app/game-engines/`: cada motor exporta `createGame(canvas, callbacks, options)` encapsulado, sin variables globales. `registry.ts` es la fuente única por juego (dimensiones del canvas, skins disponibles, mapeo de controles táctiles); `skins.ts` define las paletas `classic`/`neon`/`retro` persistidas en `localStorage`.

## Automatización

Hook `PostToolUse` en `.claude/settings.json`: tras cada `Write`/`Edit`, ejecuta `.claude/hooks/format-file.mjs`, que corre Prettier (`--write`) y ESLint (`--fix`) sobre el archivo tocado.

## Producto

Arcade Vault es una plataforma para jugar online y competir por la mayor cantidad de puntos. El catálogo incluye varios juegos; **asteroids, tetris, arkanoid, snake y frogger** ya son jugables con motor real y su puntuación queda persistida en Supabase y visible en el salón de la fama.

## Specs y referencias

Metodología de specs (estados Borrador → Aprobado → Implementado) en `specs/CLAUDE.md`; los specs de game jam viven agrupados en `specs/game-jam/<game-id>/`. Memoria viva de agentes en `references/`: `implemented-games.md` (catálogo jugable), `game-suggestions-todo.md` (propuestas de `game-planner`) y `pendent-fixes-todo.md` (bugs abiertos).
