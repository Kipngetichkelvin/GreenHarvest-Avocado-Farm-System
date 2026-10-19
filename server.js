/* =========================================================
 * GreenHarvest Avocado Farm System :: server.js
 * ---------------------------------------------------------
 * Express application bootstrap for the GreenHarvest API.
 *
 * Responsibilities
 *   1. Load environment configuration (.env) and initialise
 *      the SQLite schema/seed data through ./database.js.
 *   2. Configure core middleware (security, CORS, logging,
 *      body parsing).
 *   3. Mount the five domain routers under "/api":
 *        users.js        -> /api/auth/*, /api/users/*, /api/notifications/*
 *        market.js       -> /api/products/*, /api/seedlings/*,
 *                           /api/cart/*, /api/orders/*, /api/payments/*
 *        farms.js        -> /api/farms/*, /api/admin/farms
 *        farmers.js      -> /api/farmers/*, /api/farmer-profiles/*,
 *                           /api/service-requests/*
 *        deliveries.js   -> /api/deliveries/*
 *   4. Expose a lightweight "GET /api/health" probe.
 *   5. Serve the static frontend (public/) alongside the API.
 *
 * Contract with scripts/smoke-test.js
 *   `require("../server.js")` MUST return the Express `app`
 *   and MUST NOT start listening. The listener is only started
 *   when this file is executed directly (node server.js).
 *
 * Ports: PORT (default 5000). The smoke test calls app.listen(0)
 * itself and ignores PORT entirely.
 * ========================================================= */

"use strict";

/* ---------------------------------------------------------
 * Environment
 * --------------------------------------------------------- */

require("dotenv").config();

/* ---------------------------------------------------------
 * Fail-fast configuration check
 *
 * Without a real JWT_SECRET every token would be signed with a
 * publicly known string, so anybody could forge an admin session.
 * Refuse to boot rather than run insecurely.
 * --------------------------------------------------------- */

const PLACEHOLDER_JWT_SECRETS = new Set([
  "",
  "change-me-to-a-long-random-secret-string",
  "greenharvest-development-secret",
]);

const configuredJwtSecret = (process.env.JWT_SECRET || "").trim();

if (PLACEHOLDER_JWT_SECRETS.has(configuredJwtSecret)) {
  console.error(
    "[server] FATAL: JWT_SECRET is not configured.\n" +
      "[server] Copy .env.example to .env and set JWT_SECRET to a long random string:\n" +
      '[server]   node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
  );
  process.exit(1);
}

if (configuredJwtSecret.length < 32) {
  console.error("[server] FATAL: JWT_SECRET must be at least 32 characters long.");
  process.exit(1);
}

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const { initialise } = require("./database.js");

/* ---------------------------------------------------------
 * Database bootstrap
 *
 * Wrapped in try/catch so that merely requiring this module
 * (which the smoke test does) can never throw. Schema/seed
 * failures are logged loudly but do not crash the process.
 * --------------------------------------------------------- */

try {
  initialise();
  console.log("[server] database initialised (schema + seed).");
} catch (err) {
  console.error("[server] database initialisation failed:", err.message);
}

/* ---------------------------------------------------------
 * Application
 * --------------------------------------------------------- */

const app = express();

app.disable("x-powered-by");

/* Security headers. The frontend prototype relies on inline
 * <script> blocks and CDN-less local images, so the default
 * Content-Security-Policy is disabled to avoid breaking pages
 * while keeping the rest of helmet's protections. */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

/* Cross-origin access for the SPA / local tooling. */
app.use(cors());

/* Request logging (skip during the silent smoke test to keep
 * the console output readable). */
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

/* Body parsers. */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

/* ---------------------------------------------------------
 * Health probe
 * --------------------------------------------------------- */

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "greenharvest-avocado-farm-system",
    version: require("./package.json").version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/* ---------------------------------------------------------
 * API routers (all mounted under "/api")
 * --------------------------------------------------------- */

const { router: usersRouter } = require("./users.js");
const marketRouter = require("./market.js");
const farmsRouter = require("./farms.js");
const farmersRouter = require("./farmers.js");
const deliveriesRouter = require("./deliveries.js");

app.use("/api", usersRouter);
app.use("/api", marketRouter);
app.use("/api", farmsRouter);
app.use("/api", farmersRouter);
app.use("/api", deliveriesRouter);

/* ---------------------------------------------------------
 * Static frontend
 *
 * public/ is a complete mirror of the site. Fall back to the
 * project root only if public/ is missing, and never expose
 * backend source, config, database or script files.
 * --------------------------------------------------------- */

const PUBLIC_DIR = path.join(__dirname, "public");
const BLOCKED = /(^|[/\\])(server\.js|database\.js|package(-lock)?\.json|\.env.*|.*\.(db|db-wal|db-shm|sql)|scripts)([/\\]|$)/i;

app.use(
  express.static(PUBLIC_DIR, {
    extensions: ["html"],
    setHeaders(res, filePath) {
      if (/\.jfif$/i.test(filePath)) {
        res.setHeader("Content-Type", "image/jpeg");
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

/* Root-level assets (css/, js/, images/, *.html) for the case
 * where the site is served straight from the project root. */
app.use(
  express.static(__dirname, {
    index: "index.html",
    extensions: ["html"],
    setHeaders(res, filePath) {
      if (/\.jfif$/i.test(filePath)) {
        res.setHeader("Content-Type", "image/jpeg");
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

/* ---------------------------------------------------------
 * 404 handling
 * --------------------------------------------------------- */

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "Not found", path: req.originalUrl });
    return;
  }

  if (BLOCKED.test(req.path)) {
    res.status(404).send("Not found");
    return;
  }

  res.status(404).send("Not found");
});

/* ---------------------------------------------------------
 * Error handling
 * --------------------------------------------------------- */

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = Number(err.status || err.statusCode) || 500;
  if (status >= 500) {
    console.error("[server] unhandled error:", err);
  }
  res.status(status).json({
    error: err.message || "Internal Server Error",
  });
});

/* ---------------------------------------------------------
 * Bootstrap (only when executed directly)
 * --------------------------------------------------------- */

const PORT = Number(process.env.PORT) || 5000;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(
      `[server] GreenHarvest API listening on http://localhost:${PORT}`
    );
    console.log(`[server] Health check: http://localhost:${PORT}/api/health`);
  });

  server.on("error", (err) => {
    console.error("[server] failed to start:", err.message);
    process.exit(1);
  });

  const shutdown = (signal) => {
    console.log(`\n[server] received ${signal}, shutting down...`);
    server.close(() => {
      try {
        require("./database.js").close();
      } catch (err) {
        /* ignore */
      }
      process.exit(0);
    });
  };

  ["SIGINT", "SIGTERM"].forEach((signal) =>
    process.on(signal, () => shutdown(signal))
  );
}

module.exports = app;
