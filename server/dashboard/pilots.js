// pilots.js — Available Pilots table with inline registration actions.

let pilots         = [];
let editingPilotId = null;
let raceEntries    = [];

// map API pilot to internal dashboard format
function pilotFromApi(p) {
    return {
        ...p,
        name:      p.displayName,
        shipId:    p.vehicleId  ?? null,
        controlId: p.controlsId ?? null,
        country:   p.country    || "un",
    };
}

// load pilots from API and render
async function initPilots() {
    try {
        pilots = (await apiGet("/pilots")).map(pilotFromApi);
    } catch {
        pilots = [];
    }
    await loadRaceEntries();
    displayPilots();
}

// load race entries for the active race
async function loadRaceEntries() {
    const raceId = window.activeRaceId;
    if (!raceId) { raceEntries = []; return; }
    try { raceEntries = await apiGet(`/races/${raceId}/entries`); }
    catch { raceEntries = []; }
}

function findEntryForPilot(pilotId) {
    return raceEntries.find(e => e.pilotId === pilotId) ?? null;
}

async function refreshPilotsAndEntries() {
    await loadRaceEntries();
    displayPilots();
}

// get trimmed string value from an element by id
function getVal(id) {
    const el = document.getElementById(id);
    return el ? (el.value ?? "").toString().trim() : "";
}

// set element value by id
function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

// POST new pilot to API
async function addPilot() {
    const name      = getVal("pilot-name");
    const country   = getVal("pilot-country").toLowerCase();
    const teamId    = getVal("pilot-team");
    const shipId    = getVal("pilot-ship");
    const controlId = getVal("pilot-controls");

    const showTeams = typeof teamDisplayMode !== "undefined" ? teamDisplayMode !== "hidden" : true;
    if (!name || (showTeams && !teamId) || !shipId || !controlId) {
        alert("Please fill in all required fields");
        return;
    }

    try {
        const created = await apiPost("/pilots", {
            displayName: name,
            country:     country || "un",
            teamId:      showTeams ? teamId    : undefined,
            vehicleId:   shipId   || undefined,
            controlsId:  controlId || undefined,
        });
        pilots.push(pilotFromApi(created));
        displayPilots();
        clearPilotForm();
    } catch (e) {
        alert(e.message || "Failed to create pilot");
    }
}

// re-render the pilots table
function displayPilots() {
    const tableBody = document.getElementById("pilots-list");
    if (!tableBody) return;
    tableBody.innerHTML = "";
    pilots.forEach((pilot) => {
        const row = pilot.id === editingPilotId ? createPilotEditRow(pilot) : createPilotDisplayRow(pilot);
        tableBody.insertAdjacentHTML("beforeend", row);
    });
}

// check if a pilot is already enrolled in the active race
function isPilotInRace(pilotId) {
    return (window.currentRaceState?.pilots ?? []).some(p => p.id === pilotId);
}

// build registration action buttons based on entry status
function registrationCell(pilot) {
    const entry = findEntryForPilot(pilot.id);
    const hasRace = !!window.activeRaceId;
    const raceStatus = window.currentRaceState?.status;
    const canAct = hasRace && (raceStatus === "PENDING" || raceStatus === "SCHEDULED");
    const disabled = canAct ? "" : "disabled";
    const raceId = window.activeRaceId;

    if (!hasRace) return "";

    if (!entry) {
        return `<md-icon-button onclick="addPilotToRace('${pilot.id}')" ${disabled} title="Add to race"><md-icon>person_add</md-icon></md-icon-button>`;
    }

    switch (entry.status) {
        case "PENDING":
            return `<div class="action-buttons">
                <md-icon-button onclick="validateEntry('${raceId}','${entry.id}')" ${disabled} title="Validate"><md-icon>check</md-icon></md-icon-button>
                <md-icon-button onclick="rejectEntry('${raceId}','${entry.id}')" ${disabled} title="Reject" style="--md-icon-button-icon-color: var(--md-sys-color-error);"><md-icon>close</md-icon></md-icon-button>
            </div>`;
        case "VALIDATED":
            return `<md-icon-button onclick="revokeEntry('${raceId}','${entry.id}')" ${disabled} title="Revoke" style="--md-icon-button-icon-color: var(--md-sys-color-error);"><md-icon>person_remove</md-icon></md-icon-button>`;
        case "REJECTED":
        case "REVOKED":
            return `<md-icon-button onclick="readmitEntry('${raceId}','${entry.id}')" ${disabled} title="Readmit"><md-icon>undo</md-icon></md-icon-button>`;
        default:
            return "";
    }
}

// build the display row HTML for a pilot
function createPilotDisplayRow(pilot) {
    const team    = teams.find((t) => t.id === pilot.teamId);
    const vehicle = vehicles.find((v) => v.id === pilot.shipId);
    const ctrl    = controlsList.find((c) => c.id === pilot.controlId);
    const country = pilot.country || "un";

    return `
      <tr>
        <td>${pilot.name}</td>
        <td><span class="fi fi-${country} fis"></span> (${country.toUpperCase()})</td>
        <td class="team-ext">${team ? team.name : "---"}</td>
        <td>${vehicle ? vehicle.model : "No vehicle"}</td>
        <td>${ctrl ? ctrl.type : "Unknown"}</td>
        <td>${registrationCell(pilot)}</td>
        <td>
          <div class="action-buttons">
            <md-icon-button onclick="startEditPilot('${pilot.id}')" title="Edit"><md-icon>edit</md-icon></md-icon-button>
            <md-icon-button onclick="deletePilot('${pilot.id}')" title="Delete" style="--md-icon-button-icon-color: var(--md-sys-color-error);"><md-icon>delete</md-icon></md-icon-button>
          </div>
        </td>
      </tr>`;
}

