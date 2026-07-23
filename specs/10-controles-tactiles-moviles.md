# 10 — Controles táctiles y adaptación móvil

**Estado:** Implementado
**Depende de:** 05-asteroids-motor-real, 07-tetris-motor-leaderboard, 08-arkanoid-motor-leaderboard, 09-snake-motor-leaderboard (registro `GAME_ENGINES` y los 4 motores ya existentes, que no se modifican por dentro)
**Fecha:** 2026-07-22 (realineado con la implementación real el 2026-07-23, tras varios ajustes posteriores a la primera redacción — ver nota al final del documento)
**Objetivo:** Hacer que los 4 juegos jugables (Asteroids, Tetris, Arkanoid, Snake) funcionen y se vean correctamente en dispositivos móviles táctiles, agregando un panel de controles táctiles genérico (joystick arrastrable + botones de acción + pausa/fin/regresar) declarado por juego en `app/game-engines/registry.ts` —sin modificar el código interno de ningún `engine.ts`—, junto con el escalado responsive del canvas (por ancho **y por alto**, en cualquier dispositivo, resuelto con una cadena de `flexbox` que reparte el espacio vertical disponible) y la ocultación del Nav global durante la partida en viewports táctiles.

## Alcance

**Dentro del alcance:**

- **Escalado responsive del canvas por ancho**: CSS en `.crt-screen`/`canvas` (`max-width: 100%; height: auto` o equivalente) para que los 4 tamaños existentes (800×600 Asteroids/Arkanoid, 480×600 Tetris, 600×600 Snake) se ajusten al ancho disponible sin overflow ni scroll horizontal, en **cualquier viewport angosto** (táctil o no) — mejora general independiente del panel táctil. Arkanoid ya convierte coordenadas de mouse con `scaleX`/`rect.width`, así que el reescalado por CSS no requiere tocar su `engine.ts`.
- **Escalado responsive del canvas por alto, en cualquier dispositivo**, resuelto mediante una **cadena de `flexbox`** (no mediante offsets fijos calculados sobre `100vh`): `#root` es un contenedor flex en columna con `min-height: 100%`; dentro de la página de juego, `.av-player` es también flex en columna con `min-height: 0` (habilitado por `.av-main:has(.av-player) { min-height: 0 }`, que libera a `.av-main` de su piso automático solo cuando contiene la pantalla de juego); `.player-hud`, `.crt-bottom` y el panel táctil se marcan `flex-shrink: 0` (tamaño fijo, nunca se encogen); `.crt` y `.crt-screen` son `flex: 1; min-height: 0`, de modo que absorben **todo** el espacio vertical restante; y el `canvas` dentro de `.crt-screen` usa `max-width: 100%; max-height: 100%; width: auto; height: auto`, llenando ese espacio sobrante sin deformarse (conserva su relación de aspecto real). El resultado es el mismo objetivo que perseguía el enfoque inicial por offsets (el juego completo cabe sin scroll vertical en viewports de poca altura, ej. laptops con ventana de navegador de ~625–768px de alto útil), pero sin constantes de píxeles que mantener sincronizadas con el alto real del HUD/Nav/panel — el navegador reparte el espacio automáticamente según cuánto midan los elementos `flex-shrink: 0` en cada momento.
- **`.crt-screen` centra el `canvas` dentro del espacio flex que le corresponde** (`display: flex; align-items: center; justify-content: center`), en vez de encoger su propio ancho al del `canvas` — el marco `.crt-screen` ocupa el ancho disponible de `.crt` (`width: 100%; max-width: 100%; margin: 0 auto`) y dentro de él el `canvas` real, ya limitado por `max-width`/`max-height` en ambos ejes, queda centrado y con un fondo (`#000`) del mismo color que el propio `canvas`, por lo que el límite jugable sigue siendo distinguible en la práctica sin necesitar que la caja externa se ajuste en ancho.
- **Presupuesto de espacio vertical recuperado para agrandar la zona de juego**: se redujeron paddings/márgenes no esenciales de la página de juego —`.av-player` (margen 32px→20px, padding inferior 64px→24px), `.player-hud` (padding 14px→8px, margen inferior 18px→8px), `.crt` (padding 24px→16px), `.crt-bottom` (margen superior 14px→8px), y el `footer` global del layout (padding vertical 20px→10px, afecta a todas las páginas de forma menor)— para que el `canvas` reciba más de la altura disponible en vez de que se la coman espacios decorativos.
- **Detección de dispositivo táctil** vía `matchMedia('(pointer: coarse)')`, centralizada en un solo lugar reutilizable (`useSyncExternalStore`, ver Modelo de datos) y consumida tanto por `GamePlayClient.tsx` como por `components/Nav.tsx`.
- **Panel de controles táctiles genérico**, nuevo componente en `app/game/[id]/play/`, visible únicamente cuando `pointer: coarse` es verdadero, ubicado debajo del `crt` (pantalla del juego arriba, panel abajo). Incluye:
  - **Joystick direccional circular arrastrable**, estilo cromado (CSS/SVG inline, imitando la referencia visual compartida): la perilla central sigue visualmente al dedo dentro de una base fija (con un recorrido máximo, `clampeado` al radio disponible), mientras que la dirección efectiva enviada al juego se calcula por vector (`dx`/`dy` desde el centro) con una **zona muerta** (una fracción del radio) para evitar disparos por micro-temblores al posar el dedo. Con soporte declarado de `4` u `8` direcciones (los 4 juegos actuales usan `4`; `8` queda disponible para un juego futuro). La entrada se procesa por vector, pero la **salida siempre es discreta** (una tecla mantenida, no una magnitud variable) — no hay velocidad analógica real en ningún juego.
  - **Hasta 2 botones de acción** redondos (CSS/SVG, mismo estilo cromado), con ícono/etiqueta configurables por juego. Si un juego no mapea un slot (`buttonA`/`buttonB`) en su `touchControls`, ese botón **no se renderiza** (el joystick queda solo, centrado en el panel) — no se muestra deshabilitado.
  - **Botones utilitarios PAUSA, FIN y REGRESAR**, conectados a los mismos handlers ya existentes en `GamePlayClient.tsx` (`togglePause`, `endGame`, `router.push('/game/${game.id}')` — mismo destino que "SALIR" hoy).
  - Cada pulsación de joystick/botón de acción despacha `KeyboardEvent` sintéticos (`keydown`/`keyup`) sobre `window` con el `code` declarado por el juego — **ningún `engine.ts` se modifica**.
