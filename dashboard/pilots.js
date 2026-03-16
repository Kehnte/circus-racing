// pilots.js

// Master list of registered pilots
let pilots = [];
// ID of the pilot row currently open for inline editing (null = none)
let editingPilotId = null;

function getVal(id) {
    const el = document.getElementById(id);
    if (!el) return "";
    return (el.value ?? "").toString().trim();
}

function setVal(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
}

function updateTeamDropdown() {
    const select = document.getElementById("pilot-team");
    if (!select) return;
    select.innerHTML = '<md-select-option value=""><div slot="headline">Select a team</div></md-select-option>';
    teams.forEach((team) => {
        select.innerHTML += `<md-select-option value="${team.id}"><div slot="headline">${team.name}</div></md-select-option>`;
    });
}

function updateVehicleDropdown() {
    const select = document.getElementById("pilot-ship");
    if (!select) return;
    select.innerHTML = '<md-select-option value=""><div slot="headline">Select a vehicle</div></md-select-option>';
    vehicles.forEach((vehicle) => {
        select.innerHTML += `<md-select-option value="${vehicle.id}"><div slot="headline">[${vehicle.category || 'ship'}] ${vehicle.model}</div></md-select-option>`;
    });
}

// Backward compat alias
function updateShipDropdown() { updateVehicleDropdown(); }

function updateControlDropdown() {
    const select = document.getElementById("pilot-controls");
    if (!select) return;
    select.innerHTML = '<md-select-option value=""><div slot="headline">Select controls</div></md-select-option>';
    controlsList.forEach((ctrl) => {
        select.innerHTML += `<md-select-option value="${ctrl.id}"><div slot="headline">${ctrl.type}</div></md-select-option>`;
    });
}

function addPilot() {
    const name = getVal("pilot-name");
    const country = getVal("pilot-country").toLowerCase();
    const teamId = getVal("pilot-team");
    const shipId = getVal("pilot-ship");
    const controlId = getVal("pilot-controls");

    const showTeams = typeof teamDisplayMode !== "undefined" ? teamDisplayMode !== "hidden" : true;
    const isTeamValid = showTeams ? teamId : true;

    if (!name || !isTeamValid || !shipId || !controlId) {
        alert("Please fill in all required fields");
        return;
    }

    const newPilot = {
        id: Date.now(),
        name: name,
        country: country || "un",
        teamId: showTeams ? parseInt(teamId) : null,
        shipId: parseInt(shipId),
        controlId: parseInt(controlId),
    };

    pilots.push(newPilot);
    displayPilots();
    clearPilotForm();
    saveToStorage();
}

function displayPilots() {
    const tableBody = document.getElementById("pilots-list");
    if (!tableBody) return;
    tableBody.innerHTML = "";
    pilots.forEach((pilot) => {
        const row = pilot.id === editingPilotId
            ? createPilotEditRow(pilot)
            : createPilotDisplayRow(pilot);
        tableBody.insertAdjacentHTML("beforeend", row);
    });
}

function createPilotDisplayRow(pilot) {
    const team = teams.find((t) => t.id === pilot.teamId);
    const vehicle = vehicles.find((v) => v.id === pilot.shipId);
    const ctrl = controlsList.find((c) => c.id === pilot.controlId);
    const safeCountry = pilot.country || "un";

    return `
      <tr>
        <td>${pilot.name}</td>
        <td><span class="fi fi-${safeCountry} fis"></span> (${safeCountry.toUpperCase()})</td>
        <td class="team-ext">
          ${team ? team.name : "---"}
        </td>
        <td>${vehicle ? `[${vehicle.category || 'ship'}] ${vehicle.model}` : "No vehicle"}</td>
        <td>${ctrl ? ctrl.type : "Unknown"}</td>
        <td>
          <div class="action-buttons">
            <md-icon-button onclick="startEditPilot(${pilot.id})" title="Edit">
              <md-icon>edit</md-icon>
            </md-icon-button>
            <md-icon-button onclick="deletePilot(${pilot.id})" title="Delete" style="--md-icon-button-icon-color: var(--md-sys-color-error);">
              <md-icon>delete</md-icon>
            </md-icon-button>
          </div>
        </td>
      </tr>`;
}

