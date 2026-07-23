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

## ✅ Resueltos

_(vacío por ahora)_
