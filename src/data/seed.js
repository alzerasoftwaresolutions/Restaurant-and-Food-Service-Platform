import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

import { getDb, withTransaction } from './db.js';
import { runMigrations } from './migrator.js';
import { config } from '../config/appConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const uploadsDir = path.join(rootDir, 'public', 'uploads');

export async function runSeed() {
  console.log('--- Initializing Database & Running Seed ---');
  await runMigrations(); // Ensure PostgreSQL schema migrations are applied

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Helper to create sample SVG media images
  function createSampleImage(filename, title, bgColor, accentColor) {
    const filePath = path.join(uploadsDir, filename);
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${accentColor};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#grad)" rx="16" />
      <circle cx="400" cy="260" r="110" fill="white" opacity="0.15" />
      <path d="M350 260 C350 200, 450 200, 450 260 Z" fill="white" opacity="0.8" />
      <rect x="330" y="270" width="140" height="24" rx="12" fill="white" opacity="0.9" />
      <text x="400" y="440" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="700" fill="#ffffff" text-anchor="middle">${title}</text>
      <text x="400" y="480" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" fill="#e2e8f0" text-anchor="middle">RFSP Core Platform v1</text>
    </svg>`;
    fs.writeFileSync(filePath, svgContent, 'utf-8');
    return `/uploads/${filename}`;
  }

  // Create sample images
  const logoUrl = createSampleImage('logo_aura.svg', 'Aura Artisan Bistro', '#0f172a', '#3b82f6');
  const bannerUrl = createSampleImage('banner_aura.svg', 'Farm-to-Table Cuisine', '#1e1b4b', '#d97706');
  const burrataImg = createSampleImage('burrata.svg', 'Truffle Burrata', '#064e3b', '#10b981');
  const ribeyeImg = createSampleImage('ribeye.svg', 'Prime Ribeye Steak', '#450a0a', '#ef4444');
  const pizzaImg = createSampleImage('margherita.svg', 'Neapolitan Margherita', '#7c2d12', '#f97316');
  const tiramisuImg = createSampleImage('tiramisu.svg', 'Classic Tiramisu', '#3e2723', '#8d6e63');
  const mocktailImg = createSampleImage('botanical.svg', 'Botanical Spritz', '#134e4a', '#14b8a6');

  await withTransaction(async (client) => {
    // 1. Roles
    await client.query(`
      INSERT INTO roles (id, name, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `, ['role_admin', 'admin', 'Full administrative access']);

    await client.query(`
      INSERT INTO roles (id, name, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `, ['role_manager', 'manager', 'Restaurant & branch manager access']);

    // 2. Users (Platform Admin & Manager)
    const adminHash = await bcrypt.hash('AdminPass123!', 10);
    const managerHash = await bcrypt.hash('ManagerPass123!', 10);

    await client.query(`
      INSERT INTO users (id, username, email, password_hash, full_name, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = CURRENT_TIMESTAMP
    `, ['usr_admin', 'admin', 'admin@rfsp.local', adminHash, 'Platform Administrator']);

    await client.query(`
      INSERT INTO users (id, username, email, password_hash, full_name, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = CURRENT_TIMESTAMP
    `, ['usr_manager', 'manager', 'manager@rfsp.local', managerHash, 'Downtown Branch Manager']);

    await client.query(`
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, role_id) DO NOTHING
    `, ['usr_admin', 'role_admin']);

    await client.query(`
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, role_id) DO NOTHING
    `, ['usr_manager', 'role_manager']);

    // 3. Media Assets
    const mediaList = [
      { id: 'med_logo', orig: 'logo_aura.svg', stored: 'logo_aura.svg', path: logoUrl, type: 'logo', alt: 'Aura Bistro Logo' },
      { id: 'med_banner', orig: 'banner_aura.svg', stored: 'banner_aura.svg', path: bannerUrl, type: 'banner', alt: 'Aura Bistro Banner' },
      { id: 'med_burrata', orig: 'burrata.svg', stored: 'burrata.svg', path: burrataImg, type: 'item_image', alt: 'Truffle Burrata' },
      { id: 'med_ribeye', orig: 'ribeye.svg', stored: 'ribeye.svg', path: ribeyeImg, type: 'item_image', alt: 'Prime Ribeye' },
      { id: 'med_pizza', orig: 'margherita.svg', stored: 'margherita.svg', path: pizzaImg, type: 'item_image', alt: 'Margherita Pizza' },
      { id: 'med_tiramisu', orig: 'tiramisu.svg', stored: 'tiramisu.svg', path: tiramisuImg, type: 'item_image', alt: 'Artisan Tiramisu' },
      { id: 'med_mocktail', orig: 'botanical.svg', stored: 'botanical.svg', path: mocktailImg, type: 'item_image', alt: 'Botanical Spritz' }
    ];

    for (const m of mediaList) {
      await client.query(`
        INSERT INTO media_assets (
          id, original_filename, stored_filename, file_path, mime_type, 
          file_size_bytes, asset_type, alt_text, created_at
        ) VALUES ($1, $2, $3, $4, 'image/svg+xml', 1024, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING
      `, [m.id, m.orig, m.stored, m.path, m.type, m.alt]);
    }

    // 4. Restaurant
    await client.query(`
      INSERT INTO restaurants (
        id, name, legal_name, slug, description, phone, email, website, 
        currency, logo_media_id, banner_media_id, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    `, [
      'rest_aura',
      'Aura Artisan Bistro',
      'Aura Hospitality Group LLC',
      'aura-artisan-bistro',
      'Modern Mediterranean & European cuisine crafted with seasonal, sustainably sourced organic ingredients.',
      '+1 (555) 234-5678',
      'contact@aurabistro.com',
      'https://aurabistro.com',
      'USD',
      'med_logo',
      'med_banner'
    ]);

    // 5. Branches
    await client.query(`
      INSERT INTO branches (
        id, restaurant_id, name, slug, code, address_line1, address_line2, 
        city, state, postal_code, country, phone, email, opening_hours, status, 
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    `, [
      'brn_downtown',
      'rest_aura',
      'Downtown Flagship',
      'downtown-flagship',
      'DT01',
      '100 Grand Avenue',
      'Suite 400',
      'New York',
      'NY',
      '10001',
      'USA',
      '+1 (555) 234-5671',
      'downtown@aurabistro.com',
      'Mon-Thu: 11:00 - 22:00 | Fri-Sat: 11:00 - 23:30 | Sun: 10:00 - 21:00'
    ]);

    await client.query(`
      INSERT INTO branches (
        id, restaurant_id, name, slug, code, address_line1, address_line2, 
        city, state, postal_code, country, phone, email, opening_hours, status, 
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    `, [
      'brn_westside',
      'rest_aura',
      'Westside Promenade',
      'westside-promenade',
      'WS02',
      '450 Ocean Boulevard',
      'Level 1',
      'Santa Monica',
      'CA',
      '90401',
      'USA',
      '+1 (555) 234-5672',
      'westside@aurabistro.com',
      'Tue-Sun: 11:30 - 22:30 | Mon: Closed'
    ]);

    // 6. Menus
    await client.query(`
      INSERT INTO menus (id, restaurant_id, name, description, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    `, ['menu_allday', 'rest_aura', 'All-Day Dining Menu', 'Signature artisanal dishes served daily.']);

    await client.query(`
      INSERT INTO menus (id, restaurant_id, name, description, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    `, ['menu_brunch', 'rest_aura', 'Weekend Brunch & Bakery', 'Freshly baked pastries, organic egg bowls, and morning spritzes.']);

    // 7. Categories
    const categories = [
      { id: 'cat_starters', menuId: 'menu_allday', name: 'Starters & Crudo', desc: 'Light appetizers to begin your dining journey', order: 1 },
      { id: 'cat_mains', menuId: 'menu_allday', name: 'Artisan Mains & Grills', desc: 'Handcrafted pasture-raised meats and seafood', order: 2 },
      { id: 'cat_pizza', menuId: 'menu_allday', name: 'Wood-Fired Neapolitan Pizza', desc: 'Slow-fermented 72-hour sourdough crust', order: 3 },
      { id: 'cat_desserts', menuId: 'menu_allday', name: 'House Pastries & Desserts', desc: 'Decadent sweet creations by our pastry chef', order: 4 },
      { id: 'cat_drinks', menuId: 'menu_allday', name: 'Craft Beverages & Mocktails', desc: 'Botanical infusions and specialty espresso', order: 5 }
    ];

    for (const c of categories) {
      await client.query(`
        INSERT INTO categories (id, menu_id, name, description, display_order, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          display_order = EXCLUDED.display_order,
          updated_at = CURRENT_TIMESTAMP
      `, [c.id, c.menuId, c.name, c.desc, c.order]);
    }

    // 8. Menu Items
    const items = [
      {
        id: 'item_burrata',
        catId: 'cat_starters',
        name: 'Truffle Pugliese Burrata',
        desc: 'Heirloom tomatoes, aged balsamic reduction, white truffle oil, toasted focaccia crisp.',
        price: 19.50,
        mediaId: 'med_burrata',
        avail: 1,
        allergens: 'Dairy, Gluten',
        dietary: 'Vegetarian',
        order: 1
      },
      {
        id: 'item_calamari',
        catId: 'cat_starters',
        name: 'Crispy Point Judith Calamari',
        desc: 'Wild-caught calamari with pickled Fresno chilies, lemon garlic aioli, fresh parsley.',
        price: 18.00,
        mediaId: null,
        avail: 1,
        allergens: 'Mollusks, Gluten, Egg',
        dietary: '',
        order: 2
      },
      {
        id: 'item_ribeye',
        catId: 'cat_mains',
        name: 'Prime Dry-Aged Ribeye (14oz)',
        desc: 'Grass-fed ribeye seared over white oak embers, served with roasted bone marrow butter and crispy rosemary fingerlings.',
        price: 48.00,
        mediaId: 'med_ribeye',
        avail: 1,
        allergens: 'Dairy',
        dietary: 'Gluten-Free',
        order: 1
      },
      {
        id: 'item_seabass',
        catId: 'cat_mains',
        name: 'Pan-Roasted Chilean Sea Bass',
        desc: 'Saffron emulsion, braised baby fennel, wild chanterelle mushrooms, Meyer lemon oil.',
        price: 42.50,
        mediaId: null,
        avail: 1,
        allergens: 'Fish, Dairy',
        dietary: 'Gluten-Free',
        order: 2
      },
      {
        id: 'item_margherita',
        catId: 'cat_pizza',
        name: 'D.O.P. Margherita Pizza',
        desc: 'San Marzano tomatoes, Fior di Latte mozzarella, organic sweet basil, extra virgin olive oil.',
        price: 22.00,
        mediaId: 'med_pizza',
        avail: 1,
        allergens: 'Dairy, Gluten',
        dietary: 'Vegetarian',
        order: 1
      },
      {
        id: 'item_tartufo',
        catId: 'cat_pizza',
        name: 'Black Truffle & Wild Mushroom Pizza',
        desc: 'Fontina, Taleggio, roasted cremini and shiitake, fresh shaved black summer truffle.',
        price: 27.00,
        mediaId: null,
        avail: 1,
        allergens: 'Dairy, Gluten',
        dietary: 'Vegetarian',
        order: 2
      },
      {
        id: 'item_tiramisu',
        catId: 'cat_desserts',
        name: 'Traditional Venetian Tiramisu',
        desc: 'Espresso-dipped savoiardi ladyfingers, velvety mascarpone cream, dark cocoa powder.',
        price: 12.50,
        mediaId: 'med_tiramisu',
        avail: 1,
        allergens: 'Dairy, Gluten, Egg',
        dietary: 'Vegetarian',
        order: 1
      },
      {
        id: 'item_botanical',
        catId: 'cat_drinks',
        name: 'Botanical Garden Spritz',
        desc: 'Distilled zero-proof botanicals, sparkling elderflower tonic, cucumber ribbon, fresh rosemary.',
        price: 9.50,
        mediaId: 'med_mocktail',
        avail: 1,
        allergens: '',
        dietary: 'Vegan, Gluten-Free',
        order: 1
      },
      {
        id: 'item_truffle_fries',
        catId: 'cat_starters',
        name: 'Hand-Cut Truffle Herb Fries',
        desc: 'Idaho russet potatoes, freshly grated 24-month Parmigiano-Reggiano, black truffle zest.',
        price: 13.00,
        mediaId: null,
        avail: 0, // Intentionally Unavailable to test availability filter!
        allergens: 'Dairy',
        dietary: 'Vegetarian',
        order: 3
      }
    ];

    for (const item of items) {
      await client.query(`
        INSERT INTO menu_items (
          id, category_id, name, description, price, currency, media_id, 
          is_available, allergens, dietary_flags, display_order, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'USD', $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          is_available = EXCLUDED.is_available,
          updated_at = CURRENT_TIMESTAMP
      `, [item.id, item.catId, item.name, item.desc, item.price, item.mediaId, item.avail, item.allergens, item.dietary, item.order]);
    }

    // 9. Menu Branch Assignments
    await client.query(`
      INSERT INTO menu_branch_assignments (id, menu_id, branch_id, is_active, created_at)
      VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (menu_id, branch_id) DO UPDATE SET is_active = 1
    `, ['asgn_1', 'menu_allday', 'brn_downtown']);

    await client.query(`
      INSERT INTO menu_branch_assignments (id, menu_id, branch_id, is_active, created_at)
      VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (menu_id, branch_id) DO UPDATE SET is_active = 1
    `, ['asgn_2', 'menu_allday', 'brn_westside']);

    await client.query(`
      INSERT INTO menu_branch_assignments (id, menu_id, branch_id, is_active, created_at)
      VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (menu_id, branch_id) DO UPDATE SET is_active = 1
    `, ['asgn_3', 'menu_brunch', 'brn_downtown']);

    // 10. QR Codes
    const dtQrUrl = `${config.publishing.publicMenuBaseUrl}/downtown-flagship`;
    const dtQrData = await QRCode.toDataURL(dtQrUrl, { width: 400, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });

    await client.query(`
      INSERT INTO qr_codes (
        id, branch_id, code, title, destination_url, 
        status, qr_image_data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'Active', $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET qr_image_data = EXCLUDED.qr_image_data, updated_at = CURRENT_TIMESTAMP
    `, ['qr_dt01', 'brn_downtown', 'QR_DT01_MAIN', 'Downtown Flagship Digital Menu', dtQrUrl, dtQrData]);

    const wsQrUrl = `${config.publishing.publicMenuBaseUrl}/westside-promenade`;
    const wsQrData = await QRCode.toDataURL(wsQrUrl, { width: 400, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });

    await client.query(`
      INSERT INTO qr_codes (
        id, branch_id, code, title, destination_url, 
        status, qr_image_data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'Active', $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET qr_image_data = EXCLUDED.qr_image_data, updated_at = CURRENT_TIMESTAMP
    `, ['qr_ws02', 'brn_westside', 'QR_WS02_MAIN', 'Westside Promenade Digital Menu', wsQrUrl, wsQrData]);

    // 11. Initial Audit Logs
    await client.query(`
      INSERT INTO audit_logs (
        id, actor_user_id, actor_username, action, target_type, target_id, details, result, ip_address, timestamp
      ) VALUES ($1, 'usr_admin', 'admin', 'SYSTEM_INITIALIZATION', 'PLATFORM', 'CORE_V1', 'Initial database seed with Aura Artisan Bistro', 'SUCCESS', '127.0.0.1', CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING
    `, ['aud_init_1']);

    await client.query(`
      INSERT INTO audit_logs (
        id, actor_user_id, actor_username, action, target_type, target_id, details, result, ip_address, timestamp
      ) VALUES ($1, 'usr_admin', 'admin', 'QR_CREATE', 'QR_CODE', 'qr_dt01', 'Created primary QR code for Downtown Flagship branch', 'SUCCESS', '127.0.0.1', CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING
    `, ['aud_init_2']);
  });

  console.log('--- Seed Data Generated Successfully ---');
  console.log('Admin User: admin / AdminPass123!');
  console.log('Manager User: manager / ManagerPass123!');
  console.log('Restaurant: Aura Artisan Bistro (slug: aura-artisan-bistro)');
  console.log('Branches: Downtown Flagship (/menu/downtown-flagship), Westside Promenade (/menu/westside-promenade)');
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runSeed()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error running seed:', err);
      process.exit(1);
    });
}