function createPilotEditRow(pilot) {
    const safeCountry = pilot.country || "un";

    let teamOptions = teams
        .map((t) => `<md-select-option value="${t.id}" ${t.id === pilot.teamId ? "selected" : ""}><div slot="headline">${t.name}</div></md-select-option>`)
        .join("");

    let vehicleOptions = vehicles
        .map((v) => `<md-select-option value="${v.id}" ${v.id === pilot.shipId ? "selected" : ""}><div slot="headline">[${v.category || 'ship'}] ${v.model}</div></md-select-option>`)
        .join("");

    let controlOptions = controlsList
        .map((c) => `<md-select-option value="${c.id}" ${c.id === pilot.controlId ? "selected" : ""}><div slot="headline">${c.type}</div></md-select-option>`)
        .join("");

    return `
    <tr>
      <td><md-outlined-text-field id="edit-pilot-name" value="${pilot.name}" style="width:100%;"></md-outlined-text-field></td>
      <td><md-outlined-text-field id="edit-pilot-country" value="${safeCountry}" maxlength="2" style="width:100%;"></md-outlined-text-field></td>
      <td class="team-ext">
        <md-outlined-select id="edit-pilot-team" style="width:100%;">${teamOptions}</md-outlined-select>
      </td>
      <td><md-outlined-select id="edit-pilot-ship" style="width:100%;">${vehicleOptions}</md-outlined-select></td>
      <td><md-outlined-select id="edit-pilot-controls" style="width:100%;">${controlOptions}</md-outlined-select></td>
      <td>
        <div class="action-buttons">
          <md-icon-button onclick="saveEditPilot(${pilot.id})" title="Save">
            <md-icon>check</md-icon>
          </md-icon-button>
          <md-icon-button onclick="cancelEditPilot()" title="Cancel">
            <md-icon>close</md-icon>
          </md-icon-button>
        </div>
      </td>
    </tr>`;
}

function deletePilot(idToDelete) {
    pilots = pilots.filter((p) => p.id !== idToDelete);
    displayPilots();
    saveToStorage();
}

function startEditPilot(id) {
    editingPilotId = id;
    displayPilots();
}

function cancelEditPilot() {
    editingPilotId = null;
    displayPilots();
}

function saveEditPilot(id) {
    const pilot = pilots.find((p) => p.id === id);
    const name = getVal("edit-pilot-name");
    const country = getVal("edit-pilot-country").toLowerCase();
    const teamId = getVal("edit-pilot-team");
    const shipId = getVal("edit-pilot-ship");
    const controlId = getVal("edit-pilot-controls");

    const showTeams = typeof teamDisplayMode !== "undefined" ? teamDisplayMode !== "hidden" : true;

    if (!name || (showTeams && !teamId) || !shipId || !controlId) {
        alert("Please fill in all fields");
        return;
    }

    pilot.name = name;
    pilot.country = country || "un";
    pilot.teamId = showTeams ? parseInt(teamId) : null;
    pilot.shipId = parseInt(shipId);
    pilot.controlId = parseInt(controlId);

    editingPilotId = null;
    displayPilots();
    saveToStorage();
}

function clearPilotForm() {
    setVal("pilot-name", "");
    setVal("pilot-country", "");
    const teamSel = document.getElementById("pilot-team");
    if (teamSel) teamSel.value = "";
    const shipSel = document.getElementById("pilot-ship");
    if (shipSel) shipSel.value = "";
    const ctrlSel = document.getElementById("pilot-controls");
    if (ctrlSel) ctrlSel.value = "";
}

document.addEventListener("DOMContentLoaded", () => {
    displayPilots();
    updateVehicleDropdown();
    updateTeamDropdown();
    updateControlDropdown();
});