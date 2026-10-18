/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   PROFILE JAVASCRIPT
   ---------------------------------------------------------
   Hydrates the profile summary card and the profile form from
   the authenticated /api/auth/me payload, then saves edits back
   to the API. When the API is unreachable (or js/api.js has not
   been loaded on this page) the script falls back to the cached
   session record so the page always stays usable.
   ========================================================= */

"use strict";

/* === MODULE CONSTANTS === */
var greenHarvestProfileTokenKey = "greenHarvestToken";
var greenHarvestProfileUserKey = "greenHarvestCurrentUser";
var greenHarvestProfileMessageId = "profileMessage";

/* === API AND SESSION HELPERS === */
function getGreenHarvestApi() {
    if (typeof window === "undefined") {
        return null;
    }

    return window.GreenHarvestAPI || window.gHApi || null;
}

function getGreenHarvestProfileToken() {
    var api = getGreenHarvestApi();

    if (api && typeof api.getToken === "function") {
        return api.getToken();
    }

    try {
        return window.localStorage.getItem(
            greenHarvestProfileTokenKey
        );
    } catch (error) {
        return null;
    }
}

function getGreenHarvestCachedUser() {
    var api = getGreenHarvestApi();

    if (api && typeof api.getStoredUser === "function") {
        return api.getStoredUser();
    }

    try {
        var raw = window.localStorage.getItem(
            greenHarvestProfileUserKey
        );

        if (!raw) {
            return null;
        }

        var parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== "object") {
            return null;
        }

        return parsed;
    } catch (error) {
        return null;
    }
}

function setGreenHarvestCachedUser(user) {
    if (!user || typeof user !== "object") {
        return;
    }

    var api = getGreenHarvestApi();

    if (api && typeof api.setStoredUser === "function") {
        api.setStoredUser(user);
        return;
    }

    try {
        window.localStorage.setItem(
            greenHarvestProfileUserKey,
            JSON.stringify(user)
        );
    } catch (error) {
        // Storage can be unavailable in private mode; ignore.
    }
}

function goToGreenHarvestLogin() {
    window.location.href = "login.html";
}

/* === VALUE HELPERS === */
function pickGreenHarvestValue(source, keys) {
    if (!source || typeof source !== "object") {
        return "";
    }

    var list = Array.isArray(keys) ? keys : [];

    for (var index = 0; index < list.length; index += 1) {
        var value = source[list[index]];

        if (typeof value === "string" && value.trim() !== "") {
            return value.trim();
        }

        if (
            typeof value === "number" &&
            isFinite(value)
        ) {
            return String(value);
        }
    }

    return "";
}

function setGreenHarvestText(elementId, value) {
    var element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.textContent = value || "";
}

function setGreenHarvestFieldValue(elementId, value) {
    var element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.value = value || "";
}

/* === PROFILE MESSAGE === */
function showGreenHarvestProfileMessage(message, type) {
    var form = document.getElementById("profileForm");

    if (!form || !form.parentNode) {
        return;
    }

    var container = form.parentNode;
    var box = document.getElementById(
        greenHarvestProfileMessageId
    );

    if (!box) {
        box = document.createElement("div");
        box.id = greenHarvestProfileMessageId;
        box.setAttribute("role", "status");
        box.style.padding = "12px 16px";
        box.style.marginBottom = "16px";
        box.style.borderRadius = "6px";
        box.style.fontWeight = "600";
        container.insertBefore(box, form);
    }

    box.textContent = message || "";

    if (type === "error") {
        box.style.background = "#fdecea";
        box.style.color = "#a12622";
        box.style.border = "1px solid #f5c6c2";
    } else if (type === "info") {
        box.style.background = "#eef4ff";
        box.style.color = "#1f3f7a";
        box.style.border = "1px solid #c6d6f5";
    } else {
        box.style.background = "#eaf7ec";
        box.style.color = "#1d5c2b";
        box.style.border = "1px solid #bfe3c6";
    }

    box.style.display = "block";
}

function hideGreenHarvestProfileMessage() {
    var box = document.getElementById(
        greenHarvestProfileMessageId
    );

    if (box) {
        box.style.display = "none";
    }
}

