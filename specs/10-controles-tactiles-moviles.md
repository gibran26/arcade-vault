# 10 — Controles táctiles y adaptación móvil

**Estado:** Implementado
**Depende de:** 05-asteroids-motor-real, 07-tetris-motor-leaderboard, 08-arkanoid-motor-leaderboard, 09-snake-motor-leaderboard (registro `GAME_ENGINES` y los 4 motores ya existentes, que no se modifican por dentro)
**Fecha:** 2026-07-22
**Objetivo:** Hacer que los 4 juegos jugables (Asteroids, Tetris, Arkanoid, Snake) funcionen y se vean correctamente en dispositivos móviles táctiles, agregando un panel de controles táctiles genérico (joystick + botones de acción + pausa/fin/regresar) declarado por juego en `app/game-engines/registry.ts` —sin modificar el código interno de ningún `engine.ts`—, junto con el escalado responsive del canvas (por ancho **y por alto**, en cualquier dispositivo) y la ocultación del Nav global durante la partida en viewports táctiles.

## Alcance

**Dentro del alcance:**

- **Escalado responsive del canvas por ancho**: CSS en `.crt-screen`/`canvas` (`max-width: 100%; height: auto` o equivalente) para que los 4 tamaños existentes (800×600 Asteroids/Arkanoid, 480×600 Tetris, 600×600 Snake) se ajusten al ancho disponible sin overflow ni scroll horizontal, en **cualquier viewport angosto** (táctil o no) — mejora general independiente del panel táctil. Arkanoid ya convierte coordenadas de mouse con `scaleX`/`rect.width`, así que el reescalado por CSS no requiere tocar su `engine.ts`.
- **Escalado responsive del canvas por alto, en cualquier dispositivo** (revisión agregada durante la implementación, reportada por el usuario en su propia laptop): el canvas también se limita mediante `max-height` relativo al alto de viewport (`100vh`), para que el juego completo (Nav + HUD + `crt` + `crt-bottom` + footer) quepa sin necesitar scroll vertical en pantallas de poca altura (ej. laptops con ventana del navegador de ~625–768px de alto útil) — **no depende de `pointer: coarse`**, aplica igual con mouse que con dedo. Como consecuencia necesaria, `.crt-screen` deja de forzar un `aspect-ratio: 4/3` fijo en cualquier viewport (no solo en los angostos) y en su lugar siempre se ajusta al tamaño real del `canvas` ya escalado — el marco CRT deja de reservar espacio vacío alrededor de canvas más pequeños que 4:3 (Tetris, Snake) incluso en desktop amplio. El tope de altura conserva un mínimo jugable (no se encoge de forma ilimitada en viewports extremadamente bajos).
- **El marco `.crt-screen` se ajusta también en ancho al tamaño real del `canvas`, no solo en alto** (segunda revisión, mismo día, tras el primer intento del punto anterior): el usuario reportó que, aunque el juego ya cabía sin scroll, se veía "muy pequeño" y **no se distinguían los límites del canvas** — porque `.crt-screen` seguía ocupando el 100% del ancho disponible aunque el `canvas` se hubiera encogido por el tope de alto, dejando un espacio muerto del mismo color (negro) alrededor del `canvas` real, indistinguible a simple vista. `.crt-screen` pasa a `width: fit-content; max-width: 100%; margin: 0 auto;` para que el marco/pantalla siempre "abrace" el tamaño real y visible del `canvas` (centrado dentro del `.crt`), en cualquier combinación de ancho/alto de viewport — el borde entre `.crt-screen` (pantalla) y `.crt` (gabinete exterior) vuelve a marcar exactamente el límite jugable.
- **Presupuesto de espacio vertical recuperado para agrandar la zona de juego** (misma revisión): se redujeron paddings/márgenes no esenciales de la página de juego —`.av-player` (margen 32px→20px, padding inferior 64px→24px), `.player-hud` (padding 14px→10px, margen inferior 18px→10px), `.crt` (padding 24px→16px), `.crt-bottom` (margen superior 14px→8px), y el `footer` global del layout (padding vertical 20px→10px, afecta a todas las páginas de forma menor)— para que el `canvas` reciba más de la altura disponible en vez de que se la coman espacios decorativos. Con ese espacio recuperado, los topes de `max-height` bajan de forma proporcional y el piso mínimo sube (ver Modelo de datos), dando un `canvas` visiblemente más grande en pantallas de altura normal/reducida sin reintroducir scroll.
- **Detección de dispositivo táctil** vía `matchMedia('(pointer: coarse)')`, centralizada en un solo lugar reutilizable (hook o util) y consumida tanto por `GamePlayClient.tsx` como por `components/Nav.tsx`.
- **Panel de controles táctiles genérico**, nuevo componente en `app/game/[id]/play/`, visible únicamente cuando `pointer: coarse` es verdadero, ubicado debajo del `crt` (pantalla del juego arriba, panel abajo). Incluye:
  - **Joystick direccional** circular estilo cromado (CSS/SVG inline, imitando la referencia visual compartida), con soporte declarado de `4` u `8` direcciones (los 4 juegos actuales usan `4`; `8` queda disponible para un juego futuro).
  - **Hasta 2 botones de acción** redondos (CSS/SVG, mismo estilo cromado), con ícono/etiqueta configurables por juego.
  - **Botones utilitarios PAUSA, FIN y REGRESAR**, conectados a los mismos handlers ya existentes en `GamePlayClient.tsx` (`togglePause`, `endGame`, `router.push('/game/${game.id}')` — mismo destino que "SALIR" hoy).
  - Cada pulsación de joystick/botón de acción despacha `KeyboardEvent` sintéticos (`keydown`/`keyup`) sobre `window` con el `code` declarado por el juego — **ningún `engine.ts` se modifica**.
