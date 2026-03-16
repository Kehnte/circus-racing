// ships.js

// Master list of registered vehicles (populated from API)
// Note: the API uses "type" for the vehicle category field; we map it to "category" internally
// so that the rest of the dashboard (pilots.js, race.js) remains unchanged.
let vehicles = [];
// ID of the vehicle row currently open for inline editing (null = none)
let editingVehicleId = null;

/** Map an API vehicle object (type → category) to the internal format */
function vehicleFromApi(v) {
    return { ...v, category: v.type ?? "ship" };
}

/** Map internal vehicle (category → type) for API POST/PATCH payloads */
function vehicleToApi(v) {
    return { model: v.model, img: v.img || undefined, type: v.category || "ship" };
}

/** Load vehicles from API and render the table */
async function initVehicles() {
    try {
        const raw = await apiGet("/vehicles");
        vehicles = raw.map(vehicleFromApi);
    } catch {
        vehicles = [];
    }
    displayVehicles();
    updateVehicleDropdown();
}

/** Read the add-vehicle form, POST to API, refresh table */
async function addVehicle() {
    const model    = document.getElementById("ship-model").value?.trim();
    const img      = document.getElementById("ship-img").value?.trim();
    const category = document.getElementById("ship-category").value?.trim() || "ship";

    if (!model) {
        alert("Please fill in the model");
        return;
    }

    try {
        const created = await apiPost("/vehicles", { model, img: img || undefined, type: category });
        vehicles.push(vehicleFromApi(created));
        displayVehicles();
        clearVehicleForm();
        updateVehicleDropdown();
        if (typeof displayPilots === "function") displayPilots();
    } catch (e) {
        alert(e.message || "Failed to create vehicle");
    }
}

// Re-render the vehicles table, switching rows between display and edit mode as needed
function displayVehicles() {
    const tableBody = document.getElementById("ships-list");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    vehicles.forEach((vehicle) => {
        const row = vehicle.id === editingVehicleId ? createVehicleEditRow(vehicle) : createVehicleDisplayRow(vehicle);
        tableBody.insertAdjacentHTML("beforeend", row);
    });
}

// Build the read-only display row HTML for a vehicle
function createVehicleDisplayRow(vehicle) {
    const categoryIcons = { ship: "rocket", rover: "directions_car", bike: "two_wheeler" };
    const icon = categoryIcons[vehicle.category] || "rocket";
    const imgSrc = vehicle.img || "https://placehold.co/40x40/png";
    return `
    <tr>
      <td><img src="${imgSrc}"></td>
      <td>${vehicle.model}</td>
      <td><md-icon title="${vehicle.category || 'ship'}">${icon}</md-icon></td>
      <td>
        <div class="action-buttons">
          <md-icon-button onclick="startEditVehicle('${vehicle.id}')" title="Edit"><md-icon>edit</md-icon></md-icon-button>
          <md-icon-button onclick="deleteVehicle('${vehicle.id}')" title="Delete" style="--md-icon-button-icon-color: var(--md-sys-color-error);"><md-icon>delete</md-icon></md-icon-button>
        </div>
      </td>
    </tr>`;
}

// Build the inline edit row HTML for a vehicle
function createVehicleEditRow(vehicle) {
    const cats = ["ship", "rover", "bike"];
    const catOptions = cats.map(c => `<md-select-option value="${c}" ${vehicle.category === c ? "selected" : ""}><div slot="headline">${c}</div></md-select-option>`).join("");
    return `
    <tr>
      <td><md-outlined-text-field id="edit-ship-img" value="${vehicle.img || ''}" style="width:100%;"></md-outlined-text-field></td>
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

/** Remove a vehicle via API and refresh dependent UI */
async function deleteVehicle(id) {
    try {
        await apiDelete(`/vehicles/${id}`);
        vehicles = vehicles.filter((v) => v.id !== id);
        displayVehicles();
        updateVehicleDropdown();
        if (typeof displayPilots === "function") displayPilots();
    } catch (e) {
        alert(e.message || "Failed to delete vehicle");
    }
}

function startEditVehicle(id) {
    editingVehicleId = id;
    displayVehicles();
}

function cancelEditVehicle() {
    editingVehicleId = null;
    displayVehicles();
}

/** PATCH vehicle via API */
async function saveEditVehicle(id) {
    const model    = document.getElementById("edit-ship-model")?.value?.trim();
    const img      = document.getElementById("edit-ship-img")?.value?.trim();
    const category = document.getElementById("edit-ship-category")?.value || "ship";

    if (!model) {
        alert("Please fill in the Model");
        return;
    }

    try {
        const updated = await apiPatch(`/vehicles/${id}`, { model, img: img || undefined, type: category });
        const idx = vehicles.findIndex((v) => v.id === id);
        if (idx !== -1) vehicles[idx] = vehicleFromApi(updated);
        editingVehicleId = null;
        displayVehicles();
        updateVehicleDropdown();
        if (typeof displayPilots === "function") displayPilots();
    } catch (e) {
        alert(e.message || "Failed to update vehicle");
    }
}

// Rebuild the vehicle dropdown options in the pilot form
function updateVehicleDropdown() {
    const select = document.getElementById("pilot-ship");
    if (!select) return;

    select.innerHTML = '<md-select-option value=""><div slot="headline">Select a vehicle</div></md-select-option>';
    vehicles.forEach((vehicle) => {
        select.innerHTML += `<md-select-option value="${vehicle.id}"><div slot="headline">[${vehicle.category || 'ship'}] ${vehicle.model}</div></md-select-option>`;
    });
}

function clearVehicleForm() {
    document.getElementById("ship-model").value = "";
    document.getElementById("ship-img").value = "";
    document.getElementById("ship-category").value = "ship";
}

// Backward compat aliases
function addShip() { addVehicle(); }
function displayShips() { displayVehicles(); }
function updateShipDropdown() { updateVehicleDropdown(); }
function resetShips() { if (typeof initVehicles === "function") initVehicles(); }
function resetVehicles() { if (typeof initVehicles === "function") initVehicles(); }
