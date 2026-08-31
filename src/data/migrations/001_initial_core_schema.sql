-- ==============================================================================
-- RFSP Core Platform v1 — Initial PostgreSQL Schema Migration
-- Strictly bounded by EDA-001, SA-001, and CORE-IMP-001
-- ==============================================================================

-- 1. Platform Services: Identity & Access
CREATE TABLE roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles (
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id VARCHAR(64) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- 2. Business Core: Organization Management
CREATE TABLE restaurants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    slug VARCHAR(128) UNIQUE NOT NULL,
    description TEXT,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    phone VARCHAR(32),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_media_id VARCHAR(64),
    banner_media_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE branches (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(32) NOT NULL,
    slug VARCHAR(128) UNIQUE NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(128) NOT NULL,
    state VARCHAR(128),
    postal_code VARCHAR(32),
    country VARCHAR(64) NOT NULL DEFAULT 'USA',
    phone VARCHAR(32),
    email VARCHAR(255),
    opening_hours TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_branch_rest_code UNIQUE (restaurant_id, code)
);

-- 3. Business Core: Menu Management
CREATE TABLE menus (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
    id VARCHAR(64) PRIMARY KEY,
    menu_id VARCHAR(64) NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. Platform Services: Media Management
CREATE TABLE media_assets (
    id VARCHAR(64) PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    asset_type VARCHAR(64) NOT NULL DEFAULT 'general',
    alt_text VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5. Business Core: Menu Items
CREATE TABLE menu_items (
    id VARCHAR(64) PRIMARY KEY,
    category_id VARCHAR(64) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    dietary_flags VARCHAR(255),
    allergens VARCHAR(255),
    media_id VARCHAR(64) REFERENCES media_assets(id) ON DELETE SET NULL,
    is_available SMALLINT NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. Business Core: Menu-Branch Assignments (Many-to-Many)
CREATE TABLE menu_branch_assignments (
    id VARCHAR(64) PRIMARY KEY,
    menu_id VARCHAR(64) NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    is_active SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_menu_branch UNIQUE (menu_id, branch_id)
);

-- 7. Core Publishing Capability: QR Publishing
CREATE TABLE qr_codes (
    id VARCHAR(64) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    code VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    destination_url VARCHAR(512) NOT NULL,
    qr_image_data TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Disabled', 'Expired')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 8. Platform Services: Audit Logging
CREATE TABLE audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    actor_user_id VARCHAR(64),
    actor_username VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(64),
    details TEXT,
    ip_address VARCHAR(64),
    result VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 9. Platform Services: Configuration
CREATE TABLE configuration (
    key VARCHAR(128) PRIMARY KEY,
    value TEXT NOT NULL,
    description VARCHAR(255),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 10. Performance & Lookup Indexes
CREATE INDEX idx_branches_restaurant_id ON branches(restaurant_id);
CREATE INDEX idx_branches_slug ON branches(slug);
CREATE INDEX idx_menus_restaurant_id ON menus(restaurant_id);
CREATE INDEX idx_menus_status ON menus(status);
CREATE INDEX idx_categories_menu_id ON categories(menu_id);
CREATE INDEX idx_categories_display_order ON categories(display_order);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_menu_items_is_available ON menu_items(is_available);
CREATE INDEX idx_assignments_branch_id ON menu_branch_assignments(branch_id);
CREATE INDEX idx_assignments_menu_id ON menu_branch_assignments(menu_id);
CREATE INDEX idx_qr_codes_branch_id ON qr_codes(branch_id);
CREATE INDEX idx_qr_codes_code ON qr_codes(code);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_target_type ON audit_logs(target_type);
