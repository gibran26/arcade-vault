---
name: spec-impl-game
description: >-
  Implementa un spec de integración de juego aprobado siguiendo /spec-impl (valida estado
  Aprobado, crea la rama spec-NN-slug), pero implementa el plan de corrido —anunciando cada paso
  antes de empezarlo, sin pausas intermedias— y difiere toda validación manual en navegador (MCP
  de Playwright) al cierre. Al terminar, dispara automáticamente y en secuencia dos agentes sobre
  el juego recién implementado: primero skin-designer (selector de skins) y luego mobile-porter
  (controles táctiles), nunca en paralelo.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(cat:*), Bash(ls:*), Task, Agent
---

# /spec-impl-game — Implementador de specs de integración de juego + acabado móvil/visual

## Sesión de contexto

Estado actual del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles en esta carpeta:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Config de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo de config)"`

---

## Relación con `/spec-impl`

Esta skill **es una especialización de `/spec-impl`** (`.claude/skills/spec-impl/SKILL.md`), no un
reemplazo. Reutiliza su metodología —identificación del spec, validación del estado Aprobado,
creación/cambio de rama, resumen del spec, implementación guiada por el plan— y le añade una única
fase final: al terminar la implementación, dispara automáticamente los agentes `skin-designer` y
`mobile-porter`, uno después del otro, sobre el juego recién integrado.

Hay **dos desviaciones deliberadas** respecto a `/spec-impl`, pensadas para agilizar la integración
de un juego completo (planes de 6-10 pasos):

1. **Ritmo de implementación:** sin pausas entre pasos del plan. Se anuncia cada paso antes de
   empezarlo y se continúa de inmediato al terminarlo, en vez de esperar confirmación tras cada uno.
2. **Validación en navegador diferida:** ninguna verificación manual con el MCP de Playwright se
   ejecuta durante la implementación, aunque un paso del plan la mencione. Se ofrece una sola vez,
   al cierre, junto con la revisión de criterios de aceptación.

Fuera de esas dos desviaciones, **manda `/spec-impl` sin cambios**: sus cuatro fases, su tono, y
todas sus reglas duras (incluidas las excepciones que sí detienen la ejecución: ambigüedad genuina y
pedidos fuera de alcance). Antes de continuar, **lee `.claude/skills/spec-impl/SKILL.md` completo**.

Está pensada específicamente para specs de **integración de juego**: los que produce `/add-game`
(motor real en `<canvas>` + leaderboard en Supabase), que siempre declaran un `id` de catálogo
(p. ej. `id: "snake"`) en su sección de Alcance o Modelo de datos. No la uses para specs genéricos
sin un juego asociado — para esos, usa `/spec-impl` directamente.

---

## Fase A — Ejecutar `/spec-impl` completo

Sigue las **Fases 1 a 4 de `.claude/skills/spec-impl/SKILL.md`** tal cual están escritas:

1. **Fase 1** — Identificar el spec a partir de `$ARGUMENTS` (número, slug o nombre completo).
2. **Fase 2** — Validar que el estado del spec signifique "Aprobado" (en cualquier idioma). Si no lo
   es, detente y muestra el mensaje de error estándar de `/spec-impl` — no continúes, no dispares
   ningún agente.
3. **Fase 3** — Crear/cambiar a la rama `spec-NN-slug` según `AutoCreateBranch`, y mostrar el
   resumen del spec (objetivo, alcance, plan, criterios de aceptación).
4. **Fase 4, con el ritmo modificado de esta skill** — pide la misma confirmación inicial única que
   `/spec-impl` (`¿Empezamos con el Paso 1?`), pero aclarando en ese mensaje que, a partir del OK,
   todos los pasos del plan se implementarán **de corrido, sin pausas intermedias**. Una vez
   confirmado:
   - Antes de cada paso, anuncia con una línea uniforme qué paso estás por comenzar:
     `▶ Paso N de M — <título del paso según el plan del spec>`.
   - Implementa el paso, muestra un resumen breve de qué archivos tocaste y qué hiciste, y
     **continúa de inmediato** con el siguiente paso — no preguntes "¿continúo con el Paso N+1?".
   - **No ejecutes validaciones manuales en navegador** (MCP de Playwright, capturas, partidas de
     prueba) durante esta fase, aunque un paso del plan las mencione explícitamente — quedan
     diferidas a la Fase D de esta skill. Sí siguen aplicando las verificaciones no interactivas de
     siempre si el spec las pide (`npm run build`, `lint`, lectura de código).
   - Se mantienen las dos excepciones que sí detienen la ejecución, igual que en `/spec-impl`: ante
     una **ambigüedad genuina** que el spec no resuelve, detente, descríbela y presenta 2-3 opciones
     concretas esperando la decisión del usuario; ante un **pedido fuera de alcance**, recházalo y
     sugiere anotarlo para otro spec. Correr de corrido no significa improvisar.

