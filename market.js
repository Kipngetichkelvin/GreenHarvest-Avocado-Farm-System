/* =========================================================
   GreenHarvest Avocado Farm System
   market.js

   Marketplace routes: products, seedlings, cart, orders and
   payments. Mounted by server.js at "/api".

   Table mapping (frontend localStorage -> SQLite):
     products         -> products
     seedlings        -> seedlings
     greenHarvestCart -> cart_items
     greenHarvestOrders  (+ order_items) -> orders
     greenHarvestPayments -> payments
   ========================================================= */

"use strict";

const express = require("express");

const { all, get, run, getDb } = require("./database.js");
const { authenticate, requireRole } = require("./users.js");

const router = express.Router();

const SELLER_ROLES = ["admin", "farmer", "agronomist"];
const STAFF_ROLES = ["admin", "agronomist"];
const CART_MANAGER_ROLES = ["admin"];
const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
];
const PAYMENT_METHODS = ["mpesa", "card", "bank", "cash", "paypal"];
const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded"];

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */

const str = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

function toId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const round2 = (value) => Math.round(value * 100) / 100;

function pageParams(query = {}, defaultLimit = 50, maxLimit = 200) {
  const parsedLimit = Number.parseInt(query.limit, 10);
  const parsedOffset = Number.parseInt(query.offset, 10);
  return {
    limit:
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, maxLimit)
        : defaultLimit,
    offset: Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0,
  };
}

