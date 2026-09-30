# Manual de deploy del sitio web (Cloudflare Pages)

Hay dos proyectos de Cloudflare Pages independientes, igual que el "staging site" y el dominio de Webflow:

| Entorno | Proyecto Pages | URL actual | Indexable |
|---|---|---|---|
| **Staging** | `fluxa-website-staging` | https://fluxa-website-staging.pages.dev | No (`X-Robots-Tag: noindex`) |
| **Producción** | `fluxa-website` | https://fluxa-website.pages.dev (+ dominio propio cuando exista) | Sí |

Cada entorno se compila por separado porque `PUBLIC_SITE_URL` (canonical y sitemap) queda fijo en el build.
El script `scripts/deploy.mjs` se encarga de eso: compila con la URL correcta y sube a Pages.

## Requisitos (una sola vez)

- Sesión de Cloudflare activa. Comprobar con `pnpm --dir apps/data-client exec wrangler whoami`.
  Si no hay sesión: `pnpm --dir apps/data-client exec wrangler login`.
- `pnpm install` hecho en la raíz del repo.

## Comandos (desde `apps/website`, o con `pnpm --filter @fluxa/website <script>` desde la raíz)

### 1. Solo staging
```bash
pnpm deploy:staging
```
Compila con la URL de staging, agrega `noindex` y sube a `fluxa-website-staging`.
**No toca producción.** Revisa el resultado en la URL de staging.

### 2. Solo producción (dominio)
```bash
pnpm deploy:production
```
Compila con la URL de producción y sube a `fluxa-website`. **No toca staging.**

### 3. Ambos a la vez
```bash
pnpm deploy:both
```
Despliega primero staging y luego producción. Si el build o el deploy de staging falla, producción no se toca.

## Flujo recomendado

1. `pnpm deploy:staging` y revisar el sitio en staging.
2. Si todo está bien, `pnpm deploy:production`.
3. Usa `deploy:both` solo para cambios que ya sabes que están bien.

## Cuando ya exista el dominio propio

1. En el dashboard de Cloudflare: Workers & Pages -> `fluxa-website` -> Custom domains -> Set up a domain.
   Si la zona DNS está en Cloudflare, el registro y el certificado se crean solos.
   Si el DNS está en otro registrador, crear un CNAME hacia `fluxa-website.pages.dev`.
2. Opcional, dominio de staging (por ejemplo `staging.tudominio.com`): mismo paso en `fluxa-website-staging`.
3. Desplegar con las URLs nuevas para que el canonical y el sitemap apunten al dominio:
   ```bash
   # PowerShell
   $env:PRODUCTION_URL = "https://tudominio.com"; pnpm deploy:production
   ```
   ```bash
   # bash
   PRODUCTION_URL=https://tudominio.com pnpm deploy:production
   ```
   Para no repetirlo cada vez, cambia el valor por defecto de `url` en `scripts/deploy.mjs`.
   Las URLs `*.pages.dev` siguen funcionando, pero apuntan su canonical al dominio.

## Proteger staging (recomendado)

Staging ya lleva `noindex`, pero sigue siendo público para quien tenga el enlace. Para que solo lo vean los admins,
ponerle Cloudflare Access (Zero Trust -> Access -> Applications), con la misma política que Fluxa Studio.

## Volver a una versión anterior

Dashboard -> Workers & Pages -> el proyecto -> Deployments -> menú del deploy anterior -> **Rollback to this deployment**.
Es inmediato y no requiere recompilar.

## Notas

- Cada deploy genera además una URL única (`https://<hash>.fluxa-website.pages.dev`) que sirve para compartir esa versión exacta.
- El build corre `astro check`; si hay errores de tipos, el deploy se detiene.
- El aviso `DEP0190` de Node al desplegar es inofensivo.
