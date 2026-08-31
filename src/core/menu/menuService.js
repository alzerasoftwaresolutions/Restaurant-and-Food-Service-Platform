import { randomUUID } from 'node:crypto';
import { menuRepository } from '../../data/repositories/menuRepository.js';
import { organizationRepository } from '../../data/repositories/organizationRepository.js';

/**
 * Menu Management — Business Domain Service
 */
export const menuService = {
  // --- Menus ---
  async getMenu(id) {
    const menu = await menuRepository.findMenuById(id);
    if (!menu) {
      throw new Error(`Menu not found with ID: ${id}`);
    }
    return menu;
  },

  async listMenusByRestaurant(restaurantId) {
    return menuRepository.listMenusByRestaurant(restaurantId);
  },

  async listAllMenus() {
    return menuRepository.listAllMenus();
  },

  async createMenu({ restaurantId, name, description, status = 'Active' }) {
    if (!restaurantId || !name) {
      throw new Error('Restaurant ID and menu name are required');
    }

    const rest = await organizationRepository.findRestaurantById(restaurantId);
    if (!rest) {
      throw new Error(`Parent restaurant not found with ID: ${restaurantId}`);
    }

    const id = `menu_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    return menuRepository.createMenu({
      id,
      restaurantId,
      name,
      description,
      status
    });
  },

  async updateMenu(id, updates) {
    await this.getMenu(id);
    return menuRepository.updateMenu(id, updates);
  },

  async setMenuStatus(id, status) {
    if (!['Active', 'Inactive', 'Archived'].includes(status)) {
      throw new Error(`Invalid menu status: ${status}. Allowed: Active, Inactive, Archived`);
    }
    await this.getMenu(id);
    return menuRepository.setMenuStatus(id, status);
  },

  // --- Categories ---
  async getCategory(id) {
    const cat = await menuRepository.findCategoryById(id);
    if (!cat) {
      throw new Error(`Category not found with ID: ${id}`);
    }
    return cat;
  },

  async listCategoriesByMenu(menuId) {
    await this.getMenu(menuId);
    return menuRepository.listCategoriesByMenu(menuId);
  },

  async createCategory({ menuId, name, description, displayOrder = 0 }) {
    if (!menuId || !name) {
      throw new Error('Menu ID and category name are required');
    }
    await this.getMenu(menuId);

    const id = `cat_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    return menuRepository.createCategory({
      id,
      menuId,
      name,
      description,
      displayOrder: parseInt(displayOrder, 10) || 0
    });
  },

  async updateCategory(id, updates) {
    await this.getCategory(id);
    return menuRepository.updateCategory(id, updates);
  },

  async deleteCategory(id) {
    await this.getCategory(id);
    await menuRepository.deleteCategory(id);
    return { success: true, deletedId: id };
  },

  async reorderCategories(categoryOrders) {
    if (!Array.isArray(categoryOrders) || categoryOrders.length === 0) {
      throw new Error('categoryOrders array is required');
    }
    await menuRepository.reorderCategories(categoryOrders);
    return { success: true };
  },

  // --- Menu Items ---
  async getMenuItem(id) {
    const item = await menuRepository.findMenuItemById(id);
    if (!item) {
      throw new Error(`Menu item not found with ID: ${id}`);
    }
    return item;
  },

  async listMenuItemsByCategory(categoryId) {
    await this.getCategory(categoryId);
    return menuRepository.listMenuItemsByCategory(categoryId);
  },

  async listMenuItemsByMenu(menuId) {
    await this.getMenu(menuId);
    return menuRepository.listMenuItemsByMenu(menuId);
  },

  async createMenuItem({
    categoryId,
    name,
    description,
    price,
    currency = 'USD',
    dietaryFlags,
    allergens,
    mediaId,
    isAvailable = 1,
    displayOrder = 0
  }) {
    if (!categoryId || !name || price === undefined || price === null) {
      throw new Error('Category ID, item name, and price are required');
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      throw new Error('Price must be a valid non-negative number');
    }

    await this.getCategory(categoryId);

    const id = `item_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    return menuRepository.createMenuItem({
      id,
      categoryId,
      name,
      description,
      price: priceNum,
      currency,
      dietaryFlags,
      allergens,
      mediaId,
      isAvailable: isAvailable ? 1 : 0,
      displayOrder: parseInt(displayOrder, 10) || 0
    });
  },

  async updateMenuItem(id, updates) {
    await this.getMenuItem(id);

    if (updates.price !== undefined) {
      const priceNum = parseFloat(updates.price);
      if (isNaN(priceNum) || priceNum < 0) {
        throw new Error('Price must be a valid non-negative number');
      }
      updates.price = priceNum;
    }

    if (updates.categoryId) {
      await this.getCategory(updates.categoryId);
    }

    return menuRepository.updateMenuItem(id, updates);
  },

  async deleteMenuItem(id) {
    await this.getMenuItem(id);
    await menuRepository.deleteMenuItem(id);
    return { success: true, deletedId: id };
  },

  async setItemAvailability(id, isAvailable) {
    await this.getMenuItem(id);
    return menuRepository.setItemAvailability(id, isAvailable);
  },

  // --- Menu-Branch Assignments ---
  async assignMenuToBranch({ menuId, branchId, isActive = 1 }) {
    if (!menuId || !branchId) {
      throw new Error('Menu ID and branch ID are required');
    }

    const menu = await this.getMenu(menuId);
    const branch = await organizationRepository.findBranchById(branchId);
    if (!branch) {
      throw new Error(`Branch not found with ID: ${branchId}`);
    }

    // Cross-organization protection
    if (menu.restaurant_id !== branch.restaurant_id) {
      throw new Error('Cannot assign menu to a branch belonging to a different restaurant');
    }

    const id = `mba_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    return menuRepository.createAssignment({
      id,
      menuId,
      branchId,
      isActive: isActive ? 1 : 0
    });
  },

  async removeMenuFromBranch(menuId, branchId) {
    await menuRepository.deleteAssignment(menuId, branchId);
    return { success: true };
  },

  async listAssignmentsByBranch(branchId) {
    return menuRepository.listAssignmentsByBranch(branchId);
  },

  async listAssignmentsByMenu(menuId) {
    return menuRepository.listAssignmentsByMenu(menuId);
  },

  async listAllAssignments() {
    return menuRepository.listAllAssignments();
  }
};