- **Esquema declarativo de controles táctiles en `app/game-engines/registry.ts`**: cada `EngineEntry` declara opcionalmente su mapeo (direcciones del joystick → `code`, hasta 2 botones de acción → `code` + ícono/etiqueta, y el modo `4`/`8` direcciones). Mapeo concreto para los 4 juegos actuales:
  - **Asteroids**: joystick izquierda/derecha → `ArrowLeft`/`ArrowRight` (rotar), joystick arriba → `ArrowUp` (empuje); botón A → `Space` (disparar); botón B sin función (oculto o inhabilitado visualmente).
  - **Tetris**: joystick izquierda/derecha → `ArrowLeft`/`ArrowRight` (mover), joystick abajo → `ArrowDown` (caída suave); botón A → `ArrowUp`/`KeyX` (rotar); botón B → `Space` (caída instantánea).
  - **Arkanoid**: joystick izquierda/derecha → `ArrowLeft`/`ArrowRight` (paleta); joystick arriba/abajo sin función; botones A y B sin función.
  - **Snake**: joystick en las 4 direcciones → `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`; botones A y B sin función.
- **HUD superior (`player-hud`) adaptado en táctil**: cuando `pointer: coarse` es verdadero, se ocultan los botones PAUSA/FIN/SALIR (reemplazados por el panel inferior) y el resto (stats + selector de skin) se compacta en una sola fila delgada, con etiquetas abreviadas y el selector de skin reducido, para liberar el espacio vertical que ocupa el nuevo panel de controles inferior. **En viewports táctiles de altura muy reducida** (`max-height: 500px`, el caso típico de un teléfono en landscape), el `player-hud` compacto se oculta por completo — las stats dejan de ser visibles durante la partida en ese caso extremo, recuperables al pausar o en el modal de fin de partida.
- **Nav global oculto en táctil durante la partida**: `components/Nav.tsx` no se renderiza (o se oculta vía CSS) específicamente en la ruta `/game/[id]/play` cuando `pointer: coarse` es verdadero; en desktop, y en cualquier otra ruta, el Nav se comporta exactamente igual que hoy.
- **Panel táctil visible únicamente cuando `pointer: coarse` es verdadero** (no en desktop con mouse).
- **Diseño del joystick/botones con CSS + SVG inline** imitando el estilo cromado/metálico de la referencia visual compartida.
- **Modo de direcciones declarable (`4 | 8`)** en el esquema del registro, aunque los 4 juegos actuales usan `4`.
- **Botones/controles con hitbox táctil adecuada** (tamaño mínimo razonable para dedo, ej. ~44px) en el panel nuevo.

**Fuera de alcance (para otros specs):**

- Gestos de swipe o arrastre directo sobre el canvas — se descartó a favor del joystick+botones uniforme para los 4 juegos.
- Joystick analógico real (magnitud según distancia/ángulo de arrastre) — el joystick es direccional discreto, equivalente a pulsar una tecla.
- Implementar o probar el modo de 8 direcciones con un juego real — el esquema lo declara, pero ningún juego actual lo usa.
- Cambios dentro de `app/game-engines/{asteroids,tetris,arkanoid,snake}/engine.ts` — el mecanismo de eventos sintéticos evita tocarlos.
- Rediseño visual del HUD superior en desktop — sigue exactamente igual que hoy.
- Vibración háptica (`navigator.vibrate`) al presionar controles.
- Bloqueo/forzado de orientación (landscape lock) u orientation API — el escalado responsive debe funcionar tal como venga el dispositivo (portrait o landscape), sin forzar nada.
- PWA, instalación como app, o Fullscreen API.
- Adaptación responsive de otras rutas (`/`, `/games`, `/about`, `/hall-of-fame`, `/auth`) más allá de lo ya existente — este spec es específico de `/game/[id]/play`.
- Políticas RLS en `games`/`scores`, Supabase Auth real — mismos pendientes ya documentados en specs 05/06/07/08/09, sin relación con este spec.

## Modelo de datos

- **`app/lib/use-touch-device.ts`** — hook nuevo, sin dependencias externas:

  ```ts
  export function useTouchDevice(): boolean;
  ```

  Internamente usa `window.matchMedia('(pointer: coarse)')`, suscrito a cambios (`change` event del `MediaQueryList`), con `false` como valor inicial seguro para SSR (hidrata en el primer render de cliente). Es la única fuente de verdad de "¿este dispositivo es táctil?", consumida por `GamePlayClient.tsx` (para mostrar el panel y adaptar el HUD superior) y por `components/Nav.tsx` (para ocultarse en `/game/[id]/play`).

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
    buttonA?: ActionButtonMapping; // slot fijo; si falta, se renderiza deshabilitado
    buttonB?: ActionButtonMapping; // slot fijo; si falta, se renderiza deshabilitado
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
      // sin buttonA/buttonB: ambos slots se renderizan deshabilitados
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
      // sin buttonA/buttonB: ambos slots se renderizan deshabilitados
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

  Cada zona del joystick y cada botón de acción habilitado, en `pointerdown`/`pointerup`/`pointerleave`, despacha `window.dispatchEvent(new KeyboardEvent('keydown'|'keyup', { code }))` con el `code` correspondiente de `schema` — ningún `engine.ts` cambia. Los botones PAUSA/FIN/REGRESAR invocan directamente `onTogglePause`/`onFinish`/`onExit` (props recibidas de `GamePlayClient.tsx`, mismas funciones que ya usan los botones del HUD superior en desktop).

