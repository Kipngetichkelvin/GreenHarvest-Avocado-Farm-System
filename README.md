# GreenHarvest Avocado Farm System

Node/Express REST API powering the GreenHarvest avocado farm management, marketplace,
orders, payments and agronomy services platform.

- **Backend:** Express 4 on Node.js (CommonJS), SQLite via `better-sqlite3`
- **Frontend:** static HTML/CSS/JS served by the same Express process
- **Auth:** JWT bearer tokens (`jsonwebtoken`) with `bcryptjs` password hashing

---

## Requirements

| Requirement | Version | Why |
|-------------|---------|-----|
| Node.js | **>= 18.0.0** | Declared in `engines`; also required for the global `fetch` used by the smoke test |
| npm | bundled with Node | Used for install and scripts |

`better-sqlite3` is a native module. If `npm install` fails on your machine, install the
platform build tools for your OS and re-run it. No separate database server is needed —
SQLite writes to a single file.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
copy .env.example .env      # Windows cmd
cp .env.example .env        # bash / zsh

# 3. Edit .env and set a real JWT_SECRET (see below)

# 4. Create the database, apply the schema and seed demo data
npm run init-db

# 5. Start the server
npm start
```

The API listens on `http://localhost:5000` by default (`PORT` in `.env`). The static site
is served from the same origin, so opening `http://localhost:5000/` loads the home page and
the browser scripts talk to `/api` on the same host.

### Available scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `start` | `npm start` | Run the server (`node server.js`) |
| `dev` | `npm run dev` | Run with auto-restart via `nodemon` |
| `init-db` | `npm run init-db` | Apply the schema and seed demo data |
| `smoke-test` | `npm run smoke-test` | Boot the app on an ephemeral port and run HTTP checks |

There is no `npm test` script in this project — `smoke-test` is the verification entry point.

---

## Environment variables

All variables are optional except `JWT_SECRET`, which must be replaced before the server
will start. See `.env.example` for the annotated template.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | HTTP port the Express server binds to |
| `NODE_ENV` | `development` | When set to `test` the HTTP request logger (morgan) is silenced |
| `DB_PATH` | `database/greenharvest.db` | Absolute or relative path to the SQLite database file |
| `JWT_SECRET` | *(placeholder)* | Signing secret for access tokens — **must** be replaced |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime, any `jsonwebtoken` duration string |
| `SMOKE_PORT` | `0` | Port used by `scripts/smoke-test.js`; `0` picks a free ephemeral port |

### About `JWT_SECRET`

The server validates this value at boot and exits with a non-zero status if it is missing,
too short, or still set to a known placeholder. Generate a long random string, for example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Database

The schema lives in `database/database.sql` and is applied by `database.js` on demand.

`npm run init-db`:

1. ensures the database file exists,
2. applies the schema from `database/database.sql`,
3. seeds demo data — seeding is **idempotent** and is skipped when demo users already exist,
4. prints the row count for each table and closes the connection.

Tables created and reported by the script:

`users`, `farms`, `products`, `seedlings`, `orders`, `deliveries`

Delete the database file (or point `DB_PATH` somewhere new) and re-run `npm run init-db`
for a clean rebuild.

---

## API overview

All routes are mounted under `/api`.

| Route group | Description |
|-------------|-------------|
| `GET /api/health` | Liveness probe returning `{ "status": "ok" }` |
| `users` | Registration, login, current-user lookup and profile updates |
| `market` | Marketplace listings — products and seedlings |
| `farms` | Farm records |
| `farmers` | Farmer profiles |
| `deliveries` | Delivery records for orders |

Authentication endpoints used by the browser client:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/login` | Exchange email + password for a JWT |
| `POST /api/auth/register` | Create an account |
| `GET /api/auth/me` | Read the current profile from a bearer token |
| `PUT /api/auth/me` | Update the current profile |

Requests that require authentication send `Authorization: Bearer <token>`.

### Smoke test

`npm run smoke-test` boots the Express app in-process on an ephemeral port and asserts:

1. `GET /api/health` → `200` with `{ status: "ok" }`
2. `GET /api/products` → `200` with an array (or `{ data: [...] }`)
3. `GET /api/seedlings` → `200` with an array (or `{ data: [...] }`)
4. `POST /api/auth/login` with bad credentials → `401` (or `400`)
5. `GET /api/orders` → `401`

It prints `PASS`/`FAIL` per check and a `n / 5 checks passed.` summary, exiting non-zero if
anything failed. Run `npm run init-db` first so the seeded data exists.

---

## Project layout

```text
.
├── server.js               Express app, middleware, static mounts, listen guard
├── database.js             SQLite connection, DB_PATH, initialise/close/all helpers
├── database/
│   └── database.sql        Schema (and seed statements) applied by init-db
├── scripts/
│   ├── init-db.js          Schema + seed runner
│   └── smoke-test.js       In-process HTTP smoke test
├── css/                    Stylesheets (mirrored from public/css/)
├── js/                     Browser scripts (mirrored from public/js/)
├── public/                 Served static site — authoritative copy
│   ├── css/
│   ├── js/
│   └── *.html
├── *.html                  Static pages (mirrored from public/)
└── .env.example            Environment template
```

### Two static trees

`server.js` mounts two static directories, in this order:

1. `public/` — served first
2. the project root — served second, as a fallback

Because `public/` is mounted first, **`public/` wins every path collision**. The root-level
`*.html` files and the root `css/`, `js/` folders exist as a mirrored copy; they are only
reached if a file is absent from `public/`.

When editing a page or stylesheet, update `public/` and then mirror the change to the root
copy so the two trees stay consistent — otherwise the root copy silently drifts out of date.
The four stylesheets in `css/` and `public/css/` are currently byte-identical, as are
`index.html`, `contact.html`, `login.html` and `register.html`.

---

## Pages

Public: `index.html`, `about.html`, `services.html`, `marketplace.html`, `seedlings.html`,
`farm-management.html`, `farm-services.html`, `disease-diagnosis.html`, `soil-testing.html`,
`irrigation.html`, `contact.html`

Accounts: `login.html`, `register.html`

Signed-in: `dashboard.html` (routes to the role dashboard), `profile.html`, `orders.html`,
`payments.html`, `notifications.html`, `deliveries.html`

Role dashboards: `admin-dashboard.html`, `agronomist-dashboard.html`,
`buyer-dashboard.html`, `farmer-dashboard.html`. After login the client sends each role to
its dashboard and falls back to the farmer dashboard.

Browser-side helpers:

- `js/api.js` — API base resolution, token/session storage, fetch wrapper
- `js/auth.js` — login, registration and session validation
- `js/profile.js`, `js/orders.js`, `js/notifications.js`, `js/irrigation.js` — page features
- `js/main.js` — shared navigation behaviour on the public pages

---

## Security notes

- `helmet` is applied with the CSP disabled, and cross-origin resource policy relaxed so the
  static assets load from either tree.
- `express-rate-limit` throttles API traffic.
- Passwords are hashed with `bcryptjs`; plaintext passwords are never stored.
- Static file serving blocks a denylist of paths (`server.js`, `database.js`,
  `package.json`, `.env*`, `*.db`, `*.sql`, `scripts/`) so those files cannot be downloaded.
- Never commit your `.env` file. Rotate `JWT_SECRET` if it is ever exposed.

## License

MIT