- **Esquema declarativo de controles táctiles en `app/game-engines/registry.ts`**: cada `EngineEntry` declara opcionalmente su mapeo (direcciones del joystick → `code`, hasta 2 botones de acción → `code` + ícono/etiqueta, y el modo `4`/`8` direcciones). Mapeo concreto para los 4 juegos actuales:
  - **Asteroids**: joystick izquierda/derecha → `ArrowLeft`/`ArrowRight` (rotar), joystick arriba → `ArrowUp` (empuje); botón A → `Space` (disparar); sin botón B (no se renderiza).
  - **Tetris**: joystick izquierda/derecha → `ArrowLeft`/`ArrowRight` (mover), joystick abajo → `ArrowDown` (caída suave); botón A → `ArrowUp` (rotar); botón B → `Space` (caída instantánea).
  - **Arkanoid**: joystick izquierda/derecha → `ArrowLeft`/`ArrowRight` (paleta); joystick arriba/abajo sin función; sin botones A ni B (no se renderizan, el joystick queda solo).
  - **Snake**: joystick en las 4 direcciones → `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`; sin botones A ni B (no se renderizan, el joystick queda solo).
- **HUD superior (`player-hud`) adaptado en táctil**: cuando `pointer: coarse` es verdadero, se ocultan los botones PAUSA/FIN/SALIR (reemplazados por el panel inferior) y el resto se compacta en una sola fila delgada (`flex-wrap: nowrap`) con etiquetas abreviadas (**JUG/PTS/VIDA/NV**), vidas en formato compacto (`♥ ×N` en vez de repetir el corazón) y el selector de skin reducido, para liberar el espacio vertical que ocupa el nuevo panel de controles inferior. En viewports angostos (`max-width: 480px`) el nombre del jugador/invitado se oculta primero, por ser el dato menos relevante del HUD. **En viewports táctiles de altura muy reducida** (`max-height: 500px`, el caso típico de un teléfono en landscape), el `player-hud` compacto se oculta por completo — las stats dejan de ser visibles durante la partida en ese caso extremo, recuperables al pausar o en el modal de fin de partida.
- **El panel `TouchControls` se compacta en 3 escalones adicionales según la altura del viewport táctil** (`max-height: 700px` / `560px` / `460px`, independientes del breakpoint de 500px que oculta el HUD): reduce progresivamente el tamaño del joystick y los botones de acción, oculta las etiquetas de texto de los botones de acción (dejando solo el ícono) en el escalón más bajo, y apila los botones utilitarios en columna en el escalón más extremo — así el panel táctil completo también cabe en pantallas de teléfono muy bajas sin depender únicamente del escalado del `canvas`.
- **Nav global oculto en táctil durante la partida**: `components/Nav.tsx` no se renderiza específicamente en la ruta `/game/[id]/play` cuando `pointer: coarse` es verdadero; en desktop, y en cualquier otra ruta, el Nav se comporta exactamente igual que hoy.
- **Panel táctil visible únicamente cuando `pointer: coarse` es verdadero** (no en desktop con mouse).
- **Diseño del joystick/botones con CSS + SVG inline** imitando el estilo cromado/metálico de la referencia visual compartida.
- **Modo de direcciones declarable (`4 | 8`)** en el esquema del registro, aunque los 4 juegos actuales usan `4`.
- **Botones/controles con hitbox táctil adecuada** (tamaño mínimo razonable para dedo, ej. ~44px en los utilitarios) en el panel nuevo.
- **Campos de texto con `font-size: 16px` en todo el sitio** (regla global en `app/globals.css`, no específica de `/game/[id]/play`), para evitar el zoom automático que iOS Safari/Chrome Android disparan al enfocar un `<input>`/`<textarea>`/`<select>` con fuente menor a 16px. Sin esto, en el input de iniciales del modal "FIN DEL JUEGO" el zoom no se revertía al pulsar "GUARDAR PUNTUACIÓN" (el campo se desmonta al pasar a `saved`, y el navegador no tiene a qué volver), dejando la pantalla ampliada hasta que el usuario la corregía manualmente con los dedos.

**Fuera de alcance (para otros specs):**

- Gestos de swipe o arrastre directo sobre el canvas — se descartó a favor del joystick+botones uniforme para los 4 juegos (el arrastre existe dentro del propio joystick del panel, no sobre el `canvas`).
- Joystick analógico real (velocidad/magnitud variable en el juego según distancia/ángulo de arrastre) — aunque la perilla sigue visualmente al dedo y la dirección se calcula por vector con zona muerta, la salida hacia el juego sigue siendo una tecla discreta mantenida, equivalente a pulsar una tecla de teclado; ningún juego recibe una magnitud continua.
- Implementar o probar el modo de 8 direcciones con un juego real — el esquema lo declara, pero ningún juego actual lo usa.
- Cambios dentro de `app/game-engines/{asteroids,tetris,arkanoid,snake}/engine.ts` — el mecanismo de eventos sintéticos evita tocarlos.
- Rediseño visual del HUD superior en desktop — sigue exactamente igual que hoy.
- Vibración háptica (`navigator.vibrate`) al presionar controles.
- Bloqueo/forzado de orientación (landscape lock) u orientation API — el escalado responsive debe funcionar tal como venga el dispositivo (portrait o landscape), sin forzar nada.
- PWA, instalación como app, o Fullscreen API.
- Adaptación responsive de otras rutas (`/`, `/games`, `/about`, `/hall-of-fame`, `/auth`) más allá de lo ya existente — este spec es específico de `/game/[id]/play`.
- Políticas RLS en `games`/`scores`, Supabase Auth real — mismos pendientes ya documentados en specs 05/06/07/08/09, sin relación con este spec.

