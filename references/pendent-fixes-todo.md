# Bugs pendientes (fuera de alcance de specs en curso)

To-Do vivo de bugs detectados durante el desarrollo que no se corrigen en la spec donde se
encontraron, para no desviarse de su alcance. Cada entrada indica dónde se detectó y por qué se
dejó pendiente.

## 🐛 Abiertos

### Snake: fin de partida instantáneo tras un `requestAnimationFrame` con `delta` grande

- **Detectado en:** spec `10-controles-tactiles-moviles`, Paso 5 (verificación manual del HUD
  táctil), 22/07/2026.
- **Archivo:** `app/game-engines/snake/engine.ts`, función `loop()` (línea ~396).
- **Síntoma:** al cargar `/game/snake/play`, la partida a veces termina inmediatamente (modal
  "FIN DEL JUEGO" con puntuación 0) sin que la serpiente choque visiblemente contra nada.
  Reproducido tanto con el HUD táctil nuevo como con el código base sin modificar (`git stash`
  confirmó que el bug ya existe en el motor actual, no lo introdujo este spec).
- **Causa raíz probable:** el bucle principal acumula `dt = timestamp - lastTime` entre frames de
  `requestAnimationFrame` y ejecuta `tick()` en un `while (tickAccumulator >= tickIntervalMs)` sin
  ningún tope (`app/game-engines/snake/engine.ts:396-411`). Si el primer o algún frame llega con un
  `dt` grande (pestaña recién montada, tab en segundo plano, `rAF` retrasado por el navegador,
  dispositivo lento), el `while` ejecuta muchos `tick()` de golpe en un solo frame — la serpiente
  "salta" varias celdas de una vez y choca contra el muro o contra sí misma antes de que el
  jugador vea nada. El tablero es de solo 20x20 celdas (`GRID_SIZE = 20`), así que pocos ticks de
  más ya alcanzan un borde.
- **Por qué queda fuera de esta spec:** `10-controles-tactiles-moviles` prohíbe explícitamente
  tocar los `engine.ts` de los 4 juegos (el mecanismo de `KeyboardEvent` sintéticos existe
  justamente para no tener que hacerlo); corregir el bucle de `tick()` es un cambio de lógica de
  juego, no de controles táctiles ni de layout.
- **Relevancia para specs de controles táctiles/móviles:** este bug es más probable en móvil que
  en desktop — cambiar de app, bloquear pantalla o que el navegador limite `requestAnimationFrame`
  en segundo plano son escenarios mucho más comunes en un dispositivo táctil que jugando con
  teclado en un monitor.
- **Sugerencia de fix (no aplicada):** limitar el `dt` usado para acumular ticks a un máximo
  razonable (ej. `Math.min(dt, tickIntervalMs * 4)` o similar) antes de sumarlo a
  `tickAccumulator`, para que un frame retrasado nunca produzca más de un puñado de ticks de
  catch-up de golpe.
- **Estado:** abierto.

### Asteroids: fin de partida instantáneo ocasional al cargar la partida

- **Detectado en:** spec `10-controles-tactiles-moviles`, Paso 8 (verificación manual final),
  22/07/2026.
- **Archivo:** `app/game-engines/asteroids/engine.ts`.
- **Síntoma:** al cargar `/game/asteroids/play`, ocasionalmente la partida termina de inmediato
  (modal "FIN DEL JUEGO" con puntuación 0) sin interacción del jugador. Muy poco frecuente:
  reproducido 1 vez en ~8 cargas durante la verificación de este spec; 6 recargas consecutivas
  inmediatas después no lo reprodujeron.
- **No es el mismo bug que el de Snake** (ver entrada anterior): `loop()` en este motor **sí**
  limita el `dt` por frame (`Math.min((ts - lastTime) / 1000, 0.05)`,
  `app/game-engines/asteroids/engine.ts:657`), así que no puede haber un "salto" grande de física
  por un frame retrasado. La causa raíz aquí no se investigó a fondo — hipótesis sin confirmar:
  colisión de spawn (un asteroide inicial aparece encima o muy cerca de la nave antes de que el
  período de invencibilidad inicial (`invincible`) la proteja). No se profundizó más por el bajo
  alcance de este spec (prohíbe tocar `engine.ts`) y la baja frecuencia de reproducción.
