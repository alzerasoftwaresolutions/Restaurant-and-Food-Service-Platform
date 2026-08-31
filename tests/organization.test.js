import test from 'node:test';
import assert from 'node:assert/strict';
import { organizationService } from '../src/core/organization/organizationService.js';
import { runSeed } from '../src/data/seed.js';

test('Organization Management — Business Domain Suite', async (t) => {
  await runSeed();

  const uniqueSuffix = Date.now();
  const testSlug = `verdant-grill-${uniqueSuffix}`;
  let createdRestaurant = null;

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
    const branch = await organizationService.createBranch({
      restaurantId: createdRestaurant.id,
      name: 'North Uptown Branch',
      code: `NU_${uniqueSuffix.toString().slice(-4)}`,
      addressLine1: '789 Uptown Parkway',
      city: 'Chicago',
      country: 'USA'
    });

    assert.ok(branch.id);
    assert.equal(branch.restaurant_id, createdRestaurant.id);
    assert.equal(branch.status, 'Active');
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
  });
});