/** Human-readable, collision-resistant reference (ORD-/PAY-...). */
function makeReference(prefix) {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

/** Builds a whitelist-driven UPDATE. Returns the number of rows changed. */
function applyUpdates(table, id, fields, { touch = true } = {}) {
  const columns = Object.keys(fields);
  if (columns.length === 0) return 0;

  const assignments = columns.map((column) => `${column} = @${column}`);
  if (touch) assignments.push("updated_at = CURRENT_TIMESTAMP");

  const info = run(
    `UPDATE ${table} SET ${assignments.join(", ")} WHERE id = @id`,
    { ...fields, id }
  );
  return info.changes;
}

/* ---------------------------------------------------------
   Products
   --------------------------------------------------------- */

router.get("/products", (req, res) => {
  const { limit, offset } = pageParams(req.query);
  const search = str(req.query.q);
  const category = str(req.query.category);
  const variety = str(req.query.variety);
  const sellerId = toId(req.query.seller_id || req.query.sellerId);
  const minPrice = toNumber(req.query.min_price || req.query.minPrice);
  const maxPrice = toNumber(req.query.max_price || req.query.maxPrice);
  const includeInactive =
    str(req.query.include_inactive) === "1" || str(req.query.include_inactive) === "true";

  const where = [];
  const params = { limit, offset };

  if (!includeInactive) where.push("is_active = 1");
  if (search) {
    where.push("(name LIKE @search OR variety LIKE @search OR description LIKE @search)");
    params.search = `%${search}%`;
  }
  if (category) {
    where.push("category = @category");
    params.category = category;
  }
  if (variety) {
    where.push("variety = @variety");
    params.variety = variety;
  }
  if (sellerId) {
    where.push("seller_id = @sellerId");
    params.sellerId = sellerId;
  }
  if (minPrice !== null) {
    where.push("price >= @minPrice");
    params.minPrice = minPrice;
  }
  if (maxPrice !== null) {
    where.push("price <= @maxPrice");
    params.maxPrice = maxPrice;
  }

  const rows = all(
    `SELECT p.*, u.name AS seller_name
     FROM products p
     LEFT JOIN users u ON u.id = p.seller_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT @limit OFFSET @offset`,
    params
  );

  res.json({ data: rows, limit, offset });
});

router.get("/products/:id", (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid product id." });

  const product = get(
    `SELECT p.*, u.name AS seller_name
     FROM products p
     LEFT JOIN users u ON u.id = p.seller_id
     WHERE p.id = @id`,
    { id }
  );
  if (!product) return res.status(404).json({ error: "Product not found." });

  return res.json({ product });
});

router.post("/products", authenticate, requireRole(SELLER_ROLES), (req, res) => {
  const body = req.body || {};
  const name = str(body.name);
  if (!name) return res.status(400).json({ error: "A product name is required." });

  const price = toNumber(body.price);
  if (price === null || price < 0) {
    return res.status(400).json({ error: "A non-negative price is required." });
  }

  const sellerId = req.user.role === "admin" ? toId(body.seller_id || body.sellerId) || req.user.id : req.user.id;

  const info = run(
    `INSERT INTO products
       (name, category, variety, description, price, unit, stock, image, seller_id, is_active)
     VALUES
       (@name, @category, @variety, @description, @price, @unit, @stock, @image, @sellerId, @isActive)`,
    {
      name,
      category: str(body.category) || "avocado",
      variety: str(body.variety) || null,
      description: str(body.description) || null,
      price,
      unit: str(body.unit) || "kg",
      stock: toNumber(body.stock) ?? 0,
      image: str(body.image) || null,
      sellerId,
      isActive: body.is_active === false ? 0 : 1,
    }
  );

  const product = get("SELECT * FROM products WHERE id = @id", {
    id: info.lastInsertRowid,
  });
  return res.status(201).json({ product });
});

router.patch("/products/:id", authenticate, requireRole(SELLER_ROLES), (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid product id." });

  const product = get("SELECT * FROM products WHERE id = @id", { id });
  if (!product) return res.status(404).json({ error: "Product not found." });
  if (req.user.role !== "admin" && product.seller_id !== req.user.id) {
    return res.status(403).json({ error: "You may only edit your own products." });
  }

  const body = req.body || {};
  const fields = {};

  if (body.name !== undefined) {
    const name = str(body.name);
    if (!name) return res.status(400).json({ error: "A product name is required." });
    fields.name = name;
  }
  if (body.category !== undefined) fields.category = str(body.category) || "avocado";
  if (body.variety !== undefined) fields.variety = str(body.variety) || null;
  if (body.description !== undefined) fields.description = str(body.description) || null;
  if (body.unit !== undefined) fields.unit = str(body.unit) || "kg";
  if (body.image !== undefined) fields.image = str(body.image) || null;
  if (body.price !== undefined) {
    const price = toNumber(body.price);
    if (price === null || price < 0) {
      return res.status(400).json({ error: "A non-negative price is required." });
    }
    fields.price = price;
  }
  if (body.stock !== undefined) {
    const stock = toNumber(body.stock);
    if (stock === null) return res.status(400).json({ error: "Stock must be numeric." });
    fields.stock = stock;
  }
  if (body.is_active !== undefined) fields.is_active = body.is_active ? 1 : 0;

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: "No supported fields supplied." });
  }

  applyUpdates("products", id, fields);
  return res.json({ product: get("SELECT * FROM products WHERE id = @id", { id }) });
});

router.delete("/products/:id", authenticate, requireRole(SELLER_ROLES), (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid product id." });

  const product = get("SELECT * FROM products WHERE id = @id", { id });
  if (!product) return res.status(404).json({ error: "Product not found." });
  if (req.user.role !== "admin" && product.seller_id !== req.user.id) {
    return res.status(403).json({ error: "You may only remove your own products." });
  }

  // Soft delete keeps historical order_items meaningful.
  applyUpdates("products", id, { is_active: 0 });
  return res.status(204).send();
});

/* ---------------------------------------------------------
   Seedlings
   (no is_active/updated_at columns in the schema)
   --------------------------------------------------------- */