- **Por qué queda fuera de esta spec:** mismo motivo que la entrada de Snake — no se permite tocar
  `engine.ts` en `10-controles-tactiles-moviles`.
- **Sugerencia de investigación (no aplicada):** revisar la posición/velocidad inicial de los
  asteroides generados en `initGame()` respecto a la posición de spawn de la nave, y la duración
  de `invincible`, para descartar o confirmar la hipótesis de colisión de spawn.
- **Estado:** abierto.

### Arkanoid: los primeros sonidos no suenan en móvil (bloqueados por la política de autoplay), lo que se percibe como desfase

- **Detectado en:** spec `10-controles-tactiles-moviles`, verificación manual con el HUD táctil,
  22/07/2026 (reportado por el usuario en una conversación posterior; documentado el 23/07/2026
  tras perder el detalle exacto por un `/clear` de sesión, y **validado y reproducido el
  23/07/2026** con Playwright emulando un dispositivo móvil real — ver evidencia abajo).
- **Archivo:** `app/game-engines/arkanoid/engine.ts`, función `update()` (líneas ~495, 500, 505,
  517 y 534, cada llamada a `(bounceSound.cloneNode() as HTMLAudioElement).play()` /
  `(breakSound.cloneNode() as HTMLAudioElement).play()`).
- **Síntoma reportado:** jugando en modo móvil (controles táctiles), el sonido de rebote y de
  rotura de bloque suena "desfasado" respecto al choque en pantalla.
