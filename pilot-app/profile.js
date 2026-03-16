// profile.js

// ---------------------------------------------------------------------------
// Country list — all ISO 3166-1 alpha-2 countries supported by flag-icons
// ---------------------------------------------------------------------------
const COUNTRIES = [
    { code: "af", name: "Afghanistan" },
    { code: "al", name: "Albania" },
    { code: "dz", name: "Algeria" },
    { code: "ad", name: "Andorra" },
    { code: "ao", name: "Angola" },
    { code: "ag", name: "Antigua and Barbuda" },
    { code: "ar", name: "Argentina" },
    { code: "am", name: "Armenia" },
    { code: "au", name: "Australia" },
    { code: "at", name: "Austria" },
    { code: "az", name: "Azerbaijan" },
    { code: "bs", name: "Bahamas" },
    { code: "bh", name: "Bahrain" },
    { code: "bd", name: "Bangladesh" },
    { code: "bb", name: "Barbados" },
    { code: "by", name: "Belarus" },
    { code: "be", name: "Belgium" },
    { code: "bz", name: "Belize" },
    { code: "bj", name: "Benin" },
    { code: "bt", name: "Bhutan" },
    { code: "bo", name: "Bolivia" },
    { code: "ba", name: "Bosnia and Herzegovina" },
    { code: "bw", name: "Botswana" },
    { code: "br", name: "Brazil" },
    { code: "bn", name: "Brunei" },
    { code: "bg", name: "Bulgaria" },
    { code: "bf", name: "Burkina Faso" },
    { code: "bi", name: "Burundi" },
    { code: "cv", name: "Cabo Verde" },
    { code: "kh", name: "Cambodia" },
    { code: "cm", name: "Cameroon" },
    { code: "ca", name: "Canada" },
    { code: "cf", name: "Central African Republic" },
    { code: "td", name: "Chad" },
    { code: "cl", name: "Chile" },
    { code: "cn", name: "China" },
    { code: "co", name: "Colombia" },
    { code: "km", name: "Comoros" },
    { code: "cd", name: "Congo (DRC)" },
    { code: "cg", name: "Congo (Republic)" },
    { code: "cr", name: "Costa Rica" },
    { code: "hr", name: "Croatia" },
    { code: "cu", name: "Cuba" },
    { code: "cy", name: "Cyprus" },
    { code: "cz", name: "Czech Republic" },
    { code: "dk", name: "Denmark" },
    { code: "dj", name: "Djibouti" },
    { code: "dm", name: "Dominica" },
    { code: "do", name: "Dominican Republic" },
    { code: "ec", name: "Ecuador" },
    { code: "eg", name: "Egypt" },
    { code: "sv", name: "El Salvador" },
    { code: "gq", name: "Equatorial Guinea" },
    { code: "er", name: "Eritrea" },
    { code: "ee", name: "Estonia" },
    { code: "sz", name: "Eswatini" },
    { code: "et", name: "Ethiopia" },
    { code: "fj", name: "Fiji" },
    { code: "fi", name: "Finland" },
    { code: "fr", name: "France" },
    { code: "ga", name: "Gabon" },
    { code: "gm", name: "Gambia" },
    { code: "ge", name: "Georgia" },
    { code: "de", name: "Germany" },
    { code: "gh", name: "Ghana" },
    { code: "gr", name: "Greece" },
    { code: "gd", name: "Grenada" },
    { code: "gt", name: "Guatemala" },
    { code: "gn", name: "Guinea" },
    { code: "gw", name: "Guinea-Bissau" },
    { code: "gy", name: "Guyana" },
    { code: "ht", name: "Haiti" },
    { code: "hn", name: "Honduras" },
    { code: "hu", name: "Hungary" },
    { code: "is", name: "Iceland" },
    { code: "in", name: "India" },
    { code: "id", name: "Indonesia" },
    { code: "ir", name: "Iran" },
    { code: "iq", name: "Iraq" },
    { code: "ie", name: "Ireland" },
    { code: "il", name: "Israel" },
    { code: "it", name: "Italy" },
    { code: "jm", name: "Jamaica" },
    { code: "jp", name: "Japan" },
    { code: "jo", name: "Jordan" },
    { code: "kz", name: "Kazakhstan" },
    { code: "ke", name: "Kenya" },
    { code: "ki", name: "Kiribati" },
    { code: "kw", name: "Kuwait" },
    { code: "kg", name: "Kyrgyzstan" },
    { code: "la", name: "Laos" },
    { code: "lv", name: "Latvia" },
    { code: "lb", name: "Lebanon" },
    { code: "ls", name: "Lesotho" },
    { code: "lr", name: "Liberia" },
    { code: "ly", name: "Libya" },
    { code: "li", name: "Liechtenstein" },
    { code: "lt", name: "Lithuania" },
    { code: "lu", name: "Luxembourg" },
    { code: "mg", name: "Madagascar" },
    { code: "mw", name: "Malawi" },
    { code: "my", name: "Malaysia" },
    { code: "mv", name: "Maldives" },
    { code: "ml", name: "Mali" },
    { code: "mt", name: "Malta" },
    { code: "mh", name: "Marshall Islands" },
    { code: "mr", name: "Mauritania" },
    { code: "mu", name: "Mauritius" },
    { code: "mx", name: "Mexico" },
    { code: "fm", name: "Micronesia" },
    { code: "md", name: "Moldova" },
    { code: "mc", name: "Monaco" },
    { code: "mn", name: "Mongolia" },
    { code: "me", name: "Montenegro" },
    { code: "ma", name: "Morocco" },
    { code: "mz", name: "Mozambique" },
    { code: "mm", name: "Myanmar" },
    { code: "na", name: "Namibia" },
    { code: "nr", name: "Nauru" },
    { code: "np", name: "Nepal" },
    { code: "nl", name: "Netherlands" },
    { code: "nz", name: "New Zealand" },
    { code: "ni", name: "Nicaragua" },
    { code: "ne", name: "Niger" },
    { code: "ng", name: "Nigeria" },
    { code: "kp", name: "North Korea" },
    { code: "mk", name: "North Macedonia" },
    { code: "no", name: "Norway" },
    { code: "om", name: "Oman" },
    { code: "pk", name: "Pakistan" },
    { code: "pw", name: "Palau" },
    { code: "pa", name: "Panama" },
    { code: "pg", name: "Papua New Guinea" },
    { code: "py", name: "Paraguay" },
    { code: "pe", name: "Peru" },
    { code: "ph", name: "Philippines" },
    { code: "pl", name: "Poland" },
    { code: "pt", name: "Portugal" },
    { code: "qa", name: "Qatar" },
    { code: "ro", name: "Romania" },
    { code: "ru", name: "Russia" },
    { code: "rw", name: "Rwanda" },
    { code: "kn", name: "Saint Kitts and Nevis" },
    { code: "lc", name: "Saint Lucia" },
    { code: "vc", name: "Saint Vincent and the Grenadines" },
    { code: "ws", name: "Samoa" },
    { code: "sm", name: "San Marino" },
    { code: "st", name: "Sao Tome and Principe" },
    { code: "sa", name: "Saudi Arabia" },
    { code: "sn", name: "Senegal" },
    { code: "rs", name: "Serbia" },
    { code: "sc", name: "Seychelles" },
    { code: "sl", name: "Sierra Leone" },
    { code: "sg", name: "Singapore" },
    { code: "sk", name: "Slovakia" },
    { code: "si", name: "Slovenia" },
    { code: "sb", name: "Solomon Islands" },
    { code: "so", name: "Somalia" },
    { code: "za", name: "South Africa" },
    { code: "ss", name: "South Sudan" },
    { code: "kr", name: "South Korea" },
    { code: "es", name: "Spain" },
    { code: "lk", name: "Sri Lanka" },
    { code: "sd", name: "Sudan" },
    { code: "sr", name: "Suriname" },
    { code: "se", name: "Sweden" },
    { code: "ch", name: "Switzerland" },
    { code: "sy", name: "Syria" },
    { code: "tw", name: "Taiwan" },
    { code: "tj", name: "Tajikistan" },
    { code: "tz", name: "Tanzania" },
    { code: "th", name: "Thailand" },
    { code: "tl", name: "Timor-Leste" },
    { code: "tg", name: "Togo" },
    { code: "to", name: "Tonga" },
    { code: "tt", name: "Trinidad and Tobago" },
    { code: "tn", name: "Tunisia" },
    { code: "tr", name: "Turkey" },
    { code: "tm", name: "Turkmenistan" },
    { code: "tv", name: "Tuvalu" },
    { code: "ug", name: "Uganda" },
    { code: "ua", name: "Ukraine" },
    { code: "ae", name: "United Arab Emirates" },
    { code: "gb", name: "United Kingdom" },
    { code: "us", name: "United States" },
    { code: "uy", name: "Uruguay" },
    { code: "uz", name: "Uzbekistan" },
    { code: "vu", name: "Vanuatu" },
    { code: "ve", name: "Venezuela" },
    { code: "vn", name: "Vietnam" },
    { code: "ye", name: "Yemen" },
    { code: "zm", name: "Zambia" },
    { code: "zw", name: "Zimbabwe" },
];

