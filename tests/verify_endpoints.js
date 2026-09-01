process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { createApp } from '../src/api/app.js';
import { runSeed } from '../src/data/seed.js';

async function verifyEndpoints() {
  console.log('====================================================');
  console.log('  RFSP Core Platform v1 — HTTP Endpoint Verification');
  console.log('====================================================');

  let server = null;
  let targetBaseUrl = 'http://localhost:3000';

  // Check if server is already running on port 3000
  try {
    const probe = await fetch('http://localhost:3000/api/health');
    if (probe.ok) {
      console.log('[Probe] Live server detected on http://localhost:3000');
    }
  } catch (err) {
    // Start local test server
    console.log('[Probe] No running server detected on port 3000. Bootstrapping test server...');
    await runSeed();
    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        targetBaseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
    console.log(`[Probe] Ephemeral test server running at ${targetBaseUrl}`);
  }

  const tests = [
    { url: `${targetBaseUrl}/api/health`, expectStatus: 200, label: 'Health Check Endpoint' },
    { url: `${targetBaseUrl}/admin`, expectStatus: 200, label: 'Admin Experience Console' },
    { url: `${targetBaseUrl}/menu/downtown-flagship`, expectStatus: 200, label: 'Customer Digital Menu Page' },
    { url: `${targetBaseUrl}/api/v1/public/menu/downtown-flagship`, expectStatus: 200, label: 'Authoritative Public Menu API' },
    { url: `${targetBaseUrl}/api/v1/public/qr/resolve/QR_DT01_MAIN`, expectStatus: 200, label: 'Public QR Code Resolution API' },
    { url: `${targetBaseUrl}/qr/QR_DT01_MAIN`, expectStatus: 302, redirect: 'manual', label: 'Canonical QR URL 302 Redirect' }
  ];

  let passed = 0;
  for (const t of tests) {
    try {
      const res = await fetch(t.url, { redirect: t.redirect || 'follow' });
      const isPass = res.status === t.expectStatus;
      if (isPass) passed++;
      console.log(`[${isPass ? 'PASS' : 'FAIL'}] ${t.label}: ${t.url} -> Status ${res.status} (expected ${t.expectStatus})`);

      if (t.url.includes('/api/health')) {
        const healthData = await res.json();
        console.log(`   Health Payload: status=${healthData.status}, database=${healthData.database?.status}, uptime=${healthData.uptimeSeconds}s`);
      }
      if (t.url.includes('/api/v1/public/menu/downtown-flagship')) {
        const menuData = await res.json();
        console.log(`   Menu Payload: branch="${menuData.data?.branch?.name}", menusCount=${menuData.data?.menus?.length}`);
      }
    } catch (err) {
      console.log(`[FAIL] ${t.label}: ${t.url} -> Request Error: ${err.message}`);
    }
  }

  console.log(`\nEndpoint Verification Result: ${passed}/${tests.length} passed.`);

  if (server) {
    server.close();
  }

  if (passed !== tests.length) {
    process.exit(1);
  }
}

verifyEndpoints();
