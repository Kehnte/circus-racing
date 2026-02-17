let controlsList = [];
let editingControlId = null;

function addControl() {
  const type = document.getElementById("control-type").value.trim();
  const img = document.getElementById("control-img").value.trim();

  if (!type) {
    alert("Please fill in the control type");
    return;
  }

  const newControl = {
    id: Date.now(),
    type: type,
    img: img || "https://placehold.co/40x40/png",
  };

  controlsList.push(newControl);
  displayControls();
  document.getElementById("control-type").value = "";
  document.getElementById("control-img").value = "";
  if (typeof updateControlDropdown === "function") updateControlDropdown();
  saveToStorage();
}

function displayControls() {
  const tableBody = document.getElementById("controls-list");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  controlsList.forEach((ctrl) => {
    const row =
      ctrl.id === editingControlId
        ? createControlEditRow(ctrl)
        : createControlDisplayRow(ctrl);
    tableBody.insertAdjacentHTML("beforeend", row);
  });
}

function createControlDisplayRow(ctrl) {
  return `
    <tr>
      <td><img src="${ctrl.img}"></td>
      <td>${ctrl.type}</td>
      <td>
        <button onclick="startEditControl(${ctrl.id})">Edit</button>
        <button onclick="deleteControl(${ctrl.id})">Delete</button>
      </td>
    </tr>`;
}

function createControlEditRow(ctrl) {
  return `
    <tr>
      <td><input type="url" id="edit-control-img" value="${ctrl.img}"></td>
      <td><input type="text" id="edit-control-type" value="${ctrl.type}"></td>
      <td>
        <button onclick="saveEditControl(${ctrl.id})">Save</button>
        <button onclick="cancelEditControl()">Cancel</button>
      </td>
    </tr>`;
}

function deleteControl(id) {
  if (confirm("Delete this control type?")) {
    controlsList = controlsList.filter((c) => c.id !== id);
    displayControls();
    if (typeof updateControlDropdown === "function") updateControlDropdown();
    if (typeof displayPilots === "function") displayPilots();
    saveToStorage();
  }
}

function startEditControl(id) {
  editingControlId = id;
  displayControls();
}
function cancelEditControl() {
  editingControlId = null;
  displayControls();
}

function saveEditControl(id) {
  const ctrl = controlsList.find((c) => c.id === id);
  ctrl.type = document.getElementById("edit-control-type").value.trim();
  ctrl.img = document.getElementById("edit-control-img").value.trim();
  editingControlId = null;
  displayControls();
  if (typeof updateControlDropdown === "function") updateControlDropdown();
  if (typeof displayPilots === "function") displayPilots();
  saveToStorage();
}