- **`app/game/[id]/play/GamePlayClient.tsx`** — sin nuevas estructuras de datos propias; agrega el uso de `useTouchDevice()` para: (a) ocultar condicionalmente los botones PAUSA/FIN/SALIR del `player-hud`, aplicando además una clase modificadora (ej. `player-hud-touch`) que compacta las stats + selector de skin restantes en una sola fila, (b) renderizar `<TouchControls schema={entry.touchControls} .../>` debajo del `crt` cuando el schema existe y el dispositivo es táctil. El ocultamiento completo del `player-hud` en viewports muy bajos de altura (`max-height: 500px`) se resuelve solo con CSS (`app/globals.css`), sin lógica adicional en este componente.

- **`components/Nav.tsx`**: sin nuevas estructuras; agrega `useTouchDevice()` + verificación de `pathname` contra el patrón `/game/[id]/play` (regex simple, ej. `/^\/game\/[^/]+\/play$/`) para retornar `null` cuando ambas condiciones se cumplen. En cualquier otra ruta, o en desktop, el comportamiento no cambia.

- **`app/globals.css`**: sin estructuras de datos; agrega reglas para `canvas` dentro de `.crt-screen` (`max-width: 100%; width: auto; height: auto; max-height: max(calc(100vh - 345px), 280px);`, con un segundo offset más generoso —`max-height: max(calc(100vh - 520px), 240px);`— dentro de `@media (pointer: coarse)`, declarado **después** de la regla base para ganarle la cascada por especificidad igual/orden de declaración), ajustes de padding de `.crt`/`.crt-bottom` en viewports angostos, y las clases nuevas del panel táctil (`.touch-controls`, `.touch-joystick`, `.touch-joystick-knob`, `.touch-action-btn`, `.touch-utility-btn`) con el estilo cromado/metálico vía CSS (gradientes, `box-shadow` inset/outset) — sin usar archivos de imagen. Además agrega `.player-hud-touch` (fila única compacta: stats abreviadas + selector de skin reducido) y una regla `@media (pointer: coarse) and (max-height: 500px) { .player-hud { display: none; } }` que oculta el HUD por completo en viewports táctiles de altura muy reducida, sin depender de JS.

  La regla `.crt-screen` pasa de `aspect-ratio: 4 / 3;` fijo a `aspect-ratio: auto;` **de forma incondicional** (no solo dentro del breakpoint angosto), para que el marco siempre hugee el tamaño real del `canvas` ya limitado por `max-width`/`max-height` — sin esto, el `canvas` podría encogerse pero la caja `.crt-screen` seguiría reservando la altura de un 4:3 fijo calculada sobre su propio ancho, sin reducir la altura total de la página.

  `.crt-screen` también agrega `width: fit-content; max-width: 100%; margin: 0 auto;` (antes ocupaba siempre el 100% del ancho de `.crt`). Esto resuelve el bug de "límites del canvas invisibles": cuando el `canvas` se encoge por el tope de alto, su ancho derivado (vía relación de aspecto) queda por debajo del ancho disponible; sin este cambio, `.crt-screen` seguía siendo tan ancho como su contenedor, dejando un margen negro (mismo color que el fondo del `canvas`) a los lados, indistinguible del juego real. Con `width: fit-content`, `.crt-screen` siempre mide exactamente lo mismo que el `canvas` que contiene, en cualquier combinación de ancho/alto — el límite visual de la "pantalla" vuelve a coincidir con el límite jugable. El mecanismo de `max-width: 100%` **en el `canvas`** (para el escalado por ancho angosto del primer punto del Alcance) sigue funcionando igual: como `.crt-screen` sigue siendo hijo directo de `.crt` (que sí tiene un ancho definido), no hay dependencia circular.

  Hay **dos offsets fijos**, no uno solo, porque el espacio reservado fuera del `canvas` es distinto en desktop y en táctil:
  - **Desktop, `345px`**: `Nav` (~70px) + margen de `.av-player` (20px, reducido de 32px) + `player-hud` completo (~55px, con paddings reducidos) + su `margin-bottom` (10px, reducido de 18px) + padding de `.crt` (16px arriba/abajo, reducido de 24px) + `margin-top` de `.crt-bottom` (8px, reducido de 14px) + su alto (~12px) + padding inferior de `.av-player` (24px, reducido de 64px) + el `footer` global del layout (~37px, con padding reducido) + margen de seguridad. Medido directamente con Playwright en `/game/asteroids/play` a 1365×625 (el caso reportado por el usuario, ventana de laptop con la barra del navegador restando altura).
  - **Táctil, `520px`**: mismo cálculo, pero el `player-hud` es la versión compacta (~48.5px) y se **suma** el panel `TouchControls` completo (joystick + botones + utilitarios, ~210px de alto más su `margin-top` de 16px) que no existe en desktop; el `Nav` todavía cuenta en este offset porque el Paso 6 se implementó antes que el Paso 7 (ocultar Nav) — una vez oculto, sobra margen, lo cual es aceptable y no produce overflow.

  Ambos son constantes únicas y centralizadas en `app/globals.css` (dos reglas a ajustar, no medición por JS). El piso subió respecto al primer intento (`280px` desktop, `240px` táctil, antes `220px`/`180px`) porque un `canvas` de ~220px de alto resultó "muy pequeño" en la práctica (reporte del usuario) — se prioriza un tamaño mínimo cómodamente jugable sobre garantizar cero scroll en el caso límite absoluto; solo en viewports extremadamente bajos (por debajo de lo que cualquier offset+piso razonable puede cubrir) podría reaparecer scroll vertical.

