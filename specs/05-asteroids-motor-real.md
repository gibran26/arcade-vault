# 05 — Juego Asteroids (motor real)

**Estado:** Implementado
**Depende de:** ninguno (usa la estructura de rutas /game/[id] y /game/[id]/play ya existentes)
**Fecha:** 2026-07-15
**Objetivo:** Portar el motor real de Asteroids (references/started-games/02-asteroids/game.js) a un módulo TypeScript que se ejecute dentro del canvas de /game/asteroids/play, notificando a React los cambios de puntaje y vidas para alimentar el HUD existente, en lugar de la simulación aleatoria actual.

## Alcance

**Dentro del alcance:**

- **Nueva entrada en el catálogo** (`app/data/games.ts`): `id: "asteroids"`, `title: "ASTEROIDS"`, `cat: "SHOOTER"`, reutilizando `cover: "cover-rocas"` y `color: "yellow"` (mismos valores visuales que la entrada mock "rocas", que no se toca). Campos `short`/`long`/`best`/`plays` con contenido nuevo acorde al juego real.
- **Puerto del motor a TypeScript**: conversión de `references/started-games/02-asteroids/game.js` (510 líneas, clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, wrapping toroidal, colisiones) a un módulo ES en `app/game-engines/asteroids/engine.ts`, eliminando el uso de variables globales. Expone una función `createGame(canvas, callbacks)` que inicializa el juego sobre un `<canvas>` recibido por referencia, y funciones/métodos para `pause()`, `resume()` y `destroy()`.
- **Callbacks de notificación a React**: el engine invoca `onScoreChange(score)`, `onLivesChange(lives)`, `onGameOver(finalScore)` y `onPauseChange(isPaused)` para que el HUD y el modal de fin de juego de React (`/game/[id]/play`) reflejen el estado real del juego en curso. `onPauseChange` confirma el cambio de estado cada vez que React invoca `pause()`/`resume()` sobre la instancia del engine.
- **Modificación de `app/game/[id]/play/page.tsx`**: cuando `id === "asteroids"`, en vez de la simulación de puntaje aleatorio, se monta un `<canvas>` en lugar del `game-arena` decorativo actual (los `<div>` `enemy`/`player-ship` no se renderizan para este juego) y se inicializa el engine real vía `useEffect`, conectando sus callbacks al estado de React (`score`, `lives`). El `player-hud` de React (Jugador/Puntuación/Vidas/Nivel, fuera del `crt-screen`) no cambia de estructura ni estilo — solo pasa a alimentarse de datos reales en vez de la simulación aleatoria. El resto de juegos (`id` distinto) sigue usando la simulación actual sin cambios.
- **Ambos HUDs coexisten sin modificarse**: el HUD interno que `game.js` dibuja dentro del propio canvas (`SCORE`, `NIVEL`, iconos de vidas, overlay `GAME OVER`, indicador `3x Ns` de disparo triple) se porta tal cual, sin quitarle ni agregarle nada. El `player-hud` de React (arriba del `crt-screen`) tampoco se modifica. Esto implica que puntaje y vidas quedan visibles simultáneamente en dos lugares de la pantalla (dentro del canvas y en el panel de React) — es una duplicación visual intencional, no un defecto a corregir en este spec.
- **Puerto de power-ups**: además de `Bullet`, `Asteroid`, `Ship`, `Particle`, se porta también la clase `PowerUp` y el mecanismo `ship.tripleShot` (disparo triple temporal que sueltan ocasionalmente los asteroides al destruirse), incluyendo su indicador visual `3x Ns` dentro del HUD interno del canvas. No se agrega ningún callback nuevo a React para esto — el indicador ya lo muestra el propio canvas.
- **Pausa real**: el botón "PAUSA" del HUD llama a `pause()`/`resume()` del engine; el engine detiene/reanuda el `requestAnimationFrame` real y confirma el nuevo estado vía `onPauseChange(isPaused)`.
- **Fin de juego por vidas agotadas**: el engine detecta internamente que `lives` llega a `0`, invoca `onLivesChange(0)` y a continuación `onGameOver(finalScore)`. React usa `onGameOver` como único disparador del modal "FIN DEL JUEGO" (ya no infiere el fin de juego a partir de `lives === 0`).
- **Reinicio limpio**: al presionar "JUGAR DE NUEVO" en el modal, React llama a `destroy()` sobre la instancia anterior del engine y crea una nueva con `createGame()`, dejando nave, asteroides, vidas y puntaje en su estado inicial. El reinicio automático que `game.js` original dispara internamente al presionar `Espacio` en pantalla de `GAME OVER` (llamada directa a `initGame()`) se desactiva en el puerto: en estado `gameover`, el engine ignora la tecla `Espacio`. El único reinicio posible es el controlado por React.
- **Controles**: se conservan los controles originales del juego (`←`/`→` rotar, `↑` propulsar, `Espacio` disparar), capturados por el engine vía listeners de teclado propios.
- **Campo "Nivel" del HUD**: la interfaz `AsteroidsCallbacks` incluye `onLevelChange?: (level: number) => void` como campo opcional, pensado para futuros motores portados que sí tengan niveles. El engine de Asteroids no lo invoca (el juego original no tiene niveles); el HUD sigue mostrando `01` fijo para este juego.