router.get("/seedlings", (req, res) => {
  const { limit, offset } = pageParams(req.query);
  const search = str(req.query.q);
  const variety = str(req.query.variety);
  const sellerId = toId(req.query.seller_id || req.query.sellerId);

  const where = [];
  const params = { limit, offset };

  if (search) {
    where.push("(name LIKE @search OR variety LIKE @search OR rootstock LIKE @search)");
    params.search = `%${search}%`;
  }
  if (variety) {
    where.push("variety = @variety");
    params.variety = variety;
  }
  if (sellerId) {
    where.push("seller_id = @sellerId");
    params.sellerId = sellerId;
  }

  const rows = all(
    `SELECT s.*, u.name AS seller_name
     FROM seedlings s
     LEFT JOIN users u ON u.id = s.seller_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY s.created_at DESC, s.id DESC
     LIMIT @limit OFFSET @offset`,
    params
  );

  res.json({ data: rows, limit, offset });
});

router.get("/seedlings/:id", (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid seedling id." });

  const seedling = get(
    `SELECT s.*, u.name AS seller_name
     FROM seedlings s
     LEFT JOIN users u ON u.id = s.seller_id
     WHERE s.id = @id`,
    { id }
  );
  if (!seedling) return res.status(404).json({ error: "Seedling not found." });

  return res.json({ seedling });
});

router.post("/seedlings", authenticate, requireRole(SELLER_ROLES), (req, res) => {
  const body = req.body || {};
  const name = str(body.name);
  if (!name) return res.status(400).json({ error: "A seedling name is required." });

  const price = toNumber(body.price);
  if (price === null || price < 0) {
    return res.status(400).json({ error: "A non-negative price is required." });
  }

  const sellerId =
    req.user.role === "admin"
      ? toId(body.seller_id || body.sellerId) || req.user.id
      : req.user.id;

  const info = run(
    `INSERT INTO seedlings
       (name, variety, rootstock, age_months, height_cm, price, unit, stock, description, image, seller_id)
     VALUES
       (@name, @variety, @rootstock, @ageMonths, @heightCm, @price, @unit, @stock, @description, @image, @sellerId)`,
    {
      name,
      variety: str(body.variety) || null,
      rootstock: str(body.rootstock) || null,
      ageMonths: toNumber(body.age_months || body.ageMonths),
      heightCm: toNumber(body.height_cm || body.heightCm),
      price,
      unit: str(body.unit) || "seedling",
      stock: toNumber(body.stock) ?? 0,
      description: str(body.description) || null,
      image: str(body.image) || null,
      sellerId,
    }
  );

  const seedling = get("SELECT * FROM seedlings WHERE id = @id", {
    id: info.lastInsertRowid,
  });
  return res.status(201).json({ seedling });
});

router.patch("/seedlings/:id", authenticate, requireRole(SELLER_ROLES), (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid seedling id." });

  const seedling = get("SELECT * FROM seedlings WHERE id = @id", { id });
  if (!seedling) return res.status(404).json({ error: "Seedling not found." });
  if (req.user.role !== "admin" && seedling.seller_id !== req.user.id) {
    return res.status(403).json({ error: "You may only edit your own seedlings." });
  }

  const body = req.body || {};
  const fields = {};

  if (body.name !== undefined) {
    const name = str(body.name);
    if (!name) return res.status(400).json({ error: "A seedling name is required." });
    fields.name = name;
  }
  if (body.variety !== undefined) fields.variety = str(body.variety) || null;
  if (body.rootstock !== undefined) fields.rootstock = str(body.rootstock) || null;
  if (body.description !== undefined) fields.description = str(body.description) || null;
  if (body.image !== undefined) fields.image = str(body.image) || null;
  if (body.unit !== undefined) fields.unit = str(body.unit) || "seedling";
  if (body.age_months !== undefined || body.ageMonths !== undefined) {
    fields.age_months = toNumber(body.age_months ?? body.ageMonths);
  }
  if (body.height_cm !== undefined || body.heightCm !== undefined) {
    fields.height_cm = toNumber(body.height_cm ?? body.heightCm);
  }
  if (body.price !== undefined) {
    const price = toNumber(body.price);
    if (price === null || price < 0) {
      return res.status(400).json({ error: "A non-negative price is required." });
    }
    fields.price = price;
  }
  if (body.stock !== undefined) {
    const stock = toNumber(body.stock);
    if (stock === null) return res.status(400).json({ error: "Stock must be numeric." });
    fields.stock = stock;
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: "No supported fields supplied." });
  }

  applyUpdates("seedlings", id, fields, { touch: false });
  return res.json({ seedling: get("SELECT * FROM seedlings WHERE id = @id", { id }) });
});

