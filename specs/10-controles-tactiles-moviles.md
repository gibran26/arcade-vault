# 10 — Controles táctiles y adaptación móvil

**Estado:** Aprobado
**Depende de:** 05-asteroids-motor-real, 07-tetris-motor-leaderboard, 08-arkanoid-motor-leaderboard, 09-snake-motor-leaderboard (registro `GAME_ENGINES` y los 4 motores ya existentes, que no se modifican por dentro)
**Fecha:** 2026-07-22
**Objetivo:** Hacer que los 4 juegos jugables (Asteroids, Tetris, Arkanoid, Snake) funcionen y se vean correctamente en dispositivos móviles táctiles, agregando un panel de controles táctiles genérico (joystick + botones de acción + pausa/fin/regresar) declarado por juego en `app/game-engines/registry.ts` —sin modificar el código interno de ningún `engine.ts`—, junto con el escalado responsive del canvas y la ocultación del Nav global durante la partida en viewports táctiles.

## Alcance

**Dentro del alcance:**

- **Escalado responsive del canvas**: CSS en `.crt-screen`/`canvas` (`max-width: 100%; height: auto` o equivalente) para que los 4 tamaños existentes (800×600 Asteroids/Arkanoid, 480×600 Tetris, 600×600 Snake) se ajusten al ancho disponible sin overflow ni scroll horizontal, en **cualquier viewport angosto** (táctil o no) — mejora general independiente del panel táctil. Arkanoid ya convierte coordenadas de mouse con `scaleX`/`rect.width`, así que el reescalado por CSS no requiere tocar su `engine.ts`.
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
- **HUD superior (`player-hud`) adaptado en táctil**: cuando `pointer: coarse` es verdadero, se ocultan los botones PAUSA/FIN/SALIR (reemplazados por el panel inferior), quedando visibles solo las stats (Jugador/Puntuación/Vidas/Nivel) y el selector de skin.
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

- **`app/game/[id]/play/GamePlayClient.tsx`** — sin nuevas estructuras de datos propias; agrega el uso de `useTouchDevice()` para: (a) ocultar condicionalmente los botones PAUSA/FIN/SALIR del `player-hud`, (b) renderizar `<TouchControls schema={entry.touchControls} .../>` debajo del `crt` cuando el schema existe y el dispositivo es táctil.

- **`components/Nav.tsx`**: sin nuevas estructuras; agrega `useTouchDevice()` + verificación de `pathname` contra el patrón `/game/[id]/play` (regex simple, ej. `/^\/game\/[^/]+\/play$/`) para retornar `null` cuando ambas condiciones se cumplen. En cualquier otra ruta, o en desktop, el comportamiento no cambia.

- **`app/globals.css`**: sin estructuras de datos; agrega reglas para `canvas` dentro de `.crt-screen` (`max-width: 100%; height: auto;`), ajustes de padding de `.crt`/`.crt-bottom` en viewports angostos, y las clases nuevas del panel táctil (`.touch-controls`, `.touch-joystick`, `.touch-joystick-knob`, `.touch-action-btn`, `.touch-utility-btn`) con el estilo cromado/metálico vía CSS (gradientes, `box-shadow` inset/outset) — sin usar archivos de imagen.

## Plan de implementación

1. **Crear el hook `useTouchDevice()`** en `app/lib/use-touch-device.ts`, basado en `matchMedia('(pointer: coarse)')` con `false` como valor inicial seguro para SSR. El sistema queda funcional: el hook compila y es importable, aunque nada lo consuma todavía.

2. **Escalado responsive del canvas** — agregar en `app/globals.css` la regla `max-width: 100%; height: auto;` para el `canvas` dentro de `.crt-screen`, más ajustes de padding de `.crt`/`.crt-bottom` en viewports angostos. El sistema queda funcional: los 4 juegos (800×600, 480×600, 600×600) dejan de desbordar en pantallas angostas, verificable de inmediato en DevTools, sin ningún cambio de comportamiento en desktop.

3. **Extender `app/game-engines/registry.ts`** con los tipos `JoystickMapping`, `ActionButtonMapping`, `TouchControlsSchema`, el campo opcional `touchControls` en `EngineEntry`, y el mapeo concreto de los 4 juegos (Asteroids, Tetris, Arkanoid, Snake) definido en el Modelo de datos. El sistema queda funcional: compila, el registro expone el nuevo campo, aunque nada lo consuma todavía.

4. **Crear `app/game/[id]/play/TouchControls.tsx`** — joystick direccional + hasta 2 botones de acción (deshabilitados visualmente si el juego no mapea ese slot) + botones utilitarios PAUSA/FIN/REGRESAR, estilo cromado vía CSS/SVG inline, despachando `KeyboardEvent` sintéticos (`keydown`/`keyup`) en `pointerdown`/`pointerup`/`pointerleave` según `schema`. El sistema queda funcional: el componente compila y es renderizable de forma aislada (ej. montado manualmente en una página de prueba), aunque `GamePlayClient.tsx` todavía no lo use.

