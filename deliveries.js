/* =========================================================
   GreenHarvest Avocado Farm System
   deliveries.js

   Delivery tracking routes (deliveries.html, orders.html,
   admin-dashboard.html). Mounted by server.js at "/api".

   Deliveries are linked to orders; customers may only see the
   deliveries attached to their own orders.
   ========================================================= */

"use strict";

const express = require("express");

const { all, get, run } = require("./database.js");
const { authenticate, requireRole } = require("./users.js");

const router = express.Router();

const STAFF_ROLES = ["admin", "agronomist"];

const DELIVERY_STATUSES = [
  "Scheduled",
  "Dispatched",
  "In Transit",
  "Delivered",
  "Failed",
];

const DELIVERY_SELECT = [
  "d.id",
  "d.order_id",
  "d.driver_name",
  "d.vehicle",
  "d.destination",
  "d.status",
  "d.scheduled_date",
  "d.delivered_at",
  "d.notes",
  "d.created_at",
  "d.updated_at",
].join(", ");

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */

const str = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

function toId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function pageParams(query = {}, defaultLimit = 100, maxLimit = 500) {
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

function applyUpdates(table, id, fields) {
  const columns = Object.keys(fields);
  if (columns.length === 0) return 0;

  const assignments = columns.map((column) => `${column} = @${column}`);
  assignments.push("updated_at = CURRENT_TIMESTAMP");

  const info = run(
    `UPDATE ${table} SET ${assignments.join(", ")} WHERE id = @id`,
    { ...fields, id }
  );
  return info.changes;
}

const isStaff = (user) => Boolean(user) && STAFF_ROLES.includes(user.role);

function mapDelivery(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id,
    orderReference: row.order_reference || null,
    customerName: row.customer_name || null,
    driverName: row.driver_name,
    vehicle: row.vehicle,
    destination: row.destination,
    status: row.status,
    scheduledDate: row.scheduled_date,
    deliveredAt: row.delivered_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findDelivery(id) {
  return get(
    `SELECT ${DELIVERY_SELECT},
            o.reference AS order_reference,
            o.customer_name,
            o.user_id   AS order_user_id
     FROM deliveries d
     LEFT JOIN orders o ON o.id = d.order_id
     WHERE d.id = @id`,
    { id }
  );
}

const findOrder = (id) =>
  get(
    `SELECT id, reference, user_id, customer_name, delivery_address, status
     FROM orders WHERE id = @id`,
    { id }
  );

/* ---------------------------------------------------------
   GET /deliveries
   --------------------------------------------------------- */

router.get("/deliveries", authenticate, (req, res) => {
  const { limit, offset } = pageParams(req.query);

  const where = [];
  const params = { limit, offset };

  if (!isStaff(req.user)) {
    where.push("o.user_id = @userId");
    params.userId = req.user.id;
  } else {
    const requestedOrder = toId(req.query.order_id || req.query.orderId);
    if (requestedOrder) {
      where.push("d.order_id = @orderId");
      params.orderId = requestedOrder;
    }
  }

  const status = str(req.query.status);
  if (status) {
    where.push("d.status = @status");
    params.status = status;
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = all(
    `SELECT ${DELIVERY_SELECT},
            o.reference AS order_reference,
            o.customer_name
     FROM deliveries d
     LEFT JOIN orders o ON o.id = d.order_id
     ${clause}
     ORDER BY d.created_at DESC, d.id DESC
     LIMIT @limit OFFSET @offset`,
    params
  );

  res.json(rows.map(mapDelivery));
});

/* ---------------------------------------------------------
   GET /deliveries/:id
   --------------------------------------------------------- */

router.get("/deliveries/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid delivery id." });

  const row = findDelivery(id);
  if (!row) return res.status(404).json({ error: "Delivery not found." });

  const ownsOrder = row.order_user_id && row.order_user_id === req.user.id;
  if (!isStaff(req.user) && !ownsOrder) {
    return res.status(403).json({ error: "You cannot view this delivery." });
  }

  res.json(mapDelivery(row));
});

/* ---------------------------------------------------------
   POST /deliveries  (staff only)
   --------------------------------------------------------- */

