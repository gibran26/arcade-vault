# 03 — About page y envío de correos

**Estado:** Implementado
**Depende de:** `02-homepage` (Nav, estructura de rutas `/`, `/games`, `/auth`, `/hall-of-fame`)
**Fecha:** 2026-07-14
**Objetivo:** Construir la página "Acerca de" en `/about` a partir de la plantilla `references/templates/home-about/about.jsx`, con un formulario de contacto que envía correos reales vía Resend a través de un Server Action, y agregar el link "Acerca de" al Nav.

## Alcance

**Dentro del alcance:**

- **Nueva página en `/about`** (`app/about/page.tsx`), migrada desde `about.jsx`, con sus dos secciones:
  - Hero "Acerca de Arcade Vault" con kicker, título, misión y fila de 3 highlights con iconos pixel-art (`HighlightIcon`), incluyendo el efecto de aparición al hacer scroll (`.reveal` + `IntersectionObserver`, igual patrón que `useReveal` del spec 02).
  - Divider decorativo animado.
  - Sección de contacto: intro + tips, y formulario (nombre, correo, mensaje) que al enviarse exitosamente muestra el mismo bloque de "terminal falsa" (`terminal-success`) del template, y permite "ENVIAR OTRO MENSAJE" para resetear el formulario.
- **Envío real de correo vía Resend**, activado por un **Server Action** (`app/about/actions.ts` o similar) invocado directamente desde el `<form action={...}>`:
  - Se instala el SDK oficial `resend` (`npm install resend`).
  - El Server Action valida que los 3 campos no vengan vacíos (misma regla que ya existe en el cliente), arma un correo HTML simple con los datos del formulario, y lo envía usando `RESEND_API_KEY`.
  - `from`: `onboarding@resend.dev`. `to`: `CONTACT_EMAIL` (variable de entorno). `replyTo`: el correo ingresado en el formulario.
  - Se agregan `RESEND_API_KEY` y `CONTACT_EMAIL` como variables de entorno (documentadas en `.env.local.example`; el usuario las completa después con sus propios valores).
- **Estados del formulario en el cliente:**
  - Vacío/incompleto → shake visual (igual que el template), sin enviar.
  - Envío en curso → estado de carga (deshabilitar botón mientras se espera la respuesta del Server Action).
  - Éxito → terminal falsa de éxito (igual que el template).
  - Error (Resend falla) → mensaje de error simple reemplazando la terminal de éxito, con opción de reintentar (el formulario vuelve a su estado editable con los datos ya escritos).
- **Actualización del Nav** (`components/Nav.tsx`): agregar link "Acerca de" → `/about`, activo solo en `/about` exacto, en la versión de escritorio y en el panel móvil.
- **Port del CSS de about** (`.about`, `.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`/`.highlight`, `.about-divider`/`.div-bar`/`.div-pixels`, `.about-contact`, `.contact-grid`/`.contact-intro`/`.contact-title`/`.contact-sub`/`.contact-tips`/`.tip`, `.contact-form`/`.field`/`.shake`, `.terminal-success`/`.term-bar`/`.term-body`/`.line`/`.caret`) desde `references/templates/home-about/styles.css` hacia `app/globals.css`, siguiendo el mismo criterio del spec 02 (CSS portado casi literal, revisando manualmente si algún nombre de clase ya existe antes de fusionar).

**Fuera de alcance (para otro spec):**

- Cualquier tipo de protección anti-spam/anti-bot (captcha, honeypot, rate limiting) en el formulario de contacto.
- Persistencia de los mensajes de contacto en base de datos o archivo — el mensaje solo se envía por correo, no se guarda en ningún lado.
- Validación de formato de correo electrónico (regex) más allá de "campo no vacío", tanto en cliente como en servidor.
- Dominio propio verificado en Resend — se usa `onboarding@resend.dev` en modo pruebas; migrar a un dominio propio queda para un spec futuro.
- Cualquier otro uso de Resend fuera de este formulario de contacto (ej. correos transaccionales de autenticación, notificaciones de puntuaciones, etc.).
- Internacionalización o textos alternativos — el contenido se mantiene 1:1 en español tal como está en el template.

