/* =========================================================
   GreenHarvest Avocado Farm System
   farmers.js

   Farmer directory, farmer agronomic profiles and service
   requests (farm-services.html, soil-testing.html, irrigation.html,
   disease-diagnosis.html, farm-management.html).

   Mounted by server.js at "/api".

   localStorage "greenHarvestServiceRequests" -> service_requests
   ========================================================= */

"use strict";

const express = require("express");

const { all, get, run } = require("./database.js");
const { authenticate, requireRole } = require("./users.js");

const router = express.Router();

const STAFF_ROLES = ["admin", "agronomist"];

const SERVICE_TYPES = [
  "soil-testing",
  "irrigation",
  "disease-diagnosis",
  "farm-management",
  "farm-services",
];

const SERVICE_STATUSES = [
  "Pending",
  "Assigned",
  "In Progress",
  "Completed",
  "Cancelled",
];

const SERVICE_SELECT = [
  "s.id",
  "s.reference",
  "s.user_id",
  "s.service_type",
  "s.requester_name",
  "s.contact_phone",
  "s.location",
  "s.details",
  "s.preferred_date",
  "s.status",
  "s.assigned_to",
  "s.created_at",
  "s.updated_at",
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

function toInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
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

function makeReference(prefix) {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
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

function mapFarmer(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role || "farmer",
    location: row.location,
    farmSize: row.farm_size,
    primaryVariety: row.primary_variety,
    experienceYears: row.experience_years,
    certifications: row.certifications,
    profileId: row.profile_id || null,
    registeredAt: row.registered_at,
  };
}

function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || null,
    email: row.email || null,
    phone: row.phone || null,
    farmSize: row.farm_size,
    location: row.location,
    primaryVariety: row.primary_variety,
    experienceYears: row.experience_years,
    certifications: row.certifications,
    createdAt: row.created_at,
  };
}

function mapServiceRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    serviceType: row.service_type,
    requesterName: row.requester_name,
    contactPhone: row.contact_phone,
    location: row.location,
    details: row.details,
    preferredDate: row.preferred_date,
    status: row.status,
    assignedTo: row.assigned_to,
    assigneeName: row.assignee_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findProfileRow(id) {
  return get(
    `SELECT p.*, u.name, u.email, u.phone
     FROM farmer_profiles p
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = @id`,
    { id }
  );
}

function findServiceRequest(id) {
  return get(
    `SELECT ${SERVICE_SELECT}, a.name AS assignee_name
     FROM service_requests s
     LEFT JOIN users a ON a.id = s.assigned_to
     WHERE s.id = @id`,
    { id }
  );
}

/* ---------------------------------------------------------
   Farmer directory
   --------------------------------------------------------- */

router.get("/farmers", (req, res) => {
  const { limit, offset } = pageParams(req.query);

  const where = ["u.role = 'farmer'"];
  const params = { limit, offset };

  const search = str(req.query.q);
  if (search) {
    where.push(
      "(u.name LIKE @search OR u.email LIKE @search OR p.location LIKE @search)"
    );
    params.search = `%${search}%`;
  }

  const location = str(req.query.location);
  if (location) {
    where.push("p.location LIKE @location");
    params.location = `%${location}%`;
  }

  const rows = all(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.registered_at,
            p.id AS profile_id, p.farm_size, p.location,
            p.primary_variety, p.experience_years, p.certifications
     FROM users u
     LEFT JOIN farmer_profiles p ON p.user_id = u.id
     WHERE ${where.join(" AND ")}
     ORDER BY u.name COLLATE NOCASE ASC
     LIMIT @limit OFFSET @offset`,
    params
  );

  res.json(rows.map(mapFarmer));
});

router.get("/farmers/:id", (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid farmer id." });

  const row = get(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.registered_at,
            p.id AS profile_id, p.farm_size, p.location,
            p.primary_variety, p.experience_years, p.certifications
     FROM users u
     LEFT JOIN farmer_profiles p ON p.user_id = u.id
     WHERE u.id = @id AND u.role = 'farmer'`,
    { id }
  );

  if (!row) return res.status(404).json({ error: "Farmer not found." });

  const farms = all(
    `SELECT id, owner_id, farm_name, location, size_acres, soil_type,
            irrigation, tree_count, variety, established, notes, created_at, updated_at
     FROM farms
     WHERE owner_id = @id
     ORDER BY created_at DESC`,
    { id }
  );

  const products = all(
    `SELECT id, name, category, variety, description, price, unit, stock, image
     FROM products
     WHERE seller_id = @id AND is_active = 1
     ORDER BY created_at DESC`,
    { id }
  );

  res.json({
    ...mapFarmer(row),
    farms: farms.map((farm) => ({
      id: farm.id,
      ownerId: farm.owner_id,
      farmName: farm.farm_name,
      location: farm.location,
      sizeAcres: farm.size_acres,
      soilType: farm.soil_type,
      irrigation: farm.irrigation,
      treeCount: farm.tree_count,
      variety: farm.variety,
      established: farm.established,
      notes: farm.notes,
      createdAt: farm.created_at,
      updatedAt: farm.updated_at,
    })),
    products,
  });
});

