// register.js — Pilot registration form (displayName, password, optional profile fields).

// ISO 3166-1 alpha-2 country list (concise subset; extend as needed)
const COUNTRIES = [
    { code: "un", name: "— Unknown —" },
    { code: "at", name: "Austria" },
    { code: "au", name: "Australia" },
    { code: "be", name: "Belgium" },
    { code: "br", name: "Brazil" },
    { code: "ca", name: "Canada" },
    { code: "ch", name: "Switzerland" },
    { code: "cn", name: "China" },
    { code: "cz", name: "Czech Republic" },
    { code: "de", name: "Germany" },
    { code: "dk", name: "Denmark" },
    { code: "es", name: "Spain" },
    { code: "fi", name: "Finland" },
    { code: "fr", name: "France" },
    { code: "gb", name: "United Kingdom" },
    { code: "gr", name: "Greece" },
    { code: "hu", name: "Hungary" },
    { code: "ie", name: "Ireland" },
    { code: "il", name: "Israel" },
    { code: "it", name: "Italy" },
    { code: "jp", name: "Japan" },
    { code: "kr", name: "South Korea" },
    { code: "mx", name: "Mexico" },
    { code: "nl", name: "Netherlands" },
    { code: "no", name: "Norway" },
    { code: "nz", name: "New Zealand" },
    { code: "pl", name: "Poland" },
    { code: "pt", name: "Portugal" },
    { code: "ro", name: "Romania" },
    { code: "ru", name: "Russia" },
    { code: "se", name: "Sweden" },
    { code: "sg", name: "Singapore" },
    { code: "tr", name: "Turkey" },
    { code: "ua", name: "Ukraine" },
    { code: "us", name: "United States" },
    { code: "za", name: "South Africa" },
];

// DOM initialization
document.addEventListener("DOMContentLoaded", async () => {
    populateCountrySelect();
    await Promise.all([
        loadTeams(),
        loadVehicles(),
        loadControls(),
    ]);

    // Live flag preview when country changes
    document.getElementById("field-country").addEventListener("change", (e) => {
        const code = e.target.value || "un";
        const preview = document.getElementById("country-flag-preview");
        preview.innerHTML = `<span class="fi fi-${code}"></span>`;
    });

    // Clear field error on input
    ["field-displayName", "field-password", "field-passwordConfirm",
     "field-avatarUrl"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", () => clearFieldError(el));
    });
});

// populate country <md-outlined-select>
function populateCountrySelect() {
    const select = document.getElementById("field-country");
    COUNTRIES.forEach(({ code, name }) => {
        const opt = document.createElement("md-select-option");
        opt.value = code;
        opt.innerHTML = `<div slot="headline">${name}</div>`;
        if (code === "un") opt.selected = true;
        select.appendChild(opt);
    });
}

// load reference data from API
async function loadTeams() {
    try {
        const data = await apiFetch("/api/teams");
        const select = document.getElementById("field-teamId");
        data.forEach(team => {
            const opt = document.createElement("md-select-option");
            opt.value = team.id;
            opt.innerHTML = `<div slot="headline">${escHtml(team.name)}</div>`;
            select.appendChild(opt);
        });
    } catch {
        // Non-blocking — teams are optional
    }
}

async function loadVehicles() {
    try {
        const data = await apiFetch("/api/vehicles");
        const select = document.getElementById("field-vehicleId");
        data.forEach(v => {
            const opt = document.createElement("md-select-option");
            opt.value = v.id;
            opt.innerHTML = `<div slot="headline">${escHtml(v.model)}</div><div slot="supporting-text">${escHtml(v.type)}</div>`;
            select.appendChild(opt);
        });
    } catch {
        // Non-blocking
    }
}

async function loadControls() {
    try {
        const data = await apiFetch("/api/controls");
        const select = document.getElementById("field-controlsId");
        data.forEach(c => {
            const opt = document.createElement("md-select-option");
            opt.value = c.id;
            opt.innerHTML = `<div slot="headline">${escHtml(c.type)}</div>`;
            select.appendChild(opt);
        });
    } catch {
        // Non-blocking
    }
}

// form submission
async function handleRegister() {
    hideError();
    if (!validateForm()) return;

    const btn = document.getElementById("btn-register");
    btn.disabled = true;

    const payload = {
        displayName: fieldValue("field-displayName"),
        password:    fieldValue("field-password"),
    };

    // Optional fields — only include if non-empty
    const avatarUrl = fieldValue("field-avatarUrl");
    const country   = selectValue("field-country");
    const teamId    = selectValue("field-teamId");
    const vehicleId = selectValue("field-vehicleId");
    const controlsId = selectValue("field-controlsId");

    if (avatarUrl)  payload.avatarUrl  = avatarUrl;
    if (country && country !== "un") payload.country = country;
    if (teamId)     payload.teamId     = teamId;
    if (vehicleId)  payload.vehicleId  = vehicleId;
    if (controlsId) payload.controlsId = controlsId;

    try {
        const data = await apiFetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        // Persist JWT for the session
        localStorage.setItem("cr_jwt", data.token);
        localStorage.setItem("cr_pilot", JSON.stringify(data.pilot));

        // Redirect to profile
        window.location.href = "profile.html";
    } catch (err) {
        showError(err.message || "Registration failed. Please try again.");
        btn.disabled = false;
    }
}

// validation
function validateForm() {
    let valid = true;

    const displayName = fieldValue("field-displayName");
    const password    = fieldValue("field-password");
    const confirm     = fieldValue("field-passwordConfirm");

    if (!displayName) {
        setFieldError("field-displayName", "Display name is required");
        valid = false;
    } else if (displayName.length < 2) {
        setFieldError("field-displayName", "At least 2 characters");
        valid = false;
    }

    if (!password) {
        setFieldError("field-password", "Password is required");
        valid = false;
    } else if (password.length < 8) {
        setFieldError("field-password", "At least 8 characters");
        valid = false;
    }

    if (!confirm) {
        setFieldError("field-passwordConfirm", "Please confirm your password");
        valid = false;
    } else if (password !== confirm) {
        setFieldError("field-passwordConfirm", "Passwords do not match");
        valid = false;
    }

    const avatarUrl = fieldValue("field-avatarUrl");
    if (avatarUrl && !isValidUrl(avatarUrl)) {
        setFieldError("field-avatarUrl", "Enter a valid URL");
        valid = false;
    }

    return valid;
}

// field error helpers (md-outlined-text-field uses `error` + `error-text`)
function setFieldError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute("error", "");
    el.setAttribute("error-text", message);
}

function clearFieldError(el) {
    el.removeAttribute("error");
    el.removeAttribute("error-text");
}

// error banner
function showError(message) {
    const banner = document.getElementById("error-banner");
    document.getElementById("error-text").textContent = message;
    banner.hidden = false;
}

function hideError() {
    document.getElementById("error-banner").hidden = true;
}

// utilities
function fieldValue(id) {
    return (document.getElementById(id)?.value ?? "").trim();
}

function selectValue(id) {
    return (document.getElementById(id)?.value ?? "").trim();
}

function isValidUrl(str) {
    try { new URL(str); return true; } catch { return false; }
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function apiFetch(path, options = {}) {
    const res = await fetch(path, options);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
}
