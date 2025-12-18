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
 * - Metadata export: MODULE_METADATA (ModuleDefinition)
 *
 * Deployment modes affect default module states:
 * - 'full': All modules enabled by default
 * - 'light': ComfyUI disabled (no server-side image gen)
 * - 'static': ComfyUI, webimport, wwwyzzerdd disabled
 */

import { useSettingsStore } from '../store/settings-store';
import { registry } from './registry';
import type { ModuleDefinition } from './registry/types';
import { getModuleDefault, deploymentConfig } from '../config/deployment';
import { registerCoreTabs } from '../features/editor/tabs';
import { registerCoreSettingsPanels } from '../features/settings/index';

/**
 * Auto-discover all modules using Vite's glob import
 * Returns a record of module path -> lazy loader
 */
const moduleLoaders = import.meta.glob('../modules/*/index.ts');

/**
 * Eagerly import module metadata from all modules
 * This allows us to show module toggles before modules are loaded
 */
const moduleMetadata = import.meta.glob<{ MODULE_METADATA?: ModuleDefinition }>(
  '../modules/*/index.ts',
  { eager: true }
);

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

/**
 * Register all module metadata from discovered modules
 * This runs eagerly at startup to populate the registry with module info
 */
function registerAllModuleMetadata(): void {
  const isLightMode = deploymentConfig.mode === 'light' || deploymentConfig.mode === 'static';

  for (const [path, exports] of Object.entries(moduleMetadata)) {
    const metadata = exports.MODULE_METADATA;
    if (metadata) {
      // Skip server-only modules in light/static mode (they require backend functionality)
      if (isLightMode && metadata.requiresServer) {
        console.log(`[Modules] Skipping ${metadata.id} in ${deploymentConfig.mode} mode (requiresServer: true)`);
        continue;
      }
      registry.registerModule(metadata);
      console.log(`[Modules] Registered metadata: ${metadata.id}`);
    } else {
      // Module doesn't export metadata - that's okay, it just won't have a toggle
      const id = getModuleId(path);
      console.log(`[Modules] No metadata for: ${id} (will not show toggle)`);
    }
  }
}

// Track which modules have been loaded to avoid double-loading
const loadedModules = new Set<string>();

/**
 * Load core features (always loaded)
 */
async function loadCoreFeatures(): Promise<void> {
  registerCoreTabs();
  registerCoreSettingsPanels();
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

    // Check feature flag, falling back to deployment config then module's default
    const flagValue = features[module.featureFlag];
    if (flagValue !== undefined) {
      return flagValue === true;
    }

    // Check deployment config for module defaults
    const deploymentDefault = getModuleDefault(module.id);
    if (deploymentDefault === false) {
      // Deployment config explicitly disables this module
      return false;
    }

    // Use module's default from metadata
    const metadata = registry.getModule(module.id);
    return metadata?.defaultEnabled ?? false;
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
  console.log('[Modules] Deployment mode:', deploymentConfig.mode);
  console.log('[Modules] Discovered:', getDiscoveredModules().map((m) => m.id).join(', '));

  // Register all module metadata first (for Settings toggles)
  registerAllModuleMetadata();

  // Load core features
  await loadCoreFeatures();

  // Then load optional modules based on feature flags
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
