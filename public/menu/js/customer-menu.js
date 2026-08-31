/**
 * RFSP Customer Digital Menu Client Script
 * Zero-auth, read-only client consuming authoritative public menu API
 */

let menuData = null;
let currentMenuIndex = 0;
let currentSearchTerm = '';

// Extract branchSlug from pathname: /menu/:branchSlug
function getBranchSlug() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2 && pathParts[0] === 'menu') {
    return pathParts[1];
  }
  // Fallback to query parameter or default
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('branch') || 'downtown-flagship';
}

async function loadMenu() {
  const branchSlug = getBranchSlug();
  const loadingState = document.getElementById('loading-state');
  const unavailableView = document.getElementById('unavailable-view');
  const activeMenuView = document.getElementById('active-menu-view');

  try {
    const response = await fetch(`/api/v1/public/menu/${branchSlug}`);
    const json = await response.json();

    loadingState.style.display = 'none';

    if (!json.success || !json.isPublished) {
      unavailableView.style.display = 'block';
      document.getElementById('unavailable-title').textContent = 'Menu Not Available';
      document.getElementById('unavailable-msg').textContent = json.message || 'This menu is currently not available for browsing.';
      if (json.branch) {
        document.getElementById('unavailable-branch-info').textContent = `${json.branch.restaurantName || ''} • ${json.branch.name || ''}`;
      }
      return;
    }

    menuData = json.data;
    activeMenuView.style.display = 'block';
    renderMenuHeader(menuData.branch);
    renderMenuSwitcher(menuData.menus);
    renderActiveMenuContent();
  } catch (err) {
    loadingState.style.display = 'none';
    unavailableView.style.display = 'block';
    document.getElementById('unavailable-title').textContent = 'Connection Error';
    document.getElementById('unavailable-msg').textContent = 'Unable to load digital menu. Please check your network connection.';
  }
}

function renderMenuHeader(branch) {
  document.title = `${branch.name} — ${branch.restaurantName} Menu`;
  document.getElementById('restaurant-name').textContent = branch.restaurantName;
  document.getElementById('branch-name').textContent = branch.name;
  document.getElementById('restaurant-desc').textContent = branch.restaurantDescription || '';
  document.getElementById('branch-address').textContent = branch.address || 'Address on file';
  document.getElementById('branch-hours').textContent = branch.openingHours || 'Opening hours available on request';
  document.getElementById('branch-phone').textContent = branch.phone || 'Contact branch directly';

  // Logo & Banner
  const logoEl = document.getElementById('restaurant-logo');
  if (branch.restaurantLogoUrl) {
    logoEl.src = branch.restaurantLogoUrl;
  } else {
    logoEl.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231e293b"/><text x="50" y="55" fill="white" font-size="30" text-anchor="middle">🍽️</text></svg>';
  }

  const bannerEl = document.getElementById('hero-banner');
  if (branch.restaurantBannerUrl) {
    bannerEl.style.backgroundImage = `url(${branch.restaurantBannerUrl})`;
  } else {
    bannerEl.style.background = 'linear-gradient(135deg, #1e1b4b, #0f172a)';
  }
}

function renderMenuSwitcher(menus) {
  const switcherEl = document.getElementById('menu-switcher');
  switcherEl.innerHTML = '';

  if (!menus || menus.length <= 1) {
    switcherEl.style.display = 'none';
    return;
  }

  switcherEl.style.display = 'flex';
  menus.forEach((menu, index) => {
    const btn = document.createElement('button');
    btn.className = `menu-tab-btn ${index === currentMenuIndex ? 'active' : ''}`;
    btn.textContent = menu.name;
    btn.onclick = () => {
      currentMenuIndex = index;
      renderMenuSwitcher(menus);
      renderActiveMenuContent();
    };
    switcherEl.appendChild(btn);
  });
}