router.delete("/seedlings/:id", authenticate, requireRole(SELLER_ROLES), (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid seedling id." });

  const seedling = get("SELECT * FROM seedlings WHERE id = @id", { id });
  if (!seedling) return res.status(404).json({ error: "Seedling not found." });
  if (req.user.role !== "admin" && seedling.seller_id !== req.user.id) {
    return res.status(403).json({ error: "You may only remove your own seedlings." });
  }

  run("DELETE FROM seedlings WHERE id = @id", { id });
  return res.status(204).send();
});

/* ---------------------------------------------------------
   Cart  (greenHarvestCart)
   --------------------------------------------------------- */

router.get("/cart", authenticate, (req, res) => {
  const items = all(
    `SELECT c.id, c.user_id, c.product_id, c.name, c.price, c.quantity, c.added_at,
            p.image AS image, p.stock AS available_stock, p.unit AS unit
     FROM cart_items c
     LEFT JOIN products p ON p.id = c.product_id
     WHERE c.user_id = @userId
     ORDER BY c.added_at DESC, c.id DESC`,
    { userId: req.user.id }
  );

  const total = round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
  res.json({ data: items, count: items.length, total });
});

router.post("/cart", authenticate, (req, res) => {
  const body = req.body || {};
  const quantity = Math.max(1, Math.trunc(toNumber(body.quantity) ?? 1));
  const productId = toId(body.product_id || body.productId);

  let name = str(body.name);
  let price = toNumber(body.price);

  if (productId) {
    const product = get("SELECT * FROM products WHERE id = @id", { id: productId });
    if (!product || !product.is_active) {
      return res.status(404).json({ error: "Product not available." });
    }
    name = name || product.name;
    price = price === null ? product.price : price;
  }

  if (!name) return res.status(400).json({ error: "A cart item name is required." });
  if (price === null || price < 0) {
    return res.status(400).json({ error: "A non-negative price is required." });
  }

  const existing = productId
    ? get(
        "SELECT id, quantity FROM cart_items WHERE user_id = @userId AND product_id = @productId",
        { userId: req.user.id, productId }
      )
    : null;

  let cartItemId;
  if (existing) {
    run("UPDATE cart_items SET quantity = @quantity WHERE id = @id", {
      quantity: existing.quantity + quantity,
      id: existing.id,
    });
    cartItemId = existing.id;
  } else {
    const info = run(
      `INSERT INTO cart_items (user_id, product_id, name, price, quantity)
       VALUES (@userId, @productId, @name, @price, @quantity)`,
      { userId: req.user.id, productId: productId || null, name, price, quantity }
    );
    cartItemId = info.lastInsertRowid;
  }

  const item = get(
    "SELECT id, user_id, product_id, name, price, quantity, added_at FROM cart_items WHERE id = @id",
    { id: cartItemId }
  );
  return res.status(201).json({ item });
});

