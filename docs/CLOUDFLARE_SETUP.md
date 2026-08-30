# Cloudflare static deployment

Character Architect's browser-only build is deployed as a Cloudflare Worker with Static Assets. It is not a Node server and does not expose the Fastify API. Cards and settings are stored in that browser's IndexedDB and local storage.

## Production contract

- Worker name: `character-architect`
- Production URL: `https://ca.axailotl.ai`
- Build mode: `VITE_DEPLOYMENT_MODE=static`
- Asset directory: `apps/web/dist`
- SPA fallback: configured by `wrangler.toml`
- Toolchain used to build: Node 24 LTS and pnpm 11.24.0

The Node version affects dependency installation and the Vite build only. The deployed application executes in the browser and Cloudflare Workers runtime.

## Local validation and manual deployment

Authenticate once with `pnpm exec wrangler login`, then run:

```bash
corepack enable
corepack install --global pnpm@11.24.0
pnpm install --frozen-lockfile
pnpm build:packages
pnpm build:web:static
pnpm test:static-smoke
pnpm cf:deploy
```

Use `pnpm cf:deploy:dev` to deploy the `character-architect-dev` environment declared in `wrangler.toml`.

## GitHub Actions

The repository's `CI` workflow deploys pushes only after the quality and Docker-image jobs pass:

- `main` deploys the production Worker.
- `dev` deploys the `character-architect-dev` Worker.
- Pull requests build and test both container targets but do not deploy.

Configure these GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`: a narrowly scoped token that can edit this account's Workers scripts.
- `CLOUDFLARE_ACCOUNT_ID`: the owning Cloudflare account ID.
- `FOUNDRY_PAT`: only needed if the package registry requires authentication.

## Custom domain and rollback

Manage `ca.axailotl.ai` under the Worker's Settings → Domains & Routes page. Deployment history and rollback are available under the Worker's Deployments page. Keep the previous working deployment until the production smoke checks below pass.

## Production smoke checks

After deployment:

1. Open the root URL and a nested SPA route.
2. Confirm the browser console has no failed same-origin `/api` startup request.
3. Create and reload a disposable browser-local card.
4. Validate and preview a browser backup.
5. Confirm an existing browser profile still loads its cards and settings.

The full Docker deployment remains separate at `http://<docker-host-ip>:8765` (and `http://127.0.0.1:8765` locally); Cloudflare does not provide its server-only RAG, ComfyUI, web-import, or server proxy features.
