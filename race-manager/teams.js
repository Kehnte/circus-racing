// teams.js

// Master list of registered teams
let teams = [];
// ID of the team row currently open for inline editing (null = none)
let editingTeamId = null;

// Read the add-team form, validate it and push a new team into the teams array
function addTeam() {
    const name = document.getElementById("name").value?.trim();
    const acronym = document.getElementById("acronym").value?.trim();

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
    displayTeams();
    clearForm();
    updateTeamDropdown();
    saveToStorage();
}

// Reset the add-team text fields (color swatch keeps its current selection)
function clearForm() {
    document.getElementById("name").value = "";
    document.getElementById("acronym").value = "";
}

// Re-render the teams table and re-attach color swatch click handlers
function displayTeams() {
    const tableBody = document.getElementById("team-list");
    tableBody.innerHTML = "";

    teams.forEach((team) => {
        const row = team.id === editingTeamId ? createEditRow(team) : createDisplayRow(team);
        tableBody.insertAdjacentHTML("beforeend", row);
    });

    // Re-attach swatch click listeners after each re-render
    document.querySelectorAll(".color-swatch[data-prefix]").forEach((swatch) => {
        swatch.addEventListener("click", () => {
            const prefix = swatch.dataset.prefix;
            // Deselect all swatches for this prefix group, then select the clicked one
            document.querySelectorAll(`.color-swatch[data-prefix="${prefix}"]`).forEach((s) => s.classList.remove("selected"));
            swatch.classList.add("selected");
            const color = swatch.dataset.color;
            document.getElementById(`${prefix}-color-value`).value = color;
            document.getElementById(`${prefix}-dot`).style.backgroundColor = color;
            document.getElementById(`${prefix}-hex`).textContent = color;
        });
    });
}

// Material Design 3 color palette used for team color selection
const M3_COLORS = [
    "#E57373","#F06292","#BA68C8","#9575CD","#7986CB",
    "#64B5F6","#4FC3F7","#4DD0E1","#4DB6AC","#81C784",
    "#AED581","#DCE775","#FFF176","#FFD54F","#FFB74D",
    "#FF8A65","#A1887F","#E0E0E0","#90A4AE"
];

// Build the HTML for a color swatch palette with a hidden input holding the selected value idPrefix is used to namespace element IDs so multiple palettes can coexist on the page
function buildSwatchesHTML(selectedColor, idPrefix) {
    const swatches = M3_COLORS.map((c) => {
        const sel = c.toLowerCase() === selectedColor.toLowerCase() ? "selected" : "";
        return `<button type="button" class="color-swatch ${sel}" style="background-color:${c}" data-color="${c}" data-prefix="${idPrefix}" title="${c}"></button>`;
    }).join("");

    return `
        <div class="color-palette-wrapper">
            <div class="color-swatches" id="${idPrefix}-swatches">${swatches}</div>
            <div class="color-selected-preview">
                <span class="color-selected-dot" id="${idPrefix}-dot" style="background-color:${selectedColor}"></span>
                <span class="color-selected-hex" id="${idPrefix}-hex">${selectedColor}</span>
            </div>
            <input type="hidden" id="${idPrefix}-color-value" value="${selectedColor}" />
        </div>`;
}

// Build the inline edit row HTML for a team (text fields + color palette)
function createEditRow(team) {
    return `
    <tr>
      <td><md-outlined-text-field id="edit-name" value="${team.name}" style="width:100%;"></md-outlined-text-field></td>
      <td><md-outlined-text-field id="edit-acronym" value="${team.acronym}" maxlength="4" style="width:100%;"></md-outlined-text-field></td>
      <td>${buildSwatchesHTML(team.color, "edit")}</td>
      <td>
        <div class="action-buttons">
          <md-icon-button onclick="saveEdit(${team.id})" title="Save"><md-icon>check</md-icon></md-icon-button>
          <md-icon-button onclick="cancelEdit()" title="Cancel"><md-icon>close</md-icon></md-icon-button>
        </div>
      </td>
    </tr>`;
}

// Build the read-only display row HTML for a team
function createDisplayRow(team) {
    return `
    <tr>
      <td>${team.name}</td>
      <td>${team.acronym}</td>
      <td><span class="team-color-dot" style="background-color: ${team.color}; width: 20px; height: 20px; border-radius: 4px; display: inline-block;"></span> ${team.color}</td>
      <td>
        <div class="action-buttons">
          <md-icon-button onclick="startEdit(${team.id})" title="Edit"><md-icon>edit</md-icon></md-icon-button>
          <md-icon-button onclick="deleteTeam(${team.id})" title="Delete" style="--md-icon-button-icon-color: var(--md-sys-color-error);"><md-icon>delete</md-icon></md-icon-button>
        </div>
      </td>
    </tr>`;
}

// Remove a team by ID, then refresh all dependent UI (team dropdown, pilots table)
function deleteTeam(idToDelete) {
    const teamToDelete = teams.find((t) => t.id === idToDelete);
    if (teamToDelete) {
        teams = teams.filter((t) => t.id !== idToDelete);
        displayTeams();
        if (typeof updateTeamDropdown === "function") updateTeamDropdown();
        if (typeof displayPilots === "function") displayPilots();
        saveToStorage();
    }
}

// Open a team row for inline editing
function startEdit(id) {
    editingTeamId = id;
    displayTeams();
}

// Discard in-progress edits and revert the row back to display mode
function cancelEdit() {
    editingTeamId = null;
    displayTeams();
}

// Validate the inline edit form and persist changes to the team object
function saveEdit(id) {
    const team = teams.find((t) => t.id === id);
    const name = document.getElementById("edit-name").value?.trim();
    const acronym = document.getElementById("edit-acronym").value?.trim();

    if (!name || !acronym) {
        alert("Please fill in all fields");
        return;
    }

    team.name = name;
    team.acronym = acronym;
    // Fall back to the existing color if the edit palette hidden input is missing
    team.color = document.getElementById("edit-color-value")?.value || team.color;

    editingTeamId = null;
    displayTeams();
    updateTeamDropdown();
    if (typeof displayPilots === "function") displayPilots();
    saveToStorage();
}

document.addEventListener("DOMContentLoaded", () => {
});