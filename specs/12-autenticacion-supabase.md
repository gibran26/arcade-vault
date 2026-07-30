# 12 — Autenticación real con Supabase Auth

**Estado:** Aprobado
**Depende de:** `specs/04-integracion-supabase.md` (clientes de Supabase ya instalados y verificados; este spec los usa por primera vez)
**Fecha:** 2026-07-29
**Objetivo:** Reemplazar la autenticación simulada de `app/context/auth-context.tsx` (localStorage) por autenticación real con Supabase Auth — registro e inicio de sesión con email/contraseña, login con Google y GitHub, confirmación de email obligatoria y recuperación de contraseña — manteniendo intacta la interfaz `useAuth()` (`{ user, login, signOut }`) que ya consumen `GamePlayClient`, `HallOfFameClient` y `Nav`, y añadiendo el middleware de refresco de sesión SSR que el spec 04 dejó pendiente para este momento.

## Alcance

**Dentro del alcance:**

- **Registro con email/contraseña** en `app/auth/page.tsx` (tab "CREAR CUENTA"): llama a `supabase.auth.signUp()` con `email`, `password` y `options.data.username` (el campo ya existente "Usuario" pasa a requerido y se guarda en `user_metadata.username`). Valida en cliente antes de enviar: contraseña de mínimo 8 caracteres y al menos un número. Tras el registro exitoso, muestra un estado "revisa tu correo para confirmar tu cuenta" (no hay sesión activa todavía porque la confirmación es obligatoria).
- **Inicio de sesión con username/contraseña** (tab "INICIAR SESIÓN"): dado que Supabase Auth requiere email (no username) para `signInWithPassword`, se agrega la tabla puente `public.profiles` (username → email) y una Server Action `signInWithUsername(username, password)` que resuelve el email antes de autenticar. El tab de login conserva su UI actual (pide "Usuario" + "Contraseña", sin campo de email).
- **Login con Google y GitHub**: los botones sociales ya existentes en la UI llaman a `supabase.auth.signInWithOAuth({ provider: 'google' | 'github', options: { redirectTo: '.../auth/callback' } })`. **Requiere una acción manual tuya fuera de este código**: crear las credenciales OAuth en Google Cloud Console y en GitHub Developer Settings, y pegarlas en el dashboard de Supabase (Authentication → Providers) — el spec documenta los pasos pero no puede ejecutarlos por ti.
- **Confirmación de email obligatoria**: se configura en el dashboard de Supabase (Authentication → Providers → Email → "Confirm email" activado, ya es el default). Se crea `app/auth/callback/route.ts` (Route Handler) que intercambia el código recibido (`exchangeCodeForSession`) para los tres flujos que usan el mismo patrón PKCE: confirmación de registro, login OAuth y recuperación de contraseña; redirige a `/games` en los dos primeros casos y a `/auth/update-password` en el tercero.
- **Recuperación de contraseña**: nueva página `app/auth/forgot-password/page.tsx` (formulario de un solo campo, email) que llama a `supabase.auth.resetPasswordForEmail()`; nueva página `app/auth/update-password/page.tsx` (formulario de nueva contraseña, misma regla de validación que el registro) que llama a `supabase.auth.updateUser({ password })` una vez que `/auth/callback` estableció la sesión de recuperación. Enlace "¿Olvidaste tu contraseña?" agregado al tab de login.
- **Modo invitado**: se mantiene el botón "JUGAR COMO INVITADO" con el comportamiento actual (sin cuenta, `user_id: null` en scores).
- **Middleware de sesión SSR** (`middleware.ts` en la raíz + `app/lib/supabase/middleware.ts`): patrón oficial de `@supabase/ssr` para refrescar el token de sesión en cada request a Server Components/Server Actions, tal como spec 04 lo dejó pendiente "para cuando exista auth".
- **Reescritura de `app/context/auth-context.tsx`**: mantiene la interfaz pública `{ user, login, signOut }` con `user: { name } | null` (incluyendo `login()` con su firma actual, conservado como punto de extensión aunque ningún flujo de este spec lo invoque), pero internamente reemplaza `localStorage` por la sesión real de Supabase (`supabase.auth.getSession()` + `onAuthStateChange` en el cliente de navegador).
- **Redirección automática**: si `/auth` se visita con sesión activa, redirige a `/games`.
- **`saveScore` vinculado a `user_id` real**: `app/lib/supabase/actions.ts` obtiene el `user_id` de la sesión activa (vía el cliente de servidor) y lo guarda en `public.scores.user_id`; los invitados siguen guardando `null` como hoy.
- **Logout real**: `signOut()` del contexto pasa a llamar a `supabase.auth.signOut()`.