router.patch("/cart/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid cart item id." });

  const item = get("SELECT * FROM cart_items WHERE id = @id", { id });
  if (!item) return res.status(404).json({ error: "Cart item not found." });
  if (item.user_id !== req.user.id && !CART_MANAGER_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: "You may only edit your own cart." });
  }

  const body = req.body || {};
  const quantity = Math.trunc(toNumber(body.quantity) ?? item.quantity);
  if (quantity < 1) {
    run("DELETE FROM cart_items WHERE id = @id", { id });
    return res.status(204).send();
  }

  run("UPDATE cart_items SET quantity = @quantity WHERE id = @id", { quantity, id });
  return res.json({
    item: get(
      "SELECT id, user_id, product_id, name, price, quantity, added_at FROM cart_items WHERE id = @id",
      { id }
    ),
  });
});

router.delete("/cart/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid cart item id." });

  const item = get("SELECT user_id FROM cart_items WHERE id = @id", { id });
  if (!item) return res.status(404).json({ error: "Cart item not found." });
  if (item.user_id !== req.user.id && !CART_MANAGER_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: "You may only edit your own cart." });
  }

  run("DELETE FROM cart_items WHERE id = @id", { id });
  return res.status(204).send();
});

router.delete("/cart", authenticate, (req, res) => {
  run("DELETE FROM cart_items WHERE user_id = @userId", { userId: req.user.id });
  return res.status(204).send();
});

/* ---------------------------------------------------------
   Orders  (greenHarvestOrders + order_items)
   --------------------------------------------------------- */

router.get("/orders", authenticate, (req, res) => {
  const { limit, offset } = pageParams(req.query);
  const status = str(req.query.status);
  const withItems = str(req.query.with_items) === "1";
  const seesEverything = ["admin", "agronomist"].includes(req.user.role);

  const where = [];
  const params = { limit, offset };

  if (!seesEverything) {
    where.push("o.user_id = @userId");
    params.userId = req.user.id;
  }
  if (status && ORDER_STATUSES.includes(status)) {
    where.push("o.status = @status");
    params.status = status;
  }

  const rows = all(
    `SELECT o.* FROM orders o
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT @limit OFFSET @offset`,
    params
  );

  const data = rows.map((order) =>
    withItems ? { ...order, items: orderItems(order.id) } : order
  );

  res.json({ data, limit, offset });
});

function orderItems(orderId) {
  return all(
    `SELECT id, order_id, product_id, name, price, quantity, subtotal
     FROM order_items WHERE order_id = @orderId ORDER BY id ASC`,
    { orderId }
  );
}

router.get("/orders/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid order id." });

  const order = get("SELECT * FROM orders WHERE id = @id", { id });
  if (!order) return res.status(404).json({ error: "Order not found." });

  const canView =
    ["admin", "agronomist"].includes(req.user.role) || order.user_id === req.user.id;
  if (!canView) {
    return res.status(403).json({ error: "You may only view your own orders." });
  }

  const payments = all(
    `SELECT id, reference, method, amount, currency, status, transaction_id, created_at
     FROM payments WHERE order_id = @id ORDER BY created_at DESC, id DESC`,
    { id }
  );

  return res.json({ order, items: orderItems(id), payments });
});

