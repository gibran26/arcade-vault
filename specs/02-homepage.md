# 02 — Homepage (landing)

**Estado:** Implementado
**Depende de:** `01-mvp-pantallas-visuales` (Nav, AuthProvider, `app/data/games.ts`, sistema visual en `globals.css`)
**Fecha:** 2026-07-13
**Objetivo:** Construir la landing page de marketing de Arcade Vault en `/` a partir de la plantilla `references/templates/home-about/home.jsx`, reubicando la biblioteca de juegos actual de `/` a `/games` y actualizando el Nav y los enlaces internos para reflejar la nueva estructura de rutas.

## Alcance

**Dentro del alcance:**

- **Nueva landing en `/`** (`app/page.tsx` reescrito), migrada desde `home.jsx`, con todas sus secciones:
  - Hero con siluetas decorativas flotantes (`FloatingSilhouettes`), eyebrow, título, subtítulo y CTAs ("EXPLORAR JUEGOS" → `/games`, "CREAR CUENTA" → `/auth`).
  - "¿Por qué Arcade Vault?" — grid de 4 feature cards con iconos pixel-art (`FeatureIcon`).
  - "Juegos disponibles ahora" — rail de 6 `MiniCard` (primeros 6 de `GAMES`), cada una navega a `/game/[id]`; botón "VER TODOS LOS JUEGOS" → `/games`.
  - Stats destacadas (3 bloques numéricos).
  - "Actividad en vivo" — ticker de últimas puntuaciones y top 5 jugadores del día, con datos hardcodeados tal como en el template; botón "VER SALÓN" → `/hall-of-fame`.
  - Pricing — card de plan único gratuito con CTA "EMPEZAR GRATIS" → `/auth`, y FAQ.
  - CTA final "¿LISTO PARA JUGAR?" → `/games`.
  - Efecto de aparición al hacer scroll (`useReveal`, `IntersectionObserver` sobre `.reveal`), igual que en el template.
- **Biblioteca reubicada a `/games`**: mover el contenido actual de `app/page.tsx` (hero de biblioteca, buscador, chips de categoría, grid de `GameCard`) a `app/games/page.tsx` sin cambios funcionales.
- **Actualización de enlaces internos** que hoy asumen que la biblioteca vive en `/`:
  - Nav: nuevo link "Inicio" → `/`; "Biblioteca" pasa a apuntar a `/games`; "Salón de la Fama" sin cambios. Logo sigue apuntando a `/`. Estado activo del Nav ajustado (Inicio activo solo en `/` exacto; Biblioteca activo en `/games`, `/game/[id]` y `/game/[id]/play`).
  - `/auth`: login, crear cuenta e invitado redirigen a `/games` en vez de `/`.
  - `/game/[id]` y `/game/[id]/play`: botones "Volver" / "Volver al Vault" apuntan a `/games`.
- **Port del CSS de la landing** (`home-hero`, `home-section`, `feature-card`, `mini-card`, `home-stats`, `activity-grid`, `pricing-grid`, `home-final`, etc.) desde `references/templates/home-about/styles.css` hacia `app/globals.css`, siguiendo el mismo criterio que el spec 01 (CSS portado casi literal, no reescrito en utilidades de Tailwind).

**Fuera de alcance (para otro spec):**

- Página "Acerca de" (`about.jsx`) y su formulario de contacto — se deja completamente para un spec futuro; el Nav **no** incluye el link "Acerca de" todavía.
- Cualquier dato real detrás de "Actividad en vivo" / "Top jugadores" (quedan hardcodeados como en el template, sin conectarse a `seededScores`/`PLAYERS`).
- Cambios a las rutas `/game/[id]` y `/game/[id]/play` más allá de actualizar el destino de sus botones "Volver" (no se unifican a `/games/[id]`).
- Cualquier lógica de negocio nueva (créditos, pagos reales, etc.) — el pricing sigue siendo decorativo.

## Modelo de datos

Esta funcionalidad no introduce nuevas estructuras de datos. Reutiliza `GAMES` de `app/data/games.ts` (ya existente) para el rail de juegos destacados. Los arrays de "actividad en vivo" y "top jugadores" son literales hardcodeados dentro del propio componente de la landing (igual que en el template), sin tipo ni módulo nuevo en `app/data/`.

## Plan de implementación

1. **Mover la biblioteca a `/games`** — Crear `app/games/page.tsx` con el contenido actual de `app/page.tsx` (hero de biblioteca, buscador, chips, grid de `GameCard`) sin cambios funcionales. El sistema queda funcional con la biblioteca duplicada temporalmente en ambas rutas (hasta el paso 3, en que `app/page.tsx` se reemplaza por la landing).

2. **Portar el CSS de la landing** — Agregar a `app/globals.css` las reglas nuevas de `references/templates/home-about/styles.css` para las clases `home-hero`, `home-silos`/`silo`, `home-section`, `section-head`/`kicker`/`section-rule`, `feature-grid`/`feature-card`/`ft-icon`, `mini-rail`/`mini-card`, `home-stats`/`stat-block`, `activity-grid`/`activity-card`/`ticker`/`tick-row`/`top-list`/`top-row`, `pricing-grid`/`price-card`/`pricing-faq`, `home-final`, y la clase `.reveal`/`.reveal.in`. **Solo se agregan reglas para clases nuevas de la landing; no se toca, sobrescribe ni reordena ninguna regla existente en `globals.css`** (incluyendo los ajustes responsive ya hechos en el spec 01). Si alguna clase del template coincide en nombre con una ya existente, se revisa manualmente antes de fusionar en vez de copiar y pegar el bloque completo del template.

