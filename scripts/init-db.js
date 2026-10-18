#!/usr/bin/env node
/* =========================================================
   GreenHarvest Avocado Farm System
   scripts/init-db.js

   Initialises the SQLite database:
     1. Applies the schema from database/database.sql
     2. Seeds demo data (skipped automatically if users exist)
     3. Prints a short summary and exits.

   Usage:
     npm run init-db
   ========================================================= */

"use strict";

const database = require("../database.js");

function main() {
  const { DB_PATH, initialise, close, all } = database;

  console.log("GreenHarvest :: database initialisation");
  console.log(`  db file   : ${DB_PATH}`);

  // initialise() runs initSchema() then seed() (seed is idempotent and
  // returns false when demo users are already present).
  initialise();

  const counts = [
    ["users", "SELECT COUNT(*) AS n FROM users"],
    ["farms", "SELECT COUNT(*) AS n FROM farms"],
    ["products", "SELECT COUNT(*) AS n FROM products"],
    ["seedlings", "SELECT COUNT(*) AS n FROM seedlings"],
    ["orders", "SELECT COUNT(*) AS n FROM orders"],
    ["deliveries", "SELECT COUNT(*) AS n FROM deliveries"],
  ];

  console.log("  schema    : applied");
  console.log("  seed      : complete");
  console.log("  row counts:");
  for (const [label, sql] of counts) {
    try {
      const row = all(sql)[0];
      console.log(`    - ${label.padEnd(10)} ${row ? row.n : 0}`);
    } catch (err) {
      console.log(`    - ${label.padEnd(10)} (unavailable: ${err.message})`);
    }
  }

  close();
  console.log("Done.");
}

try {
  main();
} catch (err) {
  console.error("Database initialisation failed:");
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
}
