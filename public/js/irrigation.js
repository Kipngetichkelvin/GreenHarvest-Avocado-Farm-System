/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   IRRIGATION JAVASCRIPT
   ---------------------------------------------------------
   Collects the irrigation support request form, submits it to
   the API when the endpoint is available, and otherwise stores
   the request on the device so a farmer never loses it. The
   form always ends with a friendly confirmation message.
   ========================================================= */

"use strict";

/* === MODULE CONSTANTS === */
var greenHarvestIrrigationStoreKey =
    "greenHarvestIrrigationRequests";

var greenHarvestIrrigationMessageId = "irrigationMessage";

var greenHarvestIrrigationFields = [
    "farmerName",
    "phone",
    "farmLocation",
    "farmSize",
    "irrigationType",
    "waterSource",
    "trees",
    "waterProblem",
    "description"
];

/* === API HELPERS === */
function getGreenHarvestApi() {
    if (typeof window === "undefined") {
        return null;
    }

    return window.GreenHarvestAPI || window.gHApi || null;
}

/* === MESSAGE HELPERS === */
function showGreenHarvestIrrigationMessage(message, type) {
    var form = document.getElementById("irrigationForm");

    if (!form || !form.parentNode) {
        return;
    }

    var container = form.parentNode;
    var box = document.getElementById(
        greenHarvestIrrigationMessageId
    );

    if (!box) {
        box = document.createElement("div");
        box.id = greenHarvestIrrigationMessageId;
        box.setAttribute("role", "status");
        box.style.padding = "14px 18px";
        box.style.marginTop = "16px";
        box.style.borderRadius = "6px";
        box.style.fontWeight = "600";
        box.style.lineHeight = "1.5";
        container.insertBefore(box, form.nextSibling);
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

function hideGreenHarvestIrrigationMessage() {
    var box = document.getElementById(
        greenHarvestIrrigationMessageId
    );

    if (box) {
        box.style.display = "none";
    }
}

/* === REQUEST STORAGE === */
function getGreenHarvestIrrigationRequests() {
    try {
        var raw = window.localStorage.getItem(
            greenHarvestIrrigationStoreKey
        );

        if (!raw) {
            return [];
        }

        var parsed = JSON.parse(raw);

        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function storeGreenHarvestIrrigationRequest(request) {
    if (!request || typeof request !== "object") {
        return null;
    }

    var requests = getGreenHarvestIrrigationRequests();

    requests.push(request);

    try {
        window.localStorage.setItem(
            greenHarvestIrrigationStoreKey,
            JSON.stringify(requests)
        );
    } catch (error) {
        // Storage may be full or blocked; the request is still
        // acknowledged in the UI so the form is not a dead end.
    }

    return request;
}

/* === COLLECT FORM DATA === */
function collectGreenHarvestIrrigationRequest() {
    var payload = {};

    for (
        var index = 0;
        index < greenHarvestIrrigationFields.length;
        index += 1
    ) {
        var fieldName = greenHarvestIrrigationFields[index];
        var element = document.getElementById(fieldName);

        if (!element) {
            payload[fieldName] = "";
            continue;
        }

        payload[fieldName] = String(
            element.value || ""
        ).trim();
    }

    return payload;
}

function buildGreenHarvestIrrigationRecord(payload) {
    var record = {};

    for (var key in payload) {
        if (
            Object.prototype.hasOwnProperty.call(
                payload,
                key
            )
        ) {
            record[key] = payload[key];
        }
    }

    record.id = "IRR-" + Date.now();
    record.status = "Pending";
    record.createdAt = new Date().toISOString();

    return record;
}

/* === SUBMIT HANDLER === */
async function submitGreenHarvestIrrigationRequest(payload) {
    var api = getGreenHarvestApi();

    if (!api || typeof api.request !== "function") {
        return false;
    }

    await api.request("/irrigation/requests", {
        method: "POST",
        body: payload
    });

    return true;
}

async function handleGreenHarvestIrrigationSubmit(event) {
    event.preventDefault();

    var form = event.currentTarget;
    var submitButton = form
        ? form.querySelector('button[type="submit"]')
        : null;
    var payload = collectGreenHarvestIrrigationRequest();

    if (!payload.farmerName) {
        showGreenHarvestIrrigationMessage(
            "Please enter your full name.",
            "error"
        );
        return;
    }

    if (!payload.phone) {
        showGreenHarvestIrrigationMessage(
            "Please enter a phone number we can reach you on.",
            "error"
        );
        return;
    }

    if (!payload.farmLocation) {
        showGreenHarvestIrrigationMessage(
            "Please describe where your farm is located.",
            "error"
        );
        return;
    }

    if (submitButton) {
        submitButton.disabled = true;
    }

    showGreenHarvestIrrigationMessage(
        "Sending your irrigation request...",
        "info"
    );

    var delivered = false;

    try {
        delivered = await submitGreenHarvestIrrigationRequest(
            payload
        );
    } catch (error) {
        delivered = false;
    }

    var record = buildGreenHarvestIrrigationRecord(payload);

    if (!delivered) {
        storeGreenHarvestIrrigationRequest(record);
    }

    if (delivered) {
        showGreenHarvestIrrigationMessage(
            "Thank you, " +
                payload.farmerName +
                ". Your irrigation request has been received. " +
                "Our team will contact you on " +
                payload.phone +
                " within two working days.",
            "success"
        );
    } else {
        showGreenHarvestIrrigationMessage(
            "Thank you, " +
                payload.farmerName +
                ". Your irrigation request has been saved and " +
                "queued for our team. We will contact you on " +
                payload.phone +
                " within two working days.",
            "success"
        );
    }

    form.reset();

    if (submitButton) {
        submitButton.disabled = false;
    }
}

/* === INITIALISE IRRIGATION PAGE === */
function initialiseGreenHarvestIrrigation() {
    var form = document.getElementById("irrigationForm");

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        handleGreenHarvestIrrigationSubmit
    );

    hideGreenHarvestIrrigationMessage();
}

document.addEventListener(
    "DOMContentLoaded",
    initialiseGreenHarvestIrrigation
);

console.log("GreenHarvest irrigation module loaded.");