- **`app/layout.tsx`**: sin estructuras de datos; el `footer` global (usado en todas las páginas, no solo `/game/[id]/play`) reduce su `padding` vertical inline de `20px` a `10px`, como parte de recuperar presupuesto de altura para el `canvas` en la página de juego — cambio cosmético menor que también se aplica, sin problema, al resto del sitio.

## Plan de implementación

1. **Crear el hook `useTouchDevice()`** en `app/lib/use-touch-device.ts`, basado en `matchMedia('(pointer: coarse)')` con `false` como valor inicial seguro para SSR. El sistema queda funcional: el hook compila y es importable, aunque nada lo consuma todavía.

2. **Escalado responsive del canvas** — agregar en `app/globals.css` la regla `max-width: 100%; height: auto;` para el `canvas` dentro de `.crt-screen`, más ajustes de padding de `.crt`/`.crt-bottom` en viewports angostos. El sistema queda funcional: los 4 juegos (800×600, 480×600, 600×600) dejan de desbordar en pantallas angostas, verificable de inmediato en DevTools, sin ningún cambio de comportamiento en desktop.

3. **Extender `app/game-engines/registry.ts`** con los tipos `JoystickMapping`, `ActionButtonMapping`, `TouchControlsSchema`, el campo opcional `touchControls` en `EngineEntry`, y el mapeo concreto de los 4 juegos (Asteroids, Tetris, Arkanoid, Snake) definido en el Modelo de datos. El sistema queda funcional: compila, el registro expone el nuevo campo, aunque nada lo consuma todavía.

4. **Crear `app/game/[id]/play/TouchControls.tsx`** — joystick direccional + hasta 2 botones de acción (deshabilitados visualmente si el juego no mapea ese slot) + botones utilitarios PAUSA/FIN/REGRESAR, estilo cromado vía CSS/SVG inline, despachando `KeyboardEvent` sintéticos (`keydown`/`keyup`) en `pointerdown`/`pointerup`/`pointerleave` según `schema`. El sistema queda funcional: el componente compila y es renderizable de forma aislada (ej. montado manualmente en una página de prueba), aunque `GamePlayClient.tsx` todavía no lo use.

5. **Conectar `TouchControls` en `app/game/[id]/play/GamePlayClient.tsx`** — usar `useTouchDevice()` para (a) ocultar los botones PAUSA/FIN/SALIR del `player-hud` en táctil y aplicar la clase `player-hud-touch` que compacta stats + selector de skin en una sola fila delgada, y (b) renderizar `TouchControls` debajo del `crt` cuando el dispositivo es táctil y `entry.touchControls` existe, pasando `togglePause`/`endGame`/`router.push('/game/${game.id}')` como props. Agregar en `app/globals.css` la regla `@media (pointer: coarse) and (max-height: 500px) { .player-hud { display: none; } }` para ocultar el HUD por completo en viewports táctiles muy bajos de altura. El sistema queda funcional de punta a punta: en un dispositivo o emulador táctil, los 4 juegos son jugables completos con el panel táctil y un HUD que no compite por el espacio vertical, sin haber tocado ningún `engine.ts`.

6. **Escalado responsive del canvas por alto, en cualquier dispositivo** (paso agregado durante la implementación, revisado dos veces tras dos rondas de feedback del usuario) — en `app/globals.css`:
   - Cambiar `.crt-screen` de `aspect-ratio: 4 / 3;` fijo a `aspect-ratio: auto;` incondicional (eliminar el override que solo aplicaba en el breakpoint angosto, ya innecesario).
   - Agregar `width: fit-content; max-width: 100%; margin: 0 auto;` a `.crt-screen`, para que el marco/pantalla siempre coincida con el tamaño real del `canvas` (en ancho y alto), no solo se centre dentro de un contenedor de ancho completo — sin esto, un `canvas` encogido por el tope de alto queda flotando dentro de una `.crt-screen` más ancha, con espacio negro indistinguible del juego alrededor.
   - Extender la regla del `canvas` dentro de `.crt-screen` a `max-width: 100%; width: auto; height: auto; max-height: max(calc(100vh - 345px), 280px);`, con un segundo offset específico para táctil (`max(calc(100vh - 520px), 240px)` dentro de `@media (pointer: coarse)`, colocado **después** de la regla base en el archivo para ganar la cascada) que reserva el espacio adicional del panel `TouchControls`.
   - Reducir paddings/márgenes no esenciales para recuperar presupuesto de altura: `.av-player` (margen 32px→20px, padding inferior 64px→24px), `.player-hud` (padding 14px→10px, margen inferior 18px→10px), `.crt` (padding 24px→16px), `.crt-bottom` (margen superior 14px→8px).
   - En `app/layout.tsx`: reducir el padding vertical del `footer` global de `20px` a `10px` (afecta a todas las páginas, cambio cosmético menor).

   El sistema queda funcional: en cualquier viewport de poca altura (táctil o no, ej. una laptop con ~625px de alto útil de ventana), el juego completo deja de requerir scroll vertical, el límite visual de la pantalla CRT coincide exactamente con el `canvas` jugable (ya no hay espacio muerto indistinguible), y el `canvas` aprovecha el espacio recuperado en vez de quedar innecesariamente pequeño; en desktop con espacio suficiente, el `canvas` conserva su tamaño nativo.

