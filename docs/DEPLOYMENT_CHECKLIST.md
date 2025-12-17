# Deployment Checklist

This checklist covers the manual steps required to complete the deployment setup for Character Architect.

## ✅ Completed

- [x] Created dev branch and pushed to GitHub
- [x] Set up branch protection for `main` (requires 1 approval, status checks)
- [x] Set up branch protection for `dev` (requires 0 approvals, status checks)
- [x] Created CI workflow (`.github/workflows/ci.yml`)
- [x] Created Cloudflare Pages deployment workflow (`.github/workflows/deploy-pages.yml`)
- [x] Created dev Docker environment (`docker/docker-compose.dev.yml`)
- [x] Created documentation for dev workflow, Cloudflare setup, and GitHub config
- [x] Created Cloudflare Pages project `character-architect` (production)
- [x] Created Cloudflare Pages project `character-architect-dev` (dev)

## 🔴 Manual Steps Required

### 1. Add GitHub Repository Secrets

You need to add the following secrets via GitHub web UI or using `gh secret set`:

**Settings → Secrets and variables → Actions → New repository secret**

#### Required Secrets:

1. **`FOUNDRY_PAT`**
   ```bash
   # GitHub Personal Access Token with read:packages scope
   # For accessing @character-foundry/* packages
   # Generate at: https://github.com/settings/tokens/new
   gh secret set FOUNDRY_PAT
   ```

2. **`CLOUDFLARE_API_TOKEN`**
   ```bash
   # Create API token at: https://dash.cloudflare.com/profile/api-tokens
   # Template: "Edit Cloudflare Workers"
   # Or custom token with permissions: Account > Cloudflare Pages > Edit
   gh secret set CLOUDFLARE_API_TOKEN
   ```

3. **`CLOUDFLARE_ACCOUNT_ID`**
   ```bash
   # Find at: https://dash.cloudflare.com/ (right sidebar under "Account ID")
   gh secret set CLOUDFLARE_ACCOUNT_ID
   ```

### 2. Configure Custom Domain (Production)

1. In Cloudflare Pages project settings → **Custom domains**
2. Add custom domain: `ca.axailotl.ai`
3. Follow DNS setup instructions
4. Wait for SSL certificate provisioning (can take a few minutes)

### 3. Verify Deployments

After secrets and Cloudflare project are set up:

1. **Trigger CI**: Push a commit to `dev` or `main`
   ```bash
   git checkout dev
   # Make a change
   git commit -m "test: trigger CI"
   git push origin dev
   ```

2. **Check CI Status**: https://github.com/axAilotl/character-architect/actions

3. **Check Cloudflare Deployment**:
   - Main (production): https://ca.axailotl.ai (after custom domain setup)
   - Dev (preview): Check Cloudflare dashboard for auto-generated URL

## 📋 Quick Commands

```bash
# Add secrets (you'll be prompted for values)
gh secret set FOUNDRY_PAT
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID

# List secrets (won't show values)
gh secret list

# Start dev environment
docker compose -f docker/docker-compose.dev.yml up -d

# Check CI status
gh run list --limit 5

# View CI logs
gh run view --log

# Trigger workflow manually
gh workflow run deploy-pages.yml
```

## 🌐 Environment URLs

| Branch | Environment | URL | Port (Docker) | Data Directory |
|--------|------------|-----|---------------|----------------|
| `main` | Production | https://ca.axailotl.ai | 8765 | `data/`, `storage/` |
| `dev` | Dev | https://character-architect-dev.pages.dev | 8766 | `data-dev/`, `storage-dev/` |

## 🔧 Troubleshooting

### CI Failing on Package Install

**Error**: `pnpm install` fails with authentication error

**Solution**: Verify `FOUNDRY_PAT` secret is set correctly with `read:packages` scope

### Cloudflare Deployment Failing

**Error**: Cloudflare Pages action fails

**Solution**:
1. Verify `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set
2. Verify Cloudflare Pages project exists and is named `character-architect`
3. Check token permissions include Cloudflare Pages Edit

### Custom Domain Not Resolving

**Error**: ca.axailotl.ai not accessible

**Solution**:
1. Check DNS records in Cloudflare dashboard
2. Ensure CNAME points to `character-architect.pages.dev`
3. Wait for DNS propagation (up to 24 hours)
4. Verify SSL certificate is active

## 📚 Reference Docs

- [DEV_WORKFLOW.md](./DEV_WORKFLOW.md) - Development workflow and branch strategy
- [CLOUDFLARE_SETUP.md](./CLOUDFLARE_SETUP.md) - Detailed Cloudflare Pages setup
- [.github/README.md](../.github/README.md) - GitHub configuration details
