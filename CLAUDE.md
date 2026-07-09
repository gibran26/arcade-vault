# CLAUDE.md

Este archivo proporciona guía a Claude Code (claude.ai/code) al trabajar con código en este repositorio.

@AGENTS.md

## ⚠️ Next.js no convencional

Este proyecto usa Next.js 16.2.10, una versión con cambios importantes respecto al Next.js "clásico" que pueda estar en tus datos de entrenamiento (APIs, convenciones y estructura de archivos pueden diferir). **Antes de escribir código**, consulta la guía relevante en `node_modules/next/dist/docs/` (organizada en `01-app/` para el App Router y `02-pages/` para el Pages Router) y respeta los avisos de deprecación que encuentres ahí.

## Comandos

```bash
npm run dev      # Servidor de desarrollo (usa Turbopack por defecto en Next 16)
npm run build    # Build de producción
npm run start    # Servidor de producción (requiere build previo)
npm run lint     # ESLint (eslint-config-next: core-web-vitals + typescript)
```

No hay un runner de tests configurado todavía en este proyecto.

## Arquitectura

- **App Router** (`app/`): actualmente solo contiene el scaffold por defecto de `create-next-app` (`layout.tsx`, `page.tsx`, `globals.css`). Aún no hay rutas, componentes ni lógica de negocio propios de Arcade Vault.
- **Estilos**: Tailwind CSS v4 vía `@tailwindcss/postcss` (sin archivo `tailwind.config.*`; la configuración vive en `postcss.config.mjs` y las directivas de `globals.css`).
- **TypeScript**: alias de import `@/*` apunta a la raíz del proyecto (ver `tsconfig.json`).
- **Fuentes**: `Geist` y `Geist_Mono` cargadas vía `next/font/google` en `app/layout.tsx`.

## Metodología del proyecto (Spec Driven Design)

Este proyecto sigue Spec Driven Design usando los comandos `/spec` y `/spec-impl`, basado en las prácticas de https://github.com/Klerith/fernando-skills. Los skills se instalan con:

```bash
npx skills@latest add Klerith/fernando-skills
```

## Producto

Arcade Vault es una plataforma para jugar online y competir por la mayor cantidad de puntos.
