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

## ✅ Resueltos

_(vacío por ahora)_
