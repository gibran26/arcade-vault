# CLAUDE.md — specs/

## Metodología del proyecto (Spec Driven Design)

Este proyecto sigue Spec Driven Design usando los comandos `/spec`, `/spec-impl` y `/add-game`, basado en las prácticas de https://github.com/Klerith/fernando-skills. Los skills se instalan con:

```bash
npx skills@latest add Klerith/fernando-skills
```

- Los specs viven en `specs/NN-slug.md`, numerados secuencialmente, con un campo `**Estado:**` (`Borrador` → `Aprobado` → `Implementado`).
- `specs/.spec-config.yml` controla el flujo (`AutoCreateBranch: true`: `/spec-impl` crea la rama `spec-NN-slug` automáticamente).
- Los juegos fuente que se portan a `app/game-engines/` viven en `references/started-games/` (p. ej. `02-asteroids`, `03-tetris`, `04-arkanoid`).
