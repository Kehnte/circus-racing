// api.js

// get stored JWT
function getJwt() {
    return localStorage.getItem("cr_jwt");
}

// show login overlay and hide main content
function showLoginOverlay() {
    const overlay = document.getElementById("auth-overlay");
    const main = document.querySelector(".page-content");
    if (overlay) overlay.style.display = "flex";
    if (main) main.style.display = "none";
}

// hide login overlay and reveal main content
function hideLoginOverlay() {
    const overlay = document.getElementById("auth-overlay");
    const main = document.querySelector(".page-content");
    if (overlay) overlay.style.display = "none";
    if (main) main.style.display = "";
    if (typeof window.crNavRefresh === "function") window.crNavRefresh();
}

// authenticated fetch with JWT injection; redirects to login on 401
async function apiRequest(method, path, body) {
    const jwt = getJwt();
    const opts = {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(`/api${path}`, opts);
    if (res.status === 401) {
        showLoginOverlay();
        throw new Error(`Unauthorized: ${method} ${path}`);
    }
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
    return data;
}

const apiGet    = (path)       => apiRequest("GET",    path);
const apiPost   = (path, body) => apiRequest("POST",   path, body);
const apiPatch  = (path, body) => apiRequest("PATCH",  path, body);
const apiDelete = (path)       => apiRequest("DELETE", path);

// submit the login form and store JWT on success
async function dashboardLogin() {
    const displayName = document.getElementById("login-displayname")?.value?.trim();
    const password    = document.getElementById("login-password")?.value;
    const errorEl     = document.getElementById("login-error");
    if (errorEl) errorEl.textContent = "";

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayName, password }),
        });
        const data = await res.json();
        if (!res.ok) {
            if (errorEl) errorEl.textContent = data.error || "Login failed";
            return;
        }
        if (data.pilot.role === "PILOT") {
            if (errorEl) errorEl.textContent = "Access denied — Admin or Moderator required";
            return;
        }
        localStorage.setItem("cr_jwt", data.token);
        localStorage.setItem("cr_pilot", JSON.stringify(data.pilot));
        hideLoginOverlay();
        await initDashboard();
    } catch {
        if (errorEl) errorEl.textContent = "Connection error";
    }
}

// clear JWT and show login overlay
function dashboardLogout() {
    localStorage.removeItem("cr_jwt");
    localStorage.removeItem("cr_pilot");
    showLoginOverlay();
}

window.crCustomLogout = dashboardLogout;

// load all dashboard modules in dependency order
async function initDashboard() {
    try {
        await Promise.all([
            typeof initTeams      === "function" ? initTeams()      : Promise.resolve(),
            typeof initVehicles   === "function" ? initVehicles()   : Promise.resolve(),
            typeof initControls   === "function" ? initControls()   : Promise.resolve(),
            typeof initRacetracks === "function" ? initRacetracks() : Promise.resolve(),
        ]);
        // pilots depend on teams/vehicles/controls being populated first
        if (typeof initPilots        === "function") await initPilots();
        if (typeof loadRaceSettings  === "function") loadRaceSettings();
        if (typeof loadActiveRaceList === "function") loadActiveRaceList();
    } catch (e) {
        console.error("Dashboard init error:", e);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const main = document.querySelector(".page-content");
    if (main) main.style.display = "none";

    if (!getJwt()) {
        showLoginOverlay();
    } else {
        hideLoginOverlay();
        initDashboard();
    }

    document.getElementById("login-displayname")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") dashboardLogin();
    });
    document.getElementById("login-password")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") dashboardLogin();
    });
});

// broadcast a data change to other tabs via BroadcastChannel
const crDataChannel = new BroadcastChannel("cr-data");
function broadcastChange(resource) {
    crDataChannel.postMessage({ resource });
}