function resolveCountry(value) {
    const v = (value || "").trim().toLowerCase();
    return COUNTRIES.find(c => c.code === v || c.name.toLowerCase() === v) ?? null;
}

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

    // Sync teams/vehicles/controls in real-time when dashboard mutates them
    const crDataChannel = new BroadcastChannel("cr-data");
    crDataChannel.onmessage = ({ data }) => {
        if (data.resource === "teams")    loadTeams();
        else if (data.resource === "vehicles") loadVehicles();
        else if (data.resource === "controls") loadControls();
    };

    initCountryCombobox();
});

// ---------------------------------------------------------------------------
// Load profile from API
// ---------------------------------------------------------------------------
async function loadProfile() {
    const pilot = await apiFetch("/api/pilots/me");
    currentPilot = pilot;

    // Header
    document.getElementById("header-displayName").textContent = pilot.displayName;
    const dashBtn = document.getElementById("btn-goto-dashboard");
    if (dashBtn && (pilot.role === "ADMIN" || pilot.role === "MODERATOR")) dashBtn.hidden = false;

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

    // Country + flag
    const countryMatch = resolveCountry(pilot.country ?? "");
    document.getElementById("field-country").value = countryMatch ? countryMatch.name : "";
    document.getElementById("country-flag-preview").innerHTML =
        `<span class="fi fi-${countryMatch ? countryMatch.code : "un"}"></span>`;

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
        btn.innerHTML = `<md-icon slot="icon">how_to_reg</md-icon> Register`;
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
        cancelBtn.innerHTML = `<md-icon slot="icon">cancel</md-icon> Cancel`;
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

    const countryMatch = resolveCountry(document.getElementById("field-country").value);
    if (!countryMatch) {
        showError("Please select a valid country from the list");
        btn.disabled = false;
        return;
    }

    try {
        const updated = await apiFetch("/api/pilots/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                displayName: fieldValue("field-displayName"),
                country:     countryMatch.code,
                avatarUrl:   avatarUrl || null,
            }),
        });
        currentPilot = updated;
        localStorage.setItem("cr_pilot", JSON.stringify(updated));

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
// Country combobox
// ---------------------------------------------------------------------------
let countryDropdownIndex = -1;

