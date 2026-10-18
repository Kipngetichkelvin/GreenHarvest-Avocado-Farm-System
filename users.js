/* =========================================================
   GreenHarvest Avocado Farm System
   users.js

   Authentication, account management and notification routes.

   Mounted by server.js at "/api", so every path below is
   relative to "/api" (e.g. router.post("/auth/login")
   => POST /api/auth/login).

   Exports:
     router                       the Express router
     authenticate                 JWT bearer-token middleware
     requireRole(...roles)        role gate middleware factory
     signToken(user)              JWT creation helper
     publicUser(row)              snake_case -> API shape mapper
   ========================================================= */

"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const validator = require("validator");

const { all, get, run } = require("./database.js");

const router = express.Router();

/* ---------------------------------------------------------
 * JWT configuration
 *
 * There is deliberately NO fallback secret. A hardcoded default
 * (which used to live here) is public knowledge: anyone could sign
 * their own token as {"sub": 1, "role": "admin"} and the server
 * would happily accept it. If JWT_SECRET is missing we refuse to
 * run instead of silently degrading to an insecure mode.
 * --------------------------------------------------------- */

const INSECURE_JWT_SECRETS = new Set([
  "",
  "change-me-to-a-long-random-secret-string",
  "greenharvest-development-secret",
]);

function resolveJwtSecret() {
  const secret =
    typeof process.env.JWT_SECRET === "string" ? process.env.JWT_SECRET.trim() : "";

  if (INSECURE_JWT_SECRETS.has(secret)) {
    throw new Error(
      "JWT_SECRET is missing or still set to a placeholder value. " +
        "Create a .env file (copy .env.example) and set JWT_SECRET to a long random string, " +
        'e.g. node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }

  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }

  return secret;
}

const JWT_SECRET = resolveJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const USER_ROLES = ["admin", "agronomist", "buyer", "farmer"];
const SELF_ASSIGNABLE_ROLES = ["farmer", "buyer", "agronomist"];
const NOTIFICATION_TYPES = ["info", "success", "warning", "error"];
const USER_COLUMNS = "id, name, email, phone, role, registered_at, updated_at";

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */

const str = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

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

function toId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Maps a users row onto the camelCase shape the frontend expects. */
function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    registeredAt: row.registered_at,
    updatedAt: row.updated_at,
  };
}

function mapNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

const findUserByEmail = (email) =>
  get("SELECT * FROM users WHERE lower(email) = lower(@email)", { email });

const findUserById = (id) =>
  get(`SELECT ${USER_COLUMNS} FROM users WHERE id = @id`, { id });

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/* ---------------------------------------------------------
   Middleware
   --------------------------------------------------------- */

/** Requires a valid `Authorization: Bearer <jwt>` header. */
function authenticate(req, res, next) {
  const header = str(req.headers.authorization);
  const [scheme, token] = header.split(/\s+/);

  if (!token || scheme.toLowerCase() !== "bearer") {
    return res.status(401).json({ error: "Authentication required." });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  const user = findUserById(payload.sub);
  if (!user) {
    return res.status(401).json({ error: "The account for this token no longer exists." });
  }

  req.user = user;
  req.auth = payload;
  return next();
}

/** Allows only the listed roles (no roles => any authenticated user). */
function requireRole(...roles) {
  const allowed = roles.flat().filter(Boolean);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (allowed.length > 0 && !allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: "You do not have permission to perform this action.",
      });
    }
    return next();
  };
}

/* ---------------------------------------------------------
   POST /api/auth/register
   --------------------------------------------------------- */

router.post("/auth/register", (req, res) => {
  const body = req.body || {};
  const name = str(body.name || body.fullName);
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const phone = str(body.phone) || null;
  let role = str(body.role).toLowerCase();

  if (!name) {
    return res.status(400).json({ error: "Name is required." });
  }
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }
  if (!SELF_ASSIGNABLE_ROLES.includes(role)) {
    role = "buyer";
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const info = run(
    `INSERT INTO users (name, email, phone, role, password_hash)
     VALUES (@name, @email, @phone, @role, @passwordHash)`,
    { name, email, phone, role, passwordHash: bcrypt.hashSync(password, 10) }
  );

  const userId = Number(info.lastInsertRowid);

  if (role === "farmer") {
    run(
      `INSERT INTO farmer_profiles
         (user_id, farm_size, location, primary_variety, experience_years, certifications)
       VALUES (@userId, @farmSize, @location, @primaryVariety, @experienceYears, @certifications)`,
      {
        userId,
        farmSize: str(body.farm_size || body.farmSize) || null,
        location: str(body.location) || null,
        primaryVariety: str(body.primary_variety || body.primaryVariety) || null,
        experienceYears:
          body.experience_years === undefined && body.experienceYears === undefined
            ? null
            : Number(body.experience_years ?? body.experienceYears) || null,
        certifications: str(body.certifications) || null,
      }
    );
  }

  const user = publicUser(findUserById(userId));
  return res.status(201).json({ user, token: signToken(user) });
});

