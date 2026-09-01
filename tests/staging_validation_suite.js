import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/api/app.js';
import { runSeed } from '../src/data/seed.js';
import { getDb, queryOne, queryAll, checkDbHealth, closeDb } from '../src/data/db.js';
import { config, validateConfig } from '../src/config/appConfig.js';
import { identityService } from '../src/platform/identity/identityService.js';
import { organizationService } from '../src/core/organization/organizationService.js';
import { menuService } from '../src/core/menu/menuService.js';
import { qrService } from '../src/core/qr/qrService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('=== RFSP Core Platform v1 — Comprehensive Staging Validation Suite ===', async (t) => {
  console.log('\n--- 1. Initializing Staging Environment & Database ---');
  await runSeed();
  validateConfig();

  const app = createApp();
  let server;
  let baseUrl;

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  t.after(async () => {
    server.close();
    await closeDb();
  });

  async function api(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    const res = await fetch(url, options);
    let json = null;
    try {
      json = await res.json();
    } catch {
      // Non-JSON response
    }
    return { status: res.status, ok: res.ok, headers: res.headers, data: json };
  }

  let adminToken = null;
  let managerToken = null;
  const unique = Date.now();

  // --------------------------------------------------------------------------
  // Area 1: Deployment & Health Check Verification
  // --------------------------------------------------------------------------
  await t.test('1. Deployment & Health Verification: GET /api/health', async () => {
    const res = await api('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'UP');
    assert.equal(res.data.unit, 'Core Platform v1');
    assert.equal(res.data.database.status, 'UP');
    assert.ok(res.data.uptimeSeconds >= 0);
    // Verify no sensitive database credentials leaked
    assert.equal(res.data.database.password, undefined);
    assert.equal(res.data.database.connectionString, undefined);
  });

  // --------------------------------------------------------------------------
  // Area 2: PostgreSQL Database & Migration Verification
  // --------------------------------------------------------------------------
  await t.test('2. PostgreSQL Database Verification', async () => {
    const health = await checkDbHealth();
    assert.equal(health.status, 'UP');
    assert.ok(health.latencyMs >= 0);

    const migrations = await queryAll('SELECT version FROM schema_migrations ORDER BY version ASC');
    assert.ok(migrations.length > 0, 'Schema migrations table must record applied migrations');
    assert.ok(migrations.some(m => m.version === '001_initial_core_schema.sql'));

    const tables = [
      'users', 'roles', 'user_roles', 'restaurants', 'branches',
      'menus', 'categories', 'menu_items', 'menu_branch_assignments',
      'qr_codes', 'media_assets', 'audit_logs', 'configuration'
    ];
    for (const tbl of tables) {
      const row = await queryOne(`SELECT COUNT(*) AS count FROM ${tbl}`);
      assert.ok(row !== null, `Table ${tbl} must be accessible`);
    }
  });

  // --------------------------------------------------------------------------
  // Area 3: Authentication & RBAC Platform Service
  // --------------------------------------------------------------------------
  await t.test('3. Authentication & RBAC Verification', async (sub) => {
    await sub.test('3.1 Valid Admin Login', async () => {
      const res = await api('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'admin', password: 'AdminPass123!' })
      });
      assert.equal(res.status, 200);
      assert.ok(res.data.data.token);
      assert.equal(res.data.data.user.username, 'admin');
      assert.ok(res.data.data.user.roles.includes('admin'));
      adminToken = res.data.data.token;
    });

    await sub.test('3.2 Valid Manager Login', async () => {
      const res = await api('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'manager', password: 'ManagerPass123!' })
      });
      assert.equal(res.status, 200);
      assert.ok(res.data.data.token);
      assert.equal(res.data.data.user.username, 'manager');
      assert.ok(res.data.data.user.roles.includes('manager'));
      managerToken = res.data.data.token;
    });

    await sub.test('3.3 Invalid Password Rejection', async () => {
      const res = await api('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'admin', password: 'WrongPassword!' })
      });
      assert.equal(res.status, 401);
      assert.equal(res.data.error, 'Invalid credentials');
    });

    await sub.test('3.4 Unauthorized Request Blocking', async () => {
      const res = await api('/api/v1/restaurants');
      assert.equal(res.status, 401);
      assert.equal(res.data.success, false);
    });

    await sub.test('3.5 Password Change Workflow', async () => {
      const testUser = await identityService.createUser({
        username: `staging_user_${unique}`,
        email: `staging_${unique}@rfsp.local`,
        password: 'InitialPassword123!',
        fullName: 'Staging Test User'
      });

      const userAuth = await identityService.authenticate(testUser.username, 'InitialPassword123!');

      const res = await api('/api/v1/auth/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userAuth.token}`
        },
        body: JSON.stringify({
          currentPassword: 'InitialPassword123!',
          newPassword: 'NewSecurePassword123!'
        })
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
    });
  });

  // --------------------------------------------------------------------------
  // Area 4: Organization Management Business Domain
  // --------------------------------------------------------------------------
  let stagingRest = null;
  let stagingBranch = null;

  await t.test('4. Organization Management Domain', async (sub) => {
    await sub.test('4.1 Create Restaurant', async () => {
      const res = await api('/api/v1/restaurants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: `Solstice Artisan Kitchen ${unique}`,
          legalName: 'Solstice Dining Group LLC',
          slug: `solstice-kitchen-${unique}`,
          description: 'Contemporary wood-fired coastal cuisine.',
          currency: 'USD',
          phone: '+1 (555) 789-0123',
          email: 'info@solsticekitchen.local'
        })
      });
      assert.equal(res.status, 201);
      stagingRest = res.data.data;
      assert.equal(stagingRest.slug, `solstice-kitchen-${unique}`);
      assert.equal(stagingRest.status, 'Active');
    });

    await sub.test('4.2 Enforce Restaurant Slug Uniqueness', async () => {
      const res = await api('/api/v1/restaurants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Duplicate Slug Restaurant',
          slug: stagingRest.slug
        })
      });
      assert.equal(res.status, 400);
      assert.ok(res.data.error.includes('already exists'));
    });

    await sub.test('4.3 Create Branch with Parent Relationship', async () => {
      const res = await api('/api/v1/branches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          restaurantId: stagingRest.id,
          name: 'Marina Pier Branch',
          code: `MP_${unique.toString().slice(-4)}`,
          slug: `marina-pier-${unique}`,
          addressLine1: '800 Marina Boulevard',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94123',
          country: 'USA',
          phone: '+1 (555) 789-0124',
          openingHours: 'Mon-Sun: 11:00 - 22:00'
        })
      });
      assert.equal(res.status, 201);
      stagingBranch = res.data.data;
      assert.equal(stagingBranch.restaurant_id, stagingRest.id);
      assert.equal(stagingBranch.status, 'Active');
    });

    await sub.test('4.4 Update Branch Status Lifecycle', async () => {
      const res = await api(`/api/v1/branches/${stagingBranch.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'Inactive' })
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.data.status, 'Inactive');

      // Restore to Active
      const restoreRes = await api(`/api/v1/branches/${stagingBranch.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'Active' })
      });
      assert.equal(restoreRes.status, 200);
      assert.equal(restoreRes.data.data.status, 'Active');
    });
  });

  // --------------------------------------------------------------------------
  // Area 5: Menu Management Business Domain
  // --------------------------------------------------------------------------
  let stagingMenu = null;
  let stagingCategory = null;
  let stagingItem1 = null;
  let stagingItem2 = null;

  await t.test('5. Menu Management Domain', async (sub) => {
    await sub.test('5.1 Create Menu', async () => {
      const res = await api('/api/v1/menus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          restaurantId: stagingRest.id,
          name: 'Main Dining & Hearth Menu',
          description: 'Seasonal wood-fired selections',
          status: 'Active'
        })
      });
      assert.equal(res.status, 201);
      stagingMenu = res.data.data;
      assert.equal(stagingMenu.status, 'Active');
    });

    await sub.test('5.2 Create Categories and Reorder', async () => {
      const catRes1 = await api('/api/v1/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          menuId: stagingMenu.id,
          name: 'Raw Bar & Crudo',
          displayOrder: 1
        })
      });
      assert.equal(catRes1.status, 201);
      stagingCategory = catRes1.data.data;

      const catRes2 = await api('/api/v1/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          menuId: stagingMenu.id,
          name: 'Wood-Fired Hearth',
          displayOrder: 2
        })
      });
      assert.equal(catRes2.status, 201);

      // Test Category Reordering with categoryOrders array
      const reorderRes = await api('/api/v1/categories/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          categoryOrders: [
            { id: catRes2.data.data.id, displayOrder: 1 },
            { id: stagingCategory.id, displayOrder: 2 }
          ]
        })
      });
      assert.equal(reorderRes.status, 200);
    });

    await sub.test('5.3 Create Menu Items with Dietary & Allergen Metadata', async () => {
      const itemRes1 = await api('/api/v1/menu-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          categoryId: stagingCategory.id,
          name: 'Pacific King Salmon Crudo',
          description: 'Blood orange aguachile, pickled shallots, serrano chili, sea salt',
          price: 26.00,
          currency: 'USD',
          dietaryFlags: 'Gluten-Free, Dairy-Free',
          allergens: 'Fish',
          isAvailable: 1
        })
      });
      assert.equal(itemRes1.status, 201);
      stagingItem1 = itemRes1.data.data;
      assert.equal(stagingItem1.price, 26.00);

      // Create a second item intentionally marked Unavailable
      const itemRes2 = await api('/api/v1/menu-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          categoryId: stagingCategory.id,
          name: 'Wood-Grilled Spiny Lobster',
          description: 'Smoked garlic butter, charred Meyer lemon',
          price: 68.00,
          currency: 'USD',
          dietaryFlags: 'Gluten-Free',
          allergens: 'Crustacean, Dairy',
          isAvailable: 0 // UNAVAILABLE
        })
      });
      assert.equal(itemRes2.status, 201);
      stagingItem2 = itemRes2.data.data;
      assert.equal(stagingItem2.is_available, 0);
    });

    await sub.test('5.4 Toggle Item Availability Switch', async () => {
      const toggleRes = await api(`/api/v1/menu-items/${stagingItem1.id}/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ isAvailable: false })
      });
      assert.equal(toggleRes.status, 200);
      assert.equal(toggleRes.data.data.is_available, 0);

      // Restore availability
      const restoreRes = await api(`/api/v1/menu-items/${stagingItem1.id}/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ isAvailable: true })
      });
      assert.equal(restoreRes.status, 200);
      assert.equal(restoreRes.data.data.is_available, 1);
    });
  });

  // --------------------------------------------------------------------------
  // Area 6: Menu-Branch Assignments & Security Guardrails
  // --------------------------------------------------------------------------
  await t.test('6. Menu-Branch Assignments Matrix', async (sub) => {
    await sub.test('6.1 Assign Menu to Branch', async () => {
      const res = await api('/api/v1/menu-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          menuId: stagingMenu.id,
          branchId: stagingBranch.id,
          isActive: 1
        })
      });
      assert.equal(res.status, 201);
    });

    await sub.test('6.2 Reject Cross-Restaurant Assignment', async () => {
      // Create separate restaurant
      const otherRest = await organizationService.createRestaurant({
        name: `Isolated Dining ${unique}`,
        slug: `isolated-dining-${unique}`
      });
      const otherBranch = await organizationService.createBranch({
        restaurantId: otherRest.id,
        name: 'Isolated Branch',
        code: `IS_${unique.toString().slice(-4)}`,
        addressLine1: '999 Remote St',
        city: 'Remote',
        country: 'USA'
      });

      const crossRes = await api('/api/v1/menu-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          menuId: stagingMenu.id, // belongs to stagingRest
          branchId: otherBranch.id // belongs to otherRest
        })
      });
      assert.equal(crossRes.status, 400);
      assert.ok(crossRes.data.error.includes('different restaurant'));
    });
  });

  // --------------------------------------------------------------------------
  // Area 7: QR Publishing Core Capability
  // --------------------------------------------------------------------------
  let stagingQr = null;

  await t.test('7. QR Publishing Core Capability', async (sub) => {
    await sub.test('7.1 Generate QR Code for Branch', async () => {
      const res = await api('/api/v1/qr-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          branchId: stagingBranch.id,
          title: 'Marina Pier Primary Table QR'
        })
      });
      assert.equal(res.status, 201);
      stagingQr = res.data.data;
      assert.ok(stagingQr.code.startsWith('QR_MP_'));
      assert.ok(stagingQr.qr_image_data.startsWith('data:image/png;base64,'));
      assert.equal(stagingQr.status, 'Active');
    });

    await sub.test('7.2 Resolve Active QR Code (Zero-Auth API)', async () => {
      const res = await api(`/api/v1/public/qr/resolve/${stagingQr.code}`);
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.branchSlug, stagingBranch.slug);
    });

    await sub.test('7.3 Canonical HTTP 302 QR Redirect Handler', async () => {
      const res = await fetch(`${baseUrl}/qr/${stagingQr.code}`, { redirect: 'manual' });
      assert.equal(res.status, 302);
      assert.equal(res.headers.get('location'), `/menu/${stagingBranch.slug}`);
    });

    await sub.test('7.4 Reject Disabled QR Code', async () => {
      await qrService.setQRCodeStatus(stagingQr.id, 'Disabled');
      const res = await api(`/api/v1/public/qr/resolve/${stagingQr.code}`);
      assert.equal(res.status, 400);
      assert.equal(res.data.reason, 'QR_DISABLED');

      // Restore to Active
      await qrService.setQRCodeStatus(stagingQr.id, 'Active');
    });

    await sub.test('7.5 Reject Expired QR Code', async () => {
      await qrService.setQRCodeStatus(stagingQr.id, 'Expired');
      const res = await api(`/api/v1/public/qr/resolve/${stagingQr.code}`);
      assert.equal(res.status, 400);
      assert.equal(res.data.reason, 'QR_EXPIRED');

      // Restore to Active
      await qrService.setQRCodeStatus(stagingQr.id, 'Active');
    });
  });

  // --------------------------------------------------------------------------
  // Area 8: Customer Digital Menu & Authoritative Publishing Rules
  // --------------------------------------------------------------------------
  await t.test('8. Customer Digital Menu Presentation Rules', async (sub) => {
    await sub.test('8.1 Public Menu API returns published branch & items', async () => {
      const res = await api(`/api/v1/public/menu/${stagingBranch.slug}`);
      assert.equal(res.status, 200);
      assert.equal(res.data.isPublished, true);
      assert.equal(res.data.data.branch.name, 'Marina Pier Branch');
      assert.equal(res.data.data.branch.restaurantName, `Solstice Artisan Kitchen ${unique}`);

      const items = res.data.data.menus.flatMap(m => m.categories.flatMap(c => c.items));
      // Available item must be included
      const salmon = items.find(i => i.name === 'Pacific King Salmon Crudo');
      assert.ok(salmon, 'Available item must be presented');
      assert.equal(salmon.price, 26.00);

      // Unavailable item MUST NOT be presented
      const lobster = items.find(i => i.name === 'Wood-Grilled Spiny Lobster');
      assert.equal(lobster, undefined, 'Unavailable items must be filtered out for customers');
    });

    await sub.test('8.2 Inactive Branch Blocked from Public Menu', async () => {
      await organizationService.setBranchStatus(stagingBranch.id, 'Inactive');
      const res = await api(`/api/v1/public/menu/${stagingBranch.slug}`);
      assert.equal(res.status, 200);
      assert.equal(res.data.isPublished, false);
      assert.equal(res.data.reason, 'BRANCH_INACTIVE');

      // Restore
      await organizationService.setBranchStatus(stagingBranch.id, 'Active');
    });

    await sub.test('8.3 Inactive Restaurant Blocked from Public Menu', async () => {
      await organizationService.setRestaurantStatus(stagingRest.id, 'Inactive');
      const res = await api(`/api/v1/public/menu/${stagingBranch.slug}`);
      assert.equal(res.status, 200);
      assert.equal(res.data.isPublished, false);
      assert.equal(res.data.reason, 'RESTAURANT_INACTIVE');

      // Restore
      await organizationService.setRestaurantStatus(stagingRest.id, 'Active');
    });

    await sub.test('8.4 Archived Menu Excluded from Public Presentation', async () => {
      await menuService.setMenuStatus(stagingMenu.id, 'Archived');
      const res = await api(`/api/v1/public/menu/${stagingBranch.slug}`);
      assert.equal(res.status, 200);
      assert.equal(res.data.data.menus.length, 0, 'Archived menu must not be presented');

      // Restore
      await menuService.setMenuStatus(stagingMenu.id, 'Active');
    });
  });

  // --------------------------------------------------------------------------
  // Area 9: Media Management & Persistence Verification
  // --------------------------------------------------------------------------
  await t.test('9. Media Management & Storage Persistence', async () => {
    // 9.1 Upload Sample Media
    const uploadDir = config.media.uploadDir;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const testFileName = `staging_test_dish_${unique}.svg`;
    const testFilePath = path.join(uploadDir, testFileName);
    fs.writeFileSync(testFilePath, '<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="coral"/></svg>');

    // Record asset in repository
    const { mediaRepository } = await import('../src/data/repositories/mediaRepository.js');
    const asset = await mediaRepository.create({
      id: `med_test_${unique}`,
      originalFilename: 'dish.svg',
      storedFilename: testFileName,
      filePath: `/uploads/${testFileName}`,
      mimeType: 'image/svg+xml',
      fileSizeBytes: 256,
      assetType: 'item_image',
      altText: 'Staging Test Dish'
    });

    assert.ok(asset.id);

    // 9.2 Verify Media Accessibility over HTTP
    const mediaRes = await fetch(`${baseUrl}${asset.file_path}`);
    assert.equal(mediaRes.status, 200);
    const mediaText = await mediaRes.text();
    assert.ok(mediaText.includes('<svg'));

    // 9.3 Verify Persistence after Cache / Reference Flush
    assert.ok(fs.existsSync(testFilePath), 'Uploaded media file must persist on disk storage');
  });

  // --------------------------------------------------------------------------
  // Area 10: Audit Logging Platform Service
  // --------------------------------------------------------------------------
  await t.test('10. Audit Logging Verification', async () => {
    const res = await api('/api/v1/audit-logs', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.data.length > 0);

    const actions = res.data.data.map(log => log.action);
    assert.ok(actions.includes('RESTAURANT_CREATE'), 'Audit trail must record RESTAURANT_CREATE');
    assert.ok(actions.includes('BRANCH_CREATE'), 'Audit trail must record BRANCH_CREATE');
    assert.ok(actions.includes('MENU_CREATE'), 'Audit trail must record MENU_CREATE');
    assert.ok(actions.includes('QR_CREATE'), 'Audit trail must record QR_CREATE');
  });

  // --------------------------------------------------------------------------
  // Area 11: Performance Baseline Benchmark (p95 measurements)
  // --------------------------------------------------------------------------
  await t.test('11. Performance Baseline Benchmarking', async () => {
    console.log('\n--- Performance Baseline Measurements ---');

    async function benchmark(label, fn, iterations = 20) {
      const times = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fn();
        times.push(performance.now() - start);
      }
      times.sort((a, b) => a - b);
      const p50 = times[Math.floor(iterations * 0.50)].toFixed(2);
      const p95 = times[Math.floor(iterations * 0.95)].toFixed(2);
      const avg = (times.reduce((a, b) => a + b, 0) / iterations).toFixed(2);
      console.log(`  ✔ ${label.padEnd(35)}: avg = ${avg.padStart(6)} ms | p50 = ${p50.padStart(6)} ms | p95 = ${p95.padStart(6)} ms`);
      return { p50, p95, avg };
    }

    // 11.1 Health check
    const healthBench = await benchmark('GET /api/health', () => api('/api/health'));
    assert.ok(parseFloat(healthBench.p95) < 100, 'Health check p95 should be < 100ms');

    // 11.2 Public menu
    const menuBench = await benchmark('GET /api/v1/public/menu/:slug', () => api(`/api/v1/public/menu/${stagingBranch.slug}`));
    assert.ok(parseFloat(menuBench.p95) < 100, 'Public menu p95 should be < 100ms');

    // 11.3 QR resolution
    const qrBench = await benchmark('GET /api/v1/public/qr/resolve/:code', () => api(`/api/v1/public/qr/resolve/${stagingQr.code}`));
    assert.ok(parseFloat(qrBench.p95) < 100, 'QR resolution p95 should be < 100ms');

    // 11.4 Admin login
    const loginBench = await benchmark('POST /api/v1/auth/login', () => api('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin', password: 'AdminPass123!' })
    }), 5);
    assert.ok(parseFloat(loginBench.p95) < 500, 'Admin login p95 should be < 500ms (BCrypt cost 10)');

    // 11.5 List menus
    const listMenusBench = await benchmark('GET /api/v1/menus', () => api('/api/v1/menus', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }));
    assert.ok(parseFloat(listMenusBench.p95) < 100, 'List menus p95 should be < 100ms');
  });

  console.log('\n====================================================');
  console.log('  Staging Validation Suite: ALL TESTS COMPLETED');
  console.log('====================================================');
});
