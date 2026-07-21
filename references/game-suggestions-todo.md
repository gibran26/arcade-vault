# Sugerencias de juegos (game-planner)

To-Do vivo de juegos propuestos para Arcade Vault. Lo mantiene el subagente `game-planner`
(`.claude/agents/game-planner.md`). No escribe specs ni código — solo registra recomendaciones.

Cada juego vive en una única sección según su estado; al cambiar de estado se mueve su fila
completa a la sección correspondiente.

## 🎯 Sugeridos

| Juego (id)      | Categoría             | Fuente del motor | Razón de encaje                                                                                                                                                                                                                                                                                 | Fecha      |
| --------------- | --------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| flappy-bird     | ARCADE                | desde cero       | Mecánica mínima (1 tecla, gravedad), score = tuberías superadas, muy novedoso, nada de scroll infinito lateral existe hoy                                                                                                                                                                       | 21/07/2026 |
| bomberman       | ARCADE                | desde cero       | Grilla + bombas + destrucción de bloques, alta rejugabilidad, muy diferenciado, exige IA básica de enemigos                                                                                                                                                                                     | 21/07/2026 |
| dig-dug         | ARCADE                | desde cero       | Cavar túneles + inflar enemigos, distinto de Pac-Man/Frogger, viable en canvas con grilla                                                                                                                                                                                                       | 21/07/2026 |
| qbert           | ARCADE                | desde cero       | Salto isométrico sobre cubos, novedoso (perspectiva isométrica ausente), requiere cuidado en mapeo de input                                                                                                                                                                                     | 21/07/2026 |
| whack-a-mole    | ARCADE                | desde cero       | Motor trivial (clicks sobre topos), leaderboard perfecto y sencillo, el más simple/menos "arcade clásico"                                                                                                                                                                                       | 21/07/2026 |
| match3-gems     | PUZZLE                | desde cero       | Llena hueco de PUZZLE (única entrada hoy es Tetris/caida), grid+swap portable, score por combos/cascadas                                                                                                                                                                                        | 21/07/2026 |
| bubble-pop      | PUZZLE                | desde cero       | Puzzle Bobble, apuntar+disparar burbujas, colisión circular simple, único en apuntar con ángulo                                                                                                                                                                                                 | 21/07/2026 |
| 2048            | PUZZLE                | desde cero       | Grid deslizante de números, trivial de portar, leaderboard perfecto (suma de fichas)                                                                                                                                                                                                            | 21/07/2026 |
| pipe-dream      | PUZZLE                | desde cero       | Conectar tuberías contrarreloj, grid de tiles + rotar piezas, score por longitud+tiempo                                                                                                                                                                                                         | 21/07/2026 |
| missile-command | SHOOTER               | desde cero       | Shooter defensivo por puntería, sin solape con invasores/asteroids, score por ciudades salvadas                                                                                                                                                                                                 | 21/07/2026 |
| centipede       | SHOOTER               | desde cero       | Enemigo segmentado en arena con hongos, distinto de formación fija o fragmentación de rocas                                                                                                                                                                                                     | 21/07/2026 |
| neon-swarm      | SHOOTER               | desde cero       | Twin-stick shooter arena abierta (Geometry Wars-like), máxima novedad, encaje estético neón, leaderboard con combos                                                                                                                                                                             | 21/07/2026 |
| light-cycles    | VERSUS                | desde cero       | Único hueco real de VERSUS distinto de Pong: duelo de estelas de luz (Tron), alta novedad. Absorbe el concepto de `tron-lightcycles` (variante 1P) propuesto también por el worker de ARCADE — se consolida aquí como una sola propuesta VERSUS para evitar duplicar el mismo concepto de juego | 21/07/2026 |
| tank-duel       | VERSUS                | desde cero       | Duelo de tanques con rebote de balas en laberinto (Combat), variante versus distinta a Pong y Tron                                                                                                                                                                                              | 21/07/2026 |
| air-hockey      | VERSUS                | desde cero       | Físicas de disco con fricción, conceptualmente cercano a Pong pero con mesa 2D y golpeadores, menor novedad que light-cycles/tank-duel pero leaderboard claro                                                                                                                                   | 21/07/2026 |
| pixel-runner    | RUNNER (nueva)        | desde cero       | Endless runner side-scroll, género ausente en el catálogo, score = distancia/tiempo                                                                                                                                                                                                             | 21/07/2026 |
| salto-vertical  | PLATFORMER (nueva)    | desde cero       | Doodle Jump-style, física simple, score = altura máxima                                                                                                                                                                                                                                         | 21/07/2026 |
| turbo-circuito  | RACING (nueva)        | desde cero       | Vista cenital, esquivar tráfico en carriles, score = distancia/autos esquivados                                                                                                                                                                                                                 | 21/07/2026 |
| ritmo-neon      | RHYTHM (nueva)        | desde cero       | Notas cayendo en carriles, score = precisión/combo; requiere audio sincronizado (mayor riesgo técnico que el resto)                                                                                                                                                                             | 21/07/2026 |
| torre-neon      | TOWER DEFENSE (nueva) | desde cero       | Pathing + torres + oleadas, mayor complejidad de portar que el resto de la lista, score = oleadas sobrevividas                                                                                                                                                                                  | 21/07/2026 |

## 👍 Aceptados

| Juego (id) | Categoría | Fuente del motor | Razón de encaje | Fecha |
| ---------- | --------- | ---------------- | --------------- | ----- |

## ✅ Implementados

| Juego (id) | Categoría | Fuente del motor | Razón de encaje | Fecha |
| ---------- | --------- | ---------------- | --------------- | ----- |

## 🗑️ Rechazados

| Juego (id)     | Categoría           | Fuente del motor | Razón de rechazo                                                                                                                           | Fecha      |
| -------------- | ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| minesweeper    | PUZZLE              | desde cero       | Leaderboard problemático: la convención "menor tiempo es mejor" rompe con el resto del catálogo, donde score alto siempre gana             | 21/07/2026 |
| sokoban        | PUZZLE              | desde cero       | Leaderboard débil: se resuelve por niveles completados, no genera un score numérico continuo y comparable entre partidas                   | 21/07/2026 |
| mini-golf-neon | SPORTS/GOLF (nueva) | desde cero       | Score invertido (menos golpes es mejor) rompe la convención del leaderboard; además exige física de bola con fricción, mayor riesgo        | 21/07/2026 |
| columns        | PUZZLE              | desde cero       | Baja novedad: variante de Tetris (bloques de 3 gemas) que solapa demasiado con Tetris, ya implementado                                     | 21/07/2026 |
| galaga         | SHOOTER             | desde cero       | Se solapa bastante con Space Invaders/Asteroids (formación con clavado en picada); prioridad más baja frente al resto de SHOOTER propuesto | 21/07/2026 |