**Fuera de alcance (para otros specs):**

- **Políticas de RLS en `public.scores`, `public.games` y `public.profiles`** (las tres sin RLS habilitado) — se deja como pendiente explícito en `references/pendent-fixes-todo.md` para un spec de seguridad dedicado, ya que amerita su propio análisis de políticas. Esto incluye `profiles` pese a exponer emails, por decisión explícita de mantener consistencia con la decisión ya tomada para `scores`/`games` en vez de resolverlo de forma parcial ahora.
- **Rediseño visual de la pantalla de auth** — se mantiene el mismo layout, estilos y textos de `app/auth/page.tsx`; solo cambia la lógica detrás del formulario.
- **Edición de perfil post-registro** (cambiar username, avatar, email, contraseña desde una pantalla de cuenta) — spec futuro.
- **Borrado de cuenta.**
- **Multi-factor auth, magic link u otros providers OAuth** (Apple, Discord, etc.) más allá de Google y GitHub.
- **Corregir la lógica ya existente y no relacionada de `youRank`/`youScore` en `HallOfFameClient.tsx`** (hoy es un cálculo simulado independiente de datos reales) — no es parte de este spec, se mantiene igual.
- **Migración de usuarios existentes** — confirmado que no hay ninguno real guardado en un backend; todo usuario deberá crear cuenta nueva.
- **Tests automatizados** — el proyecto no tiene runner configurado (`CLAUDE.md`); verificación manual con `npm run dev`.

## Modelo de datos

- **Tabla nueva `public.profiles`** (sin RLS, mismo tratamiento pendiente que `scores`/`games` — ver Fuera de alcance):

  ```sql
  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text unique not null,
    email text not null,
    created_at timestamptz not null default now()
  );
  ```

  Se puebla automáticamente vía un trigger de Postgres `on_auth_user_created` (patrón estándar de Supabase, migración SQL incluida en el plan de implementación) que, tras cada `insert` en `auth.users`, inserta en `profiles` usando `new.raw_user_meta_data->>'username'` y `new.email`, **solo cuando `raw_user_meta_data` trae la clave `"username"`** (`if new.raw_user_meta_data ? 'username' then ...`). Los usuarios que entran por Google/GitHub OAuth (sin campo de username en su flujo) no generan fila en `profiles` — no la necesitan, porque el login por username solo aplica al flujo de email/contraseña.

  **Corrección aplicada durante la verificación (no en la migración original del Paso 1):** la primera versión del trigger no tenía el `if` — insertaba incondicionalmente para cualquier usuario nuevo. Como `profiles.username` es `not null`, un registro por OAuth (sin `username` en sus metadatos) habría violado esa restricción dentro de la misma transacción que crea la fila en `auth.users`, rompiendo el propio registro con un error de base de datos. Se corrigió con una migración adicional (`fix_handle_new_user_skip_oauth_without_username`) que sustituye la función del trigger por la versión con el `if` de arriba, antes de que el usuario probara el login con Google, sin tocar la migración original ni el esquema de `profiles`.