## Modelo de datos

Esta funcionalidad no introduce estructuras de datos persistentes ni módulos nuevos en `app/data/`. El único "dato" es el payload del formulario de contacto, manejado como estado local de React en el cliente y como argumentos de función en el Server Action:

```ts
type ContactFormData = {
  name: string;
  email: string;
  msg: string;
};
```

Este tipo vive junto al Server Action (`app/about/actions.ts`), sin necesidad de un archivo de tipos compartido, ya que no se reutiliza en ningún otro lugar del proyecto.

**Variables de entorno nuevas** (documentadas en `.env.local.example`, sin valores reales commiteados):

- `RESEND_API_KEY` — API key de Resend, provista por el usuario.
- `CONTACT_EMAIL` — correo destino donde llegan los mensajes del formulario.

## Plan de implementación

1. **Instalar `resend` y preparar variables de entorno** — Ejecutar `npm install resend`. Crear `.env.local.example` con `RESEND_API_KEY=` y `CONTACT_EMAIL=` (sin valores reales, solo las claves documentadas). El sistema queda funcional (no se usa nada nuevo todavía).

2. **Crear el Server Action de contacto** — `app/about/actions.ts` con una función `sendContactMessage(formData: FormData)` (o recibiendo `ContactFormData`) marcada `"use server"`, que:
   - Valida que `name`, `email` y `msg` no vengan vacíos; si falta alguno, retorna un resultado de error.
   - Arma un correo HTML simple con los tres campos.
   - Llama al SDK de `resend` con `from: "onboarding@resend.dev"`, `to: process.env.CONTACT_EMAIL`, `replyTo: email`, usando `process.env.RESEND_API_KEY`.
   - Retorna un resultado tipado (`{ ok: true }` o `{ ok: false, error: string }`) para que el cliente decida qué estado mostrar.
   El sistema queda funcional (el Server Action existe pero nada lo invoca aún).

3. **Portar el CSS de about** — Agregar a `app/globals.css` las reglas de `.about*`, `.contact*`, `.highlight*`, `.terminal-success` y relacionadas listadas en el Alcance, revisando manualmente cualquier coincidencia de nombre con clases ya existentes antes de fusionar. El sistema queda funcional (CSS sin uso todavía, no rompe nada existente).

4. **Crear la página `/about`** — `app/about/page.tsx` (Server Component) que renderiza el hero, el divider y la sección de contacto migrando el markup de `about.jsx`, con un componente cliente `ContactForm` (`app/about/ContactForm.tsx`, con `"use client"`) que encapsula el `useState` de `form`/`sent`/`shake`/estado de error/carga, el `onSubmit` con validación de campos vacíos, la invocación al Server Action del paso 2, y el render condicional entre formulario editable, terminal de éxito y mensaje de error. El efecto `.reveal` se implementa igual que en `useReveal` del spec 02. El sistema queda funcional: `/about` es alcanzable directamente por URL y el formulario envía correos reales.

5. **Actualizar el Nav** — En `components/Nav.tsx`, agregar el link "Acerca de" → `/about` (activo solo en `/about` exacto) en la versión de escritorio y en el panel móvil, siguiendo el mismo patrón que los links existentes (`Link` de `next/link` + función `isActive`).

6. **Repaso responsive y pulido** — Verificar en el navegador `/about` completa (desktop y mobile) contra `about.jsx`/`styles.css`: hero, highlights, divider, formulario, estados de éxito/error/carga, y el link del Nav en ambas versiones. Probar un envío real con una API key de prueba si el usuario ya la proporcionó, o confirmar al menos que el estado de error se muestra correctamente sin `RESEND_API_KEY` configurada.

## Criterios de aceptación