**No avances a la Fase B de esta skill hasta que todos los pasos del plan del spec estén
implementados** — el punto en el que `/spec-impl` mostraría su mensaje "✅ Todos los pasos del plan
están implementados". Si la Fase 2 bloqueó el spec por no estar Aprobado, la ejecución de esta skill
termina ahí: no hay Fase B ni Fase C.

---

## Fase B — Identificar el juego

Extrae el `id` de catálogo del juego **directamente del spec ya leído**, sin preguntarle al
usuario. Es el mismo `id` que usan la fila semilla de la tabla `games` y la entrada de
`GAME_ENGINES` (`app/game-engines/registry.ts`) — normalmente aparece como `id: "<id>"` en la
sección de Alcance (nueva entrada de catálogo) o de Modelo de datos.

Si el spec no expone un `id` literal de forma obvia:

1. Derívalo del slug del nombre del spec (`07-tetris-motor-leaderboard` → `tetris`,
   `09-snake-motor-leaderboard` → `snake`).
2. Verifica ese id contra las claves reales de `GAME_ENGINES` en `app/game-engines/registry.ts`
   (debería existir ahí, porque la Fase A recién lo implementó).
3. Solo si tras esto sigue siendo genuinamente ambiguo (por ejemplo, el spec integra más de un
   juego a la vez, algo fuera de la convención de `/add-game`), detente y pregúntale al usuario cuál
   `id` usar antes de continuar a la Fase C. Esta es la excepción, no el flujo normal.

---

## Fase C — Disparar los dos agentes en secuencia (automático)

Una vez identificado el `id` del juego, anuncia brevemente que vas a aplicar el acabado
móvil/visual estándar y ejecuta, **en este orden y sin pausar a pedir confirmación entre uno y
otro**:

1. **Primero, `skin-designer`.** Lánzalo con el Agent tool (`subagent_type: "skin-designer"`),
   indicándole explícitamente el `id` (o nombre) del juego recién implementado y que audite/complete
   su selector de skins (`classic`/`neon`/`retro`) siguiendo su propio criterio autónomo. Espera a
   que termine su corrida completa antes de continuar. Muestra al usuario un resumen breve de su
   reporte final (qué faltaba, qué implementó, archivos tocados).

2. **Después, solo cuando `skin-designer` haya terminado, `mobile-porter`.** Lánzalo con el Agent
   tool (`subagent_type: "mobile-porter"`), indicándole el mismo `id` del juego, para que audite e
   implemente su `touchControls` en el registry siguiendo el spec 10
   (`controles-tactiles-moviles`). Espera a que termine y muestra un resumen de su reporte (qué
   faltaba, qué implementó, cualquier bloqueante).

Si alguno de los dos agentes sugiere en su reporte una verificación manual en navegador (por
ejemplo, `skin-designer` suele sugerir `npm run dev` + MCP de Playwright), **no la ejecutes en esta
fase**: anótala como pendiente y se ofrece junto con el resto de la validación en la Fase D.

**Regla dura explícita:** los dos agentes se ejecutan **uno después del otro, nunca en paralelo** —
no emitas ambas llamadas de Agent en el mismo turno/bloque. `skin-designer` siempre va primero;
`mobile-porter` siempre después, y solo arranca una vez que `skin-designer` reportó su resultado.

No repliques a mano el trabajo de ningún agente (no edites tú el registry para skins ni para
touchControls) — eso es exactamente lo que delegas en ellos.

---

## Fase D — Cierre y oferta de validación con Playwright

Entrega primero un reporte final consolidado con tres bloques: (1) qué implementó el spec paso a
paso, (2) el resumen de `skin-designer`, (3) el resumen de `mobile-porter`.

