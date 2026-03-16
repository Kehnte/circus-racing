// ships.js

// Master list of registered vehicles
let vehicles = [];
// ID of the vehicle row currently open for inline editing (null = none)
let editingVehicleId = null;

// Read the add-vehicle form, validate it and push a new vehicle into the vehicles array
function addVehicle() {
    const model = document.getElementById("ship-model").value?.trim();
    const img = document.getElementById("ship-img").value?.trim();
    const category = document.getElementById("ship-category").value?.trim() || "ship";

    if (!model) {
        alert("Please fill in the model");
        return;
    }

    const newVehicle = {
        id: Date.now(),
        model: model,
        img: img || "https://placehold.co/40x40/png",
        category: category,
    };

    vehicles.push(newVehicle);
    displayVehicles();
    clearVehicleForm();
    updateVehicleDropdown();
    saveToStorage();
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
    return `
    <tr>
      <td><img src="${vehicle.img}"></td>
      <td>${vehicle.model}</td>
      <td><md-icon title="${vehicle.category || 'ship'}">${icon}</md-icon></td>
      <td>
        <div class="action-buttons">
          <md-icon-button onclick="startEditVehicle(${vehicle.id})" title="Edit"><md-icon>edit</md-icon></md-icon-button>
          <md-icon-button onclick="deleteVehicle(${vehicle.id})" title="Delete" style="--md-icon-button-icon-color: var(--md-sys-color-error);"><md-icon>delete</md-icon></md-icon-button>
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
      <td><md-outlined-text-field id="edit-ship-img" value="${vehicle.img}" style="width:100%;"></md-outlined-text-field></td>
      <td><md-outlined-text-field id="edit-ship-model" value="${vehicle.model}" style="width:100%;"></md-outlined-text-field></td>
      <td><md-outlined-select id="edit-ship-category" style="width:100%;">${catOptions}</md-outlined-select></td>
      <td>
        <div class="action-buttons">
          <md-icon-button onclick="saveEditVehicle(${vehicle.id})" title="Save"><md-icon>check</md-icon></md-icon-button>
          <md-icon-button onclick="cancelEditVehicle()" title="Cancel"><md-icon>close</md-icon></md-icon-button>
        </div>
      </td>
    </tr>`;
}

// Remove a vehicle by ID and refresh all dependent UI
function deleteVehicle(idToDelete) {
    const vehicleToDelete = vehicles.find((v) => v.id === idToDelete);
    if (vehicleToDelete) {
        vehicles = vehicles.filter((v) => v.id !== idToDelete);
        displayVehicles();
        updateVehicleDropdown();
        if (typeof displayPilots === "function") displayPilots();
        saveToStorage();
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

function saveEditVehicle(id) {
    const vehicle = vehicles.find((v) => v.id === id);
    const model = document.getElementById("edit-ship-model").value?.trim();

    if (!model) {
        alert("Please fill in the Model");
        return;
    }

    vehicle.model = model;
    vehicle.img = document.getElementById("edit-ship-img").value?.trim();
    vehicle.category = document.getElementById("edit-ship-category").value || "ship";

    editingVehicleId = null;
    displayVehicles();
    updateVehicleDropdown();
    if (typeof displayPilots === "function") displayPilots();
    saveToStorage();
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
function resetShips() { resetVehicles(); }

document.addEventListener("DOMContentLoaded", () => {
    displayVehicles();
    updateVehicleDropdown();
});