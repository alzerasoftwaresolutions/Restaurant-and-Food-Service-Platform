import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/api/app.js';
import { runSeed } from '../src/data/seed.js';
import { queryOne } from '../src/data/db.js';

test('End-to-End Core Platform v1 Flow Suite', async (t) => {
  await runSeed();
  const app = createApp();

  let server;
  let baseUrl;

  // Helper for fetch requests against in-memory test server
  async function makeRequest(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, options);
    const json = await res.json();
    return { status: res.status, ok: res.ok, data: json };
  }

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  t.after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  let adminToken = null;
  const uniqueId = Date.now();
  let createdRestId = null;
  let createdBranchId = null;
  let createdBranchSlug = null;
  let createdMenuId = null;
  let createdCatId = null;
  let createdItemId = null;
  let createdQrCode = null;

  await t.test('0. Database Isolation Verification', async () => {
    const dbInfo = await queryOne('SELECT current_database() AS db_name');
    assert.ok(dbInfo, 'Must return current database');
    assert.ok(
      dbInfo.db_name === 'rfsp_core_v1_test' || dbInfo.db_name === 'rfsp_core_v1_test_memory',
      `Test suite must connect to isolated test database, but got: ${dbInfo.db_name}`
    );
    assert.notEqual(dbInfo.db_name, 'rfsp_core_v1', 'Test suite must NEVER connect to development database rfsp_core_v1');
  });

  await t.test('1. Admin Logs in via API', async () => {
    const res = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin', password: 'AdminPass123!' })
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.token);
    adminToken = res.data.data.token;
  });

  await t.test('2. Admin Creates Restaurant', async () => {
    const res = await makeRequest('/api/v1/restaurants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: `E2E Gourmet Dining ${uniqueId}`,
        slug: `e2e-gourmet-${uniqueId}`,
        legalName: 'E2E Foods LLC',
        currency: 'USD',
        status: 'Active'
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    createdRestId = res.data.data.id;
    assert.ok(createdRestId);
  });

  await t.test('3. Admin Creates Branch', async () => {
    const res = await makeRequest('/api/v1/branches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        restaurantId: createdRestId,
        name: `Harbor Branch ${uniqueId}`,
        code: `HB_${uniqueId.toString().slice(-4)}`,
        slug: `harbor-branch-${uniqueId}`,
        addressLine1: '123 Harbor Pier',
        city: 'Seattle',
        country: 'USA',
        status: 'Active'
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    createdBranchId = res.data.data.id;
    createdBranchSlug = res.data.data.slug;
    assert.ok(createdBranchId);
  });

  await t.test('4. Admin Creates Menu', async () => {
    const res = await makeRequest('/api/v1/menus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        restaurantId: createdRestId,
        name: 'Grand Dinner Menu',
        description: 'Finest seafood and cuts',
        status: 'Active'
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    createdMenuId = res.data.data.id;
    assert.ok(createdMenuId);
  });

  await t.test('5. Admin Creates Category', async () => {
    const res = await makeRequest('/api/v1/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        menuId: createdMenuId,
        name: 'Seafood Specialties',
        displayOrder: 1
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    createdCatId = res.data.data.id;
    assert.ok(createdCatId);
  });

  await t.test('6. Admin Creates Menu Item', async () => {
    const res = await makeRequest('/api/v1/menu-items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        categoryId: createdCatId,
        name: 'King Salmon Risotto',
        price: 36.00,
        description: 'Wild king salmon, arborio rice, lemon zest, chives',
        dietaryFlags: 'Gluten-Free',
        isAvailable: 1
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    createdItemId = res.data.data.id;
    assert.ok(createdItemId);
  });

  await t.test('7. Admin Assigns Menu to Branch', async () => {
    const res = await makeRequest('/api/v1/menu-assignments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        menuId: createdMenuId,
        branchId: createdBranchId,
        isActive: 1
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
  });

  await t.test('8. Admin Generates QR Code for Branch', async () => {
    const res = await makeRequest('/api/v1/qr-codes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        branchId: createdBranchId,
        title: 'Harbor Branch Table QR'
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    createdQrCode = res.data.data.code;
    assert.ok(createdQrCode);
  });

  await t.test('9. Customer Resolves QR Code and Accesses Digital Menu', async () => {
    // 9a. Test QR Resolution endpoint (Zero-auth)
    const qrRes = await makeRequest(`/api/v1/public/qr/resolve/${createdQrCode}`);
    assert.equal(qrRes.status, 200);
    assert.equal(qrRes.data.success, true);
    assert.equal(qrRes.data.data.branchSlug, createdBranchSlug);

    // 9b. Test Public Menu API (Zero-auth)
    const menuRes = await makeRequest(`/api/v1/public/menu/${createdBranchSlug}`);
    assert.equal(menuRes.status, 200);
    assert.equal(menuRes.data.success, true);
    assert.equal(menuRes.data.isPublished, true);
    assert.equal(menuRes.data.data.branch.name, `Harbor Branch ${uniqueId}`);

    const salmonItem = menuRes.data.data.menus[0].categories[0].items[0];
    assert.equal(salmonItem.name, 'King Salmon Risotto');
    // Monetary Contract: Exact decimal string representation ("36.00")
    assert.equal(salmonItem.price, '36.00');
    assert.equal(salmonItem.dietary_flags, 'Gluten-Free');
  });

  await t.test('10. Audit History Records Administrative Actions', async () => {
    const auditRes = await makeRequest('/api/v1/audit-logs', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.equal(auditRes.status, 200);
    assert.ok(auditRes.data.data.length > 0);
    const actions = auditRes.data.data.map(a => a.action);
    assert.ok(actions.includes('RESTAURANT_CREATE'));
    assert.ok(actions.includes('BRANCH_CREATE'));
    assert.ok(actions.includes('MENU_CREATE'));
    assert.ok(actions.includes('QR_CREATE'));
  });
});