5. **Conectar `TouchControls` en `app/game/[id]/play/GamePlayClient.tsx`** — usar `useTouchDevice()` para (a) ocultar los botones PAUSA/FIN/SALIR del `player-hud` en táctil (dejando stats + selector de skin), y (b) renderizar `TouchControls` debajo del `crt` cuando el dispositivo es táctil y `entry.touchControls` existe, pasando `togglePause`/`endGame`/`router.push('/game/${game.id}')` como props. El sistema queda funcional de punta a punta: en un dispositivo o emulador táctil, los 4 juegos son jugables completos con el panel táctil, sin haber tocado ningún `engine.ts`.

6. **Ocultar el Nav en táctil durante la partida** — en `components/Nav.tsx`, usar `useTouchDevice()` + verificación de `pathname` (`/^\/game\/[^/]+\/play$/`) para retornar `null` cuando ambas condiciones se cumplen. El sistema queda funcional: en táctil, `/game/[id]/play` deja de mostrar el Nav; cualquier otra ruta y el comportamiento en desktop quedan exactamente igual que hoy.

7. **Verificación manual y build** — emular un dispositivo táctil (Chrome DevTools device toolbar o Playwright con `hasTouch: true`) y jugar una partida completa de cada uno de los 4 juegos: canvas escalado sin overflow ni scroll horizontal, joystick + botones de acción producen el mismo efecto que sus equivalentes de teclado/mouse, PAUSA/FIN/REGRESAR funcionan igual que en desktop, HUD superior reducido a stats + skin, Nav oculto. Confirmar en desktop (sin emulación táctil) que nada cambió: teclado, mouse, Nav completo, HUD completo con PAUSA/FIN/SALIR. Ejecutar `npm run build` sin errores de TypeScript ni de ESLint.

## Criterios de aceptación

- [ ] `app/lib/use-touch-device.ts` exporta `useTouchDevice()`, basado en `matchMedia('(pointer: coarse)')`, con `false` por defecto en el primer render de servidor/cliente.
- [ ] En cualquier viewport angosto (táctil o no), el `canvas` de los 4 juegos se escala dentro de `.crt-screen` sin desbordar horizontalmente ni generar scroll horizontal en la página.
- [ ] En desktop (viewport ancho, sin emulación táctil), el tamaño y comportamiento visual del canvas de los 4 juegos no cambia respecto al actual.
- [ ] `app/game-engines/registry.ts` expone `TouchControlsSchema`/`JoystickMapping`/`ActionButtonMapping` y cada entrada de `GAME_ENGINES` (`asteroids`, `tetris`, `arkanoid`, `snake`) incluye su `touchControls` con el mapeo definido en el Modelo de datos.
- [ ] Ninguno de los archivos `app/game-engines/{asteroids,tetris,arkanoid,snake}/engine.ts` se modifica como parte de este spec.
- [ ] En un dispositivo/emulador táctil (`pointer: coarse`), `/game/[id]/play` muestra el panel `TouchControls` debajo del `crt`, con joystick + hasta 2 botones de acción (deshabilitados visualmente si el juego no los mapea) + PAUSA + FIN + REGRESAR.
- [ ] En desktop (sin `pointer: coarse`), el panel `TouchControls` no se renderiza.
- [ ] **Asteroids táctil**: el joystick izquierda/derecha rota la nave, arriba activa el empuje, y el botón de acción dispara — mismo efecto que `←`/`→`/`↑`/`Espacio` en desktop.
- [ ] **Tetris táctil**: el joystick izquierda/derecha mueve la pieza, abajo hace caída suave; un botón de acción rota la pieza y el otro ejecuta caída instantánea — mismo efecto que sus teclas equivalentes en desktop.
- [ ] **Arkanoid táctil**: el joystick izquierda/derecha mueve la paleta — mismo efecto que `←`/`→` en desktop; los dos botones de acción se muestran deshabilitados (sin función).
- [ ] **Snake táctil**: el joystick en sus 4 direcciones controla el movimiento de la serpiente — mismo efecto que flechas/WASD en desktop; los dos botones de acción se muestran deshabilitados (sin función).
- [ ] En táctil, el botón PAUSA del panel pausa/reanuda el juego real (mismo `pause()`/`resume()` que el botón "PAUSA" del HUD superior en desktop).
- [ ] En táctil, el botón FIN del panel termina la partida manualmente, mostrando el modal "FIN DEL JUEGO" — mismo comportamiento que el botón "FIN" del HUD superior en desktop.
- [ ] En táctil, el botón REGRESAR del panel navega a `/game/[id]` — mismo destino que el botón "SALIR" del HUD superior en desktop.
- [ ] En táctil, el `player-hud` superior solo muestra stats (Jugador/Puntuación/Vidas/Nivel) y el selector de skin; los botones PAUSA/FIN/SALIR quedan ocultos.
- [ ] En desktop, el `player-hud` superior se ve exactamente igual que hoy (stats + selector de skin + PAUSA/FIN/SALIR).
- [ ] En táctil, `components/Nav.tsx` no se renderiza en `/game/[id]/play`; en cualquier otra ruta, o en desktop, el Nav se comporta exactamente igual que hoy.
- [ ] Los elementos táctiles del panel (joystick, botones) tienen una hitbox de al menos ~44px, apta para el dedo.
- [ ] El resto del catálogo, el guardado de puntuación, y el salón de la fama no presentan regresiones.
- [ ] `npm run build` compila sin errores de TypeScript ni de ESLint.

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

