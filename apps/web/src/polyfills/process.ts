// Polyfill process for Node.js libraries running in browser
const browserGlobal = globalThis as typeof globalThis & {
  process?: { env: { NODE_ENV: string }; version: string; platform: string };
};

if (typeof browserGlobal.process === 'undefined') {
  browserGlobal.process = {
    env: {
      NODE_ENV: 'production',
    },
    version: '',
    platform: 'browser',
  };
}

export {};