## Modelo de datos

- **`app/lib/use-touch-device.ts`** — hook nuevo, sin dependencias externas, implementado sobre `useSyncExternalStore`:

  ```ts
  export function useTouchDevice(): boolean;
  ```

  Internamente usa `window.matchMedia('(pointer: coarse)')` como fuente externa: `getSnapshot()` lee `.matches` en cada render, `subscribe()` se suscribe al evento `change` del `MediaQueryList`, y `getServerSnapshot()` devuelve `false` como valor seguro para SSR (hidrata en el primer render de cliente). Es la única fuente de verdad de "¿este dispositivo es táctil?", consumida por `GamePlayClient.tsx` (para mostrar el panel y adaptar el HUD superior) y por `components/Nav.tsx` (para ocultarse en `/game/[id]/play`).

- **`app/game-engines/registry.ts`** — nuevos tipos y campo opcional en `EngineEntry`, sin romper la forma ya existente (`skins` sigue igual):

  ```ts
  export interface JoystickMapping {
    up?: string; // KeyboardEvent.code
    down?: string;
    left?: string;
    right?: string;
  }

  export interface ActionButtonMapping {
    code: string; // KeyboardEvent.code a despachar
    label: string; // ej. "DISPARAR", "ROTAR"
    icon: 'rotate' | 'shoot' | 'thrust' | 'drop';
  }

  export interface TouchControlsSchema {
    directions: 4 | 8; // los 4 juegos actuales usan 4
    joystick: JoystickMapping;
    buttonA?: ActionButtonMapping; // si falta, el botón no se renderiza
    buttonB?: ActionButtonMapping; // si falta, el botón no se renderiza
  }
  ```

  `EngineEntry` agrega `touchControls?: TouchControlsSchema`. Mapeo concreto para las 4 entradas ya existentes en `GAME_ENGINES`:

  ```ts
  asteroids: {
    /* ...igual que hoy... */
    touchControls: {
      directions: 4,
      joystick: { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp' },
      buttonA: { code: 'Space', label: 'DISPARAR', icon: 'shoot' },
    },
  },
  tetris: {
    /* ...igual que hoy... */
    touchControls: {
      directions: 4,
      joystick: { left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown' },
      buttonA: { code: 'ArrowUp', label: 'ROTAR', icon: 'rotate' },
      buttonB: { code: 'Space', label: 'CAÍDA', icon: 'drop' },
    },
  },
  arkanoid: {
    /* ...igual que hoy... */
    touchControls: {
      directions: 4,
      joystick: { left: 'ArrowLeft', right: 'ArrowRight' },
      // sin buttonA/buttonB: el panel renderiza solo el joystick, centrado
    },
  },
  snake: {
    /* ...igual que hoy... */
    touchControls: {
      directions: 4,
      joystick: {
        up: 'ArrowUp',
        down: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight',
      },
      // sin buttonA/buttonB: el panel renderiza solo el joystick, centrado
    },
  },
  ```

- **`app/game/[id]/play/TouchControls.tsx`** — componente nuevo, sin estado de módulo:

  ```ts
  interface TouchControlsProps {
    schema: TouchControlsSchema;
    paused: boolean;
    onTogglePause: () => void;
    onFinish: () => void;
    onExit: () => void;
  }

  export default function TouchControls(props: TouchControlsProps): JSX.Element;
  ```

  El **joystick** (`.touch-joystick-base` con la perilla `.touch-joystick-knob`) captura el puntero en `pointerdown` (`setPointerCapture`), calcula el centro de la base con `getBoundingClientRect()`, y en cada `pointermove` desplaza visualmente la perilla hacia el vector `(dx, dy)` desde el centro, recortado (`clamp`) al radio disponible menos el radio de la perilla. En paralelo, `directionsFromVector()` traduce ese mismo vector a una o más direcciones discretas (una sola en modo `4`, hasta dos combinadas en modo `8`) aplicando una **zona muerta** (`DEAD_ZONE_RATIO`, una fracción del radio) para no disparar direcciones con el dedo casi quieto; cada dirección activa/inactiva se traduce a `dispatchKey('keydown' | 'keyup', code)` sobre `window`, comparando el set de direcciones anterior contra el nuevo para no repetir eventos. Al soltar (`pointerup`/`pointerleave`/`pointercancel`) se liberan todas las direcciones activas y la perilla vuelve al centro.

  Los **botones de acción** (`buttonA`/`buttonB`) se filtran de la lista a renderizar según si el juego los mapea en su `schema` (`ACTION_SLOTS.filter(slot => schema[slot])`) — un juego sin mapeo simplemente no muestra ese botón, no lo deshabilita; si ningún botón está mapeado, el joystick se centra solo en el panel (clase `touch-controls-main-solo`). Cada botón presente, en `pointerdown`/`pointerup`/`pointerleave`/`pointercancel`, despacha el mismo ciclo `keydown`/`keyup` con el `code` de su mapeo. Los botones utilitarios PAUSA/FIN/REGRESAR invocan directamente `onTogglePause`/`onFinish`/`onExit` (props recibidas de `GamePlayClient.tsx`, mismas funciones que ya usan los botones del HUD superior en desktop).

- **`app/game/[id]/play/GamePlayClient.tsx`** — sin nuevas estructuras de datos propias; agrega el uso de `useTouchDevice()` para: (a) ocultar condicionalmente los botones PAUSA/FIN/SALIR del `player-hud`, aplicando además una clase modificadora (`player-hud-touch`) que compacta las stats + selector de skin restantes en una sola fila (`flex-wrap: nowrap`) con etiquetas abreviadas (**JUG/PTS/VIDA/NV**) y vidas en formato compacto (`♥ ×N`), y (b) renderizar `<TouchControls schema={entry.touchControls} .../>` debajo del `crt` cuando el schema existe y el dispositivo es táctil. El ocultamiento completo del `player-hud` en viewports muy bajos de altura (`max-height: 500px`), el ocultamiento del nombre del jugador en viewports angostos (`max-width: 480px`), y los 3 escalones de compactación del panel táctil según altura, se resuelven solo con CSS (`app/globals.css`), sin lógica adicional en este componente.