// build the edit row HTML for a pilot
function createPilotEditRow(pilot) {
    const country = pilot.country || "un";

    const teamOptions = teams
        .map((t) => `<md-select-option value="${t.id}" ${t.id === pilot.teamId ? "selected" : ""}><div slot="headline">${t.name}</div></md-select-option>`)
        .join("");
    const vehicleOptions = vehicles
        .map((v) => `<md-select-option value="${v.id}" ${v.id === pilot.shipId ? "selected" : ""}><div slot="headline">${v.model}</div></md-select-option>`)
        .join("");
    const controlOptions = controlsList
        .map((c) => `<md-select-option value="${c.id}" ${c.id === pilot.controlId ? "selected" : ""}><div slot="headline">${c.type}</div></md-select-option>`)
        .join("");

    return `
    <tr>
      <td><md-outlined-text-field id="edit-pilot-name" value="${pilot.name}" style="width:100%;"></md-outlined-text-field></td>
      <td><md-outlined-text-field id="edit-pilot-country" value="${country}" maxlength="2" style="width:100%;"></md-outlined-text-field></td>
      <td class="team-ext"><md-outlined-select id="edit-pilot-team" style="width:100%;">${teamOptions}</md-outlined-select></td>
      <td><md-outlined-select id="edit-pilot-ship" style="width:100%;">${vehicleOptions}</md-outlined-select></td>
      <td><md-outlined-select id="edit-pilot-controls" style="width:100%;">${controlOptions}</md-outlined-select></td>
      <td></td>
      <td>
        <div class="action-buttons">
          <md-icon-button onclick="saveEditPilot('${pilot.id}')" title="Save"><md-icon>check</md-icon></md-icon-button>
          <md-icon-button onclick="cancelEditPilot()" title="Cancel"><md-icon>close</md-icon></md-icon-button>
        </div>
      </td>
    </tr>`;
}

// DELETE pilot via API
async function deletePilot(id) {
    try {
        await apiDelete(`/pilots/${id}`);
        pilots = pilots.filter((p) => p.id !== id);
        displayPilots();
    } catch (e) {
        alert(e.message || "Failed to delete pilot");
    }
}

function startEditPilot(id) { editingPilotId = id;   displayPilots(); }
function cancelEditPilot()   { editingPilotId = null; displayPilots(); }

// PATCH pilot via API
async function saveEditPilot(id) {
    const name      = getVal("edit-pilot-name");
    const country   = getVal("edit-pilot-country").toLowerCase();
    const teamId    = getVal("edit-pilot-team");
    const shipId    = getVal("edit-pilot-ship");
    const controlId = getVal("edit-pilot-controls");

    const showTeams = typeof teamDisplayMode !== "undefined" ? teamDisplayMode !== "hidden" : true;
    if (!name || (showTeams && !teamId) || !shipId || !controlId) {
        alert("Please fill in all fields");
        return;
    }

    try {
        const updated = await apiPatch(`/pilots/${id}`, {
            displayName: name,
            country:     country || "un",
            teamId:      showTeams ? teamId    : undefined,
            vehicleId:   shipId   || undefined,
            controlsId:  controlId || undefined,
        });
        const idx = pilots.findIndex((p) => p.id === id);
        if (idx !== -1) pilots[idx] = pilotFromApi(updated);
        editingPilotId = null;
        displayPilots();
    } catch (e) {
        alert(e.message || "Failed to update pilot");
    }
}

// clear the add-pilot form fields
function clearPilotForm() {
    setVal("pilot-name",    "");
    setVal("pilot-country", "");
    const teamSel = document.getElementById("pilot-team");     if (teamSel) teamSel.value   = "";
    const shipSel = document.getElementById("pilot-ship");     if (shipSel) shipSel.value   = "";
    const ctrlSel = document.getElementById("pilot-controls"); if (ctrlSel) ctrlSel.value = "";
}

// reload from API
function resetPilots() { initPilots(); }

// backward-compat alias
function updateShipDropdown() { updateVehicleDropdown(); }

// registration entry actions (migrated from registrations.js)

async function validateEntry(raceId, entryId) {
    try {
        await apiPatch(`/races/${raceId}/entries/${entryId}/validate`);
        await refreshPilotsAndEntries();
    } catch (err) {
        alert(`Validation failed: ${err.message}`);
    }
}

async function rejectEntry(raceId, entryId) {
    if (!confirm("Reject this registration?")) return;
    try {
        await apiPatch(`/races/${raceId}/entries/${entryId}/reject`);
        await refreshPilotsAndEntries();
    } catch (err) {
        alert(`Rejection failed: ${err.message}`);
    }
}

async function revokeEntry(raceId, entryId) {
    if (!confirm("Revoke this validated registration?")) return;
    try {
        await apiPatch(`/races/${raceId}/entries/${entryId}/revoke`);
        await refreshPilotsAndEntries();
    } catch (err) {
        alert(`Revoke failed: ${err.message}`);
    }
}

async function readmitEntry(raceId, entryId) {
    try {
        await apiPatch(`/races/${raceId}/entries/${entryId}/readmit`);
        await refreshPilotsAndEntries();
    } catch (err) {
        alert(`Readmit failed: ${err.message}`);
    }
}
