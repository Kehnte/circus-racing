// teams.js

// Master list of registered teams (populated from API)
let teams = [];
// ID of the team row currently open for inline editing (null = none)
let editingTeamId = null;

/** Load teams from API and render the table */
async function initTeams() {
    try {
        teams = await apiGet("/teams");
    } catch {
        teams = [];
    }
    displayTeams();
    updateTeamDropdown();
}

/** Read the add-team form, POST to API, refresh table */
async function addTeam() {
    const name    = document.getElementById("name").value?.trim();
    const acronym = document.getElementById("acronym").value?.trim();
    const color   = document.getElementById("color").value;

    if (!name || !acronym) {
        alert("Please fill in all fields");
        return;
    }

    try {
        const created = await apiPost("/teams", { name, acronym, color });
        teams.push(created);
        displayTeams();
        clearForm();
        updateTeamDropdown();
        if (typeof displayPilots === "function") displayPilots();
    } catch (e) {
        alert(e.message || "Failed to create team");
    }
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

// Build the HTML for a color swatch palette with a hidden input holding the selected value
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
          <md-icon-button onclick="saveEdit('${team.id}')" title="Save"><md-icon>check</md-icon></md-icon-button>
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
          <md-icon-button onclick="startEdit('${team.id}')" title="Edit"><md-icon>edit</md-icon></md-icon-button>
          <md-icon-button onclick="deleteTeam('${team.id}')" title="Delete" style="--md-icon-button-icon-color: var(--md-sys-color-error);"><md-icon>delete</md-icon></md-icon-button>
        </div>
      </td>
    </tr>`;
}

/** Remove a team via API, then refresh UI */
async function deleteTeam(id) {
    try {
        await apiDelete(`/teams/${id}`);
        teams = teams.filter((t) => t.id !== id);
        displayTeams();
        if (typeof updateTeamDropdown === "function") updateTeamDropdown();
        if (typeof displayPilots === "function") displayPilots();
    } catch (e) {
        alert(e.message || "Failed to delete team");
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

/** Validate the inline edit form and PATCH the team via API */
async function saveEdit(id) {
    const name    = document.getElementById("edit-name")?.value?.trim();
    const acronym = document.getElementById("edit-acronym")?.value?.trim();
    const color   = document.getElementById("edit-color-value")?.value;

    if (!name || !acronym) {
        alert("Please fill in all fields");
        return;
    }

    try {
        const updated = await apiPatch(`/teams/${id}`, { name, acronym, color });
        const idx = teams.findIndex((t) => t.id === id);
        if (idx !== -1) teams[idx] = updated;
        editingTeamId = null;
        displayTeams();
        updateTeamDropdown();
        if (typeof displayPilots === "function") displayPilots();
    } catch (e) {
        alert(e.message || "Failed to update team");
    }
}

// Rebuild the team dropdown in the pilot form
function updateTeamDropdown() {
    const select = document.getElementById("pilot-team");
    if (!select) return;
    select.innerHTML = '<md-select-option value=""><div slot="headline">Select a team</div></md-select-option>';
    teams.forEach((team) => {
        select.innerHTML += `<md-select-option value="${team.id}"><div slot="headline">${team.name}</div></md-select-option>`;
    });
}

// Legacy reset — kept for database.js compatibility
function resetTeams() {
    if (typeof initTeams === "function") initTeams();
}