/* ---------------------------------------------------------
   POST /api/auth/login
   --------------------------------------------------------- */

router.post("/auth/login", (req, res) => {
  const body = req.body || {};
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const row = findUserByEmail(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const user = publicUser(row);
  return res.json({ token: signToken(user), user });
});

/* ---------------------------------------------------------
   POST /api/auth/logout   (JWTs are stateless; client discards)
   --------------------------------------------------------- */

router.post("/auth/logout", (req, res) => {
  res.json({ ok: true, message: "Signed out." });
});

/* ---------------------------------------------------------
   GET /api/auth/me
   --------------------------------------------------------- */

router.get("/auth/me", authenticate, (req, res) => {
  const profile =
    req.user.role === "farmer"
      ? get("SELECT * FROM farmer_profiles WHERE user_id = @id", { id: req.user.id })
      : null;

  res.json({ user: publicUser(req.user), farmerProfile: profile || null });
});

/* ---------------------------------------------------------
   User administration
   --------------------------------------------------------- */

router.get("/users", authenticate, requireRole("admin"), (req, res) => {
  const { limit, offset } = pageParams(req.query);
  const role = str(req.query.role).toLowerCase();
  const search = str(req.query.q);

  const where = [];
  const params = { limit, offset };

  if (role && USER_ROLES.includes(role)) {
    where.push("role = @role");
    params.role = role;
  }
  if (search) {
    where.push("(name LIKE @search OR email LIKE @search)");
    params.search = `%${search}%`;
  }

  const rows = all(
    `SELECT ${USER_COLUMNS} FROM users
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY registered_at DESC, id DESC
     LIMIT @limit OFFSET @offset`,
    params
  );

  res.json({ data: rows.map(publicUser), limit, offset });
});

router.get("/users/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid user id." });
  }
  if (req.user.role !== "admin" && req.user.id !== id) {
    return res.status(403).json({ error: "You may only view your own account." });
  }

  const user = findUserById(id);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const profile = get("SELECT * FROM farmer_profiles WHERE user_id = @id", { id });
  res.json({ user: publicUser(user), farmerProfile: profile || null });
});

