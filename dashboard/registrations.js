// registrations.js
// Gestion des inscriptions pilotes (PENDING → VALIDATED) dans le dashboard admin/modo.
// Chargé après les autres scripts du dashboard — dépend de : getAuthHeaders() (storage.js ou race.js)

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let _registrationsRaces    = []; // liste des courses chargées
let _currentRaceId         = null;

// ---------------------------------------------------------------------------
// Init — appelé au DOMContentLoaded (voir bas de fichier)
// ---------------------------------------------------------------------------
async function initRegistrations() {
    await loadRegistrationRaces();
}

// ---------------------------------------------------------------------------
// Charge la liste des courses dans le select
// ---------------------------------------------------------------------------
async function loadRegistrationRaces() {
    try {
        const races = await apiFetchAdmin("/api/races");
        _registrationsRaces = races;

        const select = document.getElementById("registrations-race-select");
        if (!select) return;

        // Conserver la sélection courante si possible
        const previousValue = select.value;

        // Vider sauf le placeholder
        while (select.options && select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        // Fallback pour md-outlined-select (custom element)
        select.querySelectorAll("md-select-option:not([value=''])").forEach(o => o.remove());

        races.forEach(race => {
            const opt = document.createElement("md-select-option");
            opt.value = race.id;
            const statusLabel = { PENDING: "Open", SCHEDULED: "Scheduled", STARTED: "Started", FINISHED: "Finished" }[race.status] ?? race.status;
            opt.innerHTML = `<div slot="headline">${escReg(race.name)}</div><div slot="supporting-text">${escReg(statusLabel)}</div>`;
            select.appendChild(opt);
        });

        // Restaurer la sélection
        if (previousValue && races.find(r => r.id === previousValue)) {
            setTimeout(() => { select.value = previousValue; }, 50);
        }
    } catch (err) {
        console.warn("registrations: failed to load races", err.message);
    }
}

// ---------------------------------------------------------------------------
// Charge les inscriptions pour la course sélectionnée
// ---------------------------------------------------------------------------
async function loadRegistrations() {
    const select  = document.getElementById("registrations-race-select");
    const content = document.getElementById("registrations-content");
    const badge   = document.getElementById("registrations-badge");
    if (!select || !content) return;

    const raceId = select.value;
    _currentRaceId = raceId || null;

    if (!raceId) {
        content.innerHTML = `<p class="md-typescale-body-medium" style="color: var(--md-sys-color-on-surface-variant);">Select a race to view pending registrations.</p>`;
        badge.style.display = "none";
        return;
    }

    // Chercher le mode tracking de la course
    const race = _registrationsRaces.find(r => r.id === raceId);
    const isAutoMode = race?.trackingMode === "auto";

    content.innerHTML = `<p class="md-typescale-body-medium" style="color: var(--md-sys-color-on-surface-variant);">Loading…</p>`;

    let entries = [];
    try {
        entries = await apiFetchAdmin(`/api/races/${raceId}/entries`);
    } catch (err) {
        content.innerHTML = `<p class="md-typescale-body-medium" style="color: var(--md-sys-color-error);">Failed to load entries: ${escReg(err.message)}</p>`;
        badge.style.display = "none";
        return;
    }

    const pending = entries.filter(e => e.status === "PENDING");

    // Badge compteur
    if (pending.length > 0) {
        badge.textContent     = String(pending.length);
        badge.style.display   = "inline-flex";
    } else {
        badge.style.display   = "none";
    }

    if (!entries.length) {
        content.innerHTML = `<p class="md-typescale-body-medium" style="color: var(--md-sys-color-on-surface-variant);">No registrations for this race yet.</p>`;
        return;
    }

    // Séparer PENDING des autres
    const validated = entries.filter(e => e.status === "VALIDATED");
    const others    = entries.filter(e => !["PENDING","VALIDATED"].includes(e.status));

    let html = "";

    // ── PENDING ───────────────────────────────────────────────────────────
    if (pending.length) {
        html += `<p class="registrations-group-label">Awaiting validation (${pending.length})</p>`;
        html += `<div class="m3-table-wrapper" style="margin-bottom: 20px;">
            <table class="m3-table">
                <thead>
                    <tr>
                        <th style="width:28px"></th>
                        <th>Pilot</th>
                        <th>Team</th>
                        <th>Vehicle</th>
                        <th>Controls</th>
                        <th style="width:140px">Actions</th>
                    </tr>
                </thead>
                <tbody>`;

        pending.forEach(entry => {
            const p = entry.pilot;

            html += `<tr id="entry-row-${entry.id}">
                <td>
                    ${p?.avatarUrl
                        ? `<img src="${escReg(p.avatarUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'" />`
                        : `<div style="width:32px;height:32px;border-radius:50%;background:var(--md-sys-color-primary-container);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;color:var(--md-sys-color-on-primary-container);">${escReg((p?.displayName ?? "?")[0].toUpperCase())}</div>`
                    }
                </td>
                <td>
                    <span style="font-weight:500">${escReg(p?.displayName ?? "—")}</span>
                    ${p?.country ? `<span class="fi fi-${escReg(p.country)}" style="margin-left:6px;"></span>` : ""}
                </td>
                <td>${escReg(p?.teamId ? "Team linked" : "—")}</td>
                <td>${escReg(p?.vehicleId ? "Vehicle linked" : "—")}</td>
                <td>${escReg(p?.controlsId ? "Controls linked" : "—")}</td>
                <td>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <md-filled-button
                            style="--md-filled-button-container-color: var(--md-sys-color-tertiary); --md-filled-button-label-text-color: var(--md-sys-color-on-tertiary);"
                            onclick="validateEntry('${entry.raceId}', '${entry.id}')"
                            id="btn-validate-${entry.id}"
                        >
                            <span class="material-symbols-outlined" slot="icon">verified</span>
                            Validate
                        </md-filled-button>
                    </div>
                </td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
    }

    // ── VALIDATED ─────────────────────────────────────────────────────────
    if (validated.length) {
        html += `<p class="registrations-group-label">Validated (${validated.length})</p>`;
        html += `<div class="m3-table-wrapper" style="margin-bottom: 20px;">
            <table class="m3-table">
                <thead>
                    <tr>
                        <th style="width:28px"></th>
                        <th>Pilot</th>
                        <th style="width:100px">Status</th>
                    </tr>
                </thead>
                <tbody>`;

        validated.forEach(entry => {
            const p = entry.pilot;
            html += `<tr>
                <td>
                    ${p?.avatarUrl
                        ? `<img src="${escReg(p.avatarUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'" />`
                        : `<div style="width:32px;height:32px;border-radius:50%;background:var(--md-sys-color-tertiary-container);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;color:var(--md-sys-color-on-tertiary-container);">${escReg((p?.displayName ?? "?")[0].toUpperCase())}</div>`
                    }
                </td>
                <td>
                    <span style="font-weight:500">${escReg(p?.displayName ?? "—")}</span>
                    ${p?.country ? `<span class="fi fi-${escReg(p.country)}" style="margin-left:6px;"></span>` : ""}
                </td>
                <td>
                    <span style="display:inline-flex;align-items:center;gap:4px;color:var(--md-sys-color-tertiary);font-size:12px;font-weight:500;">
                        <span class="material-symbols-outlined" style="font-size:14px">verified</span>
                        Validated
                    </span>
                </td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
    }

    // ── Autres statuts (DNF, FINISHED) ────────────────────────────────────
    if (others.length) {
        html += `<p class="registrations-group-label" style="color:var(--md-sys-color-on-surface-variant);">Other (${others.length})</p>`;
        html += `<div class="m3-table-wrapper"><table class="m3-table"><thead><tr><th>Pilot</th><th>Status</th></tr></thead><tbody>`;
        others.forEach(entry => {
            html += `<tr><td>${escReg(entry.pilot?.displayName ?? entry.pilotId)}</td><td>${escReg(entry.status)}</td></tr>`;
        });
        html += `</tbody></table></div>`;
    }

    content.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Validation d'une inscription
// ---------------------------------------------------------------------------
async function validateEntry(raceId, entryId) {
    const btn = document.getElementById(`btn-validate-${entryId}`);
    if (btn) btn.disabled = true;

    try {
        await apiFetchAdmin(`/api/races/${raceId}/entries/${entryId}/validate`, { method: "PATCH" });
        // Rafraîchir la liste
        await loadRegistrations();
    } catch (err) {
        alert(`Validation failed: ${err.message}`);
        if (btn) btn.disabled = false;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Appel API avec le JWT admin stocké en localStorage
async function apiFetchAdmin(path, options = {}) {
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

function escReg(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    initRegistrations();
});