/* ---------------------------------------------------------
   Farmer profiles (agronomic details)
   --------------------------------------------------------- */

router.get("/farmer-profiles", authenticate, (req, res) => {
  const requested = toId(req.query.user_id || req.query.userId);

  if (isStaff(req.user) && !requested) {
    const rows = all(
      `SELECT p.*, u.name, u.email, u.phone
       FROM farmer_profiles p
       LEFT JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    );
    return res.json(rows.map(mapProfile));
  }

  const userId = isStaff(req.user) && requested ? requested : req.user.id;
  const row = get(
    `SELECT p.*, u.name, u.email, u.phone
     FROM farmer_profiles p
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.user_id = @userId`,
    { userId }
  );

  res.json(row ? [mapProfile(row)] : []);
});

router.post("/farmer-profiles", authenticate, (req, res) => {
  const existing = get("SELECT id FROM farmer_profiles WHERE user_id = @userId", {
    userId: req.user.id,
  });
  if (existing) {
    return res
      .status(409)
      .json({ error: "A farmer profile already exists for this account." });
  }

  const body = req.body || {};
  const info = run(
    `INSERT INTO farmer_profiles
       (user_id, farm_size, location, primary_variety, experience_years, certifications)
     VALUES
       (@userId, @farmSize, @location, @primaryVariety, @experienceYears, @certifications)`,
    {
      userId: req.user.id,
      farmSize: str(body.farm_size || body.farmSize) || null,
      location: str(body.location) || null,
      primaryVariety: str(body.primary_variety || body.primaryVariety) || null,
      experienceYears: toInt(
        body.experience_years !== undefined
          ? body.experience_years
          : body.experienceYears
      ),
      certifications: str(body.certifications) || null,
    }
  );

  res.status(201).json(mapProfile(findProfileRow(info.lastInsertRowid)));
});

router.patch("/farmer-profiles/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid profile id." });

  const existing = findProfileRow(id);
  if (!existing) return res.status(404).json({ error: "Profile not found." });
  if (existing.user_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "You cannot modify this profile." });
  }

  const body = req.body || {};
  const fields = {};

  if (body.farm_size !== undefined || body.farmSize !== undefined) {
    fields.farm_size =
      str(body.farm_size !== undefined ? body.farm_size : body.farmSize) || null;
  }
  if (body.location !== undefined) fields.location = str(body.location) || null;
  if (body.primary_variety !== undefined || body.primaryVariety !== undefined) {
    fields.primary_variety =
      str(
        body.primary_variety !== undefined
          ? body.primary_variety
          : body.primaryVariety
      ) || null;
  }
  if (body.experience_years !== undefined || body.experienceYears !== undefined) {
    fields.experience_years = toInt(
      body.experience_years !== undefined
        ? body.experience_years
        : body.experienceYears
    );
  }
  if (body.certifications !== undefined) {
    fields.certifications = str(body.certifications) || null;
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: "No supported fields supplied." });
  }

  // farmer_profiles has no updated_at column.
  const assignments = Object.keys(fields).map((column) => `${column} = @${column}`);
  run(
    `UPDATE farmer_profiles SET ${assignments.join(", ")} WHERE id = @id`,
    { ...fields, id }
  );

  res.json(mapProfile(findProfileRow(id)));
});

router.delete("/farmer-profiles/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid profile id." });

  const existing = findProfileRow(id);
  if (!existing) return res.status(404).json({ error: "Profile not found." });
  if (existing.user_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "You cannot delete this profile." });
  }

  run("DELETE FROM farmer_profiles WHERE id = @id", { id });
  res.status(204).end();
});

/* ---------------------------------------------------------
   Service requests
   --------------------------------------------------------- */

router.get("/service-requests", authenticate, (req, res) => {
  const { limit, offset } = pageParams(req.query);

  const where = [];
  const params = { limit, offset };

  if (!isStaff(req.user)) {
    where.push("s.user_id = @userId");
    params.userId = req.user.id;
  } else {
    const requestedUser = toId(req.query.user_id || req.query.userId);
    if (requestedUser) {
      where.push("s.user_id = @userId");
      params.userId = requestedUser;
    }
  }

  const status = str(req.query.status);
  if (status) {
    where.push("s.status = @status");
    params.status = status;
  }

  const serviceType = str(req.query.service_type || req.query.serviceType);
  if (serviceType) {
    where.push("s.service_type = @serviceType");
    params.serviceType = serviceType;
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = all(
    `SELECT ${SERVICE_SELECT}, a.name AS assignee_name
     FROM service_requests s
     LEFT JOIN users a ON a.id = s.assigned_to
     ${clause}
     ORDER BY s.created_at DESC, s.id DESC
     LIMIT @limit OFFSET @offset`,
    params
  );

  res.json(rows.map(mapServiceRequest));
});

router.post("/service-requests", authenticate, (req, res) => {
  const body = req.body || {};
  const serviceType = str(body.service_type || body.serviceType);

  if (!serviceType) {
    return res.status(400).json({ error: "service_type is required." });
  }
  if (!SERVICE_TYPES.includes(serviceType)) {
    return res.status(400).json({
      error: `service_type must be one of: ${SERVICE_TYPES.join(", ")}.`,
    });
  }

  const info = run(
    `INSERT INTO service_requests
       (reference, user_id, service_type, requester_name, contact_phone,
        location, details, preferred_date, status)
     VALUES
       (@reference, @userId, @serviceType, @requesterName, @contactPhone,
        @location, @details, @preferredDate, 'Pending')`,
    {
      reference: makeReference("SR"),
      userId: req.user.id,
      serviceType,
      requesterName: str(body.requester_name || body.requesterName) || req.user.name,
      contactPhone:
        str(body.contact_phone || body.contactPhone) || req.user.phone || null,
      location: str(body.location) || null,
      details: str(body.details) || null,
      preferredDate: str(body.preferred_date || body.preferredDate) || null,
    }
  );

  res.status(201).json(mapServiceRequest(findServiceRequest(info.lastInsertRowid)));
});

router.get("/service-requests/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid request id." });

  const row = findServiceRequest(id);
  if (!row) return res.status(404).json({ error: "Service request not found." });
  if (!isStaff(req.user) && row.user_id !== req.user.id) {
    return res.status(403).json({ error: "You cannot view this request." });
  }

  res.json(mapServiceRequest(row));
});

router.patch("/service-requests/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid request id." });

  const existing = findServiceRequest(id);
  if (!existing) return res.status(404).json({ error: "Service request not found." });

  const body = req.body || {};
  const fields = {};
  const staff = isStaff(req.user);
  const owner = existing.user_id === req.user.id;

  if (!staff && !owner) {
    return res.status(403).json({ error: "You cannot modify this request." });
  }

  const status = str(body.status);
  if (status) {
    if (!SERVICE_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${SERVICE_STATUSES.join(", ")}.`,
      });
    }
    if (!staff && status !== "Cancelled") {
      return res.status(403).json({ error: "Customers may only cancel a request." });
    }
    fields.status = status;
  }

  if (body.details !== undefined && (staff || owner)) {
    fields.details = str(body.details) || null;
  }
  if (body.location !== undefined && (staff || owner)) {
    fields.location = str(body.location) || null;
  }
  if (body.contact_phone !== undefined || body.contactPhone !== undefined) {
    fields.contact_phone =
      str(body.contact_phone !== undefined ? body.contact_phone : body.contactPhone) ||
      null;
  }
  if (body.preferred_date !== undefined || body.preferredDate !== undefined) {
    fields.preferred_date =
      str(
        body.preferred_date !== undefined ? body.preferred_date : body.preferredDate
      ) || null;
  }

  if (staff) {
    if (body.assigned_to !== undefined || body.assignedTo !== undefined) {
      const assignee = toId(
        body.assigned_to !== undefined ? body.assigned_to : body.assignedTo
      );
      if (assignee) {
        const account = get("SELECT id FROM users WHERE id = @id", { id: assignee });
        if (!account) return res.status(404).json({ error: "Assignee not found." });
      }
      fields.assigned_to = assignee;
    }
    if (body.service_type !== undefined || body.serviceType !== undefined) {
      const nextType = str(
        body.service_type !== undefined ? body.service_type : body.serviceType
      );
      if (!SERVICE_TYPES.includes(nextType)) {
        return res.status(400).json({
          error: `service_type must be one of: ${SERVICE_TYPES.join(", ")}.`,
        });
      }
      fields.service_type = nextType;
    }
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: "No supported fields supplied." });
  }

  applyUpdates("service_requests", id, fields);
  res.json(mapServiceRequest(findServiceRequest(id)));
});

router.delete("/service-requests/:id", authenticate, requireRole("admin"), (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid request id." });

  const existing = findServiceRequest(id);
  if (!existing) return res.status(404).json({ error: "Service request not found." });

  run("DELETE FROM service_requests WHERE id = @id", { id });
  res.status(204).end();
});

module.exports = router;