router.patch("/users/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid user id." });
  }

  const isAdmin = req.user.role === "admin";
  if (!isAdmin && req.user.id !== id) {
    return res.status(403).json({ error: "You may only update your own account." });
  }

  const user = findUserById(id);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const body = req.body || {};
  const fields = {};

  if (body.name !== undefined) {
    const name = str(body.name);
    if (!name) return res.status(400).json({ error: "Name cannot be empty." });
    fields.name = name;
  }

  if (body.email !== undefined) {
    const email = str(body.email).toLowerCase();
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: "A valid email address is required." });
    }
    const existing = findUserByEmail(email);
    if (existing && Number(existing.id) !== id) {
      return res.status(409).json({ error: "That email is already in use." });
    }
    fields.email = email;
  }

  if (body.phone !== undefined) {
    fields.phone = str(body.phone) || null;
  }

  const rawPassword = body.password ?? body.newPassword;
  if (rawPassword !== undefined) {
    const password = String(rawPassword);
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }
    fields.password_hash = bcrypt.hashSync(password, 10);
  }

  if (body.role !== undefined) {
    if (!isAdmin) {
      return res.status(403).json({ error: "Only administrators may change roles." });
    }
    const role = str(body.role).toLowerCase();
    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${USER_ROLES.join(", ")}.` });
    }
    fields.role = role;
  }

  const columns = Object.keys(fields);
  if (columns.length === 0) {
    return res.status(400).json({ error: "No supported fields supplied." });
  }

  run(
    `UPDATE users SET ${columns.map((c) => `${c} = @${c}`).join(", ")},
       updated_at = CURRENT_TIMESTAMP
     WHERE id = @id`,
    { ...fields, id }
  );

  res.json({ user: publicUser(findUserById(id)) });
});

router.delete("/users/:id", authenticate, requireRole("admin"), (req, res) => {
  const id = toId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid user id." });
  }
  if (id === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account." });
  }
  if (!findUserById(id)) {
    return res.status(404).json({ error: "User not found." });
  }

  run("DELETE FROM users WHERE id = @id", { id });
  return res.status(204).send();
});

/* ---------------------------------------------------------
   Notifications (user-scoped)
   --------------------------------------------------------- */

router.get("/notifications", authenticate, (req, res) => {
  const { limit, offset } = pageParams(req.query);
  const wantsAll = req.user.role === "admin" && str(req.query.all) === "1";
  const unreadOnly = str(req.query.unread) === "1";

  const where = [];
  const params = { limit, offset };

  if (!wantsAll) {
    where.push("user_id = @userId");
    params.userId = req.user.id;
  }
  if (unreadOnly) {
    where.push("is_read = 0");
  }

  const rows = all(
    `SELECT id, user_id, title, message, type, is_read, created_at
     FROM notifications
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC, id DESC
     LIMIT @limit OFFSET @offset`,
    params
  );

  const unread = get(
    "SELECT COUNT(*) AS n FROM notifications WHERE user_id = @userId AND is_read = 0",
    { userId: req.user.id }
  );

  res.json({
    data: rows.map(mapNotification),
    unreadCount: unread ? unread.n : 0,
    limit,
    offset,
  });
});

router.post("/notifications", authenticate, (req, res) => {
  const body = req.body || {};
  const title = str(body.title);
  if (!title) {
    return res.status(400).json({ error: "A notification title is required." });
  }

  let type = str(body.type).toLowerCase() || "info";
  if (!NOTIFICATION_TYPES.includes(type)) {
    type = "info";
  }

  let userId = req.user.id;
  if (body.user_id !== undefined || body.userId !== undefined) {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only administrators may target another user." });
    }
    const target = toId(body.user_id ?? body.userId);
    if (!target || !findUserById(target)) {
      return res.status(400).json({ error: "Unknown target user." });
    }
    userId = target;
  }

  const info = run(
    `INSERT INTO notifications (user_id, title, message, type, is_read)
     VALUES (@userId, @title, @message, @type, 0)`,
    { userId, title, message: str(body.message) || null, type }
  );

  const row = get(
    "SELECT id, user_id, title, message, type, is_read, created_at FROM notifications WHERE id = @id",
    { id: info.lastInsertRowid }
  );

  return res.status(201).json({ notification: mapNotification(row) });
});

router.patch("/notifications/read-all", authenticate, (req, res) => {
  const info = run(
    "UPDATE notifications SET is_read = 1 WHERE user_id = @userId AND is_read = 0",
    { userId: req.user.id }
  );
  res.json({ ok: true, updated: info.changes });
});

router.patch("/notifications/:id/read", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid notification id." });
  }

  const row = get("SELECT user_id FROM notifications WHERE id = @id", { id });
  if (!row) {
    return res.status(404).json({ error: "Notification not found." });
  }
  if (req.user.role !== "admin" && row.user_id !== req.user.id) {
    return res.status(403).json({ error: "You may only update your own notifications." });
  }

  const read = req.body && req.body.is_read === false ? 0 : 1;
  run("UPDATE notifications SET is_read = @read WHERE id = @id", { read, id });

  const updated = get(
    "SELECT id, user_id, title, message, type, is_read, created_at FROM notifications WHERE id = @id",
    { id }
  );
  res.json({ notification: mapNotification(updated) });
});

router.delete("/notifications/:id", authenticate, (req, res) => {
  const id = toId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid notification id." });
  }

  const row = get("SELECT user_id FROM notifications WHERE id = @id", { id });
  if (!row) {
    return res.status(404).json({ error: "Notification not found." });
  }
  if (req.user.role !== "admin" && row.user_id !== req.user.id) {
    return res.status(403).json({ error: "You may only delete your own notifications." });
  }

  run("DELETE FROM notifications WHERE id = @id", { id });
  return res.status(204).send();
});

module.exports = { router, authenticate, requireRole, signToken, publicUser };
