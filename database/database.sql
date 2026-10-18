-- =========================================================
-- GreenHarvest Avocado Farm System - Database Schema
-- ---------------------------------------------------------
-- Engine: SQLite (via better-sqlite3)
-- This schema mirrors the client-side localStorage data model
-- used by the static frontend prototype so the Node/Express API
-- can act as a drop-in persistence layer.
--
-- Frontend localStorage keys mapped to tables:
--   greenHarvestUser             -> users
--   greenHarvestOrders           -> orders (+ order_items)
--   greenHarvestPayments         -> payments
--   greenHarvestCart             -> cart_items
--   greenHarvestFarm             -> farms
--   greenHarvestServiceRequests  -> service_requests
--   marketplace products         -> products
--   seeded produce (seedlings)   -> seedlings
--   deliveries                   -> deliveries
-- =========================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- users
-- Mirrors: { name, email, phone, role, password, registeredAt }
-- Roles: admin | agronomist | buyer | farmer
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    email          TEXT    NOT NULL UNIQUE,
    phone          TEXT,
    role           TEXT    NOT NULL DEFAULT 'buyer'
                   CHECK (role IN ('admin', 'agronomist', 'buyer', 'farmer')),
    password_hash  TEXT    NOT NULL,
    registered_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);

-- ---------------------------------------------------------
-- farms
-- Mirrors the single `greenHarvestFarm` object:
--   { farmName, location, size, ...formFields, updatedAt }
-- A user may own/operate more than one farm.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS farms (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id      INTEGER NOT NULL,
    farm_name     TEXT,
    location      TEXT,
    size_acres    REAL,
    soil_type     TEXT,
    irrigation    TEXT,
    tree_count    INTEGER,
    variety       TEXT,
    established   TEXT,
    notes         TEXT,
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_farms_owner ON farms (owner_id);

-- ---------------------------------------------------------
-- farmer_profiles
-- Extra agronomic details for users with role = 'farmer'
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS farmer_profiles (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL UNIQUE,
    farm_size        TEXT,
    location         TEXT,
    primary_variety  TEXT,
    experience_years INTEGER,
    certifications   TEXT,
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- products
-- Marketplace catalogue (avocado-market.html / marketplace.html)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    category     TEXT    NOT NULL DEFAULT 'avocado',
    variety      TEXT,
    description  TEXT,
    price        REAL    NOT NULL DEFAULT 0,   -- price per unit in KSh
    unit         TEXT    NOT NULL DEFAULT 'kg',
    stock        INTEGER NOT NULL DEFAULT 0,
    image        TEXT,
    seller_id    INTEGER,
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT,
    FOREIGN KEY (seller_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

-- ---------------------------------------------------------
-- seedlings
-- Seedling catalogue (seedlings.html)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS seedlings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    variety       TEXT,
    rootstock     TEXT,
    age_months    INTEGER,
    height_cm     INTEGER,
    price         REAL    NOT NULL DEFAULT 0,   -- in KSh
    unit          TEXT    NOT NULL DEFAULT 'seedling',
    stock         INTEGER NOT NULL DEFAULT 0,
    description   TEXT,
    image         TEXT,
    seller_id     INTEGER,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (seller_id) REFERENCES users (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- cart_items
-- Mirrors `greenHarvestCart` array entries:
--   { name, price, quantity, addedAt }
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS cart_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    product_id INTEGER,
    name       TEXT    NOT NULL,
    price      REAL    NOT NULL DEFAULT 0,
    quantity   INTEGER NOT NULL DEFAULT 1,
    added_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items (user_id);

-- ---------------------------------------------------------
-- orders
-- Mirrors `greenHarvestOrders` entries:
--   { id: "GH-<timestamp>", customerName, ..., status, createdAt }
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    reference      TEXT    NOT NULL UNIQUE,     -- e.g. GH-1730000000000
    user_id        INTEGER,
    customer_name  TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    delivery_address TEXT,
    total          REAL    NOT NULL DEFAULT 0,  -- in KSh
    status         TEXT    NOT NULL DEFAULT 'Pending'
                   CHECK (status IN ('Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
    notes          TEXT,
    created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at     TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user   ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

-- ---------------------------------------------------------
-- order_items
-- Line items belonging to an order
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL,
    product_id INTEGER,
    name       TEXT    NOT NULL,
    price      REAL    NOT NULL DEFAULT 0,
    quantity   INTEGER NOT NULL DEFAULT 1,
    subtotal   REAL    NOT NULL DEFAULT 0,
    FOREIGN KEY (order_id)   REFERENCES orders (id)   ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

-- ---------------------------------------------------------
-- payments
-- Mirrors `greenHarvestPayments` entries:
--   { id: "PAY-<timestamp>", method, amount, status, createdAt }
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    reference      TEXT    NOT NULL UNIQUE,      -- e.g. PAY-1730000000000
    order_id       INTEGER,
    user_id        INTEGER,
    method         TEXT    NOT NULL DEFAULT 'mpesa'
                   CHECK (method IN ('mpesa', 'card', 'bank', 'cash', 'paypal')),
    amount         REAL    NOT NULL DEFAULT 0,   -- in KSh
    currency       TEXT    NOT NULL DEFAULT 'KSh',
    status         TEXT    NOT NULL DEFAULT 'Pending'
                   CHECK (status IN ('Pending', 'Paid', 'Failed', 'Refunded')),
    transaction_id TEXT,
    payer_name     TEXT,
    payer_phone    TEXT,
    created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at     TEXT,
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL,
    FOREIGN KEY (user_id)  REFERENCES users (id)  ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_order  ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);

-- ---------------------------------------------------------
-- service_requests
-- Mirrors `greenHarvestServiceRequests` entries.
-- Services: soil-testing, irrigation, disease-diagnosis,
--           farm-management, farm-services
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_requests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    reference     TEXT    NOT NULL UNIQUE,
    user_id       INTEGER,
    service_type  TEXT    NOT NULL,
    requester_name TEXT,
    contact_phone TEXT,
    location      TEXT,
    details       TEXT,
    preferred_date TEXT,
    status        TEXT    NOT NULL DEFAULT 'Pending'
                  CHECK (status IN ('Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled')),
    assigned_to   INTEGER,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT,
    FOREIGN KEY (user_id)     REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests (status);
CREATE INDEX IF NOT EXISTS idx_service_requests_type   ON service_requests (service_type);

-- ---------------------------------------------------------
-- deliveries
-- Delivery tracking for orders (deliveries.html)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliveries (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id       INTEGER,
    driver_name    TEXT,
    vehicle        TEXT,
    destination    TEXT,
    status         TEXT    NOT NULL DEFAULT 'Scheduled'
                   CHECK (status IN ('Scheduled', 'Dispatched', 'In Transit', 'Delivered', 'Failed')),
    scheduled_date TEXT,
    delivered_at   TEXT,
    notes          TEXT,
    created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at     TEXT,
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deliveries_order  ON deliveries (order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries (status);

-- ---------------------------------------------------------
-- notifications
-- Mirrors `greenHarvestNotifications` entries (notifications.html)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    title      TEXT    NOT NULL,
    message    TEXT,
    type       TEXT    NOT NULL DEFAULT 'info',
    is_read    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