- **`components/Nav.tsx`**: sin nuevas estructuras; agrega `useTouchDevice()` + verificación de `pathname` contra el patrón `/game/[id]/play` (regex `/^\/game\/[^/]+\/play$/`) para retornar `null` cuando ambas condiciones se cumplen. En cualquier otra ruta, o en desktop, el comportamiento no cambia.

- **`app/globals.css`**: sin estructuras de datos; el escalado por alto se resuelve con una **cadena de `flexbox`**, no con offsets fijos calculados sobre `100vh`:
  - `#root { display: flex; flex-direction: column; min-height: 100% }` (ya existente para el layout general del sitio).
  - `.av-main:has(.av-player) { min-height: 0 }` — solo cuando `.av-main` contiene la pantalla de juego se le quita el piso automático basado en contenido; el resto de páginas conserva su altura natural.
  - `.av-player { height: calc(100% - 20px); margin: 20px auto 0; padding: 0 24px 24px; display: flex; flex-direction: column; min-height: 0 }`.
  - `.player-hud { flex-shrink: 0; padding: 8px 16px; margin-bottom: 8px }` y `.crt-bottom { flex-shrink: 0; margin-top: 8px }` — ambos con tamaño fijo, nunca se encogen.
  - `.crt { flex: 1; min-height: 0; padding: 16px; display: flex; flex-direction: column }` y `.crt-screen { flex: 1; min-height: 0; width: 100%; max-width: 100%; margin: 0 auto; aspect-ratio: auto; display: flex; align-items: center; justify-content: center }` — ambos absorben el espacio vertical sobrante.
  - `.crt-screen canvas { max-width: 100%; max-height: 100%; width: auto; height: auto; min-width: 0 }` — el `canvas` llena ese espacio conservando su relación de aspecto real, sin deformarse; en desktop con espacio amplio, conserva su tamaño nativo porque nunca hay más restricción que el propio `max-width`/`max-height: 100%` del contenedor flex.
  - Cuando el panel `TouchControls` está presente, también se marca `flex-shrink: 0`, por lo que resta más espacio disponible para `.crt`/`.crt-screen` de forma automática — no hace falta una constante de offset distinta para desktop vs. táctil, el propio flujo del navegador la calcula.
  - Ajustes de padding en viewports angostos (`@media (max-width: 720px)`): `.av-player` (`padding: 0 16px 32px`), `.crt` (`padding: 12px`), `.crt-bottom` (`padding: 0 4px`).
  - Clases del panel táctil (`.touch-controls`, `.touch-joystick-base`, `.touch-joystick-knob`, `.touch-action-btn`, `.touch-utility-btn`) con el estilo cromado/metálico vía CSS (gradientes, `box-shadow` inset/outset) — sin usar archivos de imagen.
  - `.player-hud-touch` (fila única compacta con `flex-wrap: nowrap`, stats abreviadas y selector de skin reducido) y `@media (pointer: coarse) and (max-height: 500px) { .player-hud { display: none } }`, que oculta el HUD por completo en viewports táctiles de altura muy reducida.
  - `@media (max-width: 480px) { .player-hud-touch .hud-stat.name { display: none } }` — oculta primero el nombre del jugador/invitado en viewports angostos, por ser el dato menos relevante del HUD compacto.
  - Tres escalones adicionales de compactación del panel táctil, todos bajo `@media (pointer: coarse)`, independientes del corte de 500px del HUD:
    - `max-height: 700px`: joystick 110px, perilla 34px, botones de acción 50px, utilitarios 38px.
    - `max-height: 560px`: joystick 84px, perilla 26px, botones de acción 40px (ocultando el texto de su etiqueta, solo ícono), utilitarios 34px.
    - `max-height: 460px`: `.touch-utility` pasa a `flex-direction: column`.
  - **Regla global** `input, textarea, select { font-size: 16px }` (no específica de esta ruta) — evita el zoom automático que iOS Safari/Chrome Android disparan al enfocar un campo con fuente menor a 16px. Sin esto, el input de iniciales del modal "FIN DEL JUEGO" (que hereda el tamaño del `body`, 14px) disparaba el zoom, y como el campo se desmonta al pasar al estado `saved` (justo al pulsar "GUARDAR PUNTUACIÓN"), el navegador no revertía el zoom por sí solo. Selectores más específicos por clase (`.hud-skins`, `.av-search input`, `.field input`, `.modal .input-row input`, etc.) siguen ganando la cascada y conservan su tamaño de fuente actual — la regla no los agranda.

- **`app/layout.tsx`**: sin estructuras de datos; el `footer` global (usado en todas las páginas, no solo `/game/[id]/play`) tiene `padding` vertical inline de `10px` (reducido desde `20px`), como parte de recuperar presupuesto de altura para el `canvas` en la página de juego — cambio cosmético menor que también se aplica, sin problema, al resto del sitio.

## Plan de implementación

1. **Crear el hook `useTouchDevice()`** en `app/lib/use-touch-device.ts`, sobre `useSyncExternalStore` + `matchMedia('(pointer: coarse)')`, con `false` como valor inicial seguro para SSR. El sistema queda funcional: el hook compila y es importable, aunque nada lo consuma todavía.

2. **Escalado responsive del canvas por ancho** — agregar en `app/globals.css` la regla `max-width: 100%; height: auto;` para el `canvas` dentro de `.crt-screen`, más ajustes de padding de `.crt`/`.crt-bottom` en viewports angostos. El sistema queda funcional: los 4 juegos (800×600, 480×600, 600×600) dejan de desbordar en pantallas angostas, verificable de inmediato en DevTools, sin ningún cambio de comportamiento en desktop.

