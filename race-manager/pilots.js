// pilots.js

// Master list of registered pilots
let pilots = [];
// ID of the pilot row currently open for inline editing (null = none)
let editingPilotId = null;

// Return the trimmed string value of a form element by ID, works for both native inputs and Material Web md- components
function getVal(id) {
    const el = document.getElementById(id);
    if (!el) return "";
    return (el.value ?? "").toString().trim();
}

// Set the value of a form element by ID (native or md- component)
function setVal(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
}

// Rebuild the team dropdown options from the current teams array
function updateTeamDropdown() {
    const select = document.getElementById("pilot-team");
    if (!select) return;

    select.innerHTML = '<md-select-option value=""><div slot="headline">Select a team</div></md-select-option>';
    teams.forEach((team) => {
        select.innerHTML += `<md-select-option value="${team.id}"><div slot="headline">${team.name}</div></md-select-option>`;
    });
}

// Rebuild the ship dropdown options from the current ships array
function updateShipDropdown() {
    const select = document.getElementById("pilot-ship");
    if (!select) return;

    select.innerHTML = '<md-select-option value=""><div slot="headline">Select a ship</div></md-select-option>';
    ships.forEach((ship) => {
        select.innerHTML += `<md-select-option value="${ship.id}"><div slot="headline">${ship.model}</div></md-select-option>`;
    });
}

// Rebuild the controls dropdown options from the current controlsList array
function updateControlDropdown() {
    const select = document.getElementById("pilot-controls");
    if (!select) return;

    select.innerHTML = '<md-select-option value=""><div slot="headline">Select controls</div></md-select-option>';
    controlsList.forEach((ctrl) => {
        select.innerHTML += `<md-select-option value="${ctrl.id}"><div slot="headline">${ctrl.type}</div></md-select-option>`;
    });
}

// Read the add-pilot form, validate it and push a new pilot into the pilots array
function addPilot() {
    const name = getVal("pilot-name");
    const country = getVal("pilot-country").toLowerCase();
    const teamId = getVal("pilot-team");
    const shipId = getVal("pilot-ship");
    const controlId = getVal("pilot-controls");

    // Team is only required when team management is enabled
    const isTeamValid = isTeamManagementActive ? teamId : true;

    if (!name || !isTeamValid || !shipId || !controlId) {
        alert("Please fill in all required fields");
        return;
    }

    const newPilot = {
        id: Date.now(),
        name: name,
        country: country || "un",
        teamId: isTeamManagementActive ? parseInt(teamId) : null,
        shipId: parseInt(shipId),
        controlId: parseInt(controlId),
    };

    pilots.push(newPilot);
    displayPilots();
    clearPilotForm();
    saveToStorage();
}

// Re-render the pilots table, switching rows between display and edit mode as needed
function displayPilots() {
    const tableBody = document.getElementById("pilots-list");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    pilots.forEach((pilot) => {
        const row =
            pilot.id === editingPilotId
                ? createPilotEditRow(pilot)
                : createPilotDisplayRow(pilot);
        tableBody.insertAdjacentHTML("beforeend", row);
    });
}

// Build the read-only HTML table row for a given pilot
function createPilotDisplayRow(pilot) {
    const team = teams.find((t) => t.id === pilot.teamId);
    const ship = ships.find((s) => s.id === pilot.shipId);
    const ctrl = controlsList.find((c) => c.id === pilot.controlId);
    const safeCountry = pilot.country || "un";

    return `
      <tr>
        <td>${pilot.name}</td>
        <td><span class="fi fi-${safeCountry} fis"></span> (${safeCountry.toUpperCase()})</td>
        <td style="display: ${isTeamManagementActive ? "" : "none"}">
          ${team ? team.name : "---"}
        </td>
        <td>${ship ? ship.model : "No ship"}</td>
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

// Build the editable HTML table row for a given pilot (inline form fields)
function createPilotEditRow(pilot) {
    const safeCountry = pilot.country || "un";

    let teamOptions = teams
        .map((t) => `<md-select-option value="${t.id}" ${t.id === pilot.teamId ? "selected" : ""}><div slot="headline">${t.name}</div></md-select-option>`)
        .join("");

    let shipOptions = ships
        .map((s) => `<md-select-option value="${s.id}" ${s.id === pilot.shipId ? "selected" : ""}><div slot="headline">${s.model}</div></md-select-option>`)
        .join("");

    let controlOptions = controlsList
        .map((c) => `<md-select-option value="${c.id}" ${c.id === pilot.controlId ? "selected" : ""}><div slot="headline">${c.type}</div></md-select-option>`)
        .join("");

    return `
    <tr>
      <td><md-outlined-text-field id="edit-pilot-name" value="${pilot.name}" style="width:100%;"></md-outlined-text-field></td>
      <td><md-outlined-text-field id="edit-pilot-country" value="${safeCountry}" maxlength="2" style="width:100%;"></md-outlined-text-field></td>
      <td style="display: ${isTeamManagementActive ? "" : "none"}">
        <md-outlined-select id="edit-pilot-team" style="width:100%;">${teamOptions}</md-outlined-select>
      </td>
      <td><md-outlined-select id="edit-pilot-ship" style="width:100%;">${shipOptions}</md-outlined-select></td>
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

// Remove a pilot from the array by ID and refresh the table
function deletePilot(idToDelete) {
    const pilotToDelete = pilots.find((p) => p.id === idToDelete);
    if (pilotToDelete) {
        pilots = pilots.filter((p) => p.id !== idToDelete);
        displayPilots();
        saveToStorage();
    }
}

// Open a pilot row for inline editing
function startEditPilot(id) {
    editingPilotId = id;
    displayPilots();
}

// Discard in-progress edits and revert the row back to display mode
function cancelEditPilot() {
    editingPilotId = null;
    displayPilots();
}

// Validate the inline edit form and persist changes to the pilot object
function saveEditPilot(id) {
    const pilot = pilots.find((p) => p.id === id);
    const name = getVal("edit-pilot-name");
    const country = getVal("edit-pilot-country").toLowerCase();
    const teamId = getVal("edit-pilot-team");
    const shipId = getVal("edit-pilot-ship");
    const controlId = getVal("edit-pilot-controls");

    if (!name || (isTeamManagementActive && !teamId) || !shipId || !controlId) {
        alert("Please fill in all fields");
        return;
    }

    pilot.name = name;
    pilot.country = country || "un";
    // Only overwrite teamId when team management is active; otherwise keep the original
    pilot.teamId = isTeamManagementActive ? parseInt(teamId) : pilot.teamId;
    pilot.shipId = parseInt(shipId);
    pilot.controlId = parseInt(controlId);

    editingPilotId = null;
    displayPilots();
    saveToStorage();
}

// Reset all add-pilot form fields to empty
function clearPilotForm() {
    setVal("pilot-name", "");
    setVal("pilot-country", "");
    setVal("pilot-team", "");
    setVal("pilot-ship", "");
    setVal("pilot-controls", "");
}

// Populate all dropdowns once the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    updateTeamDropdown();
    updateShipDropdown();
    updateControlDropdown();
});