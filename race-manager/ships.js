//ships.js

let ships = [];
let editingShipId = null;

// Add a new ship to the array, clear the form, update the display, and save changes
function addShip() {
  const brand = document.getElementById("ship-brand").value.trim();
  const model = document.getElementById("ship-model").value.trim();
  const img = document.getElementById("ship-img").value.trim();

  if (!brand || !model) {
    alert("Please fill in brand and model");
    return;
  }

  const newShip = {
    id: Date.now(),
    brand: brand,
    model: model,
    img: img || "https://placehold.co/40x40/png",
  };

  ships.push(newShip);
  displayShips();
  clearShipForm();
  updateShipDropdown();
  saveToStorage();
}

// Display all ships in the table
function displayShips() {
  const tableBody = document.getElementById("ships-list");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  ships.forEach((ship) => {
    const row =
      ship.id === editingShipId
        ? createShipEditRow(ship)
        : createShipDisplayRow(ship);
    tableBody.insertAdjacentHTML("beforeend", row);
  });
}

// Create a display row for a ship
function createShipDisplayRow(ship) {
  return `
    <tr>
      <td><img src="${ship.img}"></td>
      <td>${ship.brand}</td>
      <td>${ship.model}</td>
      <td>
        <button onclick="startEditShip(${ship.id})">Edit</button>
        <button onclick="deleteShip(${ship.id})">Delete</button>
      </td>
    </tr>`;
}

// Create an edit row for a ship
function createShipEditRow(ship) {
  return `
    <tr>
      <td><input type="url" id="edit-ship-img" value="${ship.img}"></td>
      <td><input type="text" id="edit-ship-brand" value="${ship.brand}"></td>
      <td><input type="text" id="edit-ship-model" value="${ship.model}"></td>
      <td>
        <button onclick="saveEditShip(${ship.id})">Save</button>
        <button onclick="cancelEditShip()">Cancel</button>
      </td>
    </tr>`;
}

// Delete a ship from the array and update display
function deleteShip(idToDelete) {
  const shipToDelete = ships.find((s) => s.id === idToDelete);
  if (shipToDelete) {
    if (
      confirm(
        `Are you sure you want to delete the ship ${shipToDelete.brand} ${shipToDelete.model} ?`,
      )
    ) {
      ships = ships.filter((s) => s.id !== idToDelete);
      displayShips();
      updateShipDropdown();
      if (typeof displayPilots === "function") displayPilots();
      saveToStorage();
    }
  }
}

// Start editing a ship
function startEditShip(id) {
  editingShipId = id;
  displayShips();
}

// Cancel editing and return to display mode
function cancelEditShip() {
  editingShipId = null;
  displayShips();
}

// Save changes made during an edit
function saveEditShip(id) {
  const ship = ships.find((s) => s.id === id);
  const brand = document.getElementById("edit-ship-brand").value.trim();
  const model = document.getElementById("edit-ship-model").value.trim();

  if (!brand || !model) {
    alert("Please fill in Brand and Model");
    return;
  }

  ship.brand = brand;
  ship.model = model;
  ship.img = document.getElementById("edit-ship-img").value.trim();

  editingShipId = null;
  displayShips();
  updateShipDropdown();
  if (typeof displayPilots === "function") displayPilots();
  saveToStorage();
}

// Update the dropdown menu for selecting a ship
function updateShipDropdown() {
  const select = document.getElementById("pilot-ship");
  if (!select) return;

  select.innerHTML = '<option value="">Select a ship</option>';
  ships.forEach((ship) => {
    select.innerHTML += `<option value="${ship.id}">${ship.brand} - ${ship.model}</option>`;
  });
}

// Clear the input form fields
function clearShipForm() {
  document.getElementById("ship-brand").value = "";
  document.getElementById("ship-model").value = "";
  document.getElementById("ship-img").value = "";
}

document.addEventListener("DOMContentLoaded", () => {
  displayShips();
  updateShipDropdown();
});
