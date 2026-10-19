/* =========================================================
   GreenHarvest Avocado Farm System
   database.js - SQLite connection, schema initialisation and
   lightweight data-access helpers consumed by the route layer.
   ========================================================= */

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, "database", "greenharvest.db");
const SCHEMA_PATH = path.join(__dirname, "database", "database.sql");

/* ---------------------------------------------------------
   Connection
   --------------------------------------------------------- */

let db;

function getDb() {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return db;
}

/* ---------------------------------------------------------
   Schema + seed
   --------------------------------------------------------- */

/**
 * Executes database/database.sql (idempotent: every statement uses
 * CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
 */
function initSchema() {
  const connection = getDb();

  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(`Schema file not found at ${SCHEMA_PATH}`);
  }

  const sql = fs.readFileSync(SCHEMA_PATH, "utf8");
  connection.exec(sql);

  return connection;
}

/**
 * Inserts demo records so the API returns something out of the box.
 * Safe to call repeatedly - it checks for existing rows first.
 */
function seed() {
  const connection = getDb();

  const userCount = connection
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get().count;

  if (userCount > 0) return false;

  const insertUser = connection.prepare(`
    INSERT INTO users (name, email, phone, role, password_hash)
    VALUES (@name, @email, @phone, @role, @password_hash)
  `);

  const insertProduct = connection.prepare(`
    INSERT INTO products
      (name, category, variety, description, price, unit, stock, image, seller_id)
    VALUES
      (@name, @category, @variety, @description, @price, @unit, @stock, @image, @seller_id)
  `);

  const insertSeedling = connection.prepare(`
    INSERT INTO seedlings
      (name, variety, description, price, unit, stock, image, seller_id)
    VALUES
      (@name, @variety, @description, @price, @unit, @stock, @image, @seller_id)
  `);

  const hash = (plain) => bcrypt.hashSync(plain, 10);

  const seedAll = connection.transaction(() => {
    const users = [
      ["System Admin", "admin@greenharvest.co.ke", "+254700000001", "admin", "admin123"],
      ["Dr. Wanjiru Agronomy", "agronomist@greenharvest.co.ke", "+254700000002", "agronomist", "agro123"],
      ["Brian Otieno", "buyer@greenharvest.co.ke", "+254700000003", "buyer", "buyer123"],
      ["Mary Kamau", "farmer@greenharvest.co.ke", "+254700000004", "farmer", "farmer123"],
    ];

    const userIds = {};
    for (const [name, email, phone, role, password] of users) {
      const info = insertUser.run({
        name,
        email,
        phone,
        role,
        password_hash: hash(password),
      });
      userIds[email] = info.lastInsertRowid;
    }

    const farmerId = userIds["farmer@greenharvest.co.ke"];

    // Only use image files that actually exist in public/images/.
    // See README / public/images/ for the real asset names.
    const products = [
      ["Hass Avocado (Grade A)", "Fruit", "Hass", "Premium export-grade Hass avocados, freshly harvested.", 120, "kg", 850, "images/marketplace.jpg", farmerId],
      ["Fuerte Avocado", "Fruit", "Fuerte", "Creamy Fuerte avocados ideal for local markets.", 95, "kg", 620, "images/marketplace.jpg", farmerId],
      ["Jumbo Avocado", "Fruit", "Jumbo", "Large jumbo variety with a high oil content.", 140, "kg", 300, "images/marketplace.jpg", farmerId],
      ["Organic Avocado Oil", "Processed", "Cold Pressed", "500ml bottle of cold-pressed avocado oil.", 750, "bottle", 120, "images/marketplace.jpg", farmerId],
    ];

    for (const p of products) {
      insertProduct.run({
        name: p[0],
        category: p[1],
        variety: p[2],
        description: p[3],
        price: p[4],
        unit: p[5],
        stock: p[6],
        image: p[7],
        seller_id: p[8],
      });
    }

    const seedlings = [
      ["Hass Grafted Seedling", "Hass", "Disease-resistant grafted Hass seedling.", 250, "seedling", 1500, "images/seedlings.jpg", farmerId],
      ["Fuerte Grafted Seedling", "Fuerte", "Hardy Fuerte seedling suited to highland farms.", 220, "seedling", 900, "images/seedlings.jpg", farmerId],
      ["Pinkerton Seedling", "Pinkerton", "Early-bearing Pinkerton seedling.", 240, "seedling", 700, "images/seedlings.jpg", farmerId],
    ];

    for (const s of seedlings) {
      insertSeedling.run({
        name: s[0],
        variety: s[1],
        description: s[2],
        price: s[3],
        unit: s[4],
        stock: s[5],
        image: s[6],
        seller_id: s[7],
      });
    }
  });

  seedAll();
  return true;
}

/**
 * Convenience bootstrap used by server.js and scripts/init-db.js.
 */
function initialise({ withSeed = true } = {}) {
  initSchema();
  if (withSeed) seed();
  return getDb();
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

/* ---------------------------------------------------------
   Small query helpers
   --------------------------------------------------------- */

const all = (sql, params = {}) => getDb().prepare(sql).all(params);
const get = (sql, params = {}) => getDb().prepare(sql).get(params);
const run = (sql, params = {}) => getDb().prepare(sql).run(params);

module.exports = {
  DB_PATH,
  SCHEMA_PATH,
  getDb,
  initSchema,
  seed,
  initialise,
  close,
  all,
  get,
  run,
};
