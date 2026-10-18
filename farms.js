/* =========================================================
   GreenHarvest Avocado Farm System
   farms.js

   Farm record routes (farm-management.html, farmer-dashboard.html,
   admin-dashboard.html). Mounted by server.js at "/api".

   Frontend localStorage key "greenHarvestFarm" -> farms table.

   Exports: the Express router (default single export).
   ========================================================= */

"use strict";

const express = require("express");

const { all, get, run } = require("./database.js");
const { authenticate, requireRole } = require("./users.js");

const router = express.Router();

const STAFF_ROLES = ["admin", "agronomist"];

const FARM_SELECT = [
  "f.id",
  "f.owner_id",
  "f.farm_name",
  "f.location",
  "f.size_acres",
  "f.soil_type",
  "f.irrigation",
  "f.tree_count",
  "f.variety",
  "f.established",
  "f.notes",
  "f.created_at",
  "f.updated_at",
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

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInt(value) {
  const parsed = toNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
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

/** Whitelist-driven UPDATE. Returns the number of rows changed. */
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

/** Snake_case -> camelCase API shape expected by the frontend. */
function mapFarm(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name || null,
    farmName: row.farm_name,
    name: row.farm_name,
    location: row.location,
    sizeAcres: row.size_acres,
    size: row.size_acres,
    soilType: row.soil_type,
    irrigation: row.irrigation,
    treeCount: row.tree_count,
    variety: row.variety,
    established: row.established,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findFarm(id) {
  return get(
    `SELECT ${FARM_SELECT}, u.name AS owner_name
     FROM farms f
     LEFT JOIN users u ON u.id = f.owner_id
     WHERE f.id = @id`,
    { id }
  );
}

/** Owner filter for the current request. Returns null when unrestricted. */
function resolveOwnerScope(req) {
  const requested = toId(req.query.owner_id || req.query.ownerId);
  if (isStaff(req.user)) return requested || null;
  return req.user.id;
}

function canManage(user, farm) {
  if (!user || !farm) return false;
  return user.role === "admin" || farm.owner_id === user.id;
}

/* ---------------------------------------------------------
   GET /farms/summary  (declared before "/farms/:id")
   --------------------------------------------------------- */

router.get("/farms/summary", authenticate, (req, res) => {
  const scope = resolveOwnerScope(req);

  const where = [];
  const params = {};
  if (scope) {
    where.push("owner_id = @ownerId");
    params.ownerId = scope;
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const row = get(
    `SELECT COUNT(*)                                AS farm_count,
            COALESCE(SUM(size_acres), 0)            AS total_acres,
            COALESCE(SUM(tree_count), 0)            AS total_trees
     FROM farms
     ${clause}`,
    params
  );

  res.json({
    farmCount: row ? row.farm_count : 0,
    totalAcres: row ? row.total_acres : 0,
    totalTrees: row ? row.total_trees : 0,
  });
});

/* ---------------------------------------------------------
   GET /farms
   --------------------------------------------------------- */

router.get("/farms", authenticate, (req, res) => {
  const { limit, offset } = pageParams(req.query);
  const scope = resolveOwnerScope(req);

  const where = [];
  const params = { limit, offset };

  if (scope) {
    where.push("f.owner_id = @ownerId");
    params.ownerId = scope;
  }

  const search = str(req.query.q);
  if (search) {
    where.push(
      "(f.farm_name LIKE @search OR f.location LIKE @search OR f.variety LIKE @search)"
    );
    params.search = `%${search}%`;
  }

  const variety = str(req.query.variety);
  if (variety) {
    where.push("f.variety = @variety");
    params.variety = variety;
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = all(
    `SELECT ${FARM_SELECT}, u.name AS owner_name
     FROM farms f
     LEFT JOIN users u ON u.id = f.owner_id
     ${clause}
     ORDER BY f.created_at DESC, f.id DESC
     LIMIT @limit OFFSET @offset`,
    params
  );

  res.json(rows.map(mapFarm));
});

/* ---------------------------------------------------------
   GET /farms/:id
   --------------------------------------------------------- */

router.get("/farms/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid farm id." });

  const row = findFarm(id);
  if (!row) return res.status(404).json({ error: "Farm not found." });
  if (!isStaff(req.user) && row.owner_id !== req.user.id) {
    return res.status(403).json({ error: "You cannot view this farm." });
  }

  res.json(mapFarm(row));
});

/* ---------------------------------------------------------
   POST /farms
   --------------------------------------------------------- */

router.post("/farms", authenticate, (req, res) => {
  const body = req.body || {};
  const farmName = str(body.farm_name || body.farmName);
  if (!farmName) {
    return res.status(400).json({ error: "farm_name is required." });
  }

  let ownerId = req.user.id;
  const requestedOwner = toId(body.owner_id || body.ownerId);
  if (requestedOwner && requestedOwner !== req.user.id) {
    if (!isStaff(req.user)) {
      return res.status(403).json({ error: "You cannot create a farm for another user." });
    }
    const owner = get("SELECT id FROM users WHERE id = @id", { id: requestedOwner });
    if (!owner) return res.status(404).json({ error: "Owner account not found." });
    ownerId = requestedOwner;
  }

  const info = run(
    `INSERT INTO farms
       (owner_id, farm_name, location, size_acres, soil_type,
        irrigation, tree_count, variety, established, notes)
     VALUES
       (@ownerId, @farmName, @location, @sizeAcres, @soilType,
        @irrigation, @treeCount, @variety, @established, @notes)`,
    {
      ownerId,
      farmName,
      location: str(body.location) || null,
      sizeAcres: toNumber(body.size_acres !== undefined ? body.size_acres : body.sizeAcres),
      soilType: str(body.soil_type || body.soilType) || null,
      irrigation: str(body.irrigation) || null,
      treeCount: toInt(body.tree_count !== undefined ? body.tree_count : body.treeCount),
      variety: str(body.variety) || null,
      established: str(body.established) || null,
      notes: str(body.notes) || null,
    }
  );

  res.status(201).json(mapFarm(findFarm(info.lastInsertRowid)));
});

/* ---------------------------------------------------------
   PATCH /farms/:id
   --------------------------------------------------------- */

router.patch("/farms/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid farm id." });

  const existing = findFarm(id);
  if (!existing) return res.status(404).json({ error: "Farm not found." });
  if (!canManage(req.user, existing)) {
    return res.status(403).json({ error: "You cannot modify this farm." });
  }

  const body = req.body || {};
  const fields = {};

  const farmName = str(body.farm_name || body.farmName);
  if (farmName) fields.farm_name = farmName;
  if (body.location !== undefined) fields.location = str(body.location) || null;
  if (body.size_acres !== undefined || body.sizeAcres !== undefined) {
    fields.size_acres = toNumber(
      body.size_acres !== undefined ? body.size_acres : body.sizeAcres
    );
  }
  if (body.soil_type !== undefined || body.soilType !== undefined) {
    fields.soil_type = str(body.soil_type || body.soilType) || null;
  }
  if (body.irrigation !== undefined) fields.irrigation = str(body.irrigation) || null;
  if (body.tree_count !== undefined || body.treeCount !== undefined) {
    fields.tree_count = toInt(
      body.tree_count !== undefined ? body.tree_count : body.treeCount
    );
  }
  if (body.variety !== undefined) fields.variety = str(body.variety) || null;
  if (body.established !== undefined) fields.established = str(body.established) || null;
  if (body.notes !== undefined) fields.notes = str(body.notes) || null;

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: "No supported fields supplied." });
  }

  applyUpdates("farms", id, fields);
  res.json(mapFarm(findFarm(id)));
});

/* ---------------------------------------------------------
   DELETE /farms/:id
   --------------------------------------------------------- */

router.delete("/farms/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid farm id." });

  const existing = findFarm(id);
  if (!existing) return res.status(404).json({ error: "Farm not found." });
  if (!canManage(req.user, existing)) {
    return res.status(403).json({ error: "You cannot delete this farm." });
  }

  run("DELETE FROM farms WHERE id = @id", { id });
  res.status(204).end();
});

/* ---------------------------------------------------------
   Admin overview helper: all farms across the platform
   --------------------------------------------------------- */

router.get("/admin/farms", authenticate, requireRole("admin"), (req, res) => {
  const rows = all(
    `SELECT ${FARM_SELECT}, u.name AS owner_name, u.email AS owner_email
     FROM farms f
     LEFT JOIN users u ON u.id = f.owner_id
     ORDER BY f.created_at DESC, f.id DESC`
  );
  res.json(rows.map(mapFarm));
});

module.exports = router;
