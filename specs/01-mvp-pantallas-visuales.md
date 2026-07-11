# 01 — MVP pantallas visuales

**Estado:** Implementado
**Depende de:** Ninguno (primer spec del proyecto)
**Fecha:** 2026-07-10
**Objetivo:** Construir la interfaz visual completa de las 5 pantallas de Arcade Vault (biblioteca, detalle de juego, reproductor simulado, autenticación y salón de la fama) sobre Next.js App Router, con datos mock e interactividad de cliente, sin implementar ningún motor de juego real.

## Alcance

**Dentro del alcance:**

- **5 pantallas** con rutas reales de App Router:
  - `/` — Biblioteca (grid de juegos, búsqueda funcional, filtro por categoría)
  - `/game/[id]` — Detalle del juego (info, stats, leaderboard mock)
  - `/game/[id]/play` — Reproductor simulado (HUD, marco CRT, partida decorativa con puntuación automática, pausa, fin de juego y modal)
  - `/auth` — Autenticación (tabs iniciar sesión / crear cuenta funcionales, login falso, invitado)
  - `/hall-of-fame` — Salón de la Fama (tabs por juego funcionales, podio, tabla de puntuaciones mock)
- **Nav** global (desktop + panel móvil con hamburguesa) integrado en `layout.tsx`, con estado activo por ruta.
- **Sesión simulada**: `AuthProvider` (Context de cliente) que persiste el usuario en `localStorage`, consumido por Nav, Auth y Salón de la Fama (para la fila "tu mejor marca").
- **Módulo de datos mock** en `app/data/` (juegos, jugadores, generador de puntuaciones `seededScores`), tipado en TypeScript, pensado para reemplazarse por una fuente de datos real más adelante.
- Componentes reutilizables en `components/` (Nav, GameCard, Leaderboard, Podium, etc.).
- Toda la interactividad de cliente presente en las plantillas originales (búsqueda, chips de categoría, tabs, tilt de tarjetas, pausa/fin de juego, guardar puntuación con toast visual).
- Diseño responsive igual al de las plantillas (breakpoints ya definidos en `globals.css`).

**Fuera del alcance (para otro spec):**

- Cualquier motor de juego real o lógica jugable (los 8 juegos del catálogo no se implementan).
- Backend, base de datos o API real — todo sigue siendo mock.
- Autenticación real (validación de credenciales, OAuth con Google/GitHub — los botones se muestran pero no funcionan).
- Persistencia real de puntuaciones (`av_scores`) — el botón "Guardar puntuación" solo muestra el toast, no escribe en `localStorage`.
- Sistema de créditos/monedas funcional (el contador del Nav se mantiene como valor estático "03", igual que en el template).

## Modelo de datos

Todo vive en `app/data/`, tipado en TypeScript, sin persistencia real (excepto la sesión simulada en `localStorage`).

**`app/data/types.ts`**
```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;       // clase CSS del gradiente (ej. "cover-bricks")
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;        // ej. "12.4K"
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;         // "DD/MM/AAAA"
}

export interface User {
  name: string;
}
```

**`app/data/games.ts`**
Exporta `GAMES: Game[]` (los 8 juegos) y `CATS: readonly ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]`, migrados 1:1 desde `data.jsx`.

**`app/data/players.ts`**
Exporta `PLAYERS: string[]` (los 18 nombres mock) y `seededScores(seed: number, count?: number): ScoreRow[]`, misma lógica pseudoaleatoria determinista del template.

**`app/context/auth-context.tsx`**
`AuthProvider` (client component) + hook `useAuth()` que expone `{ user: User | null, login: (u: User | null) => void, signOut: () => void }`, respaldado por `localStorage` bajo la clave `av_user`.

## Plan de implementación

1. **Módulo de datos mock** — Crear `app/data/types.ts`, `app/data/games.ts`, `app/data/players.ts` migrando `data.jsx` (juegos, categorías, jugadores, `seededScores`) a TypeScript tipado.

