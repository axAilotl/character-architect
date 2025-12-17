# GitHub Configuration

## Workflows

### CI (`workflows/ci.yml`)

Runs on every push and pull request to `main` and `dev` branches.

**Jobs:**
1. **lint-and-test** - Build and test all packages
2. **docker-build** - Verify Docker images build successfully

**Required Secrets:**
- `FOUNDRY_PAT` - GitHub Personal Access Token for accessing `@character-foundry/*` packages

## Branch Protection Rules

### Setting Up (Manual Steps)

After pushing the `dev` branch, configure branch protection in GitHub:

**Repository → Settings → Branches → Add rule**

#### Rule: `main`
- Branch name pattern: `main`
- ✅ Require a pull request before merging
  - ✅ Require approvals: **1**
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Status checks to require: `lint-and-test`, `docker-build`
- ✅ Do not allow bypassing the above settings

#### Rule: `dev`
- Branch name pattern: `dev`
- ✅ Require a pull request before merging
  - ⬜ Require approvals: **0** (allows faster iteration)
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Status checks to require: `lint-and-test`, `docker-build`
- ✅ Do not allow bypassing the above settings

## Secrets Setup

Add the following secrets in **Repository → Settings → Secrets and variables → Actions**:

### Required for CI

- **`FOUNDRY_PAT`**
  - Description: GitHub Personal Access Token for @character-foundry packages
  - Permissions needed: `read:packages`
  - Generate at: https://github.com/settings/tokens/new
    - Select scopes: `read:packages`
    - Set expiration as needed
    - Generate token
    - Copy token value
    - Add to repository secrets

### Required for Cloudflare Pages Deployment

- **`CLOUDFLARE_API_TOKEN`**
  - Description: API token for Cloudflare Pages deployments
  - Create at: https://dash.cloudflare.com/profile/api-tokens
  - Template: "Edit Cloudflare Workers"
  - Or custom with permissions: Account > Cloudflare Pages > Edit

- **`CLOUDFLARE_ACCOUNT_ID`**
  - Description: Your Cloudflare account ID
  - Find at: https://dash.cloudflare.com/ (right sidebar)

## Deployment

### Dev Environment

- **Trigger**: Push to `dev` branch
- **URL**: Configure in your deployment platform
- **Data**: Uses `data-dev/` and `storage-dev/` directories

### Production

- **Trigger**: Push to `main` branch
- **URL**: https://ca.axailotl.ai (or your production domain)
- **Data**: Uses `data/` and `storage/` directories

## Troubleshooting

### CI Failing on Package Install

**Problem**: `pnpm install` fails with authentication error for @character-foundry packages

**Solution**: Verify `FOUNDRY_PAT` secret is set correctly:
1. Token must have `read:packages` scope
2. Token must not be expired
3. Secret name must be exactly `FOUNDRY_PAT`

### Status Checks Not Appearing

**Problem**: Branch protection can't find `lint-and-test` or `docker-build` checks

**Solution**:
1. Wait for CI to run at least once on the branch
2. Status checks only appear after their first run
3. Create a test PR to trigger CI
4. Then configure branch protection

### Docker Build Fails

**Problem**: `docker-build` job fails

**Solution**:
1. Check Dockerfile syntax
2. Ensure all COPY paths exist
3. Test locally: `docker build --target api .`
4. Check Docker build logs in Actions tab
