/**
 * Browser shim for Node.js 'module' module
 *
 * The @character-foundry/core package includes fflate which tries to use Node.js's
 * 'module.createRequire' for worker threads. This is not available in browsers.
 * This shim provides a no-op implementation to prevent runtime errors.
 */

export function createRequire(_filename: string) {
  // Return a fake require function that throws if called
  return (id: string) => {
    throw new Error(
      `Cannot require('${id}') in browser environment. ` +
      `The module system is not available in browsers.`
    );
  };
}

// Default export for compatibility
export default {
  createRequire,
};