router.post("/orders", authenticate, (req, res) => {
  const body = req.body || {};

  let items = Array.isArray(body.items) ? body.items : null;
  if (!items || items.length === 0) {
    const cartRows = all(
      "SELECT product_id, name, price, quantity FROM cart_items WHERE user_id = @userId ORDER BY id ASC",
      { userId: req.user.id }
    );
    if (cartRows.length === 0) {
      return res
        .status(400)
        .json({ error: "No order items supplied and the cart is empty." });
    }
    items = cartRows;
  }

  const normalised = [];
  for (const raw of items) {
    const name = str(raw.name);
    const price = toNumber(raw.price);
    const quantity = Math.max(1, Math.trunc(toNumber(raw.quantity) ?? 1));

    if (!name || price === null || price < 0) {
      return res.status(400).json({
        error: "Every order item requires a name and a non-negative price.",
      });
    }

    const productId = toId(raw.product_id || raw.productId);
    normalised.push({
      product_id: productId || null,
      name,
      price,
      quantity,
      subtotal: round2(price * quantity),
    });
  }

  const total =
    body.total !== undefined && toNumber(body.total) !== null
      ? round2(toNumber(body.total))
      : round2(normalised.reduce((sum, item) => sum + item.subtotal, 0));

  let status = str(body.status) || "Pending";
  if (!ORDER_STATUSES.includes(status)) status = "Pending";
  if (status !== "Pending" && !["admin", "agronomist"].includes(req.user.role)) {
    status = "Pending";
  }

  const reference = str(body.reference) || makeReference("ORD");
  const db = getDb();

  const createOrder = db.transaction(() => {
    const info = run(
      `INSERT INTO orders
         (reference, user_id, customer_name, customer_email, customer_phone,
          delivery_address, total, status, notes)
       VALUES
         (@reference, @userId, @customerName, @customerEmail, @customerPhone,
          @deliveryAddress, @total, @status, @notes)`,
      {
        reference,
        userId: req.user.id,
        customerName: str(body.customer_name || body.customerName) || req.user.name,
        customerEmail: str(body.customer_email || body.customerEmail) || req.user.email,
        customerPhone: str(body.customer_phone || body.customerPhone) || req.user.phone || null,
        deliveryAddress: str(body.delivery_address || body.deliveryAddress) || null,
        total,
        status,
        notes: str(body.notes) || null,
      }
    );

    const orderId = Number(info.lastInsertRowid);

    for (const item of normalised) {
      run(
        `INSERT INTO order_items (order_id, product_id, name, price, quantity, subtotal)
         VALUES (@orderId, @productId, @name, @price, @quantity, @subtotal)`,
        {
          orderId,
          productId: item.product_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.subtotal,
        }
      );
    }

    return orderId;
  });

  const orderId = createOrder();

  // The cart has been converted into an order.
  run("DELETE FROM cart_items WHERE user_id = @userId", { userId: req.user.id });

  return res.status(201).json({
    order: get("SELECT * FROM orders WHERE id = @id", { id: orderId }),
    items: orderItems(orderId),
  });
});

