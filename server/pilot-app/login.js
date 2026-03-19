// login.js — Logique de connexion pilote (displayName + password)

document.addEventListener("DOMContentLoaded", () => {
    // Already logged in → go straight to profile
    if (localStorage.getItem("cr_jwt")) {
        window.location.href = "profile.html";
        return;
    }

    // Submit on Enter key
    document.getElementById("field-password").addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleLogin();
    });
    document.getElementById("field-displayName").addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleLogin();
    });
});

async function handleLogin() {
    hideError();

    const displayName = fieldValue("field-displayName");
    const password    = fieldValue("field-password");

    if (!displayName) { showError("Display name is required"); return; }
    if (!password)    { showError("Password is required"); return; }

    const btn = document.getElementById("btn-login");
    btn.disabled = true;

    try {
        const data = await apiFetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayName, password }),
        });

        localStorage.setItem("cr_jwt", data.token);
        localStorage.setItem("cr_pilot", JSON.stringify(data.pilot));

        window.location.href = "profile.html";
    } catch (err) {
        showError(err.message || "Login failed. Check your credentials.");
        btn.disabled = false;
    }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function showError(msg) {
    document.getElementById("error-text").textContent = msg;
    document.getElementById("error-banner").hidden = false;
}

function hideError() {
    document.getElementById("error-banner").hidden = true;
}

function fieldValue(id) {
    return (document.getElementById(id)?.value ?? "").trim();
}

async function apiFetch(path, options = {}) {
    const res  = await fetch(path, options);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
}
