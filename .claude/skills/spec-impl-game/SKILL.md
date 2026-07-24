---
name: spec-impl-game
description: >-
  Implementa un spec de integración de juego aprobado siguiendo /spec-impl al pie de la letra
  (valida estado Aprobado, crea la rama spec-NN-slug, implementa paso a paso con pausas) y, al
  terminar, dispara automáticamente y en secuencia dos agentes sobre el juego recién implementado:
  primero skin-designer (selector de skins) y luego mobile-porter (controles táctiles), nunca en
  paralelo.
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
reemplazo. Reutiliza exactamente su metodología —identificación del spec, validación del estado
Aprobado, creación/cambio de rama, resumen del spec, implementación paso a paso con pausas— y le
añade una única fase final: al terminar la implementación, dispara automáticamente los agentes
`skin-designer` y `mobile-porter`, uno después del otro, sobre el juego recién integrado.

Está pensada específicamente para specs de **integración de juego**: los que produce `/add-game`
(motor real en `<canvas>` + leaderboard en Supabase), que siempre declaran un `id` de catálogo
(p. ej. `id: "snake"`) en su sección de Alcance o Modelo de datos. No la uses para specs genéricos
sin un juego asociado — para esos, usa `/spec-impl` directamente.

Antes de continuar, **lee `.claude/skills/spec-impl/SKILL.md` completo** y aplica sus cuatro fases,
su tono, y todas sus reglas duras exactamente igual que si el usuario hubiera invocado `/spec-impl`.
Donde este documento no diga lo contrario, el comportamiento de `/spec-impl` aplica sin cambios.

---

## Fase A — Ejecutar `/spec-impl` completo

Sigue las **Fases 1 a 4 de `.claude/skills/spec-impl/SKILL.md`** tal cual están escritas:

1. **Fase 1** — Identificar el spec a partir de `$ARGUMENTS` (número, slug o nombre completo).
2. **Fase 2** — Validar que el estado del spec signifique "Aprobado" (en cualquier idioma). Si no lo
   es, detente y muestra el mensaje de error estándar de `/spec-impl` — no continúes, no dispares
   ningún agente.
3. **Fase 3** — Crear/cambiar a la rama `spec-NN-slug` según `AutoCreateBranch`, y mostrar el
   resumen del spec (objetivo, alcance, plan, criterios de aceptación).
4. **Fase 4** — Implementar el plan paso a paso, pausando tras cada paso para que el usuario revise
   el diff, exactamente con las mismas reglas (no improvisar fuera del spec, detenerse ante
   ambigüedades con opciones concretas, rechazar pedidos fuera de alcance).

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

**Regla dura explícita:** los dos agentes se ejecutan **uno después del otro, nunca en paralelo** —
no emitas ambas llamadas de Agent en el mismo turno/bloque. `skin-designer` siempre va primero;
`mobile-porter` siempre después, y solo arranca una vez que `skin-designer` reportó su resultado.

No repliques a mano el trabajo de ningún agente (no edites tú el registry para skins ni para
touchControls) — eso es exactamente lo que delegas en ellos.

---

## Fase D — Cierre

Cierra igual que recomienda `/spec-impl`, ahora incluyendo también el trabajo de ambos agentes:

```
✅ Spec implementado, con selector de skins y controles táctiles aplicados.

Siguiente paso: verificar los criterios de aceptación del spec uno por uno (incluyendo, si el
spec los menciona, los de soporte táctil/skins). Si todos pasan, actualiza el estado del spec a
"Implementado" (o el equivalente en el idioma de tu repo) y haz el commit final antes de mergear
esta rama.
```

Entrega un reporte final consolidado con tres bloques: (1) qué implementó el spec paso a paso,
(2) el resumen de `skin-designer`, (3) el resumen de `mobile-porter`.

---

## Reglas duras

- **Hereda todas las reglas duras de `/spec-impl`** (bloqueo si el estado no es Aprobado, no
  improvisar fuera del spec, pausar tras cada paso de implementación, no ofrecer alternativas al
  mensaje de bloqueo).
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

  Fase A  →  Ejecuta /spec-impl 09-snake-motor-leaderboard completo:
             valida estado Aprobado, crea/usa la rama spec-09-snake-motor-leaderboard,
             implementa el plan paso a paso con pausas.
  Fase B  →  Extrae id: "snake" del spec.
  Fase C  →  Lanza skin-designer(snake) → espera → lanza mobile-porter(snake) → espera.
  Fase D  →  Reporte consolidado + recordatorio de verificar criterios de aceptación
             y marcar el spec como Implementado.

/spec-impl-game 02-powerups  (estado: Borrador)

  Fase A  →  Fase 2 de /spec-impl detecta estado no-Aprobado → ❌ se detiene.
             Muestra el mensaje de error estándar. No hay Fase B, C ni D.
```
