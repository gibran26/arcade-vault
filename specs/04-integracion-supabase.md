# 04 — Integración base con Supabase

**Estado:** Implementado
**Depende de:** ninguno (integración independiente de las páginas existentes)
**Fecha:** 2026-07-14
**Objetivo:** Instalar y configurar los clientes de Supabase (`@supabase/supabase-js` + `@supabase/ssr`) para navegador y servidor en Next.js App Router, dejando la conexión lista y verificada mediante build, sin implementar todavía autenticación ni tablas de datos.

## Alcance

**Dentro del alcance:**

- **Instalación de paquetes**: `@supabase/supabase-js` y `@supabase/ssr`.
- **Cliente de navegador** (`app/lib/supabase/client.ts`): función `createClient()` que instancia el cliente de Supabase para Client Components, usando `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Cliente de servidor** (`app/lib/supabase/server.ts`): función `createClient()` (async, siguiendo el patrón oficial de `@supabase/ssr` con `cookies()` de `next/headers`) para Server Components, Server Actions y Route Handlers.
- **Variables de entorno nuevas**, documentadas en `.env.local.example`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - (Se conserva `SUPABASE_DB_PASSWORD`, ya presente en `.env.local.example`.)
- **Verificación de la integración** limitada a que el proyecto compile: `npm run build` sin errores de TypeScript ni de ESLint, con los clientes correctamente tipados e instanciables.

**Fuera de alcance (para otros specs):**

- Cualquier flujo de autenticación (login, registro, invitado, OAuth, sesiones) — la app sigue usando `app/context/auth-context.tsx` con `localStorage` exactamente como hoy; no se toca ese archivo.
- `middleware.ts` para refrescar sesión de Supabase Auth — no aplica todavía porque no hay auth en este spec.
- Cualquier tabla, migración o esquema en la base de datos de Supabase (juegos, puntuaciones, usuarios, etc.).
- Cualquier página o componente que consuma datos reales de Supabase — no se agrega ninguna consulta ni UI de prueba.
- Reemplazo de `app/data/games.ts` o `app/data/players.ts` por datos de Supabase.

## Modelo de datos

Esta funcionalidad no introduce estructuras de datos ni esquema en la base de datos — el proyecto de Supabase permanece sin tablas (confirmado vacío al momento de escribir este spec). Lo único que se agrega son los dos módulos de cliente (`app/lib/supabase/client.ts` y `app/lib/supabase/server.ts`), que no definen tipos de dominio propios, solo instancian el SDK.

## Plan de implementación

1. **Instalar dependencias** — `npm install @supabase/supabase-js @supabase/ssr`. El sistema queda funcional (paquetes instalados, sin uso todavía).

2. **Configurar variables de entorno** — Agregar `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_ANON_KEY=` (vacías) a `.env.local.example`, junto a `SUPABASE_DB_PASSWORD` ya existente. En `.env.local` (no versionado) se completan con los valores reales del proyecto ya existente, obtenidos vía el MCP de Supabase (`get_project_url`, `get_publishable_keys`). El sistema queda funcional (variables disponibles, sin consumirse aún).

3. **Crear el cliente de navegador** — `app/lib/supabase/client.ts`, exportando `createClient()` que instancia `createBrowserClient` de `@supabase/ssr` con las variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. El sistema queda funcional (módulo exportado, sin importarse desde ninguna página todavía).

4. **Crear el cliente de servidor** — `app/lib/supabase/server.ts`, exportando una función `async createClient()` que instancia `createServerClient` de `@supabase/ssr`, leyendo/escribiendo cookies vía `cookies()` de `next/headers` (patrón oficial de Supabase para Server Components/Actions en Next.js App Router). El sistema queda funcional (módulo exportado, sin consumirse aún).

5. **Verificar la integración** — Ejecutar `npm run build` y confirmar que compila sin errores de TypeScript ni de ESLint, con ambos clientes correctamente tipados. No se agrega ninguna página ni consulta de prueba. El sistema queda funcional: la integración está lista para que specs futuros (auth, tablas) la consuman directamente.

## Criterios de aceptación

- [x] `@supabase/supabase-js` y `@supabase/ssr` aparecen como dependencias en `package.json`.
- [x] `app/lib/supabase/client.ts` exporta una función `createClient()` que instancia el cliente de navegador de Supabase.
- [x] `app/lib/supabase/server.ts` exporta una función `async createClient()` que instancia el cliente de servidor de Supabase usando cookies de `next/headers`.
- [x] `.env.local.example` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (sin valores reales), junto a `SUPABASE_DB_PASSWORD` ya existente.
- [x] `.env.local` (no versionado) contiene los valores reales del proyecto Supabase existente.
- [x] `npm run build` compila sin errores de TypeScript ni de ESLint.
- [x] Ningún archivo de auth, páginas existentes o `app/data/` fue modificado como parte de este spec.

## Decisiones tomadas y descartadas

- **Alcance limitado a la integración base** (clientes de Supabase configurados y conectados), sin auth ni tablas de datos, porque el usuario quiere separar la conexión inicial de las decisiones de autenticación y modelo de datos, que se abordarán en specs futuros dedicados. Decisión explícita del usuario.
- **`@supabase/ssr` + `@supabase/supabase-js`** en vez de solo `@supabase/supabase-js`, porque es el patrón oficial de Supabase para Next.js App Router y deja el terreno preparado para que un futuro spec de auth con sesiones SSR no requiera reinstalar ni reestructurar los clientes. Decisión explícita del usuario.
- **Clientes ubicados en `app/lib/supabase/`** (no en `lib/` de la raíz), agrupados junto al resto del código de la app. Decisión explícita del usuario.
- **Verificación solo por build + tipos**, sin agregar ninguna consulta ni UI de prueba visible, para mantener este spec estrictamente como "cableado" sin tocar ninguna pantalla existente. Decisión explícita del usuario.
- **No se modifica `app/context/auth-context.tsx` ni `app/auth/page.tsx`** — el sistema de auth simulado con `localStorage` sigue funcionando exactamente igual hasta que un spec futuro lo reemplace.
- **Proyecto de Supabase reutilizado** (ya existente y sin tablas), en vez de crear uno nuevo, porque el usuario ya lo tenía configurado junto con el MCP de Supabase.
- **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en vez de `NEXT_PUBLIC_SUPABASE_ANON_KEY`** (ajuste durante la implementación): el proyecto ya tenía `.env.local`/`.env.local.example` configurados con `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (formato nuevo de clave publicable de Supabase, sucesor del "anon key" JWT clásico). Se usó esa variable existente en ambos clientes en lugar de introducir `NEXT_PUBLIC_SUPABASE_ANON_KEY` como variable duplicada. Decisión explícita del usuario durante la Fase 4.