3. **Nueva landing en `/`** — Reescribir `app/page.tsx` migrando `home.jsx`: hook `useReveal`, componentes locales `FloatingSilhouettes`, `MiniCard`, `FeatureIcon`, y la sección `Home` completa (hero, why, games preview, stats, actividad, pricing, CTA final), reemplazando `navigate({name: "..."})` del template por `next/link` / `useRouter` hacia `/games`, `/auth`, `/game/[id]` y `/hall-of-fame` según corresponda. El sistema queda funcional con landing y biblioteca ya separadas.

4. **Actualizar `components/Nav.tsx`** — Agregar link "Inicio" → `/` (activo solo en `/` exacto), cambiar destino de "Biblioteca" a `/games` (activo en `/games`, `/game/[id]` y `/game/[id]/play`), mantener "Salón de la Fama" sin cambios, en versión desktop y panel móvil. El logo sigue apuntando a `/`.

5. **Actualizar redirecciones dependientes** — En `app/auth/page.tsx`, cambiar los `router.push("/")` (login, crear cuenta, invitado) a `router.push("/games")`. En `app/game/[id]/page.tsx` y `app/game/[id]/play/page.tsx`, actualizar los botones "Volver" / "Volver al Vault" para apuntar a `/games`.

6. **Repaso responsive y pulido** — Verificar en el navegador la landing completa (desktop y mobile) contra `home.jsx`/`styles.css`, y confirmar que `/games` sigue funcionando igual que antes en `/`; ajustar cualquier desajuste visual del CSS portado.

## Criterios de aceptación

- [x] `/` muestra la nueva landing (hero, "¿Por qué Arcade Vault?", rail de juegos destacados, stats, actividad en vivo, pricing, CTA final), visualmente equivalente a `home.jsx` + `styles.css`, con el efecto de aparición al hacer scroll funcionando en cada sección `.reveal`.
- [x] En la landing: "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS" y el CTA final "INSERTAR MONEDA" navegan a `/games`; "CREAR CUENTA" y "EMPEZAR GRATIS" navegan a `/auth`; cada `MiniCard` del rail navega a `/game/[id]` correspondiente; "VER SALÓN →" navega a `/hall-of-fame`.
- [x] `/games` muestra el grid de 8 juegos con búsqueda y filtro por categoría funcionando exactamente igual que la biblioteca actual en `/` antes de este spec.
- [x] El Nav muestra "Inicio", "Biblioteca" y "Salón de la Fama" (sin "Acerca de"); "Inicio" está activo solo en `/`; "Biblioteca" está activo en `/games`, `/game/[id]` y `/game/[id]/play`; el logo navega a `/`. Esto aplica tanto en el Nav de escritorio como en el panel móvil.
- [x] En `/auth`, iniciar sesión, crear cuenta y "Jugar como invitado" redirigen a `/games` (ya no a `/`).
- [x] En `/game/[id]` y `/game/[id]/play`, los botones "Volver" / "Volver al Vault" navegan a `/games`.
- [x] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Landing en `/`, biblioteca movida a `/games`** (en vez de fusionar ambas en una sola página larga), porque son dos audiencias/objetivos distintos (marketing vs. herramienta funcional) y separarlas en rutas propias es más idiomático en Next.js App Router. Decisión explícita del usuario tras plantear ambas opciones.
- **El detalle de juego permanece en `/game/[id]` (singular)**, sin unificarse a `/games/[id]`, para no tocar código ya funcional y fuera del alcance de este spec, aceptando la inconsistencia de plural/singular entre `/games` y `/game/[id]`.
- **Página "Acerca de" diferida a un spec futuro.** El Nav no incluye ese link todavía; se prioriza tener la landing y la reubicación de la biblioteca funcionando antes de sumar una pantalla más.
- **Todas las redirecciones que antes apuntaban a `/` (login/crear cuenta/invitado en `/auth`, botones "Volver") ahora apuntan a `/games`**, no a la nueva landing, porque `/games` es el destino funcional real tras esas acciones; mostrar la landing de marketing ahí sería una regresión de UX.
- **Datos de "Actividad en vivo" y "Top jugadores" hardcodeados tal como en el template**, sin conectarlos a `seededScores`/`PLAYERS` de `app/data/`, por ser contenido puramente decorativo de la landing y para mantener fidelidad 1:1 con el template en esta migración.
- **CSS portado casi literal a `globals.css`** (no reescrito en utilidades de Tailwind), consistente con la decisión ya tomada en el spec `01-mvp-pantallas-visuales` para el resto del sistema visual.

## Riesgos identificados

- **Sobrescritura accidental de ajustes responsive ya hechos en `globals.css`.** El CSS del template (`styles.css`) puede traer selectores con el mismo nombre de clase que reglas ya modificadas a mano en el spec 01 (media queries, breakpoints). Mitigación: portar el CSS de forma incremental (no copiar el archivo completo), revisar diffs antes de guardar, y verificar visualmente el responsive de las 5 pantallas del spec 01 en el paso 6, no solo la landing nueva.