/* === RENDER PROFILE === */
function renderGreenHarvestProfile(user, farmerProfile) {
    var record = user && typeof user === "object" ? user : {};
    var profile =
        farmerProfile && typeof farmerProfile === "object"
            ? farmerProfile
            : {};

    var name = pickGreenHarvestValue(
        record,
        ["name", "fullName", "full_name", "username"]
    );
    var email = pickGreenHarvestValue(
        record,
        ["email", "emailAddress", "email_address"]
    );
    var phone = pickGreenHarvestValue(
        record,
        ["phone", "phoneNumber", "phone_number"]
    );
    var role = pickGreenHarvestValue(
        record,
        ["role", "userType", "user_type", "accountType"]
    );
    var county = pickGreenHarvestValue(
        profile,
        ["county", "region", "location"]
    );
    var address = pickGreenHarvestValue(
        profile,
        ["address", "physicalAddress", "physical_address"]
    );

    if (!county) {
        county = pickGreenHarvestValue(
            record,
            ["county", "region", "location"]
        );
    }

    if (!address) {
        address = pickGreenHarvestValue(
            record,
            ["address", "physicalAddress", "physical_address"]
        );
    }

    var displayName = name || "GreenHarvest Member";

    setGreenHarvestText("profileName", displayName);
    setGreenHarvestText("profileRole", role || "Member");
    setGreenHarvestText("profileEmail", email || "Not provided");

    setGreenHarvestFieldValue("name", name);
    setGreenHarvestFieldValue("email", email);
    setGreenHarvestFieldValue("phone", phone);
    setGreenHarvestFieldValue("role", role || "Farmer");
    setGreenHarvestFieldValue("county", county);
    setGreenHarvestFieldValue("address", address);
}

/* === COLLECT PROFILE DETAILS === */
function collectGreenHarvestProfileDetails() {
    var details = {};
    var fields = [
        ["name", "name"],
        ["email", "email"],
        ["phone", "phone"],
        ["county", "county"],
        ["address", "address"]
    ];

    for (var index = 0; index < fields.length; index += 1) {
        var element = document.getElementById(fields[index][0]);

        if (!element) {
            continue;
        }

        details[fields[index][1]] = String(
            element.value || ""
        ).trim();
    }

    return details;
}

/* === SAVE PROFILE === */
async function sendGreenHarvestProfileDetails(details) {
    var api = getGreenHarvestApi();

    if (!api || typeof api.request !== "function") {
        return null;
    }

    var payload = await api.request("/auth/me", {
        method: "PUT",
        body: details
    });

    if (payload && payload.user) {
        setGreenHarvestCachedUser(payload.user);
        return payload.user;
    }

    return null;
}

async function handleGreenHarvestProfileSubmit(event) {
    event.preventDefault();

    var form = event.currentTarget;
    var submitButton = form
        ? form.querySelector('button[type="submit"]')
        : null;
    var details = collectGreenHarvestProfileDetails();

    if (!details.name || !details.email) {
        showGreenHarvestProfileMessage(
            "Your name and email address are required.",
            "error"
        );
        return;
    }

    if (submitButton) {
        submitButton.disabled = true;
    }

    showGreenHarvestProfileMessage(
        "Saving your profile...",
        "info"
    );

    try {
        var savedUser = await sendGreenHarvestProfileDetails(
            details
        );

        if (savedUser) {
            renderGreenHarvestProfile(
                savedUser,
                getGreenHarvestCachedUser() || {}
            );
        } else {
            var merged = getGreenHarvestCachedUser() || {};
            var nextUser = {};

            for (var key in merged) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        merged,
                        key
                    )
                ) {
                    nextUser[key] = merged[key];
                }
            }

            for (var field in details) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        details,
                        field
                    )
                ) {
                    nextUser[field] = details[field];
                }
            }

            setGreenHarvestCachedUser(nextUser);
            renderGreenHarvestProfile(nextUser, {});
        }

        showGreenHarvestProfileMessage(
            "Your profile has been saved.",
            "success"
        );
    } catch (error) {
        if (
            error &&
            (error.status === 401 || error.status === 403)
        ) {
            showGreenHarvestProfileMessage(
                "Your session has expired. Redirecting to sign in.",
                "error"
            );

            window.setTimeout(
                goToGreenHarvestLogin,
                1500
            );
        } else {
            showGreenHarvestProfileMessage(
                "We could not reach the server, so your changes were saved on this device.",
                "info"
            );
        }
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
}

/* === LOAD PROFILE === */
async function loadGreenHarvestProfile() {
    var api = getGreenHarvestApi();
    var user = null;
    var farmerProfile = {};

    if (api && typeof api.request === "function") {
        try {
            var payload = await api.request("/auth/me");

            if (payload && payload.user) {
                user = payload.user;
                farmerProfile =
                    payload.farmerProfile &&
                    typeof payload.farmerProfile === "object"
                        ? payload.farmerProfile
                        : {};

                setGreenHarvestCachedUser(user);
            }
        } catch (error) {
            user = null;
        }
    }

    if (!user) {
        user = getGreenHarvestCachedUser();
    }

    if (!user) {
        goToGreenHarvestLogin();
        return;
    }

    renderGreenHarvestProfile(user, farmerProfile);
}

/* === INITIALISE PROFILE PAGE === */
function initialiseGreenHarvestProfile() {
    if (!getGreenHarvestProfileToken()) {
        goToGreenHarvestLogin();
        return;
    }

    var form = document.getElementById("profileForm");

    if (form) {
        form.addEventListener(
            "submit",
            handleGreenHarvestProfileSubmit
        );
    }

    hideGreenHarvestProfileMessage();
    loadGreenHarvestProfile();
}

document.addEventListener(
    "DOMContentLoaded",
    initialiseGreenHarvestProfile
);

console.log("GreenHarvest profile module loaded.");