7. **Ocultar el Nav en táctil durante la partida** — en `components/Nav.tsx`, usar `useTouchDevice()` + verificación de `pathname` (`/^\/game\/[^/]+\/play$/`) para retornar `null` cuando ambas condiciones se cumplen. El sistema queda funcional: en táctil, `/game/[id]/play` deja de mostrar el Nav; cualquier otra ruta y el comportamiento en desktop quedan exactamente igual que hoy.

8. **Verificación manual y build** — emular un dispositivo táctil (Chrome DevTools device toolbar o Playwright con `hasTouch: true`) y jugar una partida completa de cada uno de los 4 juegos: canvas escalado sin overflow ni scroll horizontal ni vertical, joystick + botones de acción producen el mismo efecto que sus equivalentes de teclado/mouse, PAUSA/FIN/REGRESAR funcionan igual que en desktop, HUD superior reducido a stats + skin, Nav oculto. Confirmar en desktop (sin emulación táctil) que el teclado/mouse, el Nav y el HUD (PAUSA/FIN/SALIR) siguen intactos, y probar explícitamente una ventana de laptop de poca altura (ej. 1366×768) para confirmar que el juego completo es visible sin scroll. Ejecutar `npm run build` sin errores de TypeScript ni de ESLint.

## Criterios de aceptación

- [x] `app/lib/use-touch-device.ts` exporta `useTouchDevice()`, basado en `matchMedia('(pointer: coarse)')`, con `false` por defecto en el primer render de servidor/cliente.
- [x] En cualquier viewport angosto (táctil o no), el `canvas` de los 4 juegos se escala dentro de `.crt-screen` sin desbordar horizontalmente ni generar scroll horizontal en la página.
- [x] En cualquier viewport de poca altura (táctil o no, ej. una laptop con ~625–768px de alto útil de ventana), el `canvas` de los 4 juegos se escala dentro de `.crt-screen` sin desbordar verticalmente — el juego completo (HUD + `crt` + `crt-bottom` + footer) es visible sin necesitar scroll vertical dentro de la partida.
- [x] En cualquier tamaño de viewport, el borde visible de `.crt-screen` coincide exactamente con el tamaño real del `canvas` — no queda espacio negro "muerto" alrededor del `canvas` que pueda confundirse con parte del juego; el límite jugable es siempre distinguible a simple vista.
- [x] En viewports de altura reducida donde el `canvas` se encoge, su tamaño se mantiene cómodamente legible (no cae por debajo del piso mínimo definido: `280px` de alto en desktop, `240px` en táctil) — se prioriza esto sobre garantizar cero scroll en el caso límite absoluto.
- [x] En desktop con ancho y alto suficientes, el `canvas` de los 4 juegos conserva su tamaño nativo (800×600 / 480×600 / 600×600); el marco `.crt-screen` ya no fuerza un `aspect-ratio: 4/3` fijo (cambio intencional: el marco ahora siempre se ajusta al tamaño real del `canvas`, en vez de reservar espacio vacío alrededor de los canvas que no son 4:3).
- [x] `app/game-engines/registry.ts` expone `TouchControlsSchema`/`JoystickMapping`/`ActionButtonMapping` y cada entrada de `GAME_ENGINES` (`asteroids`, `tetris`, `arkanoid`, `snake`) incluye su `touchControls` con el mapeo definido en el Modelo de datos.
- [x] Ninguno de los archivos `app/game-engines/{asteroids,tetris,arkanoid,snake}/engine.ts` se modifica como parte de este spec.
- [x] En un dispositivo/emulador táctil (`pointer: coarse`), `/game/[id]/play` muestra el panel `TouchControls` debajo del `crt`, con joystick + hasta 2 botones de acción (deshabilitados visualmente si el juego no los mapea) + PAUSA + FIN + REGRESAR.
- [x] En desktop (sin `pointer: coarse`), el panel `TouchControls` no se renderiza.
- [x] **Asteroids táctil**: el joystick izquierda/derecha rota la nave, arriba activa el empuje, y el botón de acción dispara — mismo efecto que `←`/`→`/`↑`/`Espacio` en desktop.
- [x] **Tetris táctil**: el joystick izquierda/derecha mueve la pieza, abajo hace caída suave; un botón de acción rota la pieza y el otro ejecuta caída instantánea — mismo efecto que sus teclas equivalentes en desktop.
- [x] **Arkanoid táctil**: el joystick izquierda/derecha mueve la paleta — mismo efecto que `←`/`→` en desktop; los dos botones de acción se muestran deshabilitados (sin función).
- [x] **Snake táctil**: el joystick en sus 4 direcciones controla el movimiento de la serpiente — mismo efecto que flechas/WASD en desktop; los dos botones de acción se muestran deshabilitados (sin función).
- [x] En táctil, el botón PAUSA del panel pausa/reanuda el juego real (mismo `pause()`/`resume()` que el botón "PAUSA" del HUD superior en desktop).
- [x] En táctil, el botón FIN del panel termina la partida manualmente, mostrando el modal "FIN DEL JUEGO" — mismo comportamiento que el botón "FIN" del HUD superior en desktop.
- [x] En táctil, el botón REGRESAR del panel navega a `/game/[id]` — mismo destino que el botón "SALIR" del HUD superior en desktop.
- [x] En táctil (altura de viewport normal), el `player-hud` superior se compacta en una sola fila delgada con stats abreviadas (Jugador/Puntuación/Vidas/Nivel) y el selector de skin reducido; los botones PAUSA/FIN/SALIR quedan ocultos.
- [x] En táctil con viewport de altura muy reducida (`max-height: 500px`, ej. teléfono en landscape), el `player-hud` no se renderiza en absoluto.
- [x] En desktop, el `player-hud` superior se ve exactamente igual que hoy (stats + selector de skin + PAUSA/FIN/SALIR, sin compactar).
- [x] En táctil, `components/Nav.tsx` no se renderiza en `/game/[id]/play`; en cualquier otra ruta, o en desktop, el Nav se comporta exactamente igual que hoy.
- [x] Los elementos táctiles del panel (joystick, botones) tienen una hitbox de al menos ~44px, apta para el dedo.
- [x] El resto del catálogo, el guardado de puntuación, y el salón de la fama no presentan regresiones.
- [x] `npm run build` compila sin errores de TypeScript ni de ESLint.

