// ships.js

// Master list of registered ships
let ships = [];
// ID of the ship row currently open for inline editing (null = none)
let editingShipId = null;

// Read the add-ship form, validate it and push a new ship into the ships array
function addShip() {
    const model = document.getElementById("ship-model").value?.trim();
    const img = document.getElementById("ship-img").value?.trim();

    if (!model) {
        alert("Please fill in the model");
        return;
    }

    const newShip = {
        id: Date.now(),
        model: model,
        img: img || "https://placehold.co/40x40/png",
    };

    ships.push(newShip);
    displayShips();
    clearShipForm();
    updateShipDropdown();
    saveToStorage();
}

// Re-render the ships table, switching rows between display and edit mode as needed
function displayShips() {
    const tableBody = document.getElementById("ships-list");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    ships.forEach((ship) => {
        const row = ship.id === editingShipId ? createShipEditRow(ship) : createShipDisplayRow(ship);
        tableBody.insertAdjacentHTML("beforeend", row);
    });
}

// Build the read-only display row HTML for a ship
function createShipDisplayRow(ship) {
    return `
    <tr>
      <td><img src="${ship.img}"></td>
      <td>${ship.model}</td>
      <td>
        <div class="action-buttons">
          <md-icon-button onclick="startEditShip(${ship.id})" title="Edit"><md-icon>edit</md-icon></md-icon-button>
          <md-icon-button onclick="deleteShip(${ship.id})" title="Delete" style="--md-icon-button-icon-color: var(--md-sys-color-error);"><md-icon>delete</md-icon></md-icon-button>
        </div>
      </td>
    </tr>`;
}

// Build the inline edit row HTML for a ship
function createShipEditRow(ship) {
    return `
    <tr>
      <td><md-outlined-text-field id="edit-ship-img" value="${ship.img}" style="width:100%;"></md-outlined-text-field></td>
      <td><md-outlined-text-field id="edit-ship-model" value="${ship.model}" style="width:100%;"></md-outlined-text-field></td>
      <td>
        <div class="action-buttons">
          <md-icon-button onclick="saveEditShip(${ship.id})" title="Save"><md-icon>check</md-icon></md-icon-button>
          <md-icon-button onclick="cancelEditShip()" title="Cancel"><md-icon>close</md-icon></md-icon-button>
        </div>
      </td>
    </tr>`;
}

// Remove a ship by ID and refresh all dependent UI
function deleteShip(idToDelete) {
    const shipToDelete = ships.find((s) => s.id === idToDelete);
    if (shipToDelete) {
        ships = ships.filter((s) => s.id !== idToDelete);
        displayShips();
        updateShipDropdown();
        if (typeof displayPilots === "function") displayPilots();
        saveToStorage();
    }
}

function startEditShip(id) {
    editingShipId = id;
    displayShips();
}

function cancelEditShip() {
    editingShipId = null;
    displayShips();
}

function saveEditShip(id) {
    const ship = ships.find((s) => s.id === id);
    const model = document.getElementById("edit-ship-model").value?.trim();

    if (!model) {
        alert("Please fill in the Model");
        return;
    }

    ship.model = model;
    ship.img = document.getElementById("edit-ship-img").value?.trim();

    editingShipId = null;
    displayShips();
    updateShipDropdown();
    if (typeof displayPilots === "function") displayPilots();
    saveToStorage();
}

// Rebuild the ship dropdown options in the pilot form
function updateShipDropdown() {
    const select = document.getElementById("pilot-ship");
    if (!select) return;

    select.innerHTML = '<md-select-option value=""><div slot="headline">Select a ship</div></md-select-option>';
    ships.forEach((ship) => {
        select.innerHTML += `<md-select-option value="${ship.id}"><div slot="headline">${ship.model}</div></md-select-option>`;
    });
}

function clearShipForm() {
    document.getElementById("ship-model").value = "";
    document.getElementById("ship-img").value = "";
}

document.addEventListener("DOMContentLoaded", () => {
    displayShips();
    updateShipDropdown();
});
