import test from 'node:test';
import assert from 'node:assert/strict';
import { menuRepository } from '../src/data/repositories/menuRepository.js';
import { organizationService } from '../src/core/organization/organizationService.js';
import { menuService } from '../src/core/menu/menuService.js';
import { runSeed } from '../src/data/seed.js';

test('Authoritative Customer Menu Publishing Rules Suite', async (t) => {
  await runSeed();

  await t.test('publishes active branch with assigned active menus and available items', async () => {
    const pub = await menuRepository.getPublishedBranchMenu('downtown-flagship');
    assert.equal(pub.found, true);
    assert.equal(pub.isPublished, true);
    assert.equal(pub.branch.name, 'Downtown Flagship');
    assert.ok(pub.menus.length > 0, 'Should contain active menus');

    // Confirm that the unavailable item (Truffle Fries seeded as is_available=0) is filtered out
    const allItems = pub.menus.flatMap(m => m.categories.flatMap(c => c.items));
    const truffleFries = allItems.find(i => i.name === 'Hand-Cut Truffle Herb Fries');
    assert.equal(truffleFries, undefined, 'Unavailable items must not be presented to customers');

    // Confirm available items are included
    const burrata = allItems.find(i => i.name === 'Truffle Pugliese Burrata');
    assert.ok(burrata, 'Available items must be presented');
  });

  await t.test('blocks public menu when branch status is Inactive', async () => {
    await organizationService.setBranchStatus('brn_downtown', 'Inactive');

    const pub = await menuRepository.getPublishedBranchMenu('downtown-flagship');
    assert.equal(pub.found, true);
    assert.equal(pub.isPublished, false);
    assert.equal(pub.reason, 'BRANCH_INACTIVE');

    // Restore for subsequent tests
    await organizationService.setBranchStatus('brn_downtown', 'Active');
  });

  await t.test('blocks public menu when restaurant status is Inactive', async () => {
    await organizationService.setRestaurantStatus('rest_aura', 'Inactive');

    const pub = await menuRepository.getPublishedBranchMenu('downtown-flagship');
    assert.equal(pub.found, true);
    assert.equal(pub.isPublished, false);
    assert.equal(pub.reason, 'RESTAURANT_INACTIVE');

    // Restore for subsequent tests
    await organizationService.setRestaurantStatus('rest_aura', 'Active');
  });

  await t.test('excludes inactive or archived menus from public presentation', async () => {
    // Set all-day menu to Archived
    await menuService.setMenuStatus('menu_allday', 'Archived');

    const pub = await menuRepository.getPublishedBranchMenu('downtown-flagship');
    assert.equal(pub.isPublished, true);

    const publishedMenuNames = pub.menus.map(m => m.name);
    assert.ok(!publishedMenuNames.includes('All-Day Dining Menu'), 'Archived menu must not be published');
    assert.ok(publishedMenuNames.includes('Weekend Brunch & Bakery'), 'Active assigned menu must remain published');

    // Restore menu status
    await menuService.setMenuStatus('menu_allday', 'Active');
  });
});