3. **Extender `app/game-engines/registry.ts`** con los tipos `JoystickMapping`, `ActionButtonMapping`, `TouchControlsSchema`, el campo opcional `touchControls` en `EngineEntry`, y el mapeo concreto de los 4 juegos (Asteroids, Tetris, Arkanoid, Snake) definido en el Modelo de datos. El sistema queda funcional: compila, el registro expone el nuevo campo, aunque nada lo consuma todavía.

4. **Crear `app/game/[id]/play/TouchControls.tsx`** — joystick direccional arrastrable con zona muerta + hasta 2 botones de acción (renderizados solo si el juego mapea ese slot) + botones utilitarios PAUSA/FIN/REGRESAR, estilo cromado vía CSS/SVG inline, despachando `KeyboardEvent` sintéticos (`keydown`/`keyup`) según la dirección/botón activo. El sistema queda funcional: el componente compila y es renderizable de forma aislada, aunque `GamePlayClient.tsx` todavía no lo use.

5. **Conectar `TouchControls` en `app/game/[id]/play/GamePlayClient.tsx`** — usar `useTouchDevice()` para (a) ocultar los botones PAUSA/FIN/SALIR del `player-hud` en táctil y aplicar la clase `player-hud-touch` que compacta stats + selector de skin en una sola fila delgada con etiquetas abreviadas, y (b) renderizar `TouchControls` debajo del `crt` cuando el dispositivo es táctil y `entry.touchControls` existe, pasando `togglePause`/`endGame`/`router.push('/game/${game.id}')` como props. Agregar en `app/globals.css` la regla `@media (pointer: coarse) and (max-height: 500px) { .player-hud { display: none } }` para ocultar el HUD por completo en viewports táctiles muy bajos de altura. El sistema queda funcional de punta a punta: en un dispositivo o emulador táctil, los 4 juegos son jugables completos con el panel táctil y un HUD que no compite por el espacio vertical, sin haber tocado ningún `engine.ts`.

6. **Escalado responsive del canvas por alto, en cualquier dispositivo, vía cadena de `flexbox`** (paso agregado durante la implementación, revisado varias veces tras feedback del usuario) — en `app/globals.css`:
   - Convertir `#root`/`.av-main`/`.av-player`/`.crt`/`.crt-screen` en una cadena flex (`display: flex; flex-direction: column` en los contenedores, `flex: 1; min-height: 0` en los que deben crecer, `flex-shrink: 0` en `.player-hud`/`.crt-bottom`/el panel táctil, que deben conservar su tamaño natural), agregando `.av-main:has(.av-player) { min-height: 0 }` para que solo la página de juego pierda su piso de altura automático.
   - Cambiar `.crt-screen` de `aspect-ratio: 4 / 3` fijo a `aspect-ratio: auto`, y hacerlo `display: flex; align-items: center; justify-content: center` para centrar el `canvas` dentro del espacio que le corresponda.
   - Extender la regla del `canvas` dentro de `.crt-screen` a `max-width: 100%; max-height: 100%; width: auto; height: auto`, sin depender de ninguna constante de píxeles ni de `100vh` — el espacio disponible lo determina el propio flujo flex, que ya resta lo que ocupan Nav/HUD/panel/footer.
   - Reducir paddings/márgenes no esenciales para recuperar presupuesto de altura: `.av-player` (margen 32px→20px, padding inferior 64px→24px), `.player-hud` (padding 14px→8px, margen inferior 18px→8px), `.crt` (padding 24px→16px), `.crt-bottom` (margen superior 14px→8px).
   - En `app/layout.tsx`: reducir el padding vertical del `footer` global de `20px` a `10px` (afecta a todas las páginas, cambio cosmético menor).

   El sistema queda funcional: en cualquier viewport de poca altura (táctil o no, ej. una laptop con ~625px de alto útil de ventana), el juego completo deja de requerir scroll vertical porque el `canvas` es el único elemento que se encoge (todo lo demás tiene tamaño fijo vía `flex-shrink: 0`); en desktop con espacio suficiente, el `canvas` conserva su tamaño nativo porque el espacio flex sobrante excede sus dimensiones reales.

7. **Ocultar el Nav en táctil durante la partida** — en `components/Nav.tsx`, usar `useTouchDevice()` + verificación de `pathname` (`/^\/game\/[^/]+\/play$/`) para retornar `null` cuando ambas condiciones se cumplen. El sistema queda funcional: en táctil, `/game/[id]/play` deja de mostrar el Nav; cualquier otra ruta y el comportamiento en desktop quedan exactamente igual que hoy.

8. **Refinamiento del panel táctil y del joystick tras pruebas en dispositivo real** (revisión posterior a la primera entrega completa del spec): se sustituyó el joystick de zonas fijas por una **perilla arrastrable** con zona muerta calculada por vector (más natural al tacto), se agregaron 3 escalones de compactación del panel (`max-height: 700/560/460px`) para que quepa en pantallas de teléfono bajas, se ocultó el nombre del jugador en viewports angostos (`max-width: 480px`), y los botones de acción sin mapeo (Arkanoid, Snake) pasaron de renderizarse deshabilitados a **no renderizarse en absoluto** (joystick centrado solo), tras confirmar que el estilo "deshabilitado" no aportaba valor frente a simplemente no mostrar un control sin función.

9. **Verificación manual y build** — emular un dispositivo táctil (Chrome DevTools device toolbar o Playwright con `hasTouch: true`) y jugar una partida completa de cada uno de los 4 juegos: canvas escalado sin overflow ni scroll horizontal ni vertical, joystick + botones de acción producen el mismo efecto que sus equivalentes de teclado/mouse, PAUSA/FIN/REGRESAR funcionan igual que en desktop, HUD superior reducido a stats + skin, Nav oculto. Confirmar en desktop (sin emulación táctil) que el teclado/mouse, el Nav y el HUD (PAUSA/FIN/SALIR) siguen intactos, y probar explícitamente una ventana de laptop de poca altura (ej. 1366×768) para confirmar que el juego completo es visible sin scroll. Ejecutar `npm run build` sin errores de TypeScript ni de ESLint.

