// racetracks.js

let _racetracks = [];
let _createCircuitFormVisible = false;
let _pendingCircuitCheckpoints = null;

async function initRacetracks() {
    await loadRacetracks();
}

async function loadRacetracks() {
    try {
        _racetracks = await apiGet("/racetracks");
        renderRacetracks();
    } catch (err) {
        console.warn("racetracks: failed to load", err.message);
    }
}

function renderRacetracks() {
    const tbody = document.getElementById("circuits-list");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (_racetracks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--md-sys-color-on-surface-variant); padding: 20px;">Aucun circuit enregistré.</td></tr>`;
        return;
    }

    _racetracks.forEach(track => {
        const count = track.checkpoints?.length ?? 0;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-weight: 500;">${escCircuit(track.name)}</td>
            <td style="text-align: center;">
                <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 13px;">
                    <span class="material-symbols-outlined" style="font-size: 16px;">location_on</span>
                    ${count}
                </span>
            </td>
            <td>
                <md-icon-button onclick="deleteCircuit('${escCircuit(track.id)}')" title="Supprimer le circuit" style="--md-icon-button-icon-color: var(--md-sys-color-error);">
                    <md-icon>delete</md-icon>
                </md-icon-button>
            </td>`;
        tbody.appendChild(tr);
    });
}

function toggleCreateCircuitForm() {
    _createCircuitFormVisible = !_createCircuitFormVisible;
    const form = document.getElementById("create-circuit-form");
    if (!form) return;
    form.style.display = _createCircuitFormVisible ? "block" : "none";
    if (_createCircuitFormVisible) {
        document.getElementById("new-circuit-name")?.focus();
        document.getElementById("create-circuit-error").textContent = "";
        document.getElementById("circuit-json-preview").textContent = "";
        _pendingCircuitCheckpoints = null;
        const fileInput = document.getElementById("circuit-json-input");
        if (fileInput) fileInput.value = "";
    }
}

// called when user selects a JSON file
function onCircuitJsonSelected(event) {
    const file = event.target.files?.[0];
    const preview = document.getElementById("circuit-json-preview");
    if (!file) { _pendingCircuitCheckpoints = null; return; }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const raw = JSON.parse(e.target.result);
            _pendingCircuitCheckpoints = parseCheckpoints(raw);
            if (preview) preview.textContent = `✓ ${_pendingCircuitCheckpoints.length} checkpoint(s) détectés`;
        } catch (err) {
            _pendingCircuitCheckpoints = null;
            if (preview) preview.textContent = `✗ JSON invalide : ${err.message}`;
        }
    };
    reader.readAsText(file);
}

// normalise various JSON formats into [{ order, position: [x,y,z] }]
function parseCheckpoints(raw) {
    if (!Array.isArray(raw)) throw new Error("Le fichier doit contenir un tableau JSON");

    return raw.map((item, i) => {
        if (Array.isArray(item) && item.length >= 3) {
            return { order: i, position: [Number(item[0]), Number(item[1]), Number(item[2])] };
        }
        if (typeof item === "object" && item !== null) {
            const x = item.x ?? item[0];
            const y = item.y ?? item[1];
            const z = item.z ?? item[2];
            if (x != null && y != null && z != null) {
                return { order: i, position: [Number(x), Number(y), Number(z)] };
            }
            if (Array.isArray(item.position) && item.position.length >= 3) {
                return { order: i, position: [Number(item.position[0]), Number(item.position[1]), Number(item.position[2])] };
            }
        }
        throw new Error(`Format non reconnu à l'index ${i}`);
    });
}

async function submitCreateCircuit() {
    const errorEl = document.getElementById("create-circuit-error");
    if (errorEl) errorEl.textContent = "";

    const name = document.getElementById("new-circuit-name")?.value?.trim();
    if (!name) { if (errorEl) errorEl.textContent = "Le nom est requis."; return; }

    const body = { name, checkpoints: _pendingCircuitCheckpoints ?? [] };

    try {
        await apiPost("/racetracks", body);
        toggleCreateCircuitForm();
        await loadRacetracks();
    } catch (e) {
        if (errorEl) errorEl.textContent = e.message;
    }
}

async function deleteCircuit(id) {
    if (!confirm("Supprimer ce circuit ? Cette action est irréversible.")) return;
    try {
        await apiDelete(`/racetracks/${id}`);
        await loadRacetracks();
    } catch (e) {
        alert(`Erreur : ${e.message}`);
    }
}

function escCircuit(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", () => {
    initRacetracks();
});
