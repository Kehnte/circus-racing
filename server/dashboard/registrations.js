// registrations.js

let _registrationsRaces = [];
let _currentRaceId      = null;

// init on page load
async function initRegistrations() {
    await loadRegistrationRaces();
}

// load races into the race selector dropdown
async function loadRegistrationRaces() {
    try {
        const races = await apiGet("/races");
        _registrationsRaces = races;

        const select = document.getElementById("registrations-race-select");
        if (!select) return;

        const previousValue = select.value;
        select.querySelectorAll("md-select-option:not([value=''])").forEach(o => o.remove());

        races.forEach(race => {
            const opt         = document.createElement("md-select-option");
            opt.value         = race.id;
            const statusLabel = { PENDING: "Open", SCHEDULED: "Scheduled", STARTED: "Started", FINISHED: "Finished" }[race.status] ?? race.status;
            opt.innerHTML     = `<div slot="headline">${escReg(race.name)}</div><div slot="supporting-text">${escReg(statusLabel)}</div>`;
            select.appendChild(opt);
        });

        if (previousValue && races.find(r => r.id === previousValue)) {
            setTimeout(() => { select.value = previousValue; }, 50);
        }
    } catch (err) {
        console.warn("registrations: failed to load races", err.message);
    }
}

// load and render entries for the selected race
async function loadRegistrations() {
    const select  = document.getElementById("registrations-race-select");
    const content = document.getElementById("registrations-content");
    const badge   = document.getElementById("registrations-badge");
    if (!select || !content) return;

    const raceId   = select.value;
    _currentRaceId = raceId || null;

    if (!raceId) {
        content.innerHTML  = `<p class="md-typescale-body-medium" style="color: var(--md-sys-color-on-surface-variant);">Select a race to view pending registrations.</p>`;
        badge.style.display = "none";
        return;
    }

    content.innerHTML = `<p class="md-typescale-body-medium" style="color: var(--md-sys-color-on-surface-variant);">Loading…</p>`;

    let entries = [];
    try {
        entries = await apiGet(`/races/${raceId}/entries`);
    } catch (err) {
        content.innerHTML   = `<p class="md-typescale-body-medium" style="color: var(--md-sys-color-error);">Failed to load entries: ${escReg(err.message)}</p>`;
        badge.style.display = "none";
        return;
    }

    const pending   = entries.filter(e => e.status === "PENDING");
    const validated = entries.filter(e => e.status === "VALIDATED");
    const others    = entries.filter(e => !["PENDING", "VALIDATED"].includes(e.status));

    if (pending.length > 0) {
        badge.textContent   = String(pending.length);
        badge.style.display = "inline-flex";
    } else {
        badge.style.display = "none";
    }

    if (!entries.length) {
        content.innerHTML = `<p class="md-typescale-body-medium" style="color: var(--md-sys-color-on-surface-variant);">No registrations for this race yet.</p>`;
        return;
    }

    let html = "";

    if (pending.length) {
        html += `<p class="registrations-group-label">Awaiting validation (${pending.length})</p>`;
        html += `<div class="m3-table-wrapper" style="margin-bottom: 20px;">
            <table class="m3-table">
                <thead><tr>
                    <th style="width:28px"></th>
                    <th>Pilot</th><th>Team</th><th>Vehicle</th><th>Controls</th>
                    <th style="width:140px">Actions</th>
                </tr></thead>
                <tbody>`;

        pending.forEach(entry => {
            const p = entry.pilot;
            html += `<tr id="entry-row-${entry.id}">
                <td>${p?.avatarUrl
                    ? `<img src="${escReg(p.avatarUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'" />`
                    : `<div style="width:32px;height:32px;border-radius:50%;background:var(--md-sys-color-primary-container);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;color:var(--md-sys-color-on-primary-container);">${escReg((p?.displayName ?? "?")[0].toUpperCase())}</div>`
                }</td>
                <td>
                    <span style="font-weight:500">${escReg(p?.displayName ?? "—")}</span>
                    ${p?.country ? `<span class="fi fi-${escReg(p.country)}" style="margin-left:6px;"></span>` : ""}
                </td>
                <td>${escReg(p?.teamId     ? "Team linked"     : "—")}</td>
                <td>${escReg(p?.vehicleId  ? "Vehicle linked"  : "—")}</td>
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
                        <md-outlined-button
                            style="--md-outlined-button-label-text-color: var(--md-sys-color-error); --md-outlined-button-outline-color: var(--md-sys-color-error);"
                            onclick="rejectEntry('${entry.raceId}', '${entry.id}')"
                            id="btn-reject-${entry.id}"
                        >
                            <span class="material-symbols-outlined" slot="icon">block</span>
                            Reject
                        </md-outlined-button>
                    </div>
                </td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
    }

    if (validated.length) {
        html += `<p class="registrations-group-label">Validated (${validated.length})</p>`;
        html += `<div class="m3-table-wrapper" style="margin-bottom: 20px;">
            <table class="m3-table">
                <thead><tr>
                    <th style="width:28px"></th>
                    <th>Pilot</th>
                    <th style="width:100px">Status</th>
                </tr></thead>
                <tbody>`;

        validated.forEach(entry => {
            const p = entry.pilot;
            html += `<tr>
                <td>${p?.avatarUrl
                    ? `<img src="${escReg(p.avatarUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'" />`
                    : `<div style="width:32px;height:32px;border-radius:50%;background:var(--md-sys-color-tertiary-container);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;color:var(--md-sys-color-on-tertiary-container);">${escReg((p?.displayName ?? "?")[0].toUpperCase())}</div>`
                }</td>
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

// validate a pending entry and refresh the list
async function validateEntry(raceId, entryId) {
    const btn = document.getElementById(`btn-validate-${entryId}`);
    if (btn) btn.disabled = true;
    try {
        await apiPatch(`/races/${raceId}/entries/${entryId}/validate`);
        await loadRegistrations();
    } catch (err) {
        alert(`Validation failed: ${err.message}`);
        if (btn) btn.disabled = false;
    }
}

// reject (delete) a pending entry and refresh the list
async function rejectEntry(raceId, entryId) {
    if (!confirm("Rejeter cette inscription ?")) return;
    const btn = document.getElementById(`btn-reject-${entryId}`);
    if (btn) btn.disabled = true;
    try {
        await apiDelete(`/races/${raceId}/entries/${entryId}`);
        await loadRegistrations();
    } catch (err) {
        alert(`Rejection failed: ${err.message}`);
        if (btn) btn.disabled = false;
    }
}

// escape HTML special chars to prevent XSS in dynamic content
function escReg(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", () => {
    initRegistrations();
});
