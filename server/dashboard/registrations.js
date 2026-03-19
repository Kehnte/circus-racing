// registrations.js — Gestion des inscriptions : validation, rejet, révocation,
// réadmission et ajout direct par l'admin.

let _registrationsRaces = [];

async function initRegistrations() {
    await loadRegistrationRaces();
}

async function loadRegistrationRaces() {
    try {
        const races  = await apiGet("/races");
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

async function loadRegistrations() {
    const select  = document.getElementById("registrations-race-select");
    const content = document.getElementById("registrations-content");
    const badge   = document.getElementById("registrations-badge");
    if (!select || !content) return;

    const raceId = select.value;
    if (!raceId) {
        content.innerHTML   = `<p class="md-typescale-body-medium" style="color: var(--md-sys-color-on-surface-variant);">Select a race to view registrations.</p>`;
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
    const rejected  = entries.filter(e => e.status === "REJECTED");
    const revoked   = entries.filter(e => e.status === "REVOKED");

    badge.textContent   = pending.length > 0 ? String(pending.length) : "";
    badge.style.display = pending.length > 0 ? "inline-flex" : "none";

    if (!entries.length) {
        content.innerHTML = `<p class="md-typescale-body-medium" style="color: var(--md-sys-color-on-surface-variant);">No registrations for this race yet.</p>`;
        return;
    }

    let html = "";

    // --- PENDING ---
    if (pending.length) {
        html += `<p class="registrations-group-label">Awaiting validation (${pending.length})</p>`;
        html += `<div class="m3-table-wrapper" style="margin-bottom:20px;">
            <table class="m3-table"><thead><tr>
                <th style="width:28px"></th>
                <th>Pilot</th><th>Team</th><th>Vehicle</th><th>Controls</th>
                <th style="width:180px">Actions</th>
            </tr></thead><tbody>`;
        pending.forEach(entry => {
            const p = entry.pilot;
            html += `<tr id="entry-row-${entry.id}">
                <td>${_avatarCell(p)}</td>
                <td><span style="font-weight:500">${escReg(p?.displayName ?? "—")}</span>
                    ${p?.country ? `<span class="fi fi-${escReg(p.country)}" style="margin-left:6px;"></span>` : ""}
                </td>
                <td>${escReg(p?.teamId     ? "Lié" : "—")}</td>
                <td>${escReg(p?.vehicleId  ? "Lié" : "—")}</td>
                <td>${escReg(p?.controlsId ? "Lié" : "—")}</td>
                <td>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <md-filled-button
                            style="--md-filled-button-container-color:var(--md-sys-color-tertiary);--md-filled-button-label-text-color:var(--md-sys-color-on-tertiary);"
                            onclick="validateEntry('${entry.raceId}','${entry.id}')" id="btn-validate-${entry.id}">
                            <span class="material-symbols-outlined" slot="icon">verified</span>Validate
                        </md-filled-button>
                        <md-outlined-button
                            style="--md-outlined-button-label-text-color:var(--md-sys-color-error);--md-outlined-button-outline-color:var(--md-sys-color-error);"
                            onclick="rejectEntry('${entry.raceId}','${entry.id}')" id="btn-reject-${entry.id}">
                            <span class="material-symbols-outlined" slot="icon">block</span>Reject
                        </md-outlined-button>
                    </div>
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // --- VALIDATED ---
    if (validated.length) {
        html += `<p class="registrations-group-label">Validated (${validated.length})</p>`;
        html += `<div class="m3-table-wrapper" style="margin-bottom:20px;">
            <table class="m3-table"><thead><tr>
                <th style="width:28px"></th>
                <th>Pilot</th>
                <th style="width:110px">Status</th>
                <th style="width:120px">Actions</th>
            </tr></thead><tbody>`;
        validated.forEach(entry => {
            const p = entry.pilot;
            html += `<tr>
                <td>${_avatarCell(p, "tertiary")}</td>
                <td><span style="font-weight:500">${escReg(p?.displayName ?? "—")}</span>
                    ${p?.country ? `<span class="fi fi-${escReg(p.country)}" style="margin-left:6px;"></span>` : ""}
                </td>
                <td><span style="color:var(--md-sys-color-tertiary);font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:14px">verified</span>Validated
                </span></td>
                <td>
                    <md-outlined-button
                        style="--md-outlined-button-label-text-color:var(--md-sys-color-error);--md-outlined-button-outline-color:var(--md-sys-color-error);"
                        onclick="revokeEntry('${entry.raceId}','${entry.id}')">
                        <span class="material-symbols-outlined" slot="icon">person_remove</span>Revoke
                    </md-outlined-button>
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // --- REJECTED / REVOKED ---
    const inactive = [...rejected, ...revoked];
    if (inactive.length) {
        html += `<p class="registrations-group-label" style="color:var(--md-sys-color-on-surface-variant);">Rejected / Revoked (${inactive.length})</p>`;
        html += `<div class="m3-table-wrapper" style="margin-bottom:20px;">
            <table class="m3-table"><thead><tr>
                <th style="width:28px"></th>
                <th>Pilot</th>
                <th style="width:100px">Status</th>
                <th style="width:140px">Actions</th>
            </tr></thead><tbody>`;
        inactive.forEach(entry => {
            const p = entry.pilot;
            html += `<tr>
                <td>${_avatarCell(p)}</td>
                <td><span style="font-weight:500">${escReg(p?.displayName ?? entry.pilotId)}</span></td>
                <td><span style="font-size:12px;opacity:0.7">${escReg(entry.status)}</span></td>
                <td>
                    <md-filled-button
                        style="--md-filled-button-container-color:var(--md-sys-color-secondary-container);--md-filled-button-label-text-color:var(--md-sys-color-on-secondary-container);"
                        onclick="readmitEntry('${entry.raceId}','${entry.id}')">
                        <span class="material-symbols-outlined" slot="icon">how_to_reg</span>Readmit
                    </md-filled-button>
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // --- ADMIN ADD ---
    html += `<p class="registrations-group-label">Ajouter un pilote directement</p>`;
    html += `<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:20px;">
        ${_buildAdminAddSelect(entries, raceId)}
    </div>`;

    content.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Actions sur les entrées
// ---------------------------------------------------------------------------

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

async function rejectEntry(raceId, entryId) {
    if (!confirm("Rejeter cette inscription ?")) return;
    const btn = document.getElementById(`btn-reject-${entryId}`);
    if (btn) btn.disabled = true;
    try {
        await apiPatch(`/races/${raceId}/entries/${entryId}/reject`);
        await loadRegistrations();
    } catch (err) {
        alert(`Rejection failed: ${err.message}`);
        if (btn) btn.disabled = false;
    }
}

async function revokeEntry(raceId, entryId) {
    if (!confirm("Révoquer cette inscription validée ?")) return;
    try {
        await apiPatch(`/races/${raceId}/entries/${entryId}/revoke`);
        await loadRegistrations();
    } catch (err) {
        alert(`Revoke failed: ${err.message}`);
    }
}

async function readmitEntry(raceId, entryId) {
    try {
        await apiPatch(`/races/${raceId}/entries/${entryId}/readmit`);
        await loadRegistrations();
    } catch (err) {
        alert(`Readmit failed: ${err.message}`);
    }
}

async function adminDirectAdd(raceId) {
    const select  = document.getElementById(`reg-admin-add-select-${raceId}`);
    const pilotId = select?.value;
    if (!pilotId) { alert("Sélectionner un pilote"); return; }
    try {
        await apiPost(`/races/${raceId}/entries/admin`, { pilotId });
        await loadRegistrations();
    } catch (err) {
        alert(`Admin add failed: ${err.message}`);
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _avatarCell(p, containerColor = "primary") {
    if (p?.avatarUrl) {
        return `<img src="${escReg(p.avatarUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'" />`;
    }
    const initial = escReg((p?.displayName ?? "?")[0].toUpperCase());
    return `<div style="width:32px;height:32px;border-radius:50%;background:var(--md-sys-color-${containerColor}-container);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;color:var(--md-sys-color-on-${containerColor}-container);">${initial}</div>`;
}

function _buildAdminAddSelect(entries, raceId) {
    const inRace     = new Set(entries.map(e => e.pilotId));
    const allPilots  = typeof pilots !== "undefined" ? pilots : [];
    const available  = allPilots.filter(p => !inRace.has(p.id));

    let selectHtml = `<select id="reg-admin-add-select-${raceId}" style="flex:1;min-width:200px;padding:8px 12px;border-radius:8px;border:1px solid var(--md-sys-color-outline);background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface);font-size:14px;">
        <option value="">— Sélectionner un pilote —</option>`;
    available.forEach(p => {
        selectHtml += `<option value="${escReg(p.id)}">${escReg(p.displayName ?? p.name ?? p.id)}</option>`;
    });
    selectHtml += `</select>`;
    selectHtml += `<md-filled-button onclick="adminDirectAdd('${raceId}')">
        <span class="material-symbols-outlined" slot="icon">person_add</span>Ajouter
    </md-filled-button>`;
    return selectHtml;
}

function escReg(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", () => {
    initRegistrations();
});
