# Modules (apps/web)

Modules are optional feature bundles that can register editor tabs and/or settings panels at runtime.

## Files and conventions

Each module lives in `apps/web/src/modules/<module-id>/` where `<module-id>` is **kebab-case** (example: `charx-optimizer`).

Required files:

- `apps/web/src/modules/<module-id>/metadata.ts`
  - Exports `MODULE_METADATA` (no side effects).
- `apps/web/src/modules/<module-id>/index.ts`
  - Exports `register<PascalCaseId>Module()` (and optionally `unregister…`).

Naming:

- Module ID: `charx-optimizer`
- Feature flag key (in `settings-store`): `charxOptimizerEnabled`
- Register function: `registerCharxOptimizerModule`

The feature-flag name is derived from the module id:

```ts
// charx-optimizer -> charxOptimizerEnabled
const flagName = `${moduleId.replace(/-([a-z])/g, (_, l) => l.toUpperCase())}Enabled`;
```

## Metadata (must be side-effect free)

`metadata.ts` is imported eagerly at app startup so the Settings UI can show toggles. It **must not** import code that performs runtime work (stores, network clients, registrations, etc.).

Example `metadata.ts`:

```ts
import type { ModuleDefinition } from '../../lib/registry/types';

export const MODULE_METADATA: ModuleDefinition = {
  id: 'my-module',
  name: 'My Module',
  description: 'What it does.',
  defaultEnabled: false,
  badge: 'Beta',
  color: 'blue',
  order: 50,
  requiresServer: false,
};
```

## Registration (runs only when enabled)

`index.ts` should only register things inside the exported `register…` function. Avoid any “do work on import” patterns.

Example `index.ts`:

```ts
import { lazy } from 'react';
import { registry } from '../../lib/registry';
import { useSettingsStore } from '../../store/settings-store';
export { MODULE_METADATA } from './metadata';

const MyPanel = lazy(() =>
  import('./components/MyPanel').then((m) => ({ default: m.MyPanel }))
);

export function registerMyModuleModule() {
  registry.registerTab({
    id: 'my-module',
    label: 'My Module',
    component: MyPanel,
    color: 'blue',
    order: 50,
    contexts: ['card'],
    condition: () => useSettingsStore.getState().features?.myModuleEnabled ?? false,
  });
}
```

## Server-only modules and deployment modes

If your module needs the API backend, set `requiresServer: true` in `MODULE_METADATA`.

- In `light` and `static` modes, server-only modules are never loaded.
- The module toggle stays visible but disabled (marked “Requires Server”).

If you want per-mode defaults, add an entry to:

- `apps/web/src/config/deployment.ts` → `DeploymentConfig.moduleDefaults`
- Update `FULL_CONFIG`, `LIGHT_CONFIG`, `STATIC_CONFIG`

## Testing checklist

- `npm run type-check --workspace @card-architect/web`
- `npm run build:web`
- Confirm disabled modules do not execute at startup (no side-effect logs, no network calls, no store init).

