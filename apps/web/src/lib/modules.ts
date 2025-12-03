/**
 * Module Loader
 *
 * Auto-discovers and loads modules from the modules directory.
 * Modules are loaded based on feature flags derived from folder names.
 *
 * Convention:
 * - Folder: modules/{module-id}/index.ts
 * - Feature flag: {camelCaseId}Enabled (e.g., blockEditorEnabled)
 * - Register function: register{PascalCaseId}Module (e.g., registerBlockEditorModule)
 */

import { useSettingsStore } from '../store/settings-store';

/**
 * Auto-discover all modules using Vite's glob import
 * Returns a record of module path -> lazy loader
 */
const moduleLoaders = import.meta.glob('../modules/*/index.ts');

/**
 * Convert kebab-case to camelCase
 * e.g., "block-editor" -> "blockEditor"
 */
function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert kebab-case to PascalCase
 * e.g., "block-editor" -> "BlockEditor"
 */
function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Extract module ID from path
 * e.g., "../modules/block-editor/index.ts" -> "block-editor"
 */
function getModuleId(path: string): string {
  const match = path.match(/\.\.\/modules\/([^/]+)\/index\.ts$/);
  return match ? match[1] : '';
}

/**
 * Get discovered modules with their metadata
 */
export function getDiscoveredModules(): Array<{
  id: string;
  featureFlag: string;
  registerFn: string;
  path: string;
}> {
  return Object.keys(moduleLoaders).map((path) => {
    const id = getModuleId(path);
    const camelId = toCamelCase(id);
    const pascalId = toPascalCase(id);
    return {
      id,
      featureFlag: `${camelId}Enabled`,
      registerFn: `register${pascalId}Module`,
      path,
    };
  });
}

// Track which modules have been loaded to avoid double-loading
const loadedModules = new Set<string>();

/**
 * Load core features (always loaded)
 */
async function loadCoreFeatures(): Promise<void> {
  const { registerCoreTabs } = await import('../features/editor/tabs');
  registerCoreTabs();
}

/**
 * Load optional modules based on feature flags
 */
async function loadOptionalModules(): Promise<void> {
  const { features } = useSettingsStore.getState();
  const modules = getDiscoveredModules();

  // Filter to enabled modules that haven't been loaded yet
  const enabledModules = modules.filter((module) => {
    if (loadedModules.has(module.id)) return false;
    return features[module.featureFlag] === true;
  });

  // Load enabled modules in parallel
  await Promise.all(
    enabledModules.map(async (module) => {
      try {
        const loader = moduleLoaders[module.path];
        const moduleExports = (await loader()) as Record<string, unknown>;

        // Call the register function
        const registerFn = moduleExports[module.registerFn];
        if (typeof registerFn === 'function') {
          registerFn();
          loadedModules.add(module.id);
          console.log(`[Modules] Loaded: ${module.id}`);
        } else {
          console.warn(`[Modules] ${module.id}: register function "${module.registerFn}" not found`);
        }
      } catch (err) {
        console.error(`[Modules] Failed to load ${module.id}:`, err);
      }
    })
  );
}

/**
 * Initialize all modules
 *
 * Call this during application bootstrap, before rendering.
 */
export async function initializeModules(): Promise<void> {
  console.log('[Modules] Initializing...');
  console.log('[Modules] Discovered:', getDiscoveredModules().map((m) => m.id).join(', '));

  // Load core features first
  await loadCoreFeatures();

  // Then load optional modules
  await loadOptionalModules();

  console.log('[Modules] Initialization complete');
}

/**
 * Re-check and load any newly enabled modules
 *
 * Call this when feature flags change to dynamically load new modules.
 * Note: This does not unload disabled modules (requires page refresh).
 */
export async function reloadModules(): Promise<void> {
  await loadOptionalModules();
}