- **`app/lib/supabase/actions.ts`** — nueva Server Action `signInWithUsername(username: string, password: string)`:
  1. Consulta `profiles` por `username` para obtener el `email` asociado (usando el cliente de servidor, misma clave anon que hoy).
  2. Si no encuentra fila, o si `supabase.auth.signInWithPassword({ email, password })` falla, devuelve el mismo mensaje genérico `"Usuario o contraseña incorrectos"` en ambos casos (para no revelar si el username existe).
  3. Si tiene éxito, la sesión queda establecida vía cookies (patrón `@supabase/ssr`) y la Server Action devuelve `{ error: null }`.

- **`app/context/auth-context.tsx`** — interfaz pública:

  ```ts
  interface AuthContextValue {
    user: User | null;
    login: (u: User | null) => void; // se conserva sin cambios de firma
    signOut: () => void;
  }
  ```

  `login()` se mantiene igual que hoy (fuerza el estado de `user` directamente, sin pasar por Supabase), reservado para validaciones futuras — **ningún flujo de este spec lo llama** (`app/auth/page.tsx` usa `signUp`/`signInWithUsername`/`signInWithOAuth` directamente, no `login()`). La única llamada a `login()` que existía en el código heredado era `login(null)` dentro de `playAsGuest()` — un no-op redundante, ya que `user` arranca en `null` y `/auth` solo se renderiza sin sesión activa (ver Paso 10). Se eliminó esa llamada durante la implementación para que el criterio "`login()` no es invocado desde ningún archivo de este spec" sea literalmente cierto, sin cambiar el comportamiento observable del botón "JUGAR COMO INVITADO". El resto de la reescritura interna:
  - Llama a `createClient()` (`app/lib/supabase/client.ts`, ya existente) para obtener el cliente de navegador.
  - En un `useEffect`, llama a `supabase.auth.getSession()` para el estado inicial y se suscribe a `supabase.auth.onAuthStateChange()` para mantener `user` sincronizado con la sesión real (esta sincronización puede sobrescribir lo que `login()` haya establecido manualmente, ya que ambos escriben al mismo estado).
  - `User.name` (tipo ya existente en `app/data/types.ts`, sin cambios) se resuelve así: `session.user.user_metadata.username` (registro con email/password) → si no existe, `session.user.user_metadata.full_name` o `name` (lo que entreguen Google/GitHub) → si no existe, el prefijo del email antes de `@`.
  - `signOut()` llama a `supabase.auth.signOut()`.

- **`app/auth/page.tsx`** — el tab "INICIAR SESIÓN" pasa a llamar a `signInWithUsername(username, password)` (Server Action de arriba) en vez de `signInWithPassword` directo. El tab "CREAR CUENTA" llama a `supabase.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: '.../auth/callback' } })` (cliente de navegador). Los botones sociales llaman a `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: '.../auth/callback' } })`. `playAsGuest()` deja de llamar a `login(null)` (ver Modelo de datos, ajuste decidido durante la implementación); su comportamiento observable —sin cuenta, redirige a `/games`— no cambia.

- **`app/auth/callback/route.ts`** (nuevo, Route Handler) — recibe `code` y `type` como query params; llama a `supabase.auth.exchangeCodeForSession(code)` (cliente de servidor); si `type=recovery`, redirige a `/auth/update-password`; en cualquier otro caso (confirmación de registro u OAuth), redirige a `/games`.

- **`app/auth/forgot-password/page.tsx`** (nuevo) — un campo `email`, llama a `supabase.auth.resetPasswordForEmail(email, { redirectTo: '.../auth/callback?type=recovery' })`.

- **`app/auth/update-password/page.tsx`** (nuevo) — un campo `password` (mínimo 8 caracteres y al menos un número), llama a `supabase.auth.updateUser({ password })` usando la sesión de recuperación ya establecida por el callback.

