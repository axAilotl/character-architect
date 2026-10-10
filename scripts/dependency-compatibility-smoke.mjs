import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { once } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const { default: katex } = await import(require.resolve('katex'));
const { micromark } = await import(require.resolve('micromark'));
const { math, mathHtml } = await import(require.resolve('micromark-extension-math'));

// Exercise ONNX's actual proxy helper, including its scoped compatibility patch.
const { bootstrap } = require(
  require.resolve('global-agent', { paths: [require.resolve('onnxruntime-node')] })
);
const certificateDirectory = mkdtempSync(path.join(tmpdir(), 'architect-proxy-smoke-'));
const certPath = path.join(certificateDirectory, 'server.crt');
const keyPath = path.join(certificateDirectory, 'server.key');
let cert, key;
try {
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost',
    ],
    { stdio: 'ignore' }
  );
  cert = readFileSync(certPath);
  key = readFileSync(keyPath);
} finally {
  rmSync(certificateDirectory, { recursive: true, force: true });
}
const target = https.createServer({ key, cert }, (req, res) => res.end('proxy smoke'));
const proxy = http.createServer();
const sniNames = [];
target.on('secureConnection', (socket) => sniNames.push(socket.servername));
const sockets = new Set();
let connects = 0;
proxy.on('connect', (req, client, head) => {
  connects++;
  const [hostname, port] = req.url.split(':');
  const remote = net.connect(Number(port), hostname, () => {
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    remote.write(head);
    remote.pipe(client);
    client.pipe(remote);
  });
  sockets.add(remote);
  sockets.add(client);
  remote.on('error', () => client.destroy());
  client.on('error', () => remote.destroy());
});
target.listen(0, 'localhost');
proxy.listen(0, '127.0.0.1');
await Promise.all([once(target, 'listening'), once(proxy, 'listening')]);
process.env.GLOBAL_AGENT_HTTPS_PROXY = `http://127.0.0.1:${proxy.address().port}`;
process.env.GLOBAL_AGENT_NO_PROXY = '';
bootstrap();
const url = `https://localhost:${target.address().port}/cuda-fixture.tgz`;
function get(options = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, options, (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk));
      response.on('end', () => resolve(data));
    });
    request.on('error', reject);
    request.setTimeout(3000, () => request.destroy(new Error('timeout')));
  });
}
try {
  assert.equal(await get({ ca: cert }), 'proxy smoke');
  assert.equal(connects, 1);
  assert.equal(sniNames[0], 'localhost');
  await assert.rejects(get(), (e) =>
    ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN'].includes(e.code)
  );
  assert.equal(connects, 2);
  global.GLOBAL_AGENT.NO_PROXY = 'localhost';
  assert.equal(await get({ ca: cert }), 'proxy smoke');
  assert.equal(connects, 2);
  console.log(
    'ONNX proxy helper: named CJS bootstrap, HTTPS CONNECT, CA validation, SNI, NO_PROXY passed'
  );
} finally {
  for (const socket of sockets) socket.destroy();
  https.globalAgent.destroy?.();
  http.globalAgent.destroy?.();
  await Promise.all([new Promise((r) => target.close(r)), new Promise((r) => proxy.close(r))]);
}
for (const [input, displayMode] of [
  ['a^2 + b^2 = c^2', false],
  ['\\frac{1}{2}+\\sqrt{x}', true],
]) {
  const output = katex.renderToString(input, { displayMode, throwOnError: false });
  assert.match(output, /class="katex"/);
  assert.match(output, /<math/);
  assert.doesNotMatch(output, /katex-error/);
}
const html = micromark('Inline $a^2+b^2=c^2$\n\n$$\n\\frac{1}{2} + \\sqrt{x}\n$$', {
  extensions: [math()],
  htmlExtensions: [mathHtml()],
});
assert.match(html, /math-inline/);
assert.match(html, /math-display/);
assert.match(html, /katex/);
assert.doesNotMatch(html, /katex-error/);
const poisoned = Object.create({ trust: true });
poisoned.throwOnError = false;
assert.doesNotMatch(katex.renderToString('\\href{javascript:alert(1)}{x}', poisoned), /href=/);
assert.match(katex.renderToString('{', { throwOnError: false }), /katex-error/);
console.log(
  'KaTeX: inline/block rendering, micromark math integration, untrusted URL/prototype guard, invalid-command fallback passed'
);