- **Causa raíz confirmada (no solo hipótesis):** `GamePlayClient.tsx` arranca el motor
  automáticamente al montar (`useEffect` → `startEngine()`, sin ningún gate de "toca para
  empezar"), así que la pelota empieza a rebotar y a llamar `.play()` **antes de que el usuario
  haya interactuado con la página**. Los navegadores móviles bloquean el autoplay de audio sin
  gesto previo del usuario: esas primeras llamadas a `.play()` son rechazadas con
  `NotAllowedError` — **sin sonido y sin que se maneje el rechazo** (no hay `.catch()` en el
  código), lo que además genera un `unhandledrejection` en cada colisión previa al primer toque.
  En cuanto el usuario toca la pantalla (gesto real), el navegador desbloquea el audio y los
  sonidos posteriores sí suenan con normalidad. El resultado percibido es justo un "desfase": las
  primeras colisiones son mudas y el sonido "aparece" recién con el primer toque, dando la
  sensación de que el audio va retrasado respecto a la acción.
  - _Se descarta_ la hipótesis inicial de latencia de decodificación de audio en hardware móvil
    (`cloneNode()` por colisión): una vez desbloqueado el audio, el delay entre la llamada a
    `.play()` y el evento `playing` medido fue de ~23 ms, imperceptible.
  - **Evidencia:** contexto de Playwright con `isMobile: true`, `hasTouch: true`, viewport
    390×844, navegando a `/game/arkanoid/play` sin ningún toque durante 6 s. Se capturaron 4
    eventos `unhandledrejection`, todos `NotAllowedError: play() failed because the user didn't
interact with the document first`. En una segunda prueba con un toque simulado a los ~4 s: 2
    reproducciones rechazadas (`NotAllowedError`) antes del toque, y la reproducción posterior al
    toque exitosa con 23 ms de latencia. Capturas en
    `.playwright-screenshots/arkanoid-mobile-audio-test-phase1.png`,
    `arkanoid-mobile-audio-test-phase2.png` y `arkanoid-mobile-no-gesture-6s.png`.
- **Por qué queda fuera de esta spec:** `10-controles-tactiles-moviles` prohíbe explícitamente
  tocar los `engine.ts` de los 4 juegos; corregir el manejo de audio es un cambio de lógica de
  juego, no de controles táctiles ni de layout.
- **Sugerencia de fix (no aplicada):** manejar la Promise de `.play()` con `.catch()` para evitar
  el `unhandledrejection` (mínimo indispensable), y evaluar desbloquear el audio explícitamente en
  el primer gesto del usuario (p. ej. un `<audio>` "silencioso" reproducido en el primer
  `touchstart`/`pointerdown` de `TouchControls`, patrón estándar para políticas de autoplay
  móviles) para que el primer rebote/rotura sí suene.
- **Estado:** abierto (causa raíz confirmada).

### `GamePlayClient.tsx`: `setSkinState` dentro de un efecto dispara el lint `react-hooks/set-state-in-effect`

- **Detectado en:** spec `11-optimizacion-rendimiento-frogger`, Paso 4 (reducción de `useState` a
  `useRef` para `score`/`lives`/`level`), 25/07/2026.
- **Archivo:** `app/game/[id]/play/GamePlayClient.tsx`, efecto de montaje (líneas 117-120):
  ```ts
  useEffect(() => {
    const initialSkin = loadSkin(game.id);
    setSkinState(initialSkin);
    startEngine(initialSkin);
    ...
  }, []);
  ```
- **Síntoma:** `npx eslint "app/game/[id]/play/GamePlayClient.tsx"` reporta un error de la regla
  `react-hooks/set-state-in-effect` ("Calling setState synchronously within an effect can trigger
  cascading renders") sobre la llamada a `setSkinState(initialSkin)`.
- **Confirmado como preexistente, no introducido por este spec:** se verificó corriendo ESLint
  sobre la versión de este archivo en `HEAD` (antes de cualquier cambio de este spec) — el mismo
  error ya aparecía ahí. El spec `11` solo migró `score`/`lives`/`level` a `useRef`; no tocó este
  efecto de skin.
- **Por qué no se corrigió en este spec:** `11-optimizacion-rendimiento-frogger` está acotado a
  rendimiento del engine de Frogger y al patrón de estado de `score`/`lives`/`level`; este efecto
  de skin es un problema preexistente y no relacionado, y corregirlo habría sido alcance no
  comprometido en el plan.
- **Por qué no bloquea el build:** en esta versión de Next.js (16.2.10), `npm run build` (`next
build`) no ejecuta ESLint — solo compila TypeScript (verificado corriendo el build completo,
  que termina sin pasos de lint en su output). El error solo aparece al correr `eslint`
  explícitamente (`npm run lint` o el hook `PostToolUse` de formato).
- **Sugerencia de fix (no aplicada):** `loadSkin()` ya está preparada para SSR (devuelve `'classic'`
  si `typeof window === 'undefined'`), así que un inicializador perezoso —
  `useState<SkinName>(() => loadSkin(game.id))` — leería `localStorage` directamente durante el
  render de hidratación en cliente, sin necesitar `setState` dentro de un efecto. El efecto de
  montaje quedaría solo con `startEngine(skin)` (que no llama `setState`), eliminando el disparo
  de la regla sin cambiar el comportamiento observable.
- **Estado:** abierto.

### `.claude/agents/skin-designer.md`: la guía del agente describe `score`/`lives`/`level` como `useState`, pero ya migraron a `useRef`

- **Detectado en:** diseño del subagente `game-performance-booster`, al auditar el estado de
  `GamePlayClient.tsx` tras el spec `11-optimizacion-rendimiento-frogger`, 25/07/2026.
- **Archivo:** `.claude/agents/skin-designer.md`, Fase 1 (punto 3) y Fase 3 (punto 4).
- **Síntoma:** la guía del agente describe el HUD como si `score`/`lives`/`level` siguieran en
  `useState`. Desde el spec `11` esos tres valores viven en `useRef` (`scoreRef`/`livesRef`/
  `levelRef`) con actualización directa del DOM vía refs de nodo (`scoreElRef`/`livesElRef`/
  `levelElRef`), y los nodos del JSX declaran un valor inicial fijo a propósito. Un
  `skin-designer` que siga su guía al pie de la letra puede reintroducir `useState` para esos
  valores o devolver el valor cambiante al JSX, deshaciendo la optimización.
- **Divergencia menor adicional:** la guía describe el 3er parámetro de `createGame` como
  `options?: { skin?: SkinName }` inline, pero `registry.ts` ya lo tiene extraído como la interfaz
  `EngineOptions`.
- **Ojo al corregir:** la sugerencia de fix de la entrada anterior de este to-do
  (`setSkinState` dentro de un efecto) propone un inicializador perezoso
  `useState<SkinName>(() => loadSkin(game.id))`, que es exactamente el patrón que `skin-designer.md`
  prohíbe en sus Reglas duras por el mismatch de hidratación SSR/cliente. Las dos entradas hay que
  resolverlas juntas, no por separado.
- **Por qué queda fuera de esta tarea:** el encargo era crear el subagente `game-performance-booster`;
  reescribir la guía de otro agente es alcance distinto.
- **Sugerencia de fix (no aplicada):** actualizar en `skin-designer.md` la descripción del HUD para
  reflejar el patrón de refs vigente, y sustituir la firma inline de `options` por `EngineOptions`.
- **Estado:** abierto.

## ✅ Resueltos

### Frogger: framerate por debajo del resto del catálogo, más marcado en las skins con glow

- **Detectado en:** spec `game-jam/frogger/02-frogger-niveles`, Fase D (validación con Playwright),
  25/07/2026.
- **Resuelto en:** spec `11-optimizacion-rendimiento-frogger`, 25/07/2026.
- **Archivo:** `app/game-engines/frogger/engine.ts` y `app/game/[id]/play/GamePlayClient.tsx`.
- **Síntoma original:** medido con `requestAnimationFrame` durante 3 s en `/game/frogger/play`
  (Playwright, mismo entorno para las tres mediciones): ~45 fps en skin Clásico y ~31 fps en
  Neon/Retro, frente a 60 fps estables de `/game/snake/play` medidos en la misma sesión de
  navegador. El framerate era estable (no fluctuaba ni se degradaba progresivamente), solo más
  bajo que el resto del catálogo.
- **Causa raíz confirmada** (spec 11, paso 1, con Chrome DevTools Profiler): `drawWaterAndLogs`
  (el ripple del agua, ~70 puntos × 3 líneas × 5 carriles con `lineTo`/`stroke` recalculando
  `Math.sin` cada frame) y `drawTurtleGroup` (~20 llamadas a primitivas de canvas por segmento de
  tortuga) eran los mayores hotspots de JS, **independientes del glow** — confirmado porque
  `classic` (sin `shadowBlur`) ya perdía ~15% de fps respecto al control. El `ctx.shadowBlur` en
  vivo (tortugas, troncos, sapo, ocupante de meta) era un agravante adicional, no la causa
  principal.
- **Fix aplicado:**
  - Paso 2: el ripple se precalcula una sola vez en un tile offscreen (es una onda viajera, solo
    se traslada, nunca cambia de forma) y se traslada por `drawImage()` en vez de recalcular
    `Math.sin` por punto cada frame; las tortugas pasaron a 2 sprites offscreen (caparazón +
    detalle) en vez de ~20 llamadas de canvas por segmento.
  - Paso 3: el `shadowBlur` de tortugas, troncos, sapo y ocupante de meta se hornea una sola vez
    en sprites offscreen (reconstruidos en cada cambio de skin) en vez de aplicarse en vivo cada
    frame.
  - Paso 4: `score`/`lives`/`level` en `GamePlayClient.tsx` migrados de `useState` a `useRef` con
    actualización directa del DOM, como mejora preventiva del HUD compartido por los 5 juegos.
- **Resultado medido** (CPU Profiler de Chrome, nivel avanzado, antes/después): `drawWaterAndLogs`
  pasó de ~30-41 ms a <1 ms de self-time por muestra de 3 s; `drawTurtleGroup` de ~24-29 ms a
  3-12 ms. La brecha entre skins con/sin glow (15-31% antes) desapareció (1-2 fps de diferencia,
  dentro del ruido de medición). En build de producción, desktop sin throttling, Frogger pasó de
  rendir ~87% de la velocidad del control de Snake a 92-96% en los 3 skins.
- **Caveat de medición:** el número absoluto de ~60 FPS no se pudo confirmar con Playwright/Chromium
  headless — ni el propio control de Snake (sin cambios) lo sostiene en ese entorno compartido. La
  resolución se validó por evidencia relativa (colapso del self-time de JS, desaparición de la
  brecha entre skins, acercamiento al control), decisión aceptada explícitamente por el usuario el
  25/07/2026. Detalle completo en la "Nota de validación de los criterios de FPS" de
  `specs/11-optimizacion-rendimiento-frogger.md`.
- **Estado:** resuelto.