- **`middleware.ts`** (nuevo, raíz del proyecto) + **`app/lib/supabase/middleware.ts`** (nuevo) — patrón oficial de `@supabase/ssr`: instancia un cliente de Supabase ligado a las cookies de la request/response y llama a `supabase.auth.getUser()` en cada request que no sea de assets estáticos, para refrescar el token antes de que expire.

- **`app/lib/supabase/actions.ts`** — `saveScore(gameId, playerName, score)` mantiene su firma pública (sin tocar los call-sites en `GamePlayClient.tsx`), pero internamente obtiene el usuario de la sesión vía el cliente de servidor (`supabase.auth.getUser()`) y usa `data.user?.id ?? null` como `user_id` en el insert, en vez del `null` fijo actual.

## Plan de implementación

1. **Migración SQL: tabla `profiles` + trigger** — vía el MCP de Supabase (`apply_migration`), crear `public.profiles` (columnas `id`, `username`, `email`, `created_at`, sin RLS) y la función/trigger `on_auth_user_created` que la puebla leyendo `raw_user_meta_data->>'username'` y `email` de `auth.users` en cada `insert`. El sistema queda funcional: tabla lista, sin que nada de la app la use todavía.

2. **Configuración manual en el dashboard de Supabase (Authentication → URL Configuration)** — agregar `http://localhost:3000/auth/callback` (y el dominio de producción cuando exista) a las Redirect URLs permitidas, y confirmar que "Confirm email" está activo en Authentication → Providers → Email. Paso operativo tuyo, documentado aquí para que no se te olvide antes de probar el flujo.

3. **Configuración manual de OAuth (Google y GitHub)** — crear las credenciales OAuth en Google Cloud Console y en GitHub Developer Settings (Authorization callback URL: la URL de callback que Supabase indica en Authentication → Providers → Google/GitHub), y pegar Client ID/Secret en esos providers dentro del dashboard de Supabase. Paso operativo tuyo; sin él, los botones de Google/GitHub del paso 7 no funcionarán, pero el resto del spec (email/password, invitado) sigue siendo funcional mientras tanto.

4. **Middleware de sesión SSR** — crear `app/lib/supabase/middleware.ts` y `middleware.ts` en la raíz, siguiendo el patrón oficial de `@supabase/ssr` para refrescar la sesión en cada request. El sistema queda funcional: no cambia ningún comportamiento visible todavía (no hay auth real activa aún).

5. **Reescribir `app/context/auth-context.tsx`** — reemplazar `localStorage` por `supabase.auth.getSession()` + `onAuthStateChange()`, manteniendo `login()` y `signOut()` con su firma actual (ver Modelo de datos). El sistema queda funcional: la app sigue compilando y navegando igual; `signOut()` ya cierra sesión real, pero el login real todavía no está conectado desde la UI (eso es el paso 7).

6. **Server Actions de auth** en `app/lib/supabase/actions.ts` — agregar `signInWithUsername(username, password)` (lookup en `profiles` + `signInWithPassword`) y actualizar `saveScore` para leer `supabase.auth.getUser()` y guardar el `user_id` real en vez de `null` fijo. El sistema queda funcional: las Server Actions existen y son invocables, aunque la UI todavía no las use todas.

7. **Reescribir `app/auth/page.tsx`** — conectar el tab de login a `signInWithUsername`, el tab de registro a `supabase.auth.signUp()` (con `username` en `user_metadata` y `emailRedirectTo`), y los botones sociales a `supabase.auth.signInWithOAuth()`. Agregar validación de contraseña en cliente (mínimo 8 caracteres + un número) y estados de error/carga/"revisa tu correo". El sistema queda funcional: registro y login reales (email/password) funcionan de punta a punta; OAuth funciona si los pasos 2-3 ya se completaron.

