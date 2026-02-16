let teams = [];
let editingTeamId = null;

function addTeam() {
  const name = document.getElementById("name").value.trim();
  const acronym = document.getElementById("acronym").value.trim();

  if (!name || !acronym) {
    alert("Please fill in all fields");
    return;
  }

  const newTeam = {
    id: Date.now(),
    name: name,
    acronym: acronym,
    color: document.getElementById("color").value,
  };

  teams.push(newTeam);
  console.table(teams);
  displayTeams();
  clearForm();
  updateTeamDropdown();
  saveToStorage();
}

function clearForm() {
  document.getElementById("name").value = "";
  document.getElementById("acronym").value = "";
}

function displayTeams() {
  const tableBody = document.getElementById("team-list");
  tableBody.innerHTML = "";

  teams.forEach((team) => {
    const row =
      team.id === editingTeamId ? createEditRow(team) : createDisplayRow(team);
    tableBody.insertAdjacentHTML("beforeend", row);
  });
}

function createEditRow(team) {
  return `
    <tr>
      <td><input type="text" id="edit-name" value="${team.name}"></td>
      <td><input type="text" id="edit-acronym" value="${team.acronym}" maxlength="4"></td>
      <td><input type="color" id="edit-color" value="${team.color}"></td>
      <td>
        <button onclick="saveEdit(${team.id})">Save</button>
        <button onclick="cancelEdit()">Cancel</button>
      </td>
    </tr>`;
}

function createDisplayRow(team) {
  return `
    <tr>
      <td>${team.name}</td>
      <td>${team.acronym}</td>
      <td style="background-color: ${team.color}"></td>
      <td>
        <button onclick="startEdit(${team.id})">Edit</button>
        <button onclick="deleteTeam(${team.id})">Delete</button>
      </td>
    </tr>`;
}

function deleteTeam(idToDelete) {
  const teamToDelete = teams.find((t) => t.id === idToDelete);

  if (teamToDelete) {
    if (
      confirm(`Are you sure you want to delete the team ${teamToDelete.name} ?`)
    ) {
      console.log(`Deleting team: ${teamToDelete.name} (ID: ${idToDelete})`);
      teams = teams.filter((t) => t.id !== idToDelete);

      displayTeams();
      if (typeof updateTeamDropdown === "function") updateTeamDropdown();
      if (typeof displayPilots === "function") displayPilots();
      saveToStorage();
    }
  }
}

function startEdit(id) {
  editingTeamId = id;
  displayTeams();
}

function cancelEdit() {
  editingTeamId = null;
  displayTeams();
}

function saveEdit(id) {
  const team = teams.find((t) => t.id === id);

  const name = document.getElementById("edit-name").value.trim();
  const acronym = document.getElementById("edit-acronym").value.trim();

  if (!name || !acronym) {
    alert("Please fill in all fields");
    return;
  }

  team.name = name;
  team.acronym = acronym;
  team.color = document.getElementById("edit-color").value;

  editingTeamId = null;
  console.log("Team updated!");
  console.table(teams);
  displayTeams();
  updateTeamDropdown();

  if (typeof displayPilots === "function") displayPilots();
  saveToStorage();
}