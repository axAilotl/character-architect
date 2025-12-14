/**
 * Plugin capability types
 */
export type PluginCapability =
  | 'format'
  | 'transform'
  | 'validate'
  | 'generate'
  | 'import'
  | 'export';

/**
 * Plugin context for runtime
 */
export interface PluginContext {
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  config: Record<string, unknown>;
}

/**
 * Plugin interface
 */
export interface Plugin {
  name: string;
  version: string;
  description?: string;
  capabilities: PluginCapability[];
  run(input: unknown, ctx: PluginContext): Promise<unknown>;
}

/**
 * Plugin manager for Character Architect
 */
export class PluginManager {
  private plugins = new Map<string, Plugin>();

  /**
   * Register a plugin
   */
  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Unregister a plugin
   */
  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  /**
   * Get a plugin by name
   */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * List all plugins
   */
  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Find plugins by capability
   */
  findByCapability(capability: PluginCapability): Plugin[] {
    return this.list().filter((p) => p.capabilities.includes(capability));
  }

  /**
   * Run a plugin
   */
  async run(name: string, input: unknown, config?: Record<string, unknown>): Promise<unknown> {
    const plugin = this.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }

    const ctx: PluginContext = {
      logger: {
        info: (msg: string) => console.log(`[${name}] ${msg}`),
        warn: (msg: string) => console.warn(`[${name}] ${msg}`),
        error: (msg: string) => console.error(`[${name}] ${msg}`),
      },
      config: config || {},
    };

    return plugin.run(input, ctx);
  }
}

// Export singleton instance
export const pluginManager = new PluginManager();
