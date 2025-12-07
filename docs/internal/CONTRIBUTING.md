# Contributing to Card Architect

Thank you for your interest in contributing to Card Architect! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Git

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/card-architect.git
   cd card-architect
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start development servers:
   ```bash
   npm run dev
   ```

## Project Structure

```
card-architect/
├── apps/
│   ├── api/              # Backend API (Fastify + SQLite)
│   └── web/              # Frontend app (React + Vite)
├── packages/
│   ├── schemas/          # Shared TypeScript types
│   ├── tokenizers/       # Tokenizer adapters
│   ├── charx/            # CHARX support
│   └── plugins/          # Plugin SDK
├── docker/               # Docker configuration
└── package.json          # Root workspace config
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Define explicit types for function parameters and returns
- Avoid `any` types (use `unknown` if necessary)

### Code Style

- Run `npm run lint` before committing
- Follow existing code patterns
- Use meaningful variable and function names
- Keep functions small and focused

### Commits

- Write clear, descriptive commit messages
- Use present tense ("Add feature" not "Added feature")
- Reference issues in commit messages when applicable

## Testing

```bash
# Run all tests
npm test

# Run tests for specific package
npm test --workspace=@card-architect/schemas
```

## Pull Requests

### Before Submitting

1. Ensure all tests pass: `npm test`
2. Run linter: `npm run lint`
3. Check types: `npm run type-check`
4. Build packages: `npm run build`

### PR Guidelines

- Create a feature branch from `main`
- Keep PRs focused on a single feature or bug fix
- Include tests for new functionality
- Update documentation as needed
- Reference related issues in the PR description

### PR Template

```markdown
## Description
[Brief description of changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
[How was this tested?]

## Checklist
- [ ] Tests pass
- [ ] Linter passes
- [ ] Types check
- [ ] Documentation updated
```

## Feature Requests

- Check existing issues first
- Open a new issue with the "enhancement" label
- Provide clear use cases and examples
- Be open to discussion

## Bug Reports

### Before Reporting

- Check if the bug has already been reported
- Try to reproduce with the latest version
- Gather relevant information:
  - OS and version
  - Node.js version
  - Browser (for frontend issues)
  - Steps to reproduce

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. Ubuntu 22.04]
- Node.js: [e.g. 20.10.0]
- Browser: [e.g. Chrome 120]

**Additional context**
Any other relevant information.
```

## Adding Features

### New Packages

When adding a new package to `/packages/`:

1. Create package directory: `packages/my-feature/`
2. Add `package.json` with:
   ```json
   {
     "name": "@card-architect/my-feature",
     "version": "0.1.0",
     "type": "module",
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts"
   }
   ```
3. Add `tsconfig.json` extending root config
4. Export from `src/index.ts`

### API Endpoints

New API routes go in `apps/api/src/routes/`:

```typescript
import type { FastifyInstance } from 'fastify';

export async function myRoutes(fastify: FastifyInstance) {
  fastify.get('/my-endpoint', async (request, reply) => {
    return { message: 'Hello' };
  });
}
```

Register in `apps/api/src/index.ts`:

```typescript
await fastify.register(myRoutes);
```

### Frontend Components

Components go in `apps/web/src/components/`:

```typescript
interface MyComponentProps {
  title: string;
}

export function MyComponent({ title }: MyComponentProps) {
  return <div className="card">{title}</div>;
}
```

## Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for exported functions/classes
- Include examples in documentation
- Keep API reference up to date

## Release Process

(Maintainers only)

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions will build and publish

## Community

- Be respectful and inclusive
- Help others when you can
- Follow the Code of Conduct
- Ask questions in Discussions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Card Architect!
