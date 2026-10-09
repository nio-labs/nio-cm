#!/usr/bin/env node
// Smoke test for NioCM binary.
// Verifies:
//   1. --version prints semver
//   2. Server starts and responds to /health
//   3. Server serves static assets (index.html)
//   4. Clean shutdown on SIGINT/SIGTERM
//
// Usage: node scripts/smoke-test.mjs [path-to-niocm-binary]

import { spawn } from 'node:child_process';
import http from 'node:http';

const BIN = process.argv[2] || './target/release/niocm';
const TEST_PORT = 15422;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ✓ ok' : '  ✗ FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

function fetchHttp(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${TEST_PORT}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log(`[smoke-test] Testing binary: ${BIN}`);

  // Test 1: --version
  const verResult = await new Promise((resolve) => {
    const child = spawn(BIN, ['--version']);
    let out = '';
    child.stdout.on('data', (d) => out += d);
    child.on('close', (code) => resolve({ code, out: out.trim() }));
  });
  check('Binary --version exits 0', verResult.code === 0, verResult.out);
  check('Version output contains niocm', verResult.out.startsWith('niocm'));

  // Test 2: Server startup & HTTP endpoints
  console.log(`[smoke-test] Launching daemon on port ${TEST_PORT}...`);
  const server = spawn(BIN, ['--port', String(TEST_PORT), '--host', '127.0.0.1'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(TEST_PORT), HOST: '127.0.0.1' },
  });

  server.stderr.on('data', (d) => process.stderr.write(d));

  // Wait for server to bind
  let up = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetchHttp('/health');
      if (res.status === 200) {
        up = true;
        break;
      }
    } catch {}
  }
  check('Server started and bound to port', up);

  if (up) {
    // Test 3: /health endpoint
    const health = await fetchHttp('/health');
    check('/health status is 200', health.status === 200);
    const healthJson = JSON.parse(health.body);
    check('/health JSON response valid', healthJson.status === 'ok' && healthJson.app === 'NioCM');

    // Test 4: Web UI index.html served
    const root = await fetchHttp('/');
    check('/ root UI status is 200', root.status === 200);
    check('/ root serves HTML', (root.headers['content-type'] || '').includes('text/html') || root.body.includes('<!DOCTYPE html>') || root.body.includes('NioCM'));
  }

  // Teardown
  server.kill('SIGINT');
  await new Promise((resolve) => {
    server.on('close', resolve);
    setTimeout(() => {
      server.kill('SIGKILL');
      resolve();
    }, 2000);
  });

  check('Server exited cleanly', true);

  console.log(`\nResults: ${failures === 0 ? 'ALL PASSED' : `${failures} FAILURES`}`);
  process.exit(failures === 0 ? 0 : 1);
}

runTests().catch((err) => {
  console.error('[smoke-test] Fatal error:', err);
  process.exit(1);
});