**Fuera de alcance (para otros specs):**

- Persistencia real del puntaje final (Supabase, localStorage o cualquier otro storage). El botón "GUARDAR PUNTUACIÓN" sigue funcionando igual que hoy (solo marca `saved = true` en estado local, sin persistir en ningún lado).
- Soporte táctil/móvil para controlar la nave (el juego original y este spec son solo teclado, aunque la etiqueta "TÁCTIL" siga apareciendo en la página de detalle del juego).
- Modificar la entrada mock `"rocas"` existente en `app/data/games.ts` o su comportamiento simulado.
- Adaptar o portar cualquier otro juego de `references/started-games/` — este spec cubre únicamente Asteroids.
- Diseño de un cover/gradiente nuevo en `globals.css` — se reutiliza `cover-rocas` tal cual existe.
- Leaderboard real o específico para este juego (`app/data/players.ts` y `seededScores` no se tocan).

## Modelo de datos

Esta funcionalidad no introduce nuevas tablas ni persistencia — solo estructuras en memoria/TypeScript para conectar el engine con React.

- **Entrada en `app/data/games.ts`** (usa el tipo `Game` ya existente en `app/data/types.ts`, sin cambios en el tipo):

  ```ts
  {
    id: "asteroids",
    title: "ASTEROIDS",
    short: "Pulveriza asteroides en gravedad cero.",
    long: "Tu nave triangular flota en el vacío absoluto. Rota, propulsa y dispara para partir rocas gigantes en fragmentos cada vez más pequeños, en un campo de juego que envuelve sus propios bordes.",
    cat: "SHOOTER",
    cover: "cover-rocas",
    color: "yellow",
    best: 0,
    plays: "0",
  }
  ```

