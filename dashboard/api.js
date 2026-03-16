// api.js — Authenticated API helpers for the dashboard

/** Get the stored JWT */
function getJwt() {
    return localStorage.getItem("cr_jwt");
}

/** Show the login overlay and hide the main content */
function showLoginOverlay() {
    const overlay = document.getElementById("auth-overlay");
    const main = document.querySelector(".page-content");
    if (overlay) overlay.style.display = "flex";
    if (main) main.style.display = "none";
}

/** Hide the login overlay and show the main content */
function hideLoginOverlay() {
    const overlay = document.getElementById("auth-overlay");
    const main = document.querySelector(".page-content");
    if (overlay) overlay.style.display = "none";
    if (main) main.style.display = "";
}

/** Core request — injects JWT, handles 401 */
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

/** Handle login form submission */
async function dashboardLogin() {
    const email    = document.getElementById("login-email")?.value?.trim();
    const password = document.getElementById("login-password")?.value;
    const errorEl  = document.getElementById("login-error");
    if (errorEl) errorEl.textContent = "";

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
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

/** Logout: clear JWT and show login overlay */
function dashboardLogout() {
    localStorage.removeItem("cr_jwt");
    localStorage.removeItem("cr_pilot");
    showLoginOverlay();
}

/** Initialise all dashboard modules after auth succeeds */
async function initDashboard() {
    try {
        // Load reference data in parallel
        await Promise.all([
            typeof initTeams    === "function" ? initTeams()    : Promise.resolve(),
            typeof initVehicles === "function" ? initVehicles() : Promise.resolve(),
            typeof initControls === "function" ? initControls() : Promise.resolve(),
        ]);
        // Pilots depend on teams/vehicles/controls for display
        if (typeof initPilots === "function") await initPilots();
        // Restore race settings from localStorage
        if (typeof loadRaceSettings === "function") loadRaceSettings();
        // Registrations section
        if (typeof loadRaceListForRegistrations === "function") loadRaceListForRegistrations();
    } catch (e) {
        console.error("Dashboard init error:", e);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Start hidden; reveal once auth is confirmed
    const main = document.querySelector(".page-content");
    if (main) main.style.display = "none";

    if (!getJwt()) {
        showLoginOverlay();
    } else {
        hideLoginOverlay();
        initDashboard();
    }

    // Submit login on Enter in password field
    document.getElementById("login-password")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") dashboardLogin();
    });
});