function filterCountries(query) {
    if (!query) return [];
    const q = query.toLowerCase();
    const starts   = COUNTRIES.filter(c => c.name.toLowerCase().startsWith(q));
    const contains = COUNTRIES.filter(c => !c.name.toLowerCase().startsWith(q) && c.name.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, 8);
}

function renderCountryDropdown(results) {
    const dd = document.getElementById("country-dropdown");
    if (!results.length) { dd.hidden = true; return; }
    dd.innerHTML = results.map(c =>
        `<div class="country-dropdown-item" data-code="${c.code}" data-name="${c.name}">
            <span class="fi fi-${c.code}"></span>${c.name}
        </div>`
    ).join("");
    dd.querySelectorAll(".country-dropdown-item").forEach(item => {
        item.addEventListener("mousedown", e => {
            e.preventDefault();
            selectCountry(item.dataset.name, item.dataset.code);
        });
    });
    countryDropdownIndex = -1;
    dd.hidden = false;
}

function selectCountry(name, code) {
    document.getElementById("field-country").value = name;
    document.getElementById("country-flag-preview").innerHTML = `<span class="fi fi-${code}"></span>`;
    document.getElementById("country-dropdown").hidden = true;
}

function initCountryCombobox() {
    const input = document.getElementById("field-country");

    input.addEventListener("input", e => {
        const results = filterCountries(e.target.value);
        renderCountryDropdown(results);
        const first = results[0] ?? resolveCountry(e.target.value);
        document.getElementById("country-flag-preview").innerHTML =
            `<span class="fi fi-${first ? first.code : "un"}"></span>`;
    });

    input.addEventListener("keydown", e => {
        const dd = document.getElementById("country-dropdown");
        const items = [...dd.querySelectorAll(".country-dropdown-item")];
        if (dd.hidden || !items.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            countryDropdownIndex = Math.min(countryDropdownIndex + 1, items.length - 1);
            items.forEach((el, i) => el.classList.toggle("active", i === countryDropdownIndex));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            countryDropdownIndex = Math.max(countryDropdownIndex - 1, 0);
            items.forEach((el, i) => el.classList.toggle("active", i === countryDropdownIndex));
        } else if (e.key === "Enter" && countryDropdownIndex >= 0) {
            e.preventDefault();
            const item = items[countryDropdownIndex];
            selectCountry(item.dataset.name, item.dataset.code);
        } else if (e.key === "Escape") {
            dd.hidden = true;
        }
    });

    input.addEventListener("blur", () => {
        setTimeout(() => { document.getElementById("country-dropdown").hidden = true; }, 150);
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
