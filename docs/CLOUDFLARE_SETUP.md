# Cloudflare Pages Setup

This guide sets up automatic deployments to Cloudflare Pages for both production and dev environments.

## Architecture

```
GitHub Branch → Cloudflare Pages Deployment
───────────────────────────────────────────
main → Production (ca.axailotl.ai)
dev  → Preview (dev.character-architect.pages.dev)
```

## Prerequisites

- Cloudflare account with Pages access
- GitHub repository connected to Cloudflare
- Wrangler CLI (optional, for local deployments)

## Setup Steps

### 1. Install Wrangler (Optional)

```bash
npm install -g wrangler
wrangler login
```

### 2. Create Cloudflare Pages Project

Using Cloudflare Dashboard:

1. Go to https://dash.cloudflare.com/
2. Navigate to **Workers & Pages** → **Create application** → **Pages**
3. Connect to Git:
   - Select your GitHub account
   - Choose repository: `axAilotl/character-architect`
4. Configure build settings:
   - **Production branch**: `main`
   - **Build command**: `pnpm run build:packages && pnpm --filter @card-architect/web run build`
   - **Build output directory**: `apps/web/dist`
   - **Root directory**: `/`
5. Environment variables (optional):
   ```
   VITE_DEPLOYMENT_MODE=static
   ```
6. Click **Save and Deploy**

### 3. Set Up Custom Domain (Production)

1. In Pages project settings → **Custom domains**
2. Add custom domain: `ca.axailotl.ai`
3. Follow DNS setup instructions
4. Wait for SSL certificate provisioning

### 4. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

#### Required Secrets:

1. **`CLOUDFLARE_API_TOKEN`**
   ```bash
   # Create API token at: https://dash.cloudflare.com/profile/api-tokens
   # Template: "Edit Cloudflare Workers"
   # Or custom token with permissions:
   # - Account > Cloudflare Pages > Edit
   ```

2. **`CLOUDFLARE_ACCOUNT_ID`**
   ```bash
   # Find at: https://dash.cloudflare.com/
   # In the right sidebar under "Account ID"
   ```

3. **`FOUNDRY_PAT`** (if not already added)
   ```bash
   # GitHub Personal Access Token with read:packages scope
   # For accessing @character-foundry/* packages
   ```

### 5. Enable GitHub Actions

The workflow `.github/workflows/deploy-pages.yml` will automatically:
- Deploy `main` branch to **production** (ca.axailotl.ai)
- Deploy `dev` branch to **preview** (auto-generated URL)

### 6. Verify Deployment

After pushing to `main` or `dev`:

1. Check GitHub Actions tab for deployment status
2. View deployment in Cloudflare Pages dashboard
3. Access deployed site:
   - Production: https://ca.axailotl.ai
   - Dev preview: Check Cloudflare dashboard or GitHub Actions logs

## Environment URLs

| Branch | Environment | URL | Deployment |
|--------|------------|-----|------------|
| `main` | Production | https://ca.axailotl.ai | Auto on push |
| `dev` | Preview | https://dev.character-architect.pages.dev | Auto on push |
| `feature/*` | PR Preview | Auto-generated | On PR to dev/main |

## Manual Deployment

### Using Wrangler CLI

```bash
# Build the static site
pnpm run build:packages
pnpm --filter @card-architect/web run build

# Deploy to Cloudflare Pages
wrangler pages deploy apps/web/dist --project-name=character-architect
```

### Deploy Specific Branch

```bash
# Deploy main (production)
git checkout main
pnpm run build:packages
pnpm --filter @card-architect/web run build
wrangler pages deploy apps/web/dist --project-name=character-architect --branch=main

# Deploy dev (preview)
git checkout dev
pnpm run build:packages
pnpm --filter @card-architect/web run build
wrangler pages deploy apps/web/dist --project-name=character-architect --branch=dev
```

## Rollback Deployments

### Via Cloudflare Dashboard

1. Go to Pages project → **Deployments**
2. Find previous successful deployment
3. Click **⋯** → **Rollback to this deployment**

### Via Wrangler

```bash
# List deployments
wrangler pages deployment list --project-name=character-architect

# Rollback to specific deployment
wrangler pages deployment rollback <deployment-id> --project-name=character-architect
```

## Environment Variables

Set in Cloudflare Pages dashboard: **Settings → Environment variables**

### Production (`main` branch)

```bash
VITE_DEPLOYMENT_MODE=static
NODE_VERSION=20
```

### Preview (`dev` branch)

```bash
VITE_DEPLOYMENT_MODE=static
NODE_VERSION=20
```

## Troubleshooting

### Build Failures

**Problem**: Build fails with package install errors

**Solution**:
```bash
# Test build locally first
pnpm install --frozen-lockfile
pnpm run build:packages
pnpm --filter @card-architect/web run build

# Check Cloudflare build logs for specific errors
# Ensure GITHUB_TOKEN or FOUNDRY_PAT is set if using private packages
```

### Custom Domain Not Working

**Problem**: ca.axailotl.ai not resolving

**Solution**:
1. Check DNS records in Cloudflare dashboard
2. Ensure CNAME points to `character-architect.pages.dev`
3. Wait for DNS propagation (up to 24 hours)
4. Verify SSL certificate is active

### Deploy to Wrong Environment

**Problem**: Dev code deployed to production

**Solution**:
```bash
# Deployments are branch-based:
# - main branch → production
# - dev branch → preview
# - Ensure you pushed to correct branch

# Check current branch
git branch

# Rollback in Cloudflare dashboard if needed
```

## Branch-Based Deployments

Cloudflare Pages automatically creates deployments based on branch:

- **Production deployment**: Only `main` branch
- **Preview deployments**: All other branches (`dev`, `feature/*`, etc.)
- **PR previews**: Automatic for pull requests

Each preview deployment gets a unique URL:
```
https://<branch-name>.character-architect.pages.dev
```

## Deployment Status

Check deployment status:

1. **GitHub Actions**: https://github.com/axAilotl/character-architect/actions
2. **Cloudflare Dashboard**: https://dash.cloudflare.com/ → Pages → character-architect
3. **Deployment logs**: Available in both GitHub Actions and Cloudflare

## Security

- API tokens have minimal required permissions
- Tokens stored as GitHub encrypted secrets
- No sensitive data in build logs
- Static site (no server-side secrets)

## Cost

- Cloudflare Pages Free Tier:
  - Unlimited requests
  - Unlimited bandwidth
  - 500 builds/month
  - 100 custom domains

## Next Steps

1. **Create Cloudflare Pages project** (Step 2 above)
2. **Add GitHub secrets** (Step 4 above)
3. **Configure custom domain** (Step 3 above)
4. **Push to trigger deployment**:
   ```bash
   git push origin main   # Deploy to production
   git push origin dev    # Deploy to preview
   ```

## Useful Commands

```bash
# Check Cloudflare account
wrangler whoami

# List Pages projects
wrangler pages project list

# View deployment logs
wrangler pages deployment tail --project-name=character-architect

# Delete preview deployment
wrangler pages deployment delete <deployment-id> --project-name=character-architect
```

## References

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions for Pages](https://github.com/cloudflare/pages-action)