8. **Crear `app/auth/callback/route.ts`** — intercambia el `code` recibido (`exchangeCodeForSession`) y redirige a `/auth/update-password` si `type=recovery`, o a `/games` en cualquier otro caso (confirmación de registro u OAuth). El sistema queda funcional: los tres flujos que dependen de un redirect de Supabase (confirmación, OAuth, recovery) ya aterrizan correctamente.

9. **Crear `app/auth/forgot-password/page.tsx` y `app/auth/update-password/page.tsx`**, más el enlace "¿Olvidaste tu contraseña?" en el tab de login. El sistema queda funcional: el flujo de recuperación de contraseña queda completo de punta a punta.

10. **Redirección de `/auth` con sesión activa** — convertir `app/auth/page.tsx` al patrón Server Component + Client (`page.tsx` verifica la sesión con el cliente de servidor y hace `redirect('/games')` si ya existe; la interactividad actual se mueve a `AuthPageClient.tsx`), siguiendo la convención ya usada en el resto del proyecto (`CLAUDE.md`). El sistema queda funcional: visitar `/auth` logueado redirige a `/games`; sin sesión, se ve el formulario igual que antes.

11. **Verificación manual end-to-end** (`npm run dev`, sin runner de tests por convención del proyecto): registro con email/password → confirmación por correo → login por username → guardado de score con `user_id` poblado → logout; login con Google; login con GitHub (si 2-3 están configurados); modo invitado sin cambios; recuperación de contraseña completa; y confirmación de que `GamePlayClient`, `HallOfFameClient` y `Nav` siguen comportándose igual que antes (mismo HUD, mismo menú de cuenta).

12. **Build final** — `npm run build` sin errores de TypeScript ni ESLint.

13. **Registrar el hallazgo de RLS pendiente** en `references/pendent-fixes-todo.md` — agregar `public.profiles` a la entrada ya existente (o crear una nueva) sobre RLS deshabilitado en `scores`/`games`, dejando constancia de que las tres tablas quedan pendientes para el spec de seguridad futuro.

## Criterios de aceptación

