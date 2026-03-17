// ships.js
// the API uses "type" for vehicle category; mapped to "category" internally

let vehicles        = [];
let editingVehicleId = null;

// map API vehicle (type → category) to internal format
function vehicleFromApi(v) {
    return { ...v, category: v.type ?? "ship" };
}

// load vehicles from API and render
async function initVehicles() {
    try {
        vehicles = (await apiGet("/vehicles")).map(vehicleFromApi);
    } catch {
        vehicles = [];
    }
    displayVehicles();
    updateVehicleDropdown();
}

// POST new vehicle to API, refresh table
async function addVehicle() {
    const model    = document.getElementById("ship-model").value?.trim();
    const img      = document.getElementById("ship-img").value?.trim();
    const category = document.getElementById("ship-category").value?.trim() || "ship";

    if (!model) { alert("Please fill in the model"); return; }

    try {
        const created = await apiPost("/vehicles", { model, type: category, img: img || undefined });
        vehicles.push(vehicleFromApi(created));
        displayVehicles();
        clearVehicleForm();
        updateVehicleDropdown();
        if (typeof displayPilots === "function") displayPilots();
        broadcastChange("vehicles");
    } catch (e) {
        alert(e.message || "Failed to create vehicle");
    }
}

// re-render the vehicles table
function displayVehicles() {
    const tableBody = document.getElementById("ships-list");
    if (!tableBody) return;
    tableBody.innerHTML = "";
    vehicles.forEach((vehicle) => {
        const row = vehicle.id === editingVehicleId ? createVehicleEditRow(vehicle) : createVehicleDisplayRow(vehicle);
        tableBody.insertAdjacentHTML("beforeend", row);
    });
}

// build the display row HTML for a vehicle
function createVehicleDisplayRow(vehicle) {
    const img = vehicle.img || "https://placehold.co/40x40/png";
    return `
    <tr>
      <td><img src="${img}"></td>
      <td>${vehicle.model}</td>
      <td>${vehicle.category || "ship"}</td>
      <td>
        <div class="action-buttons">
          <md-icon-button onclick="startEditVehicle('${vehicle.id}')" title="Edit"><md-icon>edit</md-icon></md-icon-button>
          <md-icon-button onclick="deleteVehicle('${vehicle.id}')" title="Delete" style="--md-icon-button-icon-color: var(--md-sys-color-error);"><md-icon>delete</md-icon></md-icon-button>
        </div>
      </td>
    </tr>`;
}

// build the edit row HTML for a vehicle
function createVehicleEditRow(vehicle) {
    const cats = ["ship", "rover", "bike"];
    const catOptions = cats.map((c) => `<md-select-option value="${c}" ${vehicle.category === c ? "selected" : ""}><div slot="headline">${c}</div></md-select-option>`).join("");
    return `
    <tr>
      <td><md-outlined-text-field id="edit-ship-img" value="${vehicle.img || ""}" style="width:100%;"></md-outlined-text-field></td>
      <td><md-outlined-text-field id="edit-ship-model" value="${vehicle.model}" style="width:100%;"></md-outlined-text-field></td>
      <td><md-outlined-select id="edit-ship-category" style="width:100%;">${catOptions}</md-outlined-select></td>
      <td>
        <div class="action-buttons">
          <md-icon-button onclick="saveEditVehicle('${vehicle.id}')" title="Save"><md-icon>check</md-icon></md-icon-button>
          <md-icon-button onclick="cancelEditVehicle()" title="Cancel"><md-icon>close</md-icon></md-icon-button>
        </div>
      </td>
    </tr>`;
}

// DELETE vehicle via API
async function deleteVehicle(id) {
    try {
        await apiDelete(`/vehicles/${id}`);
        vehicles = vehicles.filter((v) => v.id !== id);
        displayVehicles();
        updateVehicleDropdown();
        if (typeof displayPilots === "function") displayPilots();
        broadcastChange("vehicles");
    } catch (e) {
        alert(e.message || "Failed to delete vehicle");
    }
}

function startEditVehicle(id) { editingVehicleId = id;   displayVehicles(); }
function cancelEditVehicle()   { editingVehicleId = null; displayVehicles(); }

// PATCH vehicle via API
async function saveEditVehicle(id) {
    const model    = document.getElementById("edit-ship-model")?.value?.trim();
    const img      = document.getElementById("edit-ship-img")?.value?.trim();
    const category = document.getElementById("edit-ship-category")?.value || "ship";

    if (!model) { alert("Please fill in the Model"); return; }

    try {
        const updated = await apiPatch(`/vehicles/${id}`, { model, type: category, img: img || undefined });
        const idx = vehicles.findIndex((v) => v.id === id);
        if (idx !== -1) vehicles[idx] = vehicleFromApi(updated);
        editingVehicleId = null;
        displayVehicles();
        updateVehicleDropdown();
        if (typeof displayPilots === "function") displayPilots();
        broadcastChange("vehicles");
    } catch (e) {
        alert(e.message || "Failed to update vehicle");
    }
}

// rebuild the vehicle dropdown in the pilot add form
function updateVehicleDropdown() {
    const select = document.getElementById("pilot-ship");
    if (!select) return;
    let html = '<md-select-option value=""><div slot="headline">Select a vehicle</div></md-select-option>';
    vehicles.forEach((v) => {
        html += `<md-select-option value="${v.id}"><div slot="headline">[${v.category || "ship"}] ${v.model}</div></md-select-option>`;
    });
    select.innerHTML = html;
}

// clear the add-vehicle form fields
function clearVehicleForm() {
    document.getElementById("ship-model").value    = "";
    document.getElementById("ship-img").value      = "";
    document.getElementById("ship-category").value = "ship";
}

// backward-compat aliases
function addShip()            { addVehicle(); }
function displayShips()       { displayVehicles(); }
function updateShipDropdown() { updateVehicleDropdown(); }
function resetShips()         { initVehicles(); }
function resetVehicles()      { initVehicles(); }
