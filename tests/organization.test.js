import test from 'node:test';
import assert from 'node:assert/strict';
import { organizationService } from '../src/core/organization/organizationService.js';
import { menuService } from '../src/core/menu/menuService.js';
import { runSeed } from '../src/data/seed.js';

test('Organization Management — Business Domain Suite', async (t) => {
  await runSeed();

  const uniqueSuffix = Date.now();
  const testSlug = `verdant-grill-${uniqueSuffix}`;
  let createdRestaurant = null;
  let createdBranch = null;

  await t.test('creates restaurant with active status and slug', async () => {
    createdRestaurant = await organizationService.createRestaurant({
      name: `Verdant Garden Grill ${uniqueSuffix}`,
      slug: testSlug,
      legalName: 'Verdant Dining Corp',
      description: 'Organic farm-to-table dining',
      currency: 'USD'
    });

    assert.ok(createdRestaurant.id);
    assert.equal(createdRestaurant.slug, testSlug);
    assert.equal(createdRestaurant.status, 'Active');
  });

  await t.test('enforces unique restaurant slug', async () => {
    await assert.rejects(
      async () => {
        await organizationService.createRestaurant({
          name: 'Duplicate Verdant',
          slug: testSlug
        });
      },
      { message: /already exists/ }
    );
  });

  await t.test('creates branch belonging to parent restaurant', async () => {
    createdBranch = await organizationService.createBranch({
      restaurantId: createdRestaurant.id,
      name: 'North Uptown Branch',
      code: `NU_${uniqueSuffix.toString().slice(-4)}`,
      addressLine1: '789 Uptown Parkway',
      city: 'Chicago',
      country: 'USA'
    });

    assert.ok(createdBranch.id);
    assert.equal(createdBranch.restaurant_id, createdRestaurant.id);
    assert.equal(createdBranch.status, 'Active');
  });

  await t.test('rejects branch without parent restaurant', async () => {
    await assert.rejects(
      async () => {
        await organizationService.createBranch({
          restaurantId: null,
          name: 'Orphan Branch',
          code: 'ORPH',
          addressLine1: '123 St',
          city: 'City',
          country: 'USA'
        });
      },
      { message: /must belong to a restaurant/ }
    );
  });

  await t.test('updates branch lifecycle status to Inactive', async () => {
    const branches = await organizationService.listBranchesByRestaurant(createdRestaurant.id);
    const branch = branches[0];

    const updated = await organizationService.setBranchStatus(branch.id, 'Inactive');
    assert.equal(updated.status, 'Inactive');

    const retrieved = await organizationService.getBranch(branch.id);
    assert.equal(retrieved.status, 'Inactive');

    // Restore to Active
    await organizationService.setBranchStatus(branch.id, 'Active');
  });

  await t.test('listAllBranches loads successfully with assigned_menu_count (fixes Unknown alias defect)', async () => {
    const branches = await organizationService.listBranchesByRestaurant(createdRestaurant.id);
    const branch = branches[0];
    assert.ok(branch, 'Branch should exist');

    // Create menu and assign to branch
    const menu = await menuService.createMenu({
      restaurantId: createdRestaurant.id,
      name: 'Tasting Menu'
    });
    await menuService.assignMenuToBranch({ menuId: menu.id, branchId: branch.id });

    const allBranches = await organizationService.listAllBranches();
    assert.ok(allBranches.length > 0);

    const targetBranch = allBranches.find(b => b.id === branch.id);
    assert.ok(targetBranch, 'Branch must be present in listAllBranches');
    assert.equal(targetBranch.restaurant_name, `Verdant Garden Grill ${uniqueSuffix}`);
    assert.equal(targetBranch.assigned_menu_count, 1, 'Assigned menu count must equal 1');
  });
});