router.patch("/orders/:id/status", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid order id." });

  const order = get("SELECT * FROM orders WHERE id = @id", { id });
  if (!order) return res.status(404).json({ error: "Order not found." });

  const body = req.body || {};
  const status = str(body.status);

  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Status must be one of: ${ORDER_STATUSES.join(", ")}.`,
    });
  }

  const isStaff = ["admin", "agronomist"].includes(req.user.role);
  const isOwner = order.user_id === req.user.id;

  if (!isStaff && !(isOwner && status === "Cancelled")) {
    return res.status(403).json({
      error: "Only staff may change order status (customers may cancel their own order).",
    });
  }

  applyUpdates("orders", id, { status });
  return res.json({ order: get("SELECT * FROM orders WHERE id = @id", { id }) });
});

router.delete("/orders/:id", authenticate, requireRole("admin"), (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid order id." });

  if (!get("SELECT id FROM orders WHERE id = @id", { id })) {
    return res.status(404).json({ error: "Order not found." });
  }

  run("DELETE FROM orders WHERE id = @id", { id });
  return res.status(204).send();
});

/* ---------------------------------------------------------
   Payments  (greenHarvestPayments)
   --------------------------------------------------------- */

router.get("/payments", authenticate, (req, res) => {
  const { limit, offset } = pageParams(req.query);
  const status = str(req.query.status);
  const orderId = toId(req.query.order_id || req.query.orderId);
  const seesEverything = ["admin", "agronomist"].includes(req.user.role);

  const where = [];
  const params = { limit, offset };

  if (!seesEverything) {
    where.push("user_id = @userId");
    params.userId = req.user.id;
  }
  if (status && PAYMENT_STATUSES.includes(status)) {
    where.push("status = @status");
    params.status = status;
  }
  if (orderId) {
    where.push("order_id = @orderId");
    params.orderId = orderId;
  }

  const rows = all(
    `SELECT * FROM payments
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC, id DESC
     LIMIT @limit OFFSET @offset`,
    params
  );

  res.json({ data: rows, limit, offset });
});

router.get("/payments/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid payment id." });

  const payment = get("SELECT * FROM payments WHERE id = @id", { id });
  if (!payment) return res.status(404).json({ error: "Payment not found." });

  const canView =
    ["admin", "agronomist"].includes(req.user.role) || payment.user_id === req.user.id;
  if (!canView) {
    return res.status(403).json({ error: "You may only view your own payments." });
  }

  return res.json({ payment });
});

router.post("/payments", authenticate, (req, res) => {
  const body = req.body || {};
  const orderId = toId(body.order_id || body.orderId);

  let order = null;
  if (orderId) {
    order = get("SELECT * FROM orders WHERE id = @id", { id: orderId });
    if (!order) return res.status(404).json({ error: "Order not found." });

    const isStaff = ["admin", "agronomist"].includes(req.user.role);
    if (!isStaff && order.user_id !== req.user.id) {
      return res.status(403).json({ error: "You may only pay for your own orders." });
    }
  }

  const amount = toNumber(body.amount) ?? (order ? order.total : null);
  if (amount === null || amount < 0) {
    return res.status(400).json({ error: "A non-negative payment amount is required." });
  }

  let method = str(body.method).toLowerCase() || "mpesa";
  if (!PAYMENT_METHODS.includes(method)) {
    return res.status(400).json({
      error: `Payment method must be one of: ${PAYMENT_METHODS.join(", ")}.`,
    });
  }

  let status = str(body.status) || "Pending";
  if (!PAYMENT_STATUSES.includes(status)) status = "Pending";
  if (!["admin", "agronomist"].includes(req.user.role) && status !== "Pending") {
    status = "Pending"; // customers cannot self-confirm payments
  }

  const info = run(
    `INSERT INTO payments
       (reference, order_id, user_id, method, amount, currency, status,
        transaction_id, payer_name, payer_phone)
     VALUES
       (@reference, @orderId, @userId, @method, @amount, @currency, @status,
        @transactionId, @payerName, @payerPhone)`,
    {
      reference: str(body.reference) || makeReference("PAY"),
      orderId: orderId || null,
      userId: order ? order.user_id : req.user.id,
      method,
      amount: round2(amount),
      currency: str(body.currency) || "KSh",
      status,
      transactionId: str(body.transaction_id || body.transactionId) || null,
      payerName: str(body.payer_name || body.payerName) || req.user.name,
      payerPhone: str(body.payer_phone || body.payerPhone) || req.user.phone || null,
    }
  );

  const payment = get("SELECT * FROM payments WHERE id = @id", {
    id: info.lastInsertRowid,
  });

  // Keep the order lifecycle in step with a confirmed payment.
  if (order && status === "Paid" && order.status === "Pending") {
    applyUpdates("orders", orderId, { status: "Confirmed" });
  }

  return res.status(201).json({ payment });
});

router.patch("/payments/:id/status", authenticate, requireRole(STAFF_ROLES), (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid payment id." });

  const payment = get("SELECT * FROM payments WHERE id = @id", { id });
  if (!payment) return res.status(404).json({ error: "Payment not found." });

  const status = str((req.body || {}).status);
  if (!PAYMENT_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Status must be one of: ${PAYMENT_STATUSES.join(", ")}.`,
    });
  }

  applyUpdates("payments", id, { status });

  if (status === "Paid" && payment.order_id) {
    const order = get("SELECT id, status FROM orders WHERE id = @id", {
      id: payment.order_id,
    });
    if (order && order.status === "Pending") {
      applyUpdates("orders", order.id, { status: "Confirmed" });
    }
  }

  return res.json({ payment: get("SELECT * FROM payments WHERE id = @id", { id }) });
});

module.exports = router;
