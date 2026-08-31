import { randomUUID } from 'node:crypto';
import { organizationRepository } from '../../data/repositories/organizationRepository.js';

/**
 * Organization Management — Business Domain Service
 */
export const organizationService = {
  // --- Restaurants ---
  async getRestaurant(id) {
    const restaurant = await organizationRepository.findRestaurantById(id);
    if (!restaurant) {
      throw new Error(`Restaurant not found with ID: ${id}`);
    }
    return restaurant;
  },

  async getRestaurantBySlug(slug) {
    const restaurant = await organizationRepository.findRestaurantBySlug(slug);
    if (!restaurant) {
      throw new Error(`Restaurant not found with slug: ${slug}`);
    }
    return restaurant;
  },

  async listRestaurants() {
    return organizationRepository.listAllRestaurants();
  },

  async createRestaurant({
    name,
    legalName,
    slug,
    description,
    currency = 'USD',
    phone,
    email,
    website,
    logoMediaId,
    bannerMediaId,
    status = 'Active'
  }) {
    if (!name) {
      throw new Error('Restaurant name is required');
    }

    const effectiveSlug = slug ? slug.toLowerCase().trim() : this.generateSlug(name);
    const existing = await organizationRepository.findRestaurantBySlug(effectiveSlug);
    if (existing) {
      throw new Error(`Restaurant with slug '${effectiveSlug}' already exists`);
    }

    const id = `rest_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    return organizationRepository.createRestaurant({
      id,
      name,
      legalName,
      slug: effectiveSlug,
      description,
      currency,
      phone,
      email,
      website,
      logoMediaId,
      bannerMediaId,
      status
    });
  },

  async updateRestaurant(id, updates) {
    await this.getRestaurant(id); // Ensure exists

    if (updates.slug) {
      const slugCandidate = updates.slug.toLowerCase().trim();
      const existing = await organizationRepository.findRestaurantBySlug(slugCandidate);
      if (existing && existing.id !== id) {
        throw new Error(`Slug '${slugCandidate}' is already in use by another restaurant`);
      }
      updates.slug = slugCandidate;
    }

    return organizationRepository.updateRestaurant(id, updates);
  },

  async setRestaurantStatus(id, status) {
    if (!['Active', 'Inactive'].includes(status)) {
      throw new Error(`Invalid restaurant status: ${status}. Allowed: Active, Inactive`);
    }
    await this.getRestaurant(id);
    return organizationRepository.setRestaurantStatus(id, status);
  },

  // --- Branches ---
  async getBranch(id) {
    const branch = await organizationRepository.findBranchById(id);
    if (!branch) {
      throw new Error(`Branch not found with ID: ${id}`);
    }
    return branch;
  },

  async getBranchBySlug(slug) {
    const branch = await organizationRepository.findBranchBySlug(slug);
    if (!branch) {
      throw new Error(`Branch not found with slug: ${slug}`);
    }
    return branch;
  },

  async listBranchesByRestaurant(restaurantId) {
    await this.getRestaurant(restaurantId);
    return organizationRepository.listBranchesByRestaurant(restaurantId);
  },

  async listAllBranches() {
    return organizationRepository.listAllBranches();
  },

  async createBranch({
    restaurantId,
    name,
    code,
    slug,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country = 'USA',
    phone,
    email,
    openingHours,
    status = 'Active'
  }) {
    if (!restaurantId) {
      throw new Error('Branch must belong to a restaurant (restaurantId is required)');
    }
    if (!name || !code || !addressLine1 || !city) {
      throw new Error('Branch name, code, addressLine1, and city are required');
    }

    // Verify parent restaurant exists
    await this.getRestaurant(restaurantId);

    // Verify code uniqueness within restaurant
    const existingCode = await organizationRepository.findBranchByCode(restaurantId, code);
    if (existingCode) {
      throw new Error(`Branch code '${code}' is already in use within this restaurant`);
    }

    const effectiveSlug = slug ? slug.toLowerCase().trim() : this.generateSlug(`${name}-${code}`);
    const existingSlug = await organizationRepository.findBranchBySlug(effectiveSlug);
    if (existingSlug) {
      throw new Error(`Branch slug '${effectiveSlug}' is already in use`);
    }

    const id = `brn_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    return organizationRepository.createBranch({
      id,
      restaurantId,
      name,
      code,
      slug: effectiveSlug,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      phone,
      email,
      openingHours,
      status
    });
  },

  async updateBranch(id, updates) {
    const branch = await this.getBranch(id);

    if (updates.code && updates.code !== branch.code) {
      const existingCode = await organizationRepository.findBranchByCode(branch.restaurant_id, updates.code);
      if (existingCode && existingCode.id !== id) {
        throw new Error(`Branch code '${updates.code}' is already in use within this restaurant`);
      }
    }

    if (updates.slug && updates.slug !== branch.slug) {
      const slugCandidate = updates.slug.toLowerCase().trim();
      const existingSlug = await organizationRepository.findBranchBySlug(slugCandidate);
      if (existingSlug && existingSlug.id !== id) {
        throw new Error(`Branch slug '${slugCandidate}' is already in use`);
      }
      updates.slug = slugCandidate;
    }

    return organizationRepository.updateBranch(id, updates);
  },

  async setBranchStatus(id, status) {
    if (!['Active', 'Inactive'].includes(status)) {
      throw new Error(`Invalid branch status: ${status}. Allowed: Active, Inactive`);
    }
    await this.getBranch(id);
    return organizationRepository.setBranchStatus(id, status);
  },

  // Helper
  generateSlug(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
};
