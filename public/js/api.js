/* =========================================================
   GreenHarvest Avocado Farm System
   js/api.js — Shared frontend API client
   ---------------------------------------------------------
   Responsibilities:
     * Resolve the backend API base URL (works from Express,
       from a plain static server, and from file://).
     * Attach the JWT (Bearer token) to authenticated calls.
     * Normalise errors into a single readable message.
     * Own every localStorage key used for the session so
       that no other script writes plaintext credentials.

   Exposed as `window.GreenHarvestAPI` (and `window.gHApi`).
   ========================================================= */

(function (global) {
  "use strict";

  /* -------------------------------------------------------
     Storage keys
     ------------------------------------------------------- */
  var TOKEN_KEY = "greenHarvestToken";
  var USER_KEY = "greenHarvestCurrentUser";
  var LOGGED_IN_KEY = "greenHarvestLoggedIn";

  /* Legacy key from the old fake-auth implementation. It held
     the user object *including the plaintext password*. It is
     purged whenever this module loads and on every logout. */
  var LEGACY_USER_KEY = "greenHarvestUser";

  /* -------------------------------------------------------
     API base URL resolution
     ------------------------------------------------------- */
  function resolveApiBase() {
    // 1. Explicit override set before this script runs.
    if (typeof global.GREENHARVEST_API_BASE === "string" && global.GREENHARVEST_API_BASE) {
      return global.GREENHARVEST_API_BASE.replace(/\/+$/, "");
    }

    // 2. <meta name="gh-api-base" content="..."> in the page head.
    try {
      var meta = document.querySelector('meta[name="gh-api-base"]');
      if (meta && meta.getAttribute("content")) {
        return meta.getAttribute("content").replace(/\/+$/, "");
      }
    } catch (error) {
      /* document may not be ready yet — fall through */
    }

    var location = global.location || {};

    // 3. Served over http/https: the Express server mounts every
    //    router at /api, so a same-origin relative base works.
    if (location.protocol === "http:" || location.protocol === "https:") {
      return location.origin + "/api";
    }

    // 4. Opened directly from disk (file://): fall back to the
    //    default local development server.
    return "http://localhost:5000/api";
  }

  var API_BASE = resolveApiBase();

  /* -------------------------------------------------------
     Token helpers
     ------------------------------------------------------- */
  function getToken() {
    try {
      return global.localStorage.getItem(TOKEN_KEY);
    } catch (error) {
      return null;
    }
  }

  function setToken(token) {
    try {
      if (token) {
        global.localStorage.setItem(TOKEN_KEY, token);
      } else {
        global.localStorage.removeItem(TOKEN_KEY);
      }
    } catch (error) {
      /* storage unavailable (private mode / disabled) */
    }
  }

  function clearToken() {
    setToken(null);
  }

  /* -------------------------------------------------------
     Cached user helpers
     ------------------------------------------------------- */
  function getStoredUser() {
    var raw;
    try {
      raw = global.localStorage.getItem(USER_KEY);
    } catch (error) {
      return null;
    }
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      // Corrupted payload — drop it instead of throwing.
      try {
        global.localStorage.removeItem(USER_KEY);
      } catch (ignore) {
        /* noop */
      }
      return null;
    }
  }

  function setStoredUser(user) {
    try {
      if (user) {
        global.localStorage.setItem(USER_KEY, JSON.stringify(user));
        global.localStorage.setItem(LOGGED_IN_KEY, "true");
      } else {
        global.localStorage.removeItem(USER_KEY);
        global.localStorage.removeItem(LOGGED_IN_KEY);
      }
    } catch (error) {
      /* noop */
    }
  }

  /* Removes every trace of a session, including the legacy
     plaintext-password record left behind by older versions. */
  function clearSession() {
    try {
      global.localStorage.removeItem(TOKEN_KEY);
      global.localStorage.removeItem(USER_KEY);
      global.localStorage.removeItem(LOGGED_IN_KEY);
      global.localStorage.removeItem(LEGACY_USER_KEY);
    } catch (error) {
      /* noop */
    }
  }

  /* Purge the legacy plaintext record as soon as this loads. */
  (function purgeLegacyUser() {
    try {
      if (global.localStorage.getItem(LEGACY_USER_KEY) !== null) {
        global.localStorage.removeItem(LEGACY_USER_KEY);
      }
    } catch (error) {
      /* noop */
    }
  })();

  /* -------------------------------------------------------
     Core request helper
     ------------------------------------------------------- */
  function buildError(status, payload) {
    var message =
      (payload && (payload.error || payload.message)) ||
      "Request failed with status " + status + ".";
    var error = new Error(message);
    error.status = status;
    error.payload = payload || null;
    return error;
  }

  /**
   * Perform an API request.
   *
   * @param {string} path        Path relative to the API base, e.g. "/auth/login".
   * @param {object} [options]
   * @param {string} [options.method="GET"]
   * @param {*}      [options.body]  Plain object (JSON encoded) or FormData.
   * @param {boolean}[options.auth=true] Attach the Bearer token when present.
   * @param {object} [options.headers]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<*>} Parsed JSON body, or null for 204 responses.
   */
  async function apiRequest(path, options) {
    var config = options || {};
    var method = (config.method || "GET").toUpperCase();
    var headers = Object.assign({ Accept: "application/json" }, config.headers || {});
    var body;

    if (config.body !== undefined && config.body !== null) {
      if (typeof FormData !== "undefined" && config.body instanceof FormData) {
        body = config.body;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(config.body);
      }
    }

    if (config.auth !== false) {
      var token = getToken();
      if (token) {
        headers.Authorization = "Bearer " + token;
      }
    }

    var url = API_BASE + (path.charAt(0) === "/" ? path : "/" + path);
    var response;

    try {
      response = await fetch(url, {
        method: method,
        headers: headers,
        body: body,
        signal: config.signal
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw error;
      }
      var offline = new Error(
        "Unable to reach the GreenHarvest API. Make sure the server is running."
      );
      offline.status = 0;
      offline.cause = error;
      throw offline;
    }

    // 204 No Content
    if (response.status === 204) {
      return null;
    }

    var text = await response.text();
    var payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        payload = null;
      }
    }

    if (!response.ok) {
      throw buildError(response.status, payload);
    }

    return payload;
  }

  /* -------------------------------------------------------
     Auth endpoints
     ------------------------------------------------------- */

  /**
   * POST /api/auth/login → { token, user }
   * Persists the JWT and the user record on success.
   */
  async function login(email, password) {
    var payload = await apiRequest("/auth/login", {
      method: "POST",
      auth: false,
      body: { email: email, password: password }
    });

    if (!payload || !payload.token) {
      throw new Error("The server did not return an authentication token.");
    }

    setToken(payload.token);
    setStoredUser(payload.user);
    return payload;
  }

  /**
   * POST /api/auth/register → { user, token }
   * Persists the JWT and the user record on success.
   */
  async function register(details) {
    var payload = await apiRequest("/auth/register", {
      method: "POST",
      auth: false,
      body: details
    });

    if (payload && payload.token) {
      setToken(payload.token);
      setStoredUser(payload.user);
    }

    return payload;
  }

  /**
   * POST /api/auth/logout → { ok: true, message }
   * Always clears the local session, even if the call fails.
   */
  async function logout() {
    try {
      if (getToken()) {
        await apiRequest("/auth/logout", { method: "POST" });
      }
    } catch (error) {
      /* Server-side revocation is best-effort for stateless JWTs. */
    } finally {
      clearSession();
    }
    return { ok: true };
  }

  /**
   * GET /api/auth/me → { user, farmerProfile }
   * Refreshes the cached user record and returns it.
   * Returns null when there is no valid session.
   */
  async function fetchCurrentUser() {
    if (!getToken()) {
      return null;
    }

    try {
      var payload = await apiRequest("/auth/me");
      if (!payload || !payload.user) {
        clearSession();
        return null;
      }
      setStoredUser(payload.user);
      return payload;
    } catch (error) {
      if (error && (error.status === 401 || error.status === 403)) {
        clearSession();
        return null;
      }
      // Network/5xx: keep the cached session so the UI still works offline.
      throw error;
    }
  }

  /**
   * Resolve the current user, preferring a validated server response
   * and falling back to the cached record.
   */
  async function getCurrentUser(options) {
    var config = options || {};
    var cached = getStoredUser();

    if (config.forceRefresh || getToken()) {
      try {
        var result = await fetchCurrentUser();
        if (result && result.user) {
          return result.user;
        }
        if (result === null) {
          return null;
        }
      } catch (error) {
        if (!config.allowStale) {
          return cached;
        }
      }
    }

    return cached;
  }

  /* -------------------------------------------------------
     Health check (useful for surfacing a "server down" state)
     ------------------------------------------------------- */
  async function health() {
    return apiRequest("/health", { auth: false });
  }

  /* -------------------------------------------------------
     Public surface
     ------------------------------------------------------- */
  var GreenHarvestAPI = {
    baseUrl: API_BASE,
    resolveApiBase: resolveApiBase,

    keys: {
      token: TOKEN_KEY,
      user: USER_KEY,
      loggedIn: LOGGED_IN_KEY,
      legacyUser: LEGACY_USER_KEY
    },

    request: apiRequest,

    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,

    getStoredUser: getStoredUser,
    setStoredUser: setStoredUser,
    clearSession: clearSession,

    login: login,
    register: register,
    logout: logout,
    fetchCurrentUser: fetchCurrentUser,
    getCurrentUser: getCurrentUser,

    health: health
  };

  global.GreenHarvestAPI = GreenHarvestAPI;
  global.gHApi = GreenHarvestAPI;
})(typeof window !== "undefined" ? window : this);