2. **AuthProvider** — Crear `app/context/auth-context.tsx` con `AuthProvider` y `useAuth()`, respaldado por `localStorage` (`av_user`). Envolver la app con el provider en `app/layout.tsx`.

3. **Nav global** — Crear `components/Nav.tsx` (client component): logo, links activos por ruta (`usePathname`), contador de créditos estático, botón de sesión (usa `useAuth()`), menú móvil con hamburguesa. Integrarlo en `app/layout.tsx` junto con el footer (ya existen `.av-bg`/`.av-noise`).

4. **Biblioteca (`/`)** — Reescribir `app/page.tsx`: hero, buscador + chips de categoría funcionales, grid de `GameCard` (con efecto tilt) usando `GAMES`. Extraer `components/GameCard.tsx`.

5. **Detalle (`/game/[id]`)** — Crear `app/game/[id]/page.tsx`: portada, tags, descripción, stat-strip, botones "Jugar ahora" / "Volver", y `components/Leaderboard.tsx` con `seededScores`. 404 (`notFound()`) si el `id` no existe en `GAMES`.

6. **Reproductor (`/game/[id]/play`)** — Crear `app/game/[id]/play/page.tsx` (client component): HUD con puntuación simulada (`setInterval`), vidas, nivel, pausa, marco CRT decorativo, modal de fin de juego con input de iniciales y botón "Guardar puntuación" (solo toast, sin persistencia), "Jugar de nuevo" y "Volver al Vault".

7. **Auth (`/auth`)** — Crear `app/auth/page.tsx` (client component): tabs "Iniciar sesión"/"Crear cuenta" funcionales, formulario, botón "Jugar como invitado", botones sociales decorativos. Al enviar el formulario, llama a `login()` del `AuthProvider` con el usuario y redirige a `/`. "Jugar como invitado" llama a `login(null)` (no inicia sesión, igual que en la plantilla original) y redirige a `/`.

8. **Salón de la Fama (`/hall-of-fame`)** — Crear `app/hall-of-fame/page.tsx` (client component): chips por juego (tab activo en estado local), `components/Podium.tsx` (top 3), tabla de puntuaciones, fila "tu mejor marca" si `useAuth()` tiene usuario.

9. **Repaso responsive y pulido** — Verificar en el navegador los 5 flujos (desktop y mobile: <840px nav, <900px detalle, <720px salón/tabla) contra las plantillas originales; ajustar cualquier desajuste visual.

## Criterios de aceptación