## Decisiones tomadas y descartadas

- **Spec único combinado para los 4 juegos**, en vez de dividir en un spec de infraestructura + specs por juego (opción sugerida inicialmente). El usuario prefirió entregarlo todo junto. Decisión explícita del usuario.
- **Esquema declarativo (`touchControls`) en `app/game-engines/registry.ts`**, igual patrón ya usado por `skins: SkinName[]`, en vez de que cada `engine.ts` dibuje o maneje sus propios controles táctiles. Permite que juegos futuros solo describan su mapeo sin tocar `GamePlayClient.tsx` ni el panel. Decisión explícita del usuario, motivada porque está previsto agregar más juegos al catálogo.
- **Ningún `engine.ts` se modifica**: el panel táctil despacha `KeyboardEvent` sintéticos sobre `window` con el `code` que cada juego ya escucha (`ArrowLeft`, `Space`, `KeyX`, etc.), en vez de agregar listeners táctiles nativos dentro de cada motor o exponer una API de input alternativa. Se confirmó viable porque los 4 engines ya filtran por `e.code` sin depender de otras propiedades del evento real de teclado. Decisión técnica propuesta y validada con el usuario.
- **Joystick + hasta 2 botones de acción, uniforme en los 4 juegos** (incluyendo Arkanoid y Snake, que no usan botones), en vez de un layout distinto por juego (ej. ocultar el joystick en Arkanoid o los botones en Snake). El usuario pidió explícitamente consistencia visual: los botones sin función se muestran deshabilitados, no se ocultan. Decisión explícita del usuario.
- **Joystick direccional discreto** (equivale a mantener presionada una tecla), no analógico por distancia/ángulo — ninguno de los 4 juegos usa velocidad variable. Decisión explícita del usuario.
- **Soporte de 8 direcciones declarable pero no implementado en ningún juego actual** — los 4 juegos usan `directions: 4`; `8` queda como capacidad del esquema para un juego futuro que lo necesite, sin gestos diagonales reales que verificar en este spec. Decisión explícita del usuario.
- **Estilo cromado/metálico vía CSS + SVG inline**, en vez de assets de imagen (PNG/SVG) provistos por el usuario, para mantener el patrón sin archivos estáticos adicionales y facilitar reestilizarlo a futuro por skin si se pidiera. Decisión explícita del usuario.
- **Escalado responsive del canvas aplicado siempre** (cualquier viewport angosto, táctil o no), en vez de limitarlo a dispositivos táctiles — es una mejora responsive general independiente del panel de controles. Decisión explícita del usuario.
- **Detección táctil por capacidad de puntero (`pointer: coarse`)**, sin combinarla con un breakpoint de ancho — así una tablet grande en horizontal también recibe el panel y el Nav oculto, priorizando el tipo de entrada disponible sobre el tamaño de pantalla. Decisión explícita del usuario.
- **Nav oculto solo en táctil y solo en `/game/[id]/play`**, no en todas las rutas ni en desktop — el problema identificado es la falta de espacio en pantallas táctiles durante la partida, no una preferencia general de ocultar la navegación. Decisión explícita del usuario.
- **Botón REGRESAR del panel táctil apunta a `/game/[id]`**, el mismo destino que "SALIR" en desktop — se descartó la alternativa inicial de llevarlo a `/games` (biblioteca completa) para no introducir un destino distinto entre plataformas. Decisión explícita del usuario (corrigiendo la propuesta inicial).
- **PAUSA, FIN y REGRESAR se agregan al panel táctil**, preservando las mismas 3 acciones que el HUD superior ya tiene en desktop — se descartó la alternativa de omitir "FIN" en móvil, que habría quitado la posibilidad de terminar la partida manualmente antes de perder. Decisión explícita del usuario.
- **HUD superior reducido a stats + skin en táctil** (ocultando PAUSA/FIN/SALIR, que quedan cubiertos por el panel inferior), en vez de mantener duplicados ambos conjuntos de botones arriba y abajo. Decisión explícita del usuario.
- **HUD superior compactado en una fila delgada en táctil, en vez de solo ocultar botones** (revisión hecha durante la implementación, tras ver el Paso 2 funcionando): el usuario notó que, sumando el HUD de stats+skin actual, el `crt` y el panel `TouchControls` (aún sin implementar en ese momento), el conjunto no cabría verticalmente en pantallas táctiles típicas. Se descartó dejar el HUD de stats+skin con su tamaño actual (columna/fila con paddings generosos) a favor de compactarlo en una sola fila delgada con etiquetas abreviadas. Además, se agrega un caso extremo: si la altura del viewport táctil es muy reducida (`max-height: 500px`, típico de un teléfono en landscape), el HUD compacto se oculta por completo vía CSS — se prefirió sacrificar la visibilidad de stats en ese caso extremo antes que forzar scroll dentro de la partida. Decisión explícita del usuario.
- **Escalado por altura de viewport agregado como Paso 6, aplicando a cualquier dispositivo (no solo táctil)** (revisión hecha durante la implementación, tras el Paso 5, reportada por el usuario al abrir `/game/arkanoid/play` en su propia laptop): con viewport ancho pero de poca altura (laptop 1366×768 con la ventana no maximizada), el canvas de 800×600 más el Nav/HUD/paddings no cabían en la pantalla y forzaban scroll — un bug que no era de touch, sino de cualquier viewport con altura limitada, sin relación con `pointer: coarse`. El usuario pidió explícitamente que el ajuste quedara dentro de esta spec en vez de aplazarlo, porque esta spec sirve de base para desarrollos futuros. Se descartó resolverlo solo para viewports táctiles (hubiera dejado el bug sin corregir en el propio caso reportado, una laptop con mouse) a favor de aplicarlo siempre, vía CSS puro (`max-height` relativo a `100vh`), sin medir el DOM por JS. Como consecuencia técnica necesaria (ver Modelo de datos), `.crt-screen` deja de forzar `aspect-ratio: 4/3` en cualquier viewport, no solo en los angostos — se acepta que el marco CRT luzca más ajustado al contenido también en desktop amplio (antes tenía espacio vacío alrededor de Tetris/Snake por el 4:3 forzado), un cambio cosmético menor y deliberado frente a la alternativa de mantener el bug de overflow. Decisión explícita del usuario.
- **Segunda revisión del Paso 6, mismo día: `.crt-screen` pasa a `width: fit-content` y se reduce el padding de varios elementos, en vez de dejar el primer intento tal cual** (revisión hecha tras verificar el primer intento en vivo con Playwright y luego recibir feedback del usuario sobre esa misma verificación): el primer intento sí eliminaba el scroll, pero el usuario reportó dos problemas con una captura de pantalla — (1) el juego se veía "muy pequeño" y (2) no se distinguían los límites del `canvas`. La causa de (2) resultó ser que `.crt-screen` seguía ocupando el 100% del ancho disponible aunque el `canvas` se hubiera encogido solo en alto, dejando un margen negro indistinguible del juego a los lados — se corrigió con `width: fit-content` en `.crt-screen`, en vez de, por ejemplo, dibujar un borde/outline sobre el `canvas` para simplemente hacer visible el límite sin eliminar el espacio muerto (se descartó esa alternativa porque no resolvía (1): el juego seguiría luciendo pequeño dentro de un marco grande). La causa de (1) era que el piso mínimo (`220px`/`180px` de alto) se estaba alcanzando en tamaños de ventana comunes (no solo casos extremos), y ahí el juego resultaba incómodamente chico. Se optó por **reducir paddings/márgenes no esenciales** (`.av-player`, `.player-hud`, `.crt`, `.crt-bottom`, el `footer` global) para recuperar espacio vertical real y así poder bajar los offsets de `max-height` (dando más alto disponible al `canvas` antes de tocar el piso) y subir el piso mismo (`280px`/`240px`), en vez de alternativas más invasivas como ocultar el `footer` por completo en la página de juego (requeriría convertirlo en Client Component con `usePathname()`, mayor cambio de arquitectura para el mismo día) o medir el espacio disponible por JS con `ResizeObserver` (más robusto a futuro, pero se descartó por ahora para no expandir más el alcance de un spec ya extendido dos veces; ver el riesgo de los offsets fijos más abajo). Decisión explícita del usuario, quien autorizó ajustar el tamaño del HUD si hacía falta.