## Riesgos identificados

- **Eventos sintéticos de teclado no capturados por algún engine**: si algún `engine.ts` llegara a filtrar eventos de teclado por alguna propiedad distinta de `code` (ej. `key`, `keyCode`, o verificando `event.isTrusted`), el mecanismo de `KeyboardEvent` sintéticos dejaría de funcionar para ese juego. Mitigación: los 4 engines actuales ya fueron revisados y filtran únicamente por `e.code`; el Paso 7 de verificación manual debe confirmar explícitamente que cada uno de los 4 juegos responde igual al toque que al teclado real.
- **Doble disparo de acciones "one-shot" (disparo, hard-drop, rotar)**: si el `pointerdown`/`pointerup` del botón táctil despacha `keydown`+`keyup` de forma distinta a como el usuario mantendría una tecla real (ej. mantener el dedo presionado sin soltar), algunas acciones pensadas como pulsación única podrían repetirse o no dispararse. Mitigación: replicar el mismo ciclo `keydown` (al iniciar el toque) / `keyup` (al soltar o al salir del botón) que ya produce una pulsación de teclado real, sin lógica adicional de repetición.
- **`pointerleave` no disparado en algunos navegadores móviles al arrastrar el dedo fuera del botón/joystick**: si el dedo se desliza fuera del área sin generar `pointerup`/`pointerleave`, una dirección o botón podría quedar "trabado" activo (ej. la nave sigue rotando o la paleta sigue moviéndose sin que el dedo la toque). Mitigación: además de `pointerup`/`pointerleave`, escuchar `pointercancel` y, como resguardo, liberar todos los `code` activos si se detecta que ya no hay ningún puntero activo sobre el panel.
- **Canvas escalado por CSS con coordenadas internas del engine sin ajustar**: Arkanoid ya traduce coordenadas de mouse con `scaleX`/`rect.width`, pero si el escalado responsive introduce un tamaño de `crt-screen` que no preserva el aspect-ratio del canvas (ej. `object-fit` implícito distinto de `contain`), la conversión existente podría desalinearse. Mitigación: el Paso 2 debe preservar el aspect-ratio real de cada canvas (`height: auto` a partir de `max-width: 100%`, sin forzar un `aspect-ratio` de contenedor distinto al `width`/`height` del propio `canvas`).
- **`matchMedia('(pointer: coarse)')` no reevaluado si el usuario conecta/desconecta un teclado o mouse externo** (ej. tablet con teclado Bluetooth): el panel podría quedar visible u oculto de forma inconsistente con la entrada real disponible en ese momento. Mitigación: fuera de alcance resolverlo con más precisión que el propio comportamiento nativo de `pointer: coarse` del navegador — se acepta la detección tal como la reporta la plataforma, sin heurísticas adicionales.
- **Botones deshabilitados (Arkanoid/Snake) interceptando toques por error**: si el botón deshabilitado no bloquea correctamente sus propios eventos, un toque accidental podría despachar un `code` sin sentido para ese juego. Mitigación: los botones sin mapeo (`buttonA`/`buttonB` ausentes en el schema) deben renderizarse sin listeners de puntero activos (no solo con estilo visual atenuado).
- **Nav oculto dejando al usuario sin forma de salir de la app en táctil** si además fallara el panel `TouchControls` (ej. error de render): sin Nav ni HUD de acciones visibles, el usuario quedaría atrapado en `/game/[id]/play`. Mitigación: el botón REGRESAR del panel es la única salida en táctil, por lo que el Paso 7 de verificación debe confirmarlo explícitamente como parte crítica del flujo, no solo como un botón más.
- **Tamaño fijo de canvas ya señalado como pendiente en specs 05/07/08/09**: este spec lo resuelve para el problema de overflow/escalado, pero no rediseña el layout general de `/game/[id]/play` más allá de lo descrito — cualquier ajuste adicional de composición queda fuera de alcance.
