// Polyfill process for Node.js libraries running in browser
if (typeof globalThis.process === 'undefined') {
  (globalThis as any).process = {
    env: {
      NODE_ENV: 'production',
    },
    version: '',
    platform: 'browser',
  };
}

export {};
