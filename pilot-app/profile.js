// profile.js

// ---------------------------------------------------------------------------
// Country list (same as register.js — shared if you ever bundle)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let currentPilot = null;
let isLocked     = false; // true when pilot has a VALIDATED entry

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    // Guard: must be logged in
    const jwt = localStorage.getItem("cr_jwt");
    if (!jwt) {
        window.location.href = "register.html";
        return;
    }

    populateCountrySelect();

    try {
        await loadProfile();
        await Promise.all([loadTeams(), loadVehicles(), loadControls()]);
        await loadOpenRaces();
    } catch (err) {
        if (err.status === 401) {
            localStorage.removeItem("cr_jwt");
            localStorage.removeItem("cr_pilot");
            window.location.href = "register.html";
        } else {
            showError(err.message || "Failed to load profile");
        }
    }

    // Live flag preview
    document.getElementById("field-country").addEventListener("change", (e) => {
        const code = e.target.value || "un";
        document.getElementById("country-flag-preview").innerHTML =
            `<span class="fi fi-${code}"></span>`;
    });
});

// ---------------------------------------------------------------------------
// Load profile from API
// ---------------------------------------------------------------------------
async function loadProfile() {
    const pilot = await apiFetch("/api/pilots/me");
    currentPilot = pilot;

    // Header
    document.getElementById("header-displayName").textContent = pilot.displayName;

    // Avatar
    const container = document.getElementById("avatar-container");
    const initial = pilot.displayName[0].toUpperCase();
    if (pilot.avatarUrl) {
        container.innerHTML = `<img class="avatar-img" src="${escHtml(pilot.avatarUrl)}" alt="Avatar"
            onerror="this.parentElement.innerHTML='<div class=\\'avatar-placeholder\\'>${initial}</div>'" />`;
    } else {
        document.getElementById("avatar-placeholder").textContent = initial;
    }

    document.getElementById("profile-displayName").textContent = pilot.displayName;
    document.getElementById("profile-role-chip").textContent   = pilot.role;

    // OCR token
    document.getElementById("ocr-token-value").textContent = pilot.token ?? "—";

    // Always-editable fields
    setFieldValue("field-displayName", pilot.displayName);
    setFieldValue("field-avatarUrl",   pilot.avatarUrl ?? "");

    // Country + flag (defer to let md-select render its options first)
    setTimeout(() => {
        document.getElementById("field-country").value = pilot.country ?? "un";
        const code = pilot.country ?? "un";
        document.getElementById("country-flag-preview").innerHTML =
            `<span class="fi fi-${code}"></span>`;
    }, 100);

    // Lockable fields (defer for same reason)
    setTimeout(() => {
        document.getElementById("field-teamId").value     = pilot.teamId     ?? "";
        document.getElementById("field-vehicleId").value  = pilot.vehicleId  ?? "";
        document.getElementById("field-controlsId").value = pilot.controlsId ?? "";
    }, 150);
}

function applyLockState() {
    isLocked = true;
    document.getElementById("lock-notice").style.display = "block";
    ["field-teamId", "field-vehicleId", "field-controlsId"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.setAttribute("disabled", "");
    });
    const saveBtn = document.getElementById("btn-save-raceconfig");
    if (saveBtn) saveBtn.disabled = true;
}

// ---------------------------------------------------------------------------
// Load reference data
// ---------------------------------------------------------------------------
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
    } catch { /* non-blocking */ }
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
    } catch { /* non-blocking */ }
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
    } catch { /* non-blocking */ }
}

