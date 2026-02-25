// src/pilots.js

let pilots = [];
let editingPilotId = null;

// Update the dropdown for selecting a team
function updateTeamDropdown() {
    const select = document.getElementById("pilot-team");
    if (!select) return;

    select.innerHTML = '<option value="">Select a team</option>';
    teams.forEach((team) => {
        select.innerHTML += `<option value="${team.id}">${team.name}</option>`;
    });
}

// Update the dropdown for selecting a ship
function updateShipDropdown() {
    const select = document.getElementById("pilot-ship");
    if (!select) return;

    select.innerHTML = '<option value="">Select a ship</option>';
    ships.forEach((ship) => {
        select.innerHTML += `<option value="${ship.id}">${ship.model}</option>`;
    });
}

// Update the dropdown for selecting controls
function updateControlDropdown() {
    const select = document.getElementById("pilot-controls");
    if (!select) return;

    select.innerHTML = '<option value="">Select controls</option>';
    controlsList.forEach((ctrl) => {
        select.innerHTML += `<option value="${ctrl.id}">${ctrl.type}</option>`;
    });
}

// Add a new pilot
function addPilot() {
    const name = document.getElementById("pilot-name").value.trim();
    const country = document
        .getElementById("pilot-country")
        .value.trim()
        .toLowerCase();
    const teamId = document.getElementById("pilot-team").value;
    const shipId = document.getElementById("pilot-ship").value;
    const controlId = document.getElementById("pilot-controls").value;

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

// Display all pilots in the table
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

// Create a display row for a pilot
function createPilotDisplayRow(pilot) {
    const team = teams.find((t) => t.id === pilot.teamId);
    const ship = ships.find((s) => s.id === pilot.shipId);
    const ctrl = controlsList.find((c) => c.id === pilot.controlId);
    const safeCountry = pilot.country || "un";

    return `
      <tr>
        <td>${pilot.name}</td>
        <td><span class="fi fi-${safeCountry} fis"></span> (${safeCountry.toUpperCase()})</td>
        <td class="team-ext" style="display: ${
            isTeamManagementActive ? "" : "none"
        }">
          ${team ? team.name : "---"}
        </td>
        <td>${ship ? ship.model : "No ship"}</td>
        <td>${ctrl ? ctrl.type : "Unknown"}</td>
        <td>
          <button onclick="startEditPilot(${pilot.id})">Edit</button>
          <button onclick="deletePilot(${pilot.id})">Delete</button>
        </td>
      </tr>`;
}

// Create an edit row for a pilot
function createPilotEditRow(pilot) {
    let teamOptions = teams
        .map(
            (t) =>
                `<option value="${t.id}" ${
                    t.id === pilot.teamId ? "selected" : ""
                }>${t.name}</option>`,
        )
        .join("");

    let shipOptions = ships
        .map(
            (s) =>
                `<option value="${s.id}" ${
                    s.id === pilot.shipId ? "selected" : ""
                }>${s.model}</option>`,
        )
        .join("");

    let controlOptions = controlsList
        .map(
            (c) =>
                `<option value="${c.id}" ${
                    c.id === pilot.controlId ? "selected" : ""
                }>${c.type}</option>`,
        )
        .join("");

    const safeCountry = pilot.country || "un";

    return `
    <tr>
      <td><input type="text" id="edit-pilot-name" value="${pilot.name}"></td>
      <td><input type="text" id="edit-pilot-country" value="${safeCountry}" maxlength="2" style="width: 40px"></td>
      <td class="team-ext" style="display: ${
          isTeamManagementActive ? "" : "none"
      }">
        <select id="edit-pilot-team">${teamOptions}</select>
      </td>
      <td><select id="edit-pilot-ship">${shipOptions}</select></td>
      <td><select id="edit-pilot-controls">${controlOptions}</select></td>
      <td>
        <button onclick="saveEditPilot(${pilot.id})">Save</button>
        <button onclick="cancelEditPilot()">Cancel</button>
      </td>
    </tr>`;
}

// Delete a pilot
function deletePilot(idToDelete) {
    const pilotToDelete = pilots.find((p) => p.id === idToDelete);
    if (
        pilotToDelete &&
        confirm(
            `Are you sure you want to delete the pilot ${pilotToDelete.name}?`,
        )
    ) {
        pilots = pilots.filter((p) => p.id !== idToDelete);
        displayPilots();
        saveToStorage();
    }
}

// Start editing a pilot
function startEditPilot(id) {
    editingPilotId = id;
    displayPilots();
}

// Cancel editing a pilot
function cancelEditPilot() {
    editingPilotId = null;
    displayPilots();
}

// Save changes made to an edited pilot
function saveEditPilot(id) {
    const pilot = pilots.find((p) => p.id === id);
    const name = document.getElementById("edit-pilot-name").value.trim();
    const country = document
        .getElementById("edit-pilot-country")
        .value.trim()
        .toLowerCase();
    const teamId = document.getElementById("edit-pilot-team").value;
    const shipId = document.getElementById("edit-pilot-ship").value;
    const controlId = document.getElementById("edit-pilot-controls").value;

    if (!name || (isTeamManagementActive && !teamId) || !shipId || !controlId) {
        alert("Please fill in all fields");
        return;
    }

    pilot.name = name;
    pilot.country = country || "un";
    pilot.teamId = isTeamManagementActive ? parseInt(teamId) : pilot.teamId;
    pilot.shipId = parseInt(shipId);
    pilot.controlId = parseInt(controlId);

    editingPilotId = null;
    displayPilots();
    saveToStorage();
}

// Clear the form fields
function clearPilotForm() {
    document.getElementById("pilot-name").value = "";
    document.getElementById("pilot-country").value = "";
    document.getElementById("pilot-team").value = "";
    document.getElementById("pilot-ship").value = "";
    document.getElementById("pilot-controls").value = "";
}

// Event listener to update dropdowns when the DOM content is loaded
document.addEventListener("DOMContentLoaded", () => {
    updateTeamDropdown();
    updateShipDropdown();
    updateControlDropdown();
});
