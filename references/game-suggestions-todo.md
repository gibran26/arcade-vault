# Sugerencias de juegos — game-planner

To-do de recomendaciones de juegos nuevos para Arcade Vault, organizado por estado.

## 🎯 Sugeridos

### ARCADE

| id              | Nombre                     | Fuente     | Justificación                                                                                                                                                                  |
| --------------- | -------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cubo-saltarin` | CUBO SALTARÍN (Q\*bert)    | desde cero | Salto isométrico sobre pirámide de cubos que cambian de color. Sin solape con `serpentina`/`gloton`/`ranaria`. Grilla isométrica + colisión simple, score por cubos cambiados. |
| `excavador`     | EXCAVADOR (Dig Dug)        | desde cero | Excavar túneles y reventar enemigos con bomba de aire o rocas. Introduce terreno destructible, ausente del catálogo.                                                           |
| `barriles`      | BARRILES (Donkey Kong)     | desde cero | Plataformas con escaleras, saltos y barriles rodantes. Primer platformer puro del catálogo.                                                                                    |
| `hamburguesero` | HAMBURGUESERO (BurgerTime) | desde cero | Caminar sobre ingredientes en plataformas para dejarlos caer sobre enemigos. Variante de plataformas con objetivo de "construcción".                                           |
| `minero`        | MINERO (Lode Runner)       | desde cero | Cavar agujeros temporales para atrapar enemigos mientras recolectas oro y escalas. Combina terreno destructible + escalado.                                                    |

### PUZZLE

| id                | Nombre                    | Fuente     | Justificación                                                                                                                                          |
| ----------------- | ------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `burbujeo`        | BURBUJEO (Puzzle Bobble)  | desde cero | Dispara burbujas en ángulo para formar grupos de 3+ y explotarlas. Grid hexagonal + trayectoria, sin físicas complejas.                                |
| `pildoras`        | PÍLDORAS (Dr. Mario)      | desde cero | Cápsulas de dos colores caen y hay que alinear 4+ del mismo color para eliminar "virus". Reutiliza patrones de grid+piezas de `tetris`.                |
| `numerico`        | NUMÉRICO (2048)           | desde cero | Desliza en 4 direcciones para combinar fichas numéricas iguales. Grid fijo 4x4, muy bajo costo de mantenimiento.                                       |
| `gemas`           | GEMAS (Bejeweled/match-3) | desde cero | Intercambia gemas adyacentes para formar líneas de 3+ con combos en cascada. Introduce intercambio posicional.                                         |
| `bloques-magicos` | BLOQUES MÁGICOS (Sokoban) | desde cero | Empuja cajas hasta objetivos en un laberinto. Lógica de planificación espacial en vez de reacción rápida; leaderboard menos directo (menor prioridad). |

### SHOOTER

| id                | Nombre                                    | Fuente     | Justificación                                                                                                                           |
| ----------------- | ----------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `galaxia`         | GALAXIA (Galaga)                          | desde cero | Enemigos en formación que descienden en picada individual o grupal, con mecánica de captura de nave. Distinto de `invasores` y `rocas`. |
| `comando-misiles` | COMANDO DE MISILES (Missile Command)      | desde cero | Disparo de contrafuegos con el mouse para interceptar misiles sobre ciudades. Sub-nicho de "shooter de precisión".                      |
| `ciempies`        | CIEMPIÉS (Centipede)                      | desde cero | Ciempiés serpenteante que se divide al ser impactado, campo de hongos destructibles.                                                    |
| `defensor`        | DEFENSOR (Defender)                       | desde cero | Scroll horizontal continuo con disparo + rescate de humanoides. Mecánica de objetivo doble, más ambicioso de portar.                    |
| `tiro-al-blanco`  | TIRO AL BLANCO (Duck Hunt/Operation Wolf) | desde cero | Shooting gallery de puntería pura con el mouse. El más simple/rápido de implementar, pero menos diferenciado.                           |

### VERSUS

| id                      | Nombre                                         | Fuente     | Justificación                                                                                                                              |
| ----------------------- | ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `combate-tanques`       | COMBATE DE TANQUES (Combat/Tank)               | desde cero | Dos tanques en arena con obstáculos, proyectiles rebotables. Muy distinto de `duelo-pixel` (Pong).                                         |
| `esgrima-pixel`         | ESGRIMA PIXEL (duelo de espadachines)          | desde cero | Duelo 1v1 por temporización (atacar/bloquear/esquivar). Subgénero de lucha ausente en el catálogo.                                         |
| `carrera-reflejos`      | CARRERA DE REFLEJOS (quick draw / splitscreen) | desde cero | Duelo de reacción a dos jugadores en pantalla dividida. Se solapa parcialmente con `ranaria` (menor prioridad).                            |
| `torre-empuje`          | TORRE DE EMPUJE (sumo simplificado)            | desde cero | Empujar bloques/al rival fuera de una plataforma circular. Física de empuje/fricción algo más compleja de calibrar.                        |
| `duelo-francotiradores` | DUELO DE FRANCOTIRADORES                       | desde cero | 1v1 con coberturas y munición limitada. Mecánica de apuntado más compleja de balancear; se acerca a `invasores`/`rocas` (menor prioridad). |

## 👍 Aceptados

_(vacío)_

## ✅ Implementados

_(vacío — recordatorio: `asteroids`, `tetris`, `arkanoid` y `snake` ya están implementados con motor real y no deben volver a sugerirse)_

## 🗑️ Rechazados

_(vacío)_