- [x] `/about` muestra el hero ("Acerca de Arcade Vault", misión, 3 highlights), el divider animado y la sección de contacto (intro + tips + formulario), visualmente equivalente a `about.jsx` + `styles.css`, con el efecto de aparición al hacer scroll funcionando.
- [x] Si algún campo del formulario (nombre, correo, mensaje) está vacío al enviar, se muestra el efecto de "shake" y no se invoca el envío de correo.
- [x] Al enviar el formulario con los 3 campos completos y `RESEND_API_KEY`/`CONTACT_EMAIL` configuradas correctamente, se envía un correo real a `CONTACT_EMAIL` desde `onboarding@resend.dev` con `replyTo` igual al correo ingresado, y el formulario muestra la terminal falsa de éxito con el nombre del remitente.
- [x] Desde la terminal de éxito, el botón "ENVIAR OTRO MENSAJE" resetea el formulario a su estado editable vacío.
- [x] Si el envío por Resend falla (API key inválida/faltante, error de red, etc.), se muestra un mensaje de error simple en vez de la terminal de éxito, y el usuario puede reintentar sin perder lo ya escrito.
- [x] Mientras el envío está en curso, el botón de envío queda deshabilitado (no se puede enviar dos veces el mismo formulario).
- [x] El Nav muestra "Inicio", "Biblioteca", "Salón de la Fama" y "Acerca de" (en ese orden); "Acerca de" está activo solo en `/about`. Esto aplica tanto en el Nav de escritorio como en el panel móvil.
- [x] `.env.local.example` documenta `RESEND_API_KEY` y `CONTACT_EMAIL` sin valores reales.
- [x] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Server Action en vez de Route Handler API**, invocado directamente desde `<form action={...}>`, porque Next.js 16 App Router lo soporta nativamente y evita escribir un endpoint REST + fetch manual solo para un formulario simple. Decisión explícita del usuario.
- **`RESEND_API_KEY` y `CONTACT_EMAIL` como variables de entorno**, no hardcodeadas, porque la API key es un secreto que el usuario provee después y el destinatario puede cambiar sin tocar código. Decisión explícita del usuario.
- **Remitente `onboarding@resend.dev`** en vez de un dominio propio verificado, porque el proyecto no tiene dominio de producción todavía; migrar a un dominio propio queda fuera de alcance para un spec futuro. Decisión explícita del usuario.
- **Sin protección anti-spam/anti-bot** (captcha, honeypot, rate limiting) en esta iteración, priorizando tener el envío funcionando primero; se evalúa agregar protección en un spec futuro si se vuelve necesario. Decisión explícita del usuario.
- **Validación solo de "campo no vacío"** en cliente y servidor, sin validar formato de correo con regex, para mantener fidelidad con el comportamiento del template y no sumar alcance no pedido. Decisión explícita del usuario.
- **Estado de error simple ante fallos de Resend** (en vez de no manejar el error o loggear silenciosamente), porque dejar al usuario sin feedback ante un envío fallido sería una mala experiencia, pero sin sobre-diseñar reintentos automáticos ni logging avanzado. Decisión explícita del usuario.
- **Mensajes de contacto no se persisten** (ni en base de datos ni en archivo) — el correo es el único registro del mensaje, consistente con que el proyecto aún no tiene una capa de persistencia real fuera de `localStorage` para auth/scores.
- **CSS portado casi literal a `globals.css`** (no reescrito en utilidades de Tailwind), consistente con el criterio ya establecido en los specs `01-mvp-pantallas-visuales` y `02-homepage`.

## Riesgos identificados

- **`RESEND_API_KEY` ausente o inválida en desarrollo/producción.** Si la variable de entorno no está configurada, el Server Action fallará al intentar enviar el correo. Mitigación: el estado de error del formulario cubre este caso de forma genérica (sin exponer detalles del error al usuario), y `.env.local.example` documenta claramente qué variables son necesarias antes de probar el envío real.
- **Límites del modo pruebas de `onboarding@resend.dev`.** Resend puede restringir el remitente de pruebas (por ejemplo, solo permitir enviar a la cuenta verificada del dueño de la API key). Mitigación: se documenta esta limitación como conocida; si el usuario necesita enviar a otros destinatarios, deberá verificar un dominio propio en Resend (fuera de alcance de este spec).
- **Filtración accidental de `RESEND_API_KEY` en el repositorio.** Al trabajar con un secreto real, existe riesgo de commitear `.env.local` por error. Mitigación: solo se crea `.env.local.example` (sin valores reales); se verifica que `.env.local` esté en `.gitignore` antes de que el usuario coloque su API key ahí.