Después, **pregunta una sola vez** si se quiere ejecutar la validación en navegador con el MCP de
Playwright junto con la verificación de los criterios de aceptación. Deja explícito el alcance:

- **Sí incluye:** levantar `npm run dev`, abrir `/game/<id>/play` y revisar visualmente el HUD, el
  selector de skins y los controles táctiles; medir el frame rate y observar el comportamiento de
  rendimiento del motor. Las capturas que se generen van a `.playwright-screenshots/` (convención
  del proyecto).
- **No incluye:** jugar partidas completas ni intentar terminar o ganar el juego — solo lo mínimo
  necesario para que el motor esté corriendo y se pueda observar el render y el frame rate.

Si el usuario acepta, ejecuta esa validación acotada y reporta los hallazgos (visuales, de frame
rate/rendimiento) antes de cerrar. Si el usuario declina (o no responde de inmediato), cierra con:

```
✅ Spec implementado, con selector de skins y controles táctiles aplicados.

Siguiente paso: verificar los criterios de aceptación del spec uno por uno (incluyendo, si el
spec los menciona, los de soporte táctil/skins). Si todos pasan, actualiza el estado del spec a
"Implementado" (o el equivalente en el idioma de tu repo) y haz el commit final antes de mergear
esta rama.
```

---

## Reglas duras

- **Hereda las reglas duras de `/spec-impl`** (bloqueo si el estado no es Aprobado, no improvisar
  fuera del spec, detenerse ante ambigüedad genuina o pedidos fuera de alcance, no ofrecer
  alternativas al mensaje de bloqueo), **excepto el ritmo de la Fase 4**: en vez de pausar tras cada
  paso, aquí se anuncia (`▶ Paso N de M`) y se continúa de inmediato sin pedir confirmación
  intermedia.
- **No se ejecutan validaciones manuales en navegador (MCP de Playwright) durante las Fases A, B ni
  C**, aunque el plan del spec o el reporte de un agente las mencione — se ofrecen una única vez en
  la Fase D, acotadas a revisión visual y frame rate/rendimiento, nunca a jugar partidas completas.
- **Los agentes se disparan en secuencia estricta:** `skin-designer` → `mobile-porter`, jamás en
  paralelo, y `mobile-porter` nunca arranca antes de que `skin-designer` haya terminado.
- **El `id` del juego se extrae del spec sin preguntar**, salvo ambigüedad genuina e irresoluble
  (ver Fase B, paso 3).
- **No lances los agentes si la Fase A no completó todos los pasos del plan** — si el spec quedó
  bloqueado en la Fase 2 (estado no Aprobado) o el usuario detuvo la implementación a mitad de
  camino, esta skill no continúa a la Fase C.
- **No reimplementes a mano lo que hacen los agentes** (paleta de skins, `touchControls` del
  registry): siempre delega en `skin-designer` y `mobile-porter`.
- Esta skill es para specs de **integración de juego** (con un `id` de catálogo). Si el spec
  indicado no es de ese tipo, dilo explícitamente y sugiere usar `/spec-impl` en su lugar.

---

## Resumen del comportamiento esperado

```
/spec-impl-game 09-snake-motor-leaderboard

  Fase A  →  Ejecuta /spec-impl 09-snake-motor-leaderboard con el ritmo de esta skill:
             valida estado Aprobado, crea/usa la rama spec-09-snake-motor-leaderboard,
             pide un único OK inicial y luego implementa el plan de corrido, anunciando
             "▶ Paso N de M" antes de cada paso, sin pausas ni Playwright intermedio.
  Fase B  →  Extrae id: "snake" del spec.
  Fase C  →  Lanza skin-designer(snake) → espera → lanza mobile-porter(snake) → espera
             (sin ejecutar las validaciones de navegador que sugieran).
  Fase D  →  Reporte consolidado + oferta única de validar con Playwright (visual y
             frame rate, sin partidas completas) + recordatorio de verificar criterios
             de aceptación y marcar el spec como Implementado.

/spec-impl-game 02-powerups  (estado: Borrador)

  Fase A  →  Fase 2 de /spec-impl detecta estado no-Aprobado → ❌ se detiene.
             Muestra el mensaje de error estándar. No hay Fase B, C ni D.
```
