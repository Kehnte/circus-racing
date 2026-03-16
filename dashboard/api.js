// api.js — Authenticated API helpers for the dashboard

// Get stored JWT
function getJwt() {
    return localStorage.getItem("cr_jwt");
}

// Show login overlay, hide main content
function showLoginOverlay() {
    const overlay = document.getElementById("auth-overlay");
    const main = document.querySelector(".page-content");
    if (overlay) overlay.style.display = "flex";
    if (main) main.style.display = "none";
}

// Hide login overlay, reveal main content
function hideLoginOverlay() {
    const overlay = document.getElementById("auth-overlay");
    const main = document.querySelector(".page-content");
    if (overlay) overlay.style.display = "none";
    if (main) main.style.display = "";
    if (typeof window.crNavRefresh === "function") window.crNavRefresh();
}

// Core request — injects JWT, surfaces 401 as a login redirect
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

// Handle login form submission
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

// Clear JWT and show login overlay
function dashboardLogout() {
    localStorage.removeItem("cr_jwt");
    localStorage.removeItem("cr_pilot");
    showLoginOverlay();
}

// Tell the shared nav to use dashboardLogout instead of redirecting to register
window.crCustomLogout = dashboardLogout;

// Load all dashboard modules in dependency order
async function initDashboard() {
    try {
        await Promise.all([
            typeof initTeams    === "function" ? initTeams()    : Promise.resolve(),
            typeof initVehicles === "function" ? initVehicles() : Promise.resolve(),
            typeof initControls === "function" ? initControls() : Promise.resolve(),
        ]);
        // Pilots depend on teams/vehicles/controls arrays being populated first
        if (typeof initPilots === "function") await initPilots();
        // Restore race settings from localStorage
        if (typeof loadRaceSettings === "function") loadRaceSettings();
        // Populate active race selector
        if (typeof loadActiveRaceList === "function") loadActiveRaceList();
    } catch (e) {
        console.error("Dashboard init error:", e);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Hide content while checking auth; each branch will reveal it
    const main = document.querySelector(".page-content");
    if (main) main.style.display = "none";

    if (!getJwt()) {
        showLoginOverlay();
    } else {
        hideLoginOverlay();
        initDashboard();
    }

    // Allow submitting login with Enter
    document.getElementById("login-password")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") dashboardLogin();
    });
});

// Notify other tabs (e.g. pilot profile) that a data resource has changed
const crDataChannel = new BroadcastChannel("cr-data");
function broadcastChange(resource) {
    crDataChannel.postMessage({ resource });
}
