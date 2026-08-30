import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.env.STATIC_SMOKE_PORT || 4173);
const origin = `http://127.0.0.1:${port}`;
const supportsProcessGroups = process.platform !== 'win32';
const webRoot = fileURLToPath(new URL('../apps/web/', import.meta.url));
const viteCli = fileURLToPath(new URL('../apps/web/node_modules/vite/bin/vite.js', import.meta.url));
const preview = spawn(
  process.execPath,
  [viteCli, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: webRoot, stdio: 'inherit', env: process.env, detached: supportsProcessGroups },
);

function signalPreview(signal) {
  if (supportsProcessGroups && preview.pid) process.kill(-preview.pid, signal);
  else preview.kill(signal);
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) throw new Error(`Preview server exited with code ${preview.exitCode}`);
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for the static preview server');
}

let browser;
try {
  await waitForPreview();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const apiRequests = [];
  const requestFailures = [];
  const pageErrors = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) apiRequests.push(url.pathname);
  });
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).origin === origin) {
      requestFailures.push(`${request.url()}: ${request.failure()?.errorText || 'request failed'}`);
    }
  });
  page.on('response', (response) => {
    if (new URL(response.url()).origin === origin && response.status() >= 400) {
      requestFailures.push(`${response.url()}: HTTP ${response.status()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1_000);
  const body = await page.locator('body').innerText();

  if (!response?.ok()) throw new Error(`Static startup returned HTTP ${response?.status()}`);
  if (apiRequests.length) throw new Error(`Static startup made API requests: ${apiRequests.join(', ')}`);
  if (requestFailures.length) throw new Error(`Static startup request failures: ${requestFailures.join('; ')}`);
  if (pageErrors.length) throw new Error(`Static startup page errors: ${pageErrors.join('; ')}`);
  if (!body.includes('Character Architect')) throw new Error('Static UI did not render');

  console.log('Static browser smoke passed: UI rendered with no API calls, request failures, or page errors.');
} finally {
  await browser?.close();
  if (preview.exitCode === null) {
    const exited = once(preview, 'exit');
    signalPreview('SIGTERM');
    const stopped = await Promise.race([
      exited.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    if (!stopped && preview.exitCode === null) {
      signalPreview('SIGKILL');
      await exited;
    }
  }
}