- [x] `app/data/types.ts`, `app/data/games.ts` y `app/data/players.ts` existen, compilan sin errores de TypeScript, y `GAMES` contiene los 8 juegos con los mismos datos que `data.jsx`.
- [x] `AuthProvider` envuelve la app en `layout.tsx`; iniciar sesión, crear cuenta o entrar como invitado en `/auth` actualiza el Nav (nombre de usuario visible) y persiste tras recargar la página (`localStorage`).
- [x] Cerrar sesión desde el Nav vuelve a mostrar el botón "Iniciar Sesión" y elimina el usuario de `localStorage`.
- [x] `/` muestra el grid de 8 juegos; escribir en el buscador filtra por título en tiempo real; hacer clic en un chip de categoría filtra por categoría; combinar ambos filtros funciona; sin resultados muestra el estado vacío.
- [x] Clic en una tarjeta o en "JUGAR" navega a `/game/[id]` con el juego correcto.
- [x] `/game/[id]` muestra la info del juego y una tabla de leaderboard con 10 filas ordenadas por puntuación descendente; `/game/id-inexistente` devuelve 404.
- [x] `/game/[id]/play` incrementa la puntuación automáticamente cada ~220ms mientras no está en pausa ni terminado; "PAUSA" detiene el incremento y "REANUDAR" lo retoma; "FIN" abre el modal de fin de juego con la puntuación final.
- [x] En el modal de fin de juego, "GUARDAR PUNTUACIÓN" muestra el toast "▸ PUNTUACIÓN GUARDADA_" sin escribir en `localStorage`; "JUGAR DE NUEVO" reinicia el estado de la partida; "VOLVER AL VAULT" navega a `/`.
- [x] `/auth`: clic en "CREAR CUENTA" muestra el campo de correo; clic en "INICIAR SESIÓN" lo oculta; enviar el formulario inicia sesión y redirige a `/`; pulsar "JUGAR COMO INVITADO" redirige a `/` sin iniciar sesión (`login(null)`), igual que en la plantilla original.
- [x] `/hall-of-fame` muestra chips por cada uno de los 8 juegos; hacer clic en un chip cambia el podio (top 3) y la tabla a las puntuaciones de ese juego; si hay sesión iniciada, se muestra la fila "tu mejor marca".
- [x] El Nav marca como activo el link correspondiente en `/`, `/game/[id]`, `/game/[id]/play` (Biblioteca) y `/hall-of-fame` (Salón de la Fama); en mobile (<840px) se oculta y aparece el botón hamburguesa que abre el panel lateral.
- [x] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Rutas reales de App Router en vez de una sola pantalla con hash-routing.** El template original usa `location.hash` para simular navegación en una SPA plana; se descartó por no ser idiomático en Next.js 16 App Router, que ya provee rutas reales, `notFound()`, y navegación con `next/link`.
- **Nombres de ruta en inglés/cortos** (`/game/[id]`, `/game/[id]/play`, `/auth`, `/hall-of-fame`) en vez de español, por ser más cercano a convenciones técnicas habituales en código, aunque toda la UI visible siga en español.
- **CSS portado casi literal en `globals.css` en vez de reescrito con Tailwind.** El sistema visual (efectos CRT, neón, tipografía pixel, tilt) es muy específico; recrearlo en utilidades de Tailwind implicaba alto riesgo de desviación visual para poco beneficio. Esta migración ya estaba hecha antes de este spec (`globals.css` y `layout.tsx` ya traían el CSS y las fuentes `Press Start 2P` / `JetBrains Mono` portados).
- **Datos mock en `app/data/`** (no en `lib/` ni inline en componentes), explícitamente pensado como el punto de reemplazo futuro por una base de datos real.
- **Sesión simulada vía Context Provider de cliente** (`AuthProvider`) en vez de lectura directa de `localStorage` en cada componente, para evitar desincronización entre Nav, Auth y Salón de la Fama.
- **La puntuación del reproductor NO se persiste en `localStorage`** al guardar (a diferencia del template original que sí la guardaba en `av_scores`), porque no hay partidas reales todavía — solo se muestra el toast de confirmación visual. Decisión revisada explícitamente durante la definición del spec tras dudas sobre el propósito de la simulación decorativa del reproductor.
- **"Jugar como invitado" en `/auth` llama a `login(null)`** (no inicia sesión de verdad), replicando exactamente el comportamiento de `auth.jsx` en la plantilla original, en vez de crear un usuario "INVITADO" ficticio. Decisión confirmada explícitamente durante la implementación tras una ambigüedad entre el texto original del criterio de aceptación (que sugería "iniciar sesión") y el comportamiento real de la plantilla.
- **Toda la interactividad de cliente presente en las plantillas se conserva** (búsqueda, filtros, tabs, tilt, pausa/fin de juego), en vez de dejar pantallas puramente estáticas — se acordó portar fielmente el comportamiento del template, con los mock data desacoplados en `app/data/` para facilitar el reemplazo futuro por datos reales.
- **Sin sección de riesgos**: al ser una migración de plantillas ya validadas visualmente hacia una arquitectura de rutas estándar de Next.js, sin backend ni lógica de negocio nueva, no se identificaron riesgos relevantes que ameriten seguimiento propio.