- [x] `public.profiles` existe con columnas `id` (PK, FK a `auth.users.id`), `username` (único, not null), `email` (not null), `created_at`, sin RLS habilitado.
- [x] El trigger `on_auth_user_created` inserta una fila en `profiles` automáticamente al registrarse con email/contraseña, usando el `username` capturado en el formulario.
- [x] Registrarse con email + username + contraseña (mínimo 8 caracteres y un número) en `app/auth/page.tsx` crea el usuario en Supabase Auth y muestra el estado "revisa tu correo para confirmar tu cuenta", sin iniciar sesión todavía.
- [x] Intentar iniciar sesión antes de confirmar el correo muestra un mensaje de error explícito, sin establecer sesión.
- [x] Hacer clic en el enlace de confirmación del correo redirige a `/games` con sesión activa.
- [x] Iniciar sesión con username + contraseña correctos (cuenta ya confirmada) establece sesión y redirige a `/games`.
- [x] Iniciar sesión con username inexistente o contraseña incorrecta muestra el mismo mensaje genérico ("Usuario o contraseña incorrectos") en ambos casos.
- [x] Con Google y GitHub configurados (paso 2-3 del plan), hacer clic en los botones sociales completa el login vía OAuth y redirige a `/games` con sesión activa.
- [x] "JUGAR COMO INVITADO" sigue funcionando exactamente igual que antes: sin cuenta, `user_id: null` al guardar puntaje.
- [ ] "¿Olvidaste tu contraseña?" envía el correo de recuperación; al hacer clic en el enlace, `/auth/callback` redirige a `/auth/update-password`; establecer ahí una nueva contraseña permite iniciar sesión con ella después.
- [x] Cerrar sesión (`signOut()` desde `Nav`) invalida la sesión real de Supabase — recargar la página no restaura el usuario.
- [x] Visitar `/auth` con sesión activa redirige automáticamente a `/games`; sin sesión, se ve el formulario normalmente.
- [x] Al guardar un puntaje logueado, `public.scores.user_id` queda poblado con el `id` real del usuario (verificable con `execute_sql` o el dashboard de Supabase); al guardar como invitado, sigue guardando `null`.
- [x] `useAuth()` conserva la firma `{ user, login, signOut }` (sin cambios de forma); `login()` tiene exactamente un invocador legítimo en `AuthPageClient.tsx`, tras un `signInWithUsername()` exitoso, para sincronizar el contexto con la sesión real (ver "Decisiones tomadas y descartadas").
- [x] `GamePlayClient.tsx`, `HallOfFameClient.tsx` y `Nav.tsx` no cambian su comportamiento observable (mismo HUD, mismo menú de cuenta) tras la reescritura de `auth-context.tsx`.
- [x] Tras iniciar sesión con username + contraseña, el `Nav` refleja la sesión (usuario logueado, no el botón "Iniciar Sesión") de inmediato al llegar a `/games`, sin necesitar un refresh manual del navegador.
- [ ] `middleware.ts` refresca la sesión en Server Components/Server Actions sin requerir un refresh manual del navegador durante una sesión larga.
- [x] `references/pendent-fixes-todo.md` incluye `public.profiles` en el hallazgo de RLS pendiente, junto a `scores`/`games`.
- [x] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Email + contraseña + OAuth (Google y GitHub)** en vez de solo email/contraseña, porque la UI ya tenía botones sociales simulados y el usuario quiso activarlos. Decisión explícita del usuario; implica un paso manual de configuración en Google Cloud Console/GitHub Developer Settings que este spec no puede ejecutar por sí mismo.
- **Se descarta magic link** como método adicional — no se pidió y habría requerido decisiones extra de UX (¿coexiste con contraseña?) fuera del alcance actual.
- **Modo invitado se mantiene** exactamente igual que hoy (sin cuenta, `user_id: null`), en vez de eliminarlo, para no forzar registro a quien solo quiere jugar una partida. Decisión explícita del usuario.
- **Confirmación de email obligatoria** en vez de login inmediato tras registro, pese a ser el flujo actual (fake) más simple — el usuario prefirió el flujo estándar y más seguro de Supabase Auth aun a costa de un paso adicional para quien se registra.
- **Login por username (no por email) mediante tabla puente `public.profiles`**, en vez de cambiar el formulario de login para pedir email — descubierto durante la Fase de definición: Supabase Auth requiere email para `signInWithPassword`, pero el tab de login actual solo pedía "Usuario". El usuario prefirió preservar la UI/UX actual (login por username) sobre la alternativa más simple (pedir email en el login), aceptando la tabla adicional y el lookup extra que eso implica.
- **`public.profiles` queda sin RLS**, igual que `scores`/`games`, en vez de aplicar una política mínima de "sin SELECT público" solo a esta tabla nueva — pese a que expone emails (dato más sensible que los puntajes), el usuario prefirió mantener consistencia con la decisión ya tomada de resolver RLS en un spec de seguridad aparte, en vez de resolverlo de forma parcial y asimétrica ahora. Riesgo documentado explícitamente en `references/pendent-fixes-todo.md` (paso 13 del plan).
- **RLS de `scores`/`games`/`profiles` se deja fuera de este spec** — el usuario decidió no mezclar el diseño de políticas de seguridad con la introducción de autenticación real, prefiriendo abordarlo como spec dedicado una vez exista identidad real que esas políticas puedan usar (`auth.uid()`).
- **`saveScore` sí vincula `user_id` real** cuando hay sesión activa (en vez de mantenerlo siempre en `null`), porque el usuario quiso aprovechar la columna ya existente en `scores` para dejar preparado un futuro historial de puntajes por cuenta, aunque ninguna pantalla lo consuma todavía.
- **Regla de contraseña más estricta en cliente** (mínimo 8 caracteres + un número) en vez de solo el mínimo de 6 caracteres de Supabase, por preferencia explícita del usuario sobre seguridad básica adicional sin agregar fricción excesiva.
- **`useAuth()` conserva `login()` en su interfaz pública** (con la misma firma que hoy, `login: (u: User | null) => void`), en vez de retirarlo por no tener consumidores. La intención original era conservarlo como punto de extensión sin invocador real (ver la entrada siguiente sobre `playAsGuest()`), pero durante la verificación manual se le encontró un uso legítimo real — ver la entrada más abajo sobre el fix del `Nav`.
- **`playAsGuest()` deja de llamar a `login(null)`**, ajuste decidido durante la verificación de criterios de aceptación (no estaba en el plan original, que decía "`playAsGuest()` no cambia"): esa llamada heredada de la versión con `localStorage` era un no-op redundante (`user` ya es `null` cuando `/auth` se renderiza, dado el `redirect` del Paso 10), pero su sola presencia hacía técnicamente falso el criterio "`login()` no es invocado desde ningún archivo de este spec", ya que la línea vive en `AuthPageClient.tsx`, un archivo creado por este spec. El usuario prefirió quitar la llamada muerta antes que reinterpretar el criterio de forma laxa. Sin cambio de comportamiento observable.
- **Bug encontrado en la verificación manual: el `Nav` no reflejaba la sesión tras el login por username/contraseña hasta refrescar la página manualmente.** Causa raíz: `signInWithUsername()` es una Server Action que establece la sesión completamente en el servidor (cookie vía `Set-Cookie`, con un cliente de Supabase distinto al que usa `AuthProvider` en el navegador); `AuthProvider` vive en `app/layout.tsx` y no se remonta en la navegación SPA (`router.push('/games')`) que sigue al login, así que su suscripción a `onAuthStateChange()` nunca se entera del cambio (verificado en el código fuente de `@supabase/auth-js`: ni siquiera una llamada manual a `getSession()` dispara esa notificación cuando la sesión sigue siendo válida). Por eso Google/GitHub y la confirmación de email sí funcionaban bien: ambos terminan en una redirección HTTP dura del servidor, que remonta `AuthProvider` desde cero. Se evaluaron tres soluciones: (1) forzar una recarga completa de página tras el login (funciona, pero peor UX y no resuelve el problema de fondo para futuros flujos similares), (2) agregar una función nueva al contexto tipo `refreshSession()` (más "limpio" conceptualmente, pero expande la interfaz de `useAuth()` de 3 a 4 miembros), (3) **reutilizar `login()`** — leer la sesión real con `getSession()` tras el login y pasar el resultado a `login()`. Se eligió la opción 3, por decisión explícita del usuario: no cambia la forma de la interfaz de `useAuth()` (sigue siendo `{ user, login, signOut }`), evita una recarga completa, y le da a `login()` un uso real y legítimo — sincronizar el contexto con una sesión de Supabase genuina, en vez de forzar un valor arbitrario simulado como hacía el código heredado de `playAsGuest()` que se quitó (entrada anterior). Esto **revierte parcialmente** la entrada anterior sobre `login()`: ya no es "código sin uso activo", tiene exactamente un invocador legítimo en `AuthPageClient.tsx`, tras `signInWithUsername()`.
- **`app/auth/page.tsx` se convierte a Server Component + Client** (`page.tsx` + `AuthPageClient.tsx`) únicamente para poder verificar la sesión y redirigir desde el servidor, siguiendo la convención arquitectónica ya establecida en el resto del proyecto (`CLAUDE.md`), en vez de mantenerlo 100% Client Component y resolver la redirección con un `useEffect` en el cliente (más simple pero con parpadeo visible del formulario antes de redirigir).
- **No se migran usuarios existentes** — confirmado que el sistema actual es 100% simulado (`localStorage`), sin ningún usuario real persistido en un backend; cada persona deberá crear cuenta nueva.