// ---------------------------------------------------------------------------
// Open races + enrollment
// ---------------------------------------------------------------------------
async function loadOpenRaces() {
    const container = document.getElementById("open-races-list");

    let races = [];
    try {
        races = await apiFetch("/api/races?status=PENDING,SCHEDULED");
    } catch {
        container.innerHTML = `<p class="md-typescale-body-medium" style="color: var(--md-sys-color-on-surface-variant);">Could not load races.</p>`;
        return;
    }

    if (!races.length) {
        container.innerHTML = `<p class="md-typescale-body-medium" style="color: var(--md-sys-color-on-surface-variant);">No races open for registration.</p>`;
        return;
    }

    container.innerHTML = "";

    for (const race of races) {
        let entry = null;
        try {
            entry = await apiFetch(`/api/races/${race.id}/entries/me`);
        } catch { /* 404 = not registered */ }

        const card = document.createElement("div");
        card.className = "race-enroll-card m3-card";
        card.style.marginBottom = "12px";

        const statusLabel = { PENDING: "Open", SCHEDULED: "Scheduled" }[race.status] ?? race.status;

        const entryBadge = entry
            ? `<span class="meta-chip" style="background-color: color-mix(in srgb, var(--md-sys-color-tertiary-container) 60%, transparent); color: var(--md-sys-color-on-tertiary-container);">
                   <span class="material-symbols-outlined" style="font-size:14px">how_to_reg</span>
                   ${escHtml(entry.status)}
               </span>`
            : "";

        card.innerHTML = `
            <p class="md-typescale-title-small" style="margin: 0 0 8px 0;">${escHtml(race.name)}</p>
            <div class="race-meta">
                <span class="meta-chip"><span class="material-symbols-outlined" style="font-size:14px">flag</span> ${escHtml(statusLabel)}</span>
                <span class="meta-chip"><span class="material-symbols-outlined" style="font-size:14px">repeat</span> ${race.lapCount} laps</span>
                <span class="meta-chip"><span class="material-symbols-outlined" style="font-size:14px">settings_input_component</span> ${escHtml(race.trackingMode.toUpperCase())}</span>
                <span class="meta-chip"><span class="material-symbols-outlined" style="font-size:14px">cloud</span> ${escHtml(race.weather)}</span>
                ${entryBadge}
            </div>
            <div id="race-action-${race.id}" style="margin-top: 12px;"></div>
        `;

        container.appendChild(card);
        renderRaceAction(race, entry);
    }
}

function renderRaceAction(race, entry) {
    const actionDiv = document.getElementById(`race-action-${race.id}`);
    if (!actionDiv) return;

    if (!entry) {
        const btn = document.createElement("md-filled-button");
        btn.innerHTML = `<span class="material-symbols-outlined" slot="icon">how_to_reg</span> Register`;
        btn.addEventListener("click", () => handleRegisterToRace(race.id, btn));
        actionDiv.appendChild(btn);
    } else if (entry.status === "PENDING") {
        const row = document.createElement("div");
        row.style.cssText = "display:flex; align-items:center; gap:12px; flex-wrap:wrap;";

        const info = document.createElement("span");
        info.className = "md-typescale-body-small";
        info.style.color = "var(--md-sys-color-on-surface-variant)";
        info.textContent = "Awaiting admin validation";

        const cancelBtn = document.createElement("md-outlined-button");
        cancelBtn.innerHTML = `<span class="material-symbols-outlined" slot="icon">cancel</span> Cancel`;
        cancelBtn.addEventListener("click", () => handleCancelEntry(race.id, entry.id, cancelBtn));

        row.appendChild(info);
        row.appendChild(cancelBtn);
        actionDiv.appendChild(row);
    } else if (entry.status === "VALIDATED") {
        const info = document.createElement("span");
        info.className = "md-typescale-body-small";
        info.style.color = "var(--md-sys-color-tertiary)";
        info.innerHTML = `<span class="material-symbols-outlined inline-icon">verified</span> Validated — you're in!`;
        actionDiv.appendChild(info);
    }
}

// ---------------------------------------------------------------------------
// Save handlers
// ---------------------------------------------------------------------------
async function handleSaveIdentity() {
    hideError(); hideSuccess();
    const btn = document.getElementById("btn-save-identity");
    btn.disabled = true;

    const avatarUrl = fieldValue("field-avatarUrl");
    if (avatarUrl && !isValidUrl(avatarUrl)) {
        showError("Avatar URL is not a valid URL");
        btn.disabled = false;
        return;
    }

    try {
        const updated = await apiFetch("/api/pilots/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                displayName: fieldValue("field-displayName"),
                country:     document.getElementById("field-country").value || "un",
                avatarUrl:   avatarUrl || null,
            }),
        });
        currentPilot = updated;

        // Refresh avatar
        const container = document.getElementById("avatar-container");
        const initial = updated.displayName[0].toUpperCase();
        if (updated.avatarUrl) {
            container.innerHTML = `<img class="avatar-img" src="${escHtml(updated.avatarUrl)}" alt="Avatar"
                onerror="this.parentElement.innerHTML='<div class=\\'avatar-placeholder\\'>${initial}</div>'" />`;
        } else {
            container.innerHTML = `<div class="avatar-placeholder">${initial}</div>`;
        }
        document.getElementById("profile-displayName").textContent = updated.displayName;
        document.getElementById("header-displayName").textContent  = updated.displayName;

        showSuccess("Profile saved.");
    } catch (err) {
        showError(err.message || "Save failed");
    } finally {
        btn.disabled = false;
    }
}