## Criterios de aceptación

- [x] `app/lib/use-touch-device.ts` exporta `useTouchDevice()`, basado en `useSyncExternalStore` + `matchMedia('(pointer: coarse)')`, con `false` por defecto en el primer render de servidor/cliente.
- [x] En cualquier viewport angosto (táctil o no), el `canvas` de los 4 juegos se escala dentro de `.crt-screen` sin desbordar horizontalmente ni generar scroll horizontal en la página.
- [x] En cualquier viewport de poca altura (táctil o no, ej. una laptop con ~625–768px de alto útil de ventana), el `canvas` de los 4 juegos se escala dentro de `.crt-screen` sin desbordar verticalmente — el juego completo (HUD + `crt` + `crt-bottom` + panel táctil si aplica + footer) es visible sin necesitar scroll vertical dentro de la partida, gracias a que solo el `canvas` se encoge dentro de la cadena `flexbox` mientras el resto de elementos mantiene tamaño fijo.
- [x] En cualquier tamaño de viewport, el `canvas` queda centrado dentro de `.crt-screen`, cuyo fondo es del mismo color de fondo del `canvas`, por lo que el límite jugable no se percibe como recortado o desalineado.
- [x] En desktop con ancho y alto suficientes, el `canvas` de los 4 juegos conserva su tamaño nativo (800×600 / 480×600 / 600×600); el marco `.crt-screen` ya no fuerza un `aspect-ratio: 4/3` fijo (cambio intencional: el marco ahora siempre se ajusta al espacio flex disponible, en vez de reservar espacio vacío alrededor de los canvas que no son 4:3).
- [x] `app/game-engines/registry.ts` expone `TouchControlsSchema`/`JoystickMapping`/`ActionButtonMapping` y cada entrada de `GAME_ENGINES` (`asteroids`, `tetris`, `arkanoid`, `snake`) incluye su `touchControls` con el mapeo definido en el Modelo de datos.
- [x] Ninguno de los archivos `app/game-engines/{asteroids,tetris,arkanoid,snake}/engine.ts` se modifica como parte de este spec.
- [x] En un dispositivo/emulador táctil (`pointer: coarse`), `/game/[id]/play` muestra el panel `TouchControls` debajo del `crt`, con joystick arrastrable + hasta 2 botones de acción (renderizados solo si el juego los mapea) + PAUSA + FIN + REGRESAR.
- [x] En desktop (sin `pointer: coarse`), el panel `TouchControls` no se renderiza.
- [x] **Asteroids táctil**: el joystick izquierda/derecha rota la nave, arriba activa el empuje, y el botón de acción dispara — mismo efecto que `←`/`→`/`↑`/`Espacio` en desktop.
- [x] **Tetris táctil**: el joystick izquierda/derecha mueve la pieza, abajo hace caída suave; un botón de acción rota la pieza y el otro ejecuta caída instantánea — mismo efecto que sus teclas equivalentes en desktop.
- [x] **Arkanoid táctil**: el joystick izquierda/derecha mueve la paleta — mismo efecto que `←`/`→` en desktop; al no tener botones de acción mapeados, el panel renderiza solo el joystick, centrado (sin botones deshabilitados a la vista).
- [x] **Snake táctil**: el joystick en sus 4 direcciones controla el movimiento de la serpiente — mismo efecto que flechas/WASD en desktop; al no tener botones de acción mapeados, el panel renderiza solo el joystick, centrado (sin botones deshabilitados a la vista).
- [x] En táctil, el botón PAUSA del panel pausa/reanuda el juego real (mismo `pause()`/`resume()` que el botón "PAUSA" del HUD superior en desktop).
- [x] En táctil, el botón FIN del panel termina la partida manualmente, mostrando el modal "FIN DEL JUEGO" — mismo comportamiento que el botón "FIN" del HUD superior en desktop.
- [x] En táctil, el botón REGRESAR del panel navega a `/game/[id]` — mismo destino que el botón "SALIR" del HUD superior en desktop.
- [x] En táctil (altura de viewport normal), el `player-hud` superior se compacta en una sola fila delgada con stats abreviadas (JUG/PTS/VIDA/NV) y el selector de skin reducido; los botones PAUSA/FIN/SALIR quedan ocultos; en viewports angostos (`max-width: 480px`) el nombre del jugador se oculta primero.
- [x] En táctil con viewport de altura muy reducida (`max-height: 500px`, ej. teléfono en landscape), el `player-hud` no se renderiza en absoluto, y el propio panel `TouchControls` se compacta en escalones sucesivos (`700px`/`560px`/`460px`) para seguir cabiendo.
- [x] En desktop, el `player-hud` superior se ve exactamente igual que hoy (stats + selector de skin + PAUSA/FIN/SALIR, sin compactar).
- [x] En táctil, `components/Nav.tsx` no se renderiza en `/game/[id]/play`; en cualquier otra ruta, o en desktop, el Nav se comporta exactamente igual que hoy.
- [x] Los elementos táctiles del panel (joystick, botones) tienen una hitbox de al menos ~44px en los botones utilitarios (los botones de acción y el joystick se compactan por debajo de ese tamaño solo en los escalones de altura más extrema, priorizando que el panel completo siga cabiendo).
- [x] El resto del catálogo, el guardado de puntuación, y el salón de la fama no presentan regresiones.
- [x] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Spec único combinado para los 4 juegos**, en vez de dividir en un spec de infraestructura + specs por juego (opción sugerida inicialmente). El usuario prefirió entregarlo todo junto. Decisión explícita del usuario.
- **Esquema declarativo (`touchControls`) en `app/game-engines/registry.ts`**, igual patrón ya usado por `skins: SkinName[]`, en vez de que cada `engine.ts` dibuje o maneje sus propios controles táctiles. Permite que juegos futuros solo describan su mapeo sin tocar `GamePlayClient.tsx` ni el panel. Decisión explícita del usuario, motivada porque está previsto agregar más juegos al catálogo.
- **Ningún `engine.ts` se modifica**: el panel táctil despacha `KeyboardEvent` sintéticos sobre `window` con el `code` que cada juego ya escucha (`ArrowLeft`, `Space`, etc.), en vez de agregar listeners táctiles nativos dentro de cada motor o exponer una API de input alternativa. Se confirmó viable porque los 4 engines ya filtran por `e.code` sin depender de otras propiedades del evento real de teclado. Decisión técnica propuesta y validada con el usuario.
- **Joystick arrastrable con zona muerta calculada por vector, en vez de zonas fijas discretas** (revisión posterior a la primera entrega, motivada por feedback directo del usuario probando en dispositivo: "cambian flechas por joystick"). El primer diseño usaba zonas discretas equivalentes a botones de flecha; se sustituyó por una perilla que sigue al dedo dentro de la base, con la dirección determinada por el vector desde el centro y una zona muerta para filtrar temblores — se siente más natural al tacto sin introducir velocidad analógica real (la salida hacia el juego sigue siendo una tecla discreta mantenida). Decisión explícita del usuario tras probar la primera versión.
- **Botones de acción sin mapeo (Arkanoid, Snake) se ocultan por completo, en vez de mostrarse deshabilitados** (revisión posterior a la primera entrega, en la misma ronda de ajustes que el joystick). La primera versión mostraba ambos slots atenuados visualmente para mantener consistencia de layout entre los 4 juegos; se decidió que no aportaba valor real y que el joystick centrado y solo comunica con más claridad que ese juego no usa botones de acción. Decisión explícita del usuario, revirtiendo la decisión original de "consistencia visual con deshabilitado".
- **Joystick + hasta 2 botones de acción, con layout uniforme entre los 4 juegos** (se mantiene el principio original de que el panel siempre tiene la misma composición — joystick + hasta 2 botones + utilitarios — aunque ahora los botones sin mapeo no se rendericen). Decisión explícita del usuario.
- **Soporte de 8 direcciones declarable pero no implementado en ningún juego actual** — los 4 juegos usan `directions: 4`; `8` queda como capacidad del esquema para un juego futuro que lo necesite, sin gestos diagonales reales que verificar en este spec. Decisión explícita del usuario.
- **Estilo cromado/metálico vía CSS + SVG inline**, en vez de assets de imagen (PNG/SVG) provistos por el usuario, para mantener el patrón sin archivos estáticos adicionales y facilitar reestilizarlo a futuro por skin si se pidiera. Decisión explícita del usuario.
- **Escalado responsive del canvas aplicado siempre** (cualquier viewport angosto, táctil o no), en vez de limitarlo a dispositivos táctiles — es una mejora responsive general independiente del panel de controles. Decisión explícita del usuario.
- **Escalado por altura resuelto con una cadena de `flexbox`, en vez de offsets fijos calculados sobre `100vh`** (revisión posterior a la primera entrega, tras verificar que los offsets fijos exigían re-medir constantes cada vez que cambiaba el alto del Nav/HUD/panel — justo el riesgo que la primera versión del spec ya anticipaba). Se optó por delegar el reparto de espacio al propio motor de layout del navegador: los elementos de tamaño fijo (`.player-hud`, `.crt-bottom`, el panel táctil) se marcan `flex-shrink: 0` y los que deben ocupar el resto (`.crt`, `.crt-screen`, el `canvas`) se marcan `flex: 1; min-height: 0`, sin necesitar ninguna constante de píxeles que sincronizar manualmente. Se descartó mantener el enfoque de offsets porque ya había requerido dos rondas de ajuste el mismo día en que se implementó, y un tercer ajuste (agregar el panel de controles, ocultar el Nav) habría exigido un cuarto recálculo. Decisión explícita del usuario, priorizando robustez a futuro sobre el esfuerzo ya invertido en las constantes fijas.
- **Detección táctil por capacidad de puntero (`pointer: coarse`)**, sin combinarla con un breakpoint de ancho — así una tablet grande en horizontal también recibe el panel y el Nav oculto, priorizando el tipo de entrada disponible sobre el tamaño de pantalla. Decisión explícita del usuario.
- **Nav oculto solo en táctil y solo en `/game/[id]/play`**, no en todas las rutas ni en desktop — el problema identificado es la falta de espacio en pantallas táctiles durante la partida, no una preferencia general de ocultar la navegación. Decisión explícita del usuario.
- **Botón REGRESAR del panel táctil apunta a `/game/[id]`**, el mismo destino que "SALIR" en desktop — se descartó la alternativa inicial de llevarlo a `/games` (biblioteca completa) para no introducir un destino distinto entre plataformas. Decisión explícita del usuario (corrigiendo la propuesta inicial).
- **PAUSA, FIN y REGRESAR se agregan al panel táctil**, preservando las mismas 3 acciones que el HUD superior ya tiene en desktop — se descartó la alternativa de omitir "FIN" en móvil, que habría quitado la posibilidad de terminar la partida manualmente antes de perder. Decisión explícita del usuario.
- **HUD superior reducido a stats + skin en táctil** (ocultando PAUSA/FIN/SALIR, que quedan cubiertos por el panel inferior), en vez de mantener duplicados ambos conjuntos de botones arriba y abajo. Decisión explícita del usuario.
- **HUD superior compactado en una fila delgada en táctil, con etiquetas abreviadas y un dato (nombre) que se oculta primero en viewports angostos**, en vez de solo ocultar botones. El usuario notó que, sumando el HUD de stats+skin, el `crt` y el panel `TouchControls`, el conjunto no cabría verticalmente en pantallas táctiles típicas si el HUD conservaba su tamaño de desktop. Además, si la altura del viewport táctil es muy reducida (`max-height: 500px`, típico de un teléfono en landscape), el HUD compacto se oculta por completo vía CSS — se prefirió sacrificar la visibilidad de stats en ese caso extremo antes que forzar scroll dentro de la partida. Decisión explícita del usuario.
- **El propio panel `TouchControls` se compacta en 3 escalones según la altura del viewport** (`700px`/`560px`/`460px`), en vez de mantener siempre su tamaño completo y confiar solo en el escalado del `canvas` — en pantallas de teléfono muy bajas, el panel fijo (joystick + botones + utilitarios) podía seguir siendo demasiado alto incluso con el `canvas` ya reducido al mínimo razonable. Decisión explícita del usuario, parte de la misma ronda de ajustes que introdujo el joystick arrastrable.

