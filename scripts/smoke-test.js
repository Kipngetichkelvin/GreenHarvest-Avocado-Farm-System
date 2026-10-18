#!/usr/bin/env node
/* =========================================================
   GreenHarvest Avocado Farm System
   scripts/smoke-test.js

   Boots the Express app on an ephemeral port and exercises the
   key API endpoints. Exits non-zero if any check fails.

   Usage:
     npm run smoke-test
   ========================================================= */

"use strict";

const path = require("path");

const PORT = process.env.SMOKE_PORT
  ? Number(process.env.SMOKE_PORT)
  : 0; // 0 => OS assigns a free port

let app;
try {
  app = require(path.join(__dirname, "..", "server.js"));
} catch (err) {
  console.error("Could not load server.js:", err.message);
  process.exit(1);
}

const server = app.listen(PORT, async () => {
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const results = [];
  const check = async (name, fn) => {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`  PASS  ${name}`);
    } catch (err) {
      results.push({ name, ok: false, err });
      console.error(`  FAIL  ${name} -> ${err.message}`);
    }
  };

  console.log(`GreenHarvest :: smoke test against ${base}`);

  await check("GET /api/health returns 200", async () => {
    const res = await fetch(`${base}/api/health`);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    const body = await res.json();
    if (!body || body.status !== "ok") {
      throw new Error(`unexpected body: ${JSON.stringify(body)}`);
    }
  });

  await check("GET /api/products returns an array", async () => {
    const res = await fetch(`${base}/api/products`);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    const body = await res.json();
    const list = Array.isArray(body) ? body : body && body.data;
    if (!Array.isArray(list)) {
      throw new Error(`expected array, got ${typeof list}`);
    }
  });

  await check("GET /api/seedlings returns an array", async () => {
    const res = await fetch(`${base}/api/seedlings`);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    const body = await res.json();
    const list = Array.isArray(body) ? body : body && body.data;
    if (!Array.isArray(list)) {
      throw new Error(`expected array, got ${typeof list}`);
    }
  });

  await check("POST /api/auth/login rejects bad credentials", async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nobody@example.com",
        password: "wrong-password",
      }),
    });
    if (res.status !== 401 && res.status !== 400) {
      throw new Error(`expected 400/401, got ${res.status}`);
    }
  });

  await check("GET /api/orders requires authentication", async () => {
    const res = await fetch(`${base}/api/orders`);
    if (res.status !== 401) {
      throw new Error(`expected 401, got ${res.status}`);
    }
  });

  const failed = results.filter((r) => !r.ok);

  server.close(() => {
    console.log(
      `\n${results.length - failed.length}/${results.length} checks passed.`
    );
    if (failed.length > 0) {
      process.exitCode = 1;
    }
  });
});

server.on("error", (err) => {
  console.error("Smoke test could not start the server:", err.message);
  process.exit(1);
});
