let pilots = [];
let editingPilotId = null;

function updateTeamDropdown() {
  const select = document.getElementById("pilot-team");
  if (!select) return;

  select.innerHTML = '<option value="">Select a team</option>';
  teams.forEach((team) => {
    select.innerHTML += `<option value="${team.id}">${team.name}</option>`;
  });
}

function updateShipDropdown() {
  const select = document.getElementById("pilot-ship");
  if (!select) return;

  select.innerHTML = '<option value="">Select a ship</option>';
  ships.forEach((ship) => {
    select.innerHTML += `<option value="${ship.id}">${ship.brand} - ${ship.model}</option>`;
  });
}

function updateControlDropdown() {
  const select = document.getElementById("pilot-controls");
  if (!select) return;

  select.innerHTML = '<option value="">Select controls</option>';
  controlsList.forEach((ctrl) => {
    select.innerHTML += `<option value="${ctrl.id}">${ctrl.type}</option>`;
  });
}

function addPilot() {
  const name = document.getElementById("pilot-name").value.trim();
  const teamId = document.getElementById("pilot-team").value;
  const shipId = document.getElementById("pilot-ship").value;
  const controlId = document.getElementById("pilot-controls").value;
  const avatar = document.getElementById("pilot-avatar").value.trim();

  const isTeamValid = isTeamManagementActive ? teamId : true;

  if (!name || !isTeamValid || !shipId || !controlId) {
    alert("Please fill in all required fields");
    return;
  }

  const newPilot = {
    id: Date.now(),
    name: name,
    avatar: avatar || "https://via.placeholder.com/40",
    teamId: isTeamManagementActive ? parseInt(teamId) : null,
    shipId: parseInt(shipId),
    controlId: parseInt(controlId),
  };

  pilots.push(newPilot);
  displayPilots();
  clearPilotForm();
  saveToStorage();
}

function displayPilots() {
  const tableBody = document.getElementById("pilot-list");
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

function createPilotDisplayRow(pilot) {
  const team = teams.find((t) => t.id === pilot.teamId);
  const ship = ships.find((s) => s.id === pilot.shipId);
  const ctrl = controlsList.find((c) => c.id === pilot.controlId);

  return `
      <tr>
        <td><img src="${pilot.avatar}" width="40" height="40"></td>
        <td>${pilot.name}</td>
        <td class="team-ext" style="display: ${
          isTeamManagementActive ? "" : "none"
        }">
          ${team ? team.name : "---"}
        </td>
        <td>${ship ? `${ship.brand} ${ship.model}` : "No ship"}</td>
        <td>${ctrl ? ctrl.type : "Unknown"}</td>
        <td>
          <button onclick="startEditPilot(${pilot.id})">Edit</button>
          <button onclick="deletePilot(${pilot.id})">Delete</button>
        </td>
      </tr>`;
}

function createPilotEditRow(pilot) {
  let teamOptions = teams
    .map(
      (t) =>
        `<option value="${t.id}" ${t.id === pilot.teamId ? "selected" : ""}>${
          t.name
        }</option>`
    )
    .join("");

  let shipOptions = ships
    .map(
      (s) =>
        `<option value="${s.id}" ${s.id === pilot.shipId ? "selected" : ""}>${
          s.brand
        } ${s.model}</option>`
    )
    .join("");

  let controlOptions = controlsList
    .map(
      (c) =>
        `<option value="${c.id}" ${
          c.id === pilot.controlId ? "selected" : ""
        }>${c.type}</option>`
    )
    .join("");

  return `
    <tr>
      <td><input type="url" id="edit-pilot-avatar" value="${pilot.avatar}"></td>
      <td><input type="text" id="edit-pilot-name" value="${pilot.name}"></td>
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

function deletePilot(idToDelete) {
  const pilotToDelete = pilots.find((p) => p.id === idToDelete);
  if (
    pilotToDelete &&
    confirm(`Are you sure you want to delete the pilot ${pilotToDelete.name}?`)
  ) {
    pilots = pilots.filter((p) => p.id !== idToDelete);
    displayPilots();
    saveToStorage();
  }
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
  const name = document.getElementById("edit-pilot-name").value.trim();
  const teamId = document.getElementById("edit-pilot-team").value;
  const shipId = document.getElementById("edit-pilot-ship").value;
  const controlId = document.getElementById("edit-pilot-controls").value;

  if (!name || (isTeamManagementActive && !teamId) || !shipId || !controlId) {
    alert("Please fill in all fields");
    return;
  }

  pilot.name = name;
  pilot.avatar = document.getElementById("edit-pilot-avatar").value.trim();
  pilot.teamId = isTeamManagementActive ? parseInt(teamId) : pilot.teamId;
  pilot.shipId = parseInt(shipId);
  pilot.controlId = parseInt(controlId);

  editingPilotId = null;
  displayPilots();
  saveToStorage();
}

function clearPilotForm() {
  document.getElementById("pilot-name").value = "";
  document.getElementById("pilot-avatar").value = "";
  document.getElementById("pilot-team").value = "";
  document.getElementById("pilot-ship").value = "";
  document.getElementById("pilot-controls").value = "";
}

document.addEventListener("DOMContentLoaded", () => {
  updateTeamDropdown();
  updateShipDropdown();
  updateControlDropdown();
});