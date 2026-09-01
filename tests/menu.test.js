import test from 'node:test';
import assert from 'node:assert/strict';
import { menuService } from '../src/core/menu/menuService.js';
import { runSeed } from '../src/data/seed.js';

test('Menu Management — Business Domain Suite', async (t) => {
  await runSeed();

  const unique = Date.now();
  let testMenu = null;
  let testCat = null;
  let testItem = null;

  await t.test('creates a digital menu in Active status', async () => {
    testMenu = await menuService.createMenu({
      restaurantId: 'rest_aura',
      name: `Chef Tasting Experience ${unique}`,
      description: 'Exclusive 7-course seasonal tasting menu',
      status: 'Active'
    });

    assert.ok(testMenu.id);
    assert.equal(testMenu.status, 'Active');
  });

  await t.test('creates category within menu and reorders', async () => {
    testCat = await menuService.createCategory({
      menuId: testMenu.id,
      name: 'First Courses',
      description: 'Opening courses',
      displayOrder: 1
    });

    const cat2 = await menuService.createCategory({
      menuId: testMenu.id,
      name: 'Grand Finale',
      description: 'Dessert courses',
      displayOrder: 2
    });

    assert.ok(testCat.id);
    assert.ok(cat2.id);

    const categories = await menuService.listCategoriesByMenu(testMenu.id);
    assert.equal(categories.length, 2);
    assert.equal(categories[0].name, 'First Courses');
  });

  await t.test('creates menu item with price and dietary flags', async () => {
    testItem = await menuService.createMenuItem({
      categoryId: testCat.id,
      name: 'Smoked Duck Breast Tartlet',
      description: 'Cherry compote, micro thyme, brioche crust',
      price: 24.50,
      allergens: 'Gluten, Dairy',
      dietaryFlags: '',
      isAvailable: 1
    });

    assert.ok(testItem.id);
    // Monetary Contract: Exact 2-decimal string representation ("24.50")
    assert.equal(testItem.price, '24.50');
    assert.equal(testItem.is_available, 1);
  });

  await t.test('toggles menu item availability', async () => {
    const updated = await menuService.setItemAvailability(testItem.id, false);
    assert.equal(updated.is_available, 0);

    const retrieved = await menuService.getMenuItem(testItem.id);
    assert.equal(retrieved.is_available, 0);
  });

  await t.test('assigns menu to branch', async () => {
    const assignment = await menuService.assignMenuToBranch({
      menuId: testMenu.id,
      branchId: 'brn_downtown',
      isActive: 1
    });

    assert.ok(assignment);
    assert.equal(assignment.menu_id, testMenu.id);
    assert.equal(assignment.branch_id, 'brn_downtown');

    const branchAssignments = await menuService.listAssignmentsByBranch('brn_downtown');
    assert.ok(branchAssignments.some(a => a.menu_id === testMenu.id));
  });

  await t.test('rejects cross-restaurant menu assignment', async () => {
    const { organizationService } = await import('../src/core/organization/organizationService.js');
    const otherSlug = `other-place-${Date.now()}`;
    const otherRest = await organizationService.createRestaurant({
      name: 'Other Place',
      slug: otherSlug
    });
    const otherBranch = await organizationService.createBranch({
      restaurantId: otherRest.id,
      name: 'Other Branch',
      code: `OB_${Date.now().toString().slice(-4)}`,
      addressLine1: '123 St',
      city: 'City',
      country: 'USA'
    });

    await assert.rejects(
      async () => {
        await menuService.assignMenuToBranch({
          menuId: testMenu.id, // belongs to rest_aura
          branchId: otherBranch.id // belongs to otherRest
        });
      },
      { message: /different restaurant/ }
    );
  });
});