async function handleSaveRaceConfig() {
    hideError(); hideSuccess();
    const btn = document.getElementById("btn-save-raceconfig");
    btn.disabled = true;

    try {
        await apiFetch("/api/pilots/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                teamId:     document.getElementById("field-teamId").value     || null,
                vehicleId:  document.getElementById("field-vehicleId").value  || null,
                controlsId: document.getElementById("field-controlsId").value || null,
            }),
        });
        showSuccess("Race configuration saved.");
    } catch (err) {
        if (err.message?.includes("locked")) {
            applyLockState();
            showError("These fields are locked after validation. Contact an admin.");
        } else {
            showError(err.message || "Save failed");
        }
    } finally {
        btn.disabled = false;
    }
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------
async function handleRegenerateToken() {
    hideError(); hideSuccess();
    const btn = document.getElementById("btn-regen-token");
    btn.disabled = true;
    try {
        const data = await apiFetch("/api/auth/regenerate-token", { method: "POST" });
        document.getElementById("ocr-token-value").textContent = data.ocrToken;
        const stored = JSON.parse(localStorage.getItem("cr_pilot") || "{}");
        stored.token = data.ocrToken;
        localStorage.setItem("cr_pilot", JSON.stringify(stored));
        showSuccess("Token regenerated. Update your OCR client.");
    } catch (err) {
        showError(err.message || "Failed to regenerate token");
    } finally {
        btn.disabled = false;
    }
}

async function copyToken() {
    const token = document.getElementById("ocr-token-value").textContent;
    if (!token || token === "—") return;
    try {
        await navigator.clipboard.writeText(token);
        showSuccess("Token copied to clipboard.");
    } catch {
        showError("Could not copy — select and copy manually.");
    }
}

// ---------------------------------------------------------------------------
// Race registration
// ---------------------------------------------------------------------------
async function handleRegisterToRace(raceId, btn) {
    btn.disabled = true;
    hideError(); hideSuccess();
    try {
        await apiFetch(`/api/races/${raceId}/entries`, { method: "POST" });
        showSuccess("Registered! Waiting for admin validation.");
        await loadOpenRaces();
    } catch (err) {
        showError(err.message || "Registration failed");
        btn.disabled = false;
    }
}

async function handleCancelEntry(raceId, entryId, btn) {
    btn.disabled = true;
    hideError(); hideSuccess();
    try {
        await apiFetch(`/api/races/${raceId}/entries/${entryId}`, { method: "DELETE" });
        showSuccess("Registration cancelled.");
        await loadOpenRaces();
    } catch (err) {
        showError(err.message || "Cancellation failed");
        btn.disabled = false;
    }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
function handleLogout() {
    localStorage.removeItem("cr_jwt");
    localStorage.removeItem("cr_pilot");
    window.location.href = "register.html";
}

// ---------------------------------------------------------------------------
// Country select
// ---------------------------------------------------------------------------
function populateCountrySelect() {
    const select = document.getElementById("field-country");
    COUNTRIES.forEach(({ code, name }) => {
        const opt = document.createElement("md-select-option");
        opt.value = code;
        opt.innerHTML = `<div slot="headline">${name}</div>`;
        select.appendChild(opt);
    });
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function showError(msg) {
    document.getElementById("error-text").textContent = msg;
    document.getElementById("error-banner").hidden = false;
    document.getElementById("success-banner").hidden = true;
}
function hideError() { document.getElementById("error-banner").hidden = true; }

function showSuccess(msg) {
    document.getElementById("success-text").textContent = msg;
    document.getElementById("success-banner").hidden = false;
    document.getElementById("error-banner").hidden = true;
    setTimeout(() => { document.getElementById("success-banner").hidden = true; }, 4000);
}
function hideSuccess() { document.getElementById("success-banner").hidden = true; }

function fieldValue(id) { return (document.getElementById(id)?.value ?? "").trim(); }
function setFieldValue(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function isValidUrl(str) { try { new URL(str); return true; } catch { return false; } }
function escHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// API helper — injects JWT automatically
// ---------------------------------------------------------------------------
async function apiFetch(path, options = {}) {
    const jwt = localStorage.getItem("cr_jwt");
    const headers = { ...(options.headers ?? {}) };
    if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
    const res = await fetch(path, { ...options, headers });
    if (res.status === 204) return null;
    const json = await res.json();
    if (!res.ok) {
        const err = new Error(json.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return json;
}