## Riesgos identificados

- **Eventos sintéticos de teclado no capturados por algún engine**: si algún `engine.ts` llegara a filtrar eventos de teclado por alguna propiedad distinta de `code` (ej. `key`, `keyCode`, o verificando `event.isTrusted`), el mecanismo de `KeyboardEvent` sintéticos dejaría de funcionar para ese juego. Mitigación: los 4 engines actuales ya fueron revisados y filtran únicamente por `e.code`; el paso 9 de verificación manual debe confirmar explícitamente que cada uno de los 4 juegos responde igual al toque que al teclado real.
- **Doble disparo de acciones "one-shot" (disparo, hard-drop, rotar)**: si el `pointerdown`/`pointerup` del botón táctil despacha `keydown`+`keyup` de forma distinta a como el usuario mantendría una tecla real, algunas acciones pensadas como pulsación única podrían repetirse o no dispararse. Mitigación: replicar el mismo ciclo `keydown` (al iniciar el toque) / `keyup` (al soltar o al salir del botón) que ya produce una pulsación de teclado real, sin lógica adicional de repetición.
- **`pointerleave`/`pointercancel` no disparado en algunos navegadores móviles al arrastrar el dedo fuera del botón/joystick**: si el dedo se desliza fuera del área sin generar `pointerup`/`pointerleave`, una dirección o botón podría quedar "trabado" activo. Mitigación: además de `pointerup`/`pointerleave`, se escucha `pointercancel`, y se usa `setPointerCapture` en el joystick y en los botones de acción para que los eventos de movimiento/liberación sigan llegando aunque el dedo se desplace fuera del elemento original.
- **Zona muerta del joystick mal calibrada**: si `DEAD_ZONE_RATIO` resultara demasiado alta, el joystick se sentiría "duro" (hay que arrastrar mucho antes de que reaccione); si fuera demasiado baja, un toque casi estático en el centro podría disparar direcciones por micro-temblores del dedo. Mitigación: valor único centralizado en `TouchControls.tsx`, ajustable sin tocar el resto del componente; el paso 9 de verificación debe confirmar que la respuesta se siente natural en los 4 juegos.
- **Canvas escalado por flexbox con coordenadas internas del engine sin ajustar**: Arkanoid ya traduce coordenadas de mouse con `scaleX`/`rect.width`, pero si el escalado responsive introduce un tamaño de `crt-screen` que no preserva el aspect-ratio del canvas, la conversión existente podría desalinearse. Mitigación: la regla del `canvas` (`max-width/max-height: 100%; width/height: auto`) preserva su relación de aspecto real en cualquier tamaño que le asigne la cadena flex, sin forzar un `aspect-ratio` de contenedor distinto al `width`/`height` del propio `canvas`.
- **`matchMedia('(pointer: coarse)')` no reevaluado si el usuario conecta/desconecta un teclado o mouse externo** (ej. tablet con teclado Bluetooth): el panel podría quedar visible u oculto de forma inconsistente con la entrada real disponible en ese momento. Mitigación: fuera de alcance resolverlo con más precisión que el propio comportamiento nativo de `pointer: coarse` del navegador — se acepta la detección tal como la reporta la plataforma, sin heurísticas adicionales.
- **Nav oculto dejando al usuario sin forma de salir de la app en táctil** si además fallara el panel `TouchControls` (ej. error de render): sin Nav ni HUD de acciones visibles, el usuario quedaría atrapado en `/game/[id]/play`. Mitigación: el botón REGRESAR del panel es la única salida en táctil, por lo que el paso 9 de verificación debe confirmarlo explícitamente como parte crítica del flujo, no solo como un botón más.
- **Tamaño fijo de canvas ya señalado como pendiente en specs 05/07/08/09**: este spec lo resuelve para el problema de overflow/escalado, pero no rediseña el layout general de `/game/[id]/play` más allá de lo descrito — cualquier ajuste adicional de composición queda fuera de alcance.
- **`:has(.av-player)` requiere soporte de navegador para el selector `:has()`**: si un navegador no lo soportara, `.av-main` conservaría su piso de altura automático y la cadena flex de `.av-player` no tendría el `min-height: 0` que necesita para poder encogerse — podría reaparecer scroll vertical en viewports bajos solo en esos navegadores. Mitigación: `:has()` ya tiene soporte amplio en los navegadores modernos (Chrome/Edge/Safari/Firefox recientes); no se agregó un fallback explícito por considerarse un riesgo residual aceptable, pero cualquier spec futuro que note regresiones de scroll en un navegador específico debe revisar este selector primero.

---

**Nota de realineación (2026-07-23):** este documento fue revisado y reescrito para que su contenido coincida con el estado real del código tras los ajustes hechos en los días posteriores a la primera redacción (commits `Ajustes a la parte responsive en los juegos`, `Ajuste responsive en pantalla de fin de juego`, `Se ajusta el control táctil. Se cambian flechas por joystick`). La versión original describía un mecanismo de escalado por `max-height`/`100vh` con offsets fijos (`345px`/`520px`) y pisos mínimos (`280px`/`240px`), y un joystick de zonas discretas con botones deshabilitados visualmente — ninguno de los dos coincide con la implementación final, que usa una cadena de `flexbox` para el reparto de alto y un joystick de perilla arrastrable con botones ocultos cuando no aplican. Esta revisión no narra esos intentos superados: describe directamente el comportamiento final, para servir como base fiable a desarrollos futuros (agentes, specs nuevos) que se apoyen en este documento.