router.post("/deliveries", authenticate, requireRole(...STAFF_ROLES), (req, res) => {
  const body = req.body || {};
  const orderId = toId(body.order_id || body.orderId);

  let order = null;
  if (orderId) {
    order = findOrder(orderId);
    if (!order) return res.status(404).json({ error: "Order not found." });
  }

  const status = str(body.status) || "Scheduled";
  if (!DELIVERY_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${DELIVERY_STATUSES.join(", ")}.`,
    });
  }

  const deliveredAt =
    status === "Delivered" ? str(body.delivered_at || body.deliveredAt) || new Date().toISOString() : null;

  const info = run(
    `INSERT INTO deliveries
       (order_id, driver_name, vehicle, destination, status,
        scheduled_date, delivered_at, notes)
     VALUES
       (@orderId, @driverName, @vehicle, @destination, @status,
        @scheduledDate, @deliveredAt, @notes)`,
    {
      orderId,
      driverName: str(body.driver_name || body.driverName) || null,
      vehicle: str(body.vehicle) || null,
      destination:
        str(body.destination) || (order ? order.delivery_address : null) || null,
      status,
      scheduledDate: str(body.scheduled_date || body.scheduledDate) || null,
      deliveredAt,
      notes: str(body.notes) || null,
    }
  );

  res.status(201).json(mapDelivery(findDelivery(info.lastInsertRowid)));
});

/* ---------------------------------------------------------
   PATCH /deliveries/:id  (staff only)
   --------------------------------------------------------- */

router.patch("/deliveries/:id", authenticate, requireRole(...STAFF_ROLES), (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid delivery id." });

  const existing = findDelivery(id);
  if (!existing) return res.status(404).json({ error: "Delivery not found." });

  const body = req.body || {};
  const fields = {};

  if (body.order_id !== undefined || body.orderId !== undefined) {
    const nextOrder = toId(body.order_id !== undefined ? body.order_id : body.orderId);
    if (nextOrder) {
      const order = findOrder(nextOrder);
      if (!order) return res.status(404).json({ error: "Order not found." });
    }
    fields.order_id = nextOrder;
  }
  if (body.driver_name !== undefined || body.driverName !== undefined) {
    fields.driver_name =
      str(body.driver_name !== undefined ? body.driver_name : body.driverName) || null;
  }
  if (body.vehicle !== undefined) fields.vehicle = str(body.vehicle) || null;
  if (body.destination !== undefined) {
    fields.destination = str(body.destination) || null;
  }
  if (body.scheduled_date !== undefined || body.scheduledDate !== undefined) {
    fields.scheduled_date =
      str(body.scheduled_date !== undefined ? body.scheduled_date : body.scheduledDate) ||
      null;
  }
  if (body.delivered_at !== undefined || body.deliveredAt !== undefined) {
    fields.delivered_at =
      str(body.delivered_at !== undefined ? body.delivered_at : body.deliveredAt) ||
      null;
  }
  if (body.notes !== undefined) fields.notes = str(body.notes) || null;

  if (body.status !== undefined) {
    const status = str(body.status);
    if (!DELIVERY_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${DELIVERY_STATUSES.join(", ")}.`,
      });
    }
    fields.status = status;
    if (status === "Delivered" && !fields.delivered_at) {
      fields.delivered_at = new Date().toISOString();
    }
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: "No supported fields supplied." });
  }

  applyUpdates("deliveries", id, fields);

  if (fields.status === "Delivered" && existing.order_id) {
    run(
      `UPDATE orders
       SET status = 'Delivered', updated_at = CURRENT_TIMESTAMP
       WHERE id = @orderId AND status <> 'Cancelled'`,
      { orderId: existing.order_id }
    );
  }

  res.json(mapDelivery(findDelivery(id)));
});

/* ---------------------------------------------------------
   PATCH /deliveries/:id/status  (staff only)
   --------------------------------------------------------- */

router.patch(
  "/deliveries/:id/status",
  authenticate,
  requireRole(...STAFF_ROLES),
  (req, res) => {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid delivery id." });

    const existing = findDelivery(id);
    if (!existing) return res.status(404).json({ error: "Delivery not found." });

    const status = str((req.body || {}).status);
    if (!DELIVERY_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${DELIVERY_STATUSES.join(", ")}.`,
      });
    }

    const fields = { status };
    if (status === "Delivered") fields.delivered_at = new Date().toISOString();

    applyUpdates("deliveries", id, fields);

    if (status === "Delivered" && existing.order_id) {
      run(
        `UPDATE orders
         SET status = 'Delivered', updated_at = CURRENT_TIMESTAMP
         WHERE id = @orderId AND status <> 'Cancelled'`,
        { orderId: existing.order_id }
      );
    }

    res.json(mapDelivery(findDelivery(id)));
  }
);

/* ---------------------------------------------------------
   DELETE /deliveries/:id  (admin only)
   --------------------------------------------------------- */

router.delete("/deliveries/:id", authenticate, requireRole("admin"), (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid delivery id." });

  const existing = findDelivery(id);
  if (!existing) return res.status(404).json({ error: "Delivery not found." });

  run("DELETE FROM deliveries WHERE id = @id", { id });
  res.status(204).end();
});

module.exports = router;