function renderActiveMenuContent() {
  if (!menuData || !menuData.menus || menuData.menus.length === 0) return;
  const activeMenu = menuData.menus[currentMenuIndex] || menuData.menus[0];
  const currencySymbol = menuData.branch.currency === 'EUR' ? '€' : '$';

  // Render Category Pills
  const pillsEl = document.getElementById('category-pills');
  pillsEl.innerHTML = '';

  const allPill = document.createElement('button');
  allPill.className = 'cat-pill active';
  allPill.textContent = 'All Items';
  allPill.onclick = () => {
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    allPill.classList.add('active');
    filterItems('');
  };
  pillsEl.appendChild(allPill);

  activeMenu.categories.forEach(cat => {
    const pill = document.createElement('button');
    pill.className = 'cat-pill';
    pill.textContent = cat.name;
    pill.onclick = () => {
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const section = document.getElementById(`cat-sec-${cat.id}`);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    };
    pillsEl.appendChild(pill);
  });

  // Render Category Sections & Items
  const contentEl = document.getElementById('menu-content');
  contentEl.innerHTML = '';

  let totalItemsCount = 0;

  activeMenu.categories.forEach(cat => {
    // Filter items based on search term
    const visibleItems = (cat.items || []).filter(item => {
      if (!currentSearchTerm) return true;
      const term = currentSearchTerm.toLowerCase();
      return item.name.toLowerCase().includes(term) ||
             (item.description && item.description.toLowerCase().includes(term)) ||
             (item.dietary_flags && item.dietary_flags.toLowerCase().includes(term));
    });

    if (visibleItems.length === 0 && currentSearchTerm) {
      return; // Skip empty category when searching
    }

    totalItemsCount += visibleItems.length;

    const section = document.createElement('div');
    section.className = 'category-section';
    section.id = `cat-sec-${cat.id}`;

    const heading = document.createElement('h2');
    heading.className = 'category-heading';
    heading.textContent = cat.name;
    section.appendChild(heading);

    if (cat.description) {
      const desc = document.createElement('p');
      desc.className = 'category-desc';
      desc.textContent = cat.description;
      section.appendChild(desc);
    }

    const itemsGrid = document.createElement('div');
    itemsGrid.className = 'items-grid';

    visibleItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.onclick = () => openItemModal(item, currencySymbol);

      const info = document.createElement('div');
      info.className = 'item-info';

      const nameEl = document.createElement('div');
      nameEl.className = 'item-name';
      nameEl.textContent = item.name;
      info.appendChild(nameEl);

      const priceEl = document.createElement('div');
      priceEl.className = 'item-price';
      priceEl.textContent = `${currencySymbol}${Number(item.price).toFixed(2)}`;
      info.appendChild(priceEl);

      if (item.description) {
        const descEl = document.createElement('div');
        descEl.className = 'item-desc';
        descEl.textContent = item.description;
        info.appendChild(descEl);
      }

      // Dietary tags
      const tagsWrap = document.createElement('div');
      tagsWrap.className = 'item-tags';

      if (item.dietary_flags) {
        const flags = item.dietary_flags.split(',').map(f => f.trim()).filter(Boolean);
        flags.forEach(flag => {
          const badge = document.createElement('span');
          badge.className = 'badge badge-tag';
          badge.textContent = flag;
          tagsWrap.appendChild(badge);
        });
      }

      info.appendChild(tagsWrap);
      card.appendChild(info);

      // Thumbnail Image
      if (item.media_url) {
        const thumb = document.createElement('img');
        thumb.className = 'item-media-thumb';
        thumb.src = item.media_url;
        thumb.alt = item.name;
        thumb.loading = 'lazy';
        card.appendChild(thumb);
      }

      itemsGrid.appendChild(card);
    });

    section.appendChild(itemsGrid);
    contentEl.appendChild(section);
  });

  if (totalItemsCount === 0) {
    contentEl.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #64748b;">
        <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
        <p>No dishes match "${currentSearchTerm}".</p>
      </div>
    `;
  }
}

function filterItems(term) {
  currentSearchTerm = term;
  renderActiveMenuContent();
}

// Search input listener
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterItems(e.target.value.trim());
    });
  }
  loadMenu();
});

// Modal Logic
function openItemModal(item, currencySymbol) {
  const modal = document.getElementById('item-modal');
  const imgEl = document.getElementById('modal-item-img');
  
  if (item.media_url) {
    imgEl.src = item.media_url;
    imgEl.style.display = 'block';
  } else {
    imgEl.style.display = 'none';
  }

  document.getElementById('modal-item-name').textContent = item.name;
  document.getElementById('modal-item-price').textContent = `${currencySymbol}${Number(item.price).toFixed(2)}`;
  document.getElementById('modal-item-desc').textContent = item.description || 'Crafted fresh to order with premium seasonal ingredients.';

  const tagsEl = document.getElementById('modal-item-tags');
  tagsEl.innerHTML = '';
  if (item.dietary_flags) {
    const flags = item.dietary_flags.split(',').map(f => f.trim()).filter(Boolean);
    flags.forEach(flag => {
      const badge = document.createElement('span');
      badge.className = 'badge badge-tag';
      badge.textContent = flag;
      tagsEl.appendChild(badge);
    });
  }

  const allergenWrap = document.getElementById('modal-item-allergens-wrap');
  const allergenText = document.getElementById('modal-item-allergens');
  if (item.allergens && item.allergens.trim() !== '') {
    allergenWrap.style.display = 'block';
    allergenText.textContent = item.allergens;
  } else {
    allergenWrap.style.display = 'none';
  }

  modal.classList.add('active');
}

function closeItemModal() {
  document.getElementById('item-modal').classList.remove('active');
}

// Close on overlay click
document.getElementById('item-modal').addEventListener('click', (e) => {
  if (e.target.id === 'item-modal') {
    closeItemModal();
  }
});
