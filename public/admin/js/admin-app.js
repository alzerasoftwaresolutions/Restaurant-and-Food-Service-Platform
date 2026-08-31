/**
 * RFSP Core Platform v1 — Administration Console Frontend
 * Pure JavaScript SPA consuming REST APIs in the Experience Layer
 */

let authToken = localStorage.getItem('rfsp_token') || null;
let currentUser = null;
let currentRestaurant = null;
let allMenus = [];
let allBranches = [];

// API Request Wrapper with Auth Token Header
async function apiRequest(endpoint, options = {}) {
  const headers = options.headers || {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Auto-set Content-Type for JSON payloads if not FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    if (typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
  }

  try {
    const response = await fetch(endpoint, { ...options, headers });
    if (response.status === 401) {
      logout();
      throw new Error('Session expired. Please sign in again.');
    }
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Request failed');
    }
    return json;
  } catch (err) {
    console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
    throw err;
  }
}

// Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Modal Helpers
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Auth Lifecycle
async function checkAuth() {
  if (!authToken) {
    showLoginOverlay();
    return;
  }

  try {
    const res = await apiRequest('/api/v1/auth/profile');
    currentUser = res.data;
    document.getElementById('current-user-name').textContent = currentUser.fullName || currentUser.username;
    document.getElementById('current-user-role').textContent = (currentUser.roles || []).join(', ').toUpperCase();
    document.getElementById('current-user-avatar').textContent = (currentUser.fullName || currentUser.username)[0].toUpperCase();
    
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('admin-app').style.display = 'flex';
    
    initApp();
  } catch (err) {
    showLoginOverlay();
  }
}

function showLoginOverlay() {
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('admin-app').style.display = 'none';
}

function logout() {
  localStorage.removeItem('rfsp_token');
  authToken = null;
  currentUser = null;
  showLoginOverlay();
  showToast('Signed out successfully', 'info');
}

// View Router
function switchView(viewName) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });

  document.querySelectorAll('.app-view').forEach(view => {
    view.style.display = 'none';
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.style.display = 'block';
  }

  const titles = {
    dashboard: 'Dashboard Overview',
    restaurant: 'Restaurant Profile & Settings',
    branches: 'Branch Locations Management',
    menus: 'Digital Menus Management',
    categories: 'Menu Categories & Hierarchy',
    items: 'Menu Items & Availability',
    assignments: 'Menu-Branch Assignment Matrix',
    qr: 'QR Code Publishing & Resolution',
    media: 'Reusable Media Asset Library',
    audit: 'Administrative Audit History'
  };

  document.getElementById('header-page-title').textContent = titles[viewName] || 'Admin Console';

  // Load view-specific data
  if (viewName === 'dashboard') loadDashboard();
  if (viewName === 'restaurant') loadRestaurant();
  if (viewName === 'branches') loadBranches();
  if (viewName === 'menus') loadMenus();
  if (viewName === 'categories') loadCategoriesView();
  if (viewName === 'items') loadItemsView();
  if (viewName === 'assignments') loadAssignments();
  if (viewName === 'qr') loadQRCodes();
  if (viewName === 'media') loadMedia();
  if (viewName === 'audit') loadAuditLogs();
}

// App Initialization
async function initApp() {
  // Setup Nav Click Listeners
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      switchView(item.dataset.view);
    });
  });

  loadDashboard();
}