- **`app/game-engines/asteroids/engine.ts`** — módulo nuevo, sin estado global. Expone:

  ```ts
  export interface AsteroidsCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void;
    onGameOver: (finalScore: number) => void;
    onPauseChange: (isPaused: boolean) => void;
    onLevelChange?: (level: number) => void;
  }

  export interface AsteroidsGame {
    pause: () => void;
    resume: () => void;
    destroy: () => void;
  }

  export function createGame(
    canvas: HTMLCanvasElement,
    callbacks: AsteroidsCallbacks,
  ): AsteroidsGame;
  ```

  Internamente conserva las clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` del `game.js` original, incluyendo el mecanismo `ship.tripleShot` y las funciones `drawHUD`/`drawOverlay` (dibujo del HUD interno del canvas), pero como variables/funciones encapsuladas dentro del closure de `createGame`, no globales de módulo.

  - `onGameOver` se invoca una única vez, inmediatamente después de la última llamada a `onLivesChange(0)`.
  - `onPauseChange` se invoca cada vez que `pause()` o `resume()` se ejecutan sobre la instancia devuelta por `createGame`, confirmando el nuevo estado (`true`/`false`).
  - `onLevelChange` es opcional y el engine de Asteroids nunca lo invoca (el juego original no tiene niveles); queda reservado para futuros motores portados que sí los tengan.

- **`app/game/[id]/play/page.tsx`**: no se agregan tipos nuevos. El estado React existente (`score`, `lives`) se actualiza exclusivamente vía `onScoreChange`/`onLivesChange` cuando `id === "asteroids"`. El modal "FIN DEL JUEGO" se dispara únicamente desde `onGameOver(finalScore)`, ya no por inferencia de `lives === 0`. El estado de pausa visual del HUD se sincroniza con `onPauseChange(isPaused)` en vez de derivarse solo de la acción del botón. Se guarda la instancia de `AsteroidsGame` devuelta por `createGame` en un `useRef` para poder llamar `pause()`/`resume()`/`destroy()`.

## Plan de implementación

1. **Agregar la entrada "asteroids" a `app/data/games.ts`** — usando los valores definidos en el modelo de datos. El sistema queda funcional: el juego aparece en `/games` y en `/game/asteroids`, pero `/game/asteroids/play` sigue mostrando la simulación genérica actual (aún no hay engine real).

2. **Crear `app/game-engines/asteroids/engine.ts`** — portar `game.js` completo a TypeScript dentro de `createGame(canvas, callbacks)`: clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, wrapping toroidal, colisiones, spawn de asteroides, disparo, invencibilidad temporal, partículas de explosión, el mecanismo `tripleShot`, y el dibujo del HUD interno (`drawHUD`/`drawOverlay`, incluyendo el overlay `GAME OVER`), todo encapsulado (sin variables de módulo globales). El reinicio automático con `Espacio` en estado `gameover` se omite al portar (el engine ignora esa tecla en ese estado). El sistema queda funcional: el módulo compila y es importable, pero todavía no se usa desde ninguna página.

3. **Conectar los callbacks `onScoreChange`/`onLivesChange`/`onGameOver`/`onPauseChange`** — dentro del engine, en los puntos donde hoy `game.js` actualiza `score` y `lives` (destrucción de asteroides, colisión de la nave), invocar `onScoreChange`/`onLivesChange`. Cuando `lives` llega a `0`, invocar `onGameOver(finalScore)` justo después de la última llamada a `onLivesChange(0)`. `onPauseChange` se conecta en el paso 4, junto con `pause()`/`resume()`. `onLevelChange` queda declarado en el tipo pero no se invoca desde ningún punto del engine. El sistema queda funcional: el engine notifica todos los cambios de estado relevantes aunque aún no haya un consumidor en React.

4. **Implementar `pause()` / `resume()` / `destroy()`** en el engine — controlando el `requestAnimationFrame` real (cancelar/reanudar el loop) e invocando `onPauseChange(true)`/`onPauseChange(false)` respectivamente. En `destroy()`, remover listeners de teclado y detener el loop definitivamente. El sistema queda funcional: la API pública del engine está completa y probada de forma aislada.

5. **Modificar `app/game/[id]/play/page.tsx`** — cuando `game.id === "asteroids"`: renderizar un `<canvas>` (800×600) en lugar del `game-arena` decorativo (sus `<div>` `enemy`/`player-ship` no se renderizan para este juego), inicializar el engine en un `useEffect` vía `createGame(canvasRef.current, { onScoreChange: setScore, onLivesChange: setLives })`, guardar la instancia en un `useRef`, y limpiar con `destroy()` en el cleanup del efecto. El `player-hud` de React no cambia de estructura ni estilo. Para el resto de juegos (`id !== "asteroids"`) el comportamiento simulado actual no cambia. El sistema queda funcional: el juego real es jugable end-to-end con teclado, con su HUD interno visible dentro del canvas y el HUD de React reflejando los mismos datos en paralelo.

6. **Conectar pausa real y sincronización de estado** — el botón "PAUSA" llama a `pause()`/`resume()` de la instancia en el `useRef`; el estado visual de pausa en el HUD se actualiza a partir de `onPauseChange(isPaused)` en vez de solo la acción local del botón. El campo Nivel del HUD se mantiene fijo en `01` (no se conecta a `onLevelChange`, que no se invoca para este juego). El sistema queda funcional: pausar detiene el juego real y el HUD refleja el estado confirmado por el engine.

7. **Conectar fin de juego y reinicio** — el modal "FIN DEL JUEGO" se dispara únicamente desde el callback `onGameOver(finalScore)` (ya no por inferencia de `lives === 0` en React), mostrando el puntaje final recibido. Al presionar "JUGAR DE NUEVO", se llama `destroy()` sobre la instancia previa y se vuelve a llamar `createGame()` para arrancar limpio. El sistema queda funcional: el ciclo completo jugar → perder → reiniciar funciona con el motor real.

8. **Verificación manual y build** — jugar una partida completa en `/game/asteroids/play` confirmando controles (`←`/`→`/`↑`/`Espacio`), envolvimiento toroidal, split de asteroides, puntaje/vidas reales en el HUD, pausa real, fin de juego al perder las 3 vidas y reinicio limpio. Ejecutar `npm run build` sin errores de TypeScript/ESLint. El sistema queda funcional y verificado de punta a punta.

## Criterios de aceptación

- [x] `app/data/games.ts` incluye una entrada con `id: "asteroids"`, `cat: "SHOOTER"`, `cover: "cover-rocas"`, `color: "yellow"`, visible en `/games` y en `/game/asteroids`.
- [x] `app/game-engines/asteroids/engine.ts` existe, exporta `createGame(canvas, callbacks)` y no usa variables globales de módulo (toda la lógica del `game.js` original queda encapsulada dentro del closure de `createGame`).
- [x] `AsteroidsCallbacks` incluye `onScoreChange`, `onLivesChange`, `onGameOver`, `onPauseChange` (obligatorios) y `onLevelChange` (opcional).
- [x] En `/game/asteroids/play` el juego se renderiza dentro de un `<canvas>` de 800×600 y es jugable con teclado: `←`/`→` rotan la nave, `↑` propulsa, `Espacio` dispara.
- [x] El envolvimiento toroidal de bordes y el split de asteroides (grande → mediano → pequeño) funcionan igual que en el juego original.
- [x] El power-up de disparo triple (`PowerUp`, `ship.tripleShot`) funciona igual que en el juego original: los asteroides lo sueltan ocasionalmente al destruirse, la nave dispara 3 balas mientras está activo, y su indicador `3x Ns` se sigue mostrando dentro del canvas.
- [x] El HUD interno del canvas (`SCORE`, `NIVEL`, iconos de vidas, overlay `GAME OVER`) se sigue dibujando exactamente igual que en `game.js` original, sin quitar ni agregar elementos.
- [x] El HUD de React muestra el puntaje real del juego (actualizado vía `onScoreChange`), no valores aleatorios — visible en paralelo al HUD interno del canvas, no en su reemplazo.
- [x] El HUD de React muestra las vidas reales del juego (actualizadas vía `onLivesChange`), no valores simulados — visible en paralelo al HUD interno del canvas, no en su reemplazo.
- [x] En estado `gameover`, presionar `Espacio` NO reinicia el engine internamente (a diferencia del `game.js` original); el único reinicio posible es vía el botón "JUGAR DE NUEVO" de React.
- [x] El campo "Nivel" del HUD se muestra fijo en `01` para este juego; `onLevelChange` está declarado en el tipo pero nunca es invocado por el engine de Asteroids.
- [x] El botón "PAUSA" detiene el `requestAnimationFrame` real del engine (la nave/asteroides dejan de moverse), y "REANUDAR" lo reactiva; el estado visual de pausa del HUD se sincroniza con `onPauseChange(isPaused)`.
- [x] Al llegar a 0 vidas, el engine invoca `onLivesChange(0)` seguido de `onGameOver(finalScore)`, y React muestra automáticamente el modal "FIN DEL JUEGO" con el puntaje final recibido (sin inferir el fin de juego por otro medio).
- [x] Al presionar "JUGAR DE NUEVO", el engine se destruye y se vuelve a crear desde cero: nave, asteroides, puntaje (0) y vidas (3) quedan en su estado inicial.
- [x] Salir de la partida (botón "SALIR" o navegación fuera de la página) limpia correctamente el engine (`destroy()` se llama en el cleanup del `useEffect`, sin loops ni listeners de teclado colgando).
- [x] Los demás juegos del catálogo (`id !== "asteroids"`) conservan exactamente el comportamiento simulado actual, sin regresiones.
- [x] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Ambos HUDs coexisten sin modificarse**: el HUD interno dibujado por `game.js` dentro del canvas (SCORE/NIVEL/vidas/GAME OVER/indicador de disparo triple) se porta tal cual, y el `player-hud` de React tampoco se toca. Se aceptó la duplicación visual de puntaje/vidas en dos lugares de la pantalla, en vez de eliminar el HUD interno del canvas para evitarla, porque el usuario quiere preservar el juego original sin modificaciones y porque React solo maneja los campos genéricos que ya tiene preparados (score/lives/level) — no necesita ampliarse para datos específicos de un juego como el disparo triple, que ya se muestra dentro del canvas. Decisión explícita del usuario (revierte una propuesta intermedia de este spec que planteaba eliminar el HUD interno).
- **Puerto completo de `PowerUp`/`tripleShot`**, en vez de dejarlos fuera de alcance, porque el usuario confirmó que el juego original ya está completamente desarrollado y esa mecánica debe portarse igual que el resto. No se agrega ningún callback nuevo a React para esto — el indicador visual ya lo resuelve el HUD interno del canvas. Decisión explícita del usuario.
- **Reinicio con `Espacio` en `GAME OVER` desactivado en el puerto**, a diferencia del `game.js` original (que llama a `initGame()` internamente al detectar `Espacio` en ese estado), porque dejaría al engine reiniciándose por su cuenta mientras el modal "FIN DEL JUEGO" de React sigue abierto, desincronizando el estado real del juego del que React cree que existe. El único camino de reinicio es el botón "JUGAR DE NUEVO" de React (`destroy()` + `createGame()`). Decisión explícita del usuario.
- **Título oficial "ASTEROIDS" (inglés)**, tanto en el `title` mostrado en el catálogo como en `id: "asteroids"`, la ruta `/game/asteroids` y la carpeta `app/game-engines/asteroids/`, en vez de mantener el nombre en español "Asteroides" usado en la versión inicial de este spec. Decisión explícita del usuario: el nombre del juego original es "Asteroids" y se conserva tal cual en id, rutas y título.
- **Nuevo id "asteroids"** en vez de reutilizar la entrada mock "rocas", porque el usuario quiere mantener "rocas" intacta (posiblemente para otro propósito futuro) y dejar este juego real como una entrada independiente y explícita en el catálogo. Decisión explícita del usuario.
- **Motor real dentro de un `<canvas>` controlado por React**, en vez de un `<iframe>` con el `index.html` original, porque el usuario quiere que el juego notifique a React los cambios de vidas y puntaje para alimentar el HUD existente — un iframe aislaría ese estado y lo haría inaccesible desde React. Decisión explícita del usuario.
- **Puerto completo a TypeScript como módulo ES** (`createGame(canvas, callbacks)`), en vez de copiar `game.js` tal cual y cargarlo con un `<script>` con hooks globales, para eliminar el uso de variables globales (que chocarían si se navega entre partidas o juegos) y mantener consistencia con el resto del proyecto, que es 100% TypeScript. Decisión explícita del usuario.
- **Callbacks `onScoreChange`/`onLivesChange`** como único mecanismo de comunicación engine → React, en vez de que React lea el estado del engine por polling, porque es el patrón más directo y evita necesidad de sincronización periódica.
- **Pausa real controlando el `requestAnimationFrame`** en vez de mantener solo el overlay visual actual, porque el usuario explícitamente pidió que la pausa detenga el juego real, no solo lo oculte.
- **Fin de juego notificado vía callback dedicado `onGameOver(finalScore)`**, en vez de que React infiera el fin de juego a partir de `lives === 0`, porque el usuario prefiere un canal explícito e inequívoco para disparar el modal, evitando que React tenga que derivar estado de negocio a partir de un valor que en principio solo describe las vidas restantes. Decisión explícita del usuario (revierte la decisión original de este spec).
- **`onPauseChange(isPaused)` solo confirma pausas iniciadas por React** (vía `pause()`/`resume()` en la instancia del engine), no pausas que el engine decida por sí mismo (p. ej. al perder foco de la ventana). React sigue siendo la única fuente de verdad sobre cuándo pausar; el callback es una confirmación de eco, no un canal de eventos autónomos del engine. Decisión explícita del usuario.
- **`onLevelChange` se define como campo opcional en `AsteroidsCallbacks` pero no se invoca en este spec**, porque el juego original no tiene niveles y forzar su invocación (p. ej. con `onLevelChange(1)` fijo) no aporta valor real; se deja el campo declarado para que futuros motores portados desde `references/started-games/` que sí tengan niveles reutilicen la misma forma de interfaz sin romper compatibilidad. Decisión explícita del usuario.
- **Reinicio vía `destroy()` + `createGame()` de nuevo**, en vez de un método `reset()` interno, para garantizar un estado completamente limpio (sin arrastrar bugs de variables mal reseteadas) aprovechando que crear una instancia nueva es barato para este juego. Decisión explícita del usuario.
- **Campo "Nivel" fijo en `01`**, en vez de eliminarlo del HUD, para mantener consistencia visual con el resto de los juegos del catálogo que sí muestran ese campo. Decisión explícita del usuario.
- **Persistencia del puntaje fuera de alcance**, dejando el botón "GUARDAR PUNTUACIÓN" con el mismo comportamiento simulado que hoy (`saved = true` local), porque el proyecto aún no tiene definido el modelo de tablas de puntuaciones en Supabase — se abordará en un spec futuro dedicado. Decisión explícita del usuario.
- **Reutilización de `cover-rocas`** como estilo visual de la nueva entrada, en vez de diseñar un cover nuevo, porque ya existe una clase temáticamente adecuada (fondo de asteroides) y el usuario prefirió no invertir en diseño nuevo para este spec.
- **Engine ubicado en `app/game-engines/asteroids/engine.ts`** (carpeta compartida de motores de juego, no dentro de la ruta de la página), pensando en que futuros juegos portados desde `references/started-games/` tendrán su propio motor en esa misma carpeta. Decisión explícita del usuario.
- **Sin soporte táctil/móvil** para esta versión, manteniendo únicamente los controles de teclado del juego original, aunque la página de detalle del juego siga anunciando "TECLADO / TÁCTIL" como etiqueta genérica del catálogo (no se corrige esa etiqueta en este spec).

## Riesgos identificados

- **Fugas de memoria por listeners de teclado no limpiados**: si `destroy()` no remueve correctamente los `keydown`/`keyup` listeners originales de `game.js`, reiniciar varias veces (o navegar entre `/game/asteroids/play` y otras rutas) podría acumular listeners duplicados y provocar comportamiento errático (nave respondiendo doble a una tecla). Mitigación: `destroy()` debe remover explícitamente todos los listeners que `createGame()` agregó.
- **Doble inicialización en desarrollo (React Strict Mode)**: en modo desarrollo, Next.js invoca los efectos dos veces intencionalmente; si el `useEffect` no maneja bien el cleanup, podrían quedar dos instancias del engine corriendo sobre el mismo canvas simultáneamente. Mitigación: verificar manualmente en `npm run dev` que solo hay un loop activo (usando el criterio de aceptación de "SALIR limpia el engine").
- **Tecla `Espacio` con comportamiento por defecto del navegador**: por defecto, `Espacio` puede hacer scroll de la página si el foco no está en el canvas. Mitigación: el engine debe llamar `preventDefault()` en los listeners de teclado relevantes, igual que probablemente ya hace `game.js` original (a verificar durante el puerto).
- **`dt` sin cap al recuperar foco de pestaña**: `game.js` original cappea `dt` a 50ms para evitar el "spiral of death" tras un `tab blur` prolongado; si se pierde ese detalle durante el puerto a TypeScript, pausar/reanudar el navegador de pestaña (no el botón de pausa) podría causar saltos bruscos o colisiones extrañas. Mitigación: preservar explícitamente ese cap al portar el loop.
- **Tamaño fijo de canvas (800×600) en un layout responsive**: el resto de la UI de Arcade Vault es fluida; un canvas de tamaño fijo podría desbordar o verse pequeño en pantallas angostas dentro del `crt-screen`. Mitigación: no forma parte del alcance de este spec ajustar el CSS del contenedor `crt`/`crt-screen` más allá de encajar el canvas existente; si se ve mal, queda para un spec de responsive/UI futuro.
- **Doble invocación de `onGameOver`**: si la lógica de colisión de la nave no queda debidamente encapsulada, es posible que múltiples colisiones en el mismo frame (o un `dt` grande tras recuperar foco) disparen `onLivesChange(0)` y `onGameOver(finalScore)` más de una vez, provocando que React intente mostrar el modal "FIN DEL JUEGO" repetidamente o con puntajes inconsistentes. Mitigación: el engine debe usar una bandera interna (`gameOverFired`) para garantizar que `onGameOver` se invoque como máximo una vez por partida, sin importar cuántas colisiones ocurran después de llegar a 0 vidas.

## Pendiente para spec futuro

- **Confirmado durante la verificación manual (Paso 8)**: el riesgo de "Tamaño fijo de canvas (800×600) en un layout responsive" (ver arriba) se materializó — en laptops/viewports angostos el `crt-screen` queda con espacio negro sobrante debajo del canvas, y el usuario reportó dificultad para jugar sin hacer zoom-out del navegador. Confirmado explícitamente fuera de alcance de este spec; queda anotado como punto de partida para un spec futuro de responsive/UI que ajuste el CSS del contenedor `crt`/`crt-screen` para encajar el canvas (p. ej. escalar con `max-width: 100%`/`aspect-ratio` manteniendo la resolución interna 800×600).
