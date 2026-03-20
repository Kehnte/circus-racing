// controls.js

let controlsList      = [];
let editingControlId  = null;

// load controls from API and render
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

    if (!type) { console.warn("Please fill in the control type"); return; }

    try {
        const created = await apiPost("/controls", { type, img: img || undefined });
        controlsList.push(created);
        displayControls();
        document.getElementById("control-type").value = "";
        document.getElementById("control-img").value  = "";
        updateControlDropdown();
        if (typeof displayPilots === "function") displayPilots();
        broadcastChange("controls");
    } catch (e) {
        console.warn(e.message || "Failed to create control type");
    }
}

// re-render the controls table
function displayControls() {
    const tableBody = document.getElementById("controls-list");
    if (!tableBody) return;
    tableBody.innerHTML = "";
    controlsList.forEach((ctrl) => {
        const row = ctrl.id === editingControlId ? createControlEditRow(ctrl) : createControlDisplayRow(ctrl);
        tableBody.insertAdjacentHTML("beforeend", row);
    });
}

// build the display row HTML for a control type
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

// build the edit row HTML for a control type
function createControlEditRow(ctrl) {
    return `
    <tr>
      <td><md-outlined-text-field id="edit-control-img" value="${ctrl.img || ""}" style="width:100%;"></md-outlined-text-field></td>
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
    try {
        await apiDelete(`/controls/${id}`);
        controlsList = controlsList.filter((c) => c.id !== id);
        displayControls();
        updateControlDropdown();
        if (typeof displayPilots === "function") displayPilots();
        broadcastChange("controls");
    } catch (e) {
        console.warn(e.message || "Failed to delete control type");
    }
}

function startEditControl(id) { editingControlId = id;   displayControls(); }
function cancelEditControl()   { editingControlId = null; displayControls(); }

// PATCH control type via API
async function saveEditControl(id) {
    const type = document.getElementById("edit-control-type")?.value?.trim();
    const img  = document.getElementById("edit-control-img")?.value?.trim();

    if (!type) { console.warn("Please fill in the control type"); return; }

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
        console.warn(e.message || "Failed to update control type");
    }
}

// rebuild the controls dropdown in the pilot add form
function updateControlDropdown() {
    const select = document.getElementById("pilot-controls");
    if (!select) return;
    let html = '<md-select-option value=""><div slot="headline">Select controls</div></md-select-option>';
    controlsList.forEach((ctrl) => {
        html += `<md-select-option value="${ctrl.id}"><div slot="headline">${ctrl.type}</div></md-select-option>`;
    });
    select.innerHTML = html;
}

// reload from API
function resetControls() { initControls(); }
