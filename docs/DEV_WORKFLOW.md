# Development Workflow

## Branch Strategy

```
feature/* → dev → main
            ↓      ↓
         DEV    PROD
```

### Branches

- **`main`** - Production branch (https://ca.axailotl.ai)
  - Protected: Requires PR, CI pass, 1 approval
  - Auto-deploys to production
  - Stable, tested code only

- **`dev`** - Development branch (dev environment)
  - Protected: Requires PR, CI pass, no approval required
  - Auto-deploys to dev environment
  - Integration testing, faster iteration

- **`feature/*`** - Feature branches
  - Created from `dev`
  - Merged back to `dev` via PR

## Workflow

### 1. Starting New Work

```bash
# Ensure you're on dev and up to date
git checkout dev
git pull origin dev

# Create feature branch
git checkout -b feature/your-feature-name
```

### 2. Development

```bash
# Make changes
git add .
git commit -m "feat: your feature"

# Push to GitHub
git push origin feature/your-feature-name
```

### 3. Pull Request to Dev

- Create PR from `feature/your-feature-name` → `dev`
- CI must pass (build + tests)
- No approval required (faster iteration)
- Merge when green

### 4. Testing in Dev Environment

- Dev environment auto-deploys from `dev` branch
- Test your changes at dev URL
- Report issues, iterate on `dev` branch if needed

### 5. Promoting to Production

```bash
# When dev is stable and ready for production
git checkout main
git pull origin main
git merge dev
git push origin main
```

Or create PR from `dev` → `main`:
- Requires 1 approval
- CI must pass
- Deploys to production when merged

## Environments

### Development (dev branch)

**Docker Compose:**
```bash
# Start dev environment
docker compose -f docker/docker-compose.dev.yml up -d

# View logs
docker compose -f docker/docker-compose.dev.yml logs -f

# Stop
docker compose -f docker/docker-compose.dev.yml down
```

**URLs:**
- Web: http://localhost:8766
- API: http://localhost:3457/health

**Data:**
- Database: `./data-dev/cards.db`
- Storage: `./storage-dev/`

### Production (main branch)

**Docker Compose:**
```bash
# Start production
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

**URLs:**
- Web: http://localhost:8765
- API: Internal only (via nginx)

**Data:**
- Database: `./data/cards.db`
- Storage: `./storage/`

## CI/CD

### Continuous Integration

GitHub Actions runs on every push and PR:

1. **Lint and Test**
   - Install dependencies
   - Build packages, API, web
   - Run unit tests

2. **Docker Build**
   - Build API and Web images
   - Verify Docker builds succeed

### Deployment

- **Dev**: Auto-deploys from `dev` branch
- **Prod**: Auto-deploys from `main` branch

## Branch Protection Rules

### Setup (Manual)

After creating the `dev` branch on GitHub:

1. Go to repository **Settings** → **Branches**
2. Add protection rules:

#### Rule for `main`:
- ✅ Require a pull request before merging
- ✅ Require approvals: 1
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - Select: `lint-and-test`, `docker-build`
- ✅ Require branches to be up to date before merging

#### Rule for `dev`:
- ✅ Require a pull request before merging
- ⬜ Require approvals: 0 (faster iteration)
- ✅ Require status checks to pass before merging
  - Select: `lint-and-test`, `docker-build`
- ✅ Require branches to be up to date before merging

## Best Practices

### Commits

- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- Keep commits atomic and focused
- Write clear commit messages

### Pull Requests

- Describe what changed and why
- Link related issues
- Test locally before creating PR
- Ensure CI passes before requesting review

### Testing

- Run tests locally before pushing: `pnpm test`
- Build locally to catch errors: `pnpm run build`
- Test in dev environment before promoting to prod

### Data Safety

- Dev and prod environments use separate databases
- Dev data is in `./data-dev/`, prod in `./data/`
- Never commit `.env.local` or data directories
- Back up production data regularly

## Troubleshooting

### CI Failing

```bash
# Run the same checks locally
pnpm install --frozen-lockfile
pnpm run build:packages
pnpm run build:api
pnpm run build:web
pnpm test
```

### Docker Issues

```bash
# Clean rebuild
docker compose -f docker/docker-compose.dev.yml down -v
docker system prune -a
docker compose -f docker/docker-compose.dev.yml build --no-cache
docker compose -f docker/docker-compose.dev.yml up -d
```

### Database Issues

```bash
# Dev database is separate - safe to delete
rm -rf ./data-dev/
docker compose -f docker/docker-compose.dev.yml restart api

# Production - BE CAREFUL
# Always back up first
cp -r ./data ./data-backup-$(date +%Y%m%d)
```

## Initial Setup

### 1. Create Dev Branch

```bash
# From main branch
git checkout main
git pull
git checkout -b dev
git push -u origin dev
```

### 2. Set Up Branch Protection

Follow the "Branch Protection Rules" section above in GitHub settings.

### 3. Configure Secrets

Add to GitHub repository secrets:
- `FOUNDRY_PAT` - GitHub token for accessing @character-foundry packages

### 4. Test CI

Create a test PR to `dev` and verify CI runs successfully.

### 5. Set Up Dev Environment

```bash
# Start dev docker containers
docker compose -f docker/docker-compose.dev.yml up -d

# Verify health
curl http://localhost:3457/health
curl http://localhost:8766/
```

## Migration from Current Setup

Since we're adding this workflow to an existing repository:

1. **Create `dev` branch from current `main`**
   ```bash
   git checkout main
   git pull
   git checkout -b dev
   git push -u origin dev
   ```

2. **Add branch protection rules** (see above)

3. **For ongoing work:**
   - Move all new development to feature branches off `dev`
   - Test in dev environment
   - Promote stable `dev` to `main` for production