// ==========================================
// 1. DASHBOARD
// ==========================================
async function loadDashboard() {
  try {
    const res = await apiRequest('/api/v1/dashboard/overview');
    const { metrics, recentActivity } = res.data;

    document.getElementById('metric-restaurants').textContent = metrics.restaurants;
    document.getElementById('metric-branches').textContent = `${metrics.branchesActive} / ${metrics.branchesTotal}`;
    document.getElementById('metric-menus').textContent = `${metrics.menusActive} / ${metrics.menusTotal}`;
    document.getElementById('metric-items').textContent = `${metrics.itemsAvailable} / ${metrics.itemsTotal}`;
    document.getElementById('metric-qrs').textContent = metrics.qrCodesActive;

    // Badges in sidebar
    document.getElementById('badge-branches').textContent = metrics.branchesTotal;
    document.getElementById('badge-menus').textContent = metrics.menusTotal;
    document.getElementById('badge-items').textContent = metrics.itemsTotal;
    document.getElementById('badge-qrs').textContent = metrics.qrCodesActive;

    const tbody = document.getElementById('dashboard-recent-activity');
    tbody.innerHTML = '';

    if (!recentActivity || recentActivity.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No activity recorded yet.</td></tr>';
      return;
    }

    recentActivity.forEach(act => {
      const tr = document.createElement('tr');
      const timeStr = new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 12px;">${timeStr}</td>
        <td><strong>${act.actor_username}</strong></td>
        <td><span class="badge badge-tag">${act.action}</span></td>
        <td style="color: var(--text-secondary);">${act.target_type} ${act.target_id ? `(${act.target_id})` : ''}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(`Error loading dashboard: ${err.message}`, 'error');
  }
}

// ==========================================
// 2. RESTAURANT PROFILE
// ==========================================
async function loadRestaurant() {
  try {
    const res = await apiRequest('/api/v1/restaurants');
    if (res.data && res.data.length > 0) {
      currentRestaurant = res.data[0];
      document.getElementById('rest-id').value = currentRestaurant.id;
      document.getElementById('rest-name').value = currentRestaurant.name || '';
      document.getElementById('rest-legal').value = currentRestaurant.legal_name || '';
      document.getElementById('rest-slug').value = currentRestaurant.slug || '';
      document.getElementById('rest-currency').value = currentRestaurant.currency || 'USD';
      document.getElementById('rest-desc').value = currentRestaurant.description || '';
      document.getElementById('rest-phone').value = currentRestaurant.phone || '';
      document.getElementById('rest-email').value = currentRestaurant.email || '';
      document.getElementById('rest-website').value = currentRestaurant.website || '';
      document.getElementById('rest-status-select').value = currentRestaurant.status || 'Active';

      const badge = document.getElementById('restaurant-status-badge');
      badge.textContent = currentRestaurant.status;
      badge.className = `badge ${currentRestaurant.status === 'Active' ? 'badge-active' : 'badge-inactive'}`;
    }
  } catch (err) {
    showToast(`Error loading restaurant profile: ${err.message}`, 'error');
  }
}

document.getElementById('restaurant-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('rest-id').value;
  const updates = {
    name: document.getElementById('rest-name').value,
    legalName: document.getElementById('rest-legal').value,
    slug: document.getElementById('rest-slug').value,
    currency: document.getElementById('rest-currency').value,
    description: document.getElementById('rest-desc').value,
    phone: document.getElementById('rest-phone').value,
    email: document.getElementById('rest-email').value,
    website: document.getElementById('rest-website').value,
    status: document.getElementById('rest-status-select').value
  };

  try {
    await apiRequest(`/api/v1/restaurants/${id}`, {
      method: 'PUT',
      body: updates
    });
    showToast('Restaurant profile updated successfully!');
    loadRestaurant();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ==========================================
// 3. BRANCHES
// ==========================================
async function loadBranches() {
  try {
    const res = await apiRequest('/api/v1/branches');
    allBranches = res.data || [];
    const tbody = document.getElementById('branches-table-body');
    tbody.innerHTML = '';

    allBranches.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight: 700;">${b.name}</div>
          <div style="font-size: 12px; color: var(--text-muted);">${b.restaurant_name}</div>
        </td>
        <td><code>${b.code}</code></td>
        <td>${b.city}, ${b.address_line1}</td>
        <td><span class="badge badge-tag">${b.assigned_menu_count || 0} Menus</span></td>
        <td>
          <span class="badge ${b.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${b.status}</span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <a href="/menu/${b.slug}" target="_blank" class="btn btn-secondary btn-sm" title="View Customer Menu">🌐 View</a>
            <button class="btn btn-secondary btn-sm" onclick="editBranch('${b.id}')">✏️ Edit</button>
            <button class="btn btn-secondary btn-sm" onclick="toggleBranchStatus('${b.id}', '${b.status}')">
              ${b.status === 'Active' ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(`Error loading branches: ${err.message}`, 'error');
  }
}

function openCreateBranchModal() {
  document.getElementById('form-branch').reset();
  document.getElementById('branch-form-id').value = '';
  document.getElementById('modal-branch-title').textContent = 'Add Branch Location';
  openModal('modal-branch');
}

function editBranch(id) {
  const b = allBranches.find(x => x.id === id);
  if (!b) return;

  document.getElementById('branch-form-id').value = b.id;
  document.getElementById('branch-form-name').value = b.name;
  document.getElementById('branch-form-code').value = b.code;
  document.getElementById('branch-form-slug').value = b.slug;
  document.getElementById('branch-form-addr1').value = b.address_line1;
  document.getElementById('branch-form-city').value = b.city;
  document.getElementById('branch-form-state').value = b.state || '';
  document.getElementById('branch-form-country').value = b.country;
  document.getElementById('branch-form-phone').value = b.phone || '';
  document.getElementById('branch-form-email').value = b.email || '';
  document.getElementById('branch-form-hours').value = b.opening_hours || '';
  document.getElementById('branch-form-status').value = b.status;

  document.getElementById('modal-branch-title').textContent = 'Edit Branch Location';
  openModal('modal-branch');
}

async function toggleBranchStatus(id, currentStatus) {
  const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
  try {
    await apiRequest(`/api/v1/branches/${id}/status`, {
      method: 'PATCH',
      body: { status: newStatus }
    });
    showToast(`Branch status set to ${newStatus}`);
    loadBranches();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('form-branch').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('branch-form-id').value;
  const payload = {
    restaurantId: currentRestaurant ? currentRestaurant.id : 'rest_aura',
    name: document.getElementById('branch-form-name').value,
    code: document.getElementById('branch-form-code').value,
    slug: document.getElementById('branch-form-slug').value || undefined,
    addressLine1: document.getElementById('branch-form-addr1').value,
    city: document.getElementById('branch-form-city').value,
    state: document.getElementById('branch-form-state').value,
    country: document.getElementById('branch-form-country').value,
    phone: document.getElementById('branch-form-phone').value,
    email: document.getElementById('branch-form-email').value,
    openingHours: document.getElementById('branch-form-hours').value,
    status: document.getElementById('branch-form-status').value
  };

  try {
    if (id) {
      await apiRequest(`/api/v1/branches/${id}`, { method: 'PUT', body: payload });
      showToast('Branch updated successfully');
    } else {
      await apiRequest('/api/v1/branches', { method: 'POST', body: payload });
      showToast('Branch created successfully');
    }
    closeModal('modal-branch');
    loadBranches();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ==========================================
// 4. MENUS
// ==========================================
async function loadMenus() {
  try {
    const res = await apiRequest('/api/v1/menus');
    allMenus = res.data || [];
    const tbody = document.getElementById('menus-table-body');
    tbody.innerHTML = '';

    allMenus.forEach(m => {
      const tr = document.createElement('tr');
      const statusClass = m.status === 'Active' ? 'badge-active' : (m.status === 'Archived' ? 'badge-archived' : 'badge-inactive');
      tr.innerHTML = `
        <td><strong>${m.name}</strong></td>
        <td style="color: var(--text-secondary); max-width: 250px;">${m.description || '—'}</td>
        <td><span class="badge badge-tag">${m.category_count || 0} Categories</span></td>
        <td><span class="badge badge-tag">${m.item_count || 0} Items</span></td>
        <td>${m.assigned_branch_count || 0} Branches</td>
        <td><span class="badge ${statusClass}">${m.status}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" onclick="editMenu('${m.id}')">✏️ Edit</button>
            <select class="form-control" style="width: 110px; padding: 4px 8px; font-size: 12px;" onchange="changeMenuStatus('${m.id}', this.value)">
              <option value="Active" ${m.status === 'Active' ? 'selected' : ''}>Active</option>
              <option value="Inactive" ${m.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
              <option value="Archived" ${m.status === 'Archived' ? 'selected' : ''}>Archived</option>
            </select>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(`Error loading menus: ${err.message}`, 'error');
  }
}

function openCreateMenuModal() {
  document.getElementById('form-menu').reset();
  document.getElementById('menu-form-id').value = '';
  document.getElementById('modal-menu-title').textContent = 'Create Digital Menu';
  openModal('modal-menu');
}

function editMenu(id) {
  const m = allMenus.find(x => x.id === id);
  if (!m) return;

  document.getElementById('menu-form-id').value = m.id;
  document.getElementById('menu-form-name').value = m.name;
  document.getElementById('menu-form-desc').value = m.description || '';
  document.getElementById('menu-form-status').value = m.status;

  document.getElementById('modal-menu-title').textContent = 'Edit Menu';
  openModal('modal-menu');
}

async function changeMenuStatus(id, newStatus) {
  try {
    await apiRequest(`/api/v1/menus/${id}/status`, {
      method: 'PATCH',
      body: { status: newStatus }
    });
    showToast(`Menu status set to ${newStatus}`);
    loadMenus();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('form-menu').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('menu-form-id').value;
  const payload = {
    restaurantId: currentRestaurant ? currentRestaurant.id : 'rest_aura',
    name: document.getElementById('menu-form-name').value,
    description: document.getElementById('menu-form-desc').value,
    status: document.getElementById('menu-form-status').value
  };

  try {
    if (id) {
      await apiRequest(`/api/v1/menus/${id}`, { method: 'PUT', body: payload });
      showToast('Menu updated successfully');
    } else {
      await apiRequest('/api/v1/menus', { method: 'POST', body: payload });
      showToast('Menu created successfully');
    }
    closeModal('modal-menu');
    loadMenus();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ==========================================
// 5. CATEGORIES
// ==========================================
async function loadCategoriesView() {
  const selector = document.getElementById('category-menu-selector');
  selector.innerHTML = '';

  if (allMenus.length === 0) {
    const res = await apiRequest('/api/v1/menus');
    allMenus = res.data || [];
  }

  allMenus.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    selector.appendChild(opt);
  });

  loadCategoriesForSelectedMenu();
}

async function loadCategoriesForSelectedMenu() {
  const menuId = document.getElementById('category-menu-selector').value;
  if (!menuId) return;

  try {
    const res = await apiRequest(`/api/v1/categories?menuId=${menuId}`);
    const categories = res.data || [];
    const tbody = document.getElementById('categories-table-body');
    tbody.innerHTML = '';

    categories.forEach((cat, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="badge badge-tag">#${cat.display_order}</span></td>
        <td><strong>${cat.name}</strong></td>
        <td style="color: var(--text-secondary);">${cat.description || '—'}</td>
        <td>${cat.item_count || 0} items</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" onclick="moveCategory('${cat.id}', -1)" ${index === 0 ? 'disabled' : ''}>▲</button>
            <button class="btn btn-secondary btn-sm" onclick="moveCategory('${cat.id}', 1)" ${index === categories.length - 1 ? 'disabled' : ''}>▼</button>
            <button class="btn btn-secondary btn-sm" onclick="editCategory('${cat.id}', '${cat.name}', '${cat.description || ''}', ${cat.display_order})">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteCategory('${cat.id}')">🗑️</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(`Error loading categories: ${err.message}`, 'error');
  }
}

function openCreateCategoryModal() {
  document.getElementById('form-category').reset();
  document.getElementById('cat-form-id').value = '';
  document.getElementById('modal-category-title').textContent = 'Add Category';
  openModal('modal-category');
}

function editCategory(id, name, desc, order) {
  document.getElementById('cat-form-id').value = id;
  document.getElementById('cat-form-name').value = name;
  document.getElementById('cat-form-desc').value = desc;
  document.getElementById('cat-form-order').value = order;
  document.getElementById('modal-category-title').textContent = 'Edit Category';
  openModal('modal-category');
}

async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this category and its items?')) return;
  try {
    await apiRequest(`/api/v1/categories/${id}`, { method: 'DELETE' });
    showToast('Category deleted');
    loadCategoriesForSelectedMenu();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function moveCategory(id, direction) {
  const menuId = document.getElementById('category-menu-selector').value;
  const res = await apiRequest(`/api/v1/categories?menuId=${menuId}`);
  const categories = res.data || [];
  const idx = categories.findIndex(c => c.id === id);
  if (idx < 0) return;

  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= categories.length) return;

  const currentCat = categories[idx];
  const targetCat = categories[targetIdx];

  const categoryOrders = [
    { id: currentCat.id, displayOrder: targetCat.display_order },
    { id: targetCat.id, displayOrder: currentCat.display_order }
  ];

  try {
    await apiRequest('/api/v1/categories/reorder', {
      method: 'POST',
      body: { categoryOrders }
    });
    loadCategoriesForSelectedMenu();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('form-category').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('cat-form-id').value;
  const menuId = document.getElementById('category-menu-selector').value;
  const payload = {
    menuId,
    name: document.getElementById('cat-form-name').value,
    description: document.getElementById('cat-form-desc').value,
    displayOrder: parseInt(document.getElementById('cat-form-order').value, 10) || 0
  };

  try {
    if (id) {
      await apiRequest(`/api/v1/categories/${id}`, { method: 'PUT', body: payload });
      showToast('Category updated');
    } else {
      await apiRequest('/api/v1/categories', { method: 'POST', body: payload });
      showToast('Category added');
    }
    closeModal('modal-category');
    loadCategoriesForSelectedMenu();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ==========================================
// 6. MENU ITEMS
// ==========================================
let currentMenuItems = [];

async function loadItemsView() {
  const selector = document.getElementById('item-menu-selector');
  selector.innerHTML = '';

  if (allMenus.length === 0) {
    const res = await apiRequest('/api/v1/menus');
    allMenus = res.data || [];
  }

  allMenus.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    selector.appendChild(opt);
  });

  loadItemsForSelectedMenu();
}

async function loadItemsForSelectedMenu() {
  const menuId = document.getElementById('item-menu-selector').value;
  if (!menuId) return;

  try {
    const res = await apiRequest(`/api/v1/menu-items?menuId=${menuId}`);
    currentMenuItems = res.data || [];
    const tbody = document.getElementById('items-table-body');
    tbody.innerHTML = '';

    currentMenuItems.forEach(item => {
      const tr = document.createElement('tr');
      const thumb = item.media_url 
        ? `<img src="${item.media_url}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;">`
        : '<div style="width: 44px; height: 44px; border-radius: 8px; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center;">🍲</div>';

      tr.innerHTML = `
        <td>${thumb}</td>
        <td>
          <div style="font-weight: 700;">${item.name}</div>
          <div style="font-size: 12px; color: var(--text-muted);">${item.description || ''}</div>
        </td>
        <td><span class="badge badge-tag">${item.category_name || '—'}</span></td>
        <td style="font-weight: 700; color: var(--accent-primary);">$${Number(item.price).toFixed(2)}</td>
        <td>
          <div style="font-size: 12px;">
            ${item.dietary_flags ? `<div>🌱 ${item.dietary_flags}</div>` : ''}
            ${item.allergens ? `<div style="color: #f87171;">⚠️ ${item.allergens}</div>` : ''}
          </div>
        </td>
        <td>
          <label class="switch">
            <input type="checkbox" ${item.is_available ? 'checked' : ''} onchange="toggleItemAvailability('${item.id}', this.checked)">
            <span class="slider"></span>
          </label>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" onclick="editItem('${item.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('${item.id}')">🗑️</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(`Error loading items: ${err.message}`, 'error');
  }
}

async function toggleItemAvailability(id, isAvailable) {
  try {
    await apiRequest(`/api/v1/menu-items/${id}/availability`, {
      method: 'PATCH',
      body: { isAvailable }
    });
    showToast(`Item availability set to ${isAvailable ? 'Available' : 'Unavailable'}`);
  } catch (err) {
    showToast(err.message, 'error');
    loadItemsForSelectedMenu();
  }
}

async function openCreateItemModal() {
  const menuId = document.getElementById('item-menu-selector').value;
  const catRes = await apiRequest(`/api/v1/categories?menuId=${menuId}`);
  const categories = catRes.data || [];

  if (categories.length === 0) {
    showToast('Please create a category under this menu first.', 'error');
    switchView('categories');
    return;
  }

  const catSelect = document.getElementById('item-form-cat');
  catSelect.innerHTML = '';
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    catSelect.appendChild(opt);
  });

  // Populate media assets dropdown
  const mediaRes = await apiRequest('/api/v1/media');
  const mediaSelect = document.getElementById('item-form-media');
  mediaSelect.innerHTML = '<option value="">-- No Image Attached --</option>';
  (mediaRes.data || []).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.original_filename} (${m.asset_type})`;
    mediaSelect.appendChild(opt);
  });

  document.getElementById('form-item').reset();
  document.getElementById('item-form-id').value = '';
  document.getElementById('modal-item-title').textContent = 'Add Menu Item';
  openModal('modal-item');
}

async function editItem(id) {
  const item = currentMenuItems.find(x => x.id === id);
  if (!item) return;

  const menuId = document.getElementById('item-menu-selector').value;
  const catRes = await apiRequest(`/api/v1/categories?menuId=${menuId}`);
  const categories = catRes.data || [];

  const catSelect = document.getElementById('item-form-cat');
  catSelect.innerHTML = '';
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === item.category_id) opt.selected = true;
    catSelect.appendChild(opt);
  });

  const mediaRes = await apiRequest('/api/v1/media');
  const mediaSelect = document.getElementById('item-form-media');
  mediaSelect.innerHTML = '<option value="">-- No Image Attached --</option>';
  (mediaRes.data || []).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.original_filename} (${m.asset_type})`;
    if (m.id === item.media_id) opt.selected = true;
    mediaSelect.appendChild(opt);
  });

  document.getElementById('item-form-id').value = item.id;
  document.getElementById('item-form-name').value = item.name;
  document.getElementById('item-form-price').value = item.price;
  document.getElementById('item-form-desc').value = item.description || '';
  document.getElementById('item-form-dietary').value = item.dietary_flags || '';
  document.getElementById('item-form-allergens').value = item.allergens || '';
  document.getElementById('item-form-avail').checked = !!item.is_available;

  document.getElementById('modal-item-title').textContent = 'Edit Menu Item';
  openModal('modal-item');
}

async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this menu item?')) return;
  try {
    await apiRequest(`/api/v1/menu-items/${id}`, { method: 'DELETE' });
    showToast('Item deleted');
    loadItemsForSelectedMenu();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('form-item').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('item-form-id').value;
  const payload = {
    categoryId: document.getElementById('item-form-cat').value,
    name: document.getElementById('item-form-name').value,
    price: parseFloat(document.getElementById('item-form-price').value),
    description: document.getElementById('item-form-desc').value,
    dietaryFlags: document.getElementById('item-form-dietary').value,
    allergens: document.getElementById('item-form-allergens').value,
    mediaId: document.getElementById('item-form-media').value || null,
    isAvailable: document.getElementById('item-form-avail').checked ? 1 : 0
  };

  try {
    if (id) {
      await apiRequest(`/api/v1/menu-items/${id}`, { method: 'PUT', body: payload });
      showToast('Menu item updated');
    } else {
      await apiRequest('/api/v1/menu-items', { method: 'POST', body: payload });
      showToast('Menu item created');
    }
    closeModal('modal-item');
    loadItemsForSelectedMenu();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ==========================================
// 7. MENU-BRANCH ASSIGNMENT MATRIX
// ==========================================
async function loadAssignments() {
  try {
    const [branchRes, menuRes, asgnRes] = await Promise.all([
      apiRequest('/api/v1/branches'),
      apiRequest('/api/v1/menus'),
      apiRequest('/api/v1/menu-assignments')
    ]);

    const branches = branchRes.data || [];
    const menus = (menuRes.data || []).filter(m => m.status !== 'Archived');
    const assignments = asgnRes.data || [];

    const table = document.getElementById('assignment-matrix-table');
    table.innerHTML = '';

    // Header row
    const thead = document.createElement('thead');
    const headerTr = document.createElement('tr');
    headerTr.innerHTML = '<th>Branch Location</th>';
    menus.forEach(m => {
      headerTr.innerHTML += `<th>${m.name} <div style="font-size:11px;font-weight:400;color:var(--text-muted);">(${m.status})</div></th>`;
    });
    thead.appendChild(headerTr);
    table.appendChild(thead);

    // Body rows
    const tbody = document.createElement('tbody');
    branches.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong>${b.name}</strong> <span style="font-size:11px;color:var(--text-muted);">[${b.code}]</span></td>`;
      menus.forEach(m => {
        const isAssigned = assignments.some(a => a.branch_id === b.id && a.menu_id === m.id && a.is_active === 1);
        tr.innerHTML += `
          <td>
            <label class="switch">
              <input type="checkbox" ${isAssigned ? 'checked' : ''} onchange="toggleAssignment('${m.id}', '${b.id}', this.checked)">
              <span class="slider"></span>
            </label>
          </td>
        `;
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  } catch (err) {
    showToast(`Error loading assignments matrix: ${err.message}`, 'error');
  }
}

async function toggleAssignment(menuId, branchId, shouldAssign) {
  try {
    if (shouldAssign) {
      await apiRequest('/api/v1/menu-assignments', {
        method: 'POST',
        body: { menuId, branchId, isActive: 1 }
      });
      showToast('Menu assigned to branch');
    } else {
      await apiRequest(`/api/v1/menu-assignments?menuId=${menuId}&branchId=${branchId}`, {
        method: 'DELETE'
      });
      showToast('Menu unassigned from branch');
    }
  } catch (err) {
    showToast(err.message, 'error');
    loadAssignments();
  }
}

// ==========================================
// 8. QR CODES
// ==========================================
let allQRs = [];

async function loadQRCodes() {
  try {
    const res = await apiRequest('/api/v1/qr-codes');
    allQRs = res.data || [];
    const tbody = document.getElementById('qr-table-body');
    tbody.innerHTML = '';

    allQRs.forEach(qr => {
      const tr = document.createElement('tr');
      const statusClass = qr.status === 'Active' ? 'badge-active' : 'badge-disabled';
      tr.innerHTML = `
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${qr.qr_image_data}" style="width: 44px; height: 44px; border-radius: 6px; background: white; padding: 2px;">
            <div>
              <strong>${qr.title}</strong>
              <div style="font-size: 11px; color: var(--text-muted);">Code: <code>${qr.code}</code></div>
            </div>
          </div>
        </td>
        <td>${qr.branch_name} [${qr.branch_code}]</td>
        <td><a href="/qr/${qr.code}" target="_blank" style="font-size: 12px; word-break: break-all;">/qr/${qr.code}</a></td>
        <td><span class="badge ${statusClass}">${qr.status}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-primary btn-sm" onclick="previewQR('${qr.id}')">🔍 Preview & Download</button>
            <button class="btn btn-secondary btn-sm" onclick="toggleQRStatus('${qr.id}', '${qr.status}')">
              ${qr.status === 'Active' ? 'Disable' : 'Enable'}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="regenerateQR('${qr.id}')" title="Regenerate Image">🔄</button>
            <button class="btn btn-danger btn-sm" onclick="deleteQR('${qr.id}')">🗑️</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(`Error loading QR codes: ${err.message}`, 'error');
  }
}

function previewQR(id) {
  const qr = allQRs.find(x => x.id === id);
  if (!qr) return;

  document.getElementById('qr-modal-title').textContent = qr.title;
  document.getElementById('qr-modal-img').src = qr.qr_image_data;
  document.getElementById('qr-modal-dest').innerHTML = `<strong>Destination:</strong> ${qr.destination_url}<br><strong>QR Direct Link:</strong> ${window.location.origin}/qr/${qr.code}`;

  const downloadBtn = document.getElementById('qr-modal-download-btn');
  downloadBtn.href = qr.qr_image_data;
  downloadBtn.download = `${qr.code}.png`;

  const testBtn = document.getElementById('qr-modal-test-btn');
  testBtn.href = `/qr/${qr.code}`;

  openModal('modal-qr-preview');
}

async function openCreateQRModal() {
  const branchRes = await apiRequest('/api/v1/branches');
  const branches = branchRes.data || [];
  const select = document.getElementById('qr-create-branch');
  select.innerHTML = '';

  branches.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = `${b.name} (${b.city})`;
    select.appendChild(opt);
  });

  document.getElementById('form-qr-create').reset();
  openModal('modal-qr-create');
}

async function toggleQRStatus(id, currentStatus) {
  const newStatus = currentStatus === 'Active' ? 'Disabled' : 'Active';
  try {
    await apiRequest(`/api/v1/qr-codes/${id}/status`, {
      method: 'PATCH',
      body: { status: newStatus }
    });
    showToast(`QR Code status updated to ${newStatus}`);
    loadQRCodes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function regenerateQR(id) {
  try {
    await apiRequest(`/api/v1/qr-codes/${id}/regenerate`, { method: 'POST' });
    showToast('QR Code regenerated successfully');
    loadQRCodes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteQR(id) {
  if (!confirm('Are you sure you want to delete this QR code?')) return;
  try {
    await apiRequest(`/api/v1/qr-codes/${id}`, { method: 'DELETE' });
    showToast('QR Code deleted');
    loadQRCodes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('form-qr-create').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    branchId: document.getElementById('qr-create-branch').value,
    title: document.getElementById('qr-create-title').value
  };

  try {
    await apiRequest('/api/v1/qr-codes', { method: 'POST', body: payload });
    showToast('QR Code generated successfully');
    closeModal('modal-qr-create');
    loadQRCodes();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ==========================================
// 9. MEDIA ASSET LIBRARY
// ==========================================
async function loadMedia() {
  try {
    const res = await apiRequest('/api/v1/media');
    const gallery = document.getElementById('media-gallery');
    gallery.innerHTML = '';

    (res.data || []).forEach(asset => {
      const card = document.createElement('div');
      card.className = 'media-card';
      card.innerHTML = `
        <img class="media-thumb" src="${asset.file_path}" alt="${asset.alt_text || ''}">
        <div class="media-info">
          <div style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${asset.original_filename}">${asset.original_filename}</div>
          <div style="color: var(--text-muted); font-size: 11px;">Type: ${asset.asset_type}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
            <button class="btn btn-secondary btn-sm" onclick="copyAssetUrl('${asset.file_path}')">📋 Copy URL</button>
            <button class="btn btn-danger btn-sm" onclick="deleteMediaAsset('${asset.id}')">🗑️</button>
          </div>
        </div>
      `;
      gallery.appendChild(card);
    });
  } catch (err) {
    showToast(`Error loading media: ${err.message}`, 'error');
  }
}

function copyAssetUrl(url) {
  navigator.clipboard.writeText(`${window.location.origin}${url}`);
  showToast('Image URL copied to clipboard!');
}

function openUploadMediaModal() {
  document.getElementById('form-media-upload').reset();
  openModal('modal-media-upload');
}

async function deleteMediaAsset(id) {
  if (!confirm('Are you sure you want to delete this media asset?')) return;
  try {
    await apiRequest(`/api/v1/media/${id}`, { method: 'DELETE' });
    showToast('Media asset removed');
    loadMedia();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('form-media-upload').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('media-file-input');
  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('Please select a file to upload', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('assetType', document.getElementById('media-asset-type').value);
  formData.append('altText', document.getElementById('media-alt-text').value);

  try {
    await apiRequest('/api/v1/media/upload', {
      method: 'POST',
      body: formData
    });
    showToast('Media uploaded successfully');
    closeModal('modal-media-upload');
    loadMedia();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ==========================================
// 10. AUDIT LOGS
// ==========================================
async function loadAuditLogs() {
  const targetType = document.getElementById('audit-target-filter').value;
  try {
    const url = targetType ? `/api/v1/audit-logs?targetType=${targetType}` : '/api/v1/audit-logs';
    const res = await apiRequest(url);
    const tbody = document.getElementById('audit-table-body');
    tbody.innerHTML = '';

    (res.data || []).forEach(log => {
      const tr = document.createElement('tr');
      const timeStr = new Date(log.timestamp).toLocaleString();
      const resultBadge = log.result === 'SUCCESS' ? '<span class="badge badge-success">SUCCESS</span>' : '<span class="badge badge-danger">FAILURE</span>';
      tr.innerHTML = `
        <td style="font-size: 12px; color: var(--text-muted);">${timeStr}</td>
        <td><strong>${log.actor_username}</strong></td>
        <td><span class="badge badge-tag">${log.action}</span></td>
        <td>${log.target_type}</td>
        <td><code>${log.target_id || '—'}</code></td>
        <td>${resultBadge}</td>
        <td style="font-size: 12px; color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.details || ''}">
          ${log.details || '—'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(`Error loading audit logs: ${err.message}`, 'error');
  }
}

// Login form handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { identifier, password }
    });

    authToken = res.data.token;
    localStorage.setItem('rfsp_token', authToken);
    showToast('Signed in successfully!');
    checkAuth();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Start checking auth on page load
document.addEventListener('DOMContentLoaded', checkAuth);