## Riesgos identificados

- **Eventos sintéticos de teclado no capturados por algún engine**: si algún `engine.ts` llegara a filtrar eventos de teclado por alguna propiedad distinta de `code` (ej. `key`, `keyCode`, o verificando `event.isTrusted`), el mecanismo de `KeyboardEvent` sintéticos dejaría de funcionar para ese juego. Mitigación: los 4 engines actuales ya fueron revisados y filtran únicamente por `e.code`; el Paso 7 de verificación manual debe confirmar explícitamente que cada uno de los 4 juegos responde igual al toque que al teclado real.
- **Doble disparo de acciones "one-shot" (disparo, hard-drop, rotar)**: si el `pointerdown`/`pointerup` del botón táctil despacha `keydown`+`keyup` de forma distinta a como el usuario mantendría una tecla real (ej. mantener el dedo presionado sin soltar), algunas acciones pensadas como pulsación única podrían repetirse o no dispararse. Mitigación: replicar el mismo ciclo `keydown` (al iniciar el toque) / `keyup` (al soltar o al salir del botón) que ya produce una pulsación de teclado real, sin lógica adicional de repetición.
- **`pointerleave` no disparado en algunos navegadores móviles al arrastrar el dedo fuera del botón/joystick**: si el dedo se desliza fuera del área sin generar `pointerup`/`pointerleave`, una dirección o botón podría quedar "trabado" activo (ej. la nave sigue rotando o la paleta sigue moviéndose sin que el dedo la toque). Mitigación: además de `pointerup`/`pointerleave`, escuchar `pointercancel` y, como resguardo, liberar todos los `code` activos si se detecta que ya no hay ningún puntero activo sobre el panel.
- **Canvas escalado por CSS con coordenadas internas del engine sin ajustar**: Arkanoid ya traduce coordenadas de mouse con `scaleX`/`rect.width`, pero si el escalado responsive introduce un tamaño de `crt-screen` que no preserva el aspect-ratio del canvas (ej. `object-fit` implícito distinto de `contain`), la conversión existente podría desalinearse. Mitigación: el Paso 2 debe preservar el aspect-ratio real de cada canvas (`height: auto` a partir de `max-width: 100%`, sin forzar un `aspect-ratio` de contenedor distinto al `width`/`height` del propio `canvas`).
- **`matchMedia('(pointer: coarse)')` no reevaluado si el usuario conecta/desconecta un teclado o mouse externo** (ej. tablet con teclado Bluetooth): el panel podría quedar visible u oculto de forma inconsistente con la entrada real disponible en ese momento. Mitigación: fuera de alcance resolverlo con más precisión que el propio comportamiento nativo de `pointer: coarse` del navegador — se acepta la detección tal como la reporta la plataforma, sin heurísticas adicionales.
- **Botones deshabilitados (Arkanoid/Snake) interceptando toques por error**: si el botón deshabilitado no bloquea correctamente sus propios eventos, un toque accidental podría despachar un `code` sin sentido para ese juego. Mitigación: los botones sin mapeo (`buttonA`/`buttonB` ausentes en el schema) deben renderizarse sin listeners de puntero activos (no solo con estilo visual atenuado).
- **Nav oculto dejando al usuario sin forma de salir de la app en táctil** si además fallara el panel `TouchControls` (ej. error de render): sin Nav ni HUD de acciones visibles, el usuario quedaría atrapado en `/game/[id]/play`. Mitigación: el botón REGRESAR del panel es la única salida en táctil, por lo que el Paso 8 de verificación debe confirmarlo explícitamente como parte crítica del flujo, no solo como un botón más.
- **Tamaño fijo de canvas ya señalado como pendiente en specs 05/07/08/09**: este spec lo resuelve para el problema de overflow/escalado, pero no rediseña el layout general de `/game/[id]/play` más allá de lo descrito — cualquier ajuste adicional de composición queda fuera de alcance.
- **Los offsets fijos de `345px` (desktop) y `520px` (táctil) en las reglas `max-height`, y los pisos `280px`/`240px`, pueden desactualizarse**: si una spec futura cambia la altura del `Nav`, del `player-hud` (desktop o táctil), del panel `TouchControls`, del `footer` global, o los paddings de `.crt`/`.crt-bottom`/`.av-player`, esos números dejarían de reflejar el espacio real reservado — en el peor caso, volvería a aparecer scroll vertical en viewports de poca altura, o el `canvas` podría volver a sentirse chico. En particular, cuando el Paso 7 (ocultar Nav en táctil) quede implementado, el offset táctil de `520px` tendrá más margen del estrictamente necesario (~70px de sobra) — no es un bug, pero es una oportunidad de ajuste fino que no se toma en este spec. Mitigación: son dos constantes únicas y centralizadas en `app/globals.css` (dos reglas a ajustar); cualquier spec que modifique la altura del `Nav`, del `player-hud`, del panel táctil o del `footer` debe re-medir y ajustar estos offsets como parte de su propia verificación manual. Si esta fragilidad volviera a causar problemas (esta es ya la segunda ronda de ajuste en el mismo día), la alternativa más robusta a considerar en un spec futuro es medir el espacio disponible en tiempo real con `ResizeObserver`/JS y exponerlo como variable CSS, en vez de mantener constantes fijas — se descartó por ahora para no seguir ampliando el alcance de este spec.
