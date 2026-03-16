// controls.js

// Master list of registered control types (populated from API)
let controlsList = [];
// ID of the control row currently open for inline editing
let editingControlId = null;

// Load controls from API and render
async function initControls() {
    try {
        controlsList = await apiGet("/controls");
    } catch {
        controlsList = [];
    }
    displayControls();
    updateControlDropdown();
}

// POST new control type to API, refresh table
async function addControl() {
    const type = document.getElementById("control-type").value?.trim();
    const img  = document.getElementById("control-img").value?.trim();

    if (!type) { alert("Please fill in the control type"); return; }

    try {
        const created = await apiPost("/controls", { type, img: img || undefined });
        controlsList.push(created);
        displayControls();
        document.getElementById("control-type").value = "";
        document.getElementById("control-img").value = "";
        updateControlDropdown();
        if (typeof displayPilots === "function") displayPilots();
        broadcastChange("controls");
    } catch (e) {
        alert(e.message || "Failed to create control type");
    }
}

// Re-render the controls table
function displayControls() {
    const tableBody = document.getElementById("controls-list");
    if (!tableBody) return;
    tableBody.innerHTML = "";
    controlsList.forEach((ctrl) => {
        const row = ctrl.id === editingControlId ? createControlEditRow(ctrl) : createControlDisplayRow(ctrl);
        tableBody.insertAdjacentHTML("beforeend", row);
    });
}

function createControlDisplayRow(ctrl) {
    const img = ctrl.img || "https://placehold.co/40x40/png";
    return `
    <tr>
      <td><img src="${img}"></td>
      <td>${ctrl.type}</td>
      <td>
        <div class="action-buttons">
          <md-icon-button onclick="startEditControl('${ctrl.id}')" title="Edit"><md-icon>edit</md-icon></md-icon-button>
          <md-icon-button onclick="deleteControl('${ctrl.id}')" title="Delete" style="--md-icon-button-icon-color: var(--md-sys-color-error);"><md-icon>delete</md-icon></md-icon-button>
        </div>
      </td>
    </tr>`;
}

function createControlEditRow(ctrl) {
    return `
    <tr>
      <td><md-outlined-text-field id="edit-control-img" value="${ctrl.img || ''}" style="width:100%;"></md-outlined-text-field></td>
      <td><md-outlined-text-field id="edit-control-type" value="${ctrl.type}" style="width:100%;"></md-outlined-text-field></td>
      <td>
        <div class="action-buttons">
          <md-icon-button onclick="saveEditControl('${ctrl.id}')" title="Save"><md-icon>check</md-icon></md-icon-button>
          <md-icon-button onclick="cancelEditControl()" title="Cancel"><md-icon>close</md-icon></md-icon-button>
        </div>
      </td>
    </tr>`;
}

// DELETE control type via API
async function deleteControl(id) {
    if (!confirm("Delete this control type?")) return;
    try {
        await apiDelete(`/controls/${id}`);
        controlsList = controlsList.filter((c) => c.id !== id);
        displayControls();
        updateControlDropdown();
        if (typeof displayPilots === "function") displayPilots();
        broadcastChange("controls");
    } catch (e) {
        alert(e.message || "Failed to delete control type");
    }
}

function startEditControl(id) { editingControlId = id; displayControls(); }
function cancelEditControl()   { editingControlId = null; displayControls(); }

// PATCH control type via API
async function saveEditControl(id) {
    const type = document.getElementById("edit-control-type")?.value?.trim();
    const img  = document.getElementById("edit-control-img")?.value?.trim();

    if (!type) { alert("Please fill in the control type"); return; }

    try {
        const updated = await apiPatch(`/controls/${id}`, { type, img: img || undefined });
        const idx = controlsList.findIndex((c) => c.id === id);
        if (idx !== -1) controlsList[idx] = updated;
        editingControlId = null;
        displayControls();
        updateControlDropdown();
        if (typeof displayPilots === "function") displayPilots();
        broadcastChange("controls");
    } catch (e) {
        alert(e.message || "Failed to update control type");
    }
}

// Rebuild the controls dropdown in the pilot add form
function updateControlDropdown() {
    const select = document.getElementById("pilot-controls");
    if (!select) return;
    select.innerHTML = '<md-select-option value=""><div slot="headline">Select controls</div></md-select-option>';
    controlsList.forEach((ctrl) => {
        select.innerHTML += `<md-select-option value="${ctrl.id}"><div slot="headline">${ctrl.type}</div></md-select-option>`;
    });
}

// Reload from API (replaces localStorage reset)
function resetControls() { initControls(); }